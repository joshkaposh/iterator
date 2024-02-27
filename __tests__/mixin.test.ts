import { test, expect } from 'vitest';
import { IterArrayLike, IterGenerator } from '../src/iter'
import { ErrorExt } from '../src/iter/shared';

function* gen_count(n: number) {
    for (let i = 1; i <= n; i++) {
        yield i
    }
}

function count(n: number) {
    return () => gen_count(n)
}

function fill(n: number) {
    return Array.from({ length: n }, (_, i) => i + 1)
}

test('Mixin should work', () => {
    const a = new IterArrayLike(fill(3))
    const a2 = new IterArrayLike(fill(50)).skip(10);

    expect(a2.next_back().value).toBe(50)

    const b = new IterGenerator(count(50)).skip(10);

    let s = new IterArrayLike(fill(3))
    // expect(new IterArrayLike([]).sum()).toBe(null)
    expect(s.sum()).toBe(6)
    let s2 = new IterArrayLike(['1', '2', '3'])
    expect(s2.sum()).toBe('123')

    expect(b.try_fold('', (acc, inc) => {
        if (inc === 20) {
            return new ErrorExt(inc, `${inc} cannot be 20`)
        }
        return acc += inc;
    })).toEqual(new ErrorExt(20, `20 cannot be 20`))
    expect(b.next().value).toBe(21)

    const mapped = a.map(v => v * v).map(v => v * v).collect()
    expect(mapped).toEqual([1, 16, 81])

    expect(new IterArrayLike([1, 2, 3])
        .map(v => v * v)
        .rev()
        .map(v => v * v)
        .enumerate()
        .collect()
    ).toEqual([[0, 81], [1, 16], [2, 1]])


    expect(new IterArrayLike([1, 2, 3, 4])
        .map(v => v * v)
        .rev()
        .map(v => v * v)
        .filter(v => v % 2 === 0)
        .enumerate()
        .collect()
    ).toEqual([[0, 256], [1, 16]])
});
