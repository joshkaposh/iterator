import { type Err, type Ok, type Option, type Result, is_error, is_some, ErrorExt } from "joshkaposh-option";
import { NonZeroUsize, done, item, non_zero_usize } from "../shared";
import type { AsyncIteratorInputType, Item, SizeHint } from "../types";
import { async_iter } from ".";

export interface AsyncIterator<T> {
    advance_by(n: number): Promise<Result<Ok, NonZeroUsize>>
}
export abstract class AsyncIterator<T> {

    abstract next(): Promise<IteratorResult<T>>;
    abstract into_iter(): AsyncIterator<T>;

    async advance_by(n: number): Promise<Result<Ok, NonZeroUsize>> {
        for (let i = 0; i < n; i++) {
            const next = await this.next()
            if (next.done) {
                return new NonZeroUsize(n - i);
            }
        }
        return undefined as Ok
    }

    async eq(other: ExactSizeAsyncIterator<T>) {
        for await (const val of other) {
            const n = await this.next()
            if (n.value !== val) {
                return false
            }
        }

        return (await this.next()).value === (await other.next()).value
    }

    async eq_by(other: ExactSizeAsyncIterator<T>, eq: (a: T, b: T) => boolean): Promise<boolean> {
        for await (const val of other) {
            const n = await this.next()
            if (n.done) {
                return false
            }
            if (!eq(n.value, val)) {
                return false
            }
        }

        return (await this.next()).value === (await other.next()).value
    }

    async for_each(callback: (value: T) => void) {
        for await (const item of this) {
            callback(item);
        }
        return this;
    }

    async any(predicate: (value: T) => boolean) {
        for await (const v of this) {
            if (predicate(v)) {
                return true
            }
        }
        return false
    }

    async all(predicate: (value: T) => boolean) {
        for await (const v of this) {
            if (!predicate(v)) {
                return false
            }
        }
        return true
    }

    async collect(into?: undefined): Promise<T[]>;
    async collect<I extends new (it: AsyncIterator<T>) => any>(into: I): Promise<InstanceType<I>>
    async collect<I extends new (it: AsyncIterator<T>) => any>(into?: I): Promise<InstanceType<I> | T[]> {
        if (into) {
            return new into(this)
        }

        const arr: T[] = [];
        for await (const v of this) {
            arr.push(v);
        }
        return arr;
    }

    array_chunks(n: number) {
        return new ArrayChunks(this as any, n)
    }

    chain<O extends AsyncIteratorInputType<any>, T2 extends Item<O>>(other: O, callback: (value: T2) => T2 | Promise<T2>): AsyncIterator<T | T2> {
        return new Chain(this as any, other as any, callback);
    }

    cycle(): AsyncIterator<T> {
        return new Cycle(this);
    }

    async count() {
        console.warn('count() was called on and AsyncIterator. The len() method on AsyncExactSizeIterator should be used');
        let c = 0;
        for await (const _ of this) {
            c++;
        }
        return c
    }

    enumerate(): AsyncIterator<[number, T]> {
        return new Enumerate(this)
    }

    filter(callback: (value: T) => boolean): AsyncIterator<T> {
        return new Filter(this, callback)
    }

    flatten<O extends T extends Iterable<infer T2> ? T2 : never>(): AsyncIterator<O> {
        return new Flatten(this as any)
    }

    flat_map<B>(f: (value: T) => B): AsyncIterator<B> {
        return new FlatMap(this as any, f)
    }

    async fold<B>(initial: B, fold: (acc: B, x: T) => B) {
        let acc = initial;
        let next;
        let done = false;
        while (!done) {
            next = await this.next()
            done = next.done!;
            acc = fold(acc, next.value!)
        }

        return acc;
    }

    async find(predicate: (value: T) => boolean): Promise<Option<T>> {
        let n;
        let done = false;
        while (!done) {
            n = await this.next()
            if (n.done) {
                return n as any
            }
            if (predicate(n.value)) {
                return n.value;
            }
        }
        return null;
    }

