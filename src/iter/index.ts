import { is_arraylike, is_primitive } from "../util";
import { ArrayLike, DoubleEndedIterator, ExactSizeDoubleEndedIterator, FusedDoubleEndedIterator, range, Range, drain } from "./double-ended-iterator";
import { Iterator, Generator, from_fn, FusedIterator, ExactSizeIterator } from "./iterator";
import type { IterInputType, Iter, ArrayLikeType, Item, GeneratorType } from '../types'
import { iter_type, done, item, NonZeroUsize } from "../shared";
import { is_some, Ok, Option, Result } from "joshkaposh-option";

/**
 * Primary way to create an Iterator. Iterators can also be created by functions provided by the library, or classes extending `Iterator`
 * @returns Returns an Iterator with 
 */
export default function iter<It extends IterInputType<any>>(iterable: It): Iter<It> {
    const ty = iter_type(iterable);
    if (ty === 'iter') {
        return iterable as unknown as Iter<It>;
    } else if (ty === 'arraylike') {
        return new ArrayLike(iterable as ArrayLikeType<Item<It>>) as unknown as Iter<It>
    } else if (ty === 'iterable') {
        // @ts-expect-error
        return new Generator(() => iterable[Symbol.iterator]()) as unknown as Iter<It>
    } else if (ty === 'function') {
        //! SAFETY: User ensures provided function returns an Iterator
        return new Generator(iterable as () => GeneratorType<Item<It>>) as unknown as Iter<It>
    } else {
        const msg = is_primitive(iterable) ?
            `Cannot construct an Iterator from primitive '${String(iterable)}'` :
            `Iter cannot construct an Iterator from an object that is not Arraylike or has no [Symbol.iterator] method.`
        throw new Error(msg)
    }
}

// * --- Free standing functions ---

class Successors<T> extends Iterator<T> {
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

class Once<T> extends DoubleEndedIterator<T> {
    #item: T;
    #taken: boolean;
    constructor(value: T) {
        super()
        this.#item = value;
        this.#taken = false;
    }

    override next(): IteratorResult<T> {
        const taken = this.#taken;
        this.#taken = true;
        return taken ? done() : item(this.#item);
    }

    override next_back(): IteratorResult<T> {
        return this.next();
    }

    override into_iter(): DoubleEndedIterator<T> {
        this.#taken = false;
        return this;
    }
}

class OnceWith<T> extends DoubleEndedIterator<T> {
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

    override into_iter(): DoubleEndedIterator<T> {
        this.#taken = false;
        return this;
    }
}

class Repeat<T> extends DoubleEndedIterator<T> {
    #element: T;
    constructor(value: T) {
        super()
        this.#element = value;
    }

    override into_iter(): DoubleEndedIterator<T> {
        return this
    }

    override next(): IteratorResult<T> {
        return item(this.#element)
    }

    override next_back(): IteratorResult<T> {
        return item(this.#element)
    }

    override advance_by(_: number): Result<Ok, NonZeroUsize> {
        return undefined as Ok
    }

    override advance_back_by(_: number): Result<Ok, NonZeroUsize> {
        return undefined as Ok
    }

    override count(): number {
        while (true) { }
    }

    override last(): Option<T> {
        while (true) { }
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

class RepeatWith<T> extends DoubleEndedIterator<T> {
    #gen: () => T;
    constructor(gen: () => T) {
        super();
        this.#gen = gen
    }

    override next(): IteratorResult<T> {
        return item(this.#gen())
    }

    override next_back(): IteratorResult<T> {
        return item(this.#gen())
    }

    override advance_by(_: number): Result<Ok, NonZeroUsize> {
        return undefined as Ok
    }

    override advance_back_by(_: number): Result<Ok, NonZeroUsize> {
        return undefined as Ok
    }

    override count(): number {
        while (true) { }
    }

    override last(): Option<T> {
        while (true) { }
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

iter.of = function <T>(...t: T[]): ExactSizeDoubleEndedIterator<T> {
    return new ArrayLike(t);
}
/**
 * 
 * @summary 
 * Creates an Iterator that will call the supplied callback on each iteration.
 * Iteration ends when when the callback returns None
 * @example
 * let count = 0;
 * from_fn(() => {
        count++;
        return count > 5 ? null : count;
    }}).collect() // [1, 2, 3, 4, 5]
 * 
 */
iter.from_fn = from_fn;

/**
* successors() takes two arguments, a 'first', and 'succ'.
* 
* 'first' will be the first element of the Iterator.
* succ() takes in the previous element, and returns the current element for next iteration.

* It will create an Iterator which will keep yielding elements until None is encountered.
* If 'first' was None, the resulting Iterator will be empty.
 */
iter.successors = function <T>(first: Option<T>, succ: (value: T) => Option<T>): Successors<T> {
    return new Successors(first, succ)
}
iter.once = function <T>(value: T) {
    return new Once(value)
};
iter.once_with = function <T>(fn: () => T) {
    return new OnceWith(fn)
};
iter.repeat = function <T>(value: T) {
    return new Repeat(value)
};
iter.repeat_with = function <T>(fn: () => T) {
    return new RepeatWith(fn)
};

const {
    once,
    once_with,
    repeat,
    repeat_with,
    successors
} = iter

export {
    iter,
    range,
    from_fn,
    once,
    once_with,
    repeat,
    repeat_with,
    successors,

    done,
    item,

    drain,
    is_arraylike,

    Iterator,
    ExactSizeIterator,
    FusedIterator,

    DoubleEndedIterator,
    ExactSizeDoubleEndedIterator,
    FusedDoubleEndedIterator,

    Generator,
    ArrayLike,
    Range,
    Once,
    OnceWith,
    Repeat,
    RepeatWith
}