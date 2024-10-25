import { is_arraylike, is_primitive } from "../util";
import { DoubleEndedIterator, ExactSizeDoubleEndedIterator, FusedDoubleEndedIterator } from "./base/double-ended-iterator";
import { Iterator, from_fn, FusedIterator, ExactSizeIterator } from "./base/iterator";
import { Generator, ArrayLike, range, Range, drain, Successors, Once, OnceWith, Repeat, RepeatWith } from './common'
import type { IterInputType, Iter, ArrayLikeType, Item, GeneratorType } from '../types'
import { iter_type, done, item } from "../shared";
import { Option } from "joshkaposh-option";

/**
 * Primary way to create an Iterator. Iterators can also be created by functions provided by the library, or classes extending `Iterator`
 * @returns Returns an Iterator 
 */
export default function iter<It extends IterInputType<any>>(iterable: It): Iter<It> {
    const ty = iter_type(iterable);
    if (ty === 'iter') {
        return iterable as unknown as Iter<It>;
    } else if (ty === 'arraylike') {
        return new ArrayLike(iterable as ArrayLikeType<Item<It>>) as unknown as Iter<It>
    } else if (ty === 'iterable') {
        // @ts-expect-error
        return new Generator(() => iterable[Symbol.iterator]()) as unknown as Iter<It>
    } else if (ty === 'function') {
        //! SAFETY: User ensures provided function returns an Iterator
        return new Generator(iterable as () => GeneratorType<Item<It>>) as unknown as Iter<It>
    } else {
        const msg = is_primitive(iterable) ?
            `Cannot construct an Iterator from primitive '${String(iterable)}'` :
            `Iter cannot construct an Iterator from an object that is not Arraylike or has no [Symbol.iterator] method.`
        throw new Error(msg)
    }
}

// * --- Free standing functions ---

iter.of = function <T>(...t: T[]): ExactSizeDoubleEndedIterator<T> {
    return new ArrayLike(t) as unknown as ExactSizeDoubleEndedIterator<T>;
}

/**
 * 
 * @summary 
 * Creates an Iterator that will call the supplied callback on each iteration.
 * Iteration ends when when the callback returns None
 * @example
 * let count = 0;
 * from_fn(() => {
        count++;
        return count > 5 ? null : count;
    }}).collect() // [1, 2, 3, 4, 5]
 * 
 */
iter.from_fn = from_fn;

/**
* successors() takes two arguments, a 'first', and 'succ'.
* 
* 'first' will be the first element of the Iterator.
* succ() takes in the previous element, and returns the current element for next iteration.

* It will create an Iterator which will keep yielding elements until None is encountered.
* If 'first' was None, the resulting Iterator will be empty.
 */
iter.successors = function <T>(first: Option<T>, succ: (value: T) => Option<T>): Successors<T> {
    return new Successors(first, succ)
}
iter.once = function <T>(value: T) {
    return new Once(value)
};
iter.once_with = function <T>(fn: () => T) {
    return new OnceWith(fn)
};
iter.repeat = function <T>(value: T) {
    return new Repeat(value)
};
iter.repeat_with = function <T>(fn: () => T) {
    return new RepeatWith(fn)
};

const {
    once,
    once_with,
    repeat,
    repeat_with,
    successors
} = iter

export {
    iter,
    range,
    from_fn,
    once,
    once_with,
    repeat,
    repeat_with,
    successors,

    done,
    item,

    drain,
    is_arraylike,

    Iterator,
    ExactSizeIterator,
    FusedIterator,

    DoubleEndedIterator,
    ExactSizeDoubleEndedIterator,
    FusedDoubleEndedIterator,

    Generator,
    ArrayLike,
    Range,
    Once,
    OnceWith,
    Repeat,
    RepeatWith
}