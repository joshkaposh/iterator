import { async_iter } from ".";
import { Err, Option, Result, is_some } from "../option";
import { MustReturn } from "../util";
import { ErrorExt, IterResult, NonZeroUsize, done, iter_item } from "./shared";

function knownsize(method: string) {
    return `AsyncIterator.${method} must be called on an Iterator with a known size`
}

export abstract class AsyncIterator<T> {
    abstract next(): Promise<IterResult<T>>;

    async next_chunk(n: number): Promise<Result<T[], Err<T[]>>> {
        const chunk: T[] = [];
        for (let i = 0; i < n; i++) {
            const n = await this.next();
            if (n.done) {
                return new ErrorExt(chunk, `length<${i}> could not satisify chunk_size<${n}>`)
            }
            chunk.push(n.value)
        }
        return chunk;
    }

    size_hint(): [number, Option<number>] {
        return [0, null];
    }

    async advance_by(n: number) {
        let i = -1;
        for await (const _ of this) {
            i++;
            if (i === n) {
                break
            }

        }

        return i < n ? new NonZeroUsize(n - i) : undefined
    }

    async any(value: T): Promise<boolean> {
        if (!is_some(this.size_hint()[1])) {
            console.error(knownsize('any'))
            return false
        }
        let seen = false;
        for await (const a of this) {
            if (a === value) {
                seen = true
                break;
            }
        }

        return seen;
    }

    async all(value: T): Promise<boolean> {
        if (!is_some(this.size_hint()[1])) {
            console.error(knownsize('any'))
            return false
        }

        let seen = false;
        for await (const a of this) {
            if (a !== value) {
                seen = true
                break;
            }
        }

        return !seen;
    }

    async collect(): Promise<T[]> {
        const [_, hi] = this.size_hint()
        if (is_some(hi)) {
            const arr = new Array(hi);
            for (let i = 0; i < hi; i++) {
                arr[i] = (await this.next()).value;
            }
            return arr;
        } else {
            const arr = [];
            for await (const v of this) {
                arr.push(v)
            }
            return arr;
        }
    }

    async count() {
        let count = 0;
        for await (const _ of this) {
            count++
        }
        return count;
    }

    cycle(): AsyncIterator<T> {
        return new AsyncCycle(this);
    }

    async eq(other: AsyncIterator<T>): Promise<boolean> {
        const [_, shi] = this.size_hint();
        const [__, ohi] = other.size_hint();

        const same_len = shi === ohi;

        if (!same_len) {
            console.log('not same len');

            return false;
        }

        for await (const o of other) {
            const v = await this.next();
            if (o !== v.value) {
                return false;
            }
        }

        return true
    }

    into_iter(): AsyncIterator<T> {
        return this;
    }

    map<B>(fn: MustReturn<(value: T) => B>) {
        return new AsyncMap(this, fn);
    }

    filter(predicate: (value: T) => boolean) {
        return new AsyncFilter(this, predicate)
    }

    async find(value: T) {
        for await (const v of this) {
            if (v === value) {
                return v;
            }
        }
        return;
    }

    async fold<Acc>(initial: Acc, fold: (acc: Acc, x: T) => Promise<Acc>): Promise<Acc> {
        let acc = initial;
        let n;
        while (!(n = await this.next()).done) {
            acc = await fold(acc, n.value);
        }

        return acc;
    }

    flatten<F extends T extends Iterable<infer Item> ? Item : never>(): AsyncIterator<F> {
        return new AsyncFlatten(this as any)
    }

    [Symbol.asyncIterator]() {
        return this;
    }
}

export interface AsyncExactSizeIterator<T> {
    size_hint(): [number, number];
}
export abstract class AsyncExactSizeIterator<T> extends AsyncIterator<T> {

    is_empty() {
        return this.len() === 0;
    }

    len(): number {
        return this.size_hint()[1]
    }
}

class AsyncCycle<T> extends AsyncIterator<T> {
    #iter: AsyncIterator<T>
    constructor(iter: AsyncIterator<T>) {
        super()
        this.#iter = iter;
    }

    override async next(): Promise<IterResult<T>> {
        const n = await this.#iter.next();
        if (n.done) {
            this.#iter.into_iter();
            return await this.#iter.next();
        } else {
            return n
        }
    }

    [Symbol.asyncIterator]() {
        return this;
    }
}

// TODO: make it so async can iterator over async or sync iterators
class AsyncMap<A, B> extends AsyncIterator<B> {
    #callback: MustReturn<(value: A) => B>;
    #iter: AsyncIterator<A>;
    constructor(iter: AsyncIterator<A>, callback: MustReturn<(value: A) => B>) {
        super()
        this.#iter = iter;
        this.#callback = callback;
    }

    override into_iter(): AsyncIterator<B> {
        this.#iter.into_iter()
        return this
    }

    async next() {
        const n = await this.#iter.next();
        return !n.done ? iter_item(this.#callback(n.value)) : done<B>();
    }

    override size_hint(): [number, Option<number>] {
        return structuredClone(this.#iter.size_hint());
    }
}

async function eval_until_found_or_done<T>(it: AsyncIterator<T>, fn: (value: any) => boolean): Promise<IterResult<T>> {
    while (true) {
        const n = await it.next();
        if (n.done) {
            break;

        }
        if (fn(n.value)) {
            return iter_item(n.value)
        }
    }

    return done();
}

class AsyncFilter<T> extends AsyncIterator<T> {
    #callback: (value: T) => boolean;
    #iter: AsyncIterator<T>;
    constructor(iter: AsyncIterator<T>, callback: (value: T) => boolean) {
        super()
        this.#iter = iter;
        this.#callback = callback;
    }

    override size_hint(): [number, Option<number>] {
        return structuredClone(this.#iter.size_hint())
    }

    override into_iter(): AsyncIterator<T> {
        this.#iter.into_iter()
        return this
    }

    async next(): Promise<IterResult<T>> {
        const n = await this.#iter.next();
        if (n.done) {
            return done()
        }

        return await eval_until_found_or_done(this.#iter, this.#callback)
    }

    // since we're in filter, we cannot determine array size.
    // note: this may take a long time as it This may be millions
    override async collect(): Promise<T[]> {
        const arr = [];
        for await (const v of this.#iter) {
            arr.push(v);
        }
        return arr;
    }
}

class AsyncFlatten<T> extends AsyncIterator<T> {
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

    override async next(): Promise<IterResult<T>> {
        if (!this.#inner) {
            const n = await this.#outter.next();
            if (n.done) {
                return done()
            }

            this.#inner = async_iter(n.value)
        }

        const nextin = await this.#inner.next();
        if (!nextin.done) {
            return nextin
        } else {
            const n = await this.#outter.next();
            if (n.done) {
                return done()
            }

            this.#inner = async_iter(n.value)
            return await this.#inner.next();
        }
    }
}