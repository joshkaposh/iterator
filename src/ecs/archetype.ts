import { ComponentId } from ".";
import { Bit } from "../intrinsics";
import { iter, Iterator } from "../iter";
import type { Option } from "../option";
import type { TableId } from "./storage";

export type ArchetypeId = number;

export const ARCHETYPE_ID = {
    INVALID: -1
}

export function archetype_id(component_ids: Iterable<ComponentId>) {
    return Bit.set_many(0, ...component_ids)
}

export class Archetype {
    #id: ArchetypeId;
    #table_id: TableId;
    #component_ids: ComponentId[]
    constructor(table_id: TableId, ids: ComponentId[], id: ArchetypeId = archetype_id(ids)) {
        this.#id = id;
        this.#table_id = table_id;
        this.#component_ids = ids;
    }

    component_ids(): ComponentId[] {
        return this.#component_ids
    }

    contains(component_id: ComponentId) {
        return Bit.check(this.#id, component_id);
    }

    id(): ArchetypeId {
        return this.#id;
    }
    table_id(): TableId {
        return this.#table_id;
    }
}

export class Archetypes {
    #archetypes: Map<ArchetypeId, Archetype> = new Map();
    #generation = 0;

    generation(): number {
        return this.#generation;
    }

    len(): number {
        return this.#archetypes.size;
    }

    has_archetype(archetype_id: ArchetypeId): boolean {
        return this.#archetypes.has(archetype_id);
    }

    insert_archetype(mask: number, archetype: Archetype) {
        this.#generation++;
        this.#archetypes.set(mask, archetype);
    }

    get_archetype(archetype_id: ArchetypeId): Option<Archetype> {
        return this.#archetypes.get(archetype_id);
    }

    iter(): Iterator<Archetype> {
        return iter(this.#archetypes.values());
    }
}