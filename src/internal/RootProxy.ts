/* eslint-disable @typescript-eslint/ban-types */

/** @internal */
export interface RootProxy<T> {
    proxy: T;
    revoke(this: void): void;
}

/** @internal */
export function createRootProxy<T extends object>(
    rootName: string,
    target: T,
    keys: () => Array<string | symbol>,
    has: (key: string | symbol) => boolean,
    read: (key: string | symbol) => unknown,
    write: (key: string | symbol, value: unknown) => boolean,
    unset: (key: string | symbol) => boolean,
): RootProxy<T> {
    const handler: Required<ProxyHandler<T>> = {
        apply: () => {
            throw new Error(`Cannot invoke ${rootName}`);
        },
        construct: () => {
            throw new Error(`Cannot construct ${rootName}`);
        },
        defineProperty: () => {
            throw new Error(`Cannot define property on ${rootName}`);
        },
        deleteProperty: (_, key: string | symbol) => unset(key),
        get: (_, key: string | symbol) => read(key),
        getOwnPropertyDescriptor: (_, key: string | symbol) => {
            if (has(key)) {
                return {
                    configurable: false,
                    enumerable: true,
                    writable: true,
                    get: () => read(key),
                    set: (value: unknown) => write(key, value),
                };
            }
        },
        getPrototypeOf: () => {
            throw new Error(`Cannot get prototype of ${rootName}`);
        },
        has: (_, key: string | symbol) => has(key),
        isExtensible: () => true,
        ownKeys: () => keys(),
        preventExtensions: () => {
            throw new Error(`Cannot prevent extensions of ${rootName}`);
        },
        set: (_, key: string | symbol, value: unknown) => write(key, value),
        setPrototypeOf: () => {
            throw new Error(`Cannot set prototype of ${rootName}`);
        },
    };
    return Proxy.revocable(target, handler);
}
