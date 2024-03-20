import type { Component, ComponentId, QueryData, QueryResult, World } from ".";
import { Bit } from "../intrinsics";
import { DoubleEndedIterator, ExactSizeDoubleEndedIterator, iter, range } from "../iter";
import { type Option, is_some } from "../option";
import type { ArchetypeId } from "./archetype";
import { swap_remove } from "./array-helpers";
import { Entity, EntityId } from "./entity";
import { GenKey, GenerationalArray } from "./generational-array";

export type TableId = number;
export type ColumnId = number;
export type Entities = DoubleEndedIterator<{}[]>

// if ordering of the elements dont matter, 
// you can swap 'i' with last element and then pop()



export class Column<T = {}> {
    #data: T[] = [];
    len(): number {
        return this.#data.length;
    }

    get_unsafe(i: number): T {
        return this.#data[i];
    }

    swap_remove(i: number) {
        swap_remove(this.#data, i)
    }

    resize(len: number) {
        this.#data.length = len;
    }

    reserve_one_and_insert(element: T) {
        const i = this.len();
        this.reserve(1);
        this.insert(i, element);
    }

    reserve(additional_capacity: number) {
        this.#data.length += additional_capacity;
    }

    insert(i: number, element: T) {
        this.#data[i] = element;
    }
}

export type TableRow = {}[];
export type ArchetypeRow = DoubleEndedIterator<Column>


// TODO: implement 'generational array'
export class Table {
    #table: Record<ComponentId, Column> = {}
    #id: TableId;
    #archetype_id: ArchetypeId;
    constructor(table_id: TableId, archetype_id: ArchetypeId) {
        this.#id = table_id;
        this.#archetype_id = archetype_id;
    }

    archetype_id(): ArchetypeId {
        return this.#archetype_id;
    }

    entity_refs(archetype_id?: Option<ArchetypeId>) {
        return is_some(archetype_id) ?
            iter(range(0, this.entity_count())).map(i => this.entity_ref(i, this.#columns_from_archetype(archetype_id))) :
            iter(range(0, this.entity_count())).map(i => this.entity_ref(i, this.iter()))

    }

    entities(archetype_id?: Option<ArchetypeId>): Entities {
        return is_some(archetype_id) ?
            iter(range(0, this.entity_count())).map(i => this.entity(i, this.#columns_from_archetype(archetype_id))) as Entities :
            iter(range(0, this.entity_count())).map(i => this.entity(i, this.iter())) as Entities
    }

    entity_count(): number {
        return Object.values(this.#table)[0].len();
    }

    entity_capacity(): number {
        return 0;
    }

    column_count(): number {
        return Object.keys(this.#table).length;
    }

    component_count(): number {
        return this.entity_count() * this.column_count();
    }

    component_ids() {
        return iter(Object.keys(this.#table)).map(v => Number(v))
    }

    get_column(component_id: ComponentId): Option<Column> {
        return this.#table[component_id];
    }

    has_column(component_id: ComponentId): boolean {
        return is_some(this.#table[component_id]);
    }

    reserve(additional_capacity: number) {
        this.iter().for_each(col => col.reserve(additional_capacity));
    }

    resize(len: number) {
        this.iter().for_each(col => col.resize(len));
    }

    id(): TableId {
        return this.#id;
    }

    insert_columns(components_ids: ComponentId[]) {
        components_ids.forEach(id => {
            const column = new Column();
            this.#table[id] = column;
        })
    }

    insert_column(component_id: ComponentId) {
        const column = new Column();
        this.#table[component_id] = column;
        return column;
    }

    insert_row(i: number, row: InstanceType<Component>[], world: World) {
        row.forEach(comp => {
            const id = world.component_id(comp);
            this.get_column(id)?.insert(i, comp);
        })
    }

    is_empty(): boolean {
        return this.entity_count() === 0;
    }

    is_superset(table: Table) {
        return table.is_subset(this.#archetype_id);
    }

    is_subset(archetype_id: ArchetypeId) {
        return Bit.subset(this.component_ids(), archetype_id)
    }

    iter(): ExactSizeDoubleEndedIterator<Column> {
        return iter(Object.values(this.#table));
    }

    entity_ref(i: EntityId, cols: DoubleEndedIterator<Column>): Entity<QueryData> {
        return new Entity(this, this.entity(i, cols) as unknown as QueryResult<QueryData>, i);
    }

    entity(i: EntityId, cols: DoubleEndedIterator<Column>): {}[] {
        return cols.fold([] as {}[], (acc, x) => {
            acc.push(x.get_unsafe(i))
            return acc;
        })
    }

    #columns_from_archetype(archetype_id: ArchetypeId) {
        return this.component_ids()
            .filter(id => Bit.check(archetype_id, id))
            .map(id => this.get_column(id)!);
    }
}

class Tables {
    #tables: Table[] = [];

    len(): number {
        return this.#tables.length;
    }

    insert_table(table: Table): void {
        this.#tables.push(table)
    }

    get_table(table_id: TableId): Option<Table> {
        return this.#tables[table_id];
    }

    iter() {
        return iter(this.#tables);
    }

}

export class Storage {
    #tables = new Tables();

    tables() {
        return this.#tables
    }
}
