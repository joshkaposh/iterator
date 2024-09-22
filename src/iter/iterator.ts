import { iter, map_next } from ".";
import { type Err, type Ok, type Option, type Result, is_error, is_some, ErrorExt } from "joshkaposh-option";
import { done, NonZeroUsize, non_zero_usize } from "../shared";
import type { IteratorInputType, MustReturn, Item, SizeHint, GeneratorType, IterInputType } from '../types';

type FlatType<T> = Iterator<Iterator<T>>;

type CanGtLt<T> = T extends string ? T :
    T extends number ? T :
    T extends { [Symbol.toPrimitive](): Option<string | number | boolean> } ? T :
    never;

export interface Iterator<T> {
    advance_by(n: number): Result<Ok, NonZeroUsize>
}
export abstract class Iterator<T> {

    abstract next(): IteratorResult<T>;
    abstract into_iter(): Iterator<T>;

    advance_by(n: number): Result<Ok, NonZeroUsize> {
        for (let i = 0; i < n; i++) {
            if (this.next().done) {
                return new NonZeroUsize(n - i);
            }
        }
        return undefined as Ok
    }

    any(predicate: (value: T) => boolean): boolean {
        for (const v of this) {
            if (predicate(v)) {
                return true
            }
        }
        return false
    }

    all(predicate: (value: T) => boolean): boolean {
        for (const v of this) {
            if (!predicate(v)) {
                return false
            }
        }
        return true
    }

    array_chunks(n: number): Iterator<T[]> & {
        into_remainder(): Option<T[]>;
    } {
        return new ArrayChunks(this, n)
    }

    chain<O extends Iterator<any>>(other: O): Iterator<T | Item<O>> {
        return new Chain(this, other)
    }

    collect(into?: undefined): T[];
    collect<I extends new (it: Iterable<T>) => any>(into: I): InstanceType<I>
    collect<I extends new (it: Iterable<T>) => any>(into?: I): InstanceType<I> | T[] {
        if (into) {
            return new into(this)
        }

        return Array.from(this)
    }

    count() {
        let count = 0;
        for (const _ of this) {
            count++
        }
        return count;
    }

    cycle(): Iterator<T> {
        return new Cycle(this);
    }

    enumerate(): ExactSizeIterator<[number, T]> {
        return new Enumerate(this)
    }

    eq(other: IterInputType<T>): boolean {
        other = iter(other)
        for (const val of other) {
            const n = this.next()
            if (n.value !== val) {
                return false
            }
        }
        // @ts-expect-error
        return this.size_hint()[1] === other.size_hint()[1]
    }

    eq_by(other: IterInputType<T>, eq: (a: T, b: T) => boolean): boolean {
        other = iter(other);
        for (const val of other) {
            const n = this.next()
            if (!eq(n.value, val)) {
                return false
            }
        }
        // @ts-expect-error;
        return this.next().done === other.next().done
    }

    filter(callback: (value: T) => boolean): Iterator<T> {
        return new Filter(this, callback)
    }

    filter_map<B>(callback: MustReturn<(value: T) => Option<B>>): Iterator<B> {
        return new FilterMap(this, callback)
    }

    find_map<B>(callback: MustReturn<(value: T) => Option<B>>): Option<B> {
        let n;
        while (!(n = this.next()).done) {
            const elt = callback(n.value);
            if (is_some(elt)) {
                return elt
            }
        }
        return
    }

    /**
     * 
     * @description
     * Creates an `Iterator` that flattens nested structures.
     * 
     * `flatten` is useful when wanting to remove one layer of indirection.
     * @throws `flatten` **throws** when calling next() or any methods tbat use it if the elements of the interator it is trying to flatten from cannot be converted into an `Iterator`
     * @example
     * iter(1).flatten().next() // Errors
     * iter([ [1, 2, 3], [4, 5, 6] ]).flatten().rev().collect() // [6, 5, 4, 3, 2, 1];
    */
    flatten(): Iterator<T> {
        return new Flatten(this as unknown as Iterator<Iterator<T>>)
    }
    /**
     * @description
     * `flat_map` takes in a closure that takes in one argument `A` and returns an `Option<Iterator<B>>`.
     * It then yields elements from that iterator. Iteration ends when the closure returns `None`
     * 
     * `flat_map` is a shorthand for `Iterator.map().flatten()`
     * 
     * @see `Iterator.flatten` and `Iterator.map` for more information.
     */
    flat_map<B extends Iterator<any>>(f: (value: T) => Option<B>): Iterator<Item<B>> {
        return new FlatMap(this as any, f)
    }

