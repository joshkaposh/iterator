import { is_arraylike, is_primitive } from "../util";
import { ArrayLike, DoubleEndedIterator, ExactSizeDoubleEndedIterator, FusedDoubleEndedIterator, once, once_with, repeat, repeat_with, range, Range, drain } from "./double-ended-iterator";
import { Generator, Iterator, FusedIterator, ExactSizeIterator, successors, from_fn } from "./iterator";
import type { IterInputType, Iter } from '../types'
import { iter_type, done, map_next } from "../shared";


export default function iter<It extends IterInputType<any>>(iterable: It): Iter<It> {
    const ty = iter_type(iterable);
    if (ty === 'iter') {
        return iterable as unknown as Iter<It>;
    } else if (ty === 'arraylike') {
        return new ArrayLike(iterable as any) as unknown as Iter<It>
    } else if (ty === 'iterable') {
        // @ts-expect-error
        return new Generator(() => iterable[Symbol.iterator]()) as unknown as Iter<It>
    } else if (ty === 'function') {
        //! SAFETY: User ensures provided function returns an Iterator
        return new Generator(iterable as any) as unknown as Iter<It>
    } else {
        const msg = is_primitive(iterable) ?
            `Cannot construct an Iterator from primitive '${String(iterable)}'` :
            `Iter cannot construct an Iterator from an object that is not Arraylike or has no [Symbol.iterator] method.`
        throw new Error(msg)
    }
}

iter.of = function <T>(...t: T[]): ExactSizeDoubleEndedIterator<T> {
    return new ArrayLike(t);
}
iter.successors = successors;
iter.from_fn = from_fn;




export {
    iter,
    range,

    drain,
    once,
    once_with,
    repeat,
    repeat_with,
    successors,
    from_fn,

    is_arraylike,
    done,
    map_next,

    Iterator,
    ExactSizeIterator,
    FusedIterator,

    DoubleEndedIterator,
    ExactSizeDoubleEndedIterator,
    FusedDoubleEndedIterator,

    Generator,
    ArrayLike,
    Range,
}