import { ArrayIter, FilterAdapter, GenIter, IterInputType, IterType } from ".";
import { Iter } from ".";
import { Option, is_some } from "../util";

export type IterItemType<It> = It extends Iterable<infer T> ? T : 'Invalid Iterable' & It;
export type IntoCollection<Iter> = (iter: Iter) => any

type IterableIter<T> = Iterable<T> & ({
    next: GenIter<T>['next']
} | {
    next: ArrayIter<T>['next']
})

export function collect<It extends Iterable<any>>(iter: It, into?: undefined): IterItemType<It>[];
export function collect<It extends Iterable<any>, Into extends IntoCollection<It>>(iter: It, into: Into): ReturnType<Into>;
export function collect<It extends Iterable<any>, Into extends IntoCollection<It>>(iter: It, into?: Into): ReturnType<Into> | IterItemType<It>[] {
    if (into) {
        return into(iter);
    }

    return Array.from(iter)
}

export function all<T>(iter: Iterable<T>, predicate: FilterAdapter<T>) {
    for (const v of iter) {
        if (!predicate(v)) {
            return false
        }
    }
    return true
}

export function fold<V>(iter: Iterable<V>, cb: (acc: V, inc: V) => V, initial: V) {
    let acc = initial;
    for (const v of iter) {
        acc = cb(acc, v);
    }
    return acc;
}

export function unzip<K, V>(iter: Iterable<[K, V]>): [K[], V[]] {
    let keys = [];
    let values = [];
    for (const [key, value] of iter) {
        keys.push(key)
        values.push(value)
    }

    return [keys, values]
}


export function nth<T>(iter: Iter<IterInputType<T>>, index: number) {
    if (index === 0) {
        return iter.next()
    }

    for (let i = 0; i < index; i++) {
        iter.next();
    }

    return iter.next()
}

export function last<T>(iter: Iterable<T>) {
    let value;
    for (const v of iter) {
        value = v
    }
    return value;
}

function eq<T>(iter: IterableIter<T>, other: IterableIter<T>) {
    for (const val of other) {
        const n = iter.next()
        if (n !== val) {
            return false
        }
    }
    return true
}

export function count(iter: Iterable<any>) {
    let count = 0;
    for (const _ of iter) {
        count++
    }
    return count;
}

