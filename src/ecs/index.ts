import { Archetypes, archetype_id } from "./archetype";
import { CommandQueue, Commands } from "./command";
import { Query, QueryData, QueryFilter } from "./query";
import { Storage } from "./storage";
import { Component, ComponentId, Components, Resource } from './component'
import { Option } from "../option";
import { Schedules, SystemFn, Schedule } from "./system";
import { Plugin } from "./plugin";

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

export class World {
    #archetypes = new Archetypes()
    #components = new Components();
    #schedules = new Schedules();
    #storage = new Storage();
    #command_queue = new CommandQueue();
    // #commands: Commands;
    #runner: Option<(schedules: Schedules) => void>;
    // #plugins = [];
    #initialized = false;
    constructor() { }

    init_world() {
        this.#build();
    }

    run() {
        if (this.#runner) {
            this.#runner(this.#schedules);
        }
    }

    #build() {
        this.#initialized = true;
    }

    archetypes(): Archetypes {
        return this.#archetypes;
    }

    add_plugin(plugin: Plugin): this {
        plugin.build(this);
        return this;
    }

    add_resource(resource: Resource): this {
        this.#components.init_resource(resource);
        return this;
    }

    add_schedule(schedule: Schedule<string>) {
        this.#schedules.insert_schedule(schedule)
        return this;

    }

    add_system<S extends SystemFn, const P extends Parameters<S>>(schedule: Schedule<string>, system: S, params: P): this {
        schedule.add_system([system, params as any]);
        return this;
    }

    commands(): Commands {
        return new Commands(this.#command_queue, this);
    }

    components(): Components {
        return this.#components;
    }

    component_id(component: Component | InstanceType<Component>) {
        return this.#components.component_id(component)!;
    }

    component_ids(components: (Component | InstanceType<Component>)[]) {
        return this.#components.component_ids(components);
    }

    component_info(component: Component | InstanceType<Component>) {
        return this.#components.get_component_info(component)
    }

    get_archetype(components: Component[]) {
        const id = archetype_id(this.component_ids(components))
        return this.#archetypes.get_archetype(id);
    }

    get_resource<T extends Resource>(resource: T): any {
    }

    init_component<T extends Component>(component: T): this {
        this.#components.init_component(component);
        return this
    }

    init_resource<T extends Resource>(resource: T) {
        this.#components.init_resource(resource);
        return this;
    }


    set_runner(runner: (schedules: Schedules) => void) {
        this.#runner = runner;
    }

    spawn(...components: InstanceType<Component>[]) {
        return this.commands().spawn(components);
    }

    spawn_batch<T extends InstanceType<Component>[]>(...components: T[]) {
        return this.commands().spawn_batch(components)
    }

    storage() {
        return this.#storage;
    }

    resource_id(resouce: Resource): Option<ComponentId> {
        return this.#components.resource_id(resouce)
    }

    tables() {
        return this.#storage.tables();
    }

    query<const Q extends QueryData, const F extends readonly QueryFilter[]>(q: Q, f: F = [] as unknown as F): Query<Q, F> {
        return new Query(this, q, f);
    }

    query_ref<const Q extends QueryData, const F extends readonly QueryFilter[]>(q: Q, f: F = [] as unknown as F): Query<Q, F, true> {
        return new Query(this, q, f, true);
    }

}
