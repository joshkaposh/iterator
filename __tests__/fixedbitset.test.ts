import { expect, test } from "vitest";
import { FixedBitSet } from '../src/intrinsics/fixed-bit-set';
import { range, iter } from "../src/iter";
import { assert } from "../src/util";

test('FixedBitSet works', () => {
    const N = 50;
    let fb = FixedBitSet.with_capacity(N);

    for (const i of range(0, N + 10)) {
        expect(fb.contains(i)).toBe(false)
    }

    fb.insert(10);
    fb.set(11, 0);
    fb.set(12, 0);
    fb.set(12, 1);
    fb.set(N - 1, 1);

    expect(fb.contains(10)).toBe(true);
    expect(!fb.contains(11)).toBe(true);
    expect(fb.contains(12)).toBe(true);
    expect(fb.contains(N - 1)).toBe(true);

    for (const i of range(0, N)) {
        const contain = i === 10 || i === 12 || i === N - 1;
        expect(contain).toBe(fb.get(i))
    }

    fb.clear();
})

test('FixedBitSet with block', () => {
    const fb = FixedBitSet.with_capacity_and_blocks(50, iter([8, 0]))
    expect(fb.contains(3)).toBe(true);

    const ones = fb.ones().collect();
    expect(ones.length).toBe(1);
})

test('FixedBitSet with blocks too small', () => {
    const fb = FixedBitSet.with_capacity_and_blocks(500, iter([8, 0]))
    fb.insert(400);
    expect(fb.contains(400)).toBe(true);
})

test('FixedBitSet with blocks too big', () => {
    const fb = FixedBitSet.with_capacity_and_blocks(1, iter([8]))
    expect(!fb.contains(3)).toBe(true)
})

test('FixedBitSet grow', () => {
    const fb = FixedBitSet.with_capacity(48);
    for (let i = 0; i < fb.len(); i++) {
        fb.set(i, 1)
    }
    const old_len = fb.len();
    fb.grow(72);
    for (let j = 0; j < fb.len(); j++) {
        expect(fb.contains(j)).toBe(j < old_len);
    }
    fb.set(64, 1);
    expect(fb.contains(64)).toBe(true);
})

test('FixedBitSet toggle', () => {
    const fb = FixedBitSet.with_capacity(16);
    fb.toggle(1);
    fb.put(2);
    fb.toggle(2);
    fb.put(3);
    expect(fb.contains(1)).toBe(true)
    expect(!fb.contains(2)).toBe(true)
    expect(fb.contains(3)).toBe(true)
})

test('FixedBitSet copy_bit', () => {
    const fb = FixedBitSet.with_capacity(48);
    for (let i = 0; i < fb.len(); i++) {
        fb.set(i, 1);
    }
    fb.set(42, 0)
    fb.copy_bit(42, 2);
    expect(!fb.contains(42)).toBe(true);
    expect(!fb.contains(2)).toBe(true);
    expect(fb.contains(1)).toBe(true);
    fb.copy_bit(1, 42);
    expect(fb.contains(42)).toBe(true);
    fb.copy_bit(1024, 42);
    expect(!fb.get(42)).toBe(true)
})

test('FixedBitSet count_ones', () => {
    function r(start: number, end: number) {
        return range(start, end)
    }

    const fb = FixedBitSet.with_capacity(100);

    fb.set(11, true);
    fb.set(12, true);
    fb.set(7, true);
    fb.set(35, true);
    fb.set(40, true);
    fb.set(77, true);
    fb.set(95, true);
    fb.set(50, true);
    fb.set(99, true);

    const three = r(0, 30)
    let count = 0;
    for (const i of three) {
        if (fb.contains(i)) {
            count++;
        }
    }
    expect(count).toBe(3);

    expect(fb.count_ones(r(0, 7))).toBe(0);
    expect(fb.count_ones(r(0, 8))).toBe(1);
    expect(fb.count_ones(r(0, 11))).toBe(1);
    expect(fb.count_ones(r(0, 12))).toBe(2);
    expect(fb.count_ones(r(0, 13))).toBe(3);
    expect(fb.count_ones(r(0, 35))).toBe(3);
    expect(fb.count_ones(r(0, 36))).toBe(4);
    expect(fb.count_ones(r(0, 40))).toBe(4);
    expect(fb.count_ones(r(0, 41))).toBe(5);
    expect(fb.count_ones(r(50, fb.len()))).toBe(4);
    expect(fb.count_ones(r(70, 95))).toBe(1);
    expect(fb.count_ones(r(70, 96))).toBe(2);
    expect(fb.count_ones(r(70, 99))).toBe(2);
    expect(fb.count_ones(r(0, fb.len()))).toBe(9);
    expect(fb.count_ones(r(0, 100))).toBe(9);
    expect(fb.count_ones(r(0, 0))).toBe(0);
    expect(fb.count_ones(r(100, 100))).toBe(0);
    expect(fb.count_ones(r(7, fb.len()))).toBe(9);
    expect(fb.count_ones(r(8, fb.len()))).toBe(8);
})

