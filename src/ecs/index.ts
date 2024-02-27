import { iter } from "../iter";
import { Option } from "../option";
import { Archetypes, archetype_id } from "./archetype";
import { CommandQueue, Commands } from "./command";
import { Query, QueryData } from "./query";
import { Storage } from "./storage";
import { Component, ComponentInfo } from './component'

export * from './component'
export * from './command';
export * from './query';

export type Indexable<T extends number> = {
    index(): T;
}

export class Index<T extends number> {
    #i: T;
    constructor(i: T) {
        this.#i = i;
    }
    set_index(i: T) {
        this.#i = i;
    }
    index() {
        return this.#i
    }
}

export function define(component: Component, world: World) {
    return world.init_component(component);
}

class Components {
    #components: ComponentInfo<Component>[] = [];

    init_component<T extends Component>(component: T) {
        const info = new ComponentInfo(component, this.#components.length + 1);
        this.#components.push(info);
        return info;
    }

    get_component_info<T extends Component | InstanceType<Component>>(component: T): Option<ComponentInfo<T extends Component ? T : new (...args: any[]) => T>> {
        for (const info of this.#components) {
            if (component instanceof info.type() || component === info.type()) {
                return info as ComponentInfo<T extends Component ? T : new (...args: any[]) => T>
            }
        }
        return null;
    }
}

export class World {
    #archetypes = new Archetypes()
    #components = new Components();
    #storage = new Storage();
    #command_queue = new CommandQueue();

    tables() {
        return this.#storage.tables();
    }

    archetypes(): Archetypes {
        return this.#archetypes;
    }

    components(): Components {
        return this.#components;
    }

    command_queue(): CommandQueue {
        return this.#command_queue
    }

    component_id(component: Component | InstanceType<Component>) {
        return this.#components.get_component_info(component)!.id();
    }

    component_ids(components: (Component | InstanceType<Component>)[]) {
        return iter(components).map(c => this.component_id(c)).collect()
    }

    init_component<T extends Component>(component: T) {
        return this.#components.init_component(component);
    }

    get_archetype(components: (Component | InstanceType<Component>)[]) {
        const id = archetype_id(this.component_ids(components))
        return this.#archetypes.get_archetype(id);
    }

    spawn(...components: InstanceType<Component>[]) {
        Commands.spawn(components, this.#command_queue);
        // immediately apply command;
        this.#command_queue.dequeue()?.apply(this);
    }

    query<const Q extends QueryData>(q: Q): Query<Q> {
        return new Query(this, q, []);
    }

    query_filtered<const Q extends QueryData, const F extends QueryData>(q: Q, f: F): Query<Q, F> {
        return new Query(this, q, f)
    }

    storage() {
        return this.#storage;
    }
}
