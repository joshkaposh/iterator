import { iter } from ".";
import * as Intrinsics from "../intrinsics";
import { Err, Ok, Option, Result, is_error, is_some } from "../option";
import { MustReturn, TODO } from "../util";
import { Collection, ErrorExt, FoldFn, IterResult, NonZeroUsize, collect, done, iter_item, non_zero_usize, unzip } from "./shared";

export type Item<It> =
    It extends Iterable<infer T> ? T :
    It extends Iterator<infer T> ? T :
    never;

export interface Iterator<T> {
    advance_by(n: number): Result<Ok, NonZeroUsize>
}
export abstract class Iterator<T> {
    abstract next(): IterResult<T>;
    into_iter(): Iterator<T> {
        return this
    }

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

    chain<O extends Iterator<any>>(other: O): Iterator<T | Item<O>> {
        return new Chain(this, other)
    }

    collect(into?: undefined): T[];
    collect<I extends (new (...args: any[]) => any) & { from(iter: Iterator<T>): any }>(into: I): ReturnType<I['from']>
    collect<I extends (new (...args: any[]) => any) & { from(iter: Iterator<T>): any }>(into?: I): Collection<I> | T[] {
        return collect(this, into as I)
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

    enumerate(): Iterator<[number, T]> {
        return new Enumerate(this)
    }

    eq<It extends IterableIterator<any>>(other: It) {
        for (const val of other) {
            const n = this.next()
            if (n.value !== val) {
                return false
            }
        }
        return true
    }

    filter(callback: (value: T) => boolean): Iterator<T> {
        return new Filter(this, callback)
    }

    flatten<O extends T extends Iterable<infer T2> ? T2 : never>(): Iterator<O> {
        return new Flatten(this as any)
    }

    find(predicate: (value: T) => boolean): Option<T> {
        let n;
        while (!(n = this.next()).done) {
            if (predicate(n.value)) {
                return n.value;
            }
        }
        return null;
    }

    fold<B>(initial: B, fold: FoldFn<T, B>) {
        let acc = initial;
        let next;
        while (!(next = this.next()).done) {
            acc = fold(acc, next.value)
        }

        return acc;
    }

    for_each(callback: (value: T) => void) {
        for (const item of this.into_iter()) {
            callback(item);
        }
    }

    fuse(): Iterator<T> {
        return new FusedIterator(this);
    }

    inspect(callback: (value: T) => void): Iterator<T> {
        return new Inspect(this, callback)
    }

    intersperse(separator: T): Iterator<T> {
        return new Intersperse(this, separator);
    }

    intersperse_with(generator: () => T): Iterator<T> {
        return new IntersperseWith(this, generator)
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
    max(): number {
        return Math.max(...this as Iterable<number>)
    }
    //! Caller must ensure T = number
    min(): number {
        return Math.min(...this as Iterable<number>)
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

    peekable(): Iterator<T> & { peek: () => IterResult<T>; } {
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

    step_by(n: number): Iterator<T> {
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
        return unzip(this as IterableIterator<[K, V]>)
    }

    zip<V>(other: Iterator<V>): Iterator<[T, V]> {
        return new Zip(this, other)
    }

    [Symbol.iterator]() {
        return this;
    }
}

export interface ExactSizeIterator<T> {
    size_hint(): Intrinsics.SizeHint<number, number>
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

    override next(): IterResult<T> {
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

class Chain<T1, T2> extends Iterator<T1 | T2> {
    #iter: Iterator<T1>
    #other: Iterator<T2>
    constructor(iterable: Iterator<T1>, other: Iterator<T2>) {
        super()
        this.#iter = iterable;
        this.#other = other;
    }

    override into_iter(): Iterator<T1 | T2> {
        this.#iter.into_iter();
        this.#other.into_iter()
        return this
    }

    override next(): IterResult<T1 | T2> {
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

    override next(): IterResult<T> {
        const n = this.#iter.next();
        if (!n.done) {
            return n;
        }

        this.into_iter();
        return this.#iter.next();
    }

}

class Enumerate<T> extends Iterator<[number, T]> {
    #index = -1;
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>) {
        super()
        this.#iter = iterable;
    }

    override into_iter(): Iterator<[number, T]> {
        this.#iter.into_iter()
        return this
    }

    next() {
        this.#index++;
        const n = this.#iter.next();
        return !n.done ? iter_item([this.#index, n.value] as [number, T]) : done<[number, T]>()
    }
}

class Filter<T> extends Iterator<T> {
    #callback: (value: T) => boolean;
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>, callback: (value: T) => boolean) {
        super()
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): Iterator<T> {
        this.#iter.into_iter()
        return this
    }

    override next(): IterResult<T> {
        let n;
        while (!(n = this.#iter.next()).done) {
            if (n.done) {
                return done()
            }

            if (this.#callback(n.value)) {
                return n
            }
        }
        return done()
    }
}

class Flatten<T> extends Iterator<T> {
    #outter: Iterator<Iterator<T>>;
    #inner: Option<Iterator<T>>;
    constructor(iterable: Iterator<Iterator<T>>) {
        super()
        this.#outter = iterable;
    }

    override into_iter(): Iterator<T> {
        return this;
    }

    #next_loop(): IterResult<T> {

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
                return this.#inner.next()
            }

        } else {
            return n
        }
    }

    override next(): IterResult<T> {
        if (!this.#inner) {
            const n = this.#outter.next().value;
            if (!n) {
                return done()
            }
            this.#inner = iter(n);
        }

        return this.#next_loop()
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
        this.#iter.into_iter()
        return this
    }

    override next(): IterResult<T> {
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

function intersperse_size_hint<I extends Iterator<any>>(iter: I, needs_sep: boolean): Intrinsics.SizeHint {
    let [lo, hi] = iter.size_hint();
    const next_is_elem = !needs_sep;
    const next_is_elem_int = next_is_elem ? 1 : 0;
    lo = Intrinsics.saturating_add(Intrinsics.saturating_sub(lo, next_is_elem_int, 'usize'), lo, 'usize')
    if (is_some(hi)) {
        hi = Intrinsics.checked_add(Intrinsics.saturating_sub(hi, next_is_elem_int, 'usize'), hi, 'usize')
    }
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
        return this;
    }

    override next(): IterResult<T> {
        if (this.#needs_sep && !this.#iter.peek().done) {
            this.#needs_sep = false;
            return iter_item(this.#separator)
        } else {
            this.#needs_sep = true;
            return this.#iter.next();
        }
    }

    override fold<B>(initial: B, fold: FoldFn<T, B>): B {
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
        return this;
    }

    override next(): IterResult<T> {
        if (this.#needs_sep && !this.#iter.peek().done) {
            this.#needs_sep = false;
            return iter_item(this.#gen())
        } else {
            this.#needs_sep = true;
            return this.#iter.next();
        }
    }

    override fold<B>(initial: B, fold: FoldFn<T, B>): B {
        return intersperse_fold(this.#iter, initial, fold, () => this.#gen(), this.#needs_sep)
    }
}

class Map<A, B> extends Iterator<B> {
    #callback: MustReturn<(value: A) => B>;
    #iter: Iterator<A>;
    constructor(iterable: Iterator<A>, callback: MustReturn<(value: A) => B>) {
        super()
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): Iterator<B> {
        this.#iter.into_iter()
        return this
    }

    next() {
        const n = this.#iter.next();
        return !n.done ? iter_item(this.#callback(n.value)) : done<B>();
    }
}

class MapWhile<A, B> extends Iterator<B> {
    #iter: Iterator<A>
    #fn: MustReturn<(value: A) => Option<B>>
    constructor(iterable: Iterator<A>, callback: MustReturn<(value: A) => Option<B>>) {
        super()
        this.#iter = iterable
        this.#fn = callback;
    }
    override next(): IterResult<B> {
        const n = this.#iter.next();
        if (n.done) {
            return done();
        }
        const v = this.#fn(n.value);
        return is_some(v) ? iter_item(v) : done();
    }
}

class Skip<T> extends Iterator<T> {
    #n: number;
    #iter: Iterator<T>
    constructor(iterable: Iterator<T>, n: number) {
        super()
        this.#iter = iterable;
        this.#n = n;
    }

    override size_hint(): Intrinsics.SizeHint<number, number> {
        return this.#iter.size_hint() as Intrinsics.SizeHint<number, number>
    }

    override into_iter(): Iterator<T> {
        this.#iter.into_iter();
        return this
    }

    override next(): IterResult<T> {
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

    override nth(n: number): IterResult<T> {
        if (this.#n > 0) {
            const skip = this.#n;
            this.#n = 0;

            n = Intrinsics.usize.checked_add(skip, n)!
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

    override fold<B>(initial: B, fold: FoldFn<T, B>): B {
        if (this.#n > 0) {
            if (this.#iter.nth(this.#n - 1).done) {
                return initial
            }
        }
        return this.#iter.fold(initial, fold)
    }
}

class SkipWhile<T> extends Iterator<T> {
    override next(): IterResult<T> {
        return TODO();
    }
}

class StepBy<T> extends Iterator<T> {
    #iter: Iterator<T>;
    #step: number
    constructor(iterable: Iterator<T>, step: number) {
        super();
        this.#iter = iterable;
        this.#step = step;
    }

    override into_iter(): Iterator<T> {
        return this;
    }
    override next(): IterResult<T> {
        for (let i = 0; i < this.#step; i++) {
            this.#iter.next()
        }
        return this.#iter.next();
    }
}

class Successors<T> extends Iterator<T> {
    #next: Option<T>;
    #succ: (value: T) => Option<T>;
    constructor(first: Option<T>, succ: (value: T) => Option<T>) {
        super()
        this.#next = first;
        this.#succ = succ;

    }

    override next(): IterResult<T> {
        const item = this.#next
        if (!is_some(item)) {
            return done();
        }
        const n = this.#succ(item)
        this.#next = n;
        return iter_item(item)
    }

    override into_iter(): Iterator<T> {
        return this;
    }

    override size_hint(): [number, Option<number>] {
        return is_some(this.#next) ? [1, null] : [0, 0]
    }
}

export function successors<T>(first: T, succ: (value: T) => Option<T>) {
    return new Successors(first, succ)
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
        this.#iter.into_iter()
        return this
    }

    override next(): IterResult<T> {
        if (this.#n !== 0) {
            this.#n -= 1
            return this.#iter.next();
        } else {
            return done()
        }
    }

    override nth(n: number): IterResult<T> {
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
    #callback: (value: T) => boolean;
    constructor(iterable: Iterator<T>, callback: (value: T) => boolean) {
        super();
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): Iterator<T> {
        this.#iter.into_iter()
        return this
    }

    override next(): IterResult<T> {
        const n = this.#iter.next();
        if (n.done) {
            return done()
        }

        if (this.#callback(n.value)) {
            return n
        }

        return done();
    }
}

class Peekable<T> extends Iterator<T> {
    #peeked: Option<Option<IterResult<T>>>;
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
        this.#iter.into_iter()
        return this
    }

    override next(): IterResult<T> {
        const peeked = this.#take();
        return peeked ? peeked : this.#iter.next();
    }

    peek(): IterResult<T> {
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

    override nth(n: number): IterResult<T> {
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

    override fold<B>(initial: B, fold: FoldFn<T, B>): B {
        const peeked = this.#peeked;
        let acc = initial;

        if (peeked && !peeked.done) {
            acc = fold(initial, peeked.value)
        }

        return this.#iter.fold(acc, fold);
    }

}

class Zip<K, V> extends Iterator<[K, V]> {
    #iter: Iterator<K>;
    #other: Iterator<V>;

    constructor(iterable: Iterator<K>, other: Iterator<V>) {
        super()
        this.#iter = iterable;
        this.#other = other;
    }

    override into_iter(): Iterator<[K, V]> {
        this.#iter.into_iter();
        this.#other.into_iter();
        return this;
    }

    override next(): IterResult<[K, V]> {
        const k = this.#iter.next()
        const v = this.#other.next()

        return (k.done || v.done) ? done<[K, V]>() : iter_item([k.value, v.value])
    }
}