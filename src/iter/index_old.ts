import { Err, Ok, Option, Result } from '../option';
import { ChainDoubleEnded, CycleDoubleEnded, DoubleEndedIterator, EnumerateDoubleEnded, FilterDoubleEnded, FlattenDoubleEnded, InspectDoubleEnded, MapDoubleEnded, SkipDoubleEnded, SkipWhileDoubleEnded, TakeDoubleEnded, TakeWhileDoubleEnded, ZipDoubleEnded } from './double-ended-iterator'
import { Chain, Cycle, Enumerate, Filter, Flatten, Inspect, Iterator, Map, Skip, SkipWhile, Take, TakeWhile, Zip } from './iterator'
import { range, DoubleEndedRange, NonZeroSize, collect, IterResult, is_arraylike } from './shared'

export * from './double-ended-iterator';
export * from './iterator';
// export * from '.';

export { range, DoubleEndedRange, is_arraylike }

interface IteratorTraitShared<T> {
    into_iter(): ThisType<IteratorTraitShared<T>>;
    collect: typeof collect

    next(): IteratorResult<T>;
    advance_by(n: number): Result<Ok, NonZeroSize>;
    nth(n: number): IteratorResult<T>;

    fold<B>(initial: B, fold: (acc: B, inc: T) => B): B;
    try_fold<B, E extends Err, R extends Result<B, E>, F extends (acc: B, inc: T) => R>(initial: B, fold: F): R
    find(predicate: (value: T) => boolean): Option<T>;
    // find_map<B, F extends (value: T) => Option<B>>(f: F): Option<B>;

    last(): Option<T>;
    eq(other: IterableIterator<T>): boolean;
    count(): number;
    sum(): number;
    min(): number;
    max(): number;
    any(predicate: (value: T) => boolean): boolean;
    all(predicate: (value: T) => boolean): boolean;
    unzip<K extends T extends readonly any[] ? T[0] : never, V extends T extends readonly any[] ? T[1] : never>(): [K[], V[]]
}

interface DoubleEndedIteratorTraitShared<T> extends IteratorTraitShared<T> {
    next_back(): IterResult<T>;
    advance_back_by(n: number): Result<Ok, NonZeroSize>;
    nth_back(n: number): IterResult<T>;
    rfold<B>(initial: B, fold: (acc: B, inc: T) => B): B;
    try_rfold<B, E extends Err, R extends Result<B, E>, F extends (acc: B, inc: T) => R>(initial: B, fold: F): R
    rfind(predicate: (value: T) => boolean): Option<T>;
}

type Adapters<It> = {
    [K in keyof It as It[K] extends (...args: any[]) => Iter<It> ? K : never]: It[K]
}

export type IteratorTrait<T, Override = false> = IteratorTraitShared<T> & Adapters<Iterator<T, Override>>;

export type DoubleEndedIteratorTrait<T, Override = false> = DoubleEndedIteratorTraitShared<T> & Adapters<DoubleEndedIterator<T, Override>>;


export type AdapterMethods<T, Double extends boolean> = {
    enumerate(): Double extends false ? Enumerate<T> : EnumerateDoubleEnded<T>;
    cycle(): Double extends false ? Cycle<T> : CycleDoubleEnded<T>;
    chain(other: any): Double extends false ? Chain<T> : ChainDoubleEnded<T>;

    skip(n: number): Double extends false ? Skip<T> : SkipDoubleEnded<T>;
    skip_while(predicate: (value: T) => boolean): Double extends false ? SkipWhile<T> : SkipWhileDoubleEnded<T>;

    take(n: number): Double extends false ? Take<T> : TakeDoubleEnded<T>;
    take_while(predicate: (value: T) => boolean): Double extends false ? TakeWhile<T> : TakeWhileDoubleEnded<T>;

    flatten(): Double extends false ? Flatten<Iterator<T>> : FlattenDoubleEnded<DoubleEndedIterator<T>>;

    filter(predicate: (value: T) => boolean): Double extends false ? Filter<T> : FilterDoubleEnded<T>;
    // filter_map<V>(predicate: (value: T) => boolean): Double extends false ? FilterMap<T> : FilterMapDoubleEnded<T, V>;

    map<V>(f: (value: T) => V): Double extends false ? Map<T, V> : MapDoubleEnded<T, V>;

    inspect(callback: (value: Option<T>) => void): Double extends false ? Inspect<T> : InspectDoubleEnded<T>;
    zip<V>(other: Double extends false ? Iterator<V> : DoubleEndedIterator<V>): Double extends false ? Zip<T, V> : ZipDoubleEnded<T, V>;
}

export type DoubleEndedIteratorInputType<T = any> = ArrayLike<T> | DoubleEndedIterator<T>
export type IteratorInputType<T = any> = (() => Generator<T>) | Iterator<T>;

export type IteratorType<T> = Generator<T> | Iterator<T>;
export type DoubleEndedIteratorType<T> = ArrayLike<T> | DoubleEndedIterator<T>;

export type IterInputType<T = any> = DoubleEndedIteratorInputType<T> | IteratorInputType<T>;
export type IterType<T> = IteratorType<T> | DoubleEndedIteratorType<T>

export type Iter<It> =
    It extends DoubleEndedIteratorInputType<infer T> ? DoubleEndedIterator<T> :
    It extends IteratorInputType<infer T> ? Iterator<T> :
    never;

export function iter<It extends IterInputType<any>>(it: It): Iter<It> {
    if (it instanceof DoubleEndedIterator || it instanceof Iterator) {
        return it as unknown as Iter<It>;
    }

    if (is_arraylike(it)) {
        //@ts-expect-error 
        return new DoubleEndedIterator(it)
    }
    //@ts-expect-error 
    return new Iterator(it as IteratorInputType) as Iter<It>;
}

iter.of = function <T>(...elements: T[]) {
    //@ts-expect-error 
    return new DoubleEndedIterator(elements)
}

export function methodKeys(ctor: object) {
    const array = Object.getOwnPropertyNames(ctor.constructor.prototype)
    array.shift()
    return array
}