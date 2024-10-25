import { is_some, Option } from "joshkaposh-option";
import { Iterator } from "../base/iterator";
import { done, item } from "../../shared";

export class Successors<T> extends Iterator<T> {
    #next: Option<T>;
    #first: Option<T>;
    #succ: (value: T) => Option<T>;
    constructor(first: Option<T>, succ: (value: T) => Option<T>) {
        super()
        this.#first = first;
        this.#next = first;
        this.#succ = succ;
    }

    override into_iter(): Iterator<T> {
        this.#next = this.#first;
        return this;
    }

    override next(): IteratorResult<T> {
        const next = this.#next
        if (!is_some(next)) {
            return done();
        }
        const value = this.#succ(next);
        this.#next = value;
        return item(next);
    }

    override size_hint(): [number, Option<number>] {
        return is_some(this.#next) ? [1, null] : [0, 0]
    }
}