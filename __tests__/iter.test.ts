import { expect, test } from 'vitest'
import { DoubleEndedIterator, Iterator, iter, ErrorExt, IterIterable, IterArrayLike, IterGenerator } from "../src/iter";
import * as Intrinsics from '../src/intrinsics';
import { is_none } from '../src/option';
import { resize } from '../src/util';

function def(n = 3, isGen = false) {
    return iter(isGen ? () => count(n) : fill(n))
}

function exp(x: number) {
    return x * x;
}

function fill(len: number) {
    const arr: number[] = []
    for (let i = 0; i < len; i++) {
        arr.push(i + 1);
    }
    return arr;
}

function fill_string(str: string, len: number) {
    return Array.from({ length: len }, (_, i) => `${str}${i + 1}`)
}

function* count(n: number, initial = 0) {
    let i = initial;
    while (i < n) {
        i++
        yield i
    }
}

function* gen_string(value: string, n: number, initial = 0) {
    let i = initial;
    while (i < n) {
        i++
        yield `${value}${i}`
    }
}

const mock = {
    array: {
        map_twice(it: DoubleEndedIterator<number>) {
            return it.map(v => v * v).map(v => v * v)
        },
        fill(n = 3) {
            fill(n)
        },
        keys(n = 3) {
            return fill_string('key: ', n)
        },
        values(n = 3) {
            return fill_string('value: ', n)
        },
        kv(n = 3) {
            const kv: [`k${number}`, `v${number}`][] = [];
            for (let i = 0; i < n; i++) {
                kv.push([`k${i}`, `v${i}`])
            }
        }
    },
    gen: {
        fill(n = 3) {
            return count(n)
        },
        map_twice(it: Iterator<number>) {
            return it.map(v => v * v).map(v => v * v)
        },
        *toInfinityAndBeyond() {
            let i = 1;
            while (true) {
                yield i++;
            }
        },
        keys(n = 3) {
            return gen_string('key: ', n)
        },
        values(n = 3) {
            return gen_string('value: ', n);
        },
        *kv(n = 3) {
            let i = 0;
            const k = mock.gen.keys(n)
            const v = mock.gen.values(n)
            while (i < n) {
                i++
                yield [k.next().value, v.next().value]
            }
        }
    }
}

function* toInfinityAndBeyond() {
    let x = 0;
    while (true) {
        x++;
        yield x;
    }
}

function* flatten<T>(input: T[][]) {
    // let outer = input[Sym]
    for (const inner of input) {
        yield* inner
    }
}

test('Resize', () => {
    const a: number[] = [];
    resize(a, 5, 0);
    expect(a).toEqual([0, 0, 0, 0, 0])
    resize(a, 3, 0);
    expect(a).toEqual([0, 0, 0])

})

test('number sizes', () => {
    const { u8 } = Intrinsics;

    // works with booleans
    expect(u8.cast(false)).toBe(0);
    expect(u8.cast(true)).toBe(1);
    expect(u8.wrapping_add(0, u8(-1))).toBe(u8.MAX);
    expect(u8.wrapping_add(u8.MAX, 1)).toBe(0);
    expect(u8.wrapping_sub(0, 1)).toBe(u8.MAX);
    expect(u8.wrapping_sub(0, u8(256))).toBe(0);

    expect(u8.saturating_add(u8.MAX, 1)).toBe(u8.MAX);
    expect(u8.saturating_add(u8.MAX, u8(1000000))).toBe(u8.MAX);
    expect(u8.saturating_sub(0, u8(1000000))).toBe(0);

    expect(is_none(u8.checked_add(u8.MAX, 0))).toBe(false);
    expect(is_none(u8.checked_add(u8.MAX, 1))).toBe(true);
    expect(is_none(u8.checked_mul(128, 2))).toBe(true);

    expect(u8(-1)).toBe(u8.MAX);
    expect(u8(-1)).toBe(u8(-1));
    expect(u8.wrapping_mul(128, 2)).toBe(0)

    expect(u8.wrapping_div(u8.cast(-10), 1)).toBe(246)

    expect(u8(-1)).toBe(u8.MAX);
    expect(u8(u8.MAX + 1)).toBe(0);
    expect(u8(u8.MAX + 2)).toBe(1);
})

test('Native Data Structures', () => {
    const m = new Map<string, boolean>()
    const s = new Set();

    expect(iter(m.keys()) instanceof IterIterable).toBe(true);
    expect(iter(m.values()) instanceof IterIterable).toBe(true)
    expect(iter(m.entries()) instanceof IterIterable).toBe(true)
    expect(iter(s.keys()) instanceof IterIterable).toBe(true);
    expect(iter(s.values()) instanceof IterIterable).toBe(true);
    expect(iter(s.entries()) instanceof IterIterable).toBe(true);

    expect(iter(function* () { }) instanceof IterGenerator).toBe(true)
    expect(iter([]) instanceof DoubleEndedIterator).toBe(true)
    expect(iter(new Uint16Array()) instanceof DoubleEndedIterator).toBe(true);
})

