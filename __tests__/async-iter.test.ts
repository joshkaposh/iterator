import { test, expect, assert } from 'vitest';
import { AsyncDoubleEndedIterator, AsyncIterator, async_iter, from_async_fn, from_iterable, is_error } from '../src/index';
// KISS
async function cb<T>(v: T) { return v }

async function delay(ms: number) {
    return new Promise(r => setTimeout(r, ms))
}

function delay_count(ms: number, n: number) {
    let idx = -1;
    return async () => {
        idx++
        if (idx >= n) {
            return;
        }
        await delay(ms);
        return idx + 1;
    }
}

async function* gen_delay_count(ms = 10, n = 3) {
    let idx = -1;
    while (idx < n - 1) {
        idx++
        await delay(ms);
        yield idx + 1;
    }
}

function count(n: number) {
    return async function* inner() {
        let idx = -1;
        while (idx < n - 1) {
            idx++;
            yield idx + 1
        }
    }
}

function fill(n: number) {
    return Array.from({ length: n }, (_, i) => i + 1);
}

test('expected return types', () => {
    const a = async_iter([1, 2, 3], async (v) => {
        await delay(100)
        return v
    })

    assert(a instanceof AsyncDoubleEndedIterator);
    assert(async_iter(new ReadableStream(), (v) => v) instanceof AsyncIterator);
    assert(async_iter(delay_count, (v) => v) instanceof AsyncIterator);
})

test('from_iterable_to_async_iterator', () => {
    const m = new Map();
    m.set('k1', 'v1');
    m.set('k2', 'v2');


    async_iter.from_sync(m.values())


})

test('It works (most methods)', async () => {
    let it = async_iter(count(3), cb).map(v => v * v).map(v => v * v);
    let n: any;
    expect(await it.collect()).toEqual([1, 16, 81])
    it = async_iter(count(4), cb).filter(v => v % 2 === 0).map(v => v * v).map(v => v * v);
    expect(await it.collect()).toEqual([16, 256]);
    it = async_iter(count(3), cb).chain(count(3) as any, cb);
    expect(await it.collect()).toEqual([1, 2, 3, 1, 2, 3]);
    it = async_iter([1, 2, 3], cb).chain([4, 5, 6] as any, cb).rev();
    expect(await it.collect()).toEqual([6, 5, 4, 3, 2, 1]);
    assert(async_iter(count(3), cb).eq(async_iter(count(3), cb) as any));
    assert(async_iter(count(3), cb).eq_by(async_iter(count(3), cb) as any, (a, b) => a === b));
    assert(await async_iter(count(3), cb).any(v => v === 1));
    assert(!(await async_iter(count(3), cb).all(v => v === 1)));
    it = async_iter(count(25), cb);
    expect(await it.next_chunk(10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(await it.next_chunk(10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    n = await it.next_chunk(10);
    assert(is_error(n));
    expect(n.get()).toEqual([21, 22, 23, 24, 25]);
    expect((await it.next()).value).toBe(undefined);
    it = async_iter(count(25), cb).array_chunks(5) as any;
    expect((await it.next()).value).toEqual([1, 2, 3, 4, 5]);
    expect((await it.next()).value).toEqual([6, 7, 8, 9, 10]);
    expect((await it.next()).value).toEqual([11, 12, 13, 14, 15]);
    expect((await it.next()).value).toEqual([16, 17, 18, 19, 20]);
    expect((await it.next()).value).toEqual([21, 22, 23, 24, 25]);
    expect((await it.next()).value).toBe(undefined);

    it = async_iter(count(10), cb);

    expect(await it.collect()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(await it.collect()).toEqual([]);
    expect(await it.into_iter().collect()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    it = async_iter(count(10), cb).enumerate() as any;
    expect(await it.collect()).toEqual([
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 8],
        [8, 9],
        [9, 10],
    ]);

    expect(await it.collect()).toEqual([])

    expect(await it.into_iter().collect()).toEqual([
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 8],
        [8, 9],
        [9, 10],
    ]);

    it = async_iter(count(100), cb);

    assert((await it.nth(0)).value === 1);
    assert((await it.nth(0)).value === 2);
    assert((await it.nth(9)).value === 12);
    assert((await it.nth(9)).value === 22);
    assert((await it.nth(9)).value === 32);
    assert((await it.nth(9)).value === 42);
    assert((await it.nth(9)).value === 52);
    assert((await it.nth(9)).value === 62);
    assert((await it.nth(9)).value === 72);
    assert((await it.nth(9)).value === 82);
    assert((await it.nth(9)).value === 92);
    assert((await it.nth(9)).done);
    assert((await it.nth(0)).done);

    it.into_iter();

    assert(!(await it.advance_by(0)))
    assert((await it.next()).value === 1)
    assert(!(await it.advance_by(1)))
    assert((await it.next()).value === 3)

}, 15000)

test('Async iterator', async () => {
    const it = from_async_fn(delay_count(10, 3));
    const gen = async_iter(gen_delay_count, v => v);

    assert((await it.next()).value === 1);
    assert((await it.next()).value === 2);
    assert((await it.next()).value === 3);
    assert((await it.next()).done);

    assert((await gen.next()).value === 1);
    assert((await gen.next()).value === 2);
    assert((await gen.next()).value === 3);
    assert((await gen.next()).done);

    const mm = async_iter(gen_delay_count, (v) => v)
        .map(v => v * v)
        .map(v => v * v)

    expect(await mm.collect()).toEqual([1, 16, 81])
    expect(await mm.collect()).toEqual([]);
    expect(await mm.into_iter().collect()).toEqual([1, 16, 81])

    const fmm = async_iter(gen_delay_count, (v) => v)
        .filter(v => v % 2 === 0)
        .map(v => v * v)
        .map(v => v * v)

    expect(await fmm.collect()).toEqual([16])
    expect(await fmm.collect()).toEqual([]);
    expect(await fmm.into_iter().collect()).toEqual([16])


}, 15000);

test('Async DoubleEndedIterator', async () => {
    expect(await async_iter([], (v) => v).collect()).toEqual([])

    const a = await async_iter([1, 2, 3], async (v) => {
        await delay(10)
        return v
    }).rev().collect();

    expect(a).toEqual([3, 2, 1])

}, 15000)

test('async_flatten', async () => {
    const arr = [[1, 2, 3], [4, 5, 6]];

    expect(await async_iter([], cb).flatten(cb).collect()).toEqual([]);
    expect(await async_iter([[]], cb).flatten(cb).collect()).toEqual([]);
    expect(await async_iter([[], [], []], cb).flatten(cb).collect()).toEqual([]);

    expect(await async_iter([[1, 2, 3], [4, 5, 6]], cb).flatten(cb).collect()).toEqual([1, 2, 3, 4, 5, 6]);

    const it = async_iter([[1, 2, 3], [4, 5, 6]], cb).flatten(cb);

    assert((await it.next()).value === 1)
    assert((await it.next_back()).value === 6)
    assert((await it.next_back()).value === 5)
    assert((await it.next_back()).value === 4)
    assert((await it.next_back()).value === 3)
    assert((await it.next()).value === 2)
    assert((await it.next()).value === undefined)
    assert((await it.next_back()).value === undefined)

    expect(
        await async_iter(flatten_me, cb)
            .flatten(cb)
            .collect()
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])

    async function* flatten_me() {
        yield [1, 2, 3]
        yield [4, 5, 6]
        yield [7, 8, 9, 10, 11, 12, 13, 14, 15]
    }

}, 15000)