    async last(): Promise<Option<T>> {
        let val: Option<T> = null
        for await (const v of this) {
            val = v
        }
        return val;
    }

    fuse(): AsyncIterator<T> {
        return new FusedAsyncIterator(this);
    }

    inspect(callback: (value: T) => void): AsyncIterator<T> {
        return new Inspect(this, callback)
    }

    // async is_sorted(): boolean {
    //     const it = this.peekable();
    //     let is_done = false;
    //     while (!is_done) {
    //         const n = it[Symbol]

    //     }

    // }

    intersperse(separator: T): AsyncIterator<T> {
        return new Intersperse(this, separator);
    }

    intersperse_with(separator: () => T): AsyncIterator<T> {
        return new IntersperseWith(this, separator)
    }

    map<B>(f: (value: T) => Promise<B> | B): AsyncIterator<B> {
        return new Map(this, f);
    }

    map_while<B>(f: (value: T) => B): AsyncIterator<B> {
        return new MapWhile(this, f)
    }

    //! Caller must ensure T = number
    async max(): Promise<number> {
        console.warn('max() called on an AsyncIterator');
        let m = 0;
        for await (const v of this) {
            // @ts-expect-error
            if (v > m) {
                m = v as number
            }
        }
        return m;
    }

    //! Caller must ensure T = number
    async min(): Promise<number> {
        console.warn('min() called on an AsyncIterator');
        let m = Number.MAX_VALUE
        for await (const v of this) {
            // @ts-expect-error
            if (v < m) {
                m = v as number
            }
        }
        return m;
    }

    async next_chunk(n: number): Promise<Result<T[], Err<T[]>>> {
        const arr: T[] = [];
        for (let i = 0; i < n; i++) {
            const item = await this.next();
            if (item.done) {
                return new ErrorExt(arr, `'next_chunk' couldn't fill a container of ${n} elements, but a container of ${arr.length} elements were found`)
            }
            arr.push(item.value)
        }
        return arr;
    }

    async nth(n: number) {
        await this.advance_by(n);
        return await this.next();
    }

    async partition(predicate: (value: T) => boolean): Promise<[T[], T[]]> {
        const trues = [];
        const falses = [];
        for await (const v of this) {
            predicate(v) ? trues.push(v) : falses.push(v);
        }
        return [trues, falses];
    }

    peekable(): AsyncIterator<T> & { peek: () => Promise<IteratorResult<T>>; } {
        return new Peekable(this)
    }

    size_hint(): [number, Option<number>] {
        return [0, null]
    }

    skip(n: number): AsyncIterator<T> {
        return new Skip(this, n)
    }

    skip_while(predicate: (value: T) => boolean): AsyncIterator<T> {
        return new SkipWhile(this, predicate);
    }

    step_by(n: number): AsyncIterator<T> {
        return new StepBy(this, n);
    }

    //! Caller must ensure T = string || number
    sum<S extends T extends string | number ? T : never>(): S {
        // @ts-expect-error
        return this.reduce((acc, inc) => acc += inc) ?? 0 as S
    }

    take(n: number): AsyncIterator<T> {
        return new Take(this as unknown as ExactSizeAsyncIterator<T>, n)
    }

    take_while(callback: (value: T) => boolean): AsyncIterator<T> {
        return new TakeWhile(this, callback);
    }

    async try_fold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err> | Promise<T>): Promise<Result<B, Err>> {
        let acc = initial;
        let next;
        while (true) {
            next = await this.next();
            if (next.done) {
                return acc
            }

            const val = await fold(acc, next.value!);
            acc = val as B
            if (is_error(val)) {
                break;
            }
        }

        return acc as Result<B, Err>;
    }

    async reduce(callback: (acc: T, inc: T) => T): Promise<Option<T>> {
        const n = await this.next();
        if (n.done) {
            return null;
        }
        return await this.fold(n.value, callback);
    }

    async unzip<K extends T extends readonly any[] ? T[0] : never, V extends T extends readonly any[] ? T[1] : never>(): Promise<[K[], V[]]> {
        const keys = [];
        const values = [];
        // @ts-expect-error
        for await (const [k, v] of this) {
            keys.push(k)
            values.push(v)
        }

        return [keys, values]

    }

    zip<V>(other: AsyncIteratorInputType<V>, callback: (value: V) => Promise<V> | V): AsyncIterator<[T, V]> {
        return new Zip(this, other, callback)
    }

    [Symbol.asyncIterator]() {
        return this;
    }
}

