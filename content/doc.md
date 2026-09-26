---
title: "Reading documentation with nio doc"
description: "nio doc prints what a Nio module declares, with the comment written above each declaration, for your own code and the standard library."
---

# Documentation

`nio doc` prints what a module declares, with the prose written above each
declaration.

```sh
nio doc http                   # a built-in module
nio doc ./geo.nio              # a file
nio doc ./geo.nio Point        # one declaration of it
nio doc -u ./geo.nio           # everything, and not the exported names alone
```

A bare word is the name of a built-in module. Anything holding a path
separator, or ending in `.nio`, is a file — so `nio doc fs` is the standard
library's and `nio doc ./fs.nio` is the one beside you.

## Doc comments

A doc comment is the block of `//` lines directly above a declaration, with
no blank line between it and the declaration. There is no markup language
and there are no `@tags`:

```nio
// The area of the box, which is what a box is usually asked for.
//
// A second paragraph is a blank comment line, and reads as one.
export int area(Box b) {
    return b.w * b.h;
}
```

A `/* ... */` block works too and loses its markers and its left rail. A
comment that *trails* code documents nothing:

```nio
export int total = 0;   // not a doc comment
```

The block on the first line of a file documents the **module**, unless it
sits directly above the first declaration — in which case it documents that
declaration and the module has none of its own.

The same prose is what an editor shows in a hover, because both read it from
the same place. If it looks wrong in one it is wrong in both.

## What it prints

Declarations come out in the order the file wrote them, each followed by its
prose, indented:

```text
module ./geo.nio

Shapes, and the arithmetic on them.

export type Box {
    int w;
    int h;
}
    A box, and the two numbers that make one.

    int area()
        The area, which is what a box is asked for.

export Box! make(int w, int h)
    Fails on a negative side, which no box has.
```

A record's methods appear under it, one step further in. Two things come
from the checker rather than from the file, because the file does not hold
them: the `!` on a function, which is [inferred from the body](/docs/errors),
and the members of a `union`, which the parser generates.

Only exported names appear unless you pass `-u`. A module that does not
check is reported and nothing is printed: a reference taken from a tree the
checker rejected would describe types nobody agreed on.

## Reading the standard library

The four modules written in Nio — `test`, `http`, `tls` and `x509` — carry
their own prose, so `nio doc tls` is the real reference for them. The rest
are implemented by the compiler and answer their signatures alone:

```text
$ nio doc fs
module fs

void! fs.copy(String from, String to)

void! fs.createDir(String p)
...
```

The `!` marks a function whose failure the caller must handle
([Errors](/docs/errors)).
