---
title: "array module"
description: "The Nio array module pushes, pops, copies, slices, searches and sorts arrays, and transforms them with map, filter, reduce, find, some and every."
---

# Array

## Introduction

```nio
import 'array';           // or: import 'array' as arr;
```

The `array` module adds common operations such as adding, removing, copying, slicing, searching, and sorting. Creating arrays, indexing them, reading `.length`, and using `forEach` are part of the language and do not need an import.

## Notes

* `push`, `pop`, and `sort` change the original array. `copy` and `slice` return a new growable array.
* `push` and `pop` only accept growable arrays (`T[]`). Fixed-size arrays (`T[N]`) cannot change length.
* The other functions accept growable and fixed-size arrays.
* These are module functions. The call is `array.push(xs, value)`, not `xs.push(value)`.

## `array.push()`

```nio
void array.push(T[] a, T value)
```

Adds `value` to the end of `a`.

```nio
import 'array';
import 'json';

int[] numbers = [1, 2];
array.push(numbers, 3);

print(json.toText(numbers));   // [1,2,3]
print(numbers.length);   // 3
```

## `array.pop()`

```nio
T array.pop(T[] a)
```

Removes and returns the last value in `a`. Calling `pop` on an empty array causes a runtime error. When the array can be empty, a program can check `.length` first.

```nio
import 'array';
import 'json';

int[] numbers = [1, 2, 3];
int last = array.pop(numbers);

print(last);             // 3
print(json.toText(numbers));   // [1,2]
```

## `array.copy()`

```nio
T[] array.copy(T[] a)
```

Returns a new growable array containing the same elements. Changing the new array does not change the original.

The copy is shallow: if the elements are records, both arrays still refer to the same record values.

```nio
import 'array';
import 'json';

int[] original = [1, 2, 3];
int[] copy = array.copy(original);

copy[0] = 99;
array.push(copy, 4);

print(json.toText(original));  // [1,2,3]
print(json.toText(copy));      // [99,2,3,4]
```

## `array.slice()`

```nio
T[] array.slice(T[] a, int start, int end)
T[] array.slice(T[] a, int start)
```

Returns a new growable array from `start` up to, but not including, `end`. Without `end`, the copy continues to the end of the array.

The bounds must satisfy `0 <= start <= end <= a.length`; invalid bounds cause a runtime error.

```nio
import 'array';
import 'json';

int[] numbers = [0, 1, 2, 3, 4];

print(json.toText(array.slice(numbers, 1, 4)));   // [1,2,3]
print(json.toText(array.slice(numbers, 2)));      // [2,3,4]
print(json.toText(array.slice(numbers, 0, 0)));   // []
```

## `array.indexOf()`

```nio
int array.indexOf(T[] a, T value)
```

Returns the index of the first matching value, or `-1` when the value is not present. It accepts element types that can be compared with `==`.

```nio
import 'array';

String[] names = ["ada", "grace", "linus"];

print(array.indexOf(names, "grace"));   // 1
print(array.indexOf(names, "alan"));    // -1
```

## `array.sort()`

```nio
void array.sort(T[] a)
void array.sort(T[] a, Function(T, T)<bool> compare)
```

Sorts `a` in place. Without a comparator, values are sorted in ascending order. This works for values that support `<`, including numbers, strings, dates, durations, and enums.

A comparator sets another order, or sorts records. It returns `true` when its first value belongs before its second value. Sorting is stable. Values that compare equal keep their original order.

The comparator cannot be fallible and must not add or remove elements from the array being sorted.

```nio
import 'array';
import 'json';

int[] numbers = [5, 3, 9, 1];
array.sort(numbers);
print(json.toText(numbers));    // [1,3,5,9]

array.sort(numbers, bool (int a, int b) -> a > b);
print(json.toText(numbers));    // [9,5,3,1]

type Person { String name; int age; }
Person[] people = [
    { name: "cara", age: 31 },
    { name: "abe", age: 44 }
];

array.sort(people, bool (Person a, Person b) -> a.age < b.age);
print(people[0].name);          // cara
```

## `array.map()`

```nio
U[] array.map(T[] a, Function(T)<U> f)
```

Returns a new array that holds `f(v)` for each element `v` of `a`, in order.
The element type of the result is the return type of `f`. The function literal
states its types: `int (int n) -> n * 2`.

