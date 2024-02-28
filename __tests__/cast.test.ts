import { expect, test } from "vitest";
import * as Intrinsics from '../src/intrinsics';
import { carrot_left } from "../src/intrinsics/bit";
const { u32 } = Intrinsics


test('u32 casts', () => {
    const MAX = u32.MAX;
    let n = -1;
    expect(u32(n)).toBe(MAX)
    expect(Math.floor(u32.MAX * 0.5)).toBe(2147483647);
    expect(carrot_left(u32.MAX, 18)).toBe(16383);
})