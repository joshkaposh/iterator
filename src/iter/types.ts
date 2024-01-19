export type FoldAdapter<T> = (acc: T, inc: T) => T;
export type MapAdapter<I, O> = (value: I) => O extends void ? never : O;
export type FilterAdapter<T> = (value: T) => boolean;
