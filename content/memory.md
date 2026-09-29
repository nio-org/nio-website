---
title: "Memory and garbage collection"
description: "How Nio manages memory: a precise garbage collector, what each value costs, noalloc functions, and how to watch and tune the collector."
---

# Memory

Nio is garbage collected. Strings, arrays, records, optionals and function values are stored on the heap, and the program does not free them. Nio has no `free`, no `delete` and no destructor.

```nio
type Point { int x; int y }

int i;
while (i < 1000000) {
    Point p = { x: i, y: i };   // a fresh record every iteration
    i = i + 1;
}
```

Each `p` becomes unreachable when its iteration ends, and its memory is reclaimed. This loop uses a few megabytes, for any number of iterations.

## What "reachable" means

A value stays alive while the program can reach it: through a variable in scope, through a global, or through a field or element of another reachable value. When the program cannot reach a value, the value is garbage.

```nio
type Node { String label; Node? next }

Node a = { label: "a" };
Node b = { label: "b" };
a.next = b;
b.next = a;    // a and b now point at each other
```

Values that refer to each other in a cycle are reclaimed like other values when the program cannot reach them. The collector finds values by reachability, not by the number of references to a value. As a result, a cycle does not cause a leak.

## How much a value costs

A value occupies its own width in every container that stores it. The elements of an array, the fields of a record, the keys and values of a map, and the box behind a present optional are all packed:

| type | bytes |
| --- | --- |
| `bool`, `int8`, `uint8` / `byte` | 1 |
| `int16`, `uint16` | 2 |
| `int32`, `uint32`, `float32` | 4 |
| `int64`, `uint64`, `float64`, `DateTime`, `Duration` | 8 |
| `int`, `uint`, `float` | one machine word: 8 on all machines that Nio supports now |
| all other types: a `String`, an array, a record, a map, an optional, a function value | 8, the pointer to the value |

As a result, a `byte[1_000_000]` uses about one megabyte, not eight, and a `Map<int32, int32>` uses eight bytes per entry, not sixteen:

```nio
import 'string';
import 'fs';

byte[] image = fs.readFile("photo.jpg");   // one byte per byte of the file
```

A read from a file, a socket or standard input returns the bytes as they arrived, with no space between them.

The fields of a record also occupy their own widths, in declaration order. Each field starts at the next offset that its width divides. As a result, the order of the fields can add padding. In `{ byte a; int b; byte c; }`, `a` is padded to the offset where an 8-byte `int` can start. When the two bytes are declared next to each other, this padding does not occur. The order is important only when a type has millions of instances.

Nothing is packed smaller than one byte. As a result, an array of `bool` uses one byte per element, not one bit.

A program cannot observe any of this. Nio has no `sizeof`, no address-of operator and no way to read the bytes of one type as another type. The representation changes how much memory a program uses. It does not change the results of the program.

## Guarantees

* A value stays at one address for its full life. The collector does not move or copy values.
* Collection occurs only during allocation. A loop that does not allocate is never interrupted by a collection.
* The language gives no way to observe collection. A program cannot find out when a value is reclaimed, and it cannot run code at that moment.
* Reclaimed memory goes back to the operating system, except for a reserve that the collector keeps for the next allocations. If one phase of a program needs hundreds of megabytes for a short time, the program does not keep that footprint for the rest of its run.
* The size of the reserve is the memory that the program needed recently, not the memory that it holds at the time of a collection. As a result, under a steady load, freed memory stays mapped and the program uses it again. The collector lowers the reserve only when the program has not needed that memory for ten seconds.
* An idle program returns its memory. When the scheduler has no task to run and is about to sleep, it runs one more collection if two conditions are true: the program allocated memory after the last collection, and no collection ran for five seconds. This idle collection also lowers the reserve immediately. As a result, a server that stops receiving requests returns its memory a few seconds later. A server under load does not get extra collections, because its normal collections restart the five-second wait.

Record values are references (see [Basics](/docs/basics)). A record that is assigned or passed is shared, not copied. It stays alive while any of those references can reach it.

## Promising not to allocate: `noalloc`

The compiler can check that a function does not allocate. A function declared `noalloc` allocates nothing. As a result, a call to it can never start a collection:

```nio
int noalloc ctSelect(int cond, int a, int b) {
    int mask = -cond;                   // 0 or -1
    return (a & mask) | (b & ~mask);    // no branch, no allocation
}

void noalloc xorInto(byte[] buf, byte[] key) {
    for (int i = 0; i < buf.length; i++) {
        buf[i] = (buf[i] ^ key[i % key.length]) as byte;
    }
}
```

The modifier goes in the same position as `async`, between the return type and the name. The compiler checks the body. A `noalloc` body can do arithmetic, use the bitwise operators, read and write elements of arrays that its caller owns, loop, branch and call other `noalloc` functions. The compiler rejects each operation that builds a value, with a diagnostic that names the operation:

```nio
String noalloc greet(String who) {
    return "hello " + who;   // error: joining strings allocates the new one
}
```

* **No optionals.** A `T?` keeps its value in a box, and the box is an allocation. As a result, a `noalloc` function cannot take, return or declare an optional.
* **It is declared, not inferred.** A `noalloc` function can call only functions that are also declared `noalloc`, even if the called function does not allocate now. As a result, a change to the body of another function cannot break the promise.

`NIO_GC_STATS=1` (below) shows the result. A loop that calls only `noalloc` functions shows no collections.

`noalloc` applies to the heap only. It does not control how long a body takes to run. A `noalloc` function can still branch on a secret or use a secret as a table index. As a result, `noalloc` is one requirement of constant-time code, but it is not sufficient.

## Testing the collector

`NIO_GC_STRESS=1` runs a collection at every allocation:

```sh
NIO_GC_STRESS=1 ./myprogram
```

This setting is for tests of the compiler and runtime, and it makes programs many times slower. A correct program gives the same output with and without it.

## Watching the collector

`NIO_GC_STATS=1` writes one line to standard error when the program exits:

```sh
$ NIO_GC_STATS=1 ./myprogram
[gc] 22 collections  mark 25.5 ms  sweep 10.2 ms  live 30538836 bytes in 266151 blocks  chunks 467 in use, 16 pooled, 3116 released
```

Marking is the phase that finds live values. Sweeping is the phase that reclaims all other values. The line shows the two times separately. The mark time increases with the amount of live data, and the sweep time increases with the size of the heap. The chunk counts show the collector's own memory, in 64&nbsp;KB regions: the regions in use for values, the regions kept in reserve, and the regions returned to the operating system during the run. The numbers are not part of the language. The setting changes nothing except this line.

## The idle collection's clock

`NIO_GC_IDLE_MS` sets the time, in milliseconds, without a collection after which an idle program runs one more collection to return its memory. The default is five seconds. The time is measured from the last collection of any kind. As a result, a program that collects during its normal work never runs an extra collection, and each collection restarts the wait. `NIO_GC_IDLE_MS=0` turns off the idle collection. Then memory goes back to the operating system only while the program allocates.
