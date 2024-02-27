export type Component = new (...args: any[]) => {};
export type ComponentId = number;

export class ComponentInfo<T extends Component> {
    #type: T;
    #id: number;
    constructor(type: T, id: number) {
        this.#type = type;
        this.#id = id;
    }

    type() {
        return this.#type;
    }
    id() {
        return this.#id
    }
}