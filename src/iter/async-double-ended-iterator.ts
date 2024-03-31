import { async_iter } from '.';
import { Option } from '../option';
import { AsyncIterator } from './async-iterator';
import { IterResult, done } from './shared';

export abstract class AsyncDoubleEndedIterator<T> extends AsyncIterator<T> {
    abstract next_back(): Promise<IterResult<T>>;

    rev() {
        return new Rev(this);
    }

    async rfind(value: T) {
        for await (const v of this) {
            if (v === value) {
                return v;
            }
        }
        return;
    }

    rfold<Acc>(initial: Acc, fold: (acc: Acc, x: T) => Acc) { }

    override flatten<F extends T extends Iterable<infer Item> ? Item : never>(): AsyncDoubleEndedIterator<F> {
        return new Flatten(this as any);
    }

}

class Rev<T> extends AsyncDoubleEndedIterator<T> {
    #iter: AsyncDoubleEndedIterator<T>
    constructor(iter: AsyncDoubleEndedIterator<T>) {
        super();
        this.#iter = iter;
    }

    override into_iter(): AsyncIterator<T> {
        this.#iter.into_iter()
        return this;
    }

    override async next(): Promise<IterResult<T>> {
        return await this.#iter.next_back();
    }

    override async next_back(): Promise<IterResult<T>> {
        return await this.#iter.next();
    }
}

class Flatten<T> extends AsyncDoubleEndedIterator<T> {
    #outter: AsyncDoubleEndedIterator<AsyncDoubleEndedIterator<T>>;
    #frontiter: Option<AsyncDoubleEndedIterator<T>>;
    #backiter: Option<AsyncDoubleEndedIterator<T>>;

    constructor(iterable: AsyncDoubleEndedIterator<AsyncDoubleEndedIterator<T>>) {
        super()
        this.#outter = iterable;
    }

    override into_iter(): AsyncDoubleEndedIterator<T> {
        this.#outter.into_iter();
        return this;
    }

    override async next(): Promise<IterResult<T>> {
        if (!this.#frontiter) {
            const n = (await this.#outter.next()).value;

            if (!n) {
                return this.#backiter ? this.#backiter.next() : done()
            }

            this.#frontiter = async_iter(n);
        }

        const n = await this.#front_loop(this.#frontiter);

        if (n.done) {
            if (this.#backiter) {
                return this.#front_loop(this.#backiter)
            } else {
                return done()
            }
        }

        return n
    }

    override async next_back(): Promise<IterResult<T>> {
        if (!this.#backiter) {

            const n = (await this.#outter.next_back()).value;
            if (!n) {
                return this.#frontiter ? this.#frontiter.next_back() : done()
            }
            this.#backiter = async_iter(n);
        }

        const n = await this.#back_loop(this.#backiter);

        if (n.done) {
            if (this.#frontiter) {
                return this.#back_loop(this.#frontiter)
            } else {
                return done()
            }
        }

        return n
    }

    async #front_loop(it: AsyncDoubleEndedIterator<T>): Promise<IterResult<T>> {
        let n = await it.next();

        if (n.done) {
            // advance outter
            const outter = await this.#outter.next();
            if (outter.done) {
                // outter is done
                return done();
            } else {
                it = async_iter(outter.value);
                // just advanced outter, so return new n;
                this.#frontiter = it;
                return await it.next()
            }

        } else {
            return n
        }
    }

    async #back_loop(it: AsyncDoubleEndedIterator<T>): Promise<IterResult<T>> {

        let n = await it.next_back();

        if (n.done) {
            // advance outter
            const outter = await this.#outter.next_back();
            if (outter.done) {
                // outter is done
                return done();
            } else {
                // just advanced outter, so return new n;
                this.#backiter = async_iter(outter.value);
                return this.#backiter.next_back()
            }

        } else {
            return n
        }
    }
}