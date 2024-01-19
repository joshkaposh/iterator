export type Option<T> = T | None;
export type None = null | undefined

export type Result<Ok = [], Err = []> = Readonly<[Ok, Err]>

export type MustReturn<F extends (...args: any[]) => any> = ReturnType<F> extends void ? never : ReturnType<F>;

export function TODO<T>(value?: unknown): T {
    return value as T;
}

export function is_none(value: unknown): boolean {
    return (value ?? null) === null
}

export function is_some(value: unknown): boolean {
    return (value ?? null) !== null
}

export function assert_some<T>(value: Option<T>): asserts value is T {
    if (is_none(value)) {
        throw new Error(`expected  ${value} to be Some Type`)
    }
}

export function assert_none(value: unknown): asserts value is None {
    if (is_some(value)) {
        throw new Error(`expected  ${value} to be None Type`)
    }
}

export function indexOOB(index: number, len: number) {
    return index < 0 || index >= len
}

export function assert(a: unknown, b: unknown) {
    if (a !== b) {
        console.error('Assert failed on %O == %O', a, b)
    }
}
