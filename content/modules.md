---
title: "Modules, imports and exports"
description: "Every Nio file is a module. Learn how to import other files, export declarations, re-export a module, and when a module initializes."
---

# Modules

Every `.nio` file is a **module** with its own scope. Nothing in a file is visible to other files unless it is exported — two files can both declare an `int x` (or even both export one) without conflict.

## Importing

Imports appear at the top of a file, before any other statement:

```nio
import 'time';                 // built-in module, name "time"
import 'json' as j;            // explicit name
import 'geo';                  // ./geo.nio, name "geo"
import 'lib/helpers' as h;     // ./lib/helpers.nio, name "h"
```

* File paths resolve relative to the importing file's directory; the `.nio` extension may be omitted.
* `'time'`, `'json'`, `'array'`, `'string'`, `'map'`, `'async'`, `'os'`, `'path'`, `'fs'`, `'process'`, `'test'`, `'regexp'`, `'net'`, and `'http'` always name the built-in standard library modules. Use `'./time'` to import your own `time.nio`.
* Without `as`, the module's name is the file's base name (`'lib/helpers'` → `helpers`). If that is not a valid identifier — `'string-utils'`, say — the import needs `as`.
* A module name cannot be reused by anything else in the file, so it can never be shadowed. It is taken in *that* file only: a file that does not import `path` is free to call a variable `path`, and `import 'path' as p` frees the name here too. See [naming](/docs/basics#names-you-cannot-use).
* Import cycles are compile errors.

## Exporting

Mark a top-level declaration with `export` to share it:

```nio
// geo.nio
export type Point { int x; int y; }

export enum Quadrant { FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4 }

export int calls = 0;

export Point makePoint(int x, int y) {
    calls = calls + 1;
    return { x: x, y: y };
}

void internalHelper() {}            // not exported: invisible to importers
```

Importers reach exports through the module name:

```nio
// main.nio
import 'geo' as g;

g.Point p = g.makePoint(3, 4);     // exported types work in type positions
print(p.x + p.y);                  // 7
print(g.calls);                    // 1
g.calls = 0;                       // exported variables can be assigned
g.Quadrant q = g.Quadrant.FIRST;   // enum members through the module name
print(q);                          // FIRST
```

An exported variable declared `const` is readable but not assignable, from importers and from the defining module alike:

```nio
// config.nio
export int const maxRetries = 3;

// main.nio
import 'config' as cfg;
print(cfg.maxRetries);             // 3
cfg.maxRetries = 5;                // compile error: it is declared const
```

An exported record or enum type is the *same* type everywhere it goes — a `geo.Point` returned by one module and consumed by another is one type, while another module's own `type Point` remains distinct.

A type's [methods](/docs/basics#methods) travel with it. They need no `export` of their own, and importers call them on the value rather than through the alias:

```nio
// geo.nio
export type Point {
    int x;
    int y;

    int manhattan() { return self.x + self.y; }
}

// main.nio
import 'geo' as g;
g.Point p = { x: 3, y: 4 };
print(p.manhattan());            // 7
```

An exported type can also be [extended](/docs/basics#extending-a-type): `type Segment extends g.Point { ... }` copies its fields and methods into a type of your own. The copied bodies keep resolving their names in the module that wrote them, so they still reach that module's private functions, variables and imports — nothing has to be exported for its own sake, and the extending file needs none of those imports.

Built-in modules work the same way where they have a type to name. [`os.Cpu`](/docs/stdlib/os#types), `fs.Stat`, `fs.DeleteOptions`, `process.ChildRunResult`, and `process.ChildRunOptions` are the five, and because each is reached through its module name, `Cpu`, `Stat`, `DeleteOptions`, `ChildRunResult`, and `ChildRunOptions` stay available for types of your own. None of them can be extended: the compiler declares them, and there is no body to copy.

## Re-exporting

A module is one file, so a library of any size is several. `export` on an import alias republishes everything that module exports as part of your own module, which lets a group of files present a single one to whoever imports them:

```nio
// x509/lib.nio -- what importers see
import './der' as der;
import './chain' as chain;

export der show Tlv, Der, Certificate;
export chain;

export int const VERSION = 3;
```

```nio
// main.nio -- one import, and the parts are invisible
import 'x509/lib' as x509;

x509.Certificate c = x509.parse(bytes);
```

There are three forms. `export der;` publishes everything `der` exports, `export der show A, B;` publishes only what it names, and `export der hide C;` publishes everything else. `show` and `hide` are ordinary words, not keywords, so you can still name a variable `show`.

Four things are worth knowing:

- **It names an alias, not a path.** The path is written once, in the import. A re-export therefore adds no dependency, and can never create an import cycle that your imports do not already have.
- **It publishes names and brings none into scope.** If `lib.nio` also *calls* into `der.nio`, it uses the alias its import bound, exactly as before. The re-export changes only what importers of `lib.nio` see.
- **A republished type is the same type.** Re-exporting rebinds a name; it does not copy a declaration. A value made through `der.Tlv` passes freely where an `x509.Tlv` is wanted, because there is only one `Tlv`.
- **It carries through a chain.** If `mid` republishes `prim` and `top` republishes `mid`, then `top` publishes `prim`'s names too.

The pattern this exists for is a **private part**: a file exports something so its neighbours can use it, and the file importers use publishes only the part meant for the outside.

```nio
// der.nio
export int readLength(Der d) { ... }    // chain.nio needs it
export type Certificate { ... }         // the world needs it
```

```nio
// lib.nio
export der show Certificate;            // readLength stays inside
```

Because what a module publishes is assembled rather than written out, `nio doc` prints what each re-export actually publishes — which is how you notice a part gaining an export that you did not mean to make public:

```text
$ nio doc x509/lib.nio
export der show Tlv, Der, Certificate

    republished from der: Tlv, Der, Certificate
```

Publishing one name twice is an error, whether it comes from two re-exports or from a re-export and a declaration of your own. The compiler names both places and points at `show` or `hide` as the way to say which one you meant.

## Initialization

A module's top-level statements run exactly once, before any file that imports it; the entry file's top-level code runs last. A module imported by several files is still initialized only once.

```nio
// base.nio
print("base ready");

// main.nio
import 'base';
print("main");      // prints "base ready", then "main"
```
