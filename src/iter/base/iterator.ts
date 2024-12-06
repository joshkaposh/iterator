import { iter } from "..";
import { type Err, type Ok, type Option, type Result, is_error, is_some, ErrorExt } from "joshkaposh-option";
import { done, item, NonZeroUsize } from "../../shared";
import type { IteratorInputType, Item, SizeHint, IterInputType } from '../../types';
import type { Orderable } from "../../util";

type FlatType<T> = Iterator<Iterator<T>>;

export abstract class Iterator<T> {

    /**
     * Required method to implement. This method must implement the Iterator protocol
     */
    abstract next(): IteratorResult<T>;
    abstract into_iter(): Iterator<T>;

    clone(): Iterator<T> {
        return this;
    }

    /**
     * Advances the `Iterator` by `N` elements.  Note that calling advance_by(0) advances the `Iterator` by one element.
     * @param n {number} any non-negative integer
     * @returns Returns either nothing or a `NonZeroUsize` Error
     */
    advance_by(n: number): Result<Ok, NonZeroUsize> {
        for (let i = 0; i < n; i++) {
            if (this.next().done) {
                return new NonZeroUsize(n - i);
            }
        }
        return undefined as Ok
    }

    /**
     * Same as Array.some()
     * @returns Returns true if the fn returns true for any elements in the `Iterator`. Returns false otherwise.
     */
    any(fn: (value: T) => boolean): boolean {
        for (const v of this) {
            if (fn(v)) {
                return true
            }
        }
        return false
    }

    /**
     * @returns Returns true if the fn returns true for ALL elements in the `Iterator`. Returns false otherwise.
     */
    all(fn: (value: T) => boolean): boolean {
        for (const v of this) {
            if (!fn(v)) {
                return false
            }
        }
        return true
    }

    /**
     * Turns an `Iterator<T>` into an `Iterator<T[]>`, where each chunk contains `N` elements. If the `Iterator` is not divisible by `N`, the remaining elements can be retrieved by calling `into_remainder()`
     */
    array_chunks(n: number): Iterator<T[]> & {
        into_remainder(): Option<T[]>;
    } {
        return new ArrayChunks(this, n)
    }


    /**
     * Chains one `Iterator` to another. In other words, the Iterator `other` will start when `this` Iterator ends. 
     */
    chain<O extends Iterator<T>>(other: O): Iterator<T> {
        return new Chain(this, other)
    }


    //TODO: enable a function to be passed in for cases where more complex initialization is required
    /**
     * collect() is one of the most powerful methods. collect() by default will create an array with the remaining elements.
     * If a constructor is passed in, it will use that instead.
     * Note that the constructor must have one parameter of type `Iterable`
     */
    collect(into?: undefined | null | ArrayConstructor): T[];
    collect<I extends (new (it?: Iterable<T>) => any) | ArrayConstructor>(into: I): InstanceType<I>
    collect<I extends (new (it?: Iterable<T>) => any) | ArrayConstructor>(into?: I): InstanceType<I> | T[] {

        if (!into || into === Array) {
            return Array.from(this)
        }

        return new into!(this)

    }

    /**
     * calls Iterator.next() until it finishes
     */
    count(): number {
        let count = 0;
        while (!this.next().done) {
            count++;
        }
        return count;
    }

    /**
     * Converts a finite Iterator into an infinite one.
     */
    cycle(): Iterator<T> {
        return new Cycle(this);
    }

    /**
     * Turns an `Iterator<T>` into an `Iterator<[number, T]>`. Each index is yielded by the Iterator along with the element located at that index
     */
    enumerate(): ExactSizeIterator<[number, T]> {
        return new Enumerate(this)
    }

    /**
     * @returns Returns true if `this` Iterator and `other` are equal.
     */
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

    /**
     * @returns Returns true if `this` Iterator and `other` are equal using the provided function.
     */
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

    /**
     * @returns Creates an `Iterator` of only elements the provided function returns true for. 
     */
    filter(fn: (value: T) => boolean): Iterator<T> {
        return new Filter(this, fn)
    }

