import { 
    EvaluateScriptRequest,
    GenericMessage, 
    GenericResponse, 
    isErrorResponse, 
    isEvaluateScriptResponse, 
    ScriptSandbox, 
    ScriptValue,
    TrackedVariable, 
} from "scripthost-core";
import { InlineScriptSandbox } from "../src";

describe("InlineScriptSandbox", () => {
    it("can be constructed without args", () => {
        const sandbox = new InlineScriptSandbox();
        expect(sandbox).toBeInstanceOf(InlineScriptSandbox);
        sandbox.dispose();
    });

    it("can evaluate basic expression", async () => {
        const sandbox = new InlineScriptSandbox();
        const request: EvaluateScriptRequest = {
            type: "eval",
            messageId: "msg-123",
            script: "'foobar'.length * 2",
        };
        const response = await getResponse(sandbox, request, isEvaluateScriptResponse);
        expect(response).toMatchObject({
            type: "result",
            messageId: "sandbox-1",
            inResponseTo: "msg-123",
            result: 12,
        });
        sandbox.dispose();
    });

    it("can read and write global variable", async () => {
        const sandbox = new InlineScriptSandbox();
        const firstRequest: EvaluateScriptRequest = {
            type: "eval",
            messageId: "first",
            script: "value || 0",
            track: true,
            idempotent: true,
        };
        const firstResponse = await getResponse(sandbox, firstRequest, isEvaluateScriptResponse);
        expect(firstResponse).toMatchObject({
            type: "result",
            messageId: "sandbox-1",
            inResponseTo: "first",
            result: 0,
            vars: new Map<string, TrackedVariable>([["value", { read: 0 }]]),
        });

        const secondRequest: EvaluateScriptRequest = {
            type: "eval",
            messageId: "second",
            script: "value = 123",
            track: true,
        };
        const secondResponse = await getResponse(sandbox, secondRequest, isEvaluateScriptResponse);
        expect(secondResponse).toMatchObject({
            type: "result",
            messageId: "sandbox-2",
            inResponseTo: "second",
            result: 123,
            vars: new Map<string, TrackedVariable>([["value", { read: 0, write: 1 }]]),
        });

        const thirdRequest: EvaluateScriptRequest = {
            type: "eval",
            messageId: "third",
            script: "value || 0",
            track: true,
            idempotent: true,
        };
        const thirdResponse = await getResponse(sandbox, thirdRequest, isEvaluateScriptResponse);
        expect(thirdResponse).toMatchObject({
            type: "result",
            messageId: "sandbox-3",
            inResponseTo: "third",
            result: 123,
            vars: new Map<string, TrackedVariable>([["value", { read: 1 }]]),
        });

        sandbox.dispose();
    });


    it("can read and write instance variable", async () => {
        const sandbox = new InlineScriptSandbox();
        const firstRequest: EvaluateScriptRequest = {
            type: "eval",
            messageId: "first",
            script: "this.value || 0",
            track: true,
            idempotent: true,
            instanceId: "test",
        };
        const firstResponse = await getResponse(sandbox, firstRequest, isEvaluateScriptResponse);
        expect(firstResponse).toMatchObject({
            type: "result",
            messageId: "sandbox-1",
            inResponseTo: "first",
            result: 0,
        });

        const secondRequest: EvaluateScriptRequest = {
            type: "eval",
            messageId: "second",
            script: "this.value = 123",
            track: true,
            instanceId: "test",
        };
        const secondResponse = await getResponse(sandbox, secondRequest, isEvaluateScriptResponse);
        expect(secondResponse).toMatchObject({
            type: "result",
            messageId: "sandbox-2",
            inResponseTo: "second",
            result: 123,
        });

        const thirdRequest: EvaluateScriptRequest = {
            type: "eval",
            messageId: "third",
            script: "this.value || 0",
            track: true,
            idempotent: true,
            instanceId: "test",
        };
        const thirdResponse = await getResponse(sandbox, thirdRequest, isEvaluateScriptResponse);
        expect(thirdResponse).toMatchObject({
            type: "result",
            messageId: "sandbox-3",
            inResponseTo: "third",
            result: 123,
        });

        sandbox.dispose();
    });

    it("can invoke fixed global function", async () => {
        const sandbox = new InlineScriptSandbox();
        const result = await evalScript(sandbox, "isFinite(123)");
        expect(result).toBe(true);
    });

    it("cannot assign fixed global variable", async () => {
        const sandbox = new InlineScriptSandbox();
        await expect(() => evalScript(sandbox, "Math = 123")).rejects.toThrow(
            "Cannot assign fixed global variable 'Math'"
        );
    });

    it("cannot assign global variable in idempotent script", async () => {
        const sandbox = new InlineScriptSandbox();
        await expect(() => evalScript(sandbox, "value = 123", { idempotent: true })).rejects.toThrow(
            "Idempotent script cannot assign global variable 'value'"
        );
    });
});

let requestCounter = 0;

const evalScript = async (
    sandbox: ScriptSandbox,
    script: string,
    options: Pick<EvaluateScriptRequest, "idempotent" | "instanceId"> = {},
): Promise<ScriptValue> => {
    const request: EvaluateScriptRequest = {
        ...options,
        type: "eval",
        messageId: `test-${++requestCounter}`,
        script,
    };
    const { result } = await getResponse(sandbox, request, isEvaluateScriptResponse);
    return result;
};

const getResponse = <T extends GenericResponse>(
    sandbox: ScriptSandbox,
    input: GenericMessage,
    predicate: (response: ScriptValue) => response is T,
): Promise<T> => new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
        reject(new Error("Did not receive a response within the timeout period"));
        stopListening();
    }, 2500);
    const stopListening = sandbox.listen(output => {
        if (predicate(output)) {
            resolve(output);
            stopListening();
            clearTimeout(timeout);
        } else if (isErrorResponse(output) && output.inResponseTo === input.messageId) {
            reject(new Error(output.message));
            stopListening();
            clearTimeout(timeout);
        }
    });
    sandbox.post(input);
});