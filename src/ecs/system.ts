export type SystemFn = (...args: any[]) => void | boolean;

export type SystemTuple<S extends SystemFn> = [S, Parameters<S>]

export class Schedule<L extends string> {
    readonly label: L;
    #systems: SystemTuple<SystemFn>[] = [];
    constructor(label: L) {
        this.label = label;
    }

    add_system(tuple: SystemTuple<SystemFn>) {
        this.#systems.push(tuple);
    }

    execute() {
        for (const [sys, params] of this.#systems) {
            sys(...params);
        }
    }
}

export class Schedules {
    #schedules: Schedule<string>[] = [];
    #current_schedule_index = 0;

    insert_schedule(schedule: Schedule<string>) {
        this.#schedules.push(schedule);
    }

    insert_system(schedule: Schedule<string>, system: SystemTuple<SystemFn>) {
        schedule.add_system(system)
    }

    execute() {
        if (!this.#schedules[this.#current_schedule_index]) {
            return
        }
        this.#schedules[this.#current_schedule_index].execute()
    }
}