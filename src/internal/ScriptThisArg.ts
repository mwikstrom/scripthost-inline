import { createRootProxy, RootProxy } from "./RootProxy";

/** @internal */
export interface ScriptThisArg extends Record<string | symbol, unknown> {
    readonly idempotent: boolean;
}

/** @internal */
export function createThisProxy(
    idempotent: boolean,
    instanceVars: Map<string | symbol, unknown>,
): RootProxy<ScriptThisArg> {
    const fixedVars: Record<string | symbol, unknown> = { idempotent };
    const keys = () => [...Object.keys(fixedVars), ...instanceVars.keys()];
    const has = (key: string | symbol): boolean => key in fixedVars || instanceVars.has(key);
    const read = (key: string | symbol): unknown => key in fixedVars ? fixedVars[key] : instanceVars.get(key);
    const write = (key: string | symbol, value: unknown): boolean => {
        if (key in fixedVars) {
            throw new Error(`Instance variable '${String(key)}' cannot be assigned`);
        } else if (idempotent && key !== "refresh") {
            throw new Error(`Idempotent script cannot assign instance variable '${String(key)}'`);
        } else {
            instanceVars.set(key, value);
            return true;
        }
    };
    const unset = (key: string | symbol): boolean => {
        if (key in fixedVars) {
            throw new Error(`Instance variable '${String(key)}' cannot be deleted`);
        } else if (idempotent && key !== "refresh") {
            throw new Error(`Idempotent script cannot delete instance variable '${String(key)}'`);
        } else {
            instanceVars.delete(key);
            return true;
        }
    };

    return createRootProxy(
        "script instance",
        Object.freeze({}) as ScriptThisArg,
        keys,
        has,
        read,
        write,
        unset
    );
}