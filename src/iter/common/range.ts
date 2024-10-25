import { done, item } from "../../shared";
import { SizeHint } from "../../types";
import { ExactSizeDoubleEndedIterator } from "../base/double-ended-iterator";

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

        return item(this.#index);
    }

    next_back(): IteratorResult<number> {
        this.#back_index--;
        if (this.#index >= this.#back_index) {
            return done()
        }

        return item(this.#back_index);
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
* Creates a [`DoubleEndedIterator`] from start ... end.
* @throws This function **throws** a [`RangeError`] if `start > end`.
*/
export function range(start: number, end: number): Range {
    if (start > end) {
        throw new RangeError(`Range start ${start} cannot be greater than end ${end}`)
    }
    return new Range(start, end);
}