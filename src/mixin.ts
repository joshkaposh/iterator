
export type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends ((x: infer I) => void) ? I : never;
export type Class<S = {}, I = {}> = new (...args: any[]) => I extends Class ? InstanceType<I> : I;
export type AbstractClass<S = {}, I = {}> = abstract new (...args: any[]) => I extends Class ? InstanceType<I> : I;

type Instance<T> = T extends abstract new (...args: any[]) => infer I ? I : never;
type ClassParams<C> = C extends abstract new (a: infer A) => any ? A : never;

export type MergeClass<A, B> = new (args: ClassParams<A> & ClassParams<B>) => Instance<A> & Instance<B>

export type MixinType<B extends AbstractClass, M extends ((superclass: B) => AbstractClass)[] | ((superclass: B) => AbstractClass)> = AbstractClass<{}, B & UnionToIntersection<ReturnType<M extends any[] ? M[number] : M>>>

export function mix<B extends AbstractClass, M extends ((superclass: B) => AbstractClass)[]>(superclass: B, ...mixins: M): MixinType<B, M> {
    return new Mixin(superclass).with(...mixins as any)
}

class Mixin<B extends AbstractClass> {
    constructor(public superclass: B) { }

    with<C extends AbstractClass, M extends ((superclass: B) => C)[]>(...mixins: M): MixinType<B, M> {
        return mixins.reduce((c, mixin) => mixin(c as any) as unknown as B, this.superclass) as unknown as MixinType<B, M>
    }

    one() {
        return this.superclass
    }
}