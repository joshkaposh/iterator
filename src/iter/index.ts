import { AsyncIterator } from "../iter-async";
import { is_arraylike, is_primitive } from "../util";
import { ArrayLike } from "./double-ended-iterator";
import { Generator, Iterator } from "./iterator";
import type { IterInputType, Iter } from './types'

export function iter_type<It extends IterInputType<any>>(iterable: It) {
    if (iterable instanceof Iterator || iterable instanceof AsyncIterator) {
        return 'iter'
    } else if (is_arraylike(iterable)) {
        return 'arraylike'
        // @ts-expect-error
    } else if (iterable && (iterable[Symbol.iterator] || iterable[Symbol.asyncIterator])) {
        return 'iterable'
    } else if (typeof iterable === 'function') {
        return 'function'
    } else {
        return 'invalid'
    }
}

export function iter<It extends IterInputType<any>>(iterable: It): Iter<It> {
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

export * from './iterator'
export * from './double-ended-iterator';

export type * from './types';

export {
    is_arraylike,
    is_primitive,
}