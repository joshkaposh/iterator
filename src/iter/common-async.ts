import { AsyncDoubleEndedIterator } from "./async-double-ended-iterator";
import { AsyncIterator } from "./async-iterator";
import { IterResult } from "./shared";

export class AsyncArraylike<T> extends AsyncDoubleEndedIterator<T> {
    #front = -1;
    #back: number;

    #iter: ArrayLike<T>;
    constructor(it: ArrayLike<T>) {
        super()
        this.#iter = it;
        this.#back = it.length;
    }

    override into_iter(): AsyncIterator<T> {
        this.#front = -1;
        this.#back = this.#iter.length;
        return this
    }

    async next(): Promise<IterResult<T>> {
        this.#front++;
        return this.#front >= this.#back ?
            { done: true, value: undefined as any } :
            { done: false, value: this.#iter[this.#front] };
    }

    override async next_back(): Promise<IterResult<T>> {
        this.#back--
        return this.#back <= this.#front ?
            { done: true, value: undefined as any } :
            { done: false, value: this.#iter[this.#back] };
    }
}