import { assert, expect, test } from 'vitest'
import { DoubleEndedIterator, iter, Generator, Iterator, from_fn, successors, repeat, once, once_with } from "../src/iter";
import { ErrorExt } from '../src/iter/shared';
import { count, expect_error, fill, fill_string, fill_with, toInfinityAndBeyond } from './helpers';
import { type IteratorInputType, } from '../src/iter/types';

test('valid iter arguments', () => {
    iter_test([1], [1])
    iter_test(function* () { yield 1 }, [1])
    iter_test(new Map([['k', 'v']]), [['k', 'v']])
    iter_test(new Map([['k', 'v']]).keys(), ['k'])
    iter_test(new Set([1]), [1]);
    expect(iter_args(1, 2, 3, 4, 5).collect()).toEqual([1, 2, 3, 4, 5])

    function iter_args(...args: any[]): Iterator<any>;
    function iter_args() {
        return iter(arguments)
    }

    function iter_test(it: IteratorInputType<any>, expected: any[]) {
        expect(iter(it).collect()).toEqual(expected)
    }
})

test('from_fn', () => {
    expect(from_fn(() => null).collect()).toEqual([]);
    expect(from_fn(from(5)).collect()).toEqual([1, 2, 3, 4, 5]);

    function from(len: number) {
        let next = 0;
        return () => {
            next++;
            return next > len ? null : next
        };
    }
})

test('eq / eq_by', () => {

    assert(!iter([1]).eq(iter([1, 2])))
    assert(!iter([1, 2]).eq(iter([1])))
    assert(iter(fill(50)).eq(iter(fill(50))));

    assert(!iter([1, 2]).eq_by(iter([1, 4, 9]), (a, b) => a * a === b))
    assert(!iter([1, 2, 3]).eq_by(iter([4, 9]), (a, b) => a * a === b))
    assert(iter([1, 2, 3]).eq_by(iter([1, 4, 9]), (a, b) => a * a === b))

})

test('into_iter', () => {
    let g = iter(() => count(5));
    let a = iter(fill(5));
    expect(g.collect()).toEqual(g.into_iter().collect());
    expect(g.into_iter().collect()).toEqual(a.collect());

    g = iter(() => count(3))
        .map(v => v * v)
        .map(v => v * v)

    expect(g.collect()).toEqual([1, 16, 81]);
    expect(g.into_iter().collect()).toEqual([1, 16, 81])

    let inf = iter(() => toInfinityAndBeyond());
    loop(inf)
    inf.into_iter();
    loop(inf)
    inf = iter(() => toInfinityAndBeyond()).take(10);
    loop(inf);

    a = iter(fill(10)) as any;
    loop(a);
    loop(a.into_iter())
    loop(a.into_iter().take(10))

    a = iter(fill(100)).take(10) as any;

    loop(a);
    loop(a.into_iter())

    a = iter(fill(5)).intersperse(100) as any;

    assert(a.next().value === 1)
    assert(a.next().value === 100)
    assert(a.next().value === 2)
    assert(a.next().value === 100)
    assert(a.next().value === 3)
    assert(a.next().value === 100)
    assert(a.next().value === 4)
    assert(a.next().value === 100)
    assert(a.next().value === 5)
    assert(a.next().value === undefined);

    a.into_iter();

    assert(a.next().value === 1)
    assert(a.next().value === 100)
    assert(a.next().value === 2)
    assert(a.next().value === 100)
    assert(a.next().value === 3)
    assert(a.next().value === 100)
    assert(a.next().value === 4)
    assert(a.next().value === 100)
    assert(a.next().value === 5)
    assert(a.next().value === undefined);

    a = iter(fill(100)) as any;
    loop(a, 100);
    loop(a.into_iter(), 100);

    a = iter(fill(10)).map(v => v).map(v => v) as any;

    loop(a);
    loop(a.into_iter());

    a = a.into_iter().take(5) as any;
    loop(a, 5);
    loop(a.into_iter(), 5);

    function loop(iter: Iterator<number>, n = 10) {
        for (let i = 0; i < n; i++) {
            assert(iter.next().value === i + 1)
        }
    }
})

test('partition', () => {
    const arr = [1, 2, 3, 4];

    expect(iter(arr).partition((v) => v % 2 === 0)).toEqual([[2, 4], [1, 3]])
    expect(iter(arr).rev().partition((v) => v % 2 === 0)).toEqual([[4, 2], [3, 1]])

})

