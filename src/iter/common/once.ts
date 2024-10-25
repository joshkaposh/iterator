import { done, item } from "../../shared";
import { ExactSizeDoubleEndedIterator } from "../base/double-ended-iterator";

export class Once<T> extends ExactSizeDoubleEndedIterator<T> {
    #elt: T;
    #taken: boolean;
    constructor(value: T) {
        super()
        this.#elt = value;
        this.#taken = false;
    }

    override next(): IteratorResult<T> {
        const taken = this.#taken;
        this.#taken = true;
        return taken ? done() : item(this.#elt);
    }

    override next_back(): IteratorResult<T> {
        return this.next();
    }

    override into_iter(): ExactSizeDoubleEndedIterator<T> {
        this.#taken = false;
        return this;
    }

    override len(): number {
        // @ts-expect-error;
        return +taken
    }
}

export class OnceWith<T> extends ExactSizeDoubleEndedIterator<T> {
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
        return taken ? done() : item(this.#fn());
    }

    override next_back(): IteratorResult<T> {
        return this.next();
    }

    override into_iter(): ExactSizeDoubleEndedIterator<T> {
        this.#taken = false;
        return this;
    }

    override len(): number {
        // @ts-expect-error;
        return +taken
    }
}