    /**
    * Creates an `Iterator` that filters and then maps type `A` to type `B` 
    * This is a shorthand for .filter().map()
    */
    filter_map<B>(fn: (value: T) => Option<B>): Iterator<B> {
        return new FilterMap(this, fn)
    }

    /**
    * Creates an `Iterator` that finds and then maps type `A` to type `B` 
    * This is a shorthand for .filter_map().next()
    */
    find_map<B>(fn: (value: T) => Option<B>): Option<B> {
        let n;
        while (!(n = this.next()).done) {
            const elt = fn(n.value);
            if (is_some(elt)) {
                return elt
            }
        }
        return
    }

    /**
     * Creates an `Iterator` that flattens nested structures. `flatten` is useful when wanting to remove one layer of indirection.
     * @throws `flatten` **throws** when calling next() or any methods tbat use it if the elements of the interator it is trying to flatten from cannot be converted into an `Iterator`
     * @example iter(1).flatten().next() // Errors 
     * @example iter([ [1, 2, 3], [4, 5, 6] ]).flatten().rev().collect() // [6, 5, 4, 3, 2, 1];
    */
    flatten(): Iterator<T> {
        return new Flatten(this as unknown as Iterator<Iterator<T>>)
    }
    /**
     * `flat_map` takes in a closure that takes in one argument `A` and returns an `Option<Iterator<B>>`.
     * It then yields elements from that iterator. Iteration ends when the closure returns `None`
     * `flat_map` is a shorthand for `Iterator.map().flatten()`
     * @see `Iterator.flatten` and `Iterator.map` for more information.
     */
    flat_map<B extends Iterator<any>>(f: (value: T) => Option<B>): Iterator<Item<B>> {
        return new FlatMap(this, f)
    }

    /**
     * find() searches the Iterator until an element is found given the supplied fn.
     * find() is short-curcuiting - the Iterator may have more elements left.
     * @returns element T or None if T wasn't found.
     */
    find(fn: (value: T) => boolean): Option<T> {
        let n;
        while (!(n = this.next()).done) {
            if (fn(n.value)) {
                return n.value;
            }
        }
        return null;
    }

    /**
     * fold() takes two arguments, an initial B and a folder (acc: B, element: T) => B.
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
     * for_each() will consume the Iterator, passing each element it encounters to the provided fn.
     * for_each() is useful if you want to do something with the elements of an Iterator but dont want to collect() into a Collection
    */
    for_each(fn: (value: T) => void) {
        for (const item of this) {
            fn(item);
        }
        return this;
    }

    /**
     * Fuses an `Iterator`
     * Some Iterators may yield an element T after finishing. A FusedIterator will stop afted the first time it encounters an IteratorResult<T> where IteratorResult = { done: true, value: undefined }
    */
    fuse(): Iterator<T> {
        return new FusedIterator(this);
    }

    /**
     * Inspects an iterator, calling the supplied fn each iteration before forwarding the element.
     * inpect() is often used for debugging complex data pipelines, or for printing errors.
     * It can be used to log messages before each call site in a pipeline.
     * @example
     *  iter([2, 4])
     * .inspect((v) => console.log('About to filter %d', v))
     * .filter()
     * .inspect((v) => console.log('About to map %d', v))
     * .map(v => v * v)
     * .inspect((v) => console.log('About to collect %d', v))
     * .collect()
     * ---
     *  //About to filter 2
     *  //About to map 2
     *  //About to filter 4
     *  //About to map 4
     *  //About to collect 16
    */
    inspect(fn: (value: T) => void): Iterator<T> {
        return new Inspect(this, fn)
    }

    /**
     * Creates an `Iterator<T>` where each element is separated by the provided argument.
     */
    intersperse(separator: T): Iterator<T> {
        return new Intersperse(this, separator);
    }
    /**
     * Creates an `Iterator<T>` where each element is separated by the provided closure.
     */
    intersperse_with(separator: () => T): Iterator<T> {
        return new IntersperseWith(this, separator)
    }

    /**
     * @returns returns true if the Iterator is sorted
     */
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

    /**
     * @returns Returns the last element found in the Iterator. Otherwise will return undefined.
     */
    last(): Option<T> {
        let val: Option<T> = null
        for (const v of this) {
            val = v
        }
        return val;
    }

