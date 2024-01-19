import { ArrayInputType, GenInputType, Iter, IterInputType, iter } from ".";

function run<T, Input extends IterInputType<T>>(config: { title: string; input: Input; }, ctx: (iter: Iter<Input>) => void) {
    const { title, input } = config;
    console.groupCollapsed(title);
    if (Array.isArray(input)) {
        console.log('Input Data: %O', input);
    }
    ctx(iter(input));
    console.groupEnd();
}

function* toInfinityAndBeyond() {
    let i = 1;
    while (true) {
        yield i++;
    }
}

function fill<T>(len: number, insert: (i: number) => T) {
    const arr = []
    for (let i = 0; i < len; i++) {
        arr.push(insert(i));
    }
    return arr;
}

function* count(n: number, initial = 0) {
    let i = initial;
    while (i < n) {
        i++
        yield i
    }
}

export function test() {
    console.groupCollapsed('array')
    test_array();
    console.groupEnd();
    console.groupCollapsed('gen')
    test_gen();
    console.groupEnd();
}

function test_gen() {
    run({ title: 'multiple spread', input: () => count(4) }, (gen) => {
        console.log(...gen);
        console.log(...gen);

        gen = iter(() => count(4))
            .map(v => v * v)
            .map(v => v * v)

        console.log(...gen);
        console.log(...gen);

    })
    run({ title: 'multiple operations', input: () => count(5) }, (gen) => {
        const en = gen.map(v => v * v).map(v => v * v)
        console.log(...en);
        for (const tup of en.enumerate()) {
            console.log(tup);
        }
        console.log(...gen.map(v => {
            return v * 3
        }).filter(v => {
            return v % 2 === 0
        }));

        gen = iter(() => toInfinityAndBeyond())
            .skip(10)
            .map(v => v * 2)
            .filter(v => v % 2 === 0)
            .take(10)
        console.log(...gen);
    })
    run({ title: 'cycle', input: () => count(3) }, (gen) => {

        const n = () => gen.cycle().next().value;
        const cycle2 = gen
            .map(v => v * v)
            .map(v => v * v)
            .cycle();
        console.log(n());
        console.log(n());
        console.log(n());
        console.log(n());
        console.log(n());
        console.log(n());
        // chained
        console.log(cycle2.next().value);
        console.log(cycle2.next().value);
        console.log(cycle2.next().value);
        console.log(cycle2.next().value);
        console.log(cycle2.next().value);
        console.log(cycle2.next().value);

    })

    run({ title: 'inspect', input: () => count(10) }, (gen) => {
        gen.skip(5).inspect(console.log).map(v => v * 2).inspect(console.log)
    })

    run({ title: 'spread', input: () => count(5) }, (gen) => {
        console.log(...gen);

    })

    run({ title: 'map', input: () => count(5) }, (gen) => {
        console.log(...gen.map(v => v * 2))
    })

    run({ title: 'take', input: () => toInfinityAndBeyond() }, (gen) => {
        console.log(...gen.take(5));
    })

    run({ title: 'skip', input: () => count(10) }, (gen) => {
        console.log(...gen.skip(5))
        gen = iter(() => count(5)).skip(10);
        console.log(gen.next());
    })

    run({ title: 'skip_while', input: () => count(5) }, (gen) => {
        console.log(...gen.skip_while(v => v <= 2));
    })

    run({ title: 'advance_until', input: () => count(5) }, (gen) => {
        console.log(gen.advance_until(v => v === 3))
        console.log(...gen);
    })

    run({ title: 'filter', input: () => count(5) }, (gen) => {
        console.log(...gen.filter(v => v % 2 === 0));
    })

    run({ title: 'sum', input: () => count(5) }, (gen) => {
        console.log(gen.sum())
    })
    run({ title: 'min', input: () => count(5) }, (gen) => {
        console.log(gen.min());

    })
    run({ title: 'max', input: () => count(5) }, (gen) => {
        console.log(gen.max())
    })
    run({ title: 'any', input: () => count(5) }, (gen) => {
        console.log(gen.any((v) => {
            return typeof v === 'number';
        }))
        gen = iter(() => count(5))
        console.log(gen.any((v) => {
            return Math.sign(v) < 0;
        }))
    })
    run({ title: 'all', input: () => count(5) }, (gen) => {
        console.log(gen.all((v) => {
            return typeof v === 'number';
        }));
        gen = iter(() => count(5))
        console.log(gen.all((v) => {
            return v === 1;
        }));
    })
}

