import { Result, is_none } from '../util';
import { fold, IntoCollection, collect, unzip } from './helpers';
import type { MapAdapter, FilterAdapter, FoldAdapter, Fn } from './types'
import { GenType, type GenInputType } from './index'


function get_iter<T>(gen: GenIterSuper<T>) {
    if (!(gen.iterable instanceof GenIterSuper)) {
        return gen
    }

    return get_iter(gen.iterable)
}

abstract class GenIterSuper<T> {
    iterable: GenType<T>;
    __internal_iterable_callback!: (() => Generator<T>);
    constructor(iterable: GenInputType<T>) {
        if (typeof iterable === 'function') {
            this.__internal_iterable_callback = iterable;
            const it = iterable()[Symbol.iterator]();
            this.iterable = it;
        } else if (iterable instanceof GenIterSuper) {
            this.iterable = iterable;
        } else {
            throw new Error('Invalid Iterator. If Provided iterator was a user generator, ensure user wraps with callback')
        }
    }

    __set_iter() {
        const original = get_iter(this);
        original.iterable = original.__internal_iterable_callback!()[Symbol.iterator]()
    }

    abstract next(): IteratorResult<T>

    [Symbol.iterator]() {
        this.__set_iter();
        return this;
    }
}

export class GenIter<T> extends GenIterSuper<T> {
    constructor(iterable: GenInputType<T>) {
        super(iterable)
    }

    next(): IteratorResult<T> {
        return this.iterable.next()
    };

    //* adapters
    enumerate() {
        return new GenEnumerate(this);
    }

    take(n: number) {
        return new GenTake(this, n);
    }

    map<V>(cb: MapAdapter<T, V>) {
        return new GenMap(this, cb);
    }

    filter(cb: FilterAdapter<T>) {
        return new GenFilter(this, cb);
    }

    skip(n: number) {
        return new GenSkip(this, n)
    }

    skip_while(predicate: FilterAdapter<T>) {
        return new GenSkipWhile(this, predicate);
    }

    inspect(cb: Fn<T>) {
        return new GenInspect(this, cb)
    }

    cycle() {
        return new GenCycle(this);
    }

    chain(other: Generator<T> | GenIter<T>) {
        return new GenChain(this, other);
    }


    zip(other: GenIter<T>) {
        return new GenZip(this, other);
    }
    //* consume methods
    collect<Into extends IntoCollection<GenIter<T>>>(into?: undefined): T[]
    collect<Into extends IntoCollection<GenIter<T>>>(into: Into): ReturnType<typeof into>;
    collect(into?: IntoCollection<T>): typeof into extends IntoCollection<GenIter<T>> ? ReturnType<typeof into> : T[] {
        return collect(this, into as any)
    }

    eq(other: GenIter<T>) {
        for (const val of other) {
            if (this.next().value !== val) {
                return false
            }
        }
        return true
    }

    // TODO: implement
    unzip<K extends T extends readonly any[] ? T[0] : never, V extends T extends readonly any[] ? T[1] : never>(): [K[], V[]] {
        return unzip(this as Iterable<[K, V]>)
    }


    // returns Result<true, 0> if successfully advances n steps
    // otherwise, returns Result<false, k> where 'k' is number of steps that could not be advanced because the iterator ran out
    advance_by(steps: number): Result<boolean, number | null> {
        steps = Math.abs(steps)
        if (steps === 0) {
            return [true, 0] as const
        }

        for (let i = 0; i < steps; i++) {
            if (is_none(this.next())) {
                return [false, steps - i] as const
            }
        }

        return [true, 0] as const
    }

    advance_until(predicate: FilterAdapter<T>) {
        let n = this.iterable.next();
        if (!n.done && predicate(n.value)) {
            return n;
        }

        while (!n.done) {
            n = this.iterable.next();

            if (!n.done && predicate(n.value)) {
                return n
            }
        }
        // reached the end
        return n;
    }

    fold(cb: FoldAdapter<T>, initial: T) {
        return fold(this, cb, initial)
    }

    count() {
        let count = 0;
        for (const _ of this) {
            count++
        }
        return count;
    }

    //! Caller must ensure T = string || number
    sum() {
        // @ts-expect-error
        return this.fold((acc, inc) => acc += inc, 0)
    }

    //! Caller must ensure T = string || number
    max() {
        return this.fold((acc, inc) => {
            if ((acc) < (inc)) {
                acc = inc
            }
            return acc
        }, Number.NEGATIVE_INFINITY as T)
    }

