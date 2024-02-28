import { Component, ComponentId, World } from ".";
import { Bit } from "../intrinsics";
import { DoubleEndedIterator, iter } from "../iter";
import { Option } from "../option";
import { Mut, assert_some } from "../util";
import { Archetype } from "./archetype";
import { Entity } from "./entity";
import { Table, TableRow } from "./storage";

export type QueryData = readonly Component[];
// export type QueryFilter = readonly Component[];

type Fetch = {};

// interface QueryFilter2 {
//     filter_fetch(fetch: Fetch, entity: Entity, table_row: TableRow): boolean;
// }

export type QueryResult<T extends QueryData> = {
    [P in keyof T]: InstanceType<T[P]>
}

type State = {};

type UnsafeWorldCell = World;

abstract class WorldQuery<Item, S extends State, F extends Fetch> {
    abstract IS_DENSE: boolean;
    abstract fetch(fetch: F, entity: Entity, table_row: TableRow): Item
    abstract get_state(world: World): Option<S>;
    abstract init_fetch(world: UnsafeWorldCell, state: S): F;
    abstract init_state(world: Mut<World>): S;
    abstract matches_component_set(state: S, set_contains_id: (component_id: ComponentId) => boolean): boolean
    abstract set_archetype(fetch: F, state: S, archetype: Archetype, table: Table): void
    abstract set_table(fetch: Mut<Fetch>, state: State, table: Table): void
    // abstract shrink(): void
    // creates a new instance of this fetch
    abstract update_component_access(world: UnsafeWorldCell, state: S): F;
}

export type QueryFilter<T extends string, D extends QueryData> = {
    type: T
    data: D;
}
export function With<const T extends QueryData>(...components: T): QueryFilter<'with', T> {
    return { type: 'with', data: components }
}

function With2<const T extends QueryData>(...components: T) {
    return (table: Table) => {

    }
}

export class Query<Q extends QueryData, F extends QueryFilter<string, QueryData>> {
    #world: World;
    #data: Q;
    #filter: F;
    constructor(world: World, query_data: Q, query_filter: F) {
        this.#world = world;
        this.#data = query_data;
        this.#filter = query_filter
    }


    iter2() {
        const ids = this.#world.component_ids(this.#data as Mut<Q>);

        // const filter = this.#world.component_ids(this.#filter.data as Mut<Q>);
        // const archetype = this.#world.get_archetype(this.#data as Mut<Q>);
        const archetypes = this.#world.archetypes().iter().filter(a => Bit.subset(ids, a.id()));
        return archetypes
    }

    iter3(): DoubleEndedIterator<QueryResult<Q>> {
        const ids = this.#world.component_ids(this.#data as Mut<Q>);
        if (this.#filter.data.length > 0) {
            // more work!
            console.log('Filter', this.#filter.type, this.#filter.data);
            // filter type should include function that 
        }
        const archetype = this.#world.get_archetype(this.#data as Mut<Q>);

        const archetypes = this.#world.archetypes().iter().filter(a => Bit.subset(ids, a.id()));
        const tables = archetypes.map(a => this.#world.tables().get_table(a.table_id())!);
        assert_some(archetype);


        return tables.map((table) => {
            return table.entities(archetype.id()).next().value;
        }) as unknown as DoubleEndedIterator<QueryResult<Q>>
        // for each table, get table row!
    }

    iter(): DoubleEndedIterator<QueryResult<Q>> {
        const archetype = this.#world.get_archetype(this.#data as Mut<Q>);
        assert_some(archetype);
        const table = this.#world.storage().tables().get_table(archetype.table_id())!;
        const ids = table.component_ids().collect()
        const filtered_entities = this.#world.tables().iter().filter(t => {
            if (t === table) {
                return false
            }
            return iter(ids).all((id) => t.has_column(id));
        }).map(t => t.entities(archetype.id()).next().value);

        const base = table.entities();
        return base.chain(filtered_entities) as DoubleEndedIterator<QueryResult<Q>>;
    }

    [Symbol.iterator]() {
        return this.iter()
    }
}