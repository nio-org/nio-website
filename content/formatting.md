---
title: "Formatting code with nio format"
description: "nio format rewrites Nio code in one canonical style, with no options to configure. This page tells what it changes and what it leaves alone."
---

# Formatting

`nio format` rewrites Nio source in one canonical style. It has no options.
Every project uses the same style. As a result, a diff shows only changes to
the program.

```sh
nio format .                       # rewrite every .nio file under here
nio format src/main.nio            # or just these files
nio format -l .                    # name the files that are not formatted,
                                   #   change nothing, and exit 1 if any
```

A directory means every `.nio` file under it, except in `.git` and
`node_modules`. `-l` is for a continuous-integration check. It writes
nothing, prints the paths that would change, and exits 1 when the list is not
empty.

If a file has a syntax error, `nio format` reports it and does not change the
file.

## What it decides, and what it leaves alone

The formatter sets the indent (four spaces for each level), the spaces around
each token, the number of blank lines between two statements, and the column
of a trailing comment. Where the file has one or more blank lines between two
statements, the formatter writes one.

It does **not** change where a construct breaks over lines. The formatter
keeps the line breaks of the file:

```nio
// Both of these are formatted. Neither becomes the other.
if (ready) { start(); }

if (ready) {
    start();
}
```

The same rule applies to an argument list, a literal, an operator chain and
an `else` chain. If the file has it on one line, it stays on one line. If
the file breaks it over lines, it stays broken at the same places, with a new
indent.
There is no line-length limit.

A construct that is broken over lines gets two more changes. When the closing
bracket of a literal is on its own line, it stays there, and the formatter
adds a comma after the last element. Then, when an element is added, only one
line changes:

```nio
byte[] const HEADER = [
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
];
```

An operator that starts a line goes at the start of that line, under the
operand that it continues:

```nio
return Error("pins is empty, so no peer can match it; leave it null to "
    + "verify without pinning", ErrorCode.MISCONFIGURED);
```

Comments stay in their positions. A comment above a declaration stays above
it, and a comment after code stays on that line. When neighbouring lines have
trailing comments, the formatter aligns them in one column, set by the
longest line:

```nio
type Unit {
    String path;    // resolved file path
    String dir;     // directory imports inside this file resolve against
    String qual;    // unique symbol prefix ("" for the entry module)
}
```

## What it will not change

The formatter changes only whitespace. It does not change any token.

The formatter writes grouping parentheses where the file has them. It does
not calculate them from operator precedence. As a result, `(a && b) || c`
keeps its parentheses, although they are not necessary. A string keeps its
delimiter. A backtick string that holds a program does not change to a `"`
string with `\n` escapes. A number keeps its spelling, for example `0x1f`. A `union`
stays a `union`.

The formatter adds only punctuation that the grammar lets a file omit: the `;`
after a statement that ends with a brace, the `;` after the last field of a
body, and the `,` after the last element of a list that is broken over lines.
The standard style always writes these.

## Formatting twice

Formatting a file that is already formatted changes nothing.