    /**
     * @summary 
     * find() searches the Iterator until an element is found given the supplied predicate.
     * 
     * find() is short-curcuiting - the Iterator may have more elements left.
     * @returns element T or None if T wasn't found.
     */
    find(predicate: (value: T) => boolean): Option<T> {
        let n;
        while (!(n = this.next()).done) {
            if (predicate(n.value)) {
                return n.value;
            }
        }
        return null;
    }

    /**
     * @description
     * fold() takes two arguments, an initial B and a folder (acc: B, element: T) => B.
     * 
     * fold() will take an Iterator and reduce it down to a single value.
     * Each iteration fold() will call the folder(), with folder()'s return value being the next value the folder() receives on the next iteration.
     */
    fold<B>(initial: B, fold: (acc: B, x: T) => B) {
        let acc = initial;
        let next;
        while (!(next = this.next()).done) {
            acc = fold(acc, next.value)
        }

        return acc;
    }

    /**
     * @description
     * for_each() will consume the Iterator, passing each element it encounters to the provided callback.
     * 
     * for_each() is useful if you want to do something with the elements of an Iterator but dont want to collect() into a Collection
    */
    for_each(callback: (value: T) => void) {
        for (const item of this.into_iter()) {
            callback(item);
        }
        return this;
    }

    /**
     * @description
     * Fuses an Iterator.
     * 
     * Some Iterators may yield an element T after finishing. A FusedIterator will stop afted the first time it encounters an IteratorResult<T> where IteratorResult = { done: true, value: undefined }
    */
    fuse(): Iterator<T> {
        return new FusedIterator(this);
    }

    /**
     * @summary
     * Inspects an iterator, calling the supplied callback each iteration before forwarding the element.
     * @description

     * inpect() is often used for debugging complex data pipelines, or for printing errors.
     * It can be used to log messages before each call site in a pipeline.
     * @example
     * iter([2, 4])
     * .inspect((v) => console.log('About to filter %d', v))
     * .filter()
     * .inspect((v) => console.log('About to map %d', v))
     * .map()
     * .inspect((v) => console.log('About to collect %d', v))
     * .collect()
     * 
    // 'About to filter 2'
    // 'About to map 2'
    // 'About to collect 4'
    // 'About to filter 4'
    // 'About to map 4'
    // 'About to collect 16'
    */
    inspect(callback: (value: T) => void): Iterator<T> {
        return new Inspect(this, callback)
    }

    intersperse(separator: T): Iterator<T> {
        return new Intersperse(this, separator);
    }

    intersperse_with(separator: () => T): Iterator<T> {
        return new IntersperseWith(this, separator)
    }

    is_sorted(): boolean {
        const it = this.peekable();
        let n;
        while (!(n = it.next()).done) {
            const p = it.peek();
            if (p.done) {
                // no more comparisons to make
                return true
            }
            if (n.value > p.value) {
                return false
            }
        }
        return undefined as never
    }

    last(): Option<T> {
        let val: Option<T> = null
        for (const v of this) {
            val = v
        }
        return val;
    }

    map<B>(f: MustReturn<(value: T) => B>): Iterator<B> {
        return new Map(this, f) as unknown as Iterator<B>
    }

    map_while<B>(f: MustReturn<(value: T) => B>): Iterator<B> {
        return new MapWhile(this, f)
    }

    //! Caller must ensure T = number
    max(): Option<CanGtLt<T>> {
        const n = this.next();
        if (n.done) {
            return
        } else {
            const ty = typeof n.value;
            if (ty === 'number') {
                return Math.max(n.value as number, ...this as unknown as Iterator<number>) as CanGtLt<T>;
            } else if (ty === 'string') {
                return this.fold(n.value as CanGtLt<T>, (acc, x) => (acc > x as unknown as CanGtLt<T> ? acc : x as CanGtLt<T>)) as CanGtLt<T>
            }

            throw new Error(`Cannot call 'max' on an Iterator of type ${ty}. Accepted element types are 'string' or 'number'`)
        }
    }
    //! Caller must ensure T = number
    min(): Option<CanGtLt<T>> {
        const n = this.next();
        if (n.done) {
            return;
        } else {
            const ty = typeof n.value;
            if (ty === 'number') {
                return Math.min(n.value as number, ...this as Iterator<number>) as CanGtLt<T>;
            } else if (ty === 'string') {
                return this.fold(n.value as CanGtLt<T>, (acc, x) => (acc > x as unknown as CanGtLt<T> ? acc : x as CanGtLt<T>))
            }

            throw new Error(`Cannot call 'max' on an Iterator of type ${ty}. Accepted element types are 'string' or 'number'`)
        }
    }

