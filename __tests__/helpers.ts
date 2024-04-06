import { assert } from "vitest"

export function expect_error(fn: () => any, message: string) {
    let errored = false
    try {
        fn()
    } catch (e) {
        errored = true;
        assert(e.message === message, `Expected Error message { ${message} } to equal { ${e.message} }`)
    } finally {
        assert(errored, `Function ${fn} did not throw`)
    }
}

export function fill(len: number, from_zero = false) {
    return Array.from({ length: len }, (_, i) => from_zero ? i : i + 1)
}

export function fill_with<T>(len: number, fn: (index: number) => T) {
    return Array.from({ length: len }, (_, i) => fn(i))
}

export function fill_string<T extends string>(string: T, len: number): `${T}-${number}`[] {
    const arr: `${T}-${number}`[] = []
    for (let i = 0; i < len; i++) {
        arr.push(`${string}${i + 1}` as `${T}-${number}`);
    }
    return arr;
}

export function* count(n: number, from_zero = false) {
    let i = from_zero ? -1 : 0;
    function lt(index: number) {
        return !from_zero ? index < n : index < n - 1;
    }

    while (lt(i)) {
        i++
        yield i
    }
}

export function* toInfinityAndBeyond(from_zero = false) {
    let x = from_zero ? -1 : 0;
    while (true) {
        x++;
        yield x;
    }
}
