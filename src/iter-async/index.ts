
import { Item, IterInputType } from "../iter/shared";
import { is_arraylike, is_primitive } from "../util"
import { AsyncArraylike } from "./async-double-ended-iterator";
import { AsyncIterator, AsyncGenerator } from "./async-iterator";
import { type AsyncIter, type AsyncIterInputType, from_async_fn, HasSymbolAsyncIterator } from "./shared";

class AsyncTest {

    async next() {
        return { done: true, value: undefined }
    }

    [Symbol.asyncIterator]() {
        return this
    }
}

type N = HasSymbolAsyncIterator<AsyncTest>;

// AsyncGenerator - Any Object with a [Symbol.asyncIterator] method

// callback is a sync or async fn that can peek at value before returning it or another value of the same type 

export function async_iter<It extends AsyncIterInputType<any>>(iterable: It, callback: (value: Item<It>) => Promise<Item<It>> | Item<It>): AsyncIterator<any> {
    if (iterable instanceof AsyncIterator) {
        console.log('async() already iter');
        return iterable as unknown as AsyncIter<It>
    }
    if (!callback) {
        throw new Error('Cannot construct an AsyncIterator without a callback')
    }
    if (is_arraylike(iterable)) {
        console.log('async() arraylike');

        return new AsyncArraylike(iterable as any, callback!) as unknown as AsyncIter<It>
    }
    const is_prim = is_primitive(iterable)
    if (!is_prim) {
        if (iterable[Symbol.asyncIterator]) {
            console.log('async() symbol[async]');

            // @ts-expect-error
            return new AsyncGenerator(() => iterable[Symbol.asyncIterator]() as any, callback) as unknown as AsyncIter<It>
        } else if (typeof iterable === 'function') {
            console.log('async() function');
            //! SAFETY: User ensures provided function returns an Iterator or an AsyncIterator
            return new AsyncGenerator(iterable as any, callback) as unknown as AsyncIter<It>
        }
    } else {
        const msg = is_prim ?
            `Cannot construct an AsyncIterator from primitive '${String(iterable)}'` :
            `Iter cannot construct an AsyncIterator from an object that is not Arraylike or has no [Symbol.asyncIterator] method.`
        throw new Error(msg)
    }
    return undefined as never;
}

async_iter.from_sync = function <T>(sync: IterInputType) {

}

export * from './async-iterator';
export * from './async-double-ended-iterator';

export type {
    AsyncIter,
    AsyncIterInputType,
}

export {
    from_async_fn,

}