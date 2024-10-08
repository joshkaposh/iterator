import { assert } from "../util";
import { Option, Err, Result, Ok, is_error, is_some, ErrorExt } from "joshkaposh-option";
import { Iterator, from_fn } from './iterator'
import type { DoubleEndedIteratorInputType, Item, SizeHint, ArrayLikeType } from '../types'
import { done, NonZeroUsize, non_zero_usize, map_next } from "../shared";
import { iter } from ".";

type FlatType<T> = DoubleEndedIterator<DoubleEndedIterator<T>>;

export interface DoubleEndedIterator<T> {
    enumerate(): ExactSizeDoubleEndedIterator<[number, T]>
    peekable(): DoubleEndedIterator<T> & { peek(): IteratorResult<T> }
    advance_back_by(n: number): Result<Ok<undefined>, NonZeroUsize>
    chain<O extends DoubleEndedIterator<any>>(other: O): DoubleEndedIterator<T | Item<O>>;
    zip<V>(other: any): DoubleEndedIterator<[T, V]>
    into_iter(): DoubleEndedIterator<T>;
    flat_map<O extends T extends Iterable<infer T2> ? T2 : never, B>(f: (value: O) => B): DoubleEndedIterator<B>;
}
export abstract class DoubleEndedIterator<T> extends Iterator<T> {
    abstract next_back(): IteratorResult<T>;

    advance_back_by(n: number): Result<Ok, NonZeroUsize> {
        for (let i = 0; i < n; i++) {
            if (this.next_back().done) {
                return new NonZeroUsize(n - i);
            }
        }
        return
    }

    override chain<O extends DoubleEndedIteratorInputType<T>>(other: O): DoubleEndedIterator<T> {
        return new Chain(this, other)
    }

    override cycle(): DoubleEndedIterator<T> {
        return new Cycle(this)
    }

    override enumerate(): ExactSizeDoubleEndedIterator<[number, T]> {
        return new Enumerate(this);
    }

    override filter(callback: (value: T) => boolean): DoubleEndedIterator<T> {
        return new Filter(this, callback);
    }

    override filter_map<B>(callback: (value: T) => Option<B>): DoubleEndedIterator<B> {
        return new FilterMap(this, callback);
    }

    override flatten(): DoubleEndedIterator<T> {
        return new Flatten(this as FlatType<T>)
    }

    override flat_map<B extends DoubleEndedIterator<any>>(f: (value: T) => Option<B>): DoubleEndedIterator<Item<B>> {
        return new FlatMap(this as any, f)
    }

    override fuse(): DoubleEndedIterator<T> {
        return new FusedDoubleEndedIterator(this)
    }

    override inspect(callback: (value: T) => void): DoubleEndedIterator<T> {
        return new Inspect(this, callback)
    }

    override map<B>(f: (value: T) => B): DoubleEndedIterator<B> {
        return new Map(this, f)
    }

    override map_while<B>(f: (value: T) => Option<B>): DoubleEndedIterator<B> {
        return new MapWhile(this, f);
    }

    nth_back(n: number): IteratorResult<T> {
        this.advance_back_by(n);
        return this.next_back();
    }
    override peekable(): DoubleEndedIterator<T> & { peek: () => IteratorResult<T>; } {
        return new Peekable(this)
    }

    rev(): DoubleEndedIterator<T> {
        return new Rev(this)
    }

    rfind(predicate: (value: T) => boolean): Option<T> {
        let n;
        while (!(n = this.next_back()).done) {
            if (predicate(n.value)) {
                return n.value;
            }
        }
        return null;
    }

    rfind_map<B>(callback: (value: T) => Option<B>) {
        let n;
        while (!(n = this.next_back()).done) {
            const elt = callback(n.value);
            if (is_some(elt)) {
                return elt
            }
        }
        return
    }

    /**
     * @description
     * rfold() takes two arguments, an initial B and a folder (acc: B, element: T) => B.
     * 
     * rfold() will take an Iterator and reduce it down to a single value, starting from the right.
     * 
     * Each iteration rfold() will call the folder(), with folder()'s return value being the next value the folder() receives on the next iteration.
     */
    rfold<B>(initial: B, fold: (acc: B, x: T) => B) {
        let acc = initial;
        let next;
        while (!(next = this.next_back()).done) {
            acc = fold(acc, next.value)
        }

        return acc;
    }

    override skip(n: number): ExactSizeDoubleEndedIterator<T> {
        return new Skip(this, n)
    }