    /**
     * Converts an Iterator<A> into an Iterator<B>.
     * map() calls `f` for each element of the Iterator, yielding the result of the provided function
     */
    map<B>(f: (value: T) => B): Iterator<B> {
        return new Map(this, f) as unknown as Iterator<B>
    }

    /**
     * Converts an Iterator<A> into an Iterator<B>.
     * map() calls `f` for each element of the Iterator, yielding the result of the provided function until any null or undefined is encountered.
     */
    map_while<B>(f: (value: T) => B): Iterator<B> {
        return new MapWhile(this, f)
    }

    /**
     * @returns returns the max value found in the Iterator. 
     */
    //@ts-expect-error
    max(): Option<Orderable<T>> {
        const n = this.next();
        if (!n.done) {
            const ty = typeof n.value;
            if (ty === 'number') {
                return Math.max(n.value as number, ...this as unknown as Iterator<number>) as Orderable<T>;
            } else if (ty === 'string') {
                return this.fold(n.value as Orderable<T>, (acc, x) => (acc > x as unknown as Orderable<T> ? acc : x as Orderable<T>)) as Orderable<T>
            }

            throw new Error(`Cannot call 'max' on an Iterator of type ${ty}. Accepted element types are 'string' or 'number'`)
        }
    }

    /**
     * @returns returns the max value found in the Iterator. 
     */
    // @ts-expect-error
    min(): Option<Orderable<T>> {
        const n = this.next();
        if (!n.done) {
            const ty = typeof n.value;
            if (ty === 'number') {
                return Math.min(n.value as number, ...this as Iterator<number>) as Orderable<T>;
            } else if (ty === 'string') {
                return this.fold(n.value as Orderable<T>, (acc, x) => (acc > x as unknown as Orderable<T> ? acc : x as Orderable<T>))
            }

            throw new Error(`Cannot call 'max' on an Iterator of type ${ty}. Accepted element types are 'string' or 'number'`)
        }
    }

    /**
     * Returns either an Array of `N` elements or an Err containing up to `N` elements if fewer than `N` were found.
     */
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

    /**
     * Gets the `N`th element of the Iterator. Note that calling nth(0) retrives the first index. 
     */
    nth(n: number) {
        this.advance_by(n);
        return this.next();
    }

    /**
     * @example
     * iter([1, 2, 3, 4])
     * .partition(x => x % 2 === 0)
     * .collect()
     * // Output = [[2, 4], [1, 3]]
     * @returns Returns a tuple of true values and false values using the provided function
     */
    partition(fn: (value: T) => boolean): [T[], T[]] {
        const trues = [];
        const falses = [];
        for (const v of this) {
            fn(v) ? trues.push(v) : falses.push(v);
        }
        return [trues, falses];
    }

    /**
     * Creates an Iterator with a `peek()` method.
     * Useful in situations when checking the next element is required without advancing the Iterator
     */
    peekable(): Iterator<T> & { peek: () => IteratorResult<T>; } {
        return new Peekable(this)
    }

    /**
     * @returns Returns the position (index) of an element. Same as Array.findIndex()
     */
    position(fn: (value: T) => boolean): Option<number> {
        let index = -1;
        const found = this.find(n => {
            index += 1;
            return fn(n)
        })
        return is_some(found) ? index : null
    }

    /**
     * Consumes an Iterator and turns it into a single value.
     * Same as Array.reduce()
     */
    reduce(fn: (acc: T, inc: T) => T): Option<T> {
        const n = this.next();
        if (n.done) {
            return null;
        }
        return this.fold(n.value, fn);
    }

    scan<State extends Record<PropertyKey, any>>(state: State, scanner: (state: State, x: T) => State) {
        function cb(x: T) {
            state = scanner(state, x);
        }

        this.for_each(cb);
        return state;
    }

    /**
     * @returns returns a tuple of the expected min/max size of the Iterator
     * By default this is [0, undefined], which is true for any Iterator
    */
    size_hint(): [number, Option<number>] {
        return [0, undefined]
    }

    /**
     * Creates an Iterator that skips `N` elements.
     */
    skip(n: number): Iterator<T> {
        return new Skip(this, n)
    }

