import { DoubleEndedIterator, ExactSizeDoubleEndedIterator } from "./iter/double-ended-iterator";
import { ExactSizeIterator, Iterator } from "./iter/iterator";
import { AsyncDoubleEndedIterator, ExactSizeAsyncDoubleEndedIterator } from "./iter-async/async-double-ended-iterator";
import { AsyncIterator, ExactSizeAsyncIterator } from "./iter-async/async-iterator";
import type { Option } from "./option";

export type ArrayLikeType<T> = ArrayLike<T>;
export type GeneratorType<T> = Generator<T>;

export type Item<It> = It extends Iterable<infer T> ? T : never;

export type SizeHint<Lo = number, Hi = Option<number>> = [Lo, Hi];

export type MustReturn<F extends (...args: any[]) => any> = ReturnType<F> extends void ? never : F;
export type Primitive = string | number | bigint | boolean | undefined | null | symbol;


export type HasSymbolIterator<It, T = keyof It> = (T extends SymbolConstructor['iterator'] ? T : never) extends never ? 0 : 1;

export type IteratorInputType<T = any> = (() => Generator<T>) | (() => IterableIterator<T>) | Iterator<T> | Iterable<T>
export type DoubleEndedIteratorInputType<T = any> = ArrayLike<T> | DoubleEndedIterator<T>;
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