import { assert, test } from "vitest"
import { AsOption, Option, Result, ok, result } from "../src/option"
import { Expect, Equal } from '../src/util'
import { ErrorExt } from "../src/iter/shared"

test('Result', () => {
    assert(ok(2) === 2);
    assert(ok(new Error()) === null)

    const r = result(() => { throw new Error })
    console.log(r.name);

    type R = Result<number, ErrorExt>;

    type T2 = Expect<Equal<AsOption<R>, Option<number>>>
    type T3 = Expect<Equal<AsOption<Error>, never>>
    // @ts-expect-error
    type F1 = Expect<Equal<AsOption<R>, never>>
})