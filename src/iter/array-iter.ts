import { all, count, fold, last, unzip } from "./helpers";
import { type Option, type Result, is_some, TODO } from "../util";
import type { FilterAdapter, FoldAdapter, MapAdapter } from "./types";
import { IntoCollection, collect } from "./helpers";
import { IterType } from ".";

abstract class IterSuper<T, TNext = Option<T>> {
    iterable: T[] | IterSuper<T>;
    index = -1;
    abstract next(): TNext;

    constructor(iterable: T[] | IterSuper<T>) {
        this.iterable = iterable
    }

    get(index: number): T | null {
        if (Array.isArray(this.iterable)) {
            return this.iterable[index];
        } else {
            return this.iterable.get(index);
        }
    }
}


export class ArrayIter<T> extends IterSuper<T> {
    index = -1;
    constructor(iterable: T[] | ArrayIter<T>) {
        super(iterable)
    }

    next() {
        this.index++;

        const val = this.get(this.index)
        if (!is_some(val)) {
            return null
        }
        return val;
    }
    //* adapter functions
    skip(n: number) {
        return new ArraySkip(this, n);
    }

    enumerate() {
        return new ArrayEnumerate(this)
    }

    cycle() {
        return new ArrayCycle(this)
    }

    chain(other: ArrayIter<T>) {
        return new ArrayChain(this, other);
    }

    map<V>(callback: MapAdapter<T, V>) {
        return new ArrayMap(this, callback)
    }

    filter(callback: FilterAdapter<T>) {
        return new ArrayFilter(this, callback);
    }

    take(count: number) {
        return new ArrayTake(this, count)
    }

    fold(callback: FoldAdapter<T>, initial: T) {
        return fold(this, callback, initial)
    }

    inspect(callback: (value: Option<T>) => void) {
        return new ArrayInspect(this, callback)
    }

    //* consume functions
    collect<It extends ArrayIter<T>, Into extends IntoCollection<It>>(into?: undefined): T[]
    collect<It extends ArrayIter<T>, Into extends IntoCollection<It>>(into: Into): ReturnType<typeof into>;
    collect<It extends ArrayIter<T>>(into?: IntoCollection<It>): typeof into extends IntoCollection<It> ? ReturnType<typeof into> : T[] {
        return collect(this, into as (iter: ArrayIter<T>) => any)
    }

    advance_until(predicate: FilterAdapter<T>) {
        let next = this.next();
        console.log(next);


        if (is_some(next) && predicate(next!)) {
            return next;
        } else {
            while (is_some(next)) {
                this.index++;
                next = this.next()!;
                console.log(next);

                if (predicate(next)) {
                    return next;
                }
            }
        }
        // reached the end
        return null;
    }

    // returns Result<true, 0> if successfully advances n steps
    // otherwise, returns Result<false, k> where 'k' is number of steps that could not be advanced because the iterator ran out
    advance_by(steps: number): Result<boolean, number | null> {
        steps = Math.abs(steps)
        if (steps === 0) {
            return [true, 0] as const
        }

        for (let i = 0; i < steps; i++) {
            if (!is_some(this.next())) {
                return [false, steps - i] as const
            }
        }

        return [true, 0] as const
    }
    // returns nth element of the iterator
    // all preceding elements INCLUDING returned element will be consumed
    // returns null if index >= length of iterator
    nth(index: number) {
        if (index === 0) {
            return this.next()
        }

        for (let i = 0; i < index; i++) {
            this.next();
        }

        return this.next()
    }

    last(): Option<T> {
        return last(this)
    }

    eq(other: IterType<T>) {
        for (const val of other) {
            const n = this.next()
            if (n !== val) {
                return false
            }
        }
        return true
    }

    count() {
        return count(this);
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

    all(predicate: FilterAdapter<T>) {
        return all(this, predicate)
    }

    unzip<K extends T extends readonly any[] ? T[0] : never, V extends T extends readonly any[] ? T[1] : never>(): [K[], V[]] {
        return unzip(this as Iterable<[K, V]>)
    }

    zip<V>(other: ArrayIter<V>) {
        return new ArrayZip(this, other)
    }

    *[Symbol.iterator]() {
        this.index = -1;
        let next;
        while (is_some(next = this.next())) {
            yield next!
        }
    }
}

export class IteratorDoubleEnded<T> extends ArrayIter<T> {
    reversed = false;
    back_index: number;
    constructor(iterable: T[] | ArrayIter<T>) {
        super(iterable)
        this.back_index = TODO()
    }

