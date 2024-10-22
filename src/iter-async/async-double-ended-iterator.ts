import { type Err, type Ok, type Option, type Result, is_error, is_some, ErrorExt, } from "joshkaposh-option";
import { assert } from "../util";
import { AsyncIterator } from "./async-iterator";
import { NonZeroUsize, done, item, non_zero_usize } from "../shared";
import { async_iter, from_async_fn } from ".";
import type { AsyncDoubleEndedIteratorInputType, SizeHint, Item } from "../types";

export interface AsyncDoubleEndedIterator<T> {
    advance_back_by(n: number): Promise<Result<Ok<undefined>, NonZeroUsize>>
    chain<O extends AsyncDoubleEndedIteratorInputType<any>, T2 extends Item<O>>(other: O, callback: (value: T2) => T2 | Promise<T2>): AsyncDoubleEndedIterator<T | T2>;
    zip<V>(other: any, callback: (value: V) => V | Promise<V>): AsyncDoubleEndedIterator<[T, V]>;
    into_iter(): AsyncDoubleEndedIterator<T>;
}
export abstract class AsyncDoubleEndedIterator<T> extends AsyncIterator<T> {

    abstract next_back(): Promise<IteratorResult<T>>;

    async advance_back_by(n: number): Promise<Result<Ok, NonZeroUsize>> {
        for (let i = 0; i < n; i++) {
            const next = await this.next_back()
            if (next.done) {
                return new NonZeroUsize(n - i);
            }
        }
        return undefined as Ok
    }

    override chain<O extends AsyncDoubleEndedIterator<any> | (() => AsyncGenerator<any>), T2 extends Item<O>>(other: O, callback: (value: T2) => T2 | Promise<T2>): AsyncDoubleEndedIterator<T | T2> {
        return new Chain(this as any, other as any, callback)
    }

    override cycle(): AsyncDoubleEndedIterator<T> {
        return new Cycle(this);
    }

    override enumerate(): AsyncDoubleEndedIterator<[number, T]> {
        return new Enumerate(this)
    }

    override filter(predicate: (value: T) => boolean): AsyncDoubleEndedIterator<T> {
        return new Filter(this, predicate)
    }


    override flatten<O extends T extends Iterable<infer T2> ? T2 : never>(): AsyncDoubleEndedIterator<O> {
        return new Flatten(this as any) as any
    }

    override flat_map<B>(f: (value: T) => B): AsyncDoubleEndedIterator<B> {
        return new FlatMap(this as any, f)
    }

    override fuse(): AsyncDoubleEndedIterator<T> {
        return new FusedAsyncDoubleEndedIterator(this);
    }

    override inspect(callback: (value: T) => void): AsyncDoubleEndedIterator<T> {
        return new Inspect(this, callback)
    }

    override map<B>(f: (value: T) => Promise<B> | B): AsyncDoubleEndedIterator<B> {
        return new Map(this, f) as unknown as AsyncDoubleEndedIterator<B>
    }

    override map_while<B>(f: (value: T) => B): AsyncDoubleEndedIterator<B> {
        return new MapWhile(this, f)
    }

