---
title: "random module"
description: "The Nio random module makes pseudo-random numbers: a whole number in a range, a float, a shuffled array, and a random pick from an array."
---

# Random

## Introduction

```nio
import 'random';
```

The `random` module makes pseudo-random numbers: a whole number in a range, a float, a shuffled array, and a random pick from an array. You can seed it, so a test or a simulation can repeat exactly the same values. A program that never seeds it gets different values on every run.

```nio
import 'random';

print(random.int(1, 6));            // a die roll
print(random.float());              // at least 0, below 1

String[] names = ["ann", "bo", "cy"];
random.shuffle(names);
print(random.pick(names));
```

## Notes

> [!WARNING]
>
> **Do not use this module for secrets.** Every value it gives follows from its internal state, so anyone who learns the state, or guesses the seed, can predict all the values that come after. For a token, a key, a password or anything else that must be unguessable, use [`crypto.randomBytes`](/docs/stdlib/crypto#cryptorandombytes), which reads from the operating system's secure generator.

* **Seeding.** `random.seed(n)` resets the generator so that the values after it depend only on `n`: the same seed gives the same sequence on every run and on every machine.
* **Without a seed**, the generator is set up from the operating system the first time you use it, so each run is different. It is never seeded from the clock, and you cannot read the state back.
* **Every value is equally likely.** `random.int(lo, hi)` is fair across the whole range, so there is no need for the `%` tricks that make some numbers come up more often.
* The generator is xoshiro256++, which is fast and has good statistical quality.

## `random.seed()`

```nio
void random.seed(int n)
```

Resets the generator so that the values after this call are the same every time the program runs with the same `n`.

```nio
import 'random';

random.seed(7);
int first = random.int(0, 100);

random.seed(7);
print(random.int(0, 100) == first);      // true
```

## `random.int()`

```nio
int random.int(int lo, int hi)
```

Returns a whole number from `lo` to `hi`. **Both ends are included**, so `random.int(1, 6)` can return 1 and can return 6.

Calling it with `lo` greater than `hi` is a runtime error, because that range holds no numbers.

```nio
import 'random';

int roll = random.int(1, 6);
print(roll >= 1 && roll <= 6);           // true
```

## `random.float()`

```nio
float random.float()
```

Returns a float that is at least `0.0` and less than `1.0`. It is handy for "this happens one time in ten" decisions.

```nio
import 'random';

if (random.float() < 0.1) {
    print("one in ten");
}
```

## `random.shuffle()`

```nio
void random.shuffle(T[] a)
```

Puts the elements of `a` into a random order, changing the array itself. Every possible order is equally likely.

```nio
import 'random';

int[] deck = [1, 2, 3, 4, 5];
random.shuffle(deck);
print(deck.length);                      // 5
```

## `random.pick()`

```nio
T random.pick(T[] a)
```

Returns one element of `a`, chosen at random. The array itself does not change.

Calling it on an empty array is a runtime error, so check `.length` first when the array might be empty.

```nio
import 'random';

String[] colors = ["red", "green", "blue"];
String chosen = random.pick(colors);
print(chosen);
```