test("miscellaneous", () => {
    const a = iter(fill(3))
    const a2 = iter(fill(50)).skip(10);

    expect(a2.next_back().value).toBe(50)

    const b = iter(() => count(50)).skip(10);

    let s = iter(fill(3))
    expect(s.sum()).toBe(6)
    let s2 = iter(['1', '2', '3'])
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

    expect(iter([1, 2, 3])
        .map(v => v * v)
        .rev()
        .map(v => v * v)
        .enumerate()
        .collect()
    ).toEqual([[0, 81], [1, 16], [2, 1]])


    expect(iter([1, 2, 3, 4])
        .map(v => v * v)
        .rev()
        .map(v => v * v)
        .filter(v => v % 2 === 0)
        .enumerate()
        .collect()
    ).toEqual([[0, 256], [1, 16]])
})

test('flatten', () => {
    const none = [];
    const empty = [[], [], []];
    const two_wide = [[1, 2], [3, 4], [5, 6]];
    const three_wide = [[1, 2, 3], [4, 5, 6]];
    const five_wide = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]];

    const expected = [1, 2, 3, 4, 5, 6];
    const rev = structuredClone(expected).reverse()

    const long = Array.from({ length: 10 }, (_) => Array.from({ length: 10 }, (_, i) => i + 1))

    const expected_long = new Array(100);
    for (let i = 0; i < 10; i++) {
        for (let x = 0; x < 10; x++) {
            expected_long[i * 10 + x] = x + 1
        }
    }

    assert(iter(none).count() === 0)
    assert(iter(empty).flatten().rev().count() === 0)

    expect(iter(() => two_wide[Symbol.iterator]()).flatten().collect()).toEqual(expected)
    expect(iter(() => three_wide[Symbol.iterator]()).flatten().collect()).toEqual(expected)
    expect(iter(long).flatten().collect()).toEqual(expected_long)
    expect(iter(three_wide).flatten().rev().collect()).toEqual(rev)

    const flat = iter(three_wide).flatten().rev();
    expect(flat.next().value).toBe(6);
    expect(flat.next_back().value).toBe(1);
    expect(flat.next().value).toBe(5);
    expect(flat.next_back().value).toBe(2);
    expect(flat.next().value).toBe(4);
    expect(flat.next_back().value).toBe(3);
    expect(flat.next().value).toBe(undefined);

    const f = iter([['a1', 'a2', 'a3'], ['b1', 'b2', 'b3']]).flatten();

    expect(f.next().value).toBe('a1');
    expect(f.next_back().value).toBe('b3');
    expect(f.next().value).toBe('a2');
    expect(f.next().value).toBe('a3');
    expect(f.next().value).toBe('b1');
    expect(f.next_back().value).toBe('b2');
    expect(f.next().value).toBe(undefined);
    expect(f.next_back().value).toBe(undefined);

    const flat_long = iter(five_wide).flatten().rev();

    expect(flat_long.next().value).toBe(10);
    expect(flat_long.next().value).toBe(9);
    expect(flat_long.next().value).toBe(8);
    expect(flat_long.next().value).toBe(7);
    expect(flat_long.next().value).toBe(6);
    expect(flat_long.next().value).toBe(5);

    expect(flat_long.next_back().value).toBe(1);
    expect(flat_long.next_back().value).toBe(2);
    expect(flat_long.next().value).toBe(4);
    expect(flat_long.next().value).toBe(3);

    expect(flat_long.next().value).toBe(undefined);
    expect(flat_long.next_back().value).toBe(undefined);

    expect(flat_long.into_iter().collect()).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1])

})

