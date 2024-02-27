import { DoubleEndedIterator, DoubleEndedIteratorType, Iterator, IteratorType } from "./index_old";
import { Prettify } from "../util";

type OnlyString<T> = T extends string ? T : never;
type MethodKey<T, K = OnlyString<keyof T>> =
    K extends keyof T ?
    T[K] extends (...args: any[]) => any ? K :
    never : never;

type PropKey<T, K = OnlyString<keyof T>> =
    K extends keyof T ?
    K extends MethodKey<T, K> ?
    never : K :
    never;


type ExtractMethod<T> = {
    [K in MethodKey<T, keyof T>]: T[K];
}

type ExtractProp<T> = {
    [K in PropKey<T, keyof T>]: T[K];
}

export type IterProp<It> =
    It extends DoubleEndedIteratorType<infer T> ? ExtractProp<DoubleEndedIterator<T>> :
    It extends IteratorType<infer T> ? ExtractProp<Iterator<T>> : never

export type ArrayProp<T = any> = IterProp<DoubleEndedIterator<T>>
export type GenProp<T = any> = IterProp<Iterator<T>>

export type IterMethod<It> =
    It extends DoubleEndedIteratorType<infer T> ? ExtractMethod<DoubleEndedIterator<T>> :
    It extends IteratorType<infer T> ? ExtractMethod<Iterator<T>> :
    never;

export type ArrayMethod<T = any> = IterMethod<DoubleEndedIterator<T>>;
export type GenMethod<T = any> = IterMethod<Iterator<T>>;

type ExcludePrivate<K extends PropertyKey> = Exclude<K, `__${string}` | 'get'>;

type MissingKey<T1 extends PropertyKey, T2 extends PropertyKey> =
    ExcludePrivate<Exclude<T1, T2>> |
    ExcludePrivate<Exclude<T2, T1>>;

type MissingMap<T1, T2, K1 extends PropertyKey, K2 extends PropertyKey> = {
    [P in MissingKey<K1, K2>]:
    P extends keyof T1 ? Prettify<{ [K3 in P]: T1[P] } & {
        required_from: T1;
        needed_in: T2
    }> :
    P extends keyof T2 ? Prettify<{ [K3 in P]: T2[P] } & {
        required_from: T2;
        needed_in: T1
    }> : never
}

export type Missing<T1, T2, K1 extends PropertyKey, K2 extends PropertyKey> = MissingMap<T1, T2, K1, K2>[keyof MissingMap<T1, T2, K1, K2>]