    //! Caller must ensure T = string || number
    min() {
        return this.fold((acc, inc) => {
            if (acc > (inc)) {
                acc = inc
            }
            return acc
        }, Number.POSITIVE_INFINITY as T)
    }

    any(callback: FilterAdapter<T>) {
        for (const v of this) {
            if (callback(v)) {
                return true
            }
        }
        return false
    }

    all(callback: FilterAdapter<T>) {
        for (const v of this) {
            if (!callback(v)) {
                return false
            }
        }
        return true
    }

}

class GenZip<K, V> extends GenIter<[K, V]> {
    #other: GenIter<V>
    constructor(iterable: GenInputType<K>, other: GenIter<V>) {
        super(iterable as any)
        this.#other = other;
    }

    next(): IteratorResult<[K, V]> {
        let k = this.iterable.next(), v = this.#other.next();

        if (k.done || v.done) {
            return { done: true, value: undefined }
        }

        return { done: false, value: [k.value, v.value] as [K, V] }
    }
}
class GenChain<T> extends GenIter<T> {
    #other: GenType<T>
    constructor(iterable: GenInputType<T>, other: GenType<T>) {
        super(iterable as any)
        this.#other = other;
    }

    next() {
        const n = this.iterable.next();
        if (!n.done) {
            return n
        }
        return this.#other.next();
    }
}
class GenCycle<T> extends GenIter<T> {
    constructor(iterable: GenInputType<T>) {
        super(iterable as any)
    }

    next() {
        let n = this.iterable.next();
        if (n.done) {
            this.__set_iter();
            n = this.iterable.next();
        }
        return n;
    }
}
class GenEnumerate<T> extends GenIter<[number, T]> {
    #index = -1;
    constructor(iterable: GenType<T>) {
        super(iterable as any)
    }

    next() {
        this.#index++;
        const n = this.iterable.next();
        n.value = [this.#index, n.value]
        return n
    }
}

class GenTake<T> extends GenIter<T> {
    #count: number;
    #index = -1;
    constructor(iterable: GenInputType<T>, n: number) {
        super(iterable)
        this.#count = n;
    }

    next() {
        this.#index++;
        if (this.#index >= this.#count) {
            return {
                done: true,
                value: null as T
            }
        }
        return this.iterable.next()
    }
}

class GenInspect<T> extends GenIter<T> {
    #callback: Fn<T>;
    constructor(iterable: GenInputType<T>, callback: Fn<T>) {
        super(iterable)
        this.#callback = callback;
    }

    next() {
        const n = this.iterable.next();
        this.#callback(n.value)
        return n
    }
}

class GenMap<I, O> extends GenIter<I> {
    #callback: MapAdapter<I, O>;
    constructor(iterable: GenInputType<I>, callback: MapAdapter<I, O>) {
        super(iterable)
        this.#callback = callback;
    }

    next(): IteratorResult<I> {
        const n = this.iterable.next()
        if (!n.done) {

            const v = this.#callback(n.value);
            n.value = v as unknown as I;
        }
        return n;
    }
}

class GenFilter<T> extends GenIter<T> {
    #callback: FilterAdapter<T>;
    constructor(iterable: GenInputType<T>, callback: FilterAdapter<T>) {
        super(iterable)
        this.#callback = callback;
    }

    next(): IteratorResult<T, any> {
        return this.advance_until(this.#callback)
    }
}

class GenSkip<T> extends GenIter<T> {
    #count: number;
    #index = -1;
    constructor(iterable: GenInputType<T>, count: number) {
        super(iterable)
        this.#count = count;
    }

    next(): IteratorResult<T, any> {
        this.#index++;
        let n = this.iterable.next();

        if (n.done) {
            return n
        }
        while (this.#index < this.#count && !n.done) {
            this.#index++;
            n = this.iterable.next();
        }

        return n;
    }
}

class GenSkipWhile<T> extends GenIter<T> {
    #predicate: FilterAdapter<T>;
    constructor(iterable: GenInputType<T>, predicate: FilterAdapter<T>) {
        super(iterable)
        this.#predicate = predicate;
    }

    next(): IteratorResult<T, any> {
        let n = this.iterable.next();
        if (!n.done && !this.#predicate(n.value)) {
            return n;
        }

        while (!n.done && this.#predicate(n.value)) {
            n = this.iterable.next();
        }
        return n;
        // reached the end
    }
}

