import { IterArrayLike, IterGenerator, IterIterable, IterObject } from "./common";
import { DoubleEndedIterator, ExactSizeDoubleEndedIterator, once, once_with, repeat, repeat_with } from "./double-ended-iterator";
import { ExactSizeIterator, Iterator, successors } from "./iterator";
import { is_arraylike, ErrorExt } from "./shared";

type DoubleEndedIteratorInputType<T = any> = ArrayLike<T> | DoubleEndedIterator<T>
type IteratorInputType<T = any> = (() => Generator<T>) | Iterator<T> | IterableIterator<T>;
type IterInputType<T = any> = DoubleEndedIteratorInputType<T> | IteratorInputType<T>;

type IteratorType<T> = Generator<T> | Iterator<T> | ExactSizeIterator<T>;
type DoubleEndedIteratorType<T> = ArrayLike<T> | DoubleEndedIterator<T> | ExactSizeDoubleEndedIterator<T>;
type IterType<T> = IteratorType<T> | DoubleEndedIteratorType<T>

type Iter<It> =
    It extends DoubleEndedIteratorInputType<infer T> ?
    It extends ExactSizeDoubleEndedIterator<T> | ArrayLike<T> ? ExactSizeDoubleEndedIterator<T> : DoubleEndedIterator<T> :
    It extends IteratorInputType<infer T> ?
    It extends ExactSizeIterator<T> ? ExactSizeIterator<T> : Iterator<T>
    : never;

type IntoIter<It> = {
    into_iter(): It;
}

function iter<It extends IterInputType<any>>(iter: It): Iter<It> {
    if (iter instanceof Iterator) {
        return iter.into_iter() as Iter<It>;
    } else if (is_arraylike(iter)) {
        return new IterArrayLike(iter) as unknown as Iter<It>
    } else if ('next' in iter) {
        return new IterIterable(iter as any) as unknown as Iter<It>
    } else if (typeof iter === 'function') {
        return new IterGenerator(iter) as unknown as Iter<It>
    } else if (typeof iter === 'object') {
        console.warn('Unsafe', iter);
        return new IterObject(iter as object) as unknown as Iter<It>;
    }
    return undefined as unknown as Iter<It>;
}

iter.of = function <T>(...elements: T[]): DoubleEndedIterator<T> {
    return new IterArrayLike(elements)
}

iter.once = once
iter.once_with = once_with
iter.successors = successors
iter.repeat = repeat;
iter.repeat_with = repeat_with

export type {
    IntoIter,
    Iter,
    IterType,
    IterInputType
}

export * from './iterator'
export * from './double-ended-iterator';
export * from './common';

export {
    iter,
    is_arraylike,
    ErrorExt,
}