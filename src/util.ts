import { type None, type Option, is_none, is_some } from "joshkaposh-option";
import type { Primitive } from "./types";

export type Orderable<T> = T extends string ? T :
    T extends number ? T :
    T extends { [Symbol.toPrimitive](): Option<string | number | boolean> } ? T :
    never;

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

// TODO: deep copy
export type Immut<T> = {
    +readonly [K in keyof T]: T[K]
}
// TODO: deep copy
export type Mut<T> = {
    -readonly [K in keyof T]: T[K]
}

export function is_primitive(value: unknown): value is Primitive {
    if (is_none(value)) {
        return true
    }

    const ty = typeof value;
    if (ty === 'number') {
        return isNaN(value as number) || true
    } else {
        return ty === 'bigint' || ty === 'boolean' || ty === 'string' || ty === 'symbol'
    }
}

export function is_arraylike<T>(obj?: { length?: number }): obj is ArrayLike<T> {
    const ty = typeof obj
    return ty === 'string' || (ty !== 'function' && ty === 'object' && typeof obj?.length === 'number');
}
export function unused<T>(...args: any[]): T {
    return args as T
}

export function TODO<T>(msg: string, ...unused_vars: any[]): T {
    unused(unused_vars)
    throw new Error(`Not implemented: ${msg}`)
}

// TODO - move these into 'StringIterator'
export function split_first<T>(array: T[]): Option<[T, T[]]> {
    if (array.length > 0) {
        return [array[0], array.slice(1, array.length)]
    }
    return;
}

/**
 * @typedef {*} Option
 */

/**
* @param {number} index - The index to split at. Index is inclusive
* @returns {*} Option<[T[], T[]]>
* @description 
* Splits an array into two sub-arrays at the supplied index.
* The first array, if returned, will include up to N elements, where N == index
* @example
* const [a, b] = split_at([1, 2, 3, 4], 1)
* assert(a == [1, 2])
* assert(a == [3, 4])
* assert(split_at([], 0) == undefined)
*/
export function split_at<T>(array: T[], index: number): Option<[T[], T[]]> {
    index++;
    if (array.length > 0) {
        return [array.slice(0, index), array.slice(index, array.length)]
    }

    return
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