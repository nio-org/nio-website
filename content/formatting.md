---
title: "Formatting code with nio format"
description: "nio format rewrites Nio code in one canonical style, with no options to configure. See what it changes and what it leaves alone."
---

# Formatting

`nio format` rewrites Nio source in one canonical style. It takes no options,
and that is the whole point of it: a style nobody configures is a style nobody
argues about, and every diff in a project is a change to the program rather
than to somebody's preference.

```sh
nio format .                       # rewrite every .nio file under here
nio format src/main.nio            # or just these files
nio format -l .                    # name the files that are not formatted,
                                   #   change nothing, and exit 1 if any
```

A directory means every `.nio` file under it, `.git` and `node_modules`
excepted. `-l` is the form for a continuous-integration check: it writes
nothing, prints the paths that would change, and exits 1 when the list is not
empty.

A file that does not parse is reported and left exactly as it was. The
formatter prints a tree, so it can only work from a tree it actually got.

## What it decides, and what it leaves alone

The formatter settles the indent (four spaces a level), the space around every
token, how many blank lines separate two statements (one, wherever the file
had one or more), and the column a trailing comment sits at.

It does **not** decide where a construct breaks over lines. That stays the
file's decision, and it is kept as the file made it:

```nio
// Both of these are formatted. Neither becomes the other.
if (ready) { start(); }

if (ready) {
    start();
}
```

The same holds for an argument list, a literal, an operator chain and an
`else` chain. If you wrote it on one line it stays on one line; if you broke
it, it stays broken in the same places, re-indented. There is no line-length
limit, because a limit would have to move breaks the author chose.

Two things follow from a construct being broken. A literal whose closing
bracket ends up on a line of its own keeps it there and gets a comma after its
last element, so that adding another element touches one line:

```nio
byte[] const HEADER = [
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
];
```

And an operator that opens a line reads at the front of it, under the operand
it continues:

```nio
return Error("pins is empty, so no peer can match it; leave it null to "
    + "verify without pinning", ErrorCode.MISCONFIGURED);
```

Comments keep their place. Prose above a declaration stays above it, a remark
trailing code stays on that line, and a run of trailing comments on
neighbouring lines lines up on the longest of them:

```nio
type Unit {
    String path;    // resolved file path
    String dir;     // directory imports inside this file resolve against
    String qual;    // unique symbol prefix ("" for the entry module)
}
```

## What it will not change

Formatting changes whitespace. It does not change a single token, and the test
suite holds it to that over every `.nio` file in the Nio repository: the file
is lexed before and after, and the two token streams must match.

That is stronger than it sounds, and it rules out the mistakes a formatter is
otherwise prone to. Grouping parens are written back exactly where the file
put them, rather than re-derived from a precedence table — so `(a && b) || c`
keeps its parens even though it does not need them. A string is written back
with the delimiter it was written with, so a backtick string holding a program
is not requoted into `"` with `\n` escapes. A number keeps its spelling, `0x1f`
included. A `union` is written back as a `union`, though the parser has by
then turned it into a sealed type and one extender per member.

The one thing the formatter adds is punctuation the grammar lets you leave
out: the `;` after a statement that ends in a brace, the `;` after the last
field of a body, and the `,` after the last element of a broken list. The
standard style always writes those.

## Formatting twice

Formatting an already-formatted file changes nothing. That is not an aspiration
but a test, run over the whole repository on every build, together with the
requirement that every file in it is already formatted. The repository is the
formatter's own corpus.
