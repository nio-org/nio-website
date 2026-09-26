---
title: "Arrays"
description: "Arrays in Nio: declaring them, fixed-size arrays, reading and writing elements, growing, sorting and searching, and looping over them."
---

# Arrays

## Declaring arrays

An array type is written `T[]`. Arrays are created with a literal, and elements are mutable:

```nio
int[] myArray = [2, 5, 4];
String[] names = ["ada", "grace"];
int[] empty = [];              // element type comes from the declaration
```

An empty literal `[]` is only valid where the element type is known from context.

A `T[]` array is *growable*: the [array library](/docs/stdlib/array) can push and pop elements, changing its length at run time.

## Fixed-size arrays

Writing a size in the type, `T[N]`, declares a *fixed-size* array. Like an array in C, `N` is the actual length, not a maximum — declared without an initializer, the array holds `N` zero values, and a literal for it must have exactly `N` elements:

```nio
int[5] fixed = [1, 2, 3, 4, 5];
fixed[2] = 33;                 // elements are mutable, the length is not

String[3] names;               // ["", "", ""]
```

The length of a fixed-size array never changes: `array.push` and `array.pop` on it are compile errors, and so is a constant index the compiler can see is out of range (`fixed[7]`).

`T[N]` and `T[]` are distinct types — neither is assignable to the other, because a growable alias of a fixed-size array could change its length. `array.copy` returns a growable copy of either flavor, which is also how a fixed-size array becomes a growable one:

```nio
import 'array';

int[5] fixed = [1, 2, 3, 4, 5];
int[] loose = array.copy(fixed);
array.push(loose, 6);          // fine; fixed still has 5 elements
```

Record types work as element types too, and the literals inside the array take their type from the declaration:

```nio
type Car { String make; int age; }

Car[] myCars = [
    { make: "toyota", age: 4 },
    { make: "honda", age: 6 }
];
```

## Reading and writing elements

Indices are `int`, zero-based, and bounds-checked at runtime — an out-of-range access aborts the program with a runtime error:

```nio
import 'json';

int[] a = [10, 20, 30];

print(a[0]);              // 10
a[2] = 99;
print(json.toText(a));    // [10,20,99]  (printing takes scalars; arrays go through json.toText)
```

`a.length` is the number of elements, as a read-only `int`:

```nio
print(a.length);  // 3
```

## Growing, shrinking, sorting, searching

The `array` standard library module holds what an expression cannot say. `push` and `pop` change a growable array's length in place, and `sort` reorders in place — every reference to the array sees all three. `slice`, `copy` and `indexOf` leave it alone. See [the array library](/docs/stdlib/array) for the full reference:

```nio
import 'array';
import 'json';

int[] xs = [1, 2];
array.push(xs, 3);              // xs is [1, 2, 3]
print(array.pop(xs));           // 3; xs is [1, 2] again

int[] ns = [5, 3, 9, 1];
array.sort(ns);                             // in place: [1, 3, 5, 9]
print(array.indexOf(ns, 5));                // 2
print(json.toText(array.slice(ns, 1, 3)));  // [3,5] — a new array
```

## Looping with `forEach`

The `forEach` statement runs its block once per element, in order. It names the element and, optionally, the index:

```nio
int[] a = [2, 5, 4];

int sum = 0;
forEach(a, element) {
    sum = sum + element;
}
print(sum);         // 11

forEach(a, element, i) {
    print(i);       // 0, 1, 2
    print(element); // 2, 5, 4
}
```

The bindings are visible only inside the block. The element binding holds a copy — assigning to it does not change the array; write through the index instead:

```nio
forEach(a, element, i) {
    a[i] = element * 2;
}
```

## Looping with `for`

When `forEach` doesn't fit (walking backwards, stepping by two, …), use a `for` loop:

```nio
int[] a = [2, 5, 4];

int sum = 0;
for (int i = 0; i < a.length; i++) {
    sum = sum + a[i];
}
print(sum);       // 11

for (int i = a.length - 1; i >= 0; i--) {
    print(a[i]);  // 4, 5, 2
}
```

The counter declared in the header is visible only inside the loop. `break` and `continue` work in every loop — `continue` in a `for` loop still runs the post clause, so the counter keeps advancing:

```nio
int firstOver(int[] a, int limit) {
    int found = -1;
    forEach(a, e) {
        if (e <= limit) { continue; }
        found = e;
        break;
    }
    return found;
}
print(firstOver([2, 5, 4], 3));  // 5
```

`while` works too, of course:

```nio
int i = 0;
while (i < a.length) {
    i = i + 2;
}
```

> [!NOTE]
>
> More array functions (`map`, `filter`, slicing, …) are planned but not in v0.1.