    /**
     * Creates an Iterator that skips elements until the provided closure returns false or iteration ends, whichever happens first.
     */
    skip_while(fn: (value: T) => boolean): Iterator<T> {
        return new SkipWhile(this, fn);
    }

    /**
     * Creates an Iterator that steps by `N` elements at a time.
     */
    step_by(n: number): ExactSizeIterator<T> {
        return new StepBy(this, n);
    }

    //! Caller must ensure T = string || number
    sum<S extends T extends string | number ? T : never>(): S {
        // @ts-expect-error
        return this.reduce((acc, inc) => acc += inc) ?? 0 as S
    }

    /**
     * Creates an Iterator that takes up to `N` elements.
     */
    take(n: number): Iterator<T> {
        return new Take(this as unknown as ExactSizeIterator<T>, n)
    }

    /**
     * Creates an Iterator that takes elements until the closure returns false or iteration ends, whichever happens first.
     */
    take_while(fn: (value: T) => boolean): Iterator<T> {
        return new TakeWhile(this, fn);
    }

    try_fold<B, E extends Err>(initial: B, fold: (acc: B, inc: T) => Result<B, E>): Result<B, E> {
        let acc = initial;
        let next;
        while (!(next = this.next()).done) {
            const val = fold(acc, next.value);
            acc = val as B
            if (is_error(val)) {
                break;
            }
        }
        return acc as Result<B, E>;
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
    clone(): ExactSizeIterator<T>
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

export interface FusedIterator<T> {
    clone(): FusedIterator<T>
}

export class FusedIterator<T> extends Iterator<T> {
    #done = false;
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>, done = false) {
        super();
        this.#iter = iterable;
        this.#done = done;
    }

    override clone(): FusedIterator<T> {
        return new FusedIterator(this.#iter.clone(), this.#done)
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
    constructor(iterable: Iterator<T>, n: number, remainder?: Option<T[]>) {
        super()
        this.#iter = iterable
        this.#n = n;
        this.#remainder = remainder
    }

    override clone(): ArrayChunks<T> {
        return new ArrayChunks(this.#iter.clone(), this.#n, this.#remainder)
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

        return item(chunk);
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

    override clone(): Iterator<T> {
        return new Chain(this.#iter.clone(), this.#other.clone())
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

    override clone(): Iterator<T> {
        return new Cycle(this.#iter.clone())
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
    #index: number;
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>, index = -1) {
        super()
        this.#iter = iterable;
        this.#index = index;
    }

    override clone(): ExactSizeIterator<[number, T]> {
        return new Enumerate(this.#iter.clone(), this.#index);
    }

    override into_iter(): ExactSizeIterator<[number, T]> {
        this.#iter.into_iter();
        this.#index = -1;
        return this
    }

    next(): IteratorResult<[number, T]> {
        this.#index++;
        const n = this.#iter.next();
        return !n.done ? item<[number, T]>([this.#index, n.value]) : done();
    }
}

class Filter<T> extends Iterator<T> {
    #fn: (value: T) => boolean;
    #iter: Iterator<T>;

    constructor(iterable: Iterator<T>, fn: (value: T) => boolean) {
        super()
        this.#iter = iterable;
        this.#fn = fn;
    }

    override clone(): Iterator<T> {
        return new Filter(this.#iter.clone(), this.#fn)
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

            if (this.#fn(n.value)) {
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

    override clone(): FilterMap<A, B> {
        return new FilterMap(this.#iter.clone(), this.#fn)
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
                return item(elt);
            }
        }
        return done()

    }
}

class Flatten<T> extends Iterator<T> {
    #outter: FlatType<T>;
    #inner: Option<Iterator<T>>;
    constructor(outter: FlatType<T>, inner?: Option<Iterator<T>>) {
        super()
        this.#outter = outter;
        this.#inner = inner
    }

    override clone(): Flatten<T> {
        return new Flatten(this.#outter.clone(), this.#inner?.clone())
    }

    override into_iter(): Iterator<T> {
        this.#outter.into_iter();
        return this
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
}

class FlatMap<A, B extends Iterator<any>> extends Iterator<Item<B>> {
    #inner: Option<B>;
    #iter: Iterator<A>;
    #fn: (value: A) => Option<B>
    constructor(iterator: Iterator<A>, flat_map: (value: A) => Option<B>, inner?: Option<B>) {
        super()
        this.#iter = iterator;
        this.#fn = flat_map;
        this.#inner = inner;
    }

    override clone(): Iterator<Item<B>> {
        return new FlatMap(this.#iter.clone(), this.#fn, this.#inner);
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

            this.#inner = iter(inner) as unknown as B;
        }

        return this.#next_loop();
    }

    override into_iter(): Iterator<Item<B>> {
        this.#iter.into_iter();
        this.#inner = null;
        return this
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
}

class Inspect<T> extends Iterator<T> {
    #fn: (value: T) => void;
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>, fn: (value: T) => void) {
        super()
        this.#iter = iterable;
        this.#fn = fn;
    }

    override clone(): Iterator<T> {
        return new Inspect(this.#iter.clone(), this.#fn);
    }

    override into_iter(): Iterator<T> {
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<T> {
        const n = this.#iter.next();
        this.#fn(n.value);
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
    #needs_sep: boolean;
    constructor(iterable: Iterator<T>, separator: T, needs_sep = false) {
        super()
        this.#iter = iterable.peekable();
        this.#separator = separator;
        this.#needs_sep = needs_sep;
    }

    override clone(): Iterator<T> {
        return new Intersperse(this.#iter.clone(), this.#separator, this.#needs_sep)
    }

    override into_iter(): Iterator<T> {
        this.#needs_sep = false;
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<T> {
        if (this.#needs_sep && !this.#iter.peek().done) {
            this.#needs_sep = false;
            return item(this.#separator)
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
    #separator: () => T;
    #needs_sep: boolean;
    constructor(iterable: Iterator<T>, separator: () => T, needs_sep = false) {
        super()
        this.#iter = iterable.peekable();
        this.#separator = separator;
        this.#needs_sep = needs_sep
    }


    override clone(): Iterator<T> {
        return new IntersperseWith(this.#iter.clone(), this.#separator, this.#needs_sep)
    }

    override into_iter(): Iterator<T> {
        this.#iter.into_iter();
        this.#needs_sep = false;
        return this
    }

    override next(): IteratorResult<T> {
        if (this.#needs_sep && !this.#iter.peek().done) {
            this.#needs_sep = false;
            return item(this.#separator());
        } else {
            this.#needs_sep = true;
            return this.#iter.next();
        }
    }

    override fold<B>(initial: B, fold: (acc: B, x: T) => B): B {
        return intersperse_fold(this.#iter, initial, fold, () => this.#separator(), this.#needs_sep)
    }
}

class Map<A, B> extends Iterator<B> {
    #map: (value: A) => B;
    #iter: Iterator<A>;
    constructor(iterable: Iterator<A>, map: (value: A) => B) {
        super()
        this.#iter = iterable;
        this.#map = map;
    }

    override into_iter(): Iterator<B> {
        this.#iter.into_iter();
        return this
    }

    override clone(): Iterator<B> {
        return new Map(this.#iter.clone(), this.#map);
    }

    next(): IteratorResult<B> {
        const n = this.#iter.next();
        return !n.done ? item(this.#map(n.value)) : done();
    }

}

class MapWhile<A, B> extends Iterator<B> {
    #iter: Iterator<A>
    #map: (value: A) => Option<B>
    constructor(iterable: Iterator<A>, map: (value: A) => Option<B>) {
        super()
        this.#iter = iterable
        this.#map = map;
    }

    override clone(): Iterator<B> {
        return new MapWhile(this.#iter.clone(), this.#map);
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
        return is_some(v) ? item(v) : done();
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

    override clone(): ExactSizeIterator<T> {
        return new Skip(this.#iter.clone(), this.#n);
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

    override try_fold<B, E extends Err>(initial: B, fold: (acc: B, inc: T) => Result<B, E>): Result<B, E> {
        const n = this.#n;
        this.#n = 0;

        if (n > 0) {
            if (this.#iter.nth(n - 1).done) {
                return initial
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
    #fn: (value: T) => boolean;
    #needs_skip: boolean;
    constructor(iter: Iterator<T>, fn: (value: T) => boolean, needs_skip = true) {
        super()
        this.#iter = iter;
        this.#fn = fn;
        this.#needs_skip = needs_skip;
    }

    override clone(): Iterator<T> {
        return new SkipWhile(this.#iter.clone(), this.#fn, this.#needs_skip)
    }

    override next(): IteratorResult<T> {
        if (!this.#needs_skip) {
            return this.#iter.next()
        } else {
            let n;
            while (!(n = this.#iter.next()).done) {
                if (this.#fn(n.value)) {
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
    constructor(iterable: Iterator<T>, step: number, first_take = true) {
        super();
        this.#iter = iterable;
        this.#step = Math.max(step - 1, 0);
        this.#first_take = first_take;
    }

    override clone(): ExactSizeIterator<T> {
        return new StepBy(this.#iter.clone(), this.#step, this.#first_take)
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

        return from_fn(nth(this.#iter, this.#step)).fold(initial, fold)
    }

    override try_fold<B, E extends Err>(initial: B, fold: (acc: B, inc: T) => Result<B, E>): Result<B, E> {
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
        return from_fn(nth(this.#iter, this.#step)).try_fold(initial, fold)

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

    override clone(): Iterator<T> {
        return new Take(this.#iter.clone(), this.#n);
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

    override try_fold<B, E extends Err>(initial: B, fold: (acc: B, inc: T) => Result<B, E>): Result<B, E> {
        function check(n: number, fold: (acc: B, inc: T) => Result<B, E>): (acc: B, inc: T) => Result<B, E> {
            return (acc, x) => {
                n -= 1;
                let r = fold(acc, x)

                return n === 0 ? new ErrorExt(r) as E : r
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
        return new NonZeroUsize(n - advanced)
    }

}

class TakeWhile<T> extends Iterator<T> {
    #iter: Iterator<T>;
    #fn: (value: T) => boolean;
    constructor(iterable: Iterator<T>, fn: (value: T) => boolean) {
        super();
        this.#iter = iterable;
        this.#fn = fn;
    }

    override clone(): Iterator<T> {
        return new TakeWhile(this.#iter.clone(), this.#fn)
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

        if (this.#fn(n.value)) {
            return n
        }

        return done();
    }
}

class Peekable<T> extends Iterator<T> {
    #peeked: Option<Option<IteratorResult<T>>>;
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>, peeked?: Option<Option<IteratorResult<T>>>) {
        super()
        this.#iter = iterable;
        this.#peeked = peeked;
    }

    override clone(): Iterator<T> {
        return new Peekable(this.#iter.clone(), this.#peeked)
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

    #take() {
        const peeked = this.#peeked;
        this.#peeked = null;
        return peeked;
    }
}

class Zip<K, V> extends Iterator<[K, V]> {
    #iter: Iterator<K>;
    #other: Iterator<V>;

    constructor(iterable: Iterator<K>, other: IteratorInputType<V>) {
        super()
        this.#iter = iterable;
        this.#other = iter(other) as Iterator<V>;
    }

    override clone(): Iterator<[K, V]> {
        return new Zip(this.#iter.clone(), this.#other.clone())
    }

    override into_iter(): Iterator<[K, V]> {
        this.#iter.into_iter();
        this.#other.into_iter();
        return this

    }

    override next(): IteratorResult<[K, V]> {
        const k = this.#iter.next()
        const v = this.#other.next()

        return (k.done || v.done) ? done() : item([k.value, v.value] as [K, V])
    }
}

//* --- free standing functions ---
export function from_fn<T>(f: () => IteratorResult<T>): FromFn<T> {
    return new FromFn(f)
}

export class FromFn<T> extends Iterator<T> {
    #fn: () => IteratorResult<T>;
    constructor(fn: () => IteratorResult<T>) {
        super()
        this.#fn = fn;
    }

    override clone(): Iterator<T> {
        return new FromFn(this.#fn);
    }

    override into_iter(): Iterator<T> {
        return this
    }

    override next(): IteratorResult<T> {
        return this.#fn();
    }
}