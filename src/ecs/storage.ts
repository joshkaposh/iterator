import type { ComponentId } from ".";
import { Bit } from "../intrinsics";
import { DoubleEndedIterator, ExactSizeDoubleEndedIterator, iter } from "../iter";
import { type Option, is_some } from "../option";
import type { ArchetypeId } from "./archetype";
import { Entity } from "./entity";
import { GenKey, GenerationalArray } from "./generational-array";

export type TableId = number;
export type ColumnId = number;
export type Entities = DoubleEndedIterator<Entity>

export class Column<T = {}> {
    #data: T[] = [];
    #data2: GenerationalArray<T> = new GenerationalArray();
    len(): number {
        return this.#data.length;
    }

    get_unsafe_gen(i: GenKey) {
        return this.#data2.get(i)
    }

    remove_gen(i: GenKey) {
        this.#data2.remove(i);
    }

    resize_gen() { }

    get_unsafe(i: number): T {
        return this.#data[i];
    }

    remove(i: number) {
        this.#data.splice(i, 1);
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

    entities(archetype_id?: Option<ArchetypeId>): Entities {
        if (is_some(archetype_id)) {
            return this.#iter_columns(archetype_id);
        }
        return iter(Array.from({ length: this.entity_count() }, (_, idx) => idx)).map(id => this.iter().fold(new Entity({ index: id, generation: 0 }, this), (ent, col) => {
            ent.insert_component(col.get_unsafe(id))
            return ent
        }))
    }

    id(): TableId {
        return this.#id;
    }

    is_superset(table: Table) {
        return table.is_subset(this.#archetype_id);
    }

    is_subset(archetype_id: ArchetypeId) {
        return Bit.subset(this.component_ids(), archetype_id)
    }

    component_ids() {
        return iter(Object.keys(this.#table)).map(v => Number(v))
    }

    insert_column(component_id: ComponentId) {
        const column = new Column();
        this.#table[component_id] = column;
        return column;
    }

    get_column(component_id: ComponentId): Option<Column> {
        return this.#table[component_id];
    }

    has_column(component_id: ComponentId): boolean {
        return is_some(this.#table[component_id]);
    }

    entity_count(): number {
        return Object.values(this.#table)[0].len();
    }

    component_count(): number {
        return this.iter().map(c => c.len()).sum();
    }

    entity_capacity(): number {
        return 0;
    }

    is_empty(): boolean {
        return this.entity_count() === 0;
    }

    iter(): ExactSizeDoubleEndedIterator<Column> {
        return iter(Object.values(this.#table));
    }

    #iter_filter_columns(archetype_id: ArchetypeId) {
        return this.component_ids()
            .filter(id => Bit.check(archetype_id, id))
            .map(id => this.get_column(id)!)
    }

    #iter_columns(archetype_id?: Option<ArchetypeId>): Entities {
        const columns = is_some(archetype_id) ? this.#iter_filter_columns(archetype_id) : this.iter();

        return iter(Array.from({ length: this.entity_count() }, (_, i) => i))
            .map(i => columns.fold(new Entity({ index: i, generation: 0 }, this), (acc, x) => {
                acc.insert_component(x.get_unsafe(i))
                return acc;
            }))
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
