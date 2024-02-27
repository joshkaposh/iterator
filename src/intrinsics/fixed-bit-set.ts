import { Bit } from ".";
import { Iterator, Range, iter, range } from "../iter";
import { IterResult, done } from "../iter/shared";
import { is_some } from "../option";
import { assert, resize, split_first } from "../util";
import * as Intrinsics from '../intrinsics'
import { carrot_left, trailing_zeros } from "./bit";

const BITS = 32;

type u32 = number;
type usize = number;
type Block = u32;

export function div_rem(x: usize, d: usize): [usize, usize] {
    return [Math.floor(x / d), Math.floor(x % d)];
}

export class FixedBitSet {
    #data: Block[];
    #length: usize;

    constructor(data: Block[] = [], length: usize = 0) {
        this.#data = data;
        this.#length = length;
    }

    static with_capacity(bits: usize) {
        let [blocks, rem] = div_rem(bits, BITS);
        // @ts-expect-error
        blocks += (rem > 0) * 1
        return new FixedBitSet(Array.from({ length: blocks }, () => 0), bits)
    }

    static with_capacity_and_blocks(bits: usize, blocks: Iterator<Block>) {
        let [n_blocks, rem] = div_rem(bits, BITS)
        // @ts-expect-error
        n_blocks += (rem > 0) * 1
        const data = blocks.into_iter().collect();
        if (data.length !== n_blocks) {
            resize(data, n_blocks, 0);
        }

        const end = data.length * 32;
        for (const [block, mask] of new Masks(range(bits, end), end)) {
            // @ts-expect-error
            data[block] &= !mask;
        }
        return new FixedBitSet(data, bits)
    }

