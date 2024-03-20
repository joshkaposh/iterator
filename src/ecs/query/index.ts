import { Component, ComponentId, World } from "..";
import { Bit } from "../../intrinsics";
import { DoubleEndedIterator, iter as __iter } from "../../iter";
import { Option, is_some } from "../../option";
import { Mut, assert_some } from "../../util";
import { Archetype } from "../archetype";
import { Entity, EntityRef } from "../entity";
import { Table } from "../storage";
import { QueryFilter } from "./filter";

export * from './filter'

export type QueryData = readonly Component[];

type InstanceTypeArray<T extends QueryData> = {
    [P in keyof T]: InstanceType<T[P]>
}

export type QueryResult<T extends QueryData> = InstanceTypeArray<T>;
export type Fetch = {
    archetype: Archetype;
    access: Set<ComponentId>;
}

export class Query<Q extends QueryData, F extends readonly QueryFilter[], Ref = false> {
    #world: World;
    #data: Q;
    #filter: F;
    #fetch!: Fetch;
    #tables: Option<Table[]>;
    #archetype_generation: number;
    #needs_ref: boolean;

    constructor(world: World, query_data: Q, query_filter: F, needs_ref = false) {
        this.#world = world;
        this.#data = query_data;
        this.#filter = query_filter;
        this.#archetype_generation = world.archetypes().generation();
        this.#needs_ref = needs_ref;

        const access = this.#init_access();
        this.#tables = this.#get_tables(access);
    }

    iter(): Ref extends false ? DoubleEndedIterator<QueryResult<Q>> : DoubleEndedIterator<EntityRef<Q>> {
        const current_generation = this.#world.archetypes().generation()
        if (this.#archetype_generation !== current_generation) {
            this.#archetype_generation = current_generation;
            const access = this.#init_access();
            this.#tables = this.#get_tables(access);
        }
        if (this.#tables) {
            const id = this.#fetch.archetype.id();
            return __iter(this.#tables).map(t => {
                if (this.#needs_ref) {
                    return t.entity_refs(id);
                } else {
                    return t.entities(id)
                }
            }).flatten() as any;
        } else {
            return __iter([]);
        }
    }

    #get_tables(access: Option<Set<ComponentId>>) {
        // const filter_arch = this.#world.get_archetype_from_ids(access as any);
        if (access) {

            return this.#world.archetypes().iter()
                .filter(a => {
                    const subset = Bit.subset(access.values(), a.id())
                    const all = __iter(this.#filter).all(f => f.include_table(this.#fetch, a.id(), subset))
                    return subset && all;
                })
                .map(a => this.#world.tables().get_table(a.table_id())!)
                .collect();
        } else {
            return
        }

    }

    #init_access(): Option<Set<ComponentId>> {
        const archetype = this.#world.get_archetype(this.#data as Mut<Q>)
        if (archetype) {

            // assert_some(archetype);
            const _ids = this.#world.component_ids(this.#data as Mut<Q>);
            const _access = new Set(_ids)
            const _fetch = {
                access: _access,
                archetype: archetype,
            }
            this.#fetch = _fetch

            if (this.#filter.length > 0) {
                this.#filter.forEach(f => {
                    f.update_component_access(this.#world, _access, this.#data)
                    f.set_archetype(this.#world.archetypes(), this.#fetch);
                })
            }
            return _access;
        } else {
            return
        }
    }

    [Symbol.iterator]() {
        return this.iter()
    }
}