import { StringIterator } from "./iter";
import type { DoubleEndedIterator, ExactSizeDoubleEndedIterator } from "./iter/base/double-ended-iterator";
import type { ExactSizeIterator, Iterator } from "./iter/base/iterator";
import type { Option } from "joshkaposh-option";

export type ArrayLikeType<T> = ArrayLike<T>;
export type GeneratorType<T> = Generator<T>;

export type Item<It> = It extends Iterable<infer T> ? T : never;

export type SizeHint<Lo = number, Hi = Option<number>> = [Lo, Hi];

export type Primitive = string | number | bigint | boolean | undefined | null | symbol;

export type HasSymbolIterator<It, T = keyof It> = (T extends SymbolConstructor['iterator'] ? T : never) extends never ? 0 : 1;

export type IteratorInputType<T = any> = (() => Generator<T>) | (() => IterableIterator<T>) | Iterator<T> | Iterable<T>
export type DoubleEndedIteratorInputType<T = any> = ArrayLike<T> | DoubleEndedIterator<T> | string;
export type IterInputType<T = any> = DoubleEndedIteratorInputType<T> | IteratorInputType<T>;

export type IteratorType<T> = Generator<T> | Iterator<T> | ExactSizeIterator<T>;
export type DoubleEndedIteratorType<T> = ArrayLike<T> | DoubleEndedIterator<T> | ExactSizeDoubleEndedIterator<T>;
export type IterType<T> = IteratorType<T> | DoubleEndedIteratorType<T>

export type Iter<It> =
    It extends DoubleEndedIteratorInputType<infer T> ?
    It extends string & infer T extends string ? StringIterator<T> :
    It extends ExactSizeDoubleEndedIterator<T> | ArrayLike<T> ?
    ExactSizeDoubleEndedIterator<T> : DoubleEndedIterator<T> :
    It extends IteratorInputType<infer T> ?
    It extends ExactSizeIterator<T> ? ExactSizeIterator<T> : Iterator<T>
    : never;
