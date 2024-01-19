import { ArrayIter } from './array-iter'
import { GenIter } from './gen-iter'

export * from './types';
export * from './array-iter';
export * from './gen-iter';

export type ArrayInputType<T = any> = T[] | ArrayIter<T>
export type GenInputType<T = any> = (() => Generator<T>) | GenIter<T>;
export type IterInputType<T = any> = ArrayInputType<T> | GenInputType<T>;

export type GenType<T> = Generator<T> | GenIter<T>;
export type ArrayType<T> = T[] | ArrayIter<T>;

export type IterType<T> = GenType<T> | ArrayType<T>

type OnlyString<T> = T extends string ? T : never;
type MethodKey<T, K = OnlyString<keyof T>> =
    K extends keyof T ?
    T[K] extends (...args: any[]) => any ? K :
    never : never;

type PropKey<T, K = OnlyString<keyof T>> =
    K extends keyof T ?
    K extends MethodKey<T, K> ? never :
    K : never;

type ExtractMethod<T> = {
    [K in MethodKey<T, keyof T>]: T[K];
}

type ExtractProp<T> = {
    [K in PropKey<T, keyof T>]: T[K];
}

export type IterProp<It> =
    It extends ArrayType<infer T> ? ExtractProp<ArrayIter<T>> :
    It extends GenType<infer T> ? ExtractProp<GenIter<T>> : never

export type ArrayProp<T = any> = IterProp<ArrayIter<T>>
export type GenProp<T = any> = IterProp<GenIter<T>>

export type IterMethod<It> =
    It extends ArrayType<infer T> ? ExtractMethod<ArrayIter<T>> :
    It extends GenType<infer T> ? ExtractMethod<GenIter<T>> :
    never;

export type ArrayMethod<T = any> = IterMethod<ArrayInputType<T>>;
export type GenMethod<T = any> = IterMethod<GenInputType<T>>;

type ExcludePrivate<K extends PropertyKey> = Exclude<K, `__${string}` | 'get'>;
type MissingArrayKey =
    Exclude<ExcludePrivate<keyof ArrayMethod>, ExcludePrivate<keyof GenMethod>> |
    Exclude<ExcludePrivate<keyof GenMethod>, ExcludePrivate<keyof ArrayMethod>>

// type Missing
type MissingKeyMap<K extends MissingArrayKey> = {
    [P in K]: {
        implementor: P extends keyof ArrayMethod ? GenIter<any> : ArrayIter<any>;
        key: P;
    }
}

type P = MissingKeyMap<MissingArrayKey>;

export type Iter<It> =
    It extends (infer T)[] ? ArrayIter<T> :
    It extends ArrayIter<any> ? It :
    It extends GenIter<any> ? It :
    It extends (() => Generator<infer T>) ? GenIter<T> :
    never

export function iter<It extends IterInputType<any>>(it: It): Iter<It> {
    if (Array.isArray(it) || it instanceof ArrayIter) {
        return new ArrayIter(it) as Iter<It>;
    }
    return new GenIter(it) as Iter<It>;
}
