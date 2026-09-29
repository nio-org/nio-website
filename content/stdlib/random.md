---
title: "random module"
description: "The Nio random module makes pseudo-random numbers: a whole number in a range, a float, a shuffled array, and a random pick from an array."
---

# Random

## Introduction

```nio
import 'random';
```

The `random` module makes pseudo-random numbers: a whole number in a range, a float, a shuffled array, and a random pick from an array. A seeded generator gives the same values on each run. A seed is useful in a test or a simulation that must repeat its values. A program that does not seed the generator gets different values on each run.

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
> **Do not use this module for secrets.** Each value comes from the internal state of the generator. A person who knows the state, or guesses the seed, can predict all the values that follow. For a token, a key, a password or other data that must not be guessed, use [`crypto.randomBytes`](/docs/stdlib/crypto#cryptorandombytes). It reads from the secure generator of the operating system.

* **Seeding.** `random.seed(n)` resets the generator. After the call, the values depend only on `n`. The same seed gives the same sequence on each run and on each machine.
* **Without a seed**, the generator gets its initial state from the operating system when a program first uses it. As a result, each run is different. The generator is never seeded from the clock, and a program cannot read its state.
* **Each value is equally likely.** The results of `random.int(lo, hi)` are uniform across the range, with no bias.
* The generator is xoshiro256++.

## `random.seed()`

```nio
void random.seed(int n)
```

Resets the generator. After this call, the values are the same every time the program runs with the same `n`.

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

Returns a whole number from `lo` to `hi`. **The range includes `lo` and `hi`.** For example, `random.int(1, 6)` can return 1 and can return 6.

When `lo` is greater than `hi`, the call causes a runtime error.

```nio
import 'random';

int roll = random.int(1, 6);
print(roll >= 1 && roll <= 6);           // true
```

## `random.float()`

```nio
float random.float()
```

Returns a float that is at least `0.0` and less than `1.0`. It can make a decision with a given probability, for example one time in ten.

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

Puts the elements of `a` into a random order. It changes the array in place. Each possible order is equally likely.

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

A call on an empty array causes a runtime error. When the array can be empty, a program can check `.length` first.

```nio
import 'random';

String[] colors = ["red", "green", "blue"];
String chosen = random.pick(colors);
print(chosen);
```
