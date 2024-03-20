import { Component, QueryData, World } from ".";
import { Entity, EntityRef } from './entity'
import { iter } from "../iter";
import type { Option } from "../option";
import { Archetype, archetype_id } from "./archetype";
import { Table } from "./storage";

export abstract class Command {
    abstract apply(world: World): void;
}


type EntityArray = InstanceType<Component>[];

class SpawnCommand extends Command {
    #components: EntityArray
    constructor(components: any[]) {
        super();
        this.#components = components;
    }
    override apply(world: World): void {
        const ids = world.component_ids(this.#components)
        const arch_id = archetype_id(ids);
        let archetype = world.archetypes().get_archetype(arch_id);
        const tables = world.tables();

        if (!archetype) {
            const table = new Table(tables.len(), arch_id);
            tables.insert_table(table);
            //! SAFETY: archetype does not exist, and only inserting one entity, so id = 0
            // const id = 0;
            archetype = new Archetype(table.id(), ids, arch_id)
            world.archetypes().insert_archetype(arch_id, archetype);

            for (const c of this.#components) {
                const component_id = world.component_id(c);
                const column = table.insert_column(component_id);
                column.reserve_one_and_insert(c)
            }
            // return new Entity(id, table)

        } else {
            const table = tables.get_table(archetype.table_id())!;
            // const id = table.entity_count();
            for (const c of this.#components) {
                const component_id = world.component_id(c);
                const column = table.get_column(component_id)!
                column.reserve_one_and_insert(c)
            }
            // return new Entity(id, table);
        }
    }
}

class SpawnBatchCommand extends Command {
    #components: EntityArray[]
    constructor(components: any[]) {
        super();
        this.#components = components;
    }

    override apply(world: World): void {
        const ids = world.component_ids(this.#components[0]);
        const arch_id = archetype_id(ids);
        let archetype = world.archetypes().get_archetype(arch_id);
        const tables = world.tables();

        if (!archetype) {
            const table = new Table(tables.len(), arch_id);
            tables.insert_table(table);
            archetype = new Archetype(table.id(), ids, arch_id)
            world.archetypes().insert_archetype(arch_id, archetype);

            const len = this.#components.length;
            table.insert_columns(ids);
            table.reserve(len);

            for (let i = 0; i < len; i++) {
                table.insert_row(i, this.#components[i], world);
            }
        } else {
            const table = tables.get_table(archetype.table_id())!;
            const len = this.#components.length;
            const start = table.entity_count()
            const end = start + len;
            table.reserve(len)

            let j = 0;
            for (let i = start; i < end; i++) {
                table.insert_row(i, this.#components[j], world);
                j++;
            }
        }
    }
}

class DespawnCommand extends Command {

    #entity: Entity<QueryData>;
    constructor(entity: Entity<QueryData>) {
        super()
        this.#entity = entity;
    }

    override apply(world: World): void {
        const table = world.tables().get_table(this.#entity.table_id())!
        table.iter().for_each(col => {
            col.swap_remove(this.#entity.id())
        })
    }
}

export class CommandQueue {
    #queue: Command[] = [];

    flush() {
        this.#queue = [];
    }

    enqueue(command: Command) {
        this.#queue.push(command)
    }

    dequeue(): Option<Command> {
        return this.#queue.pop();
    }

    iter() {
        return iter(this.#queue);
    }

    exec(world: World) {
        // !SAFETY caller should immediately flush queue;
        for (const command of this.#queue) {
            command.apply(world);
        }
    }
}

type Bundle = any;

class EntityCommands {
    #entity: any;
    #commands: Commands
    constructor(entity: any, commands: Commands) {
        this.#entity = entity;
        this.#commands = commands;
    }

    id() {
        return this.#entity;
    }

    insert(bundle: Bundle) { }
}

export class Commands {
    #queue: CommandQueue;
    #world: World;
    #entities: any;
    constructor(queue: CommandQueue, world: World) {
        this.#queue = queue;
        this.#world = world;
        this.#entities = [];
    }

    add(command: Command) {
        this.#queue.enqueue(command);
    }

    despawn(entity: EntityRef<QueryData>) {
        this.add(new DespawnCommand(entity as Entity<QueryData>))
        this.#queue.dequeue()?.apply(this.#world);
    }

    spawn_empty() {
        const entity = this.#entities.reserve_entity();
        return new EntityCommands(entity, this);
    }

    spawn(components: EntityArray) {
        this.add(new SpawnCommand(components));
        // ! immediately apply command
        this.#queue.dequeue()?.apply(this.#world);
    }

    spawn_batch(components: EntityArray[]) {
        this.add(new SpawnBatchCommand(components))
        // ! immediately apply command
        this.#queue.dequeue()?.apply(this.#world);
    }
}