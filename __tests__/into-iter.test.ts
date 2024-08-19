import { expect, test } from 'vitest'
import { DoubleEndedIterator, iter, Iterator } from '../src/index';

function fill(len: number, from_zero = false) {
    return Array.from({ length: len }, (_, i) => from_zero ? i : i + 1)
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

})