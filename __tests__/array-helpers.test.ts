import { assert, expect, test } from 'vitest';
import { split_at } from '../src/util';

test('split_at', () => {
    expect(split_at(
        [1, 2, 3, 4, 5, 6, 7, 8],
        3
    )).toEqual([
        [1, 2, 3, 4],
        [5, 6, 7, 8]
    ])

    assert(!split_at([], 0));
    expect(split_at([1], 0)).toEqual([[1], []])
})
