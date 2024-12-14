import { done, item } from "../../shared";
import { ExactSizeDoubleEndedIterator } from "../base/double-ended-iterator";

export class Once<T> extends ExactSizeDoubleEndedIterator<T> {
    #elt: T;
    #taken: boolean;
    constructor(value: T, taken = false) {
        super()
        this.#elt = value;
        this.#taken = taken;
    }

    override clone(): Once<T> {
        return new Once(this.#elt, this.#taken)
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
    constructor(fn: () => T, taken = false) {
        super()
        this.#fn = fn;
        this.#taken = taken;
    }

    override clone(): OnceWith<T> {
        return new OnceWith(this.#fn, this.#taken)
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