    grow(bits: usize) {
        let [blocks, rem] = div_rem(bits, BITS);
        // @ts-expect-error
        blocks += (rem > 0) * 1;
        if (bits > this.#length) {
            this.#length = bits;
            resize(this.#data, blocks, 0);
        }
    }

    len() {
        return this.#length;
    }

    is_empty() {
        return this.#length === 0;
    }

    is_clear(): boolean {
        return iter(this.#data).all(v => v === 0)
    }

    get(bit: usize): boolean {
        return this.contains(bit)
    }

    contains(bit: usize): boolean {
        const [block, i] = div_rem(bit, BITS)
        const b = this.#data[block]
        if (!is_some(b)) {
            return false
        }
        return (b & (1 << i)) !== 0
        // return ((bit >> i) & 1) !== 0;
    }

    clear() {
        for (let i = 0; i < this.#data.length; i++) {
            this.#data[i] = 0;
        }
    }

    // enable 'bit'
    insert(bit: usize) {
        assert(bit < this.#length);

        const [block, i] = div_rem(bit, BITS)
        this.#data[block] = Bit.set(this.#data[block], i)
    }

    // enable 'bit' and return its previous value
    put(bit: usize): 0 | 1 {
        assert(bit < this.#length)
        const [block, i] = div_rem(bit, BITS)
        let word = this.#data[block];
        const prev = (word & (1 << i)) !== 0
        word |= 1 << i;
        this.#data[block] = word;
        // @ts-expect-error
        return prev * 1
    }

    toggle(bit: usize) {
        assert(bit < this.#length)
        const [block, i] = div_rem(bit, BITS)
        this.#data[block] ^= 1 << i;
    }

    set(bit: usize, enabled: 0 | 1 | false | true) {
        assert(bit < this.#length)
        const [block, i] = div_rem(bit, BITS);

        let elt = this.#data[block];
        elt = enabled ? Bit.set(elt, i) : Bit.clear(elt, i)
        this.#data[block] = elt;
    }

    copy_bit(from: usize, to: usize) {
        assert(to < this.#length);

        const [to_block, t] = div_rem(to, BITS);
        const enabled = this.contains(from);

        const to_elt = this.#data[to_block];

        this.#data[to_block] = Bit.set_to(to_elt, t, enabled);
    }

    count_ones(range: Range): number {
        assert(range.start <= range.end && range.end <= this.#length);
        let count = 0;
        for (const i of range) {
            if (this.contains(i)) {
                count++;
            }
        }
        return count;
    }

    set_range(range: Range, enabled: 0 | 1 | false | true) {
        for (const i of range) {
            this.set(i, enabled)
        }
    }

    insert_range(range: Range = new Range(0, this.#length)) {
        this.set_range(range, 1);
    }

    toggle_range(range: Range) {
        for (const i of range) {
            this.toggle(i);
        }
    }

    as_slice(): u32[] {
        return this.#data;
    }

    ones() {
        const opt = split_first(this.#data);
        if (opt) {
            const [block, rem] = opt
            return new Ones(block, 0, rem)
        } else {
            return new Ones(0, 0, []);
        }
    }

    intersection(other: FixedBitSet) {
        return new Intersection(this.ones(), other)
    }

    union(other: FixedBitSet) {
        return new Union(this.ones().chain(other.difference(this)))
    }

    difference(other: FixedBitSet) {
        return new Difference(this.ones(), other);
    }

    symmetric_difference(other: FixedBitSet) {
        return new SymmetricDifference(this.difference(other).chain(other.difference(this)))
    }

    union_with(other: FixedBitSet) {
        if (other.len() >= this.len()) {
            this.grow(other.len())
        }

        for (let i = 0; i < this.len(); i++) {
            const y = other.as_slice()[i];
            this.#data[i] |= y
        }
    }

    // returns 'true' if 'self' has no elements in common with 'other' 
    is_disjoint(other: FixedBitSet): boolean {
        return iter(this.#data)
            .zip(iter(other.as_slice()))
            .all(([x, y]) => (x & y) === 0)
    }

    is_subset(other: FixedBitSet): boolean {
        return iter(this.#data)
            .zip(iter(other.as_slice()))
            // @ts-expect-error
            .all(([x, y]) => (x & !y) === 0)
            && iter(this.#data).skip(other.as_slice().length).all(x => x === 0)
    }

    is_superset(other: FixedBitSet) {
        return other.is_subset(this)
    }
}
class Difference extends Iterator<number> {
    #iter: Ones;
    #other: FixedBitSet;
    constructor(iter: Ones, other: FixedBitSet) {
        super()
        this.#iter = iter;
        this.#other = other;
    }
    override into_iter(): Iterator<number> {
        this.#iter.into_iter();
        return this
    }
    override next(): IterResult<number> {
        let n;
        while (!(n = this.#iter.next()).done) {
            if (!this.#other.contains(n.value)) {
                return {
                    done: false,
                    value: n.value
                }
            }
        }

        return done()
    }
}

class SymmetricDifference extends Iterator<number> {
    #iter: Iterator<number>
    constructor(iter: Iterator<number>) {
        super()
        this.#iter = iter;
    }

    override into_iter(): Iterator<number> {
        this.#iter.into_iter()
        return this
    }

    override next(): IterResult<number> {
        return this.#iter.next();
    }
}

class Intersection extends Iterator<number> {
    #iter: Ones;
    #other: FixedBitSet;
    constructor(iter: Ones, other: FixedBitSet) {
        super()
        this.#iter = iter;
        this.#other = other
    }

    override into_iter(): Iterator<number> {
        this.#iter.into_iter()
        return this;
    }

    override next(): IterResult<number> {
        let n;
        while (!(n = this.#iter.next()).done) {
            if (this.#other.contains(n.value)) {
                return n;
            }
        }
        return done();
    }
}

class Union extends Iterator<number> {
    #iter: Iterator<number>;
    constructor(iter: Iterator<number>) {
        super();
        this.#iter = iter;
    }

    override into_iter(): Iterator<number> {
        this.#iter.into_iter()
        return this;
    }

    override next(): IterResult<number> {
        return this.#iter.next();
    }
}

export function debug(start: number, end: number, len: number) {
    start = start ?? 0;
    end = end ?? len;
    const [first_block, first_rem] = div_rem(start, BITS);
    const [last_block, last_rem] = div_rem(end, BITS);
    console.log('START = (%d, %d, %d, %d)', first_block, first_rem, last_block, last_rem);

    const a = carrot_left(Intrinsics.u32.MAX, 1);
    const b = BITS - last_rem - 1;
    const c = carrot_left(a, b);

    console.log('A = %d', a);
    console.log('B = %d', b);
    console.log('C = %d', c);

    return [
        first_block,
        carrot_left(Intrinsics.u32.MAX, first_rem),
        last_block,
        c
    ] as const
}

export class Masks extends Iterator<[usize, Block]> {
    #first_block: usize;
    #first_mask: Block;
    #last_block: usize;
    #last_mask: Block;

    constructor(range: Range, len: usize) {
        super();
        const start = range.start ?? 0;
        const end = range.end ?? len;

        assert(start <= end && end <= len);
        const [first_block, first_mask, last_block, last_mask] = debug(start, end, len)
        this.#first_block = first_block;
        this.#first_mask = first_mask;
        this.#last_block = last_block;
        this.#last_mask = last_mask;
        console.log('MASKS = (%d, %d, %d), (%d, %d, %d, %d)', start, end, len, this.#first_block, this.#first_mask, this.#last_block, this.#last_mask);

    }

    debug() {
        return [this.#first_block, this.#first_mask, this.#last_block, this.#last_mask]
    }

    override next(): IterResult<[usize, Block]> {
        console.log('MASKS: NEXT', this.#first_block, this.#first_mask, this.#last_block, this.#last_mask);

        if (this.#first_block < this.#last_block) {
            const res = [this.#first_block, this.#first_mask] as [usize, Block];
            this.#first_block += 1;
            // @ts-expect-error
            this.#first_mask = !0;
            console.log('MASKS: BEFORE RETURN', this.#first_block, this.#first_mask, this.#last_block, this.#last_mask);

            return { done: false, value: res }

        } else if (this.#first_block === this.#last_block) {
            const mask = this.#first_mask & this.#last_mask;
            const res = mask === 0 ? done() : { done: false, value: [this.#first_block, mask] }
            this.#first_block += 1;
            console.log('MASKS: BEFORE RETURN', this.#first_block, this.#first_mask, this.#last_block, this.#last_mask);
            return res as IterResult<[usize, Block]>
        } else {
            return done();
        }
    }
}

class Ones extends Iterator<usize> {
    #bitset: Block
    #block_index: usize;
    #remaining_blocks: Block[];

    constructor(bitset: Block, block_index: usize, remaining_blocks: Block[]) {
        super()
        this.#bitset = bitset;
        this.#block_index = block_index;
        this.#remaining_blocks = remaining_blocks;
    }

    override next(): IterResult<usize> {
        while (this.#bitset === 0) {
            if (this.#remaining_blocks.length === 0) {
                return done()
            }
            this.#bitset = this.#remaining_blocks[0];
            this.#remaining_blocks = this.#remaining_blocks.slice(1, this.#remaining_blocks.length);
            this.#block_index++;
        }

        const t = this.#bitset & Intrinsics.u32.wrapping_sub(0, this.#bitset)
        const r = trailing_zeros(this.#bitset);
        this.#bitset ^= t;
        return {
            done: false,
            value: this.#block_index * BITS + r
        }
    }
}