import { Option } from "../option";
import { is_arraylike, is_primitive } from "../util";
import { AsyncDoubleEndedIterator, } from "./async-double-ended-iterator";
import { AsyncIterator } from "./async-iterator";
import { ArrayLike, Generator } from "./common";
import { AsyncArraylike } from "./common-async";
import { ExactSizeDoubleEndedIterator, once, once_with, repeat, repeat_with, DoubleEndedIterator } from "./double-ended-iterator";
import { Iterator, successors } from "./iterator";
import { Iter, IterInputType } from "./shared";

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

iter.of = function <T>(...elements: T[]): ExactSizeDoubleEndedIterator<T> {
    return new ArrayLike(elements) as any
}

iter.once = once;
iter.once_with = once_with;
iter.successors = successors;
iter.repeat = repeat;
iter.repeat_with = repeat_with;

export * from './iterator'
export * from './async-iterator';
export * from './double-ended-iterator';
export * from './common';
export * from './shared';

export {
    Iterator,
    // Exact
    DoubleEndedIterator,
    ExactSizeDoubleEndedIterator,

}