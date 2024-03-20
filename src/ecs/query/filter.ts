import { Fetch, QueryData } from ".";
import { Component, ComponentId, World } from "..";
import { Bit } from "../../intrinsics";
import { Option } from "../../option";
import { Mut, assert_some } from "../../util";
import { Archetype, ArchetypeId, Archetypes, archetype_id } from "../archetype";

// export type Fetch = {
//     archetype: Archetype;
//     access: Set<ComponentId>;
//     include_table: (a: Archetype) => boolean;
// }
// const s = new Set().values()
// access.values(), a.id()
// type Subset = {
//     current_archetype_id: ArchetypeId;
//     is_subset: boolean;
// }

export type QueryFilter = {
    update_component_access(world: World, access: Set<ComponentId>, data: QueryData): void;
    set_archetype(archetypes: Archetypes, fetch: Fetch): void;
    include_table(fetch: Fetch, archetype_id: ArchetypeId, is_subset: boolean): boolean;
}
export function With<const T extends QueryData>(...components: T) {
    return new FilterWith(components);
}

export function Without<const T extends QueryData>(...components: T) {
    return new FilterWithout(components)
}

class FilterWith implements QueryFilter {
    #data: QueryData;
    #ids: ComponentId[] = [];
    constructor(data: QueryData) {
        this.#data = data;
    }

    update_component_access(world: World, access: Set<ComponentId>, data: Component[]): void {
        for (let i = 0; i < this.#data.length; i++) {
            const id = world.component_id(this.#data[i])
            this.#ids.push(id);
            access.add(id);
        }
    }

    set_archetype(archetypes: Archetypes, fetch: Fetch): void {

    }

    include_table(fetch: Fetch, archetype_id: number, is_subset: boolean): boolean {
        return is_subset
    }
}

class FilterWithout implements QueryFilter {
    #data: QueryData;
    #ids!: ComponentId[]

    constructor(data: QueryData) {
        this.#data = data;
    }

    set_archetype(archetypes: Archetypes, fetch: Fetch): void {
        // set archetype to match filter archetype;
        const archetype = archetypes.get_archetype(archetype_id(fetch.access))
        assert_some(archetype);
        fetch.archetype = archetype;
    }

    update_component_access(world: World, access: Set<ComponentId>, data: QueryData): void {
        this.#ids = world.component_ids(this.#data as any)
    }

    include_table(fetch: Fetch, archetype_id: ArchetypeId, subset: boolean): boolean {
        // include table only if assignable to subset AND not in 'filter ids'
        return subset && !Bit.subset(this.#ids, archetype_id)
    }
}