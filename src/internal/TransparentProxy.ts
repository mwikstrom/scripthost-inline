/* eslint-disable @typescript-eslint/ban-types */
import { ScriptGlobals } from "./ScriptGlobals";

/** @internal */
export const getTransparentProxy = <T>(target: T, globals: ScriptGlobals): T => {
    if (target === null || typeof target !== "object" || typeof target !== "function") {
        return target;
    }

    let proxies = TRANSPARENT_PROXIES_PER_GLOBALS.get(globals);
    if (!proxies) {
        TRANSPARENT_PROXIES_PER_GLOBALS.set(globals, proxies = new WeakMap());
    }

    let proxy = proxies.get(target);
    if (!proxy) {
        proxies.set(target, proxy = createTransparentProxy(target, globals));
    }

    return proxy as unknown as T;
};

const createTransparentProxy = (target: object, globals: ScriptGlobals): object => {
    const handler = createTransparentProxyHandler(globals);
    const proxy =  new Proxy(target, handler);
    TRANSPARENT_PROXIES.add(proxy);
    return proxy;
};

const createTransparentProxyHandler = <T extends object>(
    globals: ScriptGlobals
): Pick<Required<ProxyHandler<T>>, "apply" | "construct" | "get" | "getOwnPropertyDescriptor" | "getPrototypeOf">  => {
    const swap = <R>(raw: R): R => {
        if (raw === RAW_GLOBALS) {
            return globals as unknown as R;
        } else if (
            raw !== null && 
            ["function", "object"].includes(typeof raw) && 
            !TRANSPARENT_PROXIES.has(raw as unknown as object)
        ) {
            return getTransparentProxy(raw as unknown as object, globals) as unknown as R;
        } else {
            return raw;
        }
    };

    return {
        apply: (target: T, thisArg: unknown, argArray: unknown[]): unknown => swap(Reflect.apply(
            target as Function,
            thisArg,
            argArray,
        )),
        construct: (target: T, argArray: unknown[], newTarget: Function): object => swap(Reflect.construct(
            target as Function,
            argArray,
            newTarget,
        )),
        get: (target: T, p: string | symbol, receiver: unknown): unknown => {
            if (p === Symbol.unscopables) {
                return undefined;
            } else {
                return swap(Reflect.get(target, p, receiver));
            }
        },
        getOwnPropertyDescriptor: (target: T, p: string | symbol): PropertyDescriptor | undefined => {
            const raw = Reflect.getOwnPropertyDescriptor(target, p);

            if (!raw) {
                return undefined;
            }

            const { get: rawGet, value: rawValue, ...rest } = raw;
            const get = rawGet ? () => swap(rawGet()) : undefined;
            const value = swap(rawValue);
            return { get, value, ...rest };
        },
        getPrototypeOf: (target: T): object | null => swap(Reflect.getPrototypeOf(target)),
    };
};

const TRANSPARENT_PROXIES_PER_GLOBALS = new WeakMap<ScriptGlobals, WeakMap<object, object>>();
const TRANSPARENT_PROXIES = new WeakSet();
const RAW_GLOBALS = new Function("return this")();
