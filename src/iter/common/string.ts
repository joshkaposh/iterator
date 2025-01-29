import { ErrorExt, is_some, Ok, Result } from "joshkaposh-option";
import { done, item, NonZeroUsize } from "../../shared";
import { ExactSizeDoubleEndedIterator } from "../base/double-ended-iterator";


export interface StringIterator<T extends string> {
    rev(): Rev<T>;
}
export class StringIterator<T extends string> extends ExactSizeDoubleEndedIterator<T> {
    private iterable: T;
    #index: number;
    #back_index: number;

    constructor(iterable: T, index = -1, back_index = iterable.length) {
        super()
        this.iterable = iterable;
        this.#index = index;
        this.#back_index = back_index;
    }

    override clone(): StringIterator<T> {
        return new StringIterator(this.iterable, this.#index, this.#back_index)
    }

    next(): IteratorResult<T> {
        this.#index++;
        if (this.#index >= this.#back_index) {
            return done();
        }

        const elt = this.iterable[this.#index] as T;
        return is_some(elt) ? item(elt) : done();
    }

    next_back(): IteratorResult<T> {
        this.#back_index--;
        if (this.#back_index <= this.#index) {
            return done<T>();
        }
        const elt = this.iterable[this.#back_index] as T
        return is_some(elt) ? item(elt) : done();
    }

    override rev(): Rev<T> {
        return new Rev(this)
    }

    split(char: string) {
        return new Split(this as unknown as ExactSizeDoubleEndedIterator<string>, char);
    }

    rsplit(char: string) {
        return new Rsplit(this as unknown as ExactSizeDoubleEndedIterator<string>, char);
    }

    override advance_by(n: number): Result<Ok, NonZeroUsize> {
        if (n === 0) {
            return;
        }
        const m = this.#index + n;

        this.#index = m;
        return new NonZeroUsize(this.len() - m)
    }

    override advance_back_by(n: number): Result<Ok, NonZeroUsize> {
        if (n === 0) {
            return;
        }
        const m = this.#back_index - n;

        this.#back_index = m;
        return new NonZeroUsize(this.len() - m)
    }

    override into_iter(): ExactSizeDoubleEndedIterator<T> {
        this.#index = -1;
        this.#back_index = this.iterable.length;
        return this;
    }

    override size_hint(): [number, number] {
        return [0, this.iterable.length]
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

class Rev<T extends string> extends ExactSizeDoubleEndedIterator<T> {
    #iterable: ExactSizeDoubleEndedIterator<T>
    constructor(iterable: ExactSizeDoubleEndedIterator<T>) {
        super();
        this.#iterable = iterable;
    }

    override next(): IteratorResult<T, any> {
        return this.#iterable.next_back();
    }

    override next_back(): IteratorResult<T, any> {
        return this.#iterable.next();
    }
    split(char: string) {
        return new Split(this as unknown as ExactSizeDoubleEndedIterator<string>, char);
    }

    rsplit(char: string) {
        return new Rsplit(this as unknown as ExactSizeDoubleEndedIterator<string>, char);
    }

    override advance_by(n: number): Result<Ok, NonZeroUsize> {
        return this.#iterable.advance_by(n);

    }

    override advance_back_by(n: number): Result<Ok, NonZeroUsize> {
        return this.#iterable.advance_back_by(n);
    }

    override into_iter(): ExactSizeDoubleEndedIterator<T> {
        this.#iterable.into_iter();
        return this;
    }

    override size_hint(): [number, number] {
        return this.#iterable.size_hint();
    }

    override count(): number {
        return this.len();
    }

    override len(): number {
        return this.#iterable.len();
    }


}

class Split<T extends string> extends ExactSizeDoubleEndedIterator<T> {
    #splitter: string;
    #iterable: ExactSizeDoubleEndedIterator<string>;
    constructor(iterable: ExactSizeDoubleEndedIterator<string>, splitter: string) {
        super();
        this.#iterable = iterable;
        this.#splitter = splitter;
    }

    override next(): IteratorResult<T> {
        // construct a string that terminates when we encounter the 'splitter' character
        const splitter = this.#splitter;
        const str = this.#iterable.try_fold('' as string, (acc, x) => {
            return x === splitter ? new ErrorExt(acc) : acc += x;
        })

        if (!(str instanceof ErrorExt)) {
            // string is either an empty string or the last substring of `iterable`
            return str.length > 0 ? item(str as T) : done();
        } else {
            return item(str.get());
        }
    }

    override next_back(): IteratorResult<T> {
        const splitter = this.#splitter;
        const str = this.#iterable.try_rfold('' as string, (acc, x) => {
            return x === splitter ? new ErrorExt(acc) : acc += x;
        })

        if (!(str instanceof ErrorExt)) {
            // string is either an empty string or the last substring of `iterable`
            return str.length > 0 ? item(str as T) : done();
        } else {
            return item(str.get());
        }
    }
}

class Rsplit<T extends string> extends ExactSizeDoubleEndedIterator<T> {
    #splitter: string;
    #iterable: ExactSizeDoubleEndedIterator<string>;
    constructor(iterable: ExactSizeDoubleEndedIterator<string>, splitter: string) {
        super();
        this.#iterable = iterable;
        this.#splitter = splitter;
    }

    override next(): IteratorResult<T> {
        // construct a string that terminates when we encounter the 'splitter' character
        const splitter = this.#splitter;
        const str = this.#iterable.try_rfold('' as string, (acc, x) => {
            return x === splitter ? new ErrorExt(acc) : acc = `${x}${acc}`;
        })

        if (!(str instanceof ErrorExt)) {
            // string is either an empty string or the last substring of `iterable`
            return str.length > 0 ? item(str as T) : done();
        } else {
            return item(str.get());
        }
    }

    override next_back(): IteratorResult<T> {
        const splitter = this.#splitter;
        const str = this.#iterable.try_fold('' as string, (acc, x) => {
            return x === splitter ? new ErrorExt(acc) : acc = `${x}${acc}`;
        })

        if (!(str instanceof ErrorExt)) {
            // string is either an empty string or the last substring of `iterable`
            return str.length > 0 ? item(str as T) : done();
        } else {
            return item(str.get());
        }
    }
}