    override skip_while(predicate: (value: T) => boolean): DoubleEndedIterator<T> {
        return new SkipWhile(this, predicate)
    }

    override take(n: number): DoubleEndedIterator<T> {
        return new Take(this as unknown as ExactSizeDoubleEndedIterator<T>, n);
    }

    override take_while(callback: (value: T) => boolean): DoubleEndedIterator<T> {
        return new TakeWhile(this, callback)
    }

    try_rfold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Result<B, Err> {
        let acc = initial;
        let next;
        while (!(next = this.next_back()).done) {
            const val = fold(acc, next.value);
            acc = val as unknown as B
            if (is_error(val)) {
                break;
            }
        }
        return acc as Result<B, Err>;
    }

    override zip<V>(other: DoubleEndedIteratorInputType<V>): DoubleEndedIterator<[T, V]> {
        return new Zip(this, other)
    }
}

export interface ExactSizeDoubleEndedIterator<T> {
    size_hint(): SizeHint<number, number>;
    rev(): ExactSizeDoubleEndedIterator<T>;
    step_by(n: number): ExactSizeDoubleEndedIterator<T>;
    into_iter(): ExactSizeDoubleEndedIterator<T>;
}
export abstract class ExactSizeDoubleEndedIterator<T> extends DoubleEndedIterator<T> {
    len(): number {
        return this.size_hint()[1];
    }
    is_empty(): boolean {
        return this.len() === 0;
    }

    rposition(predicate: (value: T) => boolean): Option<number> {
        let index = this.len();

        const found = this.rfind((v) => {
            index -= 1;
            return predicate(v)
        })
        return found ? index : null
    }

    override step_by(n: number): ExactSizeDoubleEndedIterator<T> {
        return new StepBy(this, n);
    }
}

