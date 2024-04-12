
import { Item } from "../iter/shared";
import type { IterInputType } from '../iter/types'
import type { AsyncIter, AsyncIterInputType } from "./types";
import { is_primitive, unused } from "../util"
import { AsyncArraylike } from "./async-double-ended-iterator";
import { AsyncGenerator, from_async_fn } from "./async-iterator";
import { iter_type } from "../iter";

// callback is a sync or async fn that can peek at value before returning it or another value of the same type
export function async_iter<It extends AsyncIterInputType<any>>(iterable: It, callback: (value: Item<It>) => Promise<Item<It>> | Item<It>): AsyncIter<It> {
    const ty = iter_type(iterable as any);
    if (ty === 'iter') {
        return iterable as unknown as AsyncIter<It>
    }
    if (!callback) {
        throw new Error('Cannot construct an AsyncIterator without a callback')
    }

    if (ty === 'arraylike') {
        return new AsyncArraylike(iterable as any, callback) as unknown as AsyncIter<It>
    }

    const is_prim = is_primitive(iterable)
    if (is_prim) {
        const msg = is_prim ?
            `Cannot construct an AsyncIterator from primitive '${String(iterable)}'` :
            `Iter cannot construct an AsyncIterator from an object that is not Arraylike or has no [Symbol.asyncIterator] method.`
        throw new Error(msg)
    }

    if (ty === 'iterable') {
        // ! Safety - value has been checked by iter_type and is not a primitive
        // @ts-expect-error
        return new AsyncGenerator(() => iterable[Symbol.asyncIterator]() as any, callback) as unknown as AsyncIter<It>
    } else if (ty === 'function') {
        //! SAFETY: User ensures provided function returns an Iterator or an AsyncIterator
        return new AsyncGenerator(iterable as any, callback) as unknown as AsyncIter<It>
    }
    return undefined as never;
}

async_iter.from_sync = function <T>(sync: IterInputType<T>) {
    return unused(sync)
}

export * from './async-iterator';
export * from './async-double-ended-iterator';
export * from './types';

export {
    from_async_fn,
}