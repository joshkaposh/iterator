import { ErrorExt } from "./iter/shared";

export type None = null | undefined
export type Option<T> = T | None;

export type Ok<T = undefined> = T;
export type Err<T = any> = Error & {
    get(): T;
}
export type Result<T, E extends Err<unknown>> = T | E

export type AsOption<R extends Result<any, Err<any>>> =
    R extends Error ? never : Option<R>

/**
* @description
* Checks if value equals null or undefined.
* is_none() is the reverse of is_some().
* @see 
* @example
* is_none('') === false;
* is_some(0) === false;
* is_some(null) === true
*/
export function is_none<T>(value: Option<T>): value is None {
    return (value ?? null) === null
}

/**
* @description
* Checks if value does NOT equal null or undefined.
* is_some() is the reverse of is_none().
* @example
* is_some('') === true;
* is_some(0) === true;
* is_some(null) === false
*/
export function is_some<T>(value: Option<T>): value is T {
    return (value ?? null) !== null
}

export function is_error<E extends Err>(value: unknown): value is E {
    return value instanceof ErrorExt;
}

/**
* @description
* result() performs a try/catch on the supplied function.
* If an Error is caught, result() returns it, otherwise the return value of the callback is returned
*/
export function result<T, E>(fn: () => T): Result<T, Err<E>> {
    let res = undefined;
    try {
        res = fn()
    } catch (e) {
        res = new ErrorExt(e);
    }
    return res as Result<T, Err<E>>;
}

/**
* @description ok() converts a Result into an Option
*/
export function ok<R extends Result<any, Err<any>>>(result: R): AsOption<R> {
    if (result instanceof Error) {
        return null as AsOption<R>
    }
    return result as AsOption<R>
}
