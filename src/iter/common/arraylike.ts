import { is_some, Ok, Result } from "joshkaposh-option";
import { done, item, NonZeroUsize } from "../../shared";
import { ArrayLikeType } from "../../types";
import { ExactSizeDoubleEndedIterator } from "../base/double-ended-iterator";

export class ArrayLike<T> extends ExactSizeDoubleEndedIterator<T> {
    #iterable: ArrayLikeType<T>;
    #index: number;
    #back_index: number;

    constructor(iterable: ArrayLikeType<T>, index = -1, back_index = iterable.length) {
        super()
        this.#iterable = iterable;
        this.#index = index;
        this.#back_index = back_index;
    }

    override clone(): ArrayLike<T> {
        return new ArrayLike(this.#iterable, this.#index, this.#back_index)
    }

    next(): IteratorResult<T> {
        this.#index++;
        if (this.#index >= this.#back_index) {
            return done();
        }

        const elt = this.#iterable[this.#index];
        return is_some(elt) ? item(elt) : done();
    }

    next_back(): IteratorResult<T> {
        this.#back_index--;
        if (this.#back_index <= this.#index) {
            return done<T>();
        }
        const elt = this.#iterable[this.#back_index]
        return is_some(elt) ? item(elt) : done();
    }

    override advance_by(n: number): Result<Ok, NonZeroUsize> {
        if (n === 0) {
            return;
        }
        const m = this.#index + n;

        this.#index = m;
        return new NonZeroUsize(this.len() - m)
    }

    override advance_back_by(n: number): Result<Ok, NonZeroUsize> {
        if (n === 0) {
            return;
        }
        const m = this.#back_index - n;

        this.#back_index = m;
        return new NonZeroUsize(this.len() - m)
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
