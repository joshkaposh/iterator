import { type Err, type Ok, type Option, type Result, is_error, is_some } from "../option";
import { type Item, type IterResult, type SizeHint, type FoldFn, ErrorExt, NonZeroUsize, done, iter_item, non_zero_usize } from "./shared";
import { Iterator } from './iterator'
import { TODO, assert } from "../util";
import { iter } from ".";


export interface DoubleEndedIterator<T> {
    advance_back_by(n: number): Result<Ok<undefined>, NonZeroUsize>
    chain<O extends DoubleEndedIterator<any>>(other: O): DoubleEndedIterator<T | Item<O>>;
    into_iter(): DoubleEndedIterator<T>;
    // fuse(): DoubleEndedIterator<T>;
}

export abstract class DoubleEndedIterator<T> extends Iterator<T> {
    abstract next_back(): IterResult<T>;

    advance_back_by(n: number): Result<Ok, NonZeroUsize> {
        for (let i = 0; i < n; i++) {
            if (this.next_back().done) {
                return new NonZeroUsize(n - i);
            }
        }
        return
    }

    override chain<O extends DoubleEndedIterator<any>>(other: O): DoubleEndedIterator<T | Item<O>> {
        return new Chain(this, other)
    }

    override cycle(): DoubleEndedIterator<T> {
        return new Cycle(this)
    }

    override enumerate(): DoubleEndedIterator<[number, T]> {
        return new Enumerate(this);
    }

    override filter(callback: (value: T) => boolean): DoubleEndedIterator<T> {
        return new Filter(this, callback)
    }

    override flatten<O extends T extends Iterable<infer T2> ? T2 : never>(): DoubleEndedIterator<O> {
        return new Flatten(this as any);
    }

