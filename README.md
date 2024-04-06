# joshkaposh-iterator

## Installation

`npm install joshkaposh-iterator@latest`

## Examples

    import { iter } from 'joshkaposh-iterator'

    const doubled_evens = iter([1, 2, 3, 4, 5, 6, 7, 8]).filter(v => v % 2 === 0).map(v => v * 2).collect() // Output = [4, 8, 12, 16]

    const partitioned = iter([1, 2, 3, 4]).partition(v => v % 2 === 0).collect() // Output = [[2, 4], [1, 2]]

    const partitioned_flatten = iter([1, 2, 3, 4]).partition(v => v % 2 === 0).flatten().collect() // Output = [2, 4, 1, 2]



## Iterator

This is the core of the library. Most methods are defined here.

An iterator has a method, next, which when called, returns an IteratorResult<T>, which can be `{ done: false, value: your_value }` (item(T)) or `{ done: true, value: undefined }` (done()).<br />Calling next will return item(T) as long as there are elements, and once they’ve all been exhausted, will return done() to indicate that iteration is finished. Individual iterators may choose to resume iteration, and so calling next again _may_ or _may not_ eventually start returning item(T) again at some point.

## Implementing Iterator

Creating your own iterator requires two steps:

1. Create a class to hold your iterator's state
2. Extending from Iterator

