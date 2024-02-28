import { expect, test } from "vitest";
import { With, World } from '../src/ecs';
import { Entity } from "../src/ecs/entity";


class CompA { constructor(public value: string = 'A') { } }
class CompB { constructor(public value: string = 'B') { } }
class CompC { constructor(public value: string = 'C') { } }

test('EntityCount', () => {
    const w = new World();

    const a_info = w.init_component(CompA);
    const b_info = w.init_component(CompB);
    const c_info = w.init_component(CompC);
    expect(a_info.id()).toBe(1);
    expect(c_info.id()).toBe(3);
    expect(w.storage().tables().get_table(0)).toBe(undefined);
    w.spawn(new CompA());
    expect(w.storage().tables().get_table(0)?.entity_count()).toBe(1);

    w.spawn(new CompA('A in B'), new CompB());
    expect(w.storage().tables().get_table(1)?.entity_count()).toBe(1);

    w.spawn(new CompA())
    expect(w.storage().tables().get_table(0)?.entity_count()).toBe(2)
})

test('Query Archetypes', () => {
    const w = new World();
    const a_info = w.init_component(CompA);
    const b_info = w.init_component(CompB);
    const c_info = w.init_component(CompC);

    w.spawn(new CompA());
    w.spawn(new CompA('A in B'), new CompB());
    w.spawn(new CompA('A in C'), new CompB(), new CompC());

    const qa = w.query([CompA])
    const aWithB = w.query([CompA], With(CompB))
    const qab = w.query([CompA, CompB])
    const qabc = w.query([CompA, CompB, CompC])
    expect(qa.iter2().count()).toBe(3);
    expect(qa.iter3().count()).toBe(3);
    expect(qab.iter3().count()).toBe(2);
    expect(qabc.iter3().count()).toBe(1);

    for (const [a] of qa.iter3()) {
        console.log(a.value);
    }

    for (const [a] of aWithB.iter3()) {
        console.log(a.value);
    }
})

test('Archetypes', () => {
    const w = new World();
    const a_info = w.init_component(CompA);
    const b_info = w.init_component(CompB);
    const c_info = w.init_component(CompC);

    w.spawn(new CompA());
    w.spawn(new CompA('A in B'), new CompB());
    w.spawn(new CompA());
    w.spawn(new CompA())
    w.spawn(new CompA('A in B'), new CompB())
    w.spawn(new CompA('A in C'), new CompB('B in C'), new CompC('C'))

    const a_query = w.query([CompA]);
    const ab_query = w.query([CompA, CompB]);
    const abc_query = w.query([CompA, CompB, CompC]);

    for (const ent of a_query) {

    }

    for (const [a] of a_query) {
        expect(
            a.value === 'A' || a.value === 'A in B' || a.value === 'A in C'
        ).toBe(true);
    }

    for (const [a, b] of ab_query) {
        expect(
            a.value === 'A' || a.value === 'A in B' || a.value === 'A in C'
        ).toBe(true);
        expect(b.value === 'B' || b.value === 'B in C').toBe(true)

        a.value = 'modified A'
    }

    for (const [a, b, c] of abc_query) {
        expect(a.value === 'modified A').toBe(true);
        expect(b.value === 'B' || b.value === 'B in C').toBe(true)
        expect(c.value).toBe('C')
    }

    const tables = w.tables();
    const a_table = tables.get_table(0)!;
    const b_table = tables.get_table(1)!;

    expect(b_table.is_superset(a_table)).toBe(true);
    expect(!a_table.is_superset(b_table)).toBe(true);

})