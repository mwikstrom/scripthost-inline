import { 
    ErrorResponse,
    EvaluateScriptRequest, 
    EvaluateScriptResponse,
    FunctionCallRequest,
    GenericMessage,
    GenericResponse,
    InitializeRequest,
    InitializeResponse,
    isErrorResponse,
    isEvaluateScriptRequest,
    isFunctionCallResponse,
    isGenericMessage,
    isGenericResponse,
    isInitializeRequest,
    isPingRequest,
    PingResponse,
    ScriptSandbox, 
    ScriptValue,
    TrackedVariable
} from "scripthost-core";
import { RootProxy } from "./internal/RootProxy";
import { createGlobalProxy, ScriptGlobals } from "./internal/ScriptGlobals";
import { createThisProxy, ScriptThisArg } from "./internal/ScriptThisArg";

/**
 * A script sandbox that runs code inside the current VM
 * @public
 */
export class InlineScriptSandbox implements ScriptSandbox {
    readonly #listeners = new Set<(message: ScriptValue) => void>();
    readonly #responseHandlers = new Map<string, (response: GenericResponse) => void>();
    readonly #activeInvocations = new Map<string, (this: void) => void>();
    readonly #validSyntax = new Set<string>();
    readonly #globalVars = new Map<string | symbol, unknown>();
    readonly #scriptVars = new Map<string, Map<string | symbol, unknown>>();
    readonly #functionCallTimeout = 30000; // TODO: Make it configurable
    #globalVersion = 0;
    #messageIdCounter = 0;
    #disposed = false;
    #funcs: ReadonlySet<string> | null = null;

    dispose(): void {
        this.#disposed = true;
        for (const [, revoke] of this.#activeInvocations) {
            revoke();
        }
        this.#activeInvocations.clear();
    }

    post(message: ScriptValue): void {
        if (this.#disposed) {
            return;
        } else if (isPingRequest(message)) {
            const pingResponse: PingResponse = {
                type: "pong",
                messageId: this.#nextMessageId(),
                inResponseTo: message.messageId,
            };
            this.#notify(pingResponse);
        } else if (isEvaluateScriptRequest(message)) {
            this.#handleEvalRequest(message);
        } else if (isInitializeRequest(message)) {
            this.#handleInitRequest(message);
        } else if (isGenericResponse(message)) {
            const handler = this.#responseHandlers.get(message.inResponseTo);
            if (handler) {
                this.#responseHandlers.delete(message.messageId);
                try {
                    handler(message);
                } catch (err) {
                    console.error("Exception in response handler:", err);
                }
            }
        } else if (isGenericMessage(message)) {
            const errorResponse: ErrorResponse = {
                type: "error",
                messageId: this.#nextMessageId(),
                inResponseTo: message.messageId,
                message: `Unsupported request: ${message.type}`,
            };
            this.#notify(errorResponse);
        }
    }
    
    listen(handler: (message: ScriptValue) => void): () => void {
        let active = true;
        this.#listeners.add(handler);
        return () => {
            if (active) {
                this.#listeners.delete(handler);
                active = false;
            }
        };
    }