function map_twice<It extends IterInputType<number>>(input: It) {
    return iter(input).map((v) => v * v).map((v) => v * v)
}

function test_array() {
    const arr = [1, 2, 3, 4];
    const arr2 = [4, 5, 6];
    const lots = fill(50, i => i + 1);
    const kv: [number, string][] = [
        [1, 'v1'],
        [2, 'v2'],
        [3, 'v3'],
    ];
    run({ title: 'multiple spreads', input: arr }, it => {
        console.log(...it);
        console.log(...it);
        const m = it.map(v => v * v).map(v => v * v);
        console.log(...m);
        console.log(...m);
    })
    run({ title: 'inspect', input: arr }, (it) => {
        console.log(...it
            .inspect((v) => console.log('before: %d', v))
            .map(v => v * v)
            .inspect((v) => console.log('map 1: %d', v))
            .map(v => v * v)
            .inspect((v) => console.log('map 2: %d', v))
        );

    })
    run({ title: 'multiple operations', input: arr }, (it) => {
        console.log(...it
            .map(v => v * v)
            .map(v => v * v)
        );
        console.log(...map_twice(arr)
            .enumerate()
        );
    })
    run({ title: 'zip', input: arr }, (it) => {
        const testother = iter([4, 5, 6]);
        console.log(...it.zip(testother));
    })
    run({ title: 'unzip', input: kv }, (zipped) => {
        const unpacked = zipped.unzip()
        console.log(unpacked);
    })
    run({ title: 'chain', input: arr }, (it) => {
        const other = iter(arr2);
        console.log(...it.chain(other));
    },)
    run({ title: 'nth', input: lots }, (it) => {
        console.log(it.nth(9)); // skip 10
        console.log(it.next())
        console.log(...it);
    })
    run({ title: 'advance by', input: arr }, (it) => {
        const chained = map_twice(it);
        console.log(chained.advance_by(0));
        console.log(chained.next());
        console.log(chained.advance_by(1));
        console.log(chained.next());
    })
    run({ title: 'cycle', input: arr }, (it) => {
        const cycle = it.map(v => v * v).map(v => v * v).cycle();
        console.log(cycle.next());
        console.log(cycle.next());
        console.log(cycle.next());
        console.log(cycle.next());
        console.log(cycle.next());
        console.log(cycle.next());
        console.log('cycle 2');
        const cycle2 = iter([]).cycle();
        console.log(cycle2.next());
        console.log(cycle2.next());

    })
    run({ title: 'enumerate', input: arr }, (it) => {
        for (const tup of it.enumerate()) {
            console.log(tup);
        }

        it = iter(arr).map(v => v * v).map(v => v * v);

        for (const tup of it.enumerate()) {
            console.log(tup);
        }
    })

    run({ title: 'fold', input: arr }, (it) => {
        console.log(it.fold((acc, inc) => acc += inc, 0));
        console.log(iter(arr)
            .map(v => v * 2)
            .fold((acc, inc) => acc += inc, 0)
        );
    })

    run({ title: 'sum', input: arr }, (it) => {
        console.log(it.sum())
    })

    run({ title: 'max', input: arr }, (it) => {
        console.log(it.max());
        console.log(map_twice(arr)
            .max()
        );

    })
    run({ title: 'min', input: arr }, (it) => {
        console.log(it.min());

    })
    run({ title: 'all', input: arr }, it => {
        console.log(it.all(v => v > 0));
        console.log(iter(arr).all(v => v === 1));
    })
    run({ title: 'take', input: arr }, (it) => {
        console.log(...it
            .map(v => v * v)
            .map(v => v * v)
            .take(2)
        );
        it = iter(arr)
        console.log(...it
            .map(v => v * v)
            .map(v => v * v)
            .take(5)
        );
    })

    run({ title: 'map', input: arr }, (it) => {
        console.log(...it
            .map(v => v * v)
            .map(v => v * v)
        );
    })
    run({ title: 'filter', input: arr }, (it) => {
        console.log(...it.filter(v => v % 2 === 0));
        console.log(...iter(arr)
            .filter(v => v % 2 === 0)
            .take(1)
        );
        console.log(...map_twice(arr)
            .filter(v => v % 2 === 0)
        );

    })

}
