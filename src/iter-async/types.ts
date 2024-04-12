import { AsyncDoubleEndedIterator, ExactSizeAsyncDoubleEndedIterator } from "./async-double-ended-iterator";
import { AsyncIterator, ExactSizeAsyncIterator } from "./async-iterator";

export type HasSymbolAsyncIterator<It, T = keyof It> = (T extends SymbolConstructor['asyncIterator'] ? T : never) extends never ? 0 : 1;

export type AsyncIteratorInputType<T = any> = (() => AsyncGenerator<T>) | AsyncIterator<T>;
export type AsyncDoubleEndedIteratorInputType<T = any> = ArrayLike<T> | AsyncDoubleEndedIterator<T>;
export type AsyncIterInputType<T = any> = AsyncDoubleEndedIteratorInputType<T> | AsyncIteratorInputType<T>;

export type AsyncIteratorType<T> = AsyncIterator<T> | ExactSizeAsyncIterator<T>;
export type AsyncDoubleEndedIteratorType<T> = ArrayLike<T> | AsyncDoubleEndedIterator<T> | ExactSizeAsyncDoubleEndedIterator<T>;
export type AsyncIterType<T> = AsyncIteratorType<T> | AsyncDoubleEndedIteratorType<T>;

export type AsyncIter<It> =
    It extends AsyncDoubleEndedIteratorInputType<infer T> ?
    It extends ExactSizeAsyncDoubleEndedIterator<T> | ArrayLike<T> ? ExactSizeAsyncDoubleEndedIterator<T> : AsyncDoubleEndedIterator<T> :
    It extends AsyncIteratorInputType<infer T> ?
    It extends ExactSizeAsyncIterator<T> ? ExactSizeAsyncIterator<T> : AsyncIterator<T>
    : never;