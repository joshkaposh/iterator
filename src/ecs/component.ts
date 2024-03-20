import { iter } from "../iter";
import { Option, is_some } from "../option";

export type Component = (new (...args: any[]) => { readonly type_id: UUID }) & { readonly type_id: UUID };
export type Resource = Component;
export type ComponentId = number;

export type TypeId = UUID;
type TypeIdMap = Map<UUID, ComponentId>;

export class ComponentInfo<T extends Component | InstanceType<Component>> {
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

export class Components {
    #components: ComponentInfo<Component>[] = [];
    #indices: TypeIdMap = new Map();
    #resource_indices: TypeIdMap = new Map();


    has_component(component: Component | InstanceType<Component>) {
        return this.#indices.has(component.type_id)
    }

    has_resource(resource: Resource) {
        return this.#resource_indices.has(resource.type_id)
    }

    resource_id(resource: Resource) {
        return this.#resource_indices.get(resource.type_id)
    }

    component_id(component: Component | InstanceType<Component>): Option<ComponentId> {
        return this.#indices.get(component.type_id)
    }

    component_ids(components: (Component | InstanceType<Component>)[]) {
        return iter(components).filter(c => this.has_component(c)).map(c => this.component_id(c)!).collect();
    }

    init_component<T extends Component>(component: T) {
        const id = this.#components.length + 1
        const info = new ComponentInfo(component, id);
        this.#components.push(info);
        this.#indices.set(component.type_id, id)
        return info;
    }

    init_resource<T extends Resource>(resource: T) {
        const id = this.#components.length + 1
        const info = new ComponentInfo(resource, id);
        this.#components.push(info);
        this.#resource_indices.set(resource.type_id, id)
        return info;
    }

    get_component_info<T extends Component | InstanceType<Component>>(component: T): Option<ComponentInfo<T>> {
        for (const info of this.#components) {
            if (component instanceof info.type() || component === info.type()) {
                return info as ComponentInfo<T>
            }
        }
        return null;
    }
}