import { type Option } from "../option";
import { is_arraylike, is_primitive } from "../util";
import { AsyncDoubleEndedIterator, } from "./async-double-ended-iterator";
import { AsyncIterator } from "./async-iterator";
import { ArrayLike, Generator } from "./common";
import { AsyncArraylike } from "./common-async";
import { ExactSizeDoubleEndedIterator, DoubleEndedIterator, Once, OnceWith, Repeat, RepeatWith } from "./double-ended-iterator";
import { Iterator, ExactSizeIterator, Successors } from "./iterator";
import { Iter, IterInputType, ErrorExt, NonZeroUsize } from "./shared";

export function iter<It extends IterInputType<any>>(iterable: It): Iter<It> {
    if (iterable instanceof Iterator) {
        return iterable as unknown as Iter<It>;
    } else if (is_arraylike(iterable)) {
        return new ArrayLike(iterable) as unknown as Iter<It>
        // @ts-expect-error
    } else if (iterable && iterable[Symbol.iterator]) {
        // @ts-expect-error
        return new Generator(() => iterable[Symbol.iterator]()) as unknown as Iter<It>
    } else if (typeof iterable === 'function') {
        return new Generator(iterable as any) as unknown as Iter<It>
    } else {
        const msg = is_primitive(iterable) ?
            `Cannot construct an Iterator from primitive '${String(iterable)}'` :
            `Iter cannot construct an Iterator from an object that is not Arraylike`
        throw new Error(msg)
    }
}

export function async_iter<It extends AsyncIterator<any> | AsyncDoubleEndedIterator<any> | any[]>(it?: Option<It>): It extends (infer T)[] ? AsyncDoubleEndedIterator<T> : It {
    if (it instanceof AsyncIterator) {
        return it.into_iter() as any;
    } else if (is_arraylike(it as any[])) {
        return new AsyncArraylike(it!) as any;
    }
    return undefined as any
}

iter.once = <T>(value: T) => new Once(value)
iter.once_with = <T>(once: () => T) => new OnceWith(once)
iter.successors = <T>(first: T, succ: (value: T) => Option<T>) => new Successors(first, succ)
iter.repeat = <T>(value: T) => new Repeat(value);
iter.repeat_with = <T>(gen: () => T) => new RepeatWith(gen);

export * from './iterator'
export * from './async-iterator';
export * from './double-ended-iterator';
export * from './common';

export type {
    Iter,
    IterInputType
}

export {
    Iterator,
    ExactSizeIterator,

    DoubleEndedIterator,
    ExactSizeDoubleEndedIterator,

    ErrorExt,
    NonZeroUsize,

    is_arraylike,
    is_primitive,
}