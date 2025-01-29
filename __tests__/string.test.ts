import { expect, test } from "vitest";
import { iter } from "../src";

test('string', () => {
    const it = iter<string>('hello world');
    it.collect();
    expect(iter('hello world').collect()).toEqual(['h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'l', 'd']);

    expect(iter('hello world').split(' ').collect()).toEqual(['hello', 'world']);
    expect(iter('hello world').rsplit(' ').collect()).toEqual(['world', 'hello']);
})
