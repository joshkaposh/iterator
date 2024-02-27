import { expect, test } from "vitest";
import * as Intrinsics from "../src/intrinsics";
import { Bit } from "../src/intrinsics";
import { count_ones, carrot_left, trailing_zeros } from "../src/intrinsics/bit";

const WRITE = 2;
const READ = 1;
const NONE = 0;

const u32_shift_one = Math.floor(Intrinsics.u32.MAX * 0.5)

test('Masks', () => {
    expect(carrot_left(Intrinsics.u32.MAX, 1)).toBe(2147483647)
})


test('Subset, superset', () => {
    let m1 = 0;
    let m2 = 0;

    m1 = Bit.set(m1, READ);

    m2 = Bit.set(m2, READ);
    m2 = Bit.set(m2, WRITE);

    expect(Bit.subset([READ], m1)).toBe(true);
    expect(Bit.subset([READ, WRITE], m1)).toBe(false);
    expect(Bit.subset([READ, WRITE], m2)).toBe(true);
})

test('BitMask', () => {

    let mask = NONE;
    console.log('mask', mask);
    mask = Bit.set(mask, READ);
    expect(Bit.check(mask, READ)).toBe(true)
    mask = Bit.clear(mask, READ);
    expect(Bit.check(mask, READ)).toBe(false);
    mask = Bit.set(mask, READ);
    expect(Bit.check(mask, READ)).toBe(true)
    mask = Bit.set_to(mask, READ, 1)
    expect(Bit.check(mask, READ)).toBe(true);
    mask = Bit.toggle(mask, READ)
    expect(Bit.check(mask, READ)).toBe(false);
    mask = Bit.toggle(mask, READ)
    expect(Bit.check(mask, READ)).toBe(true);
    expect(Bit.check(mask, WRITE)).toBe(false);
    mask = Bit.set(mask, WRITE);
    expect(Bit.check(mask, READ)).toBe(true);
    expect(Bit.check(mask, WRITE)).toBe(true);
    mask = NONE;
    mask = Bit.set(mask, WRITE);
    expect(Bit.check(mask, READ)).toBe(false);

    expect(Bit.check(NONE, NONE)).toBe(true);

    mask = NONE;
    expect(Bit.check(mask, NONE)).toBe(true);
    mask = Bit.set(mask, WRITE)
    expect(Bit.check(mask, READ)).toBe(false);

    mask = NONE;
    mask = Bit.set_many(mask, READ, WRITE)
    expect(Bit.check(mask, NONE)).toBe(false);
    expect(Bit.check(mask, READ)).toBe(true);
    expect(Bit.check(mask, WRITE)).toBe(true);

})

test('bit_set_to', () => {
    let mask = NONE;
    mask = Bit.set_to(mask, 1, 0);
    expect(!Bit.check(mask, 1)).toBe(true)
    mask = Bit.set_to(mask, 1, 1);
    expect(Bit.check(mask, 1)).toBe(true)
    mask = Bit.set_to(mask, 1, false);
    expect(!Bit.check(mask, 1)).toBe(true)
    mask = Bit.set_to(mask, 1, true);
    expect(Bit.check(mask, 1)).toBe(true)
})

test('trailing_zeros', () => {
    const n = 0b0101000;
    expect(trailing_zeros(n)).toBe(3)
})

test('count_ones', () => {
    const n = 0b0101010;

    expect(count_ones(1)).toBe(1);
    expect(count_ones(n)).toBe(3);
})

