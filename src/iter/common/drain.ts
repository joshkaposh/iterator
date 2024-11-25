import iter from "..";
import { done, item } from "../../shared";
import { ExactSizeDoubleEndedIterator } from "../base/double-ended-iterator";
import { Range } from "./range";

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
     * Drains the rest of the unyielded elements of [`Drain`]
     */
    drop(): ExactSizeDoubleEndedIterator<T> {
        while (!this.next().done) {

        }
        return iter(this.#taken);
    }

    /**
     * Keep unyielded elements in the source `Array`.
     */
    keep_rest() {
        this.#range.nth(this.#range.end);
    }

    override into_iter(): ExactSizeDoubleEndedIterator<T> {
        console.warn('into_iter() will do nothing on drain as it will result in unexpected behaviour such as removing unwanted elements.');
        return this
    }

    override next(): IteratorResult<T> {
        const n = this.#range.next();
        if (!n.done) {
            const index = n.value - this.#taken.length;
            const elt = this.#array[index];
            this.#taken.push(elt);
            this.#array.splice(index, 1);
            return item(elt);
        }
        return done();

    }

    override next_back(): IteratorResult<T> {

        const n = this.#range.next_back();
        if (!n.done) {
            const index = n.value - this.#taken.length;
            const elt = this.#array[index];
            this.#array.splice(index, 1);
            return item(elt);
        }
        return done();

    }
}

/**
* Removes the specified range from the array in bulk, returning all removed elements as an iterator. If the iterator is dropped before being fully consumed, it drops the remaining removed elements. The returned iterator keeps a mutable borrow on the array to optimize its implementation.
* @throws if the starting point is greater than the end point or if the end point is greater than the length of the array.
 */
export function drain<T>(array: T[]): Drain<T>;
export function drain<T>(array: T[], from: number, to: number): Drain<T>;
export function drain<T>(array: T[], r: Range): Drain<T>;
export function drain<T>(array: T[], r?: Range | number, to?: number): Drain<T> {
    if (arguments.length === 1) {
        r = new Range(0, array.length)
    } else if (!(r instanceof Range)) {
        r = new Range(r as number, to!)
    }

    if (r.start > r.end) {
        throw new RangeError(`Range end ${r.end} cannpt exceed Array length ${array.length}`)
    }

    return new Drain(array, r);
}