    override async next_chunk(n: number): Promise<Result<T[], Err<T[]>>> {
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

    override async nth(n: number) {
        await this.advance_by(n);
        return await this.next();
    }

    async nth_back(n: number): Promise<IteratorResult<T>> {
        await this.advance_back_by(n);
        return await this.next_back();
    }

    override peekable(): AsyncDoubleEndedIterator<T> & { peek: () => Promise<IteratorResult<T>>; } {
        return new Peekable(this)
    }

    rev(): AsyncDoubleEndedIterator<T> {
        return new Rev(this)
    }

    async rfind(predicate: (value: T) => boolean): Promise<Option<T>> {
        let n;
        while (true) {
            n = await this.next_back()
            if (n.done) {
                return
            }
            if (predicate(n.value)) {
                return n.value;
            }
        }
    }

    async rfold<B>(initial: B, fold: (acc: B, x: T) => B) {
        let acc = initial;
        let next;
        let done = false;
        while (!done) {
            next = await this.next_back()
            done = next.done!;
            acc = fold(acc, next.value!)
        }

        return acc;
    }

    override skip(n: number): AsyncDoubleEndedIterator<T> {
        return new Skip(this, n)
    }

    override skip_while(predicate: (value: T) => boolean): AsyncDoubleEndedIterator<T> {
        return new SkipWhile(this, predicate);
    }

    override step_by(n: number): AsyncDoubleEndedIterator<T> {
        return new StepBy(this as any, n);
    }

    override take(n: number): AsyncDoubleEndedIterator<T> {
        return new Take(this as any, n)
    }

    override take_while(callback: (value: T) => boolean): AsyncDoubleEndedIterator<T> {
        return new TakeWhile(this, callback);
    }

    async try_rfold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err> | Promise<T>): Promise<Result<B, Err>> {
        let acc = initial;
        let next;
        while (true) {
            next = await this.next_back();
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

    override zip<V>(other: AsyncDoubleEndedIteratorInputType<V>, callback: (value: V) => Promise<V> | V): AsyncDoubleEndedIterator<[T, V]> {
        return new Zip(this, other, callback)
    }
}
export interface ExactSizeAsyncDoubleEndedIterator<T> {
    size_hint(): SizeHint<number, number>;
    into_iter(): ExactSizeAsyncDoubleEndedIterator<T>;
}
export abstract class ExactSizeAsyncDoubleEndedIterator<T> extends AsyncDoubleEndedIterator<T> {
    len(): number {
        return this.size_hint()[1]
    }
    is_empty(): boolean {
        return this.len() === 0;
    }

}

export class FusedAsyncDoubleEndedIterator<T> extends AsyncDoubleEndedIterator<T> {
    #done = false;
    #iter: AsyncDoubleEndedIterator<T>;
    constructor(iterable: AsyncDoubleEndedIterator<T>) {
        super();
        this.#iter = iterable;
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
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

    override async next_back(): Promise<IteratorResult<T>> {
        if (this.#done) {
            return done()
        }

        const n = await this.#iter.next_back();
        if (n.done) {
            this.#done = true;
            return done()
        }
        return n
    }
}

class Chain<T1, T2> extends AsyncDoubleEndedIterator<T1 | T2> {
    #iter: AsyncDoubleEndedIterator<T1>
    #other: AsyncDoubleEndedIterator<T2>

    constructor(iterable: AsyncDoubleEndedIterator<T1>, other: AsyncDoubleEndedIteratorInputType<T2>, callback: (value: T2) => T2 | Promise<T2>) {
        super()
        this.#iter = iterable;
        this.#other = async_iter(other, callback as any) as unknown as AsyncDoubleEndedIterator<T2>;
    }

    override into_iter(): AsyncDoubleEndedIterator<T1 | T2> {
        this.#iter.into_iter();
        this.#other.into_iter()
        return this
    }

    override async next(): Promise<IteratorResult<T1 | T2>> {
        const n = await this.#iter.next();
        return !n.done ? n : await this.#other.next();
    }

    override async next_back(): Promise<IteratorResult<T1 | T2>> {
        const n = await this.#other.next_back();
        return !n.done ? n : await this.#iter.next_back();
    }
}

class Cycle<T> extends AsyncDoubleEndedIterator<T> {
    #iter: AsyncDoubleEndedIterator<T>;
    constructor(iterable: AsyncDoubleEndedIterator<T>) {
        super();
        this.#iter = iterable;
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
        this.#iter.into_iter()
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        const n = await this.#iter.next();
        if (!n.done) {
            return n;

        }

        this.into_iter();
        return await this.#iter.next();
    }

    override async next_back(): Promise<IteratorResult<T>> {
        const n = await this.#iter.next_back();
        if (!n.done) {
            return n;

        }

        this.#iter.into_iter();
        return await this.#iter.next_back();
    }

}

class Enumerate<T> extends AsyncDoubleEndedIterator<[number, T]> {
    #index = -1;
    #iter: AsyncDoubleEndedIterator<T>;
    constructor(iterable: AsyncDoubleEndedIterator<T>) {
        super();
        this.#iter = iterable;
    }

    override into_iter(): AsyncDoubleEndedIterator<[number, T]> {
        this.#iter.into_iter();
        this.#index = -1;
        return this
    }

    async next() {
        this.#index++;
        const n = await this.#iter.next();
        return !n.done ? item([this.#index, n.value] as [number, T]) : done<[number, T]>()
    }

    async next_back() {
        this.#index++;
        const n = await this.#iter.next_back();
        return !n.done ? item([this.#index, n.value] as [number, T]) : done<[number, T]>()
    }

}

class Filter<T> extends AsyncDoubleEndedIterator<T> {
    #predicate: (value: T) => boolean | Promise<boolean>;
    #iter: AsyncDoubleEndedIterator<T>;
    constructor(iterable: AsyncDoubleEndedIterator<T>, predicate: (value: T) => Promise<boolean> | boolean) {
        super()
        this.#iter = iterable;
        this.#predicate = predicate;
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
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
            const b = await this.#predicate(n.value)
            if (b) {
                return n
            }
        }
    }

    override async next_back(): Promise<IteratorResult<T>> {
        let n;
        while (true) {
            n = await this.#iter.next_back();
            if (n.done) {
                return done()
            }

            const b = await this.#predicate(n.value)
            if (b) {
                return n
            }
        }
    }
}
class Flatten<T> extends AsyncDoubleEndedIterator<T> {
    #outter: AsyncDoubleEndedIterator<AsyncDoubleEndedIterator<T>>;
    #frontiter: Option<AsyncDoubleEndedIterator<T>>;
    #backiter: Option<AsyncDoubleEndedIterator<T>>;

    constructor(iterable: AsyncDoubleEndedIterator<AsyncDoubleEndedIterator<T>>) {
        super()
        this.#outter = iterable;
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
        this.#outter.into_iter();
        return this;
    }

    override async next(): Promise<IteratorResult<T>> {
        if (!this.#frontiter) {
            const out = await this.#outter.next()
            const n = out.value;

            if (!n) {
                return this.#backiter ? this.#backiter.next() : done()
            }

            this.#frontiter = n
        }

        const n = await this.#front_loop(this.#frontiter!);

        if (n.done) {
            if (this.#backiter) {
                return await this.#front_loop(this.#backiter)
            } else {
                return done()
            }
        }

        return n
    }

    override async next_back(): Promise<IteratorResult<T>> {
        if (!this.#backiter) {

            const out = await this.#outter.next_back()
            const n = out.value;
            if (!n) {
                return this.#frontiter ? this.#frontiter.next_back() : done()
            }
            this.#backiter = n as any;
        }

        const n = await this.#back_loop(this.#backiter!);

        if (n.done) {
            if (this.#frontiter) {
                return await this.#back_loop(this.#frontiter)
            } else {
                return done()
            }
        }

        return n
    }

    async #front_loop(it: AsyncDoubleEndedIterator<T>): Promise<IteratorResult<T>> {
        let n = await it.next();

        if (n.done) {
            // advance outter
            const outter = await this.#outter.next();
            if (outter.done) {
                // outter is done
                return done();
            } else {
                it = outter.value as any;
                // just advanced outter, so return new n;
                this.#frontiter = it;
                return await it.next()
            }

        } else {
            return n
        }
    }

    async #back_loop(it: AsyncDoubleEndedIterator<T>): Promise<IteratorResult<T>> {

        let n = await it.next_back();

        if (n.done) {
            // advance outter
            const outter = await this.#outter.next_back();
            if (outter.done) {
                // outter is done
                return done();
            } else {
                // just advanced outter, so return new n;
                this.#backiter = outter.value as any;
                return await this.#backiter!.next_back()
            }

        } else {
            return n
        }
    }
}

class FlatMap<A, B> extends AsyncDoubleEndedIterator<B> {
    #flat: Flatten<A>
    #f: (value: A) => B;
    constructor(it: AsyncDoubleEndedIterator<AsyncDoubleEndedIterator<A>>, f: (value: A) => B) {
        super()
        this.#flat = new Flatten<A>(it);
        this.#f = f;
    }
    override into_iter(): AsyncDoubleEndedIterator<B> {
        this.#flat.into_iter();
        return this
    }

    override async next(): Promise<IteratorResult<B>> {
        const n = await this.#flat.next();
        if (n.done) {
            return done();
        }

        return n.done ? done() : item(this.#f(n.value))
    }

    override async next_back(): Promise<IteratorResult<B>> {
        const n = await this.#flat.next_back();
        if (n.done) {
            return done();
        }

        return n.done ? done() : item(this.#f(n.value))

    }
}

class Inspect<T> extends AsyncDoubleEndedIterator<T> {
    #callback: (value: T) => void;
    #iter: AsyncDoubleEndedIterator<T>;
    constructor(iterable: AsyncDoubleEndedIterator<T>, callback: (value: T) => void) {
        super()
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
        this.#iter.into_iter()
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        const n = await this.#iter.next();
        this.#callback(n.value);
        return n;
    }

    override async next_back(): Promise<IteratorResult<T>> {
        const n = await this.#iter.next_back();
        this.#callback(n.value);
        return n;
    }
}

class Map<A, B> extends AsyncDoubleEndedIterator<B> {
    #callback: (value: A) => B | Promise<B>;
    #iter: AsyncDoubleEndedIterator<A>;
    constructor(iterable: AsyncDoubleEndedIterator<A>, callback: (value: A) => B | Promise<B>) {
        super()
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): AsyncDoubleEndedIterator<B> {
        this.#iter.into_iter();
        return this
    }

    async next() {
        const n = await this.#iter.next();
        return !n.done ? item(await this.#callback(n.value)) : done<B>();
    }

    async next_back() {
        const n = await this.#iter.next_back();
        return !n.done ? item(await this.#callback(n.value)) : done<B>();
    }
}

class MapWhile<A, B> extends AsyncDoubleEndedIterator<B> {
    #iter: AsyncDoubleEndedIterator<A>
    #fn: (value: A) => Option<B>
    constructor(iterable: AsyncDoubleEndedIterator<A>, callback: (value: A) => Option<B>) {
        super()
        this.#iter = iterable
        this.#fn = callback;
    }

    override into_iter(): AsyncDoubleEndedIterator<B> {
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

    override async next_back(): Promise<IteratorResult<B>> {
        const n = await this.#iter.next_back();
        if (n.done) {
            return done();
        }
        const v = this.#fn(n.value);
        return is_some(v) ? item(v) : done();
    }

}

class Rev<T> extends AsyncDoubleEndedIterator<T> {
    #iter: AsyncDoubleEndedIterator<T>;
    constructor(iterable: AsyncDoubleEndedIterator<T>) {
        super();
        this.#iter = iterable;
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
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

class Skip<T> extends ExactSizeAsyncDoubleEndedIterator<T> {
    #n: number;
    #initial: number;
    #iter: AsyncDoubleEndedIterator<T>

    constructor(iterable: AsyncDoubleEndedIterator<T>, n: number) {
        super()
        this.#iter = iterable;
        this.#n = n;
        this.#initial = n;
    }

    override size_hint(): SizeHint<number, number> {
        return this.#iter.size_hint() as SizeHint<number, number>
    }

    override into_iter(): ExactSizeAsyncDoubleEndedIterator<T> {
        this.#iter.into_iter()
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

    override async next_back(): Promise<IteratorResult<T>> {
        return this.len() > 0 ? await this.#iter.next_back() : done();
    }

    override async nth_back(n: number): Promise<IteratorResult<T>> {
        const len = this.len();
        if (n < len) {
            return await this.#iter.nth_back(n)
        } else {
            if (len > 0) {
                return await this.#iter.nth_back(len - 1)
            }
            return done();
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
            const r = await this.#iter.advance_by(n)
            n = is_error(r) ? r.get() : 0
        }

        return new NonZeroUsize(n)
    }

    override async advance_back_by(n: number): Promise<Result<Ok, NonZeroUsize>> {
        const min = Math.min(this.len(), n);
        const rem = await this.#iter.advance_back_by(min);
        assert(!rem);
        return non_zero_usize(n - min);
    }

    override nth(n: number): Promise<IteratorResult<T>> {
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

    override async count(): Promise<number> {
        if (this.#n > 0) {
            const n = await this.#iter.nth(this.#n - 1)
            if (n.done) {
                return 0
            }
        }

        return await this.#iter.count();
    }

    override async last(): Promise<Option<T>> {
        if (this.#n > 0) {
            await this.#iter.nth(this.#n - 1);
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

        return this.#iter.try_fold(initial, fold)
    }

    override async try_rfold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Promise<Result<B, Err>> {
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
            return await this.#iter.try_rfold(initial, check(n, fold))
        }

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

    override async rfold<B>(initial: B, fold: (acc: B, x: T) => B): Promise<B> {
        const f = await this.try_rfold(initial, fold);
        return is_error(f) ? f.get() : f
    }
}

class SkipWhile<T> extends AsyncDoubleEndedIterator<T> {
    #iter: AsyncDoubleEndedIterator<T>;
    #predicate: (value: T) => boolean
    #needs_skip: boolean;
    constructor(iter: AsyncDoubleEndedIterator<T>, predicate: (value: T) => boolean) {
        super();
        this.#iter = iter;
        this.#predicate = predicate;
        this.#needs_skip = true;
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
        this.#iter.into_iter();
        return this;
    }

    override async next(): Promise<IteratorResult<T>> {
        if (!this.#needs_skip) {
            return await this.#iter.next()
        } else {
            let n;
            let is_done = false;
            while (!is_done) {
                n = await this.#iter.next();
                if (n.done) {
                    is_done = true;
                    continue
                }
                if (this.#predicate(n.value)) {
                    return n;
                }
            }
            return done();
        }
    }

    override async next_back(): Promise<IteratorResult<T>> {
        if (!this.#needs_skip) {
            return this.#iter.next_back()
        } else {
            let n;
            let is_done = false
            while (!is_done) {
                n = await this.#iter.next_back()
                if (n.done) {
                    is_done = true;
                    continue
                }
                if (this.#predicate(n.value)) {
                    return n;
                }
            }
            return done()
        }
    }

}

class StepBy<T> extends ExactSizeAsyncDoubleEndedIterator<T> {
    #iter: ExactSizeAsyncDoubleEndedIterator<T>;
    #step: number;
    #first_take: boolean;
    constructor(iter: ExactSizeAsyncDoubleEndedIterator<T>, step: number) {
        super();
        this.#iter = iter;
        this.#step = Math.max(step - 1, 0);
        this.#first_take = true;
    }

    override into_iter(): ExactSizeAsyncDoubleEndedIterator<T> {
        this.#iter.into_iter();
        return this;
    }

    override async next(): Promise<IteratorResult<T>> {
        const step_size = this.#first_take ? 0 : this.#step;
        this.#first_take = false;
        return await this.#iter.nth(step_size);
    }

    override async next_back(): Promise<IteratorResult<T>> {
        return await this.#iter.nth_back(this.#next_back_index());
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

    override async nth_back(n: number): Promise<IteratorResult<T>> {
        // n = n.saturating_mul(self.step + 1).saturating_add(self.next_back_index());
        n = (n * (this.#step + 1)) + this.#next_back_index();
        return await this.#iter.nth_back(n)
    }

    override async fold<B>(initial: B, fold: (acc: B, x: T) => B): Promise<B> {
        function nth(iter: AsyncDoubleEndedIterator<T>, step: number) {
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

        return from_async_fn(nth(this.#iter, this.#step)).fold(initial, fold as any)
    }

    override async rfold<B>(initial: B, fold: (acc: B, x: T) => B): Promise<B> {
        function nth_back(iter: ExactSizeAsyncDoubleEndedIterator<T>, step: number) {
            return async () => await iter.nth_back(step)
        }

        const n = await this.next_back();
        if (n.done) {
            return initial;
        } else {
            let acc = fold(initial, n.value);
            return await from_async_fn(nth_back(this.#iter, this.#step)).fold(acc, fold as any)
        }
    }

    override async try_fold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Promise<Result<B, Err>> {
        function nth(iter: AsyncDoubleEndedIterator<T>, step: number) {
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

    override async try_rfold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Promise<Result<B, Err>> {
        function nth_back(iter: ExactSizeAsyncDoubleEndedIterator<T>, step: number) {
            return async () => await iter.nth_back(step)
        }

        const n = await this.next_back();
        if (n.done) {
            return initial;
        } else {
            let acc = fold(initial, n.value);
            return await from_async_fn(nth_back(this.#iter, this.#step)).try_fold(acc as any, fold as any)
        }
    }
}

class Take<T> extends AsyncDoubleEndedIterator<T> {
    #iter: ExactSizeAsyncDoubleEndedIterator<T>;
    #start: number;
    #n: number
    constructor(iterable: ExactSizeAsyncDoubleEndedIterator<T>, n: number) {
        super();
        this.#iter = iterable;
        this.#start = n;
        this.#n = n;
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
        this.#n = this.#start;
        this.#iter.into_iter();
        return this;
    }

    override async next(): Promise<IteratorResult<T>> {
        if (this.#n !== 0) {
            this.#n -= 1
            return await this.#iter.next();
        } else {
            return done()
        }
    }

    override async next_back(): Promise<IteratorResult<T>> {
        if (this.#n === 0) {
            return done()
        } else {
            let n = this.#n;
            this.#n -= 1
            // const new_n = Math.max(0, (this.#iter.size_hint()[1] ?? 0) - n) 
            return await this.#iter.nth_back(this.#iter.len() - n)
        }
    }

    override async nth(n: number): Promise<IteratorResult<T>> {
        if (this.#n > n) {
            this.#n -= n + 1;
            return await this.#iter.nth(n)
        } else {
            if (this.#n > 0) {
                await this.#iter.nth(this.#n - 1)
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
            return initial
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

    override async advance_back_by(n: number): Promise<Result<Ok, NonZeroUsize>> {
        // const trim_inner = usize.saturating_sub(this.#iter.len(), this.#n);
        // let advance_by = usize.saturating_add(trim_inner, n);
        const trim_inner = this.#iter.len() + this.#n;
        let advance_by = trim_inner + n;
        const result = await this.#iter.advance_back_by(advance_by);
        const remainder = is_error(result) ? result.get() : 0;

        const advance_by_inner = advance_by - remainder;
        advance_by = advance_by_inner - trim_inner;
        this.#n -= advance_by;
        return non_zero_usize(n - advance_by);
    }

    override async nth_back(n: number): Promise<IteratorResult<T>> {
        const len = this.#iter.len();
        if (this.#n < n) {
            // let m = usize.saturating_sub(len, this.#n) + n;
            let m = len + this.#n + n;

            this.#n -= n + 1;
            return await this.#iter.nth_back(m);
        } else {
            if (len > 0) {
                return await this.#iter.nth_back(len - 1)
            }
            return done()
        }
    }

    override async try_rfold<B>(initial: B, fold: (acc: B, inc: T) => Result<B, Err>): Promise<Result<B, Err>> {
        if (this.#n === 0) {
            return initial
        } else {
            const len = this.#iter.len();
            const n = await this.#iter.nth_back(len - this.#n - 1)
            if (len > this.#n && n.done) {
                return initial
            } else {
                return await this.#iter.try_rfold(initial, fold)
            }
        }
    }

    override async rfold<B>(initial: B, fold: (acc: B, x: T) => B): Promise<B> {
        if (this.#n === 0) {
            return initial;
        } else {
            const len = this.#iter.len();
            const n = await this.#iter.nth_back(len - this.#n - 1)
            if (len > this.#n && n.done) {
                return initial;
            } else {
                return await this.#iter.rfold(initial, fold)
            }
        }
    }
}

class TakeWhile<T> extends AsyncDoubleEndedIterator<T> {
    #iter: AsyncDoubleEndedIterator<T>;
    #callback: (value: T) => boolean;
    constructor(iterable: AsyncDoubleEndedIterator<T>, callback: (value: T) => boolean) {
        super();
        this.#iter = iterable;
        this.#callback = callback;
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
        this.#iter.into_iter()
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        const n = await this.#iter.next();
        if (n.done) {
            return done()
        } else if (this.#callback(n.value)) {
            return n
        } else {
            return done();
        }
    }

    override async next_back(): Promise<IteratorResult<T>> {
        const n = await this.#iter.next_back();
        if (n.done) {
            return done()
        } else if (this.#callback(n.value)) {
            return n
        } else {
            return done();
        }
    }
}

class Peekable<T> extends AsyncDoubleEndedIterator<T> {
    #peeked: Option<IteratorResult<T>>;
    #iter: AsyncDoubleEndedIterator<T>;
    constructor(iterable: AsyncDoubleEndedIterator<T>) {
        super()
        this.#iter = iterable;
    }

    #take() {
        const peeked = this.#peeked;
        this.#peeked = null;
        return peeked;
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
        this.#iter.into_iter()
        return this
    }

    override async next(): Promise<IteratorResult<T>> {
        const peeked = this.#take();
        return peeked ? peeked : await this.#iter.next();
    }

    override async next_back(): Promise<IteratorResult<T>> {
        const peeked = this.#take();
        return peeked ? peeked : await this.#iter.next_back()
    }

    async peek() {
        if (this.#peeked) {
            return this.#peeked
        }

        this.#peeked = await this.#iter.next();
        return this.#peeked;
    }

    override async count(): Promise<number> {
        const peeked = this.#take();

        if (peeked) {
            const c = await this.#iter.count()
            return peeked.done ? 0 : 1 + c

        } else {
            return this.#iter.count();
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
            return await iter.nth(n)
        }
    }

    override async last(): Promise<Option<T>> {
        const opt = this.#take();
        let peek_opt: Option<T>;
        if (opt && opt.done) {
            peek_opt = null
        }

        peek_opt = opt ? opt.value : null;

        const l = await this.#iter.last();
        return is_some(l) ? l : peek_opt;
    }

    override async fold<B>(initial: B, f: (acc: B, x: T) => B): Promise<B> {
        const peeked = this.#peeked;
        let acc = initial;

        if (peeked && !peeked.done) {
            acc = f(initial, peeked.value)
        }

        return await this.#iter.fold(acc, f);
    }

    override async rfold<B>(initial: B, fold: (acc: B, x: T) => B): Promise<B> {
        const peeked = this.#peeked;

        if (peeked && peeked.done) {
            return initial;
        } else if (peeked && !peeked.done) {
            let acc = await this.#iter.rfold(initial, fold)
            return fold(acc, peeked.value)
        } else {
            return await this.#iter.rfold(initial, fold);
        }
    }
}

class Zip<K, V> extends AsyncDoubleEndedIterator<[K, V]> {
    #iter: AsyncDoubleEndedIterator<K>;
    #other: AsyncDoubleEndedIterator<V>;

    constructor(iterable: AsyncDoubleEndedIterator<K>, other: AsyncDoubleEndedIteratorInputType<V>, callback: (value: V) => V | Promise<V>) {
        super()
        this.#iter = iterable;
        this.#other = async_iter(other, callback as any) as unknown as AsyncDoubleEndedIterator<V>;
    }

    override into_iter(): AsyncDoubleEndedIterator<[K, V]> {

        this.#other.into_iter()
        this.#iter.into_iter()
        return this;
    }

    override async next(): Promise<IteratorResult<[K, V]>> {
        const k = await this.#iter.next()
        const v = await this.#other.next()

        return (k.done || v.done) ? done<[K, V]>() : item([k.value, v.value] as [K, V])
    }

    override async next_back(): Promise<IteratorResult<[K, V]>> {
        const k = await this.#iter.next_back()
        const v = await this.#other.next_back()

        return (k.done || v.done) ? done<[K, V]>() : item([k.value, v.value] as [K, V])
    }
}

export class AsyncOnce<T> extends AsyncDoubleEndedIterator<T> {
    #item: T;
    #taken: boolean;
    constructor(value: T) {
        super()
        this.#item = value;
        this.#taken = false;
    }

    override async next(): Promise<IteratorResult<T>> {
        const taken = this.#taken;
        this.#taken = true;
        return taken ? done() : item(this.#item);
    }

    override async next_back(): Promise<IteratorResult<T>> {
        return this.next();
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
        this.#taken = false;
        return this;
    }
}

export class AsyncOnceWith<T> extends AsyncDoubleEndedIterator<T> {
    #fn: () => Promise<T> | T;
    #taken: boolean
    constructor(fn: () => Promise<T> | T) {
        super()
        this.#fn = fn;
        this.#taken = false;
    }

    override async next(): Promise<IteratorResult<T>> {
        const taken = this.#taken;
        this.#taken = true;
        return taken ? done() : item(await this.#fn());
    }

    override async next_back(): Promise<IteratorResult<T>> {
        return await this.next();
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
        this.#taken = false;
        return this;
    }
}

export class AsyncRepeatWith<T> extends AsyncDoubleEndedIterator<T> {
    #gen: () => Promise<T> | T;
    constructor(gen: () => Promise<T> | T) {
        super();
        this.#gen = gen
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
        return this;
    }

    override async next(): Promise<IteratorResult<T>> {
        return item(await this.#gen())
    }

    override async next_back(): Promise<IteratorResult<T>> {
        return item(await this.#gen())
    }

    override async advance_by(_: number): Promise<Result<Ok, NonZeroUsize>> {
        return undefined as Ok
    }

    override async advance_back_by(_: number): Promise<Result<Ok, NonZeroUsize>> {
        return undefined as Ok
    }

    override async count(): Promise<number> {
        while (true) { }
    }

    override async last(): Promise<Option<T>> {
        return (await this.next()).value;
    }

    override async nth(_: number): Promise<IteratorResult<T>> {
        return await this.next();
    }

    override async nth_back(_: number): Promise<IteratorResult<T>> {
        return await this.next_back();
    }

    override size_hint(): [number, Option<number>] {
        return [Number.MAX_SAFE_INTEGER, null]
    }
}

export class AsyncArraylike<T> extends ExactSizeAsyncDoubleEndedIterator<T> {
    #iter: ArrayLike<T>;
    #promise: (value: T) => Promise<T> | T;
    #index: number;
    #back_index: number;
    constructor(iterable: ArrayLike<T>, fn: (value: T) => Promise<T> | T) {
        super()
        this.#iter = iterable;
        this.#promise = fn;
        this.#index = -1;
        this.#back_index = iterable.length;
    }

    async next(): Promise<IteratorResult<T>> {
        this.#index++;
        if (this.#index >= this.#back_index) {
            return done();
        }

        const n = this.#iter[this.#index];
        return is_some(n) ? item(await this.#promise(n)) : done();
    }

    async next_back(): Promise<IteratorResult<T>> {
        this.#back_index--;
        if (this.#back_index <= this.#index) {
            return done();
        }
        const n = this.#iter[this.#back_index];
        return is_some(n) ? item(await this.#promise(n)) : done();
    }

    override async eq(other: ExactSizeAsyncDoubleEndedIterator<T>): Promise<boolean> {
        if (this.len() !== other.len()) {
            return false
        }

        return await super.eq(other as any);
    }

    override async eq_by(other: ExactSizeAsyncDoubleEndedIterator<T>, eq: (a: T, b: T) => boolean): Promise<boolean> {
        if (this.len() !== other.len()) {
            return false
        }

        return super.eq_by(other as any, eq);
    }

    override async advance_by(n: number): Promise<Result<undefined, NonZeroUsize>> {
        if (n === 0) {
            return;
        }
        const m = this.#index + n;

        this.#index = m;
        return non_zero_usize(this.len() - m)
    }

    override async advance_back_by(n: number): Promise<Result<undefined, NonZeroUsize>> {
        if (n === 0) {
            return;
        }
        const m = this.#back_index - n;

        this.#back_index = m;
        return non_zero_usize(this.len() - m)
    }

    override into_iter(): ExactSizeAsyncDoubleEndedIterator<T> {
        this.#index = -1;
        this.#back_index = this.#iter.length;
        return this as any;
    }

    override size_hint(): [number, number] {
        const l = this.len()
        return [l, l]
    }

    override async count(): Promise<number> {
        return this.len();
    }

    override len(): number {
        if (this.#back_index <= this.#index) {
            return 0;
        }

        return this.#back_index - this.#index - 1;
    }
}