test('Flatten', () => {
    function* gen() {
        yield [1, 2] as const;
        yield [3, 4] as const;
        yield [5, 6] as const;
    }

    expect([...flatten([[1, 2], [3, 4], [5, 6]])]).toEqual([1, 2, 3, 4, 5, 6])
    const flat = iter(gen).flatten();
    expect(flat.next().value).toBe(1);
    expect(flat.next().value).toBe(2);
    expect(flat.next().value).toBe(3);
    expect(flat.next().value).toBe(4);
    expect(flat.next().value).toBe(5);
    expect(flat.next().value).toBe(6);
    const nested = [[1, 2], [3, 4], [5, 6]]
    const flat2 = iter(nested).flatten();
    expect(flat2.next_back().value).toBe(6);
    expect(flat2.next_back().value).toBe(5);
    expect(flat2.next_back().value).toBe(4);
    expect(flat2.next_back().value).toBe(3);
    expect(flat2.next_back().value).toBe(2);
    expect(flat2.next_back().value).toBe(1);
    expect(flat2.next().value).toBe(undefined)
    expect(flat2.next_back().value).toBe(undefined)
})

test('Free standing functions', () => {
    const s = iter.successors(2, (v) => v < Math.pow(2, 5) ? v * v : null)
    expect(s.collect()).toEqual([2, 4, 16, 256])
    const once = iter.once(1)
    expect(once.next().value).toBe(1)
    expect(iter.repeat(69).take(5).collect()).toEqual([69, 69, 69, 69, 69])
})

test('MapWhile', () => {
    const it = iter(toInfinityAndBeyond())
    const m = it.map_while((v) => {
        v = v * v;
        return v < 256 ? v : null
    });
    expect(m.last()).toBe(225);
})

test('StepBy', () => {
    const step = iter(fill(10)).step_by(1)

    expect(step.next().value).toBe(2)
    expect(step.next().value).toBe(4)
    expect(step.next().value).toBe(6)
    expect(step.next().value).toBe(8)
    expect(step.next().value).toBe(10)
    expect(step.next().value).toBe(undefined)
})

test('next_chunk', () => {
    const it = iter(fill(12));
    expect(it.next_chunk(5)).toEqual([1, 2, 3, 4, 5])
    expect(it.next_chunk(5)).toEqual([6, 7, 8, 9, 10])
    expect(it.next_chunk(5)).toEqual(new ErrorExt([11, 12], `'next_chunk' couldn't fill a container of 5 elements, but a container of 2 elements were found`))
    expect(iter.of(1, 2).next_chunk(3)).toEqual(new ErrorExt([1, 2], `'next_chunk' couldn't fill a container of 3 elements, but a container of 2 elements were found`))

    function split_whitespace(str: string) {
        return str.split(' ').filter(v => v !== '');
    }

    function trim_whitespace(str: string) {
        return str.split(' ').filter(v => v !== '').join(' ');
    }

    const str = 'Hello World          !';
    const split = split_whitespace(str)
    expect(split).toEqual(['Hello', 'World', '!'])

})

test('Intersperse', () => {
    const names = ['tony', 'josh', 'aysha']
    const all = iter(names)
        .intersperse(', ')
        .reduce((acc, x) => acc += x);
    expect(all).toBe('tony, josh, aysha')

    const all2 = iter(names).intersperse_with(() => ', ')
        .reduce((acc, x) => acc += x)
    expect(all2).toBe(all)
})

