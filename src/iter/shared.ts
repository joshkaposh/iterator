import { ExactSizeIterator, Iterator } from './iterator'
import type { Result, Ok, Err, AsOption, Option } from "../option";
import { is_error, is_some } from '../option';
import { DoubleEndedIterator, ExactSizeDoubleEndedIterator, iter } from '.';

export type FoldFn<T, B, R = B> = (acc: B, x: T) => R
export type CollectFn<T, It extends Iterable<T>> = <Into extends (iter: It) => any | undefined>(into?: Into) => HasArgument<typeof into, Into> extends 1 ? Into extends (...args: any) => infer R ? R : never : T[]

export type Item<It> =
    It extends Iterable<infer T> ? T :
    It extends Iterator<infer T> ? T :
    never;

export type Done<TReturn = undefined> = Required<IteratorReturnResult<TReturn>>;
export type Next<T> = Required<IteratorYieldResult<T>>;
export type IterResult<T> = Next<T> | Done<T>;
export type SizeHint<Lo = number, Hi = Option<number>> = [Lo, Hi]

export type IntoCollection<It extends IterInputType<any>> = (
    (new (...args: any[]) => any) & { from(iter: It): any }
)

export type Collection<Coll extends IntoCollection<IterInputType<any>>> = Coll extends (new (...args: any[]) => any) & { from(iter: Iterable<any>): infer C } ? C : never;

export type HasArgument<Argument, ParamType> = ParamType extends NonNullable<Argument> ? 1 : 0

export type ArrayLikeType<T> = ArrayLike<T>
export type GeneratorType<T> = Generator<T>

export type DoubleEndedIteratorInputType<T = any> = ArrayLikeType<T> | DoubleEndedIterator<T>
export type IteratorInputType<T = any> = (() => Generator<T>) | Iterator<T> | (() => IterableIterator<T>);
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



export function is_arraylike<T>(obj?: (string | object) & { length?: number }): obj is ArrayLike<T> {
    return typeof obj !== 'function' && (typeof obj?.length === 'number' && obj.length >= 0)
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

class FromFn<T> extends Iterator<T> {
    #fn: () => Option<T>;
    constructor(fn: () => Option<T>) {
        super()
        this.#fn = fn;
    }

    override into_iter(): Iterator<T> {
        return this
    }

    override next(): IterResult<T> {
        const n = this.#fn();
        return is_some(n) ? iter_item(n) : done();
    }
}

export function into_iter<It extends Iterator<any> | DoubleEndedIterator<any>>(this_iter: It, inner: (Iterator<any> | DoubleEndedIterator<any> | ExactSizeIterator<any> | ExactSizeDoubleEndedIterator<any>)[]) {
    for (const it of inner) {
        if ('into_iter' in it) {
            it.into_iter();
        } else {
            console.error('into_iter was not found on %O', it)
        }
    }
    return this_iter;
}

export function from_fn<T>(f: () => Option<T>): FromFn<T> {
    return new FromFn(f)
}

export function collect<T>(iter: IterInputType<T>, into?: undefined): T[];
export function collect<T, I extends (new (it: Iterable<T>) => any)>(iter: IterInputType<T>, into: I): InstanceType<I>
export function collect<It extends IterInputType<any>, Into extends IntoCollection<It>>(it: It, into?: Into): Collection<Into> | Item<It>[] {
    if (into) {
        return new into(it)
    }

    return Array.from(iter(it))
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