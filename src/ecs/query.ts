import { Component, World } from ".";
import { DoubleEndedIterator, iter } from "../iter";
import { Mut, assert_some } from "../util";

export type QueryData = readonly Component[];
export type QueryFilter = readonly Component[];

export type QueryResult<T extends QueryData> = {
    [P in keyof T]: InstanceType<T[P]>
}

export class Query<Q extends QueryData, F = QueryFilter> {
    #world: World;
    #data: Q;
    #filter: F;
    constructor(world: World, query_data: Q, query_filter: F) {
        this.#world = world;
        this.#data = query_data;
        this.#filter = query_filter
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