test('String iter', () => {
    expect(iter('hello world').collect()).toEqual(['h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'l', 'd'])
})

test('Gen Works', () => {
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

// TODO: implement
// test('Filter map', () => {
//     const it = iter.of<string | number>('1', 2, '3').filter_map(v => {
//         if (typeof v === 'string') {
//             return Number(v);
//         }
//         return v
//     })
// })

test('Try fold', () => {
    let it = iter.of(1, 2, 3)
    const sum = it.try_fold(0, (acc, inc) => {
        return inc === 2 ? new ErrorExt(inc, 'cannot be 2') : acc += inc
    })

    expect(sum).toEqual(new ErrorExt(2, 'cannot be 2'))
    // short-curcuited
    expect(it.next().value).toBe(3)
})

test('Find', () => {
    let it = iter.of(1, 2, 3);
    expect(it.find(v => v === 2)).toBe(2);
    expect(it.next().value).toBe(3);

    it = iter.of(1, 2, 3);
    expect(it.rfind(v => v === 2)).toBe(2);
    expect(it.next().value).toBe(1);

    it = iter.of(1, 2, 3).rev();
    expect(it.find(v => v === 2)).toBe(2);
    expect(it.next().value).toBe(1);

})

test('Peekable', () => {
    let it = iter.of(1, 2, 3).peekable();
    expect(it.peek().value).toBe(1);
    expect(it.next().value).toBe(1);
    expect(it.peek().value).toBe(2);
    expect(it.next().value).toBe(2);

    it = iter.of(1, 2, 3).peekable();
    expect(it.peek().value).toBe(1);
    expect(it.next().value).toBe(1);
    expect(it.next().value).toBe(2);
    expect(it.peek().value).toBe(3);
    expect(it.last()).toBe(3)

})

test('Iter len', () => {
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

test('Advance by', () => {
    let it = iter.of(1, 2, 3);
    expect(it.advance_by(0)).toBe(undefined);
    expect(it.next().value).toBe(1)
})

test('Iter nth', () => {
    let it = iter.of(1, 2, 3);
    expect(it.nth(2).value).toEqual(3);
    it = iter.of(1, 2, 3);
    expect(it.nth_back(2).value).toEqual(1);
    expect(it.nth_back(0).value).toEqual(undefined);
    it = iter.of(1, 2, 3);

})

test('Iter rfold', () => {
    expect(iter.of(1, 2, 3).rfold(0, (acc, inc) => {
        return acc - inc;
    })
    ).toBe(-6)

    expect(iter.of('b', 'a', 'c', 'k', 'w', 'a', 'r', 'd', 's')
        .rfold('', (acc, inc) => acc += inc)

    ).toBe('sdrawkcab')
    expect(iter.of('b', 'a', 'c', 'k', 'w', 'a', 'r', 'd', 's').rev().rfold('', (acc, inc) => {
        return acc += inc;
    })
    ).toBe('backwards')
})

// TODO: implement
// test('Iter flatten', () => {
//     expect([...flatten([[1, 2], [3, 4], [5, 6]])]).toEqual([1, 2, 3, 4, 5, 6]);
//     const flat = () => iter.of([1, 2], [3, 4], [5, 6]).flatten();
//     expect(flat().collect()).toEqual([1, 2, 3, 4, 5, 6]);
//     expect(flat().rev().collect()).toEqual([6, 5, 4, 3, 2, 1]);
// })

test('Iter rev', () => {
    expect(iter.of(1, 2, 3)
        .rev()
        .collect()
    ).toEqual([3, 2, 1]);

    expect(iter.of(1, 2, 3)
        .rev()
        .rev()
        .map(exp)
        .collect()
    ).toEqual([1, 4, 9])

    expect(iter.of(1, 2, 3)
        .map(exp)
        .rev()
        .rev().eq(
            iter.of(1, 2, 3)
                .rev()
                .rev()
                .map(exp)
        )
    ).toBe(true);

    expect(iter.of(1, 2, 3)
        .rev()
        .map(exp)
        .rev().collect()
    ).toEqual([1, 4, 9]);

    expect(iter.of(1, 2, 3)
        .rev()
        .map(exp)
        .map(exp)
        .rev().collect()
    ).toEqual([1, 16, 81]);

    expect(iter.of(1, 2, 3)
        .map(exp)
        .collect()
    ).toEqual([1, 4, 9])

    expect(iter.of(1, 2, 3)
        .map(exp)
        .map(exp)
        .collect()
    ).toEqual([1, 16, 81])

    expect(iter.of(1, 2, 3)
        .rev()
        .map(exp)
        .map(exp)
        .collect()
    ).toEqual([81, 16, 1])

})

test('Iter zip', () => {
    expect(
        mock.array.map_twice(iter([1, 2, 3]))
            .zip(iter(fill_string('v', 3)))
            .enumerate()
            .last()
    ).toEqual([2, [81, 'v3']])

    expect(
        mock.array.map_twice(iter([1, 2, 3]))
            .zip(iter(fill_string('v', 3)))
            .zip(iter(fill_string('k', 3)))
            .last()
    ).toEqual([
        [81, 'v3'], 'k3'
    ])

    expect(
        mock.array.map_twice(iter([1, 2, 3]))
            .zip(iter(fill_string('v', 3)))
            .zip(iter(fill_string('k', 3)))
            .enumerate()
            .last()
    ).toEqual([2, [[81, 'v3'], 'k3']])
})

test('Iter', () => {
    const it = def() as DoubleEndedIterator<number>;
    const gen = def(3, true) as Iterator<number>; ''
    const ma1 = it.map(v => v * v);
    const ma2 = ma1.map(v => v * v);
    const mg2 = mock.gen.map_twice(gen);

    const z = ma2.zip(iter(['v1', 'v2', 'v3']))
    const zg = mg2.zip(iter(function* () {
        yield 'v1';
        yield 'v2';
        yield 'v3';
    }))

    expect(z.last()).toEqual([81, 'v3'])
    expect(zg.last()).toEqual([81, 'v3'])
})

test('Iter spread', () => {
    const it = def();
    expect([...it]).toEqual([1, 2, 3]);
    expect([...it]).toEqual([]);
    expect([...it.into_iter()]).toEqual([1, 2, 3])
    const gen = def(3, true);
    expect([...gen]).toEqual([1, 2, 3]);
    expect([...gen]).toEqual([]);
    expect([...gen.into_iter()]).toEqual([1, 2, 3])
})

test('Iter Once', () => {
    // expect(def().sum()).toBe(6);
    // expect(def().min()).toBe(1);
    // expect(def().max()).toBe(3);
})