    next_chunk(n: number): Result<T[], Err<T[]>> {
        const arr: T[] = [];
        for (let i = 0; i < n; i++) {
            const item = this.next();
            if (item.done) {
                return new ErrorExt(arr, `'next_chunk' couldn't fill a container of ${n} elements, but a container of ${arr.length} elements were found`)
            }
            arr.push(item.value)
        }
        return arr;
    }

    nth(n: number) {
        this.advance_by(n);
        return this.next();
    }

    partition(predicate: (value: T) => boolean): [T[], T[]] {
        const trues = [];
        const falses = [];
        for (const v of this) {
            predicate(v) ? trues.push(v) : falses.push(v);
        }
        return [trues, falses];
    }

    peekable(): Iterator<T> & { peek: () => IteratorResult<T>; } {
        return new Peekable(this)
    }

    reduce(callback: (acc: T, inc: T) => T): Option<T> {
        const n = this.next();
        if (n.done) {
            return null;
        }
        return this.fold(n.value, callback);
    }

    size_hint(): [number, Option<number>] {
        return [0, null]
    }

    skip(n: number): Iterator<T> {
        return new Skip(this, n)
    }

    skip_while(predicate: (value: T) => boolean): Iterator<T> {
        return new SkipWhile(this, predicate);
    }

    step_by(n: number): ExactSizeIterator<T> {
        return new StepBy(this, n);
    }

    //! Caller must ensure T = string || number
    sum<S extends T extends string | number ? T : never>(): S {
        // @ts-expect-error
        return this.reduce((acc, inc) => acc += inc) ?? 0 as S
    }

    take(n: number): Iterator<T> {
        return new Take(this as unknown as ExactSizeIterator<T>, n)
    }

    take_while(callback: (value: T) => boolean): Iterator<T> {
        return new TakeWhile(this, callback);
    }

    try_fold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Result<B, Err> {
        let acc = initial;
        let next;
        while (!(next = this.next()).done) {
            const val = fold(acc, next.value);
            acc = val as B
            if (is_error(val)) {
                break;
            }
        }
        return acc as Result<B, Err>;
    }

    unzip<K extends T extends readonly any[] ? T[0] : never, V extends T extends readonly any[] ? T[1] : never>(): [K[], V[]] {
        const keys = [];
        const values = [];
        // @ts-expect-error
        for (const [key, value] of this) {
            keys.push(key)
            values.push(value)
        }

        return [keys, values]

    }

    zip<V>(other: IteratorInputType<V>): Iterator<[T, V]> {
        return new Zip(this, other)
    }

    [Symbol.iterator]() {
        return this;
    }
}

export interface ExactSizeIterator<T> {
    size_hint(): SizeHint<number, number>;
    into_iter(): ExactSizeIterator<T>;
}
export abstract class ExactSizeIterator<T> extends Iterator<T> {
    len(): number {
        return this.size_hint()[1]
    }
    is_empty(): boolean {
        return this.len() === 0;
    }
}

export class FusedIterator<T> extends Iterator<T> {
    #done = false;
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>) {
        super();
        this.#iter = iterable;
    }


    override into_iter(): Iterator<T> {
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<T> {
        if (this.#done) {
            return done()
        }

        const n = this.#iter.next();
        if (n.done) {
            this.#done = true;
            return done()
        }
        return n;
    }
}

class ArrayChunks<T> extends Iterator<T[]> {
    #remainder: Option<T[]>
    #n: number;
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>, n: number) {
        super()
        this.#iter = iterable
        this.#n = n;
    }

    into_remainder(): Option<T[]> {
        return this.#remainder;
    }

    override into_iter(): Iterator<T[]> {
        this.#iter.into_iter();
        return this;
    }

    override next(): IteratorResult<T[]> {
        // ends iteration if reached end or cannot return 'n' elements
        const chunk = this.#iter.next_chunk(this.#n);

        if (chunk instanceof Error) {
            if (this.#remainder) {
                return done();
            }
            this.#remainder = chunk.get();
            return done();
        }

        return { done: false, value: chunk }
    }
}

class Chain<T> extends Iterator<T> {
    #iter: Iterator<T>
    #other: Iterator<T>
    constructor(iterable: Iterator<T>, other: Iterator<T>) {
        super()
        this.#iter = iterable;
        this.#other = iter(other) as Iterator<T>;
    }

