import { Option } from "../option";
import { ARCHETYPE_ID, ArchetypeId } from "./archetype";
import { reserve } from "./array-helpers";
import { QueryData, QueryResult } from "./query";
import { Table, type TableId } from "./storage";
import * as Intrinsics from '../intrinsics';
type u32 = number;

export type EntityId = number;

type ArchetypeRow = {};
type TableRow = {};

class EntityLocation {
    constructor(
        public readonly archetype_id: ArchetypeId,
        public readonly archetype_row: ArchetypeRow,
        public readonly table_id: TableId,
        public readonly table_row: TableRow
    ) { }
}

export class EntityMeta {
    constructor(public location: EntityLocation, public generation: number) { }

    static readonly EMPTY = new EntityMeta(new EntityLocation(0, 0, 0, 0), 1)
}

class Entity2 {
    constructor(public index: number, public generation = 1) { }
}

export type EntityRef<T extends QueryData> = {
    id(): EntityId;
    generation(): number;
    table_id(): TableId;
    components(): QueryResult<T>;
}

export class Entity<T extends QueryData> implements EntityRef<T> {
    #table: Table;
    #components: QueryResult<T>;
    #id: EntityId;
    #generation: number;
    constructor(table: Table, components: QueryResult<T> = [] as QueryResult<T>, index: number, generation = 1) {
        this.#table = table;
        this.#components = components;
        this.#id = index;
        this.#generation = generation;
    }

    get index() {
        return this.#id;
    }

    id(): EntityId {
        return this.#id;
    }

    generation(): number {
        return this.#generation;
    }

    table_id(): TableId {
        return this.#table.id();
    }

    components(): QueryResult<T> {
        return this.#components
    }

    debug() {
        return this.components()[Symbol.iterator]()
    }

    [Symbol.iterator]() {
        return this.#components[Symbol.iterator]();
    }
}

class IndentifierMask {
    static inc_masked_high_by(generation: number, idk: number) {
        return 0;
    }
}

export class Entities {
    #meta: EntityMeta[];
    #pending: number[];
    #free_cursor: number;
    #len: number;

    constructor() {
        this.#meta = [];
        this.#pending = [];
        this.#free_cursor = 0;
        this.#len = 0;
    }

    reserve_entities(count: number) {
        const range_end = this.#free_cursor - count;
        const range_start = range_end - count;

        // const freelist_range = range(range_start, range_end);

        let items;
        if (range_start >= 0) {
            items = [0, 0]
        } else {
            const base = this.#meta.length;
            const new_id_end = base - range_start;
            const new_id_start = base - range_end;

            items = [new_id_start, new_id_end];
        }

        // const it =
        // return new ReserveEntitiesIterator(this.#meta, )
    }

    reserve_entity() {
        const n = this.#free_cursor - 1;
        if (n > 0) {
            const index = this.#pending[n - 1];
            return new Entity2(index, this.#meta[index].generation);
        } else {
            return new Entity2(this.#meta.length - n)
        }
    }

    needs_flush(): boolean {
        return false;
    }

    free(entity: Entity<any[]>): Option<EntityLocation> {
        if (this.needs_flush()) {
            return;
        }

        const meta = this.#meta[entity.id()];
        if (meta.generation !== entity.generation()) {
            return null;
        }

        meta.generation = IndentifierMask.inc_masked_high_by(meta.generation, 1);

        if (meta.generation <= 0) {
            console.warn('Entity %d generation wrapped on Entities::free, aliasing may occur', entity.index)
        }

        const loc = EntityMeta.EMPTY.location;
        meta.location = loc;
        this.#pending.push(entity.index);

        const new_free_cursor = this.#pending.length;
        this.#free_cursor = new_free_cursor;

        this.#len -= 1;

        return loc;
    }

    reserve(additional: u32) {
        if (this.needs_flush()) {
            return;
        }

        const freelist_size = this.#free_cursor;

        const shortfall = additional - freelist_size;
        if (shortfall > 0) {
            reserve(this.#meta, shortfall);
        }
    }

    resolve_from_id(index: number): Option<Entity2> {
        const meta = this.#meta[index];

        if (meta) {
            return new Entity2(index, meta.generation)
        } else {
            const free_cursor = this.#free_cursor;
            const num_pending = Intrinsics.u32.try_from(-free_cursor);
            const num = (index < this.#meta.length + num_pending)
            return num ? new Entity2(index) : null
        }

        return null
    }

    contains(entity: Entity<any[]>) {
        const e = this.resolve_from_id(entity.index);

        return !e ? false : e.generation === entity.generation();
    }

    clear() {
        this.#meta = [];
        this.#pending = [];

        this.#free_cursor = 0;
        this.#len = 0;
    }

    get(entity: Entity<any[]>): Option<EntityLocation> {
        const meta = this.#meta[entity.index];
        if (meta) {
            if (meta.generation !== entity.generation()
                || meta.location.archetype_id === ARCHETYPE_ID.INVALID) {
                return null;
            }
            return meta.location;
        } else {
            return null;
        }
    }
}