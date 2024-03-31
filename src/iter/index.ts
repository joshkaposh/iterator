import { Option } from "../option";
import { AsyncDoubleEndedIterator } from "./async-double-ended-iterator";
import { AsyncIterator } from "./async-iterator";
import { ArrayLike, Generator, Iterable } from "./common";
import { AsyncArraylike } from "./common-async";
import { ExactSizeDoubleEndedIterator, once, once_with, repeat, repeat_with } from "./double-ended-iterator";
import { Iterator, successors } from "./iterator";
import { Iter, IterInputType, is_arraylike } from "./shared";

export function iter<It extends IterInputType<any>>(it?: It): Iter<It> {
    if (it instanceof Iterator) {
        return it.into_iter() as Iter<It>;
    } else if (is_arraylike(it)) {
        return new ArrayLike(it) as unknown as Iter<It>
    } else if (it && 'next' in it) {
        return new Iterable(it as any) as unknown as Iter<It>
    } else if (typeof it === 'function') {
        return new Generator(it) as unknown as Iter<It>
    } else {
        return undefined as unknown as Iter<It>
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
    return new ArrayLike(elements)
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