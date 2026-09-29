---
title: "Reading documentation with nio doc"
description: "nio doc prints what a Nio module declares, with the comment written above each declaration, for project code and the standard library."
---

# Documentation

`nio doc` prints the declarations of a module, with the comment written
above each declaration.

```sh
nio doc http                   # a built-in module
nio doc ./geo.nio              # a file
nio doc ./geo.nio Point        # one declaration of it
nio doc -u ./geo.nio           # everything, and not the exported names alone
```

A bare word is the name of a built-in module. An argument that contains a
path separator, or ends in `.nio`, is a file. As a result, `nio doc fs`
prints the standard library module, and `nio doc ./fs.nio` prints the file `fs.nio` in
the current directory.

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

A `/* ... */` block can also be a doc comment. `nio doc` removes the comment markers
and the column of `*` at the start of each line. A comment after code on the
same line is not a doc comment:

```nio
export int total = 0;   // not a doc comment
```

A comment block on the first line of a file documents the **module**. If
the block is directly above the first declaration, it documents that
declaration, and the module has no doc comment.

An editor shows the same text in a hover.

## What it prints

Declarations are printed in the order of the file. Each declaration is
followed by its doc comment, indented:

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

The methods of a record are printed under it, with one more level of
indent. The output also shows two items that the file does not contain: the
`!` on a function, which the compiler [infers from the body](/docs/errors),
and the members of a `union`.

Only exported names are printed, unless the command has `-u`. If a module has
compile errors, `nio doc` reports the errors and prints no declarations.

## Reading the standard library

The four modules written in Nio, `test`, `http`, `tls` and `x509`, have
doc comments. As a result, `nio doc tls` gives the full reference for these
modules.
For the other built-in modules, `nio doc` prints only the signatures:

```text
$ nio doc fs
module fs

void! fs.copy(String from, String to)

void! fs.createDir(String p)
...
```

The `!` marks a function that can fail ([Errors](/docs/errors)).
