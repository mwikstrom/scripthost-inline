import { createRootProxy, RootProxy } from "./RootProxy";
import { getTransparentProxy } from "./TransparentProxy";

/** @internal */
export interface ScriptGlobals extends Record<string | symbol, unknown> {
    readonly Infinity: typeof Infinity;
    readonly NaN: typeof NaN;
    readonly undefined: typeof undefined;
    isFinite: typeof isFinite;
    isNaN: typeof isNaN;
    parseFloat: typeof parseFloat;
    parseInt: typeof parseInt;
    encodeURI: typeof encodeURI;
    encodeURIComponent: typeof encodeURIComponent;
    decodeURI: typeof decodeURI;
    decodeURIComponent: typeof decodeURIComponent;
    Object: typeof Object;
    Function: typeof Function;
    Boolean: typeof Boolean;
    Symbol: typeof Symbol;
    Error: typeof Error;
    EvalError: typeof EvalError;
    RangeError: typeof RangeError;
    ReferenceError: typeof ReferenceError;
    SyntaxError: typeof SyntaxError;
    TypeError: typeof TypeError;
    URIError: typeof URIError;
    Number: typeof Number;
    BigInt: typeof BigInt;
    Math: typeof Math;
    Date: typeof Date;
    String: typeof String;
    RegExp: typeof RegExp;
    Array: typeof Array;
    Int8Array: typeof Int8Array;
    Uint8Array: typeof Uint8Array;
    Uint8ClampedArray: typeof Uint8ClampedArray;
    Int16Array: typeof Int16Array;
    Uint16Array: typeof Uint16Array;
    Int32Array: typeof Int32Array;
    Uint32Array: typeof Uint32Array;
    Float32Array: typeof Float32Array;
    Float64Array: typeof Float64Array;
    BigInt64Array: typeof BigInt64Array;
    BigUint64Array: typeof BigUint64Array;
    Map: typeof Map;
    Set: typeof Set;
    WeakMap: typeof WeakMap;
    WeakSet: typeof WeakSet;
    ArrayBuffer: typeof ArrayBuffer;
    DataView: typeof DataView;
    JSON: typeof JSON;
    Promise: typeof Promise;
    delay(milliseconds?: number): Promise<void>;
}

/** @internal */
export function createGlobalProxy(
    idempotent: boolean,
    funcs: ReadonlyMap<string, (args: unknown[]) => unknown>,
    globalVars: Map<string | symbol, unknown>,
    onRead: (key: string) => void,
    onWrite: (key: string) => void,
): RootProxy<ScriptGlobals> {
    const keys = () => [...Object.keys(FIXED), ...globalVars.keys(), ...funcs.keys()];
    const has = (key: string | symbol): boolean => {
        if (typeof key === "string" && !(key in FIXED) && !funcs.has(key)) {
            onRead(key);
        }
        return true;
    };
    const read = (key: string | symbol): unknown => {
        if (typeof key === "string") {
            if (key in FIXED) {
                return getTransparentProxy(FIXED[key], root.proxy);
            }
            if (funcs.has(key)) {
                return getTransparentProxy(funcs.get(key), root.proxy);
            }
            onRead(key);
        }
        return globalVars.get(key);
    };
    const write = (key: string | symbol, value: unknown): boolean => {
        if (key in FIXED) {
            throw new Error(`Cannot assign fixed global variable '${String(key)}'`);
        }
        if (typeof key === "string" && funcs.has(key)) {
            throw new Error(`Cannot replace host function '${String(key)}'`);
        }
        if (idempotent) {
            throw new Error(`Idempotent script cannot assign global variable '${String(key)}'`);
        }
        if (typeof key === "string") {
            onWrite(key);
        }
        globalVars.set(key, value);
        return true;
    };
    const unset = (key: string | symbol): boolean => {
        if (key in FIXED) {
            throw new Error(`Cannot delete fixed global variable '${String(key)}'`);
        }
        if (typeof key === "string" && funcs.has(key)) {
            throw new Error(`Cannot delete host function '${String(key)}'`);
        }
        if (idempotent) {
            throw new Error(`Idempotent script cannot delete global variable '${String(key)}'`);
        }
        if (typeof key === "string") {
            onWrite(key);
        }
        globalVars.delete(key);
        return true;
    };
    const root = createRootProxy(
        "global scope",
        Object.freeze({}) as ScriptGlobals,
        keys,
        has,
        read,
        write,
        unset
    );
    return root;
}

const delay = (milliseconds = 0) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

const FIXED: Readonly<ScriptGlobals> = Object.freeze({
    Infinity,
    NaN,
    undefined,
    isFinite,
    isNaN,
    parseFloat,
    parseInt,
    encodeURI,
    encodeURIComponent,
    decodeURI,
    decodeURIComponent,
    Object,
    Function,
    Boolean,
    Symbol,
    Error,
    EvalError,
    RangeError,
    ReferenceError,
    SyntaxError,
    TypeError,
    URIError,
    Number,
    BigInt,
    Math,
    Date,
    String,
    RegExp,
    Array,
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
    BigInt64Array,
    BigUint64Array,
    Map,
    Set,
    WeakMap,
    WeakSet,
    ArrayBuffer,
    DataView,
    JSON,
    Promise,
    delay,
});