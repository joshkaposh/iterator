import { Iterator, is_arraylike } from "./iter";
import { ErrorExt } from "joshkaposh-option";
import { IterInputType } from "./types";

export function done<T>(): IteratorResult<T> {
    return {
        done: true,
        value: undefined as T
    }
}

export function item<T>(value: T): IteratorYieldResult<T> {
    return {
        done: false,
        value: value
    }
}

export function iter_type<It extends IterInputType<any>>(iterable: It) {
    if (iterable instanceof Iterator) {
        return 'iter'
    } else if (is_arraylike(iterable as any)) {
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