export class FusedDoubleEndedIterator<T> extends DoubleEndedIterator<T> {
    #done = false;
    #iter: Iterator<T>;
    constructor(iterable: Iterator<T>) {
        super();
        this.#iter = iterable;
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

    override next_back(): IteratorResult<T> {
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

// * --- Adapters ---

class Chain<T> extends DoubleEndedIterator<T> {
    #iter: DoubleEndedIterator<T>
    #other: DoubleEndedIterator<T>

    constructor(iterable: DoubleEndedIterator<T>, other: DoubleEndedIteratorInputType<T>) {
        super()
        this.#iter = iterable;
        this.#other = iter(other) as DoubleEndedIterator<T>;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iter.into_iter();
        this.#other.into_iter()
        return this
    }

    override next(): IteratorResult<T> {
        const n = this.#iter.next();
        return !n.done ? n : this.#other.next();
    }

    override next_back(): IteratorResult<T> {
        const n = this.#other.next_back();
        return !n.done ? n : this.#iter.next_back();
    }
}

class Cycle<T> extends DoubleEndedIterator<T> {
    #iter: DoubleEndedIterator<T>;
    constructor(iterable: DoubleEndedIterator<T>) {
        super();
        this.#iter = iterable;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iter.into_iter()
        return this
    }

    override next(): IteratorResult<T> {
        const n = this.#iter.next();
        if (!n.done) {
            return n;

        }

        this.into_iter();
        return this.#iter.next();
    }

    override next_back(): IteratorResult<T> {
        const n = this.#iter.next_back();
        if (!n.done) {
            return n;

        }

        this.#iter.into_iter();
        return this.#iter.next_back();
    }
}

class Enumerate<T> extends ExactSizeDoubleEndedIterator<[number, T]> {
    #index = -1;
    #iter: DoubleEndedIterator<T>;
    constructor(iterable: DoubleEndedIterator<T>) {
        super();
        this.#iter = iterable;
    }

    override into_iter(): ExactSizeDoubleEndedIterator<[number, T]> {
        this.#iter.into_iter();
        this.#index = -1;
        return this
    }

    next(): IteratorResult<[number, T]> {
        this.#index++;
        const n = this.#iter.next();
        return map_next(n, (v) => [this.#index, v])
    }

    next_back(): IteratorResult<[number, T]> {
        this.#index++;
        const n = this.#iter.next_back();
        return map_next(n, (v) => [this.#index, v])
    }

}

class Filter<T> extends DoubleEndedIterator<T> {
    #callback: (value: T) => boolean;
    #iter: DoubleEndedIterator<T>;
    constructor(iterable: DoubleEndedIterator<T>, callback: (value: T) => boolean) {
        super()
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iter.into_iter()
        return this
    }

    override size_hint(): [number, Option<number>] {
        return this.#iter.size_hint();
    }

    override next(): IteratorResult<T> {
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

    override next_back(): IteratorResult<T> {
        let n;
        while (!(n = this.#iter.next_back()).done) {
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

class FilterMap<A, B> extends DoubleEndedIterator<B> {
    #iter: DoubleEndedIterator<A>;
    #fn: (value: A) => Option<B>;

    constructor(iter: DoubleEndedIterator<A>, fn: (value: A) => Option<B>) {
        super();
        this.#iter = iter
        this.#fn = fn;
    }

    override into_iter(): DoubleEndedIterator<B> {
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

    override next_back(): IteratorResult<B> {
        let n;
        while (!(n = this.#iter.next_back()).done) {
            const elt = this.#fn(n.value);
            if (is_some(elt)) {
                return { done: false, value: elt }
            }
        }
        return done()
    }
}

class Flatten<T> extends DoubleEndedIterator<T> {
    #outter: FlatType<T>;
    #frontiter: Option<DoubleEndedIterator<T>>;
    #backiter: Option<DoubleEndedIterator<T>>;

    constructor(iterable: FlatType<T>) {
        super()
        this.#outter = iterable;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#outter.into_iter();
        return this;
    }

    override next(): IteratorResult<T> {
        if (!this.#frontiter) {
            const n = this.#outter.next().value;

            if (!n) {
                return this.#backiter ? this.#backiter.next() : done()
            }

            this.#frontiter = iter(n) as DoubleEndedIterator<T>;
        }

        const n = this.#front_loop(this.#frontiter);

        if (n.done) {
            if (this.#backiter) {
                return this.#front_loop(this.#backiter)
            } else {
                return done()
            }
        }

        return n
    }

    override next_back(): IteratorResult<T> {
        if (!this.#backiter) {

            const n = this.#outter.next_back().value;
            if (!n) {
                return this.#frontiter ? this.#frontiter.next_back() : done()
            }
            this.#backiter = iter(n) as DoubleEndedIterator<T>;
        }

        const n = this.#back_loop(this.#backiter);

        if (n.done) {
            if (this.#frontiter) {
                return this.#back_loop(this.#frontiter)
            } else {
                return done()
            }
        }

        return n
    }

    #front_loop(it: DoubleEndedIterator<T>): IteratorResult<T> {
        let n = it.next();

        if (n.done) {
            // advance outter
            const outter = this.#outter.next();
            if (outter.done) {
                // outter is done
                return done();
            } else {
                it = iter(outter.value) as DoubleEndedIterator<T>;
                // just advanced outter, so return new n;
                this.#frontiter = it;
                return it.next()
            }

        } else {
            return n
        }
    }

    #back_loop(it: DoubleEndedIterator<T>): IteratorResult<T> {

        let n = it.next_back();

        if (n.done) {
            // advance outter
            const outter = this.#outter.next_back();
            if (outter.done) {
                // outter is done
                return done();
            } else {
                // just advanced outter, so return new n;
                this.#backiter = iter(outter.value) as DoubleEndedIterator<T>;
                return this.#backiter.next_back()
            }

        } else {
            return n
        }
    }
}

class FlatMap<A, B extends DoubleEndedIterator<any>> extends DoubleEndedIterator<Item<B>> {
    #inner: Option<B>;
    #iter: DoubleEndedIterator<A>;
    #fn: (value: A) => Option<B>
    constructor(it: DoubleEndedIterator<A>, f: (value: A) => Option<B>) {
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

    #next_back_loop() {
        // ! Safety: next_back() just initialized inner;
        const n = this.#inner!.next_back();
        if (n.done) {
            this.#inner = null;
            return this.next_back();
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

    override next_back(): IteratorResult<Item<B>> {
        if (!this.#inner) {
            // check outter
            const n = this.#iter.next_back();
            if (n.done) {
                return done()
            };

            const inner = this.#fn(n.value);
            if (!is_some(inner)) {
                return done();
            }

            this.#inner = iter(inner) as any;
        }

        return this.#next_back_loop();
    }

    override into_iter(): DoubleEndedIterator<Item<B>> {
        this.#iter.into_iter();
        this.#inner = null;
        return this
    }
}

class Inspect<T> extends DoubleEndedIterator<T> {
    #callback: (value: T) => void;
    #iter: DoubleEndedIterator<T>;
    constructor(iterable: DoubleEndedIterator<T>, callback: (value: T) => void) {
        super()
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iter.into_iter()
        return this
    }

    override next(): IteratorResult<T> {
        const n = this.#iter.next();
        this.#callback(n.value);
        return n;
    }

    override next_back(): IteratorResult<T> {
        const n = this.#iter.next_back();
        this.#callback(n.value);
        return n;
    }
}

class Map<A, B> extends DoubleEndedIterator<B> {
    #callback: (value: A) => B;
    #iter: DoubleEndedIterator<A>;
    constructor(iterable: DoubleEndedIterator<A>, callback: (value: A) => B) {
        super()
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): DoubleEndedIterator<B> {
        this.#iter.into_iter();
        return this
    }

    next() {
        return map_next(this.#iter.next(), v => this.#callback(v));
    }

    next_back() {
        return map_next(this.#iter.next_back(), v => this.#callback(v));
    }
}

class MapWhile<A, B> extends DoubleEndedIterator<B> {
    #iter: DoubleEndedIterator<A>
    #fn: (value: A) => Option<B>
    constructor(iterable: DoubleEndedIterator<A>, callback: (value: A) => Option<B>) {
        super()
        this.#iter = iterable
        this.#fn = callback;
    }

    override next(): IteratorResult<B> {
        const n = this.#iter.next();
        if (n.done) {
            return done();
        }
        const v = this.#fn(n.value);
        return is_some(v) ? { done: false, value: v } : done();
    }

    override next_back(): IteratorResult<B> {
        const n = this.#iter.next_back();
        if (n.done) {
            return done();
        }
        const v = this.#fn(n.value);
        return is_some(v) ? { done: false, value: v } : done();
    }

}

class Rev<T> extends DoubleEndedIterator<T> {
    #iter: DoubleEndedIterator<T>;
    constructor(iterable: DoubleEndedIterator<T>) {
        super();
        this.#iter = iterable;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iter.into_iter()
        return this
    }

    next() {
        return this.#iter.next_back()
    }

    next_back() {
        return this.#iter.next();
    }
}

class Skip<T> extends ExactSizeDoubleEndedIterator<T> {
    #n: number;
    #iter: DoubleEndedIterator<T>
    constructor(iterable: DoubleEndedIterator<T>, n: number) {
        super()
        this.#iter = iterable;
        this.#n = n;
    }

    override size_hint(): SizeHint<number, number> {
        return this.#iter.size_hint() as SizeHint<number, number>
    }

    override into_iter(): ExactSizeDoubleEndedIterator<T> {
        this.#iter.into_iter()
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

    override next_back(): IteratorResult<T> {
        return this.len() > 0 ? this.#iter.next_back() : done();
    }

    override nth_back(n: number): IteratorResult<T> {
        const len = this.len();
        if (n < len) {
            return this.#iter.nth_back(n)
        } else {
            if (len > 0) {
                return this.#iter.nth_back(len - 1)
            }
            return done();
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

    override advance_back_by(n: number): Result<Ok, NonZeroUsize> {
        const min = Math.min(this.len(), n);
        const rem = this.#iter.advance_back_by(min);
        assert(!rem);
        return non_zero_usize(n - min);
    }

    override nth(n: number): IteratorResult<T> {
        if (this.#n > 0) {
            const skip = this.#n;
            this.#n = 0;

            n = skip + n;
            // TODO: perform checked_add<usize>(skip + n)
            // TODO: when overflow, return this.iterable.nth(skip - 1)
            /*
            let steps = checked_add(skip, n);
                if(!is_some(steps)) {
                    this.iterable.nth(skip - 1)
                }
            */
            return this.#iter.nth(n)
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

    override try_rfold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Result<B, Err> {
        function check(n: number, fold: (acc: B, inc: T) => Result<B, Err>): (acc: B, inc: T) => Result<B, Err> {
            return (acc, x) => {
                n -= 1;
                let r = fold(acc, x);
                if (n === 0) {
                    return new ErrorExt(r)
                }
                return r
            }
        }
        const n = this.len()
        if (n === 0) {
            return initial
        } else {
            return this.#iter.try_rfold(initial, check(n, fold))
        }

    }

    override fold<B>(initial: B, fold: (acc: B, x: T) => B): B {
        if (this.#n > 0) {
            if (this.#iter.nth(this.#n - 1).done) {
                return initial
            }
        }
        return this.#iter.fold(initial, fold)
    }

    override rfold<B>(initial: B, fold: (acc: B, x: T) => B): B {
        const f = this.try_rfold(initial, fold);
        return is_error(f) ? f.get() : f
    }
}

class SkipWhile<T> extends DoubleEndedIterator<T> {
    #iter: DoubleEndedIterator<T>;
    #predicate: (value: T) => boolean
    #needs_skip: boolean;
    constructor(iter: DoubleEndedIterator<T>, predicate: (value: T) => boolean) {
        super();
        this.#iter = iter;
        this.#predicate = predicate;
        this.#needs_skip = true;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iter.into_iter();
        this.#needs_skip = true;
        return this;
    }

    // @ts-expect-error
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
        }
    }

    // @ts-expect-error
    override next_back(): IteratorResult<T> {
        if (!this.#needs_skip) {
            return this.#iter.next_back()
        } else {
            let n;
            while (!(n = this.#iter.next_back()).done) {
                if (this.#predicate(n.value)) {
                    return n;
                }
            }
        }
    }
}

class StepBy<T> extends ExactSizeDoubleEndedIterator<T> {
    #iter: ExactSizeDoubleEndedIterator<T>;
    #step: number;
    #first_take: boolean;
    constructor(iter: ExactSizeDoubleEndedIterator<T>, step: number) {
        super();
        this.#iter = iter;
        this.#step = Math.max(step - 1, 0);
        this.#first_take = true;
    }

    override into_iter(): ExactSizeDoubleEndedIterator<T> {
        this.#iter.into_iter();
        return this;
    }

    override next(): IteratorResult<T> {
        const step_size = this.#first_take ? 0 : this.#step;
        this.#first_take = false;
        return this.#iter.nth(step_size);
    }

    override next_back(): IteratorResult<T> {
        return this.#iter.nth_back(this.#next_back_index());
    }

    #next_back_index() {
        const rem = Math.floor(this.#iter.len() % (this.#step + 1));
        if (this.#first_take) {
            return rem === 0 ? this.#step : rem - 1
        } else {
            return rem;
        }
    }

    override size_hint(): [number, number] {
        function first_size(step: number) {
            return (n: number) => n === 0 ? 0 : Math.floor(1 + (n - 1) / (step + 1));
        }

        function other_size(step: number) {
            return (n: number) => Math.floor(n / (step + 1));
        }

        const [low, high] = this.#iter.size_hint();
        assert(is_some(high))

        const f = this.#first_take ? first_size(this.#step) : other_size(this.#step);
        return [f(low), f(high!)]
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

    override nth_back(n: number): IteratorResult<T> {
        // n = n.saturating_mul(self.step + 1).saturating_add(self.next_back_index());
        n = (n * (this.#step + 1)) + this.#next_back_index();
        return this.#iter.nth_back(n)
    }

    override fold<B>(initial: B, fold: (acc: B, x: T) => B): B {
        function nth(iter: ExactSizeDoubleEndedIterator<T>, step: number) {
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

    override rfold<B>(initial: B, fold: (acc: B, x: T) => B): B {
        function nth_back(iter: ExactSizeDoubleEndedIterator<T>, step: number) {
            return () => iter.nth_back(step)
        }

        const n = this.next_back();
        if (n.done) {
            return initial;
        } else {
            let acc = fold(initial, n.value);
            return from_fn(nth_back(this.#iter, this.#step)).fold(acc, fold as any)
        }
    }

    override try_fold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Result<B, Err> {
        function nth(iter: ExactSizeDoubleEndedIterator<T>, step: number) {
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

    override try_rfold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Result<B, Err> {
        function nth_back(iter: ExactSizeDoubleEndedIterator<T>, step: number) {
            return () => iter.nth_back(step)
        }

        const n = this.next_back();
        if (n.done) {
            return initial;
        } else {
            let acc = fold(initial, n.value);
            return from_fn(nth_back(this.#iter, this.#step)).try_fold(acc as any, fold as any)
        }
    }
}

class Take<T> extends DoubleEndedIterator<T> {
    #iter: ExactSizeDoubleEndedIterator<T>;
    #start: number;
    #n: number
    constructor(iterable: ExactSizeDoubleEndedIterator<T>, n: number) {
        super();
        this.#iter = iterable;
        this.#start = n;
        this.#n = n;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#n = this.#start;
        this.#iter.into_iter();
        return this;
    }

    override next(): IteratorResult<T> {
        if (this.#n !== 0) {
            this.#n -= 1
            return this.#iter.next();
        } else {
            return done()
        }
    }

    override next_back(): IteratorResult<T> {
        if (this.#n === 0) {
            return done()
        } else {
            let n = this.#n;
            this.#n -= 1
            return this.#iter.nth_back(this.#iter.len() - n)
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

    override advance_back_by(n: number): Result<Ok, NonZeroUsize> {
        // const trim_inner = usize.saturating_sub(this.#iter.len(), this.#n);
        // let advance_by = usize.saturating_add(trim_inner, n);
        const trim_inner = this.#iter.len() + this.#n;
        let advance_by = trim_inner + n;
        const result = this.#iter.advance_back_by(advance_by);
        const remainder = is_error(result) ? result.get() : 0;

        const advance_by_inner = advance_by - remainder;
        advance_by = advance_by_inner - trim_inner;
        this.#n -= advance_by;
        return non_zero_usize(n - advance_by);
    }



    override nth_back(n: number): IteratorResult<T> {
        const len = this.#iter.len();
        if (this.#n < n) {
            // let m = usize.saturating_sub(len, this.#n) + n;
            let m = len + this.#n + n;

            this.#n -= n + 1;
            return this.#iter.nth_back(m);
        } else {
            if (len > 0) {
                return this.#iter.nth_back(len - 1)
            }
            return done()
        }
    }

    override try_rfold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Result<B, Err> {
        if (this.#n === 0) {
            return initial
        } else {
            const len = this.#iter.len();
            if (len > this.#n && this.#iter.nth_back(len - this.#n - 1).done) {
                return initial
            } else {
                return this.#iter.try_rfold(initial, fold)
            }
        }
    }

    override rfold<B>(initial: B, fold: (acc: B, x: T) => B): B {
        if (this.#n === 0) {
            return initial;
        } else {
            const len = this.#iter.len();
            if (len > this.#n && this.#iter.nth_back(len - this.#n - 1).done) {
                return initial;
            } else {
                return this.#iter.rfold(initial, fold)
            }
        }
    }
}

class TakeWhile<T> extends DoubleEndedIterator<T> {
    #iter: DoubleEndedIterator<T>;
    #callback: (value: T) => boolean;
    constructor(iterable: DoubleEndedIterator<T>, callback: (value: T) => boolean) {
        super();
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iter.into_iter()
        return this
    }

    override next(): IteratorResult<T> {
        const n = this.#iter.next();
        if (n.done) {
            return done()
        } else if (this.#callback(n.value)) {
            return n
        } else {
            return done();
        }
    }

    override next_back(): IteratorResult<T> {
        const n = this.#iter.next_back();
        if (n.done) {
            return done()
        } else if (this.#callback(n.value)) {
            return n
        } else {
            return done();
        }
    }
}

class Peekable<T> extends DoubleEndedIterator<T> {
    #peeked: Option<IteratorResult<T>>;
    #iter: DoubleEndedIterator<T>;
    constructor(iterable: DoubleEndedIterator<T>) {
        super()
        this.#iter = iterable;
    }

    #take() {
        const peeked = this.#peeked;
        this.#peeked = null;
        return peeked;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iter.into_iter()
        return this
    }

    override next(): IteratorResult<T> {
        const peeked = this.#take();
        return peeked ? peeked : this.#iter.next();
    }

    override next_back(): IteratorResult<T> {
        const peeked = this.#take();
        return peeked ? peeked : this.#iter.next_back()
    }

    peek() {
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

        peek_opt = opt ? opt.value : null;

        const l = this.#iter.last();
        return is_some(l) ? l : peek_opt;
    }

    override fold<B>(initial: B, f: (acc: B, x: T) => B): B {
        const peeked = this.#peeked;
        let acc = initial;

        if (peeked && !peeked.done) {
            acc = f(initial, peeked.value)
        }

        return this.#iter.fold(acc, f);
    }

    override rfold<B>(initial: B, fold: (acc: B, x: T) => B): B {
        const peeked = this.#peeked;

        if (peeked && peeked.done) {
            return initial;
        } else if (peeked && !peeked.done) {
            let acc = this.#iter.rfold(initial, fold)
            return fold(acc, peeked.value)
        } else {
            return this.#iter.rfold(initial, fold);
        }
    }
}

class Zip<K, V> extends DoubleEndedIterator<[K, V]> {
    #iter: DoubleEndedIterator<K>;
    #other: DoubleEndedIterator<V>;

    constructor(iterable: DoubleEndedIterator<K>, other: DoubleEndedIteratorInputType<V>) {
        super()
        this.#iter = iterable;
        this.#other = iter(other) as DoubleEndedIterator<V>;
    }

    override into_iter(): DoubleEndedIterator<[K, V]> {

        this.#other.into_iter()
        this.#iter.into_iter()
        return this;
    }

    override next(): IteratorResult<[K, V]> {
        const k = this.#iter.next()
        const v = this.#other.next()

        return (k.done || v.done) ? done() : { done: false, value: [k.value, v.value] }
    }

    override next_back(): IteratorResult<[K, V]> {
        const k = this.#iter.next_back()
        const v = this.#other.next_back()

        return (k.done || v.done) ? done<[K, V]>() : { done: false, value: [k.value, v.value] }
    }
}

// * --- Free standing functions ---

class Once<T> extends DoubleEndedIterator<T> {
    #item: T;
    #taken: boolean;
    constructor(value: T) {
        super()
        this.#item = value;
        this.#taken = false;
    }

    override next(): IteratorResult<T> {
        const taken = this.#taken;
        this.#taken = true;
        return taken ? done() : { done: false, value: this.#item }
    }

    override next_back(): IteratorResult<T> {
        return this.next();
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#taken = false;
        return this;
    }
}

export function once<T>(value: T) {
    return new Once(value)
}

class OnceWith<T> extends DoubleEndedIterator<T> {
    #fn: () => T;
    #taken: boolean
    constructor(fn: () => T) {
        super()
        this.#fn = fn;
        this.#taken = false;
    }

    override next(): IteratorResult<T> {
        const taken = this.#taken;
        this.#taken = true;
        return taken ? done() : { done: false, value: this.#fn() };
    }

    override next_back(): IteratorResult<T> {
        return this.next();
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#taken = false;
        return this;
    }
}

export function once_with<T>(fn: () => T) {
    return new OnceWith(fn)
}

class Repeat<T> extends DoubleEndedIterator<T> {
    #element: T;
    constructor(value: T) {
        super()
        this.#element = value;
    }

    override into_iter(): DoubleEndedIterator<T> {
        return this
    }

    override next(): IteratorResult<T> {
        return { done: false, value: this.#element }
    }

    override next_back(): IteratorResult<T> {
        return { done: false, value: this.#element }
    }

    override advance_by(_: number): Result<Ok, NonZeroUsize> {
        return undefined as Ok
    }

    override advance_back_by(_: number): Result<Ok, NonZeroUsize> {
        return undefined as Ok
    }

    override count(): number {
        while (true) { }
    }

    override last(): Option<T> {
        while (true) { }
    }

    override nth(_: number): IteratorResult<T> {
        return this.next();
    }

    override nth_back(_: number): IteratorResult<T> {
        return this.next_back();
    }

    override size_hint(): [number, Option<number>] {
        return [Number.MAX_SAFE_INTEGER, null]
    }
}
export function repeat<T>(value: T) {
    return new Repeat(value)
}

class RepeatWith<T> extends DoubleEndedIterator<T> {
    #gen: () => T;
    constructor(gen: () => T) {
        super();
        this.#gen = gen
    }

    override next(): IteratorResult<T> {
        return { done: false, value: this.#gen() }
    }

    override next_back(): IteratorResult<T> {
        return { done: false, value: this.#gen() }
    }

    override advance_by(_: number): Result<Ok, NonZeroUsize> {
        return undefined as Ok
    }

    override advance_back_by(_: number): Result<Ok, NonZeroUsize> {
        return undefined as Ok
    }

    override count(): number {
        while (true) { }
    }

    override last(): Option<T> {
        while (true) { }
    }

    override nth(_: number): IteratorResult<T> {
        return this.next();
    }

    override nth_back(_: number): IteratorResult<T> {
        return this.next_back();
    }

    override size_hint(): [number, Option<number>] {
        return [Number.MAX_SAFE_INTEGER, null]
    }
}

export function repeat_with<T>(fn: () => T) {
    return new RepeatWith(fn)
}

// * --- common Iterators ---

export class ArrayLike<T> extends ExactSizeDoubleEndedIterator<T> {
    #iterable: ArrayLikeType<T>;
    #index: number;
    #back_index: number;

    constructor(iterable: ArrayLikeType<T>) {
        super()
        this.#iterable = iterable;
        this.#index = -1;
        this.#back_index = iterable.length;
    }

    next(): IteratorResult<T> {
        this.#index++;
        if (this.#index >= this.#back_index) {
            return done();
        }

        const item = this.#iterable[this.#index];
        return is_some(item) ? { done: false, value: item } : done();
    }

    next_back(): IteratorResult<T> {
        this.#back_index--;
        if (this.#back_index <= this.#index) {
            return done<T>();
        }
        const item = this.#iterable[this.#back_index]
        return is_some(item) ? { done: false, value: item } : done();
    }

    override advance_by(n: number): Result<undefined, NonZeroUsize> {
        if (n === 0) {
            return;
        }
        const m = this.#index + n;

        this.#index = m;
        return non_zero_usize(this.len() - m)
    }

    override advance_back_by(n: number): Result<undefined, NonZeroUsize> {
        if (n === 0) {
            return;
        }
        const m = this.#back_index - n;

        this.#back_index = m;
        return non_zero_usize(this.len() - m)
    }

    override into_iter(): ExactSizeDoubleEndedIterator<T> {
        this.#index = -1;
        this.#back_index = this.#iterable.length;
        return this;
    }

    override size_hint(): [number, number] {
        return [0, this.#iterable.length]
    }

    override count(): number {
        return this.len();
    }

    override len(): number {
        if (this.#back_index <= this.#index) {
            return 0;
        }

        return this.#back_index - this.#index - 1;
    }
}

export class Range extends ExactSizeDoubleEndedIterator<number> {
    readonly start: number;
    readonly end: number;
    #index: number;
    #back_index: number;

    constructor(start: number, end: number) {
        super();
        this.start = start;
        this.end = end;
        this.#index = start - 1;
        this.#back_index = end;
    }

    override into_iter(): ExactSizeDoubleEndedIterator<number> {
        this.#index = this.start - 1;
        this.#back_index = this.end;
        return this;
    }

    next(): IteratorResult<number> {
        this.#index++;
        if (this.#index >= this.#back_index) {
            return done()
        }

        return { done: false, value: this.#index }
    }

    next_back(): IteratorResult<number> {
        this.#back_index--;
        if (this.#index >= this.#back_index) {
            return done()
        }

        return { done: false, value: this.#back_index }
    }

    override size_hint(): SizeHint<number, number> {
        const count = Math.max(0, this.#back_index - this.#index - 1)
        return [count, count] as SizeHint<number, number>;
    }

    override count(): number {
        return this.len();
    }
}
/**
* @summary  Creates a [`DoubleEndedIterator`] from start ... end.
* @throws This function **throws** a [`RangeError`] if `start > end`.
*/
export function range(start: number, end: number): Range {
    if (start > end) {
        throw new RangeError(`Range start ${start} cannot be greater than end ${end}`)
    }
    return new Range(start, end);
}

class Drain<T> extends ExactSizeDoubleEndedIterator<T> {
    #array: T[];
    #taken: T[];
    #range: Range;

    constructor(array: T[], range: Range) {
        super()
        this.#array = array;
        this.#range = range;
        this.#taken = [];
    }

    /**
     * @summary Drains the rest of the unyielded elements of [`Drain`]
     */
    drop() {
        this.last();
    }

    /**
     * @summary Keep unyielded elements in the source `Array`.
     */
    keep_rest() {
        this.#range.nth(this.#range.end);
    }

    override into_iter(): ExactSizeDoubleEndedIterator<T> {
        console.warn('into_iter() will do nothing on drain as it will result in unexpected behaviour such as removing unwanted elements.');
        return this
    }

    override next(): IteratorResult<T> {
        return map_next(this.#range.next(), i => {
            const index = i - this.#taken.length;
            const elt = this.#array[index];
            this.#taken.push(elt);
            this.#array.splice(index, 1);
            return elt;
        })
    }

    override next_back(): IteratorResult<T> {
        return map_next(this.#range.next_back(), i => {
            const index = i - this.#taken.length;
            const elt = this.#array[index];
            this.#array.splice(index, 1);
            return elt;
        })

    }
}

/**
 * @description
* Removes the specified range from the array in bulk, returning all removed elements as an iterator. If the iterator is dropped before being fully consumed, it drops the remaining removed elements.
* The returned iterator keeps a mutable borrow on the array to optimize its implementation.
* @throws if the starting point is greater than the end point or if the end point is greater than the length of the array.
 */
export function drain<T>(array: T[], r: Range): Drain<T>;
export function drain<T>(array: T[], from: number, to: number): Drain<T>;
export function drain<T>(array: T[], r: Range | number, to?: number): Drain<T> {
    if (!(r instanceof Range)) {
        r = range(r, to!);
    }

    if (r.end > array.length) {
        throw new RangeError(`Range end${r.end} cannpt exceed Array length ${array.length}`)
    }

    return new Drain(array, r);
}