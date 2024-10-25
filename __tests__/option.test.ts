import { assert, test } from "vitest"
import { AsOption, Option, Result, ok, result } from "joshkaposh-option"
import { Expect, Equal } from '../src/util'
import { ErrorExt } from "joshkaposh-option"

test('Result', () => {
    const r = result(() => { throw new Error })
    console.log(r.name);

    type R = Result<number, ErrorExt>;

    type T2 = Expect<Equal<AsOption<R>, Option<number>>>
    // type T3 = Expect<Equal<AsOption<Error>, never>>
    // @ts-expect-error
    type F1 = Expect<Equal<AsOption<R>, never>>
})