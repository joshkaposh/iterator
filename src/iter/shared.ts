import type { AsOption, Err, Ok, Option, Result } from "../option";
import { ExactSizeIterator, Iterator } from './iterator'
import { is_error, is_some } from '../option';
import { DoubleEndedIterator, ExactSizeDoubleEndedIterator } from "./double-ended-iterator";
import { is_arraylike } from "../util";

export type DoubleEndedIteratorInputType<T = any> = ArrayLike<T> | DoubleEndedIterator<T>
export type IteratorInputType<T = any> = (() => Generator<T>) | (() => IterableIterator<T>) | Iterator<T> | Iterable<T>;
export type IterInputType<T = any> = DoubleEndedIteratorInputType<T> | IteratorInputType<T>;

export type IteratorType<T> = Generator<T> | Iterator<T> | ExactSizeIterator<T>;
export type DoubleEndedIteratorType<T> = ArrayLike<T> | DoubleEndedIterator<T> | ExactSizeDoubleEndedIterator<T>;
export type IterType<T> = IteratorType<T> | DoubleEndedIteratorType<T>

export type Iter<It> =
    It extends DoubleEndedIteratorInputType<infer T> ?
    It extends ExactSizeDoubleEndedIterator<T> | ArrayLike<T> ? ExactSizeDoubleEndedIterator<T> : DoubleEndedIterator<T> :
    It extends IteratorInputType<infer T> ?
    It extends ExactSizeIterator<T> ? ExactSizeIterator<T> : Iterator<T>
    : never;


export type ArrayLikeType<T> = ArrayLike<T>
export type GeneratorType<T> = Generator<T>



export type Item<It> = It extends Iterable<infer T> ? T : never;

export type SizeHint<Lo = number, Hi = Option<number>> = [Lo, Hi]

export type MustReturn<F extends (...args: any[]) => any> = ReturnType<F> extends void ? never : F;
export type Primitive = string | number | bigint | boolean | undefined | null | symbol;

export type ValidIteratorInput = "iter" | "arraylike" | "iterable" | "function" | "invalid"

export function iter_type<It extends IterInputType<any>>(iterable: It): ValidIteratorInput {
    if (iterable instanceof Iterator) {
        return 'iter'
    } else if (is_arraylike(iterable)) {
        return 'arraylike'
        // @ts-expect-error
    } else if (iterable && iterable[Symbol.iterator]) {
        return 'iterable'
    } else if (typeof iterable === 'function') {
        return 'function'
    } else {
        return 'invalid'
    }
}



export function collect<T>(iter: IterInputType<T>, into?: undefined): T[];
export function collect<T, I extends (new (it: Iterable<T>) => any)>(iter: IterInputType<T>, into: I): InstanceType<I>
export function collect<It extends Iterable<any>, Collection extends new (it: Iterable<Item<It>>) => any>(it: It, into?: Collection): InstanceType<Collection> | Item<It>[] {
    if (into) {
        return new into(it)
    }

    return Array.from(it as any) as any
}

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
        this.name = 'ErrorExt';
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