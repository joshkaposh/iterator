
import { Iterator } from "./iterator";
import { DoubleEndedIterator, ExactSizeDoubleEndedIterator } from './double-ended-iterator'
import { type ArrayLikeType, type GeneratorType, type IterResult, NonZeroUsize, done, iter_item, non_zero_usize } from "./shared";
import { type Result, is_some } from "../option";

export class Generator<T> extends Iterator<T> {
    #into_iter: () => GeneratorType<T>;
    #iter: GeneratorType<T>;
    constructor(into_iter: () => GeneratorType<T>) {
        super();
        this.#into_iter = into_iter;
        this.#iter = into_iter();
    }

    override next(): IterResult<T> {
        return this.#iter.next() as IterResult<T>;
    }

    override into_iter(): Generator<T> {
        this.#iter = this.#into_iter();
        return this
    }
}

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

    next(): IterResult<number> {
        this.#index++;
        if (this.#index >= this.#back_index) {
            return done()
        }

        return iter_item(this.#index)
    }

    next_back(): IterResult<number> {
        this.#back_index--;
        if (this.#back_index <= this.#index) {
            return done()
        }

        return iter_item(this.#back_index)
    }
}

export function range(start = 0, end = 0) {
    return new Range(start, end);
}

range.to = (end: number) => new Range(0, end);

