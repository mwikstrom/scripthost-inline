import { EvaluateScriptRequest, EvaluateScriptResponse, ScriptHostBridge } from "scripthost";

/**
 * A script host brigde that runs code inside the current VM
 * @public
 */
export class InlineScriptHostBridge implements ScriptHostBridge {
    dispose(): void {
        throw new Error("Method not implemented.");
    }

    post(message: EvaluateScriptRequest): void {
        throw new Error("Method not implemented.");
    }
    
    listen(handler: (message: EvaluateScriptResponse) => void): () => void {
        throw new Error("Method not implemented.");
    }
}