Additionally, you must implement two methods: [next](#next) and [into_iter](#into_iter).

Any other methods come for free, as they all rely on next. __Important Note__ - You may be able to increase performance by overriding default methods (Ex. [nth](#nth)).

## API

| Required Method  | Usage |
| ------------- |:-------------:|
| <a id="next"></a>next(): IteratorResult\<T>  | This is the main method where logic goes. `next()` is called once per iteration and returns an object with the type { done: boolean, value: T } |
| <a id="into_iter"></a>into_iter(): this | `iter_iter()` is required to allow iterators to be recycled - when an iterator is consumed and reaches its end, calling next() will always return an object { done: true, value: undefined }. Calling `into_iter()` will reset the iterator back to its initial position and any state associated with it. `into_iter()` always returns the iterator it is attached to. |

| Function Signature  | Usage |
| ------------- |:-------------:|
|<a id='advance_by'></a> advance_by(n: number): Result<Ok, Err\<number>>      | `advance_by()` will call `next()` up to **N** times until 'done' is encountered.<br />Returns 'undefined' or an error containing the remaining steps. Returning undefined means the iterator successfully advanced **N** steps.<br />If the iterator could not advance by **N** steps, then 'advance_by' will return an error containing 'k' steps, where 'k' is number of remaining steps the iterator couldn't advance.     |
| any(predicate: (value: T) => boolean): boolean      | Returns true if predicate returns true for **any** element(s).    |
| all(predicate: (value: T) => boolean): boolean      | Returns true if predicate returns true for **all** element(s).    |
| array_chunks(n: number): ArrayChunks      | Creates an iterator that yields 'chunks' containing **N** elements. <br /> The chunks do not overlap. <br /> If **N** does not divide the length of the iterator, then the last up to **N-1** elements will be omitted and can be retrieved from the `.into_remainder()` function of the iterator.      |
| chain(other: Iterator<T>): Chain      | Takes two iterators and creates a new iterator over both in sequence.<br />`chain()` will first iterate over values from the first iterator and then over values from the second iterator.     |
| collect(into?: new (iterable: Iterable<T>) => any): T[ ] \| Collection | By default, collects into an array. If a collection was passed, `collect()` will use that instead. <br /> One common way to use collect is to take a collection, call iter on it and do a bunch of data transformations, then collect back into a collection. |
| count(): number      | By default, consumes an iterator, repeatedly calling `next()` until reaching the end. Some iterators may already know their count and may use that instead of consuming the iterator and calling `next()`.      |
| cycle(): Cycle      | Converts a finite iterator into an infinite one. **Will block** if used in a __forof__ loop or ... __spread__ operator.     |
| enumerate(): Enumerate      | Creates an iterator yielding [index, element].|
| eq(other: IterableIterator<T>): boolean      | Compares each element of this iterator and other using strict equality operator (===). Returns false if iterators are unequal length.     |
| eq_by(other: IterableIterator<T>, cmp: (a: T, b: T) => boolean)      | Compares this iterator and other using the provided compare closure. |
| filter(predicate: (value: T) => boolean)      | Creates an iterator which uses the provided closure to determine if an element should be yielded. The created iterator will only yield elements in which the closure returns true     |
| find(predicate: (value: T) => boolean)      | Searches an iterator until the provided closure returns true. `find()` is short-curcuiting -  the iterator it was called on may still contain elements.     |
| flat_map(fn: (value: A) => B): FlatMap | Creates an iterator that flattens and maps an iterator of nested iterators.<br />Ex. [[1]], [2], [3]].flat_map(v => v * v).collect() == [1, 4, 9]. <br /> See [flatten](#flatten) for more information.|
|<a id="flatten"></a>flatten(): Flatten  | Creates an iterator that flattens a nested structure. This is useful if you have an iterator of iterators and want to remove one level of indirection. |
| <a id="fold"></a>fold\<Acc>(initial: Acc, (acc: Acc, x: T) => Acc): Acc | Folds every element into an acculuator.<br /> Fold takes two arguments, 'initial', and a closure with two arguments, an 'accumulator' and an element. The return value of the closure will be used in the next iteration. If the iterator is empty, fold returns the initial value passed to it. |
| for_each(fn: (value) => void): void  | Consumes an iterator, calling the provided closure for each element |
| inspect(fn: (value) => void): Inspect | Creates an iterator that will call the provided closure for each element before passing it on. Inspect is useful for printing errors or debugging; in large data pipelines you may want to know the intermediate values between each method chain. |
| intersperse(separator: T): Intersperse | Creates an iterator that places the provided separator between adjacent elements.<br />Ex. [1, 2, 3].intersperse(100).collect() == [1, 100, 2, 100, 3]. |
| intersperse_with(separator: () => T): IntersperseWith  | Creates an iterator that places whatever is returned from the provided closure between adjacent elements.<br />Ex. [1, 2, 3].intersperse_with(() => 100).collect() == [1, 100, 2, 100, 3]. |
| last(): Option\<T> | By default `last()` will consume the iterator, repeatedly call `next()` until reaching the end of the iterator, then returning the last seen element. Smarter implementations may not need to consume the iterator. |
| <a id="nth"></a>nth(): Option\<T> | Returns the **N**th element of an iterator. If **N** is greater or equal to the iterator's length, `nth()` will return nothing. Note that calling nth(n) twice will **NOT** result in the same element.<br />Ex. [1, 2, 3].nth(0) == 1.  |
| map(fn: (value: A) => B): Map | Creates an iterator where each element will be the returned value of the provided closure. |
| map_while(fn: (value: A) => Option\<B>): MapWhile | Creates an iterator where each element will be the returned value of the provided closure. Iteration stops when the closure returns nothing. |
| max(): Option\<T> | Returns the max element in an iterator. Will error or have unexpected behaviour if element is not a number or string. |
| min(): Option\<T> | Returns the min element in an iterator. Will error or have unexpected behaviour if element is not a number or string. |
| partition(predicate: (value: T) => boolean): [T[], T[]] | Returns a pair of arrays. The first array will contain elements for which the closure returned true, the second, false.  |
| peekable(): Peekable  | Creates an iterator that can use the `peek()` method to see the next value without advancing the iterator. |
| reduce<Acc>(fn: (acc: Acc, x: T) => Acc): Option<Acc> | Reduces the elements of an iterator into a single element by repeatedly calling a reducing function. If the iterator is empty, nothing will be the end result.  |
| size_hint(): [number, Option\<number>] | Returns the upper and lower bounds of an iterator. By default, will return [0, null], which is true for any iterator. Used by collections to indicate how many elements to preallocate. Note: if you need an upper bound, consider using an ExactSizeIterator.  |
| skip(n: number): Skip | Creates an iterator that skips over **N** elements before it starts yielding. If the iterator only has **N** elements, the resulting iterator will be empty. |
| skip_while(predicate: (value: T) => boolean): SkipWhile | Creates an iterator that skips elements until the provided closure returns true. |
| step_by(n: number): StepBy | Creates an iterator starting at the same point, but stepping by the provided amount each iteration. |
| sum(): Option\<T> | Returns the sum of an iterator. Will error or have unexpected behaviour if element is not a number or string. |
| take(n: number): Take | Creates an iterator yielding the first **N** elements, or fewer if the iterator ends early. |
| take_while(predicate: (value: T) => boolean) | Creates an iterator that yields elements while the provided closure returns true. |
| try_fold\<Acc>(initial: Acc, fn: (acc: Acc, x: number) => Result<Acc, Err<Acc>>) | Similar to fold, except iteration stops when the closure returns an error. See [fold](#fold) for more documentation. |
| unzip(): [K[], V[]] | Converts an iterator of pairs into a pair of Arrays: the first array will contain the left elements, the second array containing the right elements. |
| zip(other: Iterator<any>): Zip | 'Zips up' two iterators into an iterator of key/value pairs. Iteration ends when either iterator ends. To undo a 'zip', see unzip  |

#### DoubleEndedIterator

An iterator that can yield from both ends.
The `next()` and `next_back()` methods will __never__ cross - iteration ends when they meet in the middle.

| Required Method  | Usage |
| ------------- |:-------------:|
| next_back(): IteratorResult<T> |  |

| Function Signature  | Usage |
| ------------- |:-------------:|
| advance_back_by(n: number): Result<Ok, Err\<number>> | `advance_back_by()` is the reverse of [advance_by()](#advance_by). It will eagerly skip **N** elements starting from the back by calling `next_back()` up to **N** times until 'done' is encountered. |
| nth_back(n: number): Option\<T> | The reverse of [nth](#nth). Returns the **N**th element of an iterator, starting from the back. If **N** is greater or equal to the iterator's length, `nth_back()` will return nothing. Note that calling nth(n) twice will **NOT** result in the same element.<br />Ex. [1, 2, 3].nth(0) == 3 |
| rev(): DoubleEndedIterator | Reverses an iterator's direction. Normally iterators go from left-to-right. |
| rfind(predicate: (value: T) => boolean): Option\<T> | Searches an iterator for an element, starting from the right. `rfind()` is short-curcuiting - it stops when the closure returns true. |
|<a id='rfold'></a> rfold/<Acc>(initial: Acc, (acc: Acc, x: T) => Acc): Acc | Folds every element into an acculuator, starting from the right.<br /> Fold takes two arguments, 'initial', and a closure with two arguments, an 'accumulator' and an element. The return value of the closure will be used in the next iteration. If the iterator is empty, fold returns the initial value passed to it. |
| try_rfold\<Acc>(initial: Acc, fn: (acc: Acc, x: number) => Result<Acc, Err<Acc>>) | Similar to rfold, except iteration stops when the closure returns an error. See [rfold](#rfold) for more documentation. |