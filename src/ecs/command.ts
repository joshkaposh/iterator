import { World } from ".";
import { Entity } from './entity'
import { iter } from "../iter";
import type { Option } from "../option";
import { Archetype, archetype_id } from "./archetype";
import { Table } from "./storage";

export abstract class Command {
    abstract apply(world: World): void;
}

class SpawnCommand extends Command {
    #components: {}[]
    constructor(components: any[]) {
        super();
        this.#components = components;
    }
    override apply(world: World): void {
        const ids = iter(this.#components).map(c => world.component_id(c)).collect()
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

class DespawnCommand extends Command {

    #entity: Entity;
    constructor(entity: Entity) {
        super()
        this.#entity = entity;
    }

    override apply(world: World): void {
        const table = world.tables().get_table(this.#entity.table_id())!
        table.iter().for_each(col => {
            col.remove(this.#entity.id())
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

export class Commands {

    static add(command: Command, queue: CommandQueue) {
        queue.enqueue(command);
    }

    static spawn(components: {}[], queue: CommandQueue) {
        Commands.add(new SpawnCommand(components), queue);
    }
}