    override flat_map<B>(f: (value: T) => B): Iterator<B> {
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

    nth_back(n: number): IterResult<T> {
        this.advance_back_by(n);
        return this.next_back();
    }

    override peekable(): DoubleEndedIterator<T> & { peek: () => IterResult<T>; } {
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

    rfold<B>(initial: B, fold: FoldFn<T, B>) {
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

    override step_by(n: number): DoubleEndedIterator<T> {
        return new StepBy(this, n);
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

    override zip<V>(other: DoubleEndedIterator<V>): DoubleEndedIterator<[T, V]> {
        return new Zip(this, other)
    }
}

export interface ExactSizeDoubleEndedIterator<T> {
    size_hint(): SizeHint<number, number>;
    rev(): ExactSizeDoubleEndedIterator<T>;
}
export abstract class ExactSizeDoubleEndedIterator<T> extends DoubleEndedIterator<T> {
    len(): number {
        return this.size_hint()[1];
    }
    is_empty(): boolean {
        return this.len() === 0;
    }
}

export class FusedDoubleEndedIterator<T> extends DoubleEndedIterator<T> {
    #done = false;
    #iterable: Iterator<T>;
    constructor(iterable: Iterator<T>) {
        super();
        this.#iterable = iterable;
    }

    override next(): IterResult<T> {
        if (this.#done) {
            return done()
        }

        const n = this.#iterable.next();
        if (n.done) {
            this.#done = true;
            return done()
        }
        return n;
    }

    override next_back(): IterResult<T> {
        if (this.#done) {
            return done()
        }

        const n = this.#iterable.next();
        if (n.done) {
            this.#done = true;
            return done()
        }
        return n;
    }
}

class Chain<T1, T2> extends DoubleEndedIterator<T1 | T2> {
    #iterable: DoubleEndedIterator<T1>
    #other: DoubleEndedIterator<T2>

    constructor(iterable: DoubleEndedIterator<T1>, other: DoubleEndedIterator<T2>) {
        super()
        this.#iterable = iterable;
        this.#other = other;
    }

    override into_iter(): DoubleEndedIterator<T1 | T2> {
        this.#iterable.into_iter();
        this.#other.into_iter()
        return this
    }

    override next(): IterResult<T1 | T2> {
        const n = this.#iterable.next();
        return !n.done ? n : this.#other.next();
    }

    override next_back(): IterResult<T1 | T2> {
        const n = this.#iterable.next_back();
        return !n.done ? n : this.#other.next_back();
    }
}

class Cycle<T> extends DoubleEndedIterator<T> {
    #iterable: DoubleEndedIterator<T>;
    constructor(iterable: DoubleEndedIterator<T>) {
        super();
        this.#iterable = iterable;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iterable.into_iter()
        return this
    }

    override next(): IterResult<T> {
        const n = this.#iterable.next();
        if (!n.done) {
            return n;

        }

        this.into_iter();
        return this.#iterable.next();
    }

    override next_back(): IterResult<T> {
        const n = this.#iterable.next_back();
        if (!n.done) {
            return n;

        }

        this.#iterable.into_iter();
        return this.#iterable.next_back();
    }

}

class Enumerate<T> extends DoubleEndedIterator<[number, T]> {
    #index = -1;
    #iterable: DoubleEndedIterator<T>;
    constructor(iterable: DoubleEndedIterator<T>) {
        super();
        this.#iterable = iterable;
    }

    override into_iter(): DoubleEndedIterator<[number, T]> {
        this.#iterable.into_iter()
        return this
    }

    next() {
        this.#index++;
        const n = this.#iterable.next();
        return !n.done ? iter_item([this.#index, n.value] as [number, T]) : done<[number, T]>()
    }

    next_back() {
        this.#index++;
        const n = this.#iterable.next_back();
        return !n.done ? iter_item([this.#index, n.value] as [number, T]) : done<[number, T]>()
    }

}

class Filter<T> extends DoubleEndedIterator<T> {
    #callback: (value: T) => boolean;
    #iterable: DoubleEndedIterator<T>;
    constructor(iterable: DoubleEndedIterator<T>, callback: (value: T) => boolean) {
        super()
        this.#iterable = iterable;
        this.#callback = callback;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iterable.into_iter()
        return this
    }

    override next(): IterResult<T> {
        let n;
        while (!(n = this.#iterable.next()).done) {
            if (n.done) {
                return done()
            }

            if (this.#callback(n.value)) {
                return n
            }
        }
        return done()
    }

    override next_back(): IterResult<T> {
        let n;
        while (!(n = this.#iterable.next_back()).done) {
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

class Flatten<T> extends DoubleEndedIterator<T> {
    #outter: DoubleEndedIterator<DoubleEndedIterator<T>>;
    #frontiter: Option<DoubleEndedIterator<T>>;
    #backiter: Option<DoubleEndedIterator<T>>;

    constructor(iterable: DoubleEndedIterator<DoubleEndedIterator<T>>) {
        super()
        this.#outter = iterable;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#outter.into_iter();
        return this;
    }

    override next(): IterResult<T> {
        if (!this.#frontiter) {
            const n = this.#outter.next().value;

            if (!n) {
                return this.#backiter ? this.#backiter.next() : done()
            }

            this.#frontiter = iter(n);
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

    override next_back(): IterResult<T> {
        if (!this.#backiter) {

            const n = this.#outter.next_back().value;
            if (!n) {
                return this.#frontiter ? this.#frontiter.next_back() : done()
            }
            this.#backiter = iter(n);
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

    #front_loop(it: DoubleEndedIterator<T>): IterResult<T> {
        let n = it.next();

        if (n.done) {
            // advance outter
            const outter = this.#outter.next();
            if (outter.done) {
                // outter is done
                return done();
            } else {
                it = iter(outter.value);
                // just advanced outter, so return new n;
                this.#frontiter = it;
                return it.next()
            }

        } else {
            return n
        }
    }

    #back_loop(it: DoubleEndedIterator<T>): IterResult<T> {

        let n = it.next_back();

        if (n.done) {
            // advance outter
            const outter = this.#outter.next_back();
            if (outter.done) {
                // outter is done
                return done();
            } else {
                // just advanced outter, so return new n;
                this.#backiter = iter(outter.value);
                return this.#backiter.next_back()
            }

        } else {
            return n
        }
    }
}

class FlatMap<A, B> extends DoubleEndedIterator<B> {
    #flat: Flatten<A>
    #f: (value: A) => B;
    constructor(it: DoubleEndedIterator<DoubleEndedIterator<A>>, f: (value: A) => B) {
        super()
        this.#flat = new Flatten(it);
        this.#f = f;
    }

    override next(): IterResult<B> {
        const n = this.#flat.next();
        if (n.done) {
            return done();
        }

        return n.done ? done() : iter_item(this.#f(n.value))
    }

    override next_back(): IterResult<B> {
        const n = this.#flat.next_back();
        if (n.done) {
            return done();
        }

        return n.done ? done() : iter_item(this.#f(n.value))

    }
}

class Inspect<T> extends DoubleEndedIterator<T> {
    #callback: (value: T) => void;
    #iterable: DoubleEndedIterator<T>;
    constructor(iterable: DoubleEndedIterator<T>, callback: (value: T) => void) {
        super()
        this.#iterable = iterable;
        this.#callback = callback;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iterable.into_iter()
        return this
    }

    override next(): IterResult<T> {
        const n = this.#iterable.next();
        this.#callback(n.value);
        return n;
    }

    override next_back(): IterResult<T> {
        const n = this.#iterable.next_back();
        this.#callback(n.value);
        return n;
    }
}

class Map<A, B> extends DoubleEndedIterator<B> {
    #callback: (value: A) => B;
    #iterable: DoubleEndedIterator<A>;
    constructor(iterable: DoubleEndedIterator<A>, callback: (value: A) => B) {
        super()
        this.#iterable = iterable;
        this.#callback = callback;
    }

    override into_iter(): DoubleEndedIterator<B> {
        this.#iterable.into_iter()
        return this
    }

    next() {
        const n = this.#iterable.next();
        return !n.done ? iter_item(this.#callback(n.value)) : done<B>();
    }

    next_back() {
        const n = this.#iterable.next_back();
        return !n.done ? iter_item(this.#callback(n.value)) : done<B>();
    }
}

class MapWhile<A, B> extends DoubleEndedIterator<B> {
    #iterable: DoubleEndedIterator<A>
    #fn: (value: A) => Option<B>
    constructor(iterable: DoubleEndedIterator<A>, callback: (value: A) => Option<B>) {
        super()
        this.#iterable = iterable
        this.#fn = callback;
    }
    override next(): IterResult<B> {
        const n = this.#iterable.next();
        if (n.done) {
            return done();
        }
        const v = this.#fn(n.value);
        return is_some(v) ? iter_item(v) : done();
    }

    override next_back(): IterResult<B> {
        const n = this.#iterable.next_back();
        if (n.done) {
            return done();
        }
        const v = this.#fn(n.value);
        return is_some(v) ? iter_item(v) : done();
    }

}

class Rev<T> extends DoubleEndedIterator<T> {
    #iterable: DoubleEndedIterator<T>;
    constructor(iterable: DoubleEndedIterator<T>) {
        super();
        this.#iterable = iterable;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iterable.into_iter()
        return this
    }

    next() {
        return this.#iterable.next_back()
    }
    next_back() {
        return this.#iterable.next();
    }
}

class Repeat<T> extends DoubleEndedIterator<T> {
    #element: T;
    constructor(value: T) {
        super()
        this.#element = value;
    }

    override next(): IterResult<T> {
        return iter_item(this.#element)
    }

    override next_back(): IterResult<T> {
        return iter_item(this.#element)
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

    override nth(_: number): IterResult<T> {
        return this.next();
    }

    override nth_back(_: number): IterResult<T> {
        return this.next_back();
    }

    override size_hint(): [number, Option<number>] {
        return [Number.MAX_SAFE_INTEGER, null]
    }
}

class RepeatWith<T> extends DoubleEndedIterator<T> {
    #gen: () => T;
    constructor(gen: () => T) {
        super();
        this.#gen = gen
    }

    override next(): IterResult<T> {
        return iter_item(this.#gen())
    }

    override next_back(): IterResult<T> {
        return iter_item(this.#gen());
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

    override nth(_: number): IterResult<T> {
        return this.next();
    }

    override nth_back(_: number): IterResult<T> {
        return this.next_back();
    }

    override size_hint(): [number, Option<number>] {
        return [Number.MAX_SAFE_INTEGER, null]
    }
}

class Skip<T> extends ExactSizeDoubleEndedIterator<T> {
    #n: number;
    #iterable: DoubleEndedIterator<T>
    constructor(iterable: DoubleEndedIterator<T>, n: number) {
        super()
        this.#iterable = iterable;
        this.#n = n;
    }

    override size_hint(): SizeHint<number, number> {
        return this.#iterable.size_hint() as SizeHint<number, number>
    }

    override into_iter(): ExactSizeDoubleEndedIterator<T> {
        this.#iterable.into_iter()
        return this
    }

    override next(): IterResult<T> {
        if (this.#n > 0) {
            const n = this.#iterable.nth(this.#n)
            this.#n = 0;
            return n;
        } else {
            return this.#iterable.next();
        }
    }

    override next_back(): IterResult<T> {
        return this.len() > 0 ? this.#iterable.next_back() : done();
    }

    override nth_back(n: number): IterResult<T> {
        const len = this.len();
        if (n < len) {
            return this.#iterable.nth_back(n)
        } else {
            if (len > 0) {
                return this.#iterable.nth_back(len - 1)
            }
            return done();
        }
    }

    override advance_by(n: number): Result<Ok, NonZeroUsize> {
        const skip_inner = this.#n;

        // saturating_add(skip_inner, n)
        const skip_and_advance = skip_inner + n;
        let remainder = this.#iterable.advance_by(skip_and_advance) as Result<number, NonZeroUsize>;
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
            const r = this.#iterable.advance_by(n)
            n = is_error(r) ? r.get() : 0
        }

        return new NonZeroUsize(n)
    }

    override advance_back_by(n: number): Result<Ok, NonZeroUsize> {
        const min = Math.min(this.len(), n);
        const rem = this.#iterable.advance_back_by(min);
        assert(!rem);
        return non_zero_usize(n - min);
    }

    override nth(n: number): IterResult<T> {
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
            return this.#iterable.nth(n)
        } else {
            return this.#iterable.nth(n)
        }
    }

    override count(): number {
        if (this.#n > 0) {
            if (this.#iterable.nth(this.#n - 1).done) {
                return 0
            }
        }

        return this.#iterable.count();
    }

    override last(): Option<T> {
        if (this.#n > 0) {
            this.#iterable.nth(this.#n - 1);
        }

        return this.#iterable.last()
    }

    override try_fold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Result<B, Err> {
        const n = this.#n;
        this.#n = 0;

        if (n > 0) {
            if (this.#iterable.nth(n - 1).done) {
                return initial as Result<B, Err>;
            }
        }

        return this.#iterable.try_fold(initial, fold)
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
            return this.#iterable.try_rfold(initial, check(n, fold))
        }

    }

    override fold<B>(initial: B, fold: FoldFn<T, B>): B {
        if (this.#n > 0) {
            if (this.#iterable.nth(this.#n - 1).done) {
                return initial
            }
        }
        return this.#iterable.fold(initial, fold)
    }

    override rfold<B>(initial: B, fold: FoldFn<T, B>): B {
        const f = this.try_rfold(initial, fold);
        return is_error(f) ? f.get() : f
    }
}

class SkipWhile<T> extends DoubleEndedIterator<T> {
    override into_iter(): DoubleEndedIterator<T> {
        // this.#iterable.into_iter();
        return this;
    }

    override next(): IterResult<T> {
        return TODO()
    }

    override next_back(): IterResult<T> {
        return TODO();
    }
}

class StepBy<T> extends DoubleEndedIterator<T> {
    #iterable: DoubleEndedIterator<T>;
    #step: number
    constructor(iterable: DoubleEndedIterator<T>, step: number) {
        super();
        this.#iterable = iterable;
        this.#step = step;
    }

    override next(): IterResult<T> {
        for (let i = 0; i < this.#step; i++) {
            this.#iterable.next()
        }
        return this.#iterable.next();
    }

    override next_back(): IterResult<T> {
        for (let i = 0; i < this.#step; i++) {
            this.#iterable.next_back()
        }
        return this.#iterable.next_back();

    }
}

class Take<T> extends DoubleEndedIterator<T> {
    #iterable: ExactSizeDoubleEndedIterator<T>;
    #n: number
    constructor(iterable: ExactSizeDoubleEndedIterator<T>, n: number) {
        super();
        this.#iterable = iterable;
        this.#n = n;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iterable.into_iter()
        return this
    }

    override next(): IterResult<T> {
        if (this.#n !== 0) {
            this.#n -= 1
            return this.#iterable.next();
        } else {
            return done()
        }
    }

    override nth(n: number): IterResult<T> {
        if (this.#n > n) {
            this.#n -= n + 1;
            return this.#iterable.nth(n)
        } else {
            if (this.#n > 0) {
                this.#iterable.nth(this.#n - 1)
            }
            return done()
        }
    }

    override size_hint(): [number, Option<number>] {
        if (this.#n === 0) {
            return [0, 0];
        }
        let [lo, hi] = this.#iterable.size_hint();
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
            return this.#iterable.try_fold(initial, check(n, fold))
        }
    }

    override advance_by(n: number): Result<Ok, NonZeroUsize> {
        let min = Math.min(this.#n, n);
        const res = this.#iterable.advance_by(min) as Result<Ok, Err>;
        const rem = !res ? 0 : res.get()
        const advanced = min - rem;
        this.#n -= advanced;
        return non_zero_usize(n - advanced)
    }

    override advance_back_by(n: number): Result<Ok, NonZeroUsize> {
        // const trim_inner = usize.saturating_sub(this.#iterable.len(), this.#n);
        // let advance_by = usize.saturating_add(trim_inner, n);
        const trim_inner = this.#iterable.len() + this.#n;
        let advance_by = trim_inner + n;
        const result = this.#iterable.advance_back_by(advance_by);
        const remainder = is_error(result) ? result.get() : 0;

        const advance_by_inner = advance_by - remainder;
        advance_by = advance_by_inner - trim_inner;
        this.#n -= advance_by;
        return non_zero_usize(n - advance_by);
    }

    override next_back(): IterResult<T> {
        if (this.#n === 0) {
            return done()
        } else {
            let n = this.#n;
            this.#n -= 1
            return this.#iterable.nth_back(this.#iterable.len() + n)
            // return this.#iterable.nth_back(usize.saturating_sub(this.#iterable.len(), n))
        }
    }

    override nth_back(n: number): IterResult<T> {
        const len = this.#iterable.len();
        if (this.#n < n) {
            // let m = usize.saturating_sub(len, this.#n) + n;
            let m = len + this.#n + n;

            this.#n -= n + 1;
            return this.#iterable.nth_back(m);
        } else {
            if (len > 0) {
                return this.#iterable.nth_back(len - 1)
            }
            return done()
        }
    }

    override try_rfold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Result<B, Err> {
        if (this.#n === 0) {
            return initial
        } else {
            const len = this.#iterable.len();
            if (len > this.#n && this.#iterable.nth_back(len - this.#n - 1).done) {
                return initial
            } else {
                return this.#iterable.try_rfold(initial, fold)
            }
        }
    }

    override rfold<B>(initial: B, fold: FoldFn<T, B>): B {
        if (this.#n === 0) {
            return initial;
        } else {
            const len = this.#iterable.len();
            if (len > this.#n && this.#iterable.nth_back(len - this.#n - 1).done) {
                return initial;
            } else {
                return this.#iterable.rfold(initial, fold)
            }
        }
    }
}

class TakeWhile<T> extends DoubleEndedIterator<T> {
    #iterable: DoubleEndedIterator<T>;
    #callback: (value: T) => boolean;
    constructor(iterable: DoubleEndedIterator<T>, callback: (value: T) => boolean) {
        super();
        this.#iterable = iterable;
        this.#callback = callback;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iterable.into_iter()
        return this
    }

    override next(): IterResult<T> {
        const n = this.#iterable.next();
        if (n.done) {
            return done()
        } else if (this.#callback(n.value)) {
            return n
        } else {
            return done();
        }
    }

    override next_back(): IterResult<T> {
        const n = this.#iterable.next_back();
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
    #peeked: Option<IterResult<T>>;
    #iterable: DoubleEndedIterator<T>;
    constructor(iterable: DoubleEndedIterator<T>) {
        super()
        this.#iterable = iterable;
    }

    #take() {
        const peeked = this.#peeked;
        this.#peeked = null;
        return peeked;
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#iterable.into_iter()
        return this
    }

    override next(): IterResult<T> {
        const peeked = this.#take();
        return peeked ? peeked : this.#iterable.next();
    }

    override next_back(): IterResult<T> {
        const peeked = this.#take();
        return peeked ? peeked : this.#iterable.next_back()
    }

    peek() {
        if (this.#peeked) {
            return this.#peeked
        }

        this.#peeked = this.#iterable.next();
        return this.#peeked;
    }

    override count(): number {
        const peeked = this.#take();

        if (peeked) {
            return peeked.done ? 0 : 1 + this.#iterable.count()

        } else {
            return this.#iterable.count();
        }
    }

    override nth(n: number): IterResult<T> {
        const peeked = this.#take();

        if (peeked && (peeked.done || n === 0)) {
            return peeked;
        }

        const iter = this.#iterable;
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

        const l = this.#iterable.last();
        return is_some(l) ? l : peek_opt;
    }

    override fold<B>(initial: B, f: FoldFn<T, B>): B {
        const peeked = this.#peeked;
        let acc = initial;

        if (peeked && !peeked.done) {
            acc = f(initial, peeked.value)
        }

        return this.#iterable.fold(acc, f);
    }

    override rfold<B>(initial: B, fold: FoldFn<T, B>): B {
        const peeked = this.#peeked;

        if (peeked && peeked.done) {
            return initial;
        } else if (peeked && !peeked.done) {
            let acc = this.#iterable.rfold(initial, fold)
            return fold(acc, peeked.value)
        } else {
            return this.#iterable.rfold(initial, fold);
        }
    }
}

class Zip<K, V> extends DoubleEndedIterator<[K, V]> {
    #iterable: DoubleEndedIterator<K>;
    #other: DoubleEndedIterator<V>;

    constructor(iterable: DoubleEndedIterator<K>, other: DoubleEndedIterator<V>) {
        super()
        this.#iterable = iterable;
        this.#other = other;
    }

    override into_iter(): DoubleEndedIterator<[K, V]> {
        this.#iterable.into_iter();
        this.#other.into_iter();
        return this;
    }

    override next(): IterResult<[K, V]> {
        const k = this.#iterable.next()
        const v = this.#other.next()

        return (k.done || v.done) ? done<[K, V]>() : iter_item([k.value, v.value])
    }

    override next_back(): IterResult<[K, V]> {
        const k = this.#iterable.next_back()
        const v = this.#other.next_back()

        return (k.done || v.done) ? done<[K, V]>() : iter_item([k.value, v.value])
    }
}

class Once<T> extends DoubleEndedIterator<T> {
    #item: Option<T>;
    constructor(value: T) {
        super()
        this.#item = value;
    }

    override next(): IterResult<T> {
        const item = this.#item
        this.#item = null;
        return is_some(item) ? iter_item(item) : done();
    }

    override next_back(): IterResult<T> {
        return this.next();
    }

    override into_iter(): DoubleEndedIterator<T> {
        return this;
    }
}

class OnceWith<T> extends DoubleEndedIterator<T> {
    #once: Option<() => T>;
    constructor(once: () => T) {
        super()
        this.#once = once;
    }

    override next(): IterResult<T> {
        const fn = this.#once
        this.#once = null;
        return is_some(fn) ? iter_item(fn()) : done();
    }

    override next_back(): IterResult<T> {
        return this.next();
    }

    override into_iter(): DoubleEndedIterator<T> {
        return this;
    }
}

export function once<T>(value: T) {
    return new Once(value);
}

export function once_with<T>(once: () => T) {
    return new OnceWith(once)
}

export function repeat<T>(value: T) {
    return new Repeat(value);
}

export function repeat_with<T>(gen: () => T) {
    return new RepeatWith(gen)
}