```nio
import 'array';
import 'string';

int[] nums = [1, 2, 3];
int[] doubled = array.map(nums, int (int n) -> n * 2);          // [2, 4, 6]
String[] texts = array.map(nums, String (int n) -> string.from(n));
```

## `array.filter()`

```nio
T[] array.filter(T[] a, Function(T)<bool> keep)
```

Returns a new array of the elements for which `keep` returns `true`, in order.
`a` does not change.

```nio
import 'array';

int[] nums = [1, 2, 3, 4, 5, 6];
int[] evens = array.filter(nums, bool (int n) -> n % 2 == 0);   // [2, 4, 6]
```

## `array.reduce()`

```nio
U array.reduce(T[] a, U start, Function(U, T)<U> f)
```

Combines the elements of `a` into one value and returns it. The result is
`f(f(f(start, a[0]), a[1]), ...)`. For an empty array, the result is `start`.
The type of `start` sets the type of the result and of the first parameter of
the function.

```nio
import 'array';
import 'string';

int[] nums = [1, 2, 3, 4];
int sum = array.reduce(nums, 0, int (int acc, int n) -> acc + n);           // 10
String csv = array.reduce(nums, "", String (String acc, int n) -> acc + string.from(n) + ",");
```

## `array.find()`

```nio
T? array.find(T[] a, Function(T)<bool> test)
```

Returns the first element for which `test` returns `true`, or `null` when no
element matches. Elements after the first match are not visited.

```nio
import 'array';

int[] nums = [5, 8, 13, 21];
int? big = array.find(nums, bool (int n) -> n > 10);
if (big != null) {
    print(big);                                                   // 13
}
```

## `array.some()`

```nio
bool array.some(T[] a, Function(T)<bool> test)
```

Returns `true` when `test` returns `true` for at least one element. On an
empty array, it returns `false`. It stops at the first element for which `test`
returns `true`.

```nio
import 'array';

int[] nums = [2, 4, 6];
print(array.some(nums, bool (int n) -> n > 5));        // true
print(array.some(nums, bool (int n) -> n > 9));        // false
```

## `array.every()`

```nio
bool array.every(T[] a, Function(T)<bool> test)
```

Returns `true` when `test` returns `true` for every element. On an empty
array, it returns `true`. It stops at the first element for which `test`
returns `false`.

```nio
import 'array';

int[] nums = [2, 4, 6];
print(array.every(nums, bool (int n) -> n % 2 == 0));  // true
print(array.every(nums, bool (int n) -> n > 2));       // false
```

The function given to one of the six functions above cannot be fallible. The
loop cannot report an error from the function. The function must catch its own
errors. The function must not add or remove elements of the array. This rule
also applies to `array.sort`.

## `array.contains()`

```nio
bool array.contains(T[] a, T v)
```

Returns `true` when an element equals `v`. The comparison uses the same rule
as `==` and [`array.indexOf`](#arrayindexof). The element type must be a type
that `==` accepts.

```nio
import 'array';

String[] words = ["ant", "bee"];
print(array.contains(words, "bee"));      // true
```

## `array.reverse()`

```nio
void array.reverse(T[] a)
```

Reverses `a` in place.

```nio
import 'array';

int[] nums = [1, 2, 3];
array.reverse(nums);                      // [3, 2, 1]
```

## `array.fill()`

```nio
void array.fill(T[] a, T v)
```

Sets each element of `a` to `v`, in place. The length does not change. It can
reset a fixed-size array.

```nio
import 'array';

int[4] slots = [0, 0, 0, 0];
array.fill(slots, -1);
```

## `array.concat()`

```nio
T[] array.concat(T[] a, T[] b)
```

Returns a new array that holds the elements of `a` followed by the elements
of `b`. Neither argument changes.

```nio
import 'array';

int[] head = [1, 2];
int[] tail = [3];
int[] all = array.concat(head, tail);     // [1, 2, 3]
```

## `array.flatten()`

```nio
T[] array.flatten(T[][] a)
```

Returns a new array that holds the elements of each inner array, in order.
It removes only one level: a `T[][][]` becomes a `T[][]`.

```nio
import 'array';

int[][] rows = [[1, 2], [], [3]];
int[] flat = array.flatten(rows);          // [1, 2, 3]
```