    override into_iter(): Iterator<T> {
        this.#iter.into_iter();
        this.#other.into_iter();
        return this
    }

    override next(): IteratorResult<T> {
        const n = this.#iter.next();
        return !n.done ? n : this.#other.next();
    }
}

class Cycle<T> extends Iterator<T> {
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>) {
        super();
        this.#iter = iterable;
    }

    override into_iter(): Iterator<T> {
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<T> {
        const n = this.#iter.next();
        if (!n.done) {
            return n;
        }

        this.#iter.into_iter();
        return this.#iter.next();
    }

}

class Enumerate<T> extends ExactSizeIterator<[number, T]> {
    #index = -1;
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>) {
        super()
        this.#iter = iterable;
    }

    override into_iter(): ExactSizeIterator<[number, T]> {
        this.#iter.into_iter();
        this.#index = -1;
        return this
    }

    next(): IteratorResult<[number, T]> {
        this.#index++;
        return map_next(this.#iter.next(), v => [this.#index, v])
    }
}

class Filter<T> extends Iterator<T> {
    #predicate: (value: T) => boolean;
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>, predicate: (value: T) => boolean) {
        super()
        this.#iter = iterable;
        this.#predicate = predicate;
    }

    override into_iter(): Iterator<T> {
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<T> {
        let n;
        while (!(n = this.#iter.next()).done) {
            if (n.done) {
                return done()
            }

            if (this.#predicate(n.value)) {
                return n
            }
        }
        return done()
    }
}

class FilterMap<A, B> extends Iterator<B> {
    #iter: Iterator<A>;
    #fn: (value: A) => Option<B>;

    constructor(iter: Iterator<A>, fn: (value: A) => Option<B>) {
        super();
        this.#iter = iter
        this.#fn = fn;
    }

    override into_iter(): Iterator<B> {
        this.#iter.into_iter();
        return this;
    }

    override next(): IteratorResult<B> {
        let n;
        while (!(n = this.#iter.next()).done) {
            const elt = this.#fn(n.value);
            if (is_some(elt)) {
                return { done: false, value: elt }
            }
        }
        return done()

    }
}

class Flatten<T> extends Iterator<T> {
    #outter: FlatType<T>;
    #inner: Option<Iterator<T>>;
    constructor(iterable: FlatType<T>) {
        super()
        this.#outter = iterable;
    }


    override into_iter(): Iterator<T> {
        this.#outter.into_iter();
        return this
    }

    #next_loop(): IteratorResult<T> {

        let n = this.#inner!.next();

        if (n.done) {
            // advance outter
            const n2 = this.#outter.next();
            if (n2.done) {
                // outter is done
                return done();
            } else {
                // just advanced outter, so return new n;
                this.#inner = iter(n2.value);
                return this.#inner!.next()
            }

        } else {
            return n
        }
    }

    override next(): IteratorResult<T> {
        if (!this.#inner) {
            const n = this.#outter.next().value;
            if (!n) {
                return done()
            }
            this.#inner = iter(n) as Iterator<T>;
        }

        return this.#next_loop()
    }
}

class FlatMap<A, B extends Iterator<any>> extends Iterator<Item<B>> {
    #inner: Option<B>;
    #iter: Iterator<A>;
    #fn: (value: A) => Option<B>
    constructor(it: Iterator<A>, f: (value: A) => Option<B>) {
        super()
        this.#iter = it;
        this.#fn = f;
    }

    #next_loop() {
        // ! Safety: next() just initialized inner;
        const n = this.#inner!.next();
        if (n.done) {
            this.#inner = null;
            return this.next();
        }

        return n;
    }

    override next(): IteratorResult<Item<B>> {
        if (!this.#inner) {
            // check outter
            const n = this.#iter.next();
            if (n.done) {
                return done()
            };

            const inner = this.#fn(n.value);
            if (!is_some(inner)) {
                return done();
            }

            this.#inner = iter(inner) as any;
        }

        return this.#next_loop();
    }

    override into_iter(): Iterator<Item<B>> {
        this.#iter.into_iter();
        this.#inner = null;
        return this
    }
}

class Inspect<T> extends Iterator<T> {
    #callback: (value: T) => void;
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>, callback: (value: T) => void) {
        super()
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): Iterator<T> {
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<T> {
        const n = this.#iter.next();
        this.#callback(n.value);
        return n;
    }
}

