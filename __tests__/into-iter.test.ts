import { expect, test } from 'vitest'
import { DoubleEndedIterator, iter, Iterator } from '../src/index';

function fill(len: number, from_zero = false) {
    return Array.from({ length: len }, (_, i) => from_zero ? i : i + 1)
}

function fill_string<T extends string>(string: T, len: number): `${T}-${number}`[] {
    const arr: `${T}-${number}`[] = []
    for (let i = 0; i < len; i++) {
        arr.push(`${string}${i + 1}` as `${T}-${number}`);
    }
    return arr;
}

function* count(n: number, from_zero = false) {
    let i = from_zero ? -1 : 0;
    function lt(index: number) {
        return !from_zero ? index < n : index < n - 1;
    }

    while (lt(i)) {
        i++
        yield i
    }
}

function* toInfinityAndBeyond(from_zero = false) {
    let x = from_zero ? -1 : 0;
    while (true) {
        x++;
        yield x;
    }
}


function into_iter_gen(it: Iterator<any>, actual: any[]) {
    expect(it.collect()).toEqual(actual);
    expect(it.into_iter().collect()).toEqual(actual);
}

function into_iter_array(it: DoubleEndedIterator<any>, actual: any[]) {
    expect(it.rev().collect()).toEqual(actual);
    expect(it.rev().into_iter().collect()).toEqual(actual);

}

function exp(n: number) { return n * n }

function map_array() {
    return iter([1, 2, 3]).map(exp).map(exp);
}

test('IntoIter_DoubleEndedIterator', () => {
    const map_twice = [81, 16, 1];
    const map_twice_filter_odds = [81, 1];

    into_iter_array(
        map_array(),
        map_twice
    )

    into_iter_array(
        map_array()
            .filter(v => v % 2 !== 0),
        map_twice_filter_odds
    )

    const zip = map_array().zip([1, 2, 3])

    into_iter_array(zip, [[81, 3], [16, 2], [1, 1]])

    const take = iter(fill(100)).take(5);
    into_iter_array(take, [5, 4, 3, 2, 1])
    const take_enumerate = iter(fill(100)).take(5).enumerate()
    into_iter_array(take_enumerate, [
        [0, 5],
        [1, 4],
        [2, 3],
        [3, 2],
        [4, 1]
    ])

    const chain = iter(fill(3)).chain(iter([4, 5, 6]))
    into_iter_array(chain, [6, 5, 4, 3, 2, 1])

    const take2 = iter(fill(1_000_000)).take(5);
    const cycle_take = iter(fill(1_000_000)).cycle().take(5);

    console.log(take2.next_back());
    // ! take2 next_back should equal cycle_take next_back

    // console.log(cycle_take.next_back());
})