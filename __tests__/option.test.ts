import { assert, test } from "vitest"
import { AsOption, Option, Result, ok } from "../src/option"
import { Expect, Equal } from '../src/util'

test('Result', () => {
    assert(ok(2) === 2);
    assert(ok(new Error()) === null)

    type R = Result<number, Error>;

    type T2 = Expect<Equal<AsOption<R>, Option<number>>>
    type T3 = Expect<Equal<AsOption<Error>, never>>
    // @ts-expect-error
    type F1 = Expect<Equal<AsOption<R>, never>>
})