export interface ExactSizeAsyncIterator<T> {
    size_hint(): SizeHint<number, number>;
    into_iter(): ExactSizeAsyncIterator<T>;
}
export abstract class ExactSizeAsyncIterator<T> extends AsyncIterator<T> {
    len(): number {
        return this.size_hint()[1]
    }
    is_empty(): boolean {
        return this.len() === 0;
    }

}

export class FusedAsyncIterator<T> extends AsyncIterator<T> {
    #done = false;
    #iter: AsyncIterator<T>;
    constructor(iterable: AsyncIterator<T>) {
        super();
        this.#iter = iterable;
    }

    override into_iter(): AsyncIterator<T> {
        this.#done = false;
        this.#iter.into_iter();
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        if (this.#done) {
            return done()
        }

        const n = await this.#iter.next();
        if (n.done) {
            this.#done = true;
            return done()
        }
        return n
    }
}

export function from_iterable<T>(into_iter: () => Generator<T>, callback: (value: T) => T | Promise<T>) {
    return from_async_fn(() => {
        const it = into_iter();
        return async () => {
            const n = it.next();
            return n.done ? done() : item(await callback(n.value))
        }
    })
}

class ArrayChunks<T> extends AsyncIterator<T[]> {
    #remainder: Option<T[]>
    #n: number;
    #iter: AsyncIterator<T>;
    constructor(iterable: AsyncIterator<T>, n: number) {
        super()
        this.#iter = iterable
        this.#n = n;
    }

    into_remainder() {
        return this.#remainder;
    }

    override into_iter(): AsyncIterator<T[]> {
        this.#iter.into_iter();
        return this;
    }

    override async next(): Promise<IteratorResult<T[]>> {
        // ends iteration if reached end or cannot return 'n' elements
        const chunk = await this.#iter.next_chunk(this.#n);

        if (chunk instanceof Error) {
            if (this.#remainder) {
                return done();
            }
            this.#remainder = chunk.get();
            return done();
        }

        return item(chunk) as IteratorResult<T[]>;
    }
}

class Chain<T1, T2> extends AsyncIterator<T1 | T2> {
    #iter: AsyncIterator<T1>
    #other: AsyncIterator<T2>
    constructor(iterable: AsyncIterator<T1>, other: AsyncIteratorInputType<T2>, callback: (value: T2) => T2 | Promise<T2>) {
        super()
        this.#iter = iterable;
        this.#other = async_iter(other, callback as any);
    }

    override into_iter(): AsyncIterator<T1 | T2> {
        this.#iter.into_iter();
        this.#other.into_iter();
        return this
    }

    override async next(): Promise<IteratorResult<T1 | T2>> {
        const n = await this.#iter.next();
        if (n.done) {
            const o = await this.#other.next();
            return o
        }
        return n;
    }
}

class Cycle<T> extends AsyncIterator<T> {
    #iter: AsyncIterator<T>;
    constructor(iterable: AsyncIterator<T>) {
        super();
        this.#iter = iterable;
    }

    override into_iter(): AsyncIterator<T> {
        this.#iter.into_iter();
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        const n = await this.#iter.next();
        if (n.done) {
            this.into_iter();
            return await this.#iter.next();
        }

        return n;
    }

}

class Enumerate<T> extends AsyncIterator<[number, T]> {
    #index = -1;
    #iter: AsyncIterator<T>;
    constructor(iterable: AsyncIterator<T>) {
        super()
        this.#iter = iterable;
    }

    override into_iter(): AsyncIterator<[number, T]> {
        this.#index = -1;
        this.#iter.into_iter();
        return this
    }