test('native_data_structures', () => {
    const m = new Map<string, boolean>([
        ['himom', true],
        ['hidad', false]
    ])
    const s = new Set([1, 2, 3, 4, 5]);

    // TODO: iter should be able to use [Symbol.iterator] from Map / Set / etc

    expect(iter(m).collect()).toEqual([['himom', true],
    ['hidad', false]])

    expect(iter(m.keys()).collect()).toEqual(['himom', 'hidad']);
    expect(iter(m.values()).collect()).toEqual([true, false])
    expect(iter(m.entries()).collect()).toEqual([
        ['himom', true],
        ['hidad', false]
    ])

    for (const k of s.keys()) {
        assert(k === 1 || k === 2 || k === 3 || k === 4 || k === 5)
    }

    for (const v of s.values()) {
        assert(v === 1 || v === 2 || v === 3 || v === 4 || v === 5)
    }

    for (const [a, b] of s.entries()) {
        assert(a === 1 || a === 2 || a === 3 || a === 4 || a === 5)
        assert(b === 1 || b === 2 || b === 3 || b === 4 || b === 5)
    }

    expect(iter(function* () { }) instanceof Generator).toBe(true)
    expect(iter([]) instanceof DoubleEndedIterator).toBe(true)
    expect(iter(new Uint16Array()) instanceof DoubleEndedIterator).toBe(true);

    const collect_map = iter([['k', 'v']]).collect(Map)
    expect(collect_map.get('k')).toBe('v')
})

test('free_standing_functions', () => {
    const from_f = from_fn(
        (function () {
            let count = 0;
            return () => {
                count++;
                if (count > 5) {
                    return
                }
                return count;
            }
        })()
    )

    expect(from_f.collect()).toEqual([1, 2, 3, 4, 5]);

    const s = successors(2, (v) => v < Math.pow(2, 5) ? v * v : null)
    expect(s.collect()).toEqual([2, 4, 16, 256])
    const o = once(1)
    assert(o.next().value === 1)
    assert(o.next().value === undefined)
    assert(o.into_iter().next().value === 1)

    expect(repeat(69).take(5).collect()).toEqual([69, 69, 69, 69, 69])

    const ow = once_with(() => 1);

    assert(ow.next().value === 1)
    assert(ow.next().value === undefined)
    assert(ow.into_iter().next().value === 1)
})

test('map_while', () => {
    const it = iter(toInfinityAndBeyond)
    const m = it.map_while((v) => {
        v = v * v;
        return v < 256 ? v : null
    });
    expect(m.last()).toBe(225);
})

test('step_by', () => {
    let step = iter(function* () {
        yield 0
        yield 1
        yield 2
        yield 3
        yield 4
        yield 5
    }).step_by(2)

    expect(step.next().value).toBe(0)
    expect(step.next().value).toBe(2)
    expect(step.next().value).toBe(4)
    expect(step.next().value).toBe(undefined)

    const step_double = iter([0, 1, 2, 3, 4, 5]).step_by(2)

    expect(step_double.next().value).toBe(0)
    expect(step_double.next().value).toBe(2)
    expect(step_double.next().value).toBe(4)
    expect(step_double.next().value).toBe(undefined)

    const step_infinite = iter(toInfinityAndBeyond).take(1000).step_by(9);

    // for (const step of step_infinite) {
    //     console.log(step);
    // }
})

test('take', () => {
    const first_100 = iter(fill(1000)).take(100);
    const last_100 = iter(fill(1000)).rev().take(100);

    expect(first_100.collect()).toEqual(fill(100))
    expect(first_100.into_iter().rev().collect()).toEqual(fill(100).reverse())

    expect(last_100.collect()).toEqual(fill_with(100, (i) => 900 + i + 1).reverse())

})

test('next_chunk', () => {
    const it = iter(fill(12));
    expect(it.next_chunk(5)).toEqual([1, 2, 3, 4, 5])
    expect(it.next_chunk(5)).toEqual([6, 7, 8, 9, 10])
    expect(it.next_chunk(5)).toEqual(new ErrorExt([11, 12], `'next_chunk' couldn't fill a container of 5 elements, but a container of 2 elements were found`))
    expect(iter([1, 2]).next_chunk(3)).toEqual(new ErrorExt([1, 2], `'next_chunk' couldn't fill a container of 3 elements, but a container of 2 elements were found`))

    function split_whitespace(str: string) {
        return str.split(' ').filter(v => v !== '');
    }

    // function trim_whitespace(str: string) {
    //     return str.split(' ').filter(v => v !== '').join(' ');
    // }

    const str = 'Hello World          !';
    const split = split_whitespace(str)
    expect(split).toEqual(['Hello', 'World', '!'])

})

test('array_chunks', () => {
    const arr = fill(45);
    const it = iter(arr).array_chunks(10);

    expect(it.next().value).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(it.next().value).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    expect(it.next().value).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30])
    expect(it.next().value).toEqual([31, 32, 33, 34, 35, 36, 37, 38, 39, 40])
    assert(it.next().done)
    expect(it.into_remainder()).toEqual([41, 42, 43, 44, 45])
})

