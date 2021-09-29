import { ScriptHostOutputMessage } from "scripthost";
import { InlineScriptHostBridge } from "../src";

describe("InlineScriptHostBridge", () => {
    it("can be constructed without args", () => {
        const bridge = new InlineScriptHostBridge();
        expect(bridge).toBeInstanceOf(InlineScriptHostBridge);
        bridge.dispose();
    });

    it("can evaluate basic expression", async () => {
        const bridge = new InlineScriptHostBridge();
        const output: ScriptHostOutputMessage[] = [];
        const stopListening = bridge.listen(message => output.push(message));
        bridge.post({
            type: "eval",
            script: "'foobar'.length * 2",
            correlationId: "dummy-123",
        });
        await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
        expect(output.length).toBe(1);
        expect(output[0]).toMatchObject({
            type: "result",
            result: 12,
        });
        stopListening();
        bridge.dispose();
    });
});