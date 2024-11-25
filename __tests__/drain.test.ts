import { test, expect, assert } from 'vitest'
import { drain, range } from '../src/index';

test('double_ended_drain', () => {
    const arr = [1, 2, 3, 4];
    const d = drain(arr).rev().collect();
    expect(arr).toEqual([]);
    expect(d).toEqual([4, 3, 2, 1]);
})

test('drain_removes_elements_and_removes_len', () => {
    const arr = [1, 2, 3];
    const d = drain(arr).collect();
    assert(arr.length === 0);
    expect(arr).toEqual([]);
    expect(d).toEqual([1, 2, 3]);
})

test('drain_partial', () => {
    let arr = [1, 2, 3, 4];
    let drained = drain(arr, range(0, 2)).collect();
    assert(arr.length === 2);
    expect(arr).toEqual([3, 4]);
    expect(drained).toEqual([1, 2]);
    arr = [1, 2, 3, 4];
    drained = drain(arr, range(2, arr.length)).collect();
    assert(arr.length === 2);
    expect(arr).toEqual([1, 2]);
    expect(drained).toEqual([3, 4]);
})

test('drain_drop', () => {
    let arr = [1, 2, 3, 4];
    let d = drain(arr);
    // let arr2 = d.drop();
    expect(d.collect()).toEqual([1, 2, 3, 4])
    // expect(arr2).toEqual([1, 2, 3, 4])
})