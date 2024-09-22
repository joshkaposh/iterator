import { Iterator, is_arraylike } from "./iter";
import { AsyncIterator } from "./iter-async";
import { Ok, type Result, ErrorExt } from "joshkaposh-option";
import { IterInputType } from "./types";

export function done<TReturn>(): IteratorResult<TReturn> {
    return {
        done: true,
        value: undefined as TReturn
    }
}

export function iter_item<T>(value: T): IteratorYieldResult<T> {
    return {
        done: false,
        value: value
    }
}

export function map_next<A, B>(prev: IteratorResult<A>, next: (value: A) => B): IteratorResult<B> {
    return !prev.done ? { done: false, value: next(prev.value) } : done();
}

export function iter_type<It extends IterInputType<any>>(iterable: It) {
    if (iterable instanceof Iterator || iterable instanceof AsyncIterator) {
        return 'iter'
    } else if (is_arraylike(iterable)) {
        return 'arraylike'
        // @ts-expect-error
    } else if (iterable && (iterable[Symbol.iterator] || iterable[Symbol.asyncIterator])) {
        return 'iterable'
    } else if (typeof iterable === 'function') {
        return 'function'
    } else {
        return 'invalid'
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
