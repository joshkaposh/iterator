import { done, iter_item } from "../iter/shared";
import { Option, is_some } from "../option";
import { AsyncDoubleEndedIterator, ExactSizeAsyncDoubleEndedIterator } from "./async-double-ended-iterator";
import { AsyncIterator, ExactSizeAsyncIterator } from "./async-iterator";

// export type DoubleEndedIteratorInputType<T = any> = ArrayLike<T> | DoubleEndedIterator<T>
// export type IteratorInputType<T = any> = (() => Generator<T>) | (() => IterableIterator<T>) | Iterator<T> | Iterable<T>;
// export type IterInputType<T = any> = DoubleEndedIteratorInputType<T> | IteratorInputType<T>;

// export type IteratorType<T> = Generator<T> | Iterator<T> | ExactSizeIterator<T>;
// export type DoubleEndedIteratorType<T> = ArrayLike<T> | DoubleEndedIterator<T> | ExactSizeDoubleEndedIterator<T>;
// export type IterType<T> = IteratorType<T> | DoubleEndedIteratorType<T>

export type HasSymbolAsyncIterator<It, T = keyof It> = (T extends SymbolConstructor['asyncIterator'] ? T : never) extends never ? 0 : 1;

export type AsyncIteratorInputType<T> = (() => Generator<T>) | (() => IterableIterator<T>) | AsyncIterator<T> | Iterable<T>;
export type AsyncDoubleEndedIteratorInputType<T> = ArrayLike<T> | AsyncDoubleEndedIterator<T>;
export type AsyncIterInputType<T> = AsyncDoubleEndedIteratorType<T> | AsyncIteratorInputType<T>;


export type AsyncIteratorType<T> = AsyncIterator<T> | ExactSizeAsyncIterator<T>
export type AsyncDoubleEndedIteratorType<T> = any;

// export type Iter<It> =
//     It extends DoubleEndedIteratorInputType<infer T> ?
//     It extends ExactSizeDoubleEndedIterator<T> | ArrayLike<T> ? ExactSizeDoubleEndedIterator<T> : DoubleEndedIterator<T> :
//     It extends IteratorInputType<infer T> ?
//     It extends ExactSizeIterator<T> ? ExactSizeIterator<T> : Iterator<T>
//     : never;


export type AsyncIter<It> =
    It extends AsyncDoubleEndedIteratorInputType<infer T> ?
    It extends ExactSizeAsyncDoubleEndedIterator<T> ? ExactSizeAsyncDoubleEndedIterator<T> : AsyncDoubleEndedIterator<T> :
    It extends AsyncIteratorInputType<infer T> ?
    It extends ExactSizeAsyncIterator<T> ? ExactSizeAsyncIterator<T> : AsyncIterator<T>
    : never;



class AsyncFromFn<T> extends AsyncIterator<T> {
    #fn: () => Promise<Option<T>> | Option<T>;
    constructor(fn: () => Promise<Option<T>> | Option<T>) {
        super()
        this.#fn = fn;
    }

    override into_iter(): AsyncIterator<T> {
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        const n = await this.#fn();
        return is_some(n) ? iter_item(n) : done();
    }
}

export function from_async_fn<T>(f: () => Promise<Option<T>> | Option<T>): AsyncFromFn<T> {
    return new AsyncFromFn(f)
}