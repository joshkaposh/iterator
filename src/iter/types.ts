import { DoubleEndedIterator, ExactSizeDoubleEndedIterator } from "./double-ended-iterator";
import { ExactSizeIterator, Iterator } from "./iterator";

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