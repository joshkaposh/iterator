import { GenKey } from "./generational-array";
import { Table, type TableId } from "./storage";

export type EntityId = number;
export class Entity implements GenKey {
    #table: Table;
    #components: {}[];
    #id: EntityId;
    #generation: number;
    // #key: GenKey;
    constructor(key: GenKey, table: Table, components = []) {
        this.#table = table;
        this.#components = components;
        this.#id = key.index;
        this.#generation = key.generation;
    }

    get index() {
        return this.#id;
    }

    get generation() {
        return this.#generation;
    }

    insert_component(component: {}) {
        this.#components.push(component);
    }

    get(i: number) {
        return this.#components[i];
    }



    id(): EntityId {
        return this.#id;
    }

    table_id(): TableId {
        return this.#table.id();
    }

    [Symbol.iterator]() {
        return this.#components[Symbol.iterator]()
    }
}
