---
title: "Memory and garbage collection"
description: "How Nio manages memory: a precise garbage collector, what each value costs, noalloc functions, and how to watch and tune the collector."
---

# Memory

Nio is garbage collected. Strings, arrays, records, optionals and function values live on the heap, and you never free them yourself — there is no `free`, no `delete`, and no destructor.

```nio
type Point { int x; int y }

int i;
while (i < 1000000) {
    Point p = { x: i, y: i };   // a fresh record every iteration
    i = i + 1;
}
```

Each `p` becomes unreachable as soon as the iteration ends, and its memory comes back. This loop runs in a few megabytes no matter how many times it goes round.

## What "reachable" means

A value is kept alive as long as it can still be reached: through a variable in scope, through a global, or through a field or element of another value that is itself reachable. When nothing can reach it any more, it is garbage.

```nio
type Node { String label; Node? next }

Node a = { label: "a" };
Node b = { label: "b" };
a.next = b;
b.next = a;    // a and b now point at each other
```

Values that refer to each other in a cycle are reclaimed like anything else once the program can no longer reach them. The collector works from what is reachable, not from how many references a value has, so a cycle is not a leak.

## How much a value costs

A value takes up its own width, in every container that stores one: an
array's elements, a record's fields, a map's keys and values, and the box
behind a present optional are all packed:

| type | bytes |
| --- | --- |
| `bool`, `int8`, `uint8` / `byte` | 1 |
| `int16`, `uint16` | 2 |
| `int32`, `uint32`, `float32` | 4 |
| `int64`, `uint64`, `float64`, `DateTime`, `Duration` | 8 |
| `int`, `uint`, `float` | one machine word — 8 on any machine Nio runs on today |
| everything else — a `String`, an array, a record, a map, an optional, a function value | 8, the pointer to it |

So a `byte[1_000_000]` is about a megabyte, not eight, and a
`Map<int32, int32>` spends eight bytes per entry rather than sixteen:

```nio
import 'string';
import 'fs';

byte[] image = fs.readFile("photo.jpg");   // one byte per byte of the file
```

Reading a file, a socket or standard input hands you the bytes as they came,
with nothing between them.

A record's fields sit at their own widths too, in declaration order, each at
the next offset its width divides. Order can cost padding — `{ byte a; int b;
byte c; }` pads `a` out to where an 8-byte `int` can start, where declaring
the two bytes together would not. This is worth knowing only when a type has
millions of instances.

Nothing is packed below a byte, so an array of `bool` is one byte per element,
not one bit — every element stays a thing you can name.

None of this is something a program can observe. There is no `sizeof`, no
address-of, and no way to reinterpret one type's bytes as another's, so
representation decides how much memory a program uses and nothing at all about
what it computes.

## What you can rely on

* A value stays at one address for its entire life. It is never moved or copied behind your back.
* Collection happens while allocating. A loop that does no allocation is never interrupted by it.
* Nothing about collection is visible from the language — there is no way to observe when a value is reclaimed, or to run code at that moment.
* Reclaimed memory is returned to the operating system, beyond a reserve kept for the next burst of allocation. A phase that briefly needs hundreds of megabytes does not set the program's footprint for the rest of its run.
* The reserve is what the program has recently needed, not what it happens to hold at this instant. A server working at a steady rate is always between waves at the moment a collection looks at it — the request whose memory was just freed is the shape of the one about to arrive — so memory freed under load stays mapped and gets reused rather than being handed back and taken again. Only ten seconds of not needing it lowers the line.
* Going idle is enough to give it all back. Collections normally happen while allocating, which a quiet program never does again — so whenever the scheduler is about to sleep with nothing to run, it collects once more if anything was allocated since the last collection and none has run for five seconds. That collection is also the one that drops the reserve, because five seconds without collecting at all is a phase ending rather than a lull. A server whose load stops gives its memory back a few seconds later without serving another request; one still under load never sees an extra collection, because its own keep the clock reset.

Record values are references (see [Basics](/docs/basics)), so assigning or passing a record shares it rather than copying it, and it lives for as long as any of those references can reach it.

## Promising not to allocate: `noalloc`

"Collection happens while allocating" is a property you can hold the compiler to. A function declared `noalloc` allocates nothing, so calling it can never start a collection:

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

The modifier goes where `async` goes — between the return type and the name — and is checked, not trusted. A `noalloc` body may do arithmetic, use the bitwise operators, read and write elements of arrays its caller owns, loop, branch, and call other `noalloc` functions. Anything that builds a value is refused, with a diagnostic naming it:

```nio
String noalloc greet(String who) {
    return "hello " + who;   // error: joining strings allocates the new one
}
```

Two rules are worth knowing before you reach for it:

* **No optionals.** A `T?` keeps its value in a box, and the box is an allocation — so a `noalloc` function may not take, return, or declare one.
* **It is declared, not inferred.** A `noalloc` function may only call functions that also say `noalloc`, even if the callee happens to allocate nothing today. That is what keeps the promise from breaking when an unrelated body changes.

You can check the effect directly with `NIO_GC_STATS=1` below: a loop calling only `noalloc` functions reports no collections at all.

`noalloc` is about the heap and nothing else. It does not promise how long a body takes — a `noalloc` function can still branch on a secret or index a table with one — so it is one of the things constant-time code needs, not the whole of it.

## Testing the collector

Setting `NIO_GC_STRESS=1` runs a collection at every single allocation:

```sh
NIO_GC_STRESS=1 ./myprogram
```

This exists for testing the compiler and runtime themselves, and makes programs many times slower. A correct program produces identical output either way.

## Watching the collector

Setting `NIO_GC_STATS=1` writes one line to standard error as the program exits:

```sh
$ NIO_GC_STATS=1 ./myprogram
[gc] 22 collections  mark 25.5 ms  sweep 10.2 ms  live 30538836 bytes in 266151 blocks  chunks 467 in use, 16 pooled, 3116 released
```

Marking is the phase that walks live values; sweeping is the one that reclaims everything else. The two are reported apart because they respond to different things — marking to how much the program keeps alive, sweeping to how large the heap has grown. The chunk counts are the collector's own memory: 64&nbsp;KB regions currently carved into values, held in reserve for the next burst, and given back to the operating system over the program's life. Nothing about the numbers is part of the language, and the line is the only thing the setting changes.

## The idle collection's clock

`NIO_GC_IDLE_MS` sets how long collections must have been quiet, in milliseconds, before an idle program runs one more to give its memory back — five seconds when unset. It measures from the last collection of any kind, so a program busy enough to be collecting on its own never runs an extra one, and the wait starts over every time it does. `NIO_GC_IDLE_MS=0` turns the idle collection off: memory then returns only while the program allocates, which is how the collector behaves everywhere else.
