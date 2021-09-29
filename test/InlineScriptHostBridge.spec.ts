import { InlineScriptHostBridge } from "../src";

describe("InlineScriptHostBridge", () => {
    it("can be constructed without args", () => {
        const bridge = new InlineScriptHostBridge();
        expect(bridge).toBeInstanceOf(InlineScriptHostBridge);
    });
});