import { Option } from "../option";
import { Mut } from "../util";
import {
    check as bit_check,
    clear as bit_clear,
    set as bit_set,
    set_many as bit_set_many,
    set_to as bit_set_to,
    toggle as bit_toggle,
} from './bit'

export {
    bit_check,
    bit_clear,
    bit_set,
    bit_set_many,
    bit_set_to,
    bit_toggle
}

export * as Bit from './bit';

export type SizeHint<Lo = number, Hi = Option<number>> = [Lo, Hi]

type S<L = number, H = number> = SizeHint<L, H>;
type Un<H = number,> = SizeHint<0, H>;

export type Unsigned = {
    u8: Un<255>
    u16: Un<4294967295>
    u32: Un
    u64: Un
    u128: Un
    usize: Un
}

export type Signed = {
    i8: S<-128, 127>;
    i16: S<-32768, 32767>;
    i32: S<-2147483648, 2147483647>;
    i64: S<number, number>;
    i128: S<number, number>;
    isize: S<number, number>;
}

export type Float = {
    f32: SizeHint<number, number>;
    f64: SizeHint<number, number>;
};

export type NumberType = Signed & Unsigned & Float
export type Type = keyof NumberType;

function calc_sizeof_u(x: number): readonly [number, number] {
    return Object.freeze([0, Math.pow(2, x) - 1])
}

function calc_sizeof_i(x: number): readonly [number, number] {
    x = Math.pow(2, x)
    return Object.freeze([-x, x - 1])
}

export const SIZE = {
    u8: calc_sizeof_u(8),
    u16: calc_sizeof_u(16),
    u32: calc_sizeof_u(32),
    u64: calc_sizeof_u(64),
    u128: calc_sizeof_u(128),
    usize: [0, Number.MAX_SAFE_INTEGER],

    i8: calc_sizeof_i(7),
    i16: calc_sizeof_i(15),
    i32: calc_sizeof_i(31),
    i64: calc_sizeof_i(63),
    i128: calc_sizeof_i(127),
    isize: [Number.MIN_VALUE, Number.MAX_VALUE],

    f32: [1.18 * Math.pow(10, -38), 3.40 * Math.pow(10, 38)],
    f64: [Number.MIN_VALUE, Number.MAX_VALUE],
} as NumberType;

export function sizeof<S extends Type>(size: S): typeof SIZE[S] {
    return SIZE[size] as typeof SIZE[S];
}

export function cast_unsafe(x: any, type: Type): number {
    const [lower, upper] = sizeof(type);
    if (x > upper) {
        return wrapping_sub(upper, upper - x, type);
    }
    if (x < lower) {
        return wrapping_add(upper, x, type) + 1;
    }
    return x;
}

export function cast(x: any, type: Type): number {
    x = x * 1;
    return isNaN(x) ? 0 : cast_unsafe(x, type);
}

export function int(x = 0, type: keyof Signed | keyof Unsigned = 'usize') {
    return cast(Math.floor(x), type)
}

export function float(x = 0, type: keyof Float = 'f64') {
    return cast(x, type);
}

export function number(x = 0, type: Type = 'usize') {
    return cast(type.startsWith('f') ? x : Math.floor(x), type)
}

type NumberImpl = ((x?: number) => number) & {
    readonly MIN: number;
    readonly MAX: number;

    cast: (x: any) => number;

    new: (x?: number) => number;
    as: (x: number) => number;

    checked_add: (x: number, y: number) => Option<number>;
    checked_sub: (x: number, y: number) => Option<number>;
    checked_mul: (x: number, y: number) => Option<number>;
    checked_div: (x: number, y: number) => Option<number>;

    saturating_add: (x: number, y: number) => number;
    saturating_sub: (x: number, y: number) => number;
    saturating_mul: (x: number, y: number) => number;
    saturating_div: (x: number, y: number) => number;

    wrapping_add: (x: number, y: number) => number;
    wrapping_sub: (x: number, y: number) => number;
    wrapping_mul: (x: number, y: number) => number;
    wrapping_div: (x: number, y: number) => number;
}

