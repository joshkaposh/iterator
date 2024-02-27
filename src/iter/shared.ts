import { Item } from './iterator'
import type { Result, Ok, Err, AsOption } from "../option";
import { is_error } from '../option';

export type FoldFn<T, B, R = B> = (acc: B, x: T) => R
export type CollectFn<T, It extends Iterable<T>> = <Into extends (iter: It) => any | undefined>(into?: Into) => HasArgument<typeof into, Into> extends 1 ? Into extends (...args: any) => infer R ? R : never : T[]

export type Done<TReturn = undefined> = Required<IteratorReturnResult<TReturn>>;
export type Next<T> = Required<IteratorYieldResult<T>>;
export type IterResult<T> = Next<T> | Done<T>;

export type HasArgument<Argument, ParamType> = ParamType extends NonNullable<Argument> ? 1 : 0


export function is_arraylike<T>(obj?: (string | object) & { length?: number }): obj is ArrayLike<T> {
    return typeof obj !== 'function' && (typeof obj?.length === 'number' && obj.length >= 0)
}

export function* range(start: number, end: number) {
    for (let i = start; i < end; i++) {
        yield i
    }
}

export function done<TReturn>(): Done<TReturn> {
    return {
        done: true,
        value: undefined as TReturn
    }
}

export function iter_item<T>(value: T): Next<T> {
    return {
        done: false,
        value: value
    }
}

export function collect<It extends Iterable<any>>(iter: It, into?: undefined): Item<It>[];
export function collect<It extends Iterable<any>, Into extends (iter: It) => any>(iter: It, into: Into): ReturnType<Into>;
export function collect<It extends Iterable<any>, Into extends (iter: It) => any>(iter: It, into?: Into): ReturnType<Into> | Item<It>[] {
    if (into) {
        return into(iter);
    }

    return Array.from(iter)
}

export function unzip<K, V>(iter: IterableIterator<[K, V]>): [K[], V[]] {
    let keys = [];
    let values = [];
    for (const [key, value] of iter) {
        keys.push(key)
        values.push(value)
    }

    return [keys, values]
}

export class ErrorExt<T = any> extends Error implements Err {
    #err_data: T;
    static opt<R extends Result<unknown, ErrorExt>>(result: R): AsOption<R> {
        if (is_error(result)) {
            return result.get()
        }
        return result as AsOption<R>;

    }
    constructor(err_data: T, msg?: string, options?: ErrorOptions) {
        super(msg, options)
        this.#err_data = err_data;
    }
    get() {
        return this.#err_data
    }
}


export class NonZeroUsize extends ErrorExt<number> {
    constructor(err_data: number, options?: ErrorOptions) {
        super(err_data, `Expected ${err_data} to be NonZeroSize`, options)
    }
}

export function non_zero_usize<N extends number>(n: N): Result<Ok, NonZeroUsize> {
    if (n <= 0) {
        return new NonZeroUsize(n)
    }
    return
}