test('intersperse / intersperse_with', () => {
    const names = ['tony', 'josh', 'aysha']
    const all = iter(names)
        .intersperse(', ')
        .reduce((acc, x) => acc += x);
    expect(all).toBe('tony, josh, aysha')

    const all2 = iter(names).intersperse_with(() => ', ')
        .reduce((acc, x) => acc += x)
    expect(all2).toBe(all)
})

test('is_sorted', () => {
    let it = iter([1, 2, 2, 2, 2, 2, 3, 4, 5]);
    assert(it.is_sorted());
})

test('string', () => {
    expect(iter('hello world').collect()).toEqual(['h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'l', 'd'])
})

test('generator', () => {
    expect(
        iter(toInfinityAndBeyond)
            .map(v => v * 2)
            .take(5)
            .collect()
    ).toEqual([2, 4, 6, 8, 10])

    const nums = iter(fill(3)).cycle()
    expect(nums.next().value).toBe(1)
    expect(nums.next().value).toBe(2)
    expect(nums.next().value).toBe(3)

    expect(nums.next().value).toBe(1)
    expect(nums.next().value).toBe(2)
    expect(nums.next().value).toBe(3)

    expect(iter(fill(3))
        .rev()
        .map(v => v * v)
        .map(v => v * v)
        .rev()
        .enumerate()
        .collect()
    ).toEqual([[0, 1], [1, 16], [2, 81]]);

})

test('filter_map', () => {
    const f = iter([1, 2, 3, 4]).filter_map(v => v % 2 === 0 ? v * v : null).map(v => v * v)
    expect(f.collect()).toEqual([16, 256])
    expect(f.collect()).toEqual([])
    expect(f.into_iter().collect()).toEqual([16, 256])

    const f2 = iter([1, 2, 3, 4]).rev().filter_map(v => v % 2 === 0 ? v * v : null).map(v => v * v)
    expect(f2.collect()).toEqual([256, 16])
})

test('try_fold', () => {
    let it = iter(fill(3))
    const sum = it.try_fold(0, (acc, inc) => {
        return inc === 2 ? new ErrorExt(inc, 'cannot be 2') : acc += inc
    })

    // short-curcuits
    expect(sum).toEqual(new ErrorExt(2, 'cannot be 2'))
    expect(it.next().value).toBe(3)
})

test('find', () => {
    let it = iter(fill(3));
    expect(it.find(v => v === 2)).toBe(2);
    expect(it.next().value).toBe(3);

    it = iter(fill(3));
    expect(it.rfind(v => v === 2)).toBe(2);
    expect(it.next().value).toBe(1);

    it = iter(fill(3)).rev();
    expect(it.find(v => v === 2)).toBe(2);
    expect(it.next().value).toBe(1);

})

test('fold', () => {
    let it = iter([1, 2, 3]);
    assert(it.fold(0, (v, x) => v + x) === 6);
    assert(it.into_iter().rfold(0, (v, x) => v + x) === 6);
})

test('peekable', () => {
    let it = iter(fill(3)).peekable();
    expect(it.peek().value).toBe(1);
    expect(it.next().value).toBe(1);
    expect(it.peek().value).toBe(2);
    expect(it.next().value).toBe(2);

    it = iter(fill(3)).peekable();
    expect(it.peek().value).toBe(1);
    expect(it.next().value).toBe(1);
    expect(it.next().value).toBe(2);
    expect(it.peek().value).toBe(3);
    expect(it.last()).toBe(3)

})

test('len', () => {
    let it = iter([1, 2, 3]);
    expect(it.len()).toBe(3);
    it.next()
    expect(it.len()).toBe(2)
    it.next()
    expect(it.len()).toBe(1)
    it.next()
    expect(it.len()).toBe(0)
    it.next()
    expect(it.len()).toBe(0)
    it = iter(fill(3));
    expect(it.len()).toBe(3);
    it.next_back()
    expect(it.len()).toBe(2)
    it.next_back()
    expect(it.len()).toBe(1)
    it.next_back()
    expect(it.len()).toBe(0)
    it.next_back()
    expect(it.len()).toBe(0)
})

test('advance_by', () => {
    let it = iter(fill(3));
    expect(it.advance_by(0)).toBe(undefined);
    expect(it.next().value).toBe(1)
})

test('nth', () => {
    let it = iter(fill(3));
    expect(it.nth(2).value).toEqual(3);
    it = iter(fill(3));
    expect(it.nth_back(2).value).toEqual(1);
    expect(it.nth_back(0).value).toEqual(undefined);
    it = iter(fill(3));

})

test('rfold', () => {
    expect(iter(fill(3)).rfold(0, (acc, inc) => {
        return acc - inc;
    })
    ).toBe(-6)

    expect(iter(['b', 'a', 'c', 'k', 'w', 'a', 'r', 'd', 's'])
        .rfold('', (acc, inc) => acc += inc)

    ).toBe('sdrawkcab')
    expect(iter(['b', 'a', 'c', 'k', 'w', 'a', 'r', 'd', 's']).rev().rfold('', (acc, inc) => {
        return acc += inc;
    })
    ).toBe('backwards')
})

test('rev', () => {
    expect(iter(fill(3))
        .rev()
        .collect()
    ).toEqual([3, 2, 1]);

    expect(iter(fill(3))
        .rev()
        .rev()
        .map((v) => v * v)
        .collect()
    ).toEqual([1, 4, 9])

    expect(iter(fill(3))
        .map((v) => v * v)
        .rev()
        .rev().eq(
            iter(fill(3))
                .rev()
                .rev()
                .map((v) => v * v)
        )
    ).toBe(true);

    expect(iter(fill(3))
        .rev()
        .map((v) => v * v)
        .rev().collect()
    ).toEqual([1, 4, 9]);

    expect(iter(fill(3))
        .rev()
        .map((v) => v * v)
        .map((v) => v * v)
        .rev().collect()
    ).toEqual([1, 16, 81]);

    expect(iter(fill(3))
        .map((v) => v * v)
        .collect()
    ).toEqual([1, 4, 9])

    expect(iter(fill(3))
        .map((v) => v * v)
        .map((v) => v * v)
        .collect()
    ).toEqual([1, 16, 81])

    expect(iter(fill(3))
        .rev()
        .map((v) => v * v)
        .map((v) => v * v)
        .collect()
    ).toEqual([81, 16, 1])

})

test('zip', () => {
    expect(
        iter(fill(3))
            .map(v => v * v)
            .map(v => v * v)
            .zip(iter(fill_string('v', 3)))
            .enumerate()
            .last()
    ).toEqual([2, [81, 'v3']])

    expect(
        iter(fill(3))
            .map(v => v * v)
            .map(v => v * v)
            .zip(iter(fill_string('v', 3)))
            .zip(iter(fill_string('k', 3)))
            .last()
    ).toEqual([
        [81, 'v3'], 'k3'
    ])

    expect(
        iter(fill(3))
            .map(v => v * v)
            .map(v => v * v)
            .zip(iter(fill_string('v', 3)))
            .zip(iter(fill_string('k', 3)))
            .enumerate()
            .last()
    ).toEqual([2, [[81, 'v3'], 'k3']])
})

test('iter invalid argument', () => {
    expect_error(() => iter(undefined as any), "Cannot construct an Iterator from primitive 'undefined'")
    expect_error(() => iter(null as any), "Cannot construct an Iterator from primitive 'null'")
    expect_error(() => iter(0 as any), "Cannot construct an Iterator from primitive '0'")
    expect_error(() => iter(true as any), "Cannot construct an Iterator from primitive 'true'")
    expect_error(() => iter({} as any), "Iter cannot construct an Iterator from an object that is not Arraylike or has no [Symbol.iterator] method.");
})

test('spread operator', () => {
    const it = iter(fill(3))
    expect([...it]).toEqual([1, 2, 3]);
    expect([...it]).toEqual([]);
    expect([...it.into_iter()]).toEqual([1, 2, 3])
    const gen = iter(() => count(3))
    expect([...gen]).toEqual([1, 2, 3]);
    expect([...gen]).toEqual([]);
    expect([...gen.into_iter()]).toEqual([1, 2, 3])
})

test('once', () => {
    // const o = iter.once(0);

    // const chain = o.chain([1, 2, 3, 4]);

    // expect(chain.collect()).toEqual([0, 1, 2, 3, 4])
    // expect(chain.collect()).toEqual([])
    // expect(chain.into_iter().collect()).toEqual([0, 1, 2, 3, 4])

})