function intersperse_fold<I extends Iterator<any>, B>(
    iter: I,
    initial: B,
    f: (acc: B, inc: Item<I>) => B,
    separator: () => Item<I>,
    needs_sep: boolean
): B {
    let accum = initial;

    if (!needs_sep) {
        const n = iter.next();
        if (!n.done) {
            accum = f(accum, n.value)
        } else {
            return accum
        }
    }

    return iter.fold(accum, (accum, x) => {
        accum = f(accum, separator())
        accum = f(accum, x);
        return accum;
    })
}

function intersperse_size_hint<I extends Iterator<any>>(iter: I, needs_sep: boolean): SizeHint {
    let [lo, hi] = iter.size_hint();
    const next_is_elem = !needs_sep ? 1 : 0;
    lo = (lo - next_is_elem) + lo
    // lo = Intrinsics.saturating_add(Intrinsics.saturating_sub(lo, next_is_elem_int, 'usize'), lo, 'usize')
    // TODO: implement this check
    // if (is_some(hi)) {
    //     hi = Intrinsics.checked_add(Intrinsics.saturating_sub(hi, next_is_elem_int, 'usize'), hi, 'usize')
    // }
    return [lo, hi];
}

class Intersperse<T> extends Iterator<T> {
    #iter: ReturnType<Iterator<T>['peekable']>;
    #separator: T;
    #needs_sep = false;
    constructor(iterable: Iterator<T>, separator: T) {
        super()
        this.#iter = iterable.peekable();
        this.#separator = separator;
    }