    next() {
        this.index++;
        if (this.index >= this.back_index) {
            return null
        }
        return this.get(this.index);
    }

    next_back(): Option<T> {
        this.back_index--;
        if (this.index >= this.back_index) {
            return null
        }
        return this.get(this.back_index);
    }

    rev() {
        this.reversed = !this.reversed;
        return this
    }

    *[Symbol.iterator]() {
        if (!this.reversed) {
            let next;
            while (is_some(next = this.next())) {
                yield next!
            }
        } else {
            let next;
            while (is_some(next = this.next_back())) {
                yield next!
            }
        }
    }
}

//* adapter classes
class ArraySkip<T> extends ArrayIter<T> {
    #n: number;
    constructor(iterable: ArrayIter<T>, n: number) {
        super(iterable)
        this.#n = n;
    }

    next() {
        let n = super.next();

        if (!is_some(n)) {
            return n
        }
        while (this.index < this.#n && is_some(n)) {
            n = super.next();
        }

        return n;
    }
}

class ArrayZip<K, V> extends ArrayIter<[K, V]> {
    #other: ArrayIter<V>;
    constructor(iterable: ArrayIter<K>, other: ArrayIter<V>) {
        super(iterable as any);
        this.#other = other;
    }

    next() {
        const o = this.#other.next();
        const v = super.next();
        if (!is_some(v) || !is_some(o)) {
            return null
        }

        return [v, o] as [K, V]
    }
}

class ArrayChain<T> extends ArrayIter<T> {
    #other: ArrayIter<T>;
    constructor(iterable: ArrayIter<T>, other: ArrayIter<T>) {
        super(iterable);
        this.#other = other;
    }

    next() {

        const val = super.next();
        if (is_some(val)) {

            return val;
        }

        const val2 = this.#other.next();
        if (is_some(val2)) {

            return val2
        }

        return null
    }
}

class ArrayCycle<T> extends ArrayIter<T> {
    constructor(iterable: ArrayIter<T>) {
        super(iterable)
    }

    next() {
        const n = super.next();
        if (!is_some(n)) {
            this.index = -1;
            return super.next()
        }

        return n;
    }
}

class ArrayEnumerate<T> extends ArrayIter<[number, T]> {
    constructor(iterable: ArrayIter<T>) {
        super(iterable as any)
    }

    next() {
        const val = super.next()
        if (!is_some(val)) {
            return null;
        }

        return [this.index, val] as [number, T]

    }
}

class ArrayMap<T, V> extends ArrayIter<V> {
    callback: MapAdapter<T, V>;
    constructor(iterable: ArrayIter<T>, callback: MapAdapter<T, V>) {
        super(iterable as any)
        this.callback = callback;
    }

    get(index: number): V | null {
        const old = super.get(index);

        if (!is_some(old)) {
            return null;
        }

        return this.callback(old as T)
    }

    next(): V | null {
        this.index++;
        const val = this.get(this.index);
        if (!is_some(val)) {
            return null
        }

        return val
    }
}

class ArrayFilter<T> extends ArrayIter<T> {
    #predicate: FilterAdapter<T>
    constructor(iterable: ArrayIter<T>, callback: FilterAdapter<T>) {
        super(iterable as any)
        this.#predicate = callback;
    }

    next() {
        this.index++;
        let next = this.get(this.index);
        if (!is_some(next)) {
            return null;
        } else if (this.#predicate(next!)) {
            return next!;
        } else {
            while (is_some(next)) {
                this.index++;
                next = this.get(this.index)!;

                if (is_some(next) && this.#predicate(next)) {
                    return next!;
                }
            }
        }
        return null;
    }
}

class ArrayTake<T> extends ArrayIter<T> {
    #count: number
    constructor(iterable: ArrayIter<T>, count: number) {
        super(iterable);
        this.#count = count;
    }

    next() {
        this.index++;
        const val = (this.iterable as ArrayIter<T>).next();

        if (!is_some(val) || this.index >= this.#count) {
            return null
        }
        return val;
    }
}

class ArrayInspect<T> extends ArrayIter<T> {
    #callback: (value: Option<T>) => void
    constructor(iterable: ArrayIter<T>, callback: (value: Option<T>) => void) {
        super(iterable)
        this.#callback = callback;
    }

    get(index: number) {
        const v = super.get(index);
        if (!v) {
            return null;
        }
        this.#callback(v);
        return v;
    }

    next() {
        this.index++;
        const val = this.get(this.index)
        if (!is_some(val)) {
            return null;
        }
        return val;
    }
}