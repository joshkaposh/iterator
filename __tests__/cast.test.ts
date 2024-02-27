import { expect, test } from "vitest";
import * as Intrinsics from '../src/intrinsics';
import { div_rem } from "../src/intrinsics/fixed-bit-set";
import { carrot_left } from "../src/intrinsics/bit";

test('u32 casts', () => {
    const MAX = Intrinsics.u32.MAX;
    let n = -1;
    expect(Intrinsics.u32(n)).toBe(MAX)


    const start = 0;
    const end = 100;
    const BITS = 32;
    const [first_block, first_rem] = div_rem(start, BITS);
    const [last_block, last_rem] = div_rem(end, BITS);

    const first_block2 = first_block;
    const first_mask2 = Intrinsics.u32.MAX << first_rem;
    const last_block2 = last_block;
    // const last_mask2 = (Intrinsics.u32.MAX >> 1) >> (BITS - last_rem - 1)
    const part1 = Math.floor(Intrinsics.u32.MAX * 0.5)
    const last_mask2 = part1 >> (BITS - last_rem - 1)
    // console.log(Math.floor(Intrinsics.u32.MAX * 0.5));


    expect(first_block).toBe(0);
    expect(first_rem).toBe(0);
    expect(last_block).toBe(3);
    expect(last_rem).toBe(4);

    expect(first_block2).toBe(0);
    expect(first_mask2 === MAX).toBe(false);
    expect(Intrinsics.u32(first_mask2)).toBe(MAX);
    expect(last_block2).toBe(3);
    expect(part1).toBe(2147483647);
    expect(last_mask2).toBe(15);

    const { u32 } = Intrinsics

    expect(carrot_left(u32.MAX, 18)).toBe(16383);
})