import { World } from "."

export type Plugin = {
    build(app: World): void;
}