// TODO: create a file for each type
// * that way, code is tree shakeable
// * * * /u8.ts
// * export cast ...
// * export checked...
// * export wrapping...
// * export saturating...
// * export default Default
// * * * /index.ts
// * export * as u8;
// * * * /user.ts
// * import * as Intrinsincs
// * const { u8 } = Intrinsics


function impl<T extends Type>(type: T): NumberImpl {
    const self = (type[0] === 'f' ?
        (x = 0) => float(x, type as 'f32') :
        (x = 0) => int(x, type as 'usize')
    ) as unknown as Mut<NumberImpl>;
    const [MIN, MAX] = sizeof(type);

    self.MIN = MIN;
    self.MAX = MAX;
    self.cast = (x: any) => cast(x, type);
    self.checked_add = (x: number, y: number) => checked_add(x, y, type)
    self.checked_sub = (x: number, y: number) => checked_sub(x, y, type)
    self.checked_mul = (x: number, y: number) => checked_mul(x, y, type)
    self.checked_div = (x: number, y: number) => checked_div(x, y, type)
    self.saturating_add = (x: number, y: number) => saturating_add(x, y, type)
    self.saturating_sub = (x: number, y: number) => saturating_sub(x, y, type)
    self.saturating_mul = (x: number, y: number) => saturating_mul(x, y, type)
    self.saturating_div = (x: number, y: number) => saturating_div(x, y, type)
    self.wrapping_add = (x: number, y: number) => wrapping_add(x, y, type)
    self.wrapping_sub = (x: number, y: number) => wrapping_sub(x, y, type)
    self.wrapping_mul = (x: number, y: number) => wrapping_mul(x, y, type)
    self.wrapping_div = (x: number, y: number) => wrapping_div(x, y, type)

    return self as NumberImpl;
}

export const u8 = impl('u8')
export const u16 = impl('u16')
export const u32 = impl('u32');
export const u64 = impl('u64');
export const u128 = impl('u128');
export const usize = impl('usize');

export const i8 = impl('i8')
export const i16 = impl('i16')
export const i32 = impl('i32');
export const i64 = impl('i64');
export const i128 = impl('i128');
export const isize = impl('isize');

export const f32 = impl('f32');
export const f64 = impl('f64');

function checked(op: (x: number, y: number) => number) {
    return function (x: number, y: number, size: Type) {
        const z = op(x, y);
        const [lower, upper] = sizeof(size)
        if (z <= upper && z >= lower) {
            return z
        }
        return;
    }
}

function wrapping(op: (x: number, y: number) => number) {
    return function (x: number, y: number, size: Type): number {
        const wrap = op(x, y);
        const [lower, upper] = sizeof(size);

        if (wrap > upper) {
            const step = upper - wrap + 1
            return lower - step;
        } else if (wrap < lower) {
            const step = lower - wrap - 1
            return upper - lower - step;
        } else {
            return wrap;
        }
    }
}

function saturating(op: (x: number, y: number) => number) {
    return function (x: number, y: number, size: Type) {
        const z = op(x, y);
        const [lower, upper] = sizeof(size);
        if (z > upper) {
            return upper
        } else if (z < lower) {
            return lower
        } else {
            return z;
        }

    }
}

export const wrapping_add = wrapping((x, y) => x + y);
export const wrapping_sub = wrapping((x, y) => x - y);
export const wrapping_mul = wrapping((x, y) => x * y);
export const wrapping_div = wrapping((x, y) => x / y);

export const checked_add = checked((x, y) => x + y);
export const checked_sub = checked((x, y) => x - y);
export const checked_mul = checked((x, y) => x * y);
export const checked_div = checked((x, y) => x / y);

export const saturating_add = saturating((x, y) => x + y);
export const saturating_sub = saturating((x, y) => x - y);
export const saturating_mul = saturating((x, y) => x * y);
export const saturating_div = saturating((x, y) => x / y);