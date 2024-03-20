import { expect, test } from "vitest";
import { Commands, Component, Query, QueryData, QueryFilter, QueryResult, With, Without, World } from '../src/ecs';
import { v4 as uuid } from 'uuid'
import { Mut, TODO } from "../src/util";
import { Schedule } from "../src/ecs/system";
import { is_some } from "../src/option";
import { GenerationalArray } from "../src/ecs/generational-array";
import { EntityRef } from "../src/ecs/entity";
import { DoubleEndedIterator, Iter } from "../src/iter";

class CompA {
    static type_id = uuid();
    constructor(public value: string = 'A') { }
    readonly type_id = CompA.type_id;

}

class CompB {
    static readonly type_id = uuid();
    readonly type_id = CompB.type_id;

    constructor(public value: string = 'B') { }
}
class CompC {
    static readonly type_id = uuid();
    readonly type_id = CompC.type_id;

    constructor(public value: string = 'C') { }
}

class MyResource {
    static readonly type_id = uuid();
    readonly type_id = MyResource.type_id;

    #times_modified = 0;
    modify() {
        this.#times_modified++;
    }

    modify_count() {
        return this.#times_modified;
    }
}

function my_system(query: Query<readonly [typeof CompA], readonly []>, commands: Commands) {
    console.log('system running!');
    for (const [a] of query) {
        a.value = 'modified';
    }
    commands.spawn([new CompA()])
}

function remove_system(query: Query<readonly [typeof CompA], readonly [], true>, commands: Commands) {
    for (const ent of query) {
        commands.despawn(ent)
    }
}

test('query_ref', () => {
    const w = new World();
    w.init_component(CompA)
    w.init_component(CompB)
    w.init_component(CompC)
    w.spawn(new CompA());
    w.spawn(new CompA(), new CompB(), new CompC());

    const q = w.query_ref([CompA]);

    for (const ent of q) {
        const [a] = ent.components();
        expect(a.value).toBe('A');
    }
})

test('Query adds new archetype on run', () => {
    const w = new World();
    w.init_component(CompA)
        .init_component(CompB)
        .init_component(CompC)

    const q = w.query([CompA])

    expect(q.iter().count()).toBe(0);
    w.spawn(new CompA());
    expect(q.iter().count()).toBe(1);
})

test('spawn_batch works', () => {
    const w = new World();
    w.init_component(CompA)
    w.spawn_batch([new CompA()], [new CompA()], [new CompA()], [new CompA()]);
    const table = w.tables().get_table(0)!

    expect(table.entity_count()).toBe(4);
    w.spawn_batch([new CompA('a1')], [new CompA('a2')], [new CompA('a3')], [new CompA('a4')]);
    expect(table.entity_count()).toBe(8);

    const q = w.query([CompA]);

    for (const [i, [a]] of q.iter().enumerate()) {
        expect((i < 4 && a.value === 'A') || (i >= 4 && a.value !== 'A')).toBe(true);
    }
})

// TODO: make it so user provides Query<[typeof A], []> as Immut as QueryMut<[typeof A], []> as Mut

test('despawn works', () => {
    const w = new World();
    w.init_component(CompA);
    const Startup = new Schedule('Startup');
    w.add_schedule(Startup);
    w.set_runner((s) => s.execute());
    w.add_system(Startup, remove_system, [w.query_ref([CompA], []), w.commands()]);

    const q = w.query([CompA]);
    w.spawn(new CompA());

    w.init_world();
    w.run();

    expect(q.iter().count()).toBe(0)
})

test('Systems', () => {
    const w = new World();
    w.init_component(CompA);
    const Startup = new Schedule('Startup');
    w.add_schedule(Startup);
    w.set_runner((s) => s.execute());

    w.spawn(new CompA());
    w.spawn(new CompA());
    w.spawn(new CompA());
    w.spawn(new CompA());

    const q = w.query([CompA]);

    w.add_system(Startup, my_system, [w.query([CompA], []), w.commands()]);

    for (const [a] of q) {
        console.log(a.value);
    }
    expect(q.iter().count()).toBe(4)
    w.init_world();
    w.run();
    expect(q.iter().count()).toBe(5)

})

test('Many works', () => {
    const w = new World();
    w.init_component(CompA);
    // w.spawn(new CompA())
    // w.spawn(new CompA())
    // w.spawn(new CompA())
    // w.spawn(new CompA())
    // w.spawn(new CompA())
    const q = w.query([CompA]);
    // expect(q.iter().count()).toBe(5);
})

