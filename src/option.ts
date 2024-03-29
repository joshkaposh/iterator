import { ErrorExt } from "./iter";

export type None = null | undefined
export type Option<T> = T | None;

export type Ok<T = undefined> = T;
export type Err<T = any> = Error & {
    get(): T;
}
export type Result<T, E extends Err<unknown>> = T | E

export type AsOption<R extends Result<any, Err<any>>> =
    R extends Error ? never : Option<R>

export function ok<R extends Result<any, Err<any>>>(result: R): AsOption<R> {
    if (result instanceof Error) {
        return null as AsOption<R>
    }
    return result as AsOption<R>
}

export function is_none<T>(value: Option<T>): value is None {
    return (value ?? null) === null
}

export function is_some<T>(value: Option<T>): value is T {
    return (value ?? null) !== null
}

export function is_error<E extends Err>(value: unknown): value is E {
    return value instanceof ErrorExt;
}

export function or<T>(opt: Option<T>, optb: Option<T>): Option<T> {
    return is_some(opt) ? opt : optb
}

export function or_else<T>(opt: Option<T>, f: () => Option<T>): Option<T> {
    return is_some(opt) ? opt : f()
}