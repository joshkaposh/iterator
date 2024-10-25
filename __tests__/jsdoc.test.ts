import { test } from 'vitest'
import { iter } from '../src'
function default_iter() {
    return iter([1, 2, 3])
}

test('jsdoc', () => {
    let it = default_iter();

})