test('Resources', () => {
    const w = new World();
    w.init_component(CompA)
    w.init_component(CompB)
    w.init_resource(MyResource);

    expect(w.component_info(MyResource)?.id()).toBe(3);

    expect(w.component_id(CompA)).toBe(1);
    expect(w.component_id(CompB)).toBe(2);
    expect(w.component_id(MyResource)).toBe(undefined);
    expect(w.resource_id(MyResource)).toBe(3);

    expect(w.components().component_ids([CompA, CompB])).toEqual([1, 2])
    expect(w.components().component_ids([CompA, CompB, MyResource])).toEqual([1, 2])
})

test('query_filter', () => {
    const w = new World();
    w.init_component(CompA)
    w.init_component(CompB)
    w.init_component(CompC)

    expect(w.component_id(CompA)).toBe(1)
    expect(w.component_id(CompB)).toBe(2)

    w.spawn(new CompA('lonely A'));
    w.spawn(new CompA('lonely A'));
    w.spawn(new CompA('lonely A'));
    w.spawn(new CompA('lonely A'));
    w.spawn(new CompA('lonely A'));
    w.spawn(new CompA('lonely A'));
    w.spawn(new CompA('lonely A'));
    w.spawn(new CompA('A in B'), new CompB());
    w.spawn(new CompA('A in B'), new CompB());
    w.spawn(new CompA('A in C'), new CompB(), new CompC());
    w.spawn(new CompA('A in C'), new CompB(), new CompC());

    const table_a = w.tables().get_table(0);
    const table_ab = w.tables().get_table(1)
    const table_abc = w.tables().get_table(2)

    expect(table_a?.entity_count()).toBe(7);
    expect(table_ab?.entity_count()).toBe(2);
    expect(table_abc?.entity_count()).toBe(2);


    const qwith = w.query([CompA], [With(CompB)]);
    const qwithout = w.query([CompA], [Without(CompB)])
    const onlyb = w.query([CompA], [With(CompB), Without(CompC)])
    console.log('QWITH', qwith.iter());
    console.log('QWITHOUT', qwithout.iter().count());

    expect(onlyb.iter().count()).toBe(2)
    expect(qwith.iter().count()).toBe(4)
    expect(qwithout.iter().count()).toBe(7)

    for (const [a] of onlyb) {
        expect(a.value === 'A in B').toBe(true)
    }

    for (const [a] of qwith.iter()) {
        expect(a.value !== 'lonely A').toBe(true)
    }

    for (const [a] of qwithout.iter()) {
        expect(a.value === 'lonely A')
    }
})

test('EntityCount', () => {
    const w = new World();

    w.init_component(CompA);
    w.init_component(CompB);
    w.init_component(CompC);
    const a_info = w.component_info(CompA)!
    const c_info = w.component_info(CompC)!

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
    w.init_component(CompA);
    w.init_component(CompB);
    w.init_component(CompC);

    w.spawn(new CompA());
    w.spawn(new CompA('A in B'), new CompB());
    w.spawn(new CompA('A in C'), new CompB(), new CompC());

    const qa = w.query([CompA])
    const qab = w.query([CompA, CompB])
    const qabc = w.query([CompA, CompB, CompC])
    expect(qa.iter().count()).toBe(3);
    expect(qa.iter().count()).toBe(3);
    expect(qab.iter().count()).toBe(2);
    expect(qabc.iter().count()).toBe(1);
})

test('Archetypes', () => {
    const w = new World();
    w.init_component(CompA);
    w.init_component(CompB);
    w.init_component(CompC);

    w.spawn(new CompA());
    w.spawn(new CompA('A in B'), new CompB());
    w.spawn(new CompA());
    w.spawn(new CompA())
    w.spawn(new CompA('A in B'), new CompB())
    w.spawn(new CompA('A in C'), new CompB('B in C'), new CompC('C'))

    const a_query = w.query([CompA]);
    const ab_query = w.query([CompA, CompB]);
    const abc_query = w.query([CompA, CompB, CompC]);

    for (const [a] of a_query) {
        expect(
            a.value === 'A' || a.value === 'A in B' || a.value === 'A in C'
        ).toBe(true);
    }

    for (const [a, b] of ab_query) {
        // console.log(a.value, b.value);

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

    expect(a_table.entity_count()).toBe(3);
    // const ents = a_table.entities();
})