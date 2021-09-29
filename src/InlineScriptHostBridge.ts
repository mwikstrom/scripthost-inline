import { 
    EvaluateScriptRequest, 
    EvaluateScriptResponse, 
    ScriptHostBridge, 
    ScriptHostInputMessage, 
    ScriptHostOutputMessage, 
    ScriptValue,
    TrackedVariable
} from "scripthost";

/**
 * A script host brigde that runs code inside the current VM
 * @public
 */
export class InlineScriptHostBridge implements ScriptHostBridge {
    #listeners = new Set<(message: ScriptHostOutputMessage) => void>();

    dispose(): void {
        // TODO: revoke global proxy
        // TODO: revoke active call proxies
    }

    post(message: ScriptHostInputMessage): void {
        const { type } = message;
        if (type === "eval") {
            this._handleEvalRequest(message);
        } else {
            // TODO: Notify of error!
        }
    }
    
    listen(handler: (message: ScriptHostOutputMessage) => void): () => void {
        let active = true;
        this.#listeners.add(handler);
        return () => {
            if (active) {
                this.#listeners.delete(handler);
                active = false;
            }
        };
    }

    private async _handleEvalRequest(message: EvaluateScriptRequest): Promise<void> {
        const { correlationId, script, pure, track } = message;
        let result: ScriptValue;
        let error: string | undefined;
        const vars: Record<string, TrackedVariable> | undefined = track ? {} : undefined;

        try {
            result = await this._runScript(script, pure, vars);
        } catch (e) {
            error = String(e);
        }

        const output: EvaluateScriptResponse = {
            type: "result",
            correlationId,
            result,
            error,
            vars,
        };

        this._notify(output);
    }

    private _notify(message: ScriptHostOutputMessage): void {
        for (const handler of this.#listeners) {
            try {
                handler(message);
            } catch (e) {
                console.warn("Inline script host bridge listener threw exception:", e);
            }
        }
    }

    private async _runScript(
        script: string,
        pure?: boolean,
        vars?: Record<string, TrackedVariable>,
    ): Promise<ScriptValue> {
        if (pure && !DID_WARN_PURE) {
            console.warn("Pure script evaluation is not supported yet");
            DID_WARN_PURE = true;
        }

        if (vars && !DID_WARN_TRACKING) {
            console.warn("Tracked script evaluation is not supported yet");
            DID_WARN_TRACKING = true;
        }

        if (!DID_WARN_UNSAFE) {
            console.warn("Script evaluation is not sandboxed yet!");
            DID_WARN_UNSAFE = true;
        }

        // TODO: DO NOT USE EVAL!
        return await eval(`(() => ${script})()`);
    }    
}

let DID_WARN_PURE = false;
let DID_WARN_TRACKING = false;
let DID_WARN_UNSAFE = false;
