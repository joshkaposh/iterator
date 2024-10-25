import { GeneratorType } from "../../types";
import { Iterator } from "../base/iterator";

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