test('FixedBitSet ones', () => {
    const fb = FixedBitSet.with_capacity(100);
    fb.set(11, true);
    fb.set(12, true);
    fb.set(7, true);
    fb.set(35, true);
    fb.set(40, true);
    fb.set(77, true);
    fb.set(95, true);
    fb.set(50, true);
    fb.set(99, true);

    const ones = fb.ones().collect();

    expect(ones).toEqual([7, 11, 12, 35, 40, 50, 77, 95, 99])
})

test('FixedBitSet ones_range', () => {
    function test_range(from: number, to: number, capa: number) {
        assert(to <= capa);
        const fb = FixedBitSet.with_capacity(capa);
        for (const i of range(from, to)) {
            fb.insert(i)
        }
        const ones = fb.ones().collect();
        const expected = Array.from(range(from, to));
        expect(ones).toEqual(expected);
    }

    for (let i = 0; i < 100; i++) {
        test_range(i, 100, 100);
        test_range(0, i, 100);
    }
})

test('FixedBitSet count_ones errors on OOB', () => {
    const fb = FixedBitSet.with_capacity(100);
    expect(() => fb.count_ones(range(90, 101))).toThrowError('Assert failed');
})

test('FixedBitSet count_ones errors on negative range', () => {
    const fb = FixedBitSet.with_capacity(100);
    expect(() => fb.count_ones(range(90, 80))).toThrowError('Assert failed')
})

test('FixedBitSet count_ones panic', () => {
    for (let i = 1; i < 128; i++) {
        const fb = FixedBitSet.with_capacity(i);
        for (let j = 0; j < fb.len() + 1; j++) {
            for (let k = j; k < fb.len() + 1; k++) {
                assert(fb.count_ones(range(j, k)) === 0)
                // expect(fb.count_ones(range(j, k))).toBe(0)
            }
        }
    }
})

test('FixedBitSet default', () => {
    const fb = new FixedBitSet();
    expect(fb.len()).toBe(0);
})

test('FixedBitSet insert_range', () => {
    const fb = FixedBitSet.with_capacity(97);

    const r1 = range(0, 3);
    const r2 = range(9, 32);
    const r3 = range(37, 81)
    const r4 = range(90, fb.len())

    fb.insert_range(r1);
    fb.insert_range(r2);
    fb.insert_range(r3);
    fb.insert_range(r4);

    for (let i = 0; i < 97; i++) {
        expect(fb.contains(i)).toBe(
            i < 3 || 9 <= i && i < 32 || 37 <= i && i < 81 || 90 <= i
        )
    }

    expect(!fb.contains(97)).toBe(true)
    expect(!fb.contains(127)).toBe(true)
    expect(!fb.contains(128)).toBe(true)
})

test('FixedBitSet set_range', () => {
    const fb = FixedBitSet.with_capacity(48);
    fb.insert_range();
    fb.set_range(range.to(32), false);
    fb.set_range(range(37, fb.len()), false);
    fb.set_range(range(5, 9), true);
    fb.set_range(range(40, 40), true);

    for (let i = 0; i < 48; i++) {
        expect(fb.contains(i)).toBe(5 <= i && i < 9 || 32 <= i && i < 37)
    }

    expect(!fb.contains(48));
    expect(!fb.contains(64));
})

test('FixedBitSet toggle_range', () => {

    const fb = FixedBitSet.with_capacity(40);

    fb.insert_range(range.to(10));
    fb.insert_range(range(34, 38));
    fb.toggle_range(range(5, 12));
    fb.toggle_range(range(30, fb.len()))

    for (const i of range(0, 40)) {
        expect(fb.contains(i)).toBe(i < 5 || 10 <= i && i < 12 || 30 <= i && i < 34 || 38 <= i)
    }

    expect(!fb.contains(40)).toBe(true)
    expect(!fb.contains(64)).toBe(true)
})

test('FixedBitSet bitand equal lengths', () => {
    const len = 109;
    const a_end = 59;
    const b_start = 23;
    const a = FixedBitSet.with_capacity(len)
    const b = FixedBitSet.with_capacity(len)
    a.set_range(range(0, a_end), true)
    b.set_range(range(b_start), true)
    // const ab = a & b
    // ???

})