    override into_iter(): Iterator<T> {
        this.#needs_sep = false;
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<T> {
        if (this.#needs_sep && !this.#iter.peek().done) {
            this.#needs_sep = false;
            return { done: false, value: this.#separator }
        } else {
            this.#needs_sep = true;
            return this.#iter.next();
        }
    }

    override fold<B>(initial: B, fold: (acc: B, x: T) => B): B {
        const sep = this.#separator;
        return intersperse_fold(this.#iter, initial, fold, () => sep, this.#needs_sep)
    }

    override size_hint(): [number, Option<number>] {
        return intersperse_size_hint(this.#iter, this.#needs_sep)
    }
}

class IntersperseWith<T> extends Iterator<T> {
    #iter: ReturnType<Iterator<T>['peekable']>;
    #gen: () => T;
    #needs_sep = false;
    constructor(iterable: Iterator<T>, gen: () => T) {
        super()
        this.#iter = iterable.peekable();
        this.#gen = gen;
    }

    override into_iter(): Iterator<T> {
        this.#iter.into_iter();
        this.#needs_sep = false;
        return this
    }

    override next(): IteratorResult<T> {
        if (this.#needs_sep && !this.#iter.peek().done) {
            this.#needs_sep = false;
            return { done: false, value: this.#gen() }
        } else {
            this.#needs_sep = true;
            return this.#iter.next();
        }
    }

    override fold<B>(initial: B, fold: (acc: B, x: T) => B): B {
        return intersperse_fold(this.#iter, initial, fold, () => this.#gen(), this.#needs_sep)
    }
}

class Map<A, B> extends Iterator<B> {
    #map: MustReturn<(value: A) => B>;
    #iter: Iterator<A>;
    constructor(iterable: Iterator<A>, map: MustReturn<(value: A) => B>) {
        super()
        this.#iter = iterable;
        this.#map = map;
    }

    override into_iter(): Iterator<B> {
        this.#iter.into_iter();
        return this
    }

    next(): IteratorResult<B> {
        return map_next(this.#iter.next(), v => this.#map(v))
    }

}

class MapWhile<A, B> extends Iterator<B> {
    #iter: Iterator<A>
    #map: MustReturn<(value: A) => Option<B>>
    constructor(iterable: Iterator<A>, map: MustReturn<(value: A) => Option<B>>) {
        super()
        this.#iter = iterable
        this.#map = map;
    }

    override into_iter(): Iterator<B> {
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<B> {
        const n = this.#iter.next();
        if (n.done) {
            return done();
        }
        const v = this.#map(n.value);
        return is_some(v) ? { done: false, value: v } : done();
    }
}

class Skip<T> extends ExactSizeIterator<T> {
    #n: number;
    #iter: Iterator<T>
    constructor(iterable: Iterator<T>, n: number) {
        super()
        this.#iter = iterable;
        this.#n = n;
    }

    override size_hint(): SizeHint<number, number> {
        return this.#iter.size_hint() as SizeHint<number, number>
    }

    override into_iter(): ExactSizeIterator<T> {
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<T> {
        if (this.#n > 0) {
            const n = this.#iter.nth(this.#n)
            this.#n = 0;
            return n;
        } else {
            return this.#iter.next();
        }
    }

    override advance_by(n: number): Result<Ok, NonZeroUsize> {
        const skip_inner = this.#n;

        // saturating_add(skip_inner, n)
        const skip_and_advance = skip_inner + n;
        let remainder = this.#iter.advance_by(skip_and_advance) as Result<number, NonZeroUsize>;
        if (!is_error(remainder)) {
            remainder = 0
        } else {
            remainder = remainder.get()
        }
        const advanced_inner = skip_and_advance - remainder;
        // n -= saturating_sub(advanced_inner, skip_inner)
        n -= advanced_inner - skip_inner;
        // this.#n = saturating_sub(this.#n, advanced_inner)
        this.#n = this.#n - advanced_inner

        if (remainder === 0 && n > 0) {
            const r = this.#iter.advance_by(n)
            n = is_error(r) ? r.get() : 0
        }

        return new NonZeroUsize(n)
    }

    override nth(n: number): IteratorResult<T> {
        if (this.#n > 0) {
            const skip = this.#n;
            this.#n = 0;
            // TODO: implement Number.MAX_SAFE_INTEGER bounds check
            n = skip + n
            // n = Intrinsics.usize.checked_add(skip, n)!
            return !is_some(n) ? this.#iter.nth(skip - 1) : this.#iter.nth(n)
        } else {
            return this.#iter.nth(n)
        }
    }

    override count(): number {
        if (this.#n > 0) {
            if (this.#iter.nth(this.#n - 1).done) {
                return 0
            }
        }

        return this.#iter.count();
    }

    override last(): Option<T> {
        if (this.#n > 0) {
            this.#iter.nth(this.#n - 1);
        }

        return this.#iter.last()
    }

    override try_fold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Result<B, Err> {
        const n = this.#n;
        this.#n = 0;

        if (n > 0) {
            if (this.#iter.nth(n - 1).done) {
                return initial as Result<B, Err>;
            }
        }

        return this.#iter.try_fold(initial, fold)
    }

    override fold<B>(initial: B, fold: (acc: B, x: T) => B): B {
        if (this.#n > 0) {
            if (this.#iter.nth(this.#n - 1).done) {
                return initial
            }
        }
        return this.#iter.fold(initial, fold)
    }
}

class SkipWhile<T> extends Iterator<T> {
    #iter: Iterator<T>;
    #predicate: (value: T) => boolean;
    #needs_skip: boolean;
    constructor(iter: Iterator<T>, predicate: (value: T) => boolean) {
        super()
        this.#iter = iter;
        this.#predicate = predicate;
        this.#needs_skip = true;
    }
    override next(): IteratorResult<T> {
        if (!this.#needs_skip) {
            return this.#iter.next()
        } else {
            let n;
            while (!(n = this.#iter.next()).done) {
                if (this.#predicate(n.value)) {
                    return n;
                }
            }
            return done();
        }
    }

    override into_iter(): Iterator<T> {
        this.#needs_skip = true
        this.#iter.into_iter();
        return this
    }
}

class StepBy<T> extends ExactSizeIterator<T> {
    #iter: Iterator<T>;
    #step: number;
    #first_take: boolean;
    constructor(iterable: Iterator<T>, step: number) {
        super();
        this.#iter = iterable;
        this.#step = Math.max(step - 1, 0);
        this.#first_take = true;
    }

    override into_iter(): ExactSizeIterator<T> {
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<T> {
        const step_size = this.#first_take ? 0 : this.#step;
        this.#first_take = false;
        return this.#iter.nth(step_size);
    }

    override size_hint(): [number, number] {
        function first_size(step: number) {
            return (n: number) => n === 0 ? 0 : Math.floor(1 + (n - 1) / (step + 1));
        }

        function other_size(step: number) {
            return (n: number) => Math.floor(n / (step + 1));
        }

        const [low, high] = this.#iter.size_hint();

        const f = this.#first_take ? first_size(this.#step) : other_size(this.#step);

        return [f(low), is_some(high) ? f(high) : 0]
    }

    override nth(n: number): IteratorResult<T> {
        n = Math.floor(n);

        if (this.#first_take) {
            this.#first_take = false;
            const first = this.#iter.next();
            if (n === 0) {
                return first;
            }
            n--;
        }
        let step = this.#step + 1;

        if (n === Number.MAX_SAFE_INTEGER) {
            return this.#iter.nth(step - 1)
        } else {
            n++;
        }

        while (true) {
            // let mul = checked_mul(n * step);
            // let mul = n * step;
            // {
            //     if intrinsics::likely(mul.is_some()) {
            //         return self.iter.nth(mul.unwrap() - 1);
            //     }
            // }
            const div_n = Math.floor(Number.MAX_SAFE_INTEGER / n);
            const div_step = Math.floor(Number.MAX_SAFE_INTEGER / step);
            const nth_n = div_n * n;
            const nth_step = div_step * step;

            let nth;
            if (nth_n > nth_step) {
                step -= div_n
                nth = nth_n
            } else {
                n -= div_step;
                nth = nth_step;
            }

            return this.#iter.nth(nth - 1)
        }
    }

    override fold<B>(initial: B, fold: (acc: B, x: T) => B): B {
        function nth(iter: Iterator<T>, step: number) {
            return () => iter.nth(step);
        }

        if (this.#first_take) {
            this.#first_take = false;
            const n = this.#iter.next();
            if (n.done) {
                return initial;
            } else {
                initial = fold(initial, n.value)
            }
        }

        return from_fn(nth(this.#iter, this.#step)).fold(initial, fold as any)
    }

    override try_fold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Result<B, Err> {
        function nth(iter: Iterator<T>, step: number) {
            return () => iter.nth(step);
        }

        if (this.#first_take) {
            this.#first_take = false;
            const n = this.#iter.next();
            if (n.done) {
                return initial;
            } else {
                initial = fold(initial, n.value) as B;
            }
        }
        return from_fn(nth(this.#iter, this.#step)).try_fold(initial, fold as any)

    }
}

class Take<T> extends Iterator<T> {
    #iter: Iterator<T>;
    #n: number
    constructor(iterable: Iterator<T>, n: number) {
        super();
        this.#iter = iterable;
        this.#n = n;
    }

    override into_iter(): Iterator<T> {
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<T> {
        if (this.#n !== 0) {
            this.#n -= 1
            return this.#iter.next();
        } else {
            return done()
        }
    }

    override nth(n: number): IteratorResult<T> {
        if (this.#n > n) {
            this.#n -= n + 1;
            return this.#iter.nth(n)
        } else {
            if (this.#n > 0) {
                this.#iter.nth(this.#n - 1)
            }
            return done()
        }
    }

    override size_hint(): [number, Option<number>] {
        if (this.#n === 0) {
            return [0, 0];
        }
        let [lo, hi] = this.#iter.size_hint();
        lo = Math.min(lo, this.#n)
        hi = is_some(hi && hi < this.#n) ? hi : this.#n
        return [lo, hi];
    }

    override try_fold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Result<B, Err> {
        function check(n: number, fold: (acc: B, inc: T) => Result<B, Err>): (acc: B, inc: T) => Result<B, Err> {
            return (acc, x) => {
                n -= 1;
                let r = fold(acc, x)

                return n === 0 ? new ErrorExt(r) : r
            }
        }
        if (this.#n === 0) {
            return initial
        } else {
            let n = this.#n;
            return this.#iter.try_fold(initial, check(n, fold))
        }
    }

    override advance_by(n: number): Result<Ok, NonZeroUsize> {
        let min = Math.min(this.#n, n);
        const res = this.#iter.advance_by(min) as Result<Ok, Err>;
        const rem = !res ? 0 : res.get()
        const advanced = min - rem;
        this.#n -= advanced;
        return non_zero_usize(n - advanced)
    }

}

class TakeWhile<T> extends Iterator<T> {
    #iter: Iterator<T>;
    #predicate: (value: T) => boolean;
    constructor(iterable: Iterator<T>, predicate: (value: T) => boolean) {
        super();
        this.#iter = iterable;
        this.#predicate = predicate;
    }

    override into_iter(): Iterator<T> {
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<T> {
        const n = this.#iter.next();
        if (n.done) {
            return done()
        }

        if (this.#predicate(n.value)) {
            return n
        }

        return done();
    }
}

class Peekable<T> extends Iterator<T> {
    #peeked: Option<Option<IteratorResult<T>>>;
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>) {
        super()
        this.#iter = iterable;
    }

    #take() {
        const peeked = this.#peeked;
        this.#peeked = null;
        return peeked;
    }

    override into_iter(): Iterator<T> {
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<T> {
        const peeked = this.#take();
        return peeked ? peeked : this.#iter.next();
    }

    peek(): IteratorResult<T> {
        if (this.#peeked) {
            return this.#peeked
        }

        this.#peeked = this.#iter.next();
        return this.#peeked;
    }

    override count(): number {
        const peeked = this.#take();

        if (peeked) {
            return peeked.done ? 0 : 1 + this.#iter.count()

        } else {
            return this.#iter.count();
        }
    }

    override nth(n: number): IteratorResult<T> {
        const peeked = this.#take();

        if (peeked && (peeked.done || n === 0)) {
            return peeked;
        }

        const iter = this.#iter;
        return peeked ?
            iter.nth(n - 1) :
            iter.nth(n)
    }

    override last(): Option<T> {
        const opt = this.#take();
        let peek_opt: Option<T>;
        if (opt && opt.done) {
            peek_opt = null
        }
        if (opt) {
            peek_opt = opt.value
        } else {
            peek_opt = null;
        }

        const l = this.#iter.last()
        return is_some(l) ? l : peek_opt
    }

    override fold<B>(initial: B, fold: (acc: B, x: T) => B): B {
        const peeked = this.#peeked;
        let acc = initial;

        if (peeked && !peeked.done) {
            acc = fold(initial, peeked.value)
        }

        return this.#iter.fold(acc, fold);
    }

}

export function zip_next<K, V>(i1: Iterator<K>, i2: Iterator<V>): IteratorResult<[K, V]> {
    const k = i1.next()
    const v = i2.next()

    return (k.done || v.done) ? done() : { done: false, value: [k.value, v.value] as [K, V] }

}

class Zip<K, V> extends Iterator<[K, V]> {
    #iter: Iterator<K>;
    #other: Iterator<V>;

    constructor(iterable: Iterator<K>, other: IteratorInputType<V>) {
        super()
        this.#iter = iterable;
        this.#other = iter(other) as Iterator<V>;
    }

    override into_iter(): Iterator<[K, V]> {
        this.#iter.into_iter();
        this.#other.into_iter();
        return this

    }

    override next(): IteratorResult<[K, V]> {
        return zip_next(this.#iter, this.#other);
    }
}

// * --- common Iterators ---

// accepts any () => { next(): IteratorResult<T> }
export class Generator<T> extends Iterator<T> {
    #into_iter: () => GeneratorType<T>;
    #iter: GeneratorType<T>;
    constructor(into_iter: () => GeneratorType<T>) {
        super();
        this.#into_iter = into_iter;
        this.#iter = into_iter();
    }

    override next(): IteratorResult<T> {
        return this.#iter.next()
    }

    override into_iter(): Generator<T> {
        this.#iter = this.#into_iter();
        return this
    }
}

//* --- free standing functions ---

export function from_fn<T>(f: () => Option<T>): FromFn<T> {
    return new FromFn(f)
}

export class FromFn<T> extends Iterator<T> {
    #fn: () => Option<T>;
    constructor(fn: () => Option<T>) {
        super()
        this.#fn = fn;
    }

    override into_iter(): Iterator<T> {
        return this
    }

    override next(): IteratorResult<T> {
        const n = this.#fn();
        return is_some(n) ? { done: false, value: n } : done();
    }
}

// accepts any callback () => Option<T>.
// Iteration ends when callback return None
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

class Successors<T> extends Iterator<T> {
    #next: Option<T>;
    #first: Option<T>;
    #succ: (value: T) => Option<T>;
    constructor(first: Option<T>, succ: (value: T) => Option<T>) {
        super()
        this.#first = first;
        this.#next = first;
        this.#succ = succ;
    }

    override into_iter(): Iterator<T> {
        this.#next = this.#first;
        return this;
    }

    override next(): IteratorResult<T> {
        const item = this.#next
        if (!is_some(item)) {
            return done();
        }
        const n = this.#succ(item);
        this.#next = n;
        return { done: false, value: item }
    }

    override size_hint(): [number, Option<number>] {
        return is_some(this.#next) ? [1, null] : [0, 0]
    }
}
/**
@description
successors() takes two arguments, a 'first', and 'succ'.

'first' will be the first element of the Iterator.
succ() takes in the previous element, and returns the current element for next iteration.

It will create an Iterator which will keep yielding elements until None is encountered.
If 'first' was None, the resulting Iterator will be empty.
 */
export function successors<T>(first: Option<T>, succ: (value: T) => Option<T>): Successors<T> {
    return new Successors(first, succ)
}