    async next() {
        this.#index++;
        const n = await this.#iter.next();
        return !n.done ? item([this.#index, n.value] as [number, T]) : done<[number, T]>()
    }
}

class Filter<T> extends AsyncIterator<T> {
    #callback: (value: T) => boolean;
    #iter: AsyncIterator<T>;
    constructor(iterable: AsyncIterator<T>, callback: (value: T) => boolean) {
        super()
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): AsyncIterator<T> {
        this.#iter.into_iter();
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        let n;
        while (true) {
            n = await this.#iter.next();
            if (n.done) {
                return done()
            }

            if (this.#callback(n.value)) {
                return n
            }
        }
    }
}

// @ts-expect-error
class FilterMap<A, B> extends AsyncIterator<B> {

    #iter: AsyncIterator<A>;
    #fn: (value: A) => Option<B>;

    constructor(iter: AsyncIterator<A>, fn: (value: A) => Option<B>) {
        super();
        this.#iter = iter
        this.#fn = fn;
    }

    override into_iter(): AsyncIterator<B> {
        this.#iter.into_iter();
        return this;
    }

    override async next(): Promise<IteratorResult<B>> {
        let n;
        while (!(n = await this.#iter.next()).done) {
            const elt = this.#fn(n.value);
            if (is_some(elt)) {
                return item(elt);
            }
        }
        return done()
    }
}

class Flatten<T> extends AsyncIterator<T> {
    #outter: AsyncIterator<AsyncIterator<T>>;
    #inner: Option<AsyncIterator<T>>;

    constructor(iterable: AsyncIterator<AsyncIterator<T>>) {
        super()
        this.#outter = iterable;
    }

    override into_iter(): AsyncIterator<T> {
        this.#outter.into_iter();
        return this
    }

    async #next_loop(): Promise<IteratorResult<T>> {

        let n = await this.#inner!.next();

        if (n.done) {
            // advance outter
            const n2 = await this.#outter.next();
            if (n2.done) {
                // outter is done
                return done();
            } else {
                // just advanced outter, so return new n;
                this.#inner = n2.value!
                return this.#inner.next()
            }

        } else {
            return n
        }
    }

    override async next(): Promise<IteratorResult<T>> {
        if (!this.#inner) {

            const out = await this.#outter.next();
            if (out.done) {
                return done()
            }
            const it = out.value!;
            this.#inner = it
        }

        return this.#next_loop()
    }
}

class FlatMap<A, B> extends AsyncIterator<B> {
    #flat: Flatten<A>
    #f: (value: A) => B | Promise<B>;

    constructor(it: AsyncIterator<AsyncIterator<A>>, f: (value: A) => B | Promise<B>) {
        super()
        this.#flat = new Flatten(it);
        this.#f = f;
    }


    override async next(): Promise<IteratorResult<B>> {
        const n = await this.#flat.next();
        if (n.done) {
            return done();
        }

        return n.done ? done() : item(await this.#f(n.value))
    }

    override into_iter(): AsyncIterator<B> {
        this.#flat.into_iter();
        return this
    }
}

class Inspect<T> extends AsyncIterator<T> {
    #callback: (value: T) => void;
    #iter: AsyncIterator<T>;
    constructor(iterable: AsyncIterator<T>, callback: (value: T) => void) {
        super()
        this.#iter = iterable;
        this.#callback = callback;
    }



    override into_iter(): AsyncIterator<T> {
        this.#iter.into_iter();
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        const n = await this.#iter.next();
        this.#callback(n.value);
        return n;
    }
}

async function intersperse_fold<I extends AsyncIterator<any>, B>(
    iter: I,
    initial: B,
    f: (acc: B, inc: Item<I>) => B,
    separator: () => Item<I>,
    needs_sep: boolean
): Promise<B> {
    let accum = initial;

    if (!needs_sep) {
        const n = await iter.next();
        if (!n.done) {
            accum = f(accum, n.value)
        } else {
            return accum
        }
    }

    return await iter.fold(accum, (accum, x) => {
        accum = f(accum, separator())
        accum = f(accum, x);
        return accum;
    })
}

function intersperse_size_hint<I extends AsyncIterator<any>>(iter: I, needs_sep: boolean): SizeHint {
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

class Intersperse<T> extends AsyncIterator<T> {
    #iter: ReturnType<AsyncIterator<T>['peekable']>;
    #separator: T;
    #needs_sep = false;
    constructor(iterable: AsyncIterator<T>, separator: T) {
        super()
        this.#iter = iterable.peekable();
        this.#separator = separator;
    }


    override into_iter(): AsyncIterator<T> {
        this.#needs_sep = false;
        this.#iter.into_iter();
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        const p = await this.#iter.peek()
        if (this.#needs_sep && !p.done) {
            this.#needs_sep = false;
            return item(this.#separator)
        } else {
            this.#needs_sep = true;
            return await this.#iter.next();
        }
    }

    override async fold<B>(initial: B, fold: (acc: B, x: T) => B): Promise<B> {
        const sep = this.#separator;
        return await intersperse_fold(this.#iter, initial, fold, () => sep as never, this.#needs_sep)
    }

    override size_hint(): [number, number] {
        return intersperse_size_hint(this.#iter, this.#needs_sep) as [number, number]
    }
}

class IntersperseWith<T> extends ExactSizeAsyncIterator<T> {
    #iter: ReturnType<AsyncIterator<T>['peekable']>;
    #gen: () => T | Promise<T>;
    #needs_sep: boolean;
    constructor(iterable: AsyncIterator<T>, gen: () => T | Promise<T>) {
        super()
        this.#iter = iterable.peekable();
        this.#gen = gen;
        this.#needs_sep = false
    }

    override into_iter(): ExactSizeAsyncIterator<T> {
        this.#iter.into_iter();
        this.#needs_sep = false
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        const p = await this.#iter.peek();
        if (this.#needs_sep && !p.done) {
            this.#needs_sep = false;
            return item(await this.#gen())
        } else {
            this.#needs_sep = true;
            return await this.#iter.next();
        }
    }

    override async fold<B>(initial: B, fold: (acc: B, x: T) => B): Promise<B> {
        return await intersperse_fold(this.#iter, initial, fold, () => this.#gen() as never, this.#needs_sep)
    }
}

class Map<A, B> extends AsyncIterator<B> {
    #callback: (value: A) => Promise<B> | B;
    #iter: AsyncIterator<A>;
    constructor(iterable: AsyncIterator<A>, callback: (value: A) => Promise<B> | B) {
        super()
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): AsyncIterator<B> {
        this.#iter.into_iter();
        return this
    }

    async next() {
        const n = await this.#iter.next();
        return !n.done ? item(await this.#callback(n.value)) : done<B>();
    }
}

class MapWhile<A, B> extends AsyncIterator<B> {
    #iter: AsyncIterator<A>
    #fn: (value: A) => Option<B>
    constructor(iterable: AsyncIterator<A>, callback: (value: A) => Option<B>) {
        super()
        this.#iter = iterable
        this.#fn = callback;
    }

    override into_iter(): AsyncIterator<B> {
        this.#iter.into_iter();
        return this
    }

    override async next(): Promise<IteratorResult<B>> {
        const n = await this.#iter.next();
        if (n.done) {
            return done();
        }
        const v = this.#fn(n.value);
        return is_some(v) ? item(v) : done();
    }
}

class Skip<T> extends AsyncIterator<T> {
    #n: number;
    #initial: number;
    #iter: AsyncIterator<T>
    constructor(iterable: AsyncIterator<T>, n: number) {
        super()
        this.#iter = iterable;
        this.#n = n;
        this.#initial = n;
    }

    override size_hint(): SizeHint<number, number> {
        return this.#iter.size_hint() as SizeHint<number, number>
    }

    override into_iter(): AsyncIterator<T> {
        this.#iter.into_iter();
        this.#n = this.#initial;
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        if (this.#n > 0) {
            const n = await this.#iter.nth(this.#n)
            this.#n = 0;
            return n;
        } else {
            return await this.#iter.next();
        }
    }

    override async advance_by(n: number): Promise<Result<Ok, NonZeroUsize>> {
        const skip_inner = this.#n;

        // saturating_add(skip_inner, n)
        const skip_and_advance = skip_inner + n;
        let remainder = await this.#iter.advance_by(skip_and_advance) as Result<number, NonZeroUsize>;
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
            const r = await this.#iter.advance_by(n);
            n = is_error(r) ? r.get() : 0
        }

        return new NonZeroUsize(n)
    }

    override nth(n: number): Promise<IteratorResult<T>> {
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

    override async count(): Promise<number> {
        if (this.#n > 0) {
            const n = await this.#iter.nth(this.#n - 1)
            if (n.done) {
                return 0
            }
        }

        return this.#iter.count();
    }

    override last(): Promise<Option<T>> {
        if (this.#n > 0) {
            this.#iter.nth(this.#n - 1);
        }

        return this.#iter.last()
    }

    override async try_fold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Promise<Result<B, Err>> {
        const n = this.#n;
        this.#n = 0;

        if (n > 0) {
            const n2 = await this.#iter.nth(n - 1)
            if (n2.done) {
                return initial as Result<B, Err>;
            }
        }

        return await this.#iter.try_fold(initial, fold)
    }

    override async fold<B>(initial: B, fold: (acc: B, x: T) => B): Promise<B> {
        if (this.#n > 0) {
            const n = await this.#iter.nth(this.#n - 1)
            if (n.done) {
                return initial
            }
        }
        return await this.#iter.fold(initial, fold)
    }
}

class SkipWhile<T> extends AsyncIterator<T> {
    #iter: AsyncIterator<T>;
    #predicate: (value: T) => boolean;
    #needs_skip: boolean;
    constructor(iter: AsyncIterator<T>, predicate: (value: T) => boolean) {
        super()
        this.#iter = iter;
        this.#predicate = predicate;
        this.#needs_skip = true;
    }

    override async next(): Promise<IteratorResult<T>> {
        if (!this.#needs_skip) {
            return await this.#iter.next()
        } else {
            let n;
            while (true) {
                n = await this.#iter.next();
                if (n.done) {
                    return done();
                }
                if (this.#predicate(n.value)) {
                    return n;
                }
            }
        }
    }

    override into_iter(): AsyncIterator<T> {
        this.#needs_skip = true
        this.#iter.into_iter();
        return this
    }
}

class StepBy<T> extends AsyncIterator<T> {
    #iter: AsyncIterator<T>;
    #step: number;
    #first_take: boolean;
    constructor(iterable: AsyncIterator<T>, step: number) {
        super();
        this.#iter = iterable;
        this.#step = Math.max(step - 1, 0);
        this.#first_take = true;
    }

    override into_iter(): AsyncIterator<T> {
        this.#iter.into_iter();
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        const step_size = this.#first_take ? 0 : this.#step;
        this.#first_take = false;
        return await this.#iter.nth(step_size);
    }

    override size_hint(): [number, Option<number>] {
        function first_size(step: number) {
            return (n: number) => n === 0 ? 0 : Math.floor(1 + (n - 1) / (step + 1));
        }

        function other_size(step: number) {
            return (n: number) => Math.floor(n / (step + 1));
        }

        const [low, high] = this.#iter.size_hint();

        const f = this.#first_take ? first_size(this.#step) : other_size(this.#step);

        return [f(low), is_some(high) ? f(high) : null]
    }

    override async nth(n: number): Promise<IteratorResult<T>> {
        n = Math.floor(n);

        if (this.#first_take) {
            this.#first_take = false;
            const first = await this.#iter.next();
            if (n === 0) {
                return first;
            }
            n--;
        }
        let step = this.#step + 1;

        if (n === Number.MAX_SAFE_INTEGER) {
            return await this.#iter.nth(step - 1)
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

            return await this.#iter.nth(nth - 1)
        }
    }

    override async fold<B>(initial: B, fold: (acc: B, x: T) => B): Promise<B> {
        function nth(iter: AsyncIterator<T>, step: number) {
            return async () => await iter.nth(step);
        }

        if (this.#first_take) {
            this.#first_take = false;
            const n = await this.#iter.next();
            if (n.done) {
                return initial;
            } else {
                initial = fold(initial, n.value)
            }
        }

        return await from_async_fn(nth(this.#iter, this.#step)).fold(initial, fold as any)
    }

    override async try_fold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Promise<Result<B, Err>> {
        function nth(iter: AsyncIterator<T>, step: number) {
            return async () => await iter.nth(step);
        }

        if (this.#first_take) {
            this.#first_take = false;
            const n = await this.#iter.next();
            if (n.done) {
                return initial;
            } else {
                initial = fold(initial, n.value) as B;
            }
        }
        return await from_async_fn(nth(this.#iter, this.#step)).try_fold(initial, fold as any)
    }
}

class Take<T> extends AsyncIterator<T> {
    #iter: AsyncIterator<T>;
    #n: number
    #initial: number
    constructor(iterable: AsyncIterator<T>, n: number) {
        super();
        this.#iter = iterable;
        this.#n = n;
        this.#initial = n;
    }

    override into_iter(): AsyncIterator<T> {
        this.#iter.into_iter();
        this.#n = this.#initial;
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        if (this.#n !== 0) {
            this.#n -= 1
            return await this.#iter.next();
        } else {
            return done()
        }
    }

    override async nth(n: number): Promise<IteratorResult<T>> {
        if (this.#n > n) {
            this.#n -= n + 1;
            return await this.#iter.nth(n)
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

    override async try_fold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Promise<Result<B, Err>> {
        function check(n: number, fold: (acc: B, inc: T) => Result<B, Err>): (acc: B, inc: T) => Result<B, Err> {
            return (acc, x) => {
                n -= 1;
                let r = fold(acc, x)

                return n === 0 ? new ErrorExt(r) : r
            }
        }
        if (this.#n === 0) {
            return initial as B
        } else {
            let n = this.#n;
            return await this.#iter.try_fold(initial, check(n, fold))
        }
    }

    override async advance_by(n: number): Promise<Result<Ok, NonZeroUsize>> {
        let min = Math.min(this.#n, n);
        const res = await this.#iter.advance_by(min) as Result<Ok, Err>;
        const rem = !res ? 0 : res.get()
        const advanced = min - rem;
        this.#n -= advanced;
        return non_zero_usize(n - advanced)
    }

}

class TakeWhile<T> extends AsyncIterator<T> {
    #iter: AsyncIterator<T>;
    #callback: (value: T) => boolean;
    constructor(iterable: AsyncIterator<T>, callback: (value: T) => boolean) {
        super();
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): AsyncIterator<T> {
        this.#iter.into_iter();
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        const n = await this.#iter.next();
        if (n.done) {
            return done()
        }

        if (this.#callback(n.value)) {
            return n
        }

        return done();
    }
}

class Peekable<T> extends AsyncIterator<T> {
    #peeked: Option<Option<IteratorResult<T>>>;
    #iter: AsyncIterator<T>;
    constructor(iterable: AsyncIterator<T>) {
        super()
        this.#iter = iterable;
    }

    #take() {
        const peeked = this.#peeked;
        this.#peeked = null;
        return peeked;
    }

    override into_iter(): AsyncIterator<T> {
        this.#iter.into_iter();
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        const peeked = this.#take();
        if (peeked) {
            return peeked
        }
        return await this.#iter.next();
    }

    async peek(): Promise<IteratorResult<T>> {
        if (this.#peeked) {
            return this.#peeked
        }

        this.#peeked = await this.#iter.next();
        return this.#peeked;
    }

    override async count() {
        const peeked = this.#take();

        if (peeked) {
            if (peeked.done) {
                return 0;
            } else {
                const c = await this.#iter.count();
                return 1 + c;
            }
        } else {
            return await this.#iter.count();
        }
    }

    override async nth(n: number): Promise<IteratorResult<T>> {
        const peeked = this.#take();

        if (peeked && (peeked.done || n === 0)) {
            return peeked;
        }

        const iter = this.#iter;
        if (peeked) {
            return await iter.nth(n - 1)
        } else {
            return iter.nth(n)
        }
    }

    override async last(): Promise<Option<T>> {
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

    override async fold<B>(initial: B, fold: (acc: B, x: T) => B): Promise<B> {
        const peeked = this.#peeked;
        let acc = initial;

        if (peeked && !peeked.done) {
            acc = fold(initial, peeked.value)
        }

        return await this.#iter.fold(acc, fold);
    }

}

class Zip<K, V> extends AsyncIterator<[K, V]> {
    #iter: AsyncIterator<K>;
    #other: AsyncIterator<V>;

    constructor(iterable: AsyncIterator<K>, other: AsyncIteratorInputType<V>, callback: (value: V) => V | Promise<V>) {
        super()
        this.#iter = iterable;
        this.#other = async_iter(other, callback as any) as unknown as AsyncIterator<V>
    }

    override into_iter(): AsyncIterator<[K, V]> {
        this.#iter.into_iter();
        this.#other.into_iter();
        return this

    }

    override async next(): Promise<IteratorResult<[K, V]>> {
        const k = await this.#iter.next()
        const v = await this.#other.next()

        return (k.done || v.done) ? done() : item([k.value, v.value] as [K, V])
    }
}
//* --- free standing functions ---
class AsyncSuccessors<T> extends AsyncIterator<T> {
    #next: Option<T>;
    #first: Option<T>;
    #succ: (value: T) => Option<T> | Promise<Option<T>>;
    constructor(first: Option<T>, succ: (value: T) => Option<T> | Promise<Option<T>>) {
        super()
        this.#first = first;
        this.#next = first;
        this.#succ = succ;
    }

    override into_iter(): AsyncIterator<T> {
        this.#next = this.#first;
        return this;
    }

    override async next(): Promise<IteratorResult<T>> {
        const ni = this.#next
        if (!is_some(ni)) {
            return done();
        }
        const n = await this.#succ(ni);
        this.#next = n;
        return item(ni)
    }

    override size_hint(): [number, Option<number>] {
        return is_some(this.#next) ? [1, null] : [0, 0]
    }
}

export async function async_successors<T>(first: Option<T>, succ: (value: T) => Option<T> | Promise<Option<T>>) {
    return new AsyncSuccessors(first, succ)
}

class AsyncFromFn<T> extends AsyncIterator<T> {
    #fn: () => Promise<Option<T>> | Option<T>;
    constructor(fn: () => Promise<Option<T>> | Option<T>) {
        super()
        this.#fn = fn;
    }

    override into_iter(): AsyncIterator<T> {
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        const n = await this.#fn();
        return is_some(n) ? item(n) : done();
    }
}

export function from_async_fn<T>(f: () => Promise<Option<T>> | Option<T>): AsyncFromFn<T> {
    return new AsyncFromFn(f)
}

// //* --- common Iterators
export class AsyncGenerator<T> extends AsyncIterator<T> {
    #callback: (value: T) => T | Promise<T>;
    #iter: AsyncGenerator<T>;
    #into_iter: () => AsyncGenerator<T>;
    constructor(into_iter: () => AsyncGenerator<T>, callback: (value: T) => T | Promise<T>) {
        super();
        this.#callback = callback;
        this.#into_iter = into_iter;
        const it = into_iter();
        if (!it[Symbol.asyncIterator]) {
            console.log('no async iterator found on %O', it, typeof it);


        }
        this.#iter = it
    }

    override into_iter(): AsyncIterator<T> {
        this.#iter = this.#into_iter();
        return this;
    }

    override async next(): Promise<IteratorResult<T, any>> {
        const n = await this.#iter.next();
        return n.done ? done() : item(await this.#callback(n.value))
    }
}

export function from_iter<T>(into_iter: () => AsyncGenerator<T>, callback: (value: T) => T | Promise<T>) {
    function impl() {
        const it = into_iter()
        return async () => {
            const n = await it.next();
            return n.done ? done() : await callback(n.value)
        }
    }
    return from_async_fn(impl())
}
