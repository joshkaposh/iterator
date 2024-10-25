import { Ok, Option, Result } from "joshkaposh-option";
import { DoubleEndedIterator } from "../base/double-ended-iterator";
import { item, NonZeroUsize } from "../../shared";

export class Repeat<T> extends DoubleEndedIterator<T> {
    #elt: T;
    constructor(value: T) {
        super()
        this.#elt = value;
    }

    override into_iter(): DoubleEndedIterator<T> {
        return this
    }

    override next(): IteratorResult<T> {
        return item(this.#elt)
    }

    override next_back(): IteratorResult<T> {
        return item(this.#elt)
    }

    override advance_by(_: number): Result<Ok, NonZeroUsize> {
        return undefined as Ok
    }

    override advance_back_by(_: number): Result<Ok, NonZeroUsize> {
        return undefined as Ok
    }

    override count(): number {
        return Infinity
    }

    override last(): Option<T> {
        const n = this.next_back();
        return !n.done ? n.value : undefined;
    }

    override nth(_: number): IteratorResult<T> {
        return this.next();
    }

    override nth_back(_: number): IteratorResult<T> {
        return this.next_back();
    }

    override size_hint(): [number, Option<number>] {
        return [Number.MAX_SAFE_INTEGER, null]
    }
}

export class RepeatWith<T> extends DoubleEndedIterator<T> {
    #fn: () => T;
    constructor(fn: () => T) {
        super();
        this.#fn = fn
    }

    override next(): IteratorResult<T> {
        return item(this.#fn())
    }

    override next_back(): IteratorResult<T> {
        return item(this.#fn())
    }

    override advance_by(_: number): Result<Ok, NonZeroUsize> {
        return undefined as Ok
    }

    override advance_back_by(_: number): Result<Ok, NonZeroUsize> {
        return undefined as Ok
    }

    override count(): number {
        return Infinity;
    }

    override last(): Option<T> {
        const n = this.next_back();
        return !n.done ? n.value : undefined;
    }

    override nth(_: number): IteratorResult<T> {
        return this.next();
    }

    override nth_back(_: number): IteratorResult<T> {
        return this.next_back();
    }

    override size_hint(): [number, Option<number>] {
        return [Number.MAX_SAFE_INTEGER, null]
    }
}
