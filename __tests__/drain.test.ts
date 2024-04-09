import { test, expect, assert } from 'vitest'
import { drain, iter, range } from '../src/index';

test('drain_removes_elements_and_keeps_len', () => {
    const arr = [1, 2, 3];

    const drained = drain(arr, range(0, arr.length)).collect();
    // const none = 
    assert(arr.length === 3);
    expect(arr).toEqual(new Array(3));
    expect(drained).toEqual([1, 2, 3]);
    expect(iter(arr).collect()).toEqual([]);
})

test('drain_partial', () => {
    let arr = [1, 2, 3, 4];
    let expected_arr = new Array(4);
    expected_arr[2] = 3;
    expected_arr[3] = 4;
    let drained = drain(arr, range(0, 2)).collect();
    assert(arr.length === 4);
    expect(arr).toEqual(expected_arr);
    expect(drained).toEqual([1, 2]);

    arr = [1, 2, 3, 4];
    expected_arr = new Array(4)
    expected_arr[0] = 1;
    expected_arr[1] = 2;
    drained = drain(arr, range(2, arr.length)).collect();
    assert(arr.length === 4);
    expect(arr).toEqual(expected_arr);
    expect(drained).toEqual([3, 4]);
})