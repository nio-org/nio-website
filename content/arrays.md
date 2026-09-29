---
title: "Arrays"
description: "Arrays in Nio: declaring them, fixed-size arrays, reading and writing elements, growing, sorting and searching, and looping over them."
---

# Arrays

## Declaring arrays

An array type is written `T[]`. A literal creates an array. The elements of an array can change:

```nio
int[] myArray = [2, 5, 4];
String[] names = ["ada", "grace"];
int[] empty = [];              // element type comes from the declaration
```

An empty literal `[]` is valid only where the context gives the element type.

A `T[]` array is *growable*. The [array library](/docs/stdlib/array) can push and pop elements, which changes the length of the array at run time.

## Fixed-size arrays

A size in the type, `T[N]`, declares a *fixed-size* array. `N` is the length of the array, not a maximum. An array declared without an initializer holds `N` zero values. A literal for the array must have exactly `N` elements:

```nio
int[5] fixed = [1, 2, 3, 4, 5];
fixed[2] = 33;                 // elements are mutable, the length is not

String[3] names;               // ["", "", ""]
```

The length of a fixed-size array never changes. `array.push` and `array.pop` on a fixed-size array are compile errors. A constant index that is out of range, such as `fixed[7]`, is also a compile error.

`T[N]` and `T[]` are different types. One cannot be assigned to the other, because a growable reference to a fixed-size array could change its length. `array.copy` returns a growable copy of either type of array. It makes a growable array from a fixed-size array:

```nio
import 'array';

int[5] fixed = [1, 2, 3, 4, 5];
int[] loose = array.copy(fixed);
array.push(loose, 6);          // fine; fixed still has 5 elements
```

Record types can also be element types. The literals inside the array get their type from the declaration:

```nio
type Car { String make; int age; }

Car[] myCars = [
    { make: "toyota", age: 4 },
    { make: "honda", age: 6 }
];
```

## Reading and writing elements

Indices are `int` and start at zero. The program checks each index at run time. An index that is out of range stops the program with a runtime error:

```nio
import 'json';

int[] a = [10, 20, 30];

print(a[0]);              // 10
a[2] = 99;
print(json.toText(a));    // [10,20,99]  (printing takes scalars; arrays go through json.toText)
```

`a.length` is the number of elements. It is a read-only `int`:

```nio
print(a.length);  // 3
```

## Growing, shrinking, sorting, searching

The `array` standard library module has the functions that change, sort and search arrays. `push` and `pop` change the length of a growable array in place, and `sort` changes the order in place. All references to the array see these changes. `slice`, `copy` and `indexOf` do not change the array. [The array library](/docs/stdlib/array) page has the full reference:

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

The `forEach` statement runs its block once for each element, in order. It gives a name to the element and, optionally, to the index:

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

The bindings are visible only inside the block. The element binding holds a copy. An assignment to it does not change the array. A write through the index changes the array:

```nio
forEach(a, element, i) {
    a[i] = element * 2;
}
```

## Looping with `for`

A `for` loop covers the cases where `forEach` is not suitable, for example to go backwards or to step by two:

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

The counter declared in the header is visible only inside the loop. `break` and `continue` work in all loops. `continue` in a `for` loop runs the post clause. As a result, the counter still moves to its next value:

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

A `while` loop is also available:

```nio
int i = 0;
while (i < a.length) {
    i = i + 2;
}
```

> [!NOTE]
>
> The [`array` module](/docs/stdlib/array) has more functions for arrays, for example `map`, `filter`, `slice` and `sort`.
