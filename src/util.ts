import { None, Option, is_none, is_some } from "./option";

export type Prettify<T> = { [K in keyof T]: T[K] } & {}

export type Expect<T extends true> = T;
export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
    T
>() => T extends Y ? 1 : 2
    ? true : false;

export type MustReturn<F extends (...args: any[]) => any> = ReturnType<F> extends void ? never : F;

// TODO: deep copy
export type Immut<T> = {
    +readonly [K in keyof T]: T[K]
}
// TODO: deep copy
export type Mut<T> = {
    -readonly [K in keyof T]: T[K]
}

export function TODO<T>(value?: unknown): T {
    return value as T;
}

export function exhaustive(value: never) {
    throw new Error('Switch not exhausted, received value: ' + value)
}

export function split_first<T>(array: T[]): Option<[T, T[]]> {
    if (array.length > 0) {
        return [array[0], array.slice(1, array.length)]
    }
    return;
}

export function resize<T>(array: T[], new_len: number, value: T) {
    const len = array.length;
    array.length = new_len
    if (new_len > len) {
        for (let i = len; i < new_len; i++) {
            array[i] = value;
        }
    }
}

export class AssertError extends Error {
    constructor(msg?: string, options?: ErrorOptions) {
        super(msg, options)
        console.error(this.stack);
    }
}

export function assert(a: boolean) {
    if (!a) {
        throw new AssertError(`Assert failed`)
    }
}

export function assert_some<T>(value: Option<T>): asserts value is T {
    if (is_none(value)) {
        throw new AssertError(`expected  '${value}' to be 'Some<T>'`)
    }
}

export function assert_none(value: unknown): asserts value is None {
    if (is_some(value)) {
        throw new AssertError(`expected  '${value}' to be 'None'`)
    }
}

export function indexOOB(index: number, len: number) {
    return index < 0 || index >= len
}