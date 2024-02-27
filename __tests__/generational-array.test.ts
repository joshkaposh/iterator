import { expect, test } from "vitest";
import { GenerationalArray } from '../src/ecs/generational-array';

test('It works', () => {
    let gv = new GenerationalArray<string>();
    // Insert
    let a = gv.insert("a");
    let b = gv.insert("b");
    let c = gv.insert("c");
    expect(gv.get(a) === "a").toBe(true);
    expect(gv.get(b) === "b").toBe(true);
    expect(gv.get(c) === "c").toBe(true);
    expect(gv.len() === 3).toBe(true);

    // Remove
    gv.remove(a);
    expect(gv.get(a) === null);
    expect(gv.len() === 2);


    // Re-insert
    let d = gv.insert("d");

    expect(a.index === d.index).toBe(true);
    expect(a.generation !== d.generation).toBe(true);

    // Re-remove and re-re-insert
    gv.remove(d);
    let e = gv.insert("e");
    expect(a.index === e.index).toBe(true);
    expect(a.generation !== e.generation).toBe(true);

    gv.iter_occupied().for_each(n => {
        console.log(n.node, n.generation);
    })
})