    async #call(key: string, idempotent: boolean, invocationId: string, args: ScriptValue[]): Promise<ScriptValue> {
        const request: FunctionCallRequest = {
            type: "call",
            messageId: this.#nextMessageId(),
            key,
            args,
            idempotent,
            correlationId: invocationId,
        };
        const { result } = await this.#request(request, isFunctionCallResponse, this.#functionCallTimeout);
        return result;
    }

    async #request<T extends GenericResponse>(
        request: GenericMessage,
        predicate: (response: GenericResponse) => response is T,
        timeout: number,
    ): Promise<T> {
        this.#notify(request);
        return await this.#waitForResponse(request, predicate, timeout);
    }

    #waitForResponse<T extends GenericResponse>(
        request: GenericMessage,
        predicate: (response: GenericResponse) => response is T,
        timeout: number,
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timeoutId = timeout > 0 ? setTimeout(
                () => reject(new Error("Did not receive a response within the specified timeout")),
                timeout
            ) : null;

            this.#responseHandlers.set(request.messageId, response => {
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                }

                if (predicate(response)) {
                    resolve(response);
                } else if (isErrorResponse(response)) {
                    reject(new Error(response.message));
                } else {
                    reject(new Error(`Received unexpected response '${response.type}' to request '${request.type}'`));
                }
            });
        });
    }

    #handleInitRequest(request: InitializeRequest): void {
        const { messageId, funcs } = request;

        if (this.#funcs === null) {
            this.#funcs = Object.freeze(new Set(funcs));
            const response: InitializeResponse = {
                type: "ready",
                messageId: this.#nextMessageId(),
                inResponseTo: messageId,
            };
            this.#notify(response);
        } else {
            const response: ErrorResponse = {
                type: "error",
                messageId: this.#nextMessageId(),
                inResponseTo: messageId,
                message: "Sandbox is already initialized",
            };
            this.#notify(response);
        }
    }

    async #handleEvalRequest(request: EvaluateScriptRequest): Promise<void> {
        const { script, messageId, instanceId, idempotent, track, vars } = request;

        try {
            const tracked = track ? new Map<string, TrackedVariable>() : undefined;
            const response: EvaluateScriptResponse = {
                ...await this.#runScript(script, messageId, instanceId, idempotent, tracked, vars),
                type: "result",
                messageId: this.#nextMessageId(),
                inResponseTo: messageId,
                vars: tracked,
            };
            this.#notify(response);
        } catch (err) {
            const response: ErrorResponse = {
                type: "error",
                messageId: this.#nextMessageId(),
                inResponseTo: messageId,
                message: err instanceof Error ? err.message : "Unknown error",
            };
            this.#notify(response);
        }
    }

    #notify(message: ScriptValue): void {
        for (const handler of this.#listeners) {
            try {
                handler(message);
            } catch (e) {
                console.warn("Sandbox listener threw exception:", e);
            }
        }
    }

    async #runScript(
        script: string,
        invocationId: string,
        instanceId: string | null = null,
        idempotent = false,
        tracked = new Map<string, TrackedVariable>(),
        vars?: Record<string, ScriptValue>,
    ): Promise<Pick<EvaluateScriptResponse, "result" | "refresh">> {
        const { 
            proxy: globals,
            revoke: revokeGlobals ,
        } = this.#createGlobalProxy(idempotent, invocationId, tracked, vars);
        const instanceVars = this.#getInstanceVars(instanceId);
        const { 
            proxy: thisArg, 
            revoke: revokeThis
        } = createThisProxy(idempotent, instanceVars);
        const revoke = () => {
            revokeThis();
            revokeGlobals();
        };
        const compiled = this.#compileScript(script);
        try {
            if (this.#activeInvocations.has(invocationId)) {
                throw new Error(`Invocation ID '${invocationId}' is already active'`);
            }
            this.#activeInvocations.set(invocationId, revoke);
            const result = await compiled.call(thisArg, globals);
            const refresh = instanceVars.get("refresh");
            if (typeof refresh === "number" && refresh > 0) {
                return { result, refresh };
            } else {
                return { result};
            }
        } finally {
            revoke();
            this.#activeInvocations.delete(invocationId);
        }
    }

    #createGlobalProxy(
        idempotent: boolean,
        invocationId: string,
        tracked: Map<string, TrackedVariable>,
        local?: Record<string, ScriptValue>,
    ): RootProxy<ScriptGlobals> {
        const funcs = new Map<string, (args: unknown[]) => unknown>();
        const onRead = (key: string): void => {
            const variable = tracked.get(key) || {};
            const { read = 0, ...rest } = variable;
            tracked.set(key, { read: Math.max(read, this.#globalVersion), ...rest });
        };
        const onWrite = (key: string): void => {
            const variable = tracked.get(key) || {};
            const write = ++this.#globalVersion;
            tracked.set(key, { ...variable, write });
        };
        if (this.#funcs) {
            for (const key of this.#funcs) {
                const call = (args: unknown[]): unknown => {
                    return this.#call(key, idempotent, invocationId, args as ScriptValue[]);
                };
                funcs.set(key, call);
            }
        }
        return createGlobalProxy(idempotent, funcs, this.#globalVars, onRead, onWrite, local);
    }

    #getInstanceVars(instanceId: string | null): Map<string | symbol, unknown> {
        if (instanceId === null) {
            return new Map();
        }

        let existing = this.#scriptVars.get(instanceId);
        if (!existing) {
            this.#scriptVars.set(instanceId, existing = new Map());
        }

        return existing;
    }

    #compileScript(script: string): (this: ScriptThisArg, globals: ScriptGlobals) => Promise<ScriptValue> {
        const wrapped = `async () => ${script}`;
        this.#checkSyntax(`"use strict";${wrapped}`);
        const sandboxed = `
        with (globals) { 
            return (async function () { 
                return (${wrapped})();
            }).call(this);
        }`;
        const compiled = new Function("globals", sandboxed);
        return compiled as (this: ScriptThisArg, globals: ScriptGlobals) => Promise<ScriptValue>;
    }

    #checkSyntax(script: string): void {
        if (this.#validSyntax.has(script)) {
            return;
        }

        new Function(script);
        this.#validSyntax.add(script);

        if (this.#validSyntax.size > 100) {
            for (const first of this.#validSyntax) {
                this.#validSyntax.delete(first);
                break;
            }
        }
    }
    
    #nextMessageId(): string {
        return `sandbox-${++this.#messageIdCounter}`;
    }
}
