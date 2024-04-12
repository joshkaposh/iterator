import { Ok, is_error, type AsOption, type Err, type Option, type Result } from "../option";

export type ArrayLikeType<T> = ArrayLike<T>;
export type GeneratorType<T> = Generator<T>;

export type Item<It> = It extends Iterable<infer T> ? T : never;

export type SizeHint<Lo = number, Hi = Option<number>> = [Lo, Hi]

export type MustReturn<F extends (...args: any[]) => any> = ReturnType<F> extends void ? never : F;
export type Primitive = string | number | bigint | boolean | undefined | null | symbol;

export function done<TReturn>(): IteratorResult<TReturn> {
    return {
        done: true,
        value: undefined as TReturn
    }
}

export function iter_item<T>(value: T): IteratorYieldResult<T> {
    return {
        done: false,
        value: value
    }
}


export class ErrorExt<T = any> extends Error implements Err {
    #err_data: T;
    static opt<R extends Result<unknown, ErrorExt>>(result: R): AsOption<R> {
        if (is_error(result)) {
            return result.get()
        }
        return result as AsOption<R>;

    }
    constructor(err_data: T, msg?: string, options?: ErrorOptions) {
        super(msg, options)
        this.#err_data = err_data;
        this.name = 'ErrorExt';
    }
    get() {
        return this.#err_data
    }
}


export class NonZeroUsize extends ErrorExt<number> {
    constructor(err_data: number, options?: ErrorOptions) {
        super(err_data, `Expected ${err_data} to be NonZeroSize`, options)
    }
}

export function non_zero_usize<N extends number>(n: N): Result<Ok, NonZeroUsize> {
    if (n <= 0) {
        return new NonZeroUsize(n)
    }
    return
}
