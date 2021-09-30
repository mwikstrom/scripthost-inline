import { InlineScriptSandbox } from "../src";

describe("InlineScriptSandbox", () => {
    it("can be constructed without args", () => {
        const sandbox = new InlineScriptSandbox();
        expect(sandbox).toBeInstanceOf(InlineScriptSandbox);
        sandbox.dispose();
    });

    it("can evaluate basic expression", async () => {
        const sandbox = new InlineScriptSandbox();
        const output = new Promise(resolve => sandbox.listen(resolve));
        sandbox.post({
            type: "eval",
            messageId: "msg-123",
            script: "'foobar'.length * 2",
        });
        expect(await output).toMatchObject({
            type: "result",
            messageId: "sandbox-1",
            inResponseTo: "msg-123",
            result: 12,
        });
        sandbox.dispose();
    });
});