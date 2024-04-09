
import { Iterator } from "./iterator";
import { ExactSizeDoubleEndedIterator } from './double-ended-iterator'
import { type ArrayLikeType, type GeneratorType, NonZeroUsize, done, iter_item, non_zero_usize } from "./shared";
import { type Result, is_some } from "../option";

export class Generator<T> extends Iterator<T> {
    #into_iter: () => GeneratorType<T>;
    #iter: GeneratorType<T>;
    constructor(into_iter: () => GeneratorType<T>) {
        super();
        this.#into_iter = into_iter;
        this.#iter = into_iter();
    }

    override next(): IteratorResult<T> {
        return this.#iter.next()
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

    next(): IteratorResult<T> {
        this.#index++;
        if (this.#index >= this.#back_index) {
            return done();
        }

        const item = this.#iterable[this.#index];
        return is_some(item) ? iter_item(item) : done();
    }

    next_back(): IteratorResult<T> {
        this.#back_index--;
        if (this.#back_index <= this.#index) {
            return done<T>();
        }
        const item = this.#iterable[this.#back_index]
        return is_some(item) ? iter_item(item) : done();
    }

    override eq(other: ArrayLike<T>): boolean {
        if (this.len() !== other.len()) {
            return false
        }

        return super.eq(other);
    }

    override eq_by(other: ArrayLike<T>, eq: (a: T, b: T) => boolean): boolean {
        if (this.len() !== other.len()) {
            return false
        }

        return super.eq_by(other, eq);
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

        return iter_item(this.#index)
    }

    next_back(): IteratorResult<number> {
        this.#back_index--;
        if (this.#back_index <= this.#index) {
            return done()
        }

        return iter_item(this.#back_index)
    }
}

/**
* @returns Iterator from start ... end
*/
export function range(start: number, end: number) {
    return new Range(start, end);
}

export class Drain<T> extends ExactSizeDoubleEndedIterator<T> {
    #array: T[];
    #range: Range;

    // // Index of tail to preserve
    // __tail_start: number;
    // // Length of tail
    // __tail_len: number;
    // // Current remaining range to remove
    // __iter: ExactSizeDoubleEndedIterator<T>;
    // __vec: T[];

    constructor(array: T[], range: Range) {
        super()
        this.#array = array;
        this.#range = range;
    }

    // Keep unyielded elements in the source `Vec`.
    keep_rest() {
        // const source_vec = this.__vec;
        // const start = source_vec.length;
        // const tail = this.__tail_start;

        // const unyielded_len = this.__iter.len();
        // let unyielded_ptr = this.iter.as_slice().as_ptr();

        // let start_ptr = source_vec.as_mut_ptr().add(start);

    }

    // override collect(into?: undefined): T[];
    // override collect<I extends new (it: Iterable<T>) => any>(into: I): InstanceType<I>;
    // override collect<I extends new (it: Iterable<T>) => any>(into?: I | undefined): T[] | InstanceType<I> {
    //     if (this.#range.start === 0 && this.#range.end === this.#array.length) {
    //         console.log('Draining all items');

    //         const copy = structuredClone(this.#array);
    //         const len = this.#array.length;
    //         this.#array = new Array(len);
    //         return into ? new into(copy) : copy;
    //     }
    // }

    override into_iter(): ExactSizeDoubleEndedIterator<T> {
        return this
    }

    override next(): IteratorResult<T> {
        const n = this.#range.next();

        if (n.done) {
            return done()
        } else {
            const index = n.value;
            const elt = this.#array[index];
            delete this.#array[index];
            return iter_item(elt)
        }
    }

    override next_back(): IteratorResult<T> {
        const n = this.#range.next_back();
        if (n.done) {
            return done()
        } else {
            const index = n.value;
            const elt = this.#array[index];
            delete this.#array[index];
            return iter_item(elt)
        }

    }
}

/**
 * @description
* Removes the specified range from the array in bulk, returning all removed elements as an iterator. If the iterator is dropped before being fully consumed, it drops the remaining removed elements.
* The returned iterator keeps a mutable borrow on the array to optimize its implementation.
* @throws if the starting point is greater than the end point or if the end point is greater than the length of the array.
 */
export function drain<T>(array: T[], range: Range): Drain<T> {
    return new Drain(array, range);
}


