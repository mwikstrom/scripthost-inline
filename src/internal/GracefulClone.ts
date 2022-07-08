export async function gracefulClone<T>(value: T): Promise<Awaited<T>> {
    if (isPromise(value)) {
        const result = await value as Awaited<T>;
        return await gracefulClone(result);
    }
    
    if (Array.isArray(value)) {
        return await Promise.all(value.map(gracefulClone)) as unknown as Awaited<T>;
    }

    if (isSimpleObject(value)) {
        const entries = await Promise.all(Object.entries(value).map(cloneRecordEntry));
        return Object.fromEntries(entries) as unknown as Awaited<T>;
    }

    // NOTE: I'd really like to use the global `structuredClone` function here
    // but it's newly introduced so for now I'll just return the value as-is.
    // Next line should be: return structuredClone(value);
    return value as Awaited<T>;
}

async function cloneRecordEntry([key, value]: [PropertyKey, unknown]): Promise<[PropertyKey, unknown]> {
    const cloned = await gracefulClone(value);
    return [key, cloned];
}

function isPromise(thing: unknown): thing is Promise<unknown> {
    return isObject(thing) && hasProp(thing, "then") && typeof thing.then === "function";
}

function isSimpleObject(thing: unknown): thing is Record<PropertyKey, unknown> {
    return isObject(thing) && Object.getPrototypeOf(thing) === Object.prototype;
}

function isObject(thing: unknown): thing is Record<PropertyKey, unknown> {
    return typeof thing === "object" && thing !== null;
}

function hasProp<K extends PropertyKey>(thing: Record<PropertyKey, unknown>, key: K): thing is Record<K, unknown> {
    return key in thing;
}
