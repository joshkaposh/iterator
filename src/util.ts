import { type None, type Option, is_none, is_some } from "./option";

export type Prettify<T> = { [K in keyof T]: T[K] } & {}

export type Expect<T extends true> = T;
export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
    T
>() => T extends Y ? 1 : 2
    ? true : false;


type MissingKey<T1 extends PropertyKey, T2 extends PropertyKey> =
    Exclude<T1, T2> |
    Exclude<T2, T1>;

type MissingMap<T1, T2, K1 extends PropertyKey, K2 extends PropertyKey> = {
    [P in MissingKey<K1, K2>]:
    P extends keyof T1 ? Prettify<{ [K3 in P]: T1[P] } & {
        required_from: T1;
        needed_in: T2
    }> :
    P extends keyof T2 ? Prettify<{ [K3 in P]: T2[P] } & {
        required_from: T2;
        needed_in: T1
    }> : never
}

export type Missing<T1, T2, K1 extends PropertyKey, K2 extends PropertyKey> = MissingMap<T1, T2, K1, K2>[keyof MissingMap<T1, T2, K1, K2>]


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

export function assert(is_true: boolean): void
export function assert(is_true: boolean, message: string): void;
export function assert(is_true: boolean, message: string, a: unknown, b: unknown): void;
export function assert(is_true: boolean, message?: string, a?: unknown, b?: unknown) {
    const base = arguments.length === 4 ? `Assert failed on ${a} === ${b}` : 'Assert Failed';
    if (!is_true) {
        const msg = is_some(message) ? `${base} ${message}` : base
        throw new AssertError(msg)
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