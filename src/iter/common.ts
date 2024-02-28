
import { Iterator } from "./iterator";
import { ExactSizeDoubleEndedIterator } from './double-ended-iterator'
import { type IterResult, NonZeroUsize, done, iter_item, non_zero_usize } from "./shared";
import { type Result, is_some } from "../option";

export class IterIterable<T> extends Iterator<T> {
    __iterable: IterableIterator<T>
    constructor(iterable: IterableIterator<T>) {
        super()
        this.__iterable = iterable;
    }

    override into_iter(): Iterator<T> {
        return this
    }

    override next(): IterResult<T> {
        return this.__iterable.next() as IterResult<T>;
    }
}

export class IterGenerator<T> extends IterIterable<T> {
    #into_iter: () => Generator<T>;
    constructor(into_iter: () => Generator<T>) {
        super(into_iter());
        this.#into_iter = into_iter;
    }

    override into_iter(): IterGenerator<T> {
        this.__iterable = this.#into_iter();
        return this
    }
}

export class IterArrayLike<T> extends ExactSizeDoubleEndedIterator<T> {
    #iterable: ArrayLike<T>;
    #index: number;
    #back_index: number;

    constructor(iterable: ArrayLike<T>) {
        super()
        this.#iterable = iterable;
        this.#index = -1;
        this.#back_index = iterable.length;
    }

    next(): IterResult<T> {
        this.#index++;
        if (this.#index >= this.#back_index) {
            return done();
        }

        const item = this.#iterable[this.#index]
        return is_some(item) ? iter_item(item) : done();
    }

    next_back(): IterResult<T> {
        this.#back_index--;
        if (this.#back_index <= this.#index) {
            return done<T>();
        }
        const item = this.#iterable[this.#back_index]
        return is_some(item) ? iter_item(item) : done();
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

    override into_iter(): IterArrayLike<T> {
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

export type MutFn<T> = (fn: (value: T) => T) => T

export class IterMut<T> extends ExactSizeDoubleEndedIterator<[number, T]> {
    #iterable: ArrayLike<T>;
    #index: number;
    #back_index: number;

    constructor(iterable: ArrayLike<T>) {
        super()
        this.#iterable = iterable;
        this.#index = -1;
        this.#back_index = iterable.length;
    }

    set(i: number, value: T) {
        // @ts-expect-error
        this.#iterable[i] = value;
        console.log(this.#iterable[i]);

    }

    next(): IterResult<[number, T]> {
        this.#index++;
        if (this.#index >= this.#back_index) {
            return done();
        }
        const item = this.#iterable[this.#index]

        return is_some(item) ? iter_item([this.#index, item] as [number, T]) : done();
    }

    next_back(): IterResult<[number, T]> {
        this.#back_index--;
        if (this.#back_index <= this.#index) {
            return done();
        }
        const item = this.#iterable[this.#back_index]
        return is_some(item) ? iter_item([this.#back_index, item] as [number, T]) : done();
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

    override into_iter(): IterMut<T> {
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

export class IterObject<K extends PropertyKey, V, Item = [K, V]> extends IterArrayLike<Item> {
    #object: Record<K, V>;
    constructor(object: Record<K, V>, method?: 'entries' | 'keys' | 'values') {
        super(Object[method ?? 'entries'](object))
        this.#object = object;
    }

    keys(): IterObject<K, V, K> {
        return new IterObject(this.#object, 'keys')
    }
    values(): IterObject<K, V, V> {
        return new IterObject(this.#object, 'values')
    }
    entries(): IterObject<K, V> {
        return new IterObject(this.#object, 'entries')
    }
}

export class Range {
    readonly start: number;
    readonly end: number;
    #index: number;
    #back_index: number;

    constructor(start: number, end: number) {
        this.start = start;
        this.end = end;
        this.#index = start - 1;
        this.#back_index = end;
    }

    next(): IterResult<number> {
        this.#index++;
        if (this.#index >= this.end) {
            return done()
        }

        return {
            done: false,
            value: this.#index
        }
    }

    next_back(): IterResult<number> {
        this.#back_index--;
        if (this.#back_index <= this.start) {
            return done()
        }

        return {
            done: false,
            value: this.#back_index
        }
    }
    [Symbol.iterator]() {
        return this;
    }
}

function range(start = 0, end = 0) {
    return new Range(start, end);
}

range.to = (end: number) => new Range(0, end);

export { range }
