import { test, expect, assert } from 'vitest';
import { async_iter, iter } from '../src/iter';
// KISS

async function delay(ms: number) {
    return new Promise(r => setTimeout(r, ms))
}

async function delay_then<T>(ms: number, then: () => T): Promise<T> {
    return new Promise(r => setTimeout(() => {
        r(then())
    }, ms))
}

function fill(n: number) {
    return Array.from({ length: n }, (_, i) => i + 1);
}

test('Async DoubleEndedIterator', async () => {
    const r = async_iter(fill(5)).rev();
    expect(await r.collect()).toEqual([5, 4, 3, 2, 1]);
}, 15000)

test('Async iterator', async () => {
    const t = async_iter(fill(3));

    expect(await t.collect()).toEqual(fill(3));
    assert(await async_iter(fill(50)).count() === 50);

    const m = async_iter(fill(3)).map(v => v * v).map(v => v * v);
    expect(await m.collect()).toEqual([1, 16, 81])

    assert(await async_iter(fill(3)).filter(v => v % 2 === 0).count() === 1)

    const chunks = async_iter(fill(15));
    const c1 = await chunks.next_chunk(10);
    assert(!(c1 instanceof Error) && c1.length === 10);
    expect(c1).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const r = await chunks.next_chunk(10);
    assert(r instanceof Error && r.get().length === 5);
    expect(r.get()).toEqual([11, 12, 13, 14, 15])

    assert(await async_iter(fill(3)).eq(async_iter(fill(3))) === true);

    expect(async_iter(fill(3)).fold(0, async (acc, x) => acc + x))


    // const b1 = await async_iter(fill(4)).eq(async_iter(fill(3)));
    // const b2 = await async_iter(fill(3)).eq(async_iter(fill(4)))
    // assert(b1 === b2 && b1 === false)
    // const size_hint = async_iter(fill(5));
    // expect(size_hint.size_hint()).toEqual([5, 5]);
    // size_hint.next()
    // expect(size_hint.size_hint()).toEqual([4, 4]);
    // size_hint.next()
    // expect(size_hint.size_hint()).toEqual([3, 3]);
    // size_hint.next()
    // expect(size_hint.size_hint()).toEqual([2, 2]);
    // size_hint.next()
    // expect(size_hint.size_hint()).toEqual([1, 1]);
    // size_hint.next()
    // expect(size_hint.size_hint()).toEqual([0, 0]);
    // expect(size_hint.size_hint()).toEqual([0, 0]);
    // expect(size_hint.size_hint()).toEqual([0, 0]);

}, 15000);

test('Flatten', async () => {
    const none = [];
    const empty = [[], [], []];
    const two_wide = [[1, 2], [3, 4], [5, 6]];
    const three_wide = [[1, 2, 3], [4, 5, 6]];
    const five_wide = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]];

    const expected = [1, 2, 3, 4, 5, 6];
    const rev = structuredClone(expected).reverse()

    const long = Array.from({ length: 10 }, (_) => Array.from({ length: 10 }, (_, i) => i + 1))
    const expected_long = iter(fill(10)).cycle().take(100).collect();

    expect(await async_iter(two_wide).flatten().collect()).toEqual(expected)
    expect(await async_iter(three_wide).flatten().collect()).toEqual(expected)
    // expect(async_iter(two_wide[Symbol.iterator]()).flatten().collect()).toEqual(expected)
    // expect(async_iter(three_wide[Symbol.iterator]()).flatten().collect()).toEqual(expected)

    expect(await async_iter(none).collect()).toEqual([])
    expect(await async_iter(empty).flatten().collect()).toEqual([])
    expect(await async_iter(empty).flatten().rev().collect()).toEqual([])

    expect(await async_iter(long).flatten().collect()).toEqual(expected_long)
    expect(await async_iter(three_wide).flatten().rev().collect()).toEqual(rev)

    const flat = async_iter(three_wide).flatten().rev();
    let n = await flat.next()
    expect(n.value).toBe(6);
    n = await flat.next_back()
    expect(n.value).toBe(1);
    n = await flat.next()
    expect(n.value).toBe(5);
    n = await flat.next_back()
    expect(n.value).toBe(2);
    n = await flat.next()
    expect(n.value).toBe(4);
    n = await flat.next_back()
    expect(n.value).toBe(3);
    n = await flat.next()
    expect(n.value).toBe(undefined);

    const f = async_iter([['a1', 'a2', 'a3'], ['b1', 'b2', 'b3']]).flatten();

    expect((await f.next()).value).toBe('a1');
    expect((await f.next_back()).value).toBe('b3');
    expect((await f.next()).value).toBe('a2');
    expect((await f.next()).value).toBe('a3');
    expect((await f.next()).value).toBe('b1');
    expect((await f.next_back()).value).toBe('b2');
    expect((await f.next()).value).toBe(undefined);
    expect((await f.next_back()).value).toBe(undefined);

    const flat_long = async_iter(five_wide).flatten().rev();

    expect((await flat_long.next()).value).toBe(10);
    expect((await flat_long.next()).value).toBe(9);
    expect((await flat_long.next()).value).toBe(8);
    expect((await flat_long.next()).value).toBe(7);
    expect((await flat_long.next()).value).toBe(6);
    expect((await flat_long.next()).value).toBe(5);

    expect((await flat_long.next_back()).value).toBe(1);
    expect((await flat_long.next_back()).value).toBe(2);
    expect((await flat_long.next()).value).toBe(4);
    expect((await flat_long.next()).value).toBe(3);

    expect((await flat_long.next()).value).toBe(undefined);
    expect((await flat_long.next_back()).value).toBe(undefined);

    expect(await flat_long.into_iter().collect()).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
})
