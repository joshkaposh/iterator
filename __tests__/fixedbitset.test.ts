import { expect, test } from "vitest";
import { FixedBitSet } from '../src/intrinsics/fixed-bit-set';
import { range, iter } from "../src/iter";
import { assert, result } from "../src/util";
import { is_error } from "../src/option";
import { collect } from "../src/iter/shared";

function r(x: number, y: number) {
    return range(x, y)
}

test('it_works', () => {
    const N = 50;
    const fb = FixedBitSet.with_capacity(N);

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

test('with_block', () => {
    const fb = FixedBitSet.with_capacity_and_blocks(50, iter([8, 0]))
    expect(fb.contains(3)).toBe(true);

    const ones = fb.ones().collect();
    expect(ones.length).toBe(1);
})

test('with_blocks_too_small', () => {
    const fb = FixedBitSet.with_capacity_and_blocks(500, iter([8, 0]))
    fb.insert(400);
    expect(fb.contains(400)).toBe(true);
})

test('with_blocks_too_big', () => {
    const fb = FixedBitSet.with_capacity_and_blocks(1, iter([8]))
    expect(!fb.contains(3)).toBe(true)
})

test('grow', () => {
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

test('toggle', () => {
    const fb = FixedBitSet.with_capacity(16);
    fb.toggle(1);
    fb.put(2);
    fb.toggle(2);
    fb.put(3);
    expect(fb.contains(1)).toBe(true)
    expect(!fb.contains(2)).toBe(true)
    expect(fb.contains(3)).toBe(true)
})

test('copy_bit', () => {
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

test('count_ones', () => {
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

test('ones', () => {
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

test('ones_range', () => {
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

function errors(fn: () => unknown) {
    return is_error(result(fn, ''))
}


test('count_ones_errors_on_oob', () => {
    const fb = FixedBitSet.with_capacity(100);
    expect(errors(() => fb.count_ones(range(90, 101)))).toBe(true)
})

test('count_ones errors_on_negative_range', () => {
    const fb = FixedBitSet.with_capacity(100);
    expect(errors(() => fb.count_ones(range(90, 80)))).toBe(true)
})

test('count_ones_panic', () => {
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

test('default', () => {
    const fb = new FixedBitSet();
    expect(fb.len()).toBe(0);
})

test('insert_range', () => {
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

test('set_range', () => {
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

test('toggle_range', () => {

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

test('bitand_equal_lengths', () => {
    const len = 109;
    const a_end = 59;
    const b_start = 23;
    const a = FixedBitSet.with_capacity(len)
    const b = FixedBitSet.with_capacity(len)
    a.set_range(range(0, a_end), true)
    b.set_range(range(b_start), true)

    const ab = FixedBitSet.and(a, b);

    for (let i = 0; i < b_start; i++) {
        expect(!ab.contains(i)).toBe(true);
    }

    for (let i = b_start; i < a_end; i++) {
        expect(ab.contains(i))
    }

    for (let i = a_end; i < len; i++) {
        expect(!ab.contains(i))
    }

    expect(a.len() === ab.len()).toBe(true)
})

test('bitand_first_smaller', () => {
    const a_len = 113;
    const b_len = 137;
    const len = Math.min(a_len, b_len);
    const a_end = 97;
    const b_start = 89;
    const a = FixedBitSet.with_capacity(a_len)
    const b = FixedBitSet.with_capacity(b_len)
    a.set_range(range(0, a_end), true)
    b.set_range(range(b_start, b.len()), true)
    const ab = FixedBitSet.and(a, b);
    for (const i of range(0, b_start)) {
        expect(!ab.contains(i)).toBe(true);
    }
    for (const i of range(b_start, a_end)) {
        expect(ab.contains(i)).toBe(true);
    }
    for (const i of range(a_end, len)) {
        expect(!ab.contains(i)).toBe(true);
    }
    expect(a.len() === ab.len()).toBe(true);
})

test('bitand_first_larger', () => {

    const a_len = 173;
    const b_len = 137;
    const len = Math.min(a_len, b_len);
    const a_end = 107;
    const b_start = 43;
    const a = FixedBitSet.with_capacity(a_len);
    const b = FixedBitSet.with_capacity(b_len);
    a.set_range(range(0, a_end), true);
    b.set_range(range(b_start, b.len()), true);
    const ab = FixedBitSet.and(a, b);
    for (const i of range(0, b_start)) {
        expect(!ab.contains(i)).toBe(true);
    }
    for (const i of range(b_start, a_end)) {
        expect(ab.contains(i)).toBe(true);
    }
    for (const i of range(a_end, len)) {
        expect(!ab.contains(i));
    }
    expect(b.len() === ab.len()).toBe(true);
})

test('intersection', () => {
    const len = 109;
    const a_end = 59;
    const b_start = 23;
    const a = FixedBitSet.with_capacity(len);
    const b = FixedBitSet.with_capacity(len);
    a.set_range(range(0, a_end), true);
    b.set_range(range(b_start, len), true);

    const ab = a.intersection(b).collect(FixedBitSet);

    for (const i of range(0, b_start)) {
        expect(!ab.contains(i));
    }
    for (const i of range(b_start, a_end)) {
        expect(ab.contains(i));
    }
    for (const i of range(a_end, len)) {
        expect(!ab.contains(i));
    }

    a.intersect_with(b);
})

test('union', () => {
    const a_len = 173;
    const b_len = 137;
    const a_start = 139;
    const b_end = 107;
    const a = FixedBitSet.with_capacity(a_len);
    const b = FixedBitSet.with_capacity(b_len);

    a.set_range(range(a_start, a.len()), true);
    b.set_range(range(0, b_end), true);

    const ab = a.union(b).collect(FixedBitSet);

    for (const i of range(a_start, a_len)) {
        expect(ab.contains(i)).toBe(true);
    }
    for (const i of range(0, b_end)) {
        expect(ab.contains(i)).toBe(true);
    }
    for (const i of range(b_end, a_start)) {
        expect(!ab.contains(i)).toBe(true);
    }

    a.union_with(b);

    expect(a.eq(ab)).toBe(true)
})

test('symmetric_difference', () => {
    const a_len = 83;
    const b_len = 151;
    const a_start = 47;
    const a_end = 79;
    const b_start = 53;
    const a = FixedBitSet.with_capacity(a_len);
    const b = FixedBitSet.with_capacity(b_len);
    a.set_range(range(a_start, a_end), true);
    b.set_range(range(b_start, b_len), true);
    const a_sym_diff_b = a.symmetric_difference(b).collect(FixedBitSet);
    for (const i of range(0, a_start)) {
        expect(!a_sym_diff_b.contains(i)).toBe(true);
    }
    for (const i of range(a_start, b_start)) {
        expect(a_sym_diff_b.contains(i)).toBe(true);
    }
    for (const i of range(b_start, a_end)) {
        expect(!a_sym_diff_b.contains(i)).toBe(true);
    }
    for (const i of range(a_end, b_len)) {
        expect(a_sym_diff_b.contains(i)).toBe(true);
    }

    a.symmetric_difference_with(b);
    expect(a_sym_diff_b.eq(a))
})

test('bitor_equal_length', () => {
    const len = 109;
    const a_start = 17;
    const a_end = 23;
    const b_start = 19;
    const b_end = 59;
    const a = FixedBitSet.with_capacity(len);
    const b = FixedBitSet.with_capacity(len);
    a.set_range(range(a_start, a_end), true);
    b.set_range(range(b_start, b_end), true);
    const ab = FixedBitSet.or(a, b);
    for (const i of range(0, a_start)) {
        expect(!ab.contains(i));
    }
    for (const i of range(a_start, b_end)) {
        expect(ab.contains(i));
    }
    for (const i of range(b_end, len)) {
        expect(!ab.contains(i));
    }
    expect(ab.len() === len).toBe(true);
})

test('bitor_first_smaller', () => {
    const a_len = 113;
    const b_len = 137;
    const a_end = 89;
    const b_start = 97;
    const a = FixedBitSet.with_capacity(a_len);
    const b = FixedBitSet.with_capacity(b_len);
    a.set_range(range(0, a_end), true);
    b.set_range(range(b_start, b.len()), true);
    const ab = FixedBitSet.or(a, b);
    for (const i of range(0, a_end)) {
        expect(ab.contains(i));
    }
    for (const i of range(a_end, b_start)) {
        expect(!ab.contains(i));
    }
    for (const i of range(b_start, b_len)) {
        expect(ab.contains(i));
    }

    expect(b_len === ab.len()).toBe(true);
})

test('bitor_first_larger', () => {
    const a_len = 173;
    const b_len = 137;
    const a_start = 139;
    const b_end = 107;
    const a = FixedBitSet.with_capacity(a_len);
    const b = FixedBitSet.with_capacity(b_len);
    a.set_range(range(a_start, a.len()), true);
    b.set_range(range(0, b_end), true);
    const ab = FixedBitSet.or(a, b);
    for (const i of range(a_start, a_len)) {
        expect(ab.contains(i));
    }
    for (const i of range(0, b_end)) {
        expect(ab.contains(i));
    }
    for (const i of range(b_end, a_start)) {
        expect(!ab.contains(i));
    }
    expect(a_len === ab.len()).toBe(true);
})
test('bitxor_equal_lengths', () => {
    const len = 109;
    const a_end = 59;
    const b_start = 23;
    const a = FixedBitSet.with_capacity(len);
    const b = FixedBitSet.with_capacity(len);
    a.set_range(range(0, a_end), true);
    b.set_range(range(b_start, b.len()), true);
    const ab = FixedBitSet.xor(a, b)
    // const ab = &a ^ &b;
    for (const i of range(0, b_start)) {
        expect(ab.contains(i));
    }
    for (const i of range(b_start, a_end)) {
        expect(!ab.contains(i));
    }
    for (const i of range(a_end, len)) {
        expect(ab.contains(i));
    }
    expect(a.len() === ab.len()).toBe(true);
})


test('bitor_first_larger', () => {
    const a_len = 113;
    const b_len = 137;
    const len = Math.max(a_len, b_len);
    const a_end = 97;
    const b_start = 89;
    const a = FixedBitSet.with_capacity(a_len);
    const b = FixedBitSet.with_capacity(b_len);
    a.set_range(r(0, a_end), true);
    b.set_range(r(b_start, b.len()), true);
    const ab = FixedBitSet.xor(a, b);
    for (const i of r(0, b_start)) {
        expect(ab.contains(i));
    }
    for (const i of r(b_start, a_end)) {
        expect(!ab.contains(i));
    }
    for (const i of r(a_end, len)) {
        expect(ab.contains(i));
    }
    expect(b.len() === ab.len()).toBe(true);
})

test('bitxor_first_larger', () => {
    // #[test]
    // fn bitxor_first_larger() {
    //     const a_len = 173;
    //     const b_len = 137;
    //     const len = std.cmp.max(a_len, b_len);
    //     const a_end = 107;
    //     const b_start = 43;
    //     const  a = FixedBitSet.with_capacity(a_len);
    //     const  b = FixedBitSet.with_capacity(b_len);
    //     a.set_range(..a_end, true);
    //     b.set_range(b_start.., true);
    //     const ab = &a ^ &b;
    //     for (const i of 0..b_start) {
    //         expect(ab.contains(i));
    //     }
    //     for (const i of b_start..a_end) {
    //         expect(!ab.contains(i));
    //     }
    //     for (const i of a_end..b_len) {
    //         expect(ab.contains(i));
    //     }
    //     for (const i of b_len..len) {
    //         expect(!ab.contains(i));
    //     }
    //     expect!(a.len(), ab.len());
})

test('bitand_assign_shorter', () => {
    const a_ones = [2, 3, 7, 19, 31, 32, 37, 41, 43, 47, 71, 73, 101];
    const b_ones = [2, 7, 8, 11, 23, 31, 32];
    const a_and_b = [2, 7, 31, 32];
    const a = collect(structuredClone(a_ones), FixedBitSet)
    const b = collect(structuredClone(b_ones), FixedBitSet)
    a.and(b)

    const res = a.ones().collect();
    expect(res).toEqual(a_and_b)
})


test('bitand_assign_longer', () => {
    const a_ones = [2, 7, 8, 11, 23, 31, 32];
    const b_ones = [2, 3, 7, 19, 31, 32, 37, 41, 43, 47, 71, 73, 101];
    const a_and_b = [2, 7, 31, 32];
    const a = collect(structuredClone(a_ones), FixedBitSet)
    const b = collect(structuredClone(b_ones), FixedBitSet)
    a.and(b);
    const res = a.ones().collect();
    expect(res).toEqual(a_and_b);
})

test('bitor_assign_shorter', () => {
    const a_ones = [2, 3, 7, 19, 31, 32, 37, 41, 43, 47, 71, 73, 101];
    const b_ones = [2, 7, 8, 11, 23, 31, 32];
    const a_or_b = [2, 3, 7, 8, 11, 19, 23, 31, 32, 37, 41, 43, 47, 71, 73, 101];
    const a = collect(structuredClone(a_ones), FixedBitSet,);
    const b = collect(structuredClone(b_ones), FixedBitSet,);
    a.or(b)
    const res = a.ones().collect();
    expect(res).toEqual(a_or_b);
})

test('bitor_assign_longer', () => {
    const a_ones = [2, 7, 8, 11, 23, 31, 32];
    const b_ones = [2, 3, 7, 19, 31, 32, 37, 41, 43, 47, 71, 73, 101];
    const a_or_b = [2, 3, 7, 8, 11, 19, 23, 31, 32, 37, 41, 43, 47, 71, 73, 101];
    const a = collect(structuredClone(a_ones), FixedBitSet);
    const b = collect(structuredClone(b_ones), FixedBitSet);
    a.or(b)
    const res = a.ones().collect();

    expect(res).toEqual(a_or_b);
})

test('bitxor_assign_shorter', () => {
    const a_ones = [2, 3, 7, 19, 31, 32, 37, 41, 43, 47, 71, 73, 101];
    const b_ones = [2, 7, 8, 11, 23, 31, 32];
    const a_xor_b = [3, 8, 11, 19, 23, 37, 41, 43, 47, 71, 73, 101];
    const a = collect(structuredClone(a_ones), FixedBitSet);
    const b = collect(structuredClone(b_ones), FixedBitSet);
    a.xor(b);
    const res = a.ones().collect();
    expect(res == a_xor_b);
})

test('bitxor_assign_longer', () => {

    const a_ones = [2, 7, 8, 11, 23, 31, 32];
    const b_ones = [2, 3, 7, 19, 31, 32, 37, 41, 43, 47, 71, 73, 101];
    const a_xor_b = [3, 8, 11, 19, 23, 37, 41, 43, 47, 71, 73, 101];
    const a = collect(structuredClone(a_ones), FixedBitSet);
    const b = collect(structuredClone(b_ones), FixedBitSet);
    a.xor(b);
    const res = a.ones().collect();
    expect(res).toEqual(a_xor_b);
})

test('subset_superset_shorter', () => {
    const a_ones = [7, 31, 32, 63];
    const b_ones = [2, 7, 19, 31, 32, 37, 41, 43, 47, 63, 73, 101];
    const a = collect(structuredClone(a_ones), FixedBitSet)
    const b = collect(structuredClone(b_ones), FixedBitSet)
    expect(a.is_subset(b) && b.is_superset(a));
    a.insert(14);
    expect(!a.is_subset(b) && !b.is_superset(a));
})

test('subset_superset_longer', () => {
    const a_len = 153;
    const b_len = 75;
    const a_ones = [7, 31, 32, 63];
    const b_ones = [2, 7, 19, 31, 32, 37, 41, 43, 47, 63, 73];
    const a = FixedBitSet.with_capacity(a_len);
    const b = FixedBitSet.with_capacity(b_len);
    a.extend(structuredClone(a_ones));
    b.extend(structuredClone(b_ones));
    expect(a.is_subset(b) && b.is_superset(a));
    a.insert(100);
    expect(!a.is_subset(b) && !b.is_superset(a));
})

test('is_disjoint_first_shorter', () => {
    const a_len = 75;
    const b_len = 153;
    const a_ones = [2, 19, 32, 37, 41, 43, 47, 73];
    const b_ones = [7, 23, 31, 63, 124];
    const a = FixedBitSet.with_capacity(a_len);
    const b = FixedBitSet.with_capacity(b_len);
    a.extend(structuredClone(a_ones));
    b.extend(structuredClone(b_ones));
    expect(a.is_disjoint(b));
    a.insert(63);
    expect(!a.is_disjoint(b));
})

test('is_disjoint_first_longer', () => {
    const a_ones = [2, 19, 32, 37, 41, 43, 47, 73, 101];
    const b_ones = [7, 23, 31, 63];
    const a = collect(structuredClone(a_ones), FixedBitSet);
    const b = collect(structuredClone(b_ones), FixedBitSet);
    expect(a.is_disjoint(b)).toBe(true);
    b.insert(2);
    expect(!a.is_disjoint(b)).toBe(true);
})
test('extend_on_empty', () => {
    const items = [2, 3, 5, 7, 11, 13, 17, 19, 23, 27, 29, 31, 37, 167];
    const fbs = FixedBitSet.with_capacity(0);
    fbs.extend(structuredClone(items));
    const ones = fbs.ones().collect();
    expect(ones).toEqual(items);
})

test('extend', () => {
    const items = [2, 3, 5, 7, 11, 13, 17, 19, 23, 27, 29, 31, 37, 167];
    const fbs = FixedBitSet.with_capacity(168);
    const _new = [7, 37, 67, 137];

    for (const i of _new) {
        fbs.put(i);
    }

    fbs.extend(structuredClone(items));
    const ones = fbs.ones().collect();
    const set = new Set(items)
    for (const v of _new) {
        set.add(v)
    }
    const expected = [...set].sort();

    expect(structuredClone(ones).sort()).toEqual(expected);


})
test('from_iterator', () => {
    const items = [0, 2, 4, 6, 8];
    const fb = collect(structuredClone(items), FixedBitSet);
    for (const i of items) {
        expect(fb.contains(i));
    }
    for (const i of [1, 3, 5, 7]) {
        expect(!fb.contains(i));
    }
    expect(fb.len() === 9).toBe(true);

})
test('from_iterator_ones', () => {
    const len = 257;
    const fb = FixedBitSet.with_capacity(len);
    for (const i of iter(r(0, len)).filter((i) => i % 7 == 0)) {
        fb.put(i);
    }
    fb.put(len - 1);
    const dup = fb.ones().collect(FixedBitSet);

    expect(fb.len() === dup.len()).toBe(true);
    expect(fb.ones().collect()).toEqual(dup.ones().collect());
})

test('binary_trait', () => {

    const items = [1, 5, 7, 10, 14, 15];
    const fb = collect(structuredClone(items), FixedBitSet);

    expect(fb.format()).toBe("0100010100100011");
    expect(fb.format('#b')).toBe("0b0100010100100011");
})

test('display_trait', () => {
    const len = 8;
    const fb = FixedBitSet.with_capacity(len);

    fb.put(4);
    fb.put(2);

    expect(fb.toString()).toBe("00101000");
    expect(fb.toString('#')).toBe("0b00101000");

})
test('test_serialize', () => {
    const fb = FixedBitSet.with_capacity(10);
    fb.put(2);
    fb.put(3);
    fb.put(6);
    fb.put(8);

    const serialized = JSON.stringify(fb.toString());
    const padding = 2;
    console.log(serialized, serialized.length - padding);
    expect(serialized.length - padding === 10).toBe(true);
})

test('is_clear', () => {
    const fb = FixedBitSet.with_capacity(0);
    expect(fb.is_clear());

    fb.grow(1);
    expect(fb.is_clear());

    fb.put(0);
    expect(!fb.is_clear());

    fb.grow(42);
    fb.clear();
    expect(fb.is_clear());

    fb.put(17);
    fb.put(19);
    expect(!fb.is_clear());
})