---
title: "Modules, imports and exports"
description: "Every Nio file is a module. Imports, exports, re-exports, and when a module initializes."
---

# Modules

Every `.nio` file is a **module** with its own scope. A declaration in a file is not visible to other files unless it is exported. Two files can both declare an `int x`, or both export one, without conflict.

## Importing

Imports appear at the top of a file, before any other statement:

```nio
import 'time';                 // built-in module, name "time"
import 'json' as j;            // explicit name
import 'geo';                  // ./geo.nio, name "geo"
import 'lib/helpers' as h;     // ./lib/helpers.nio, name "h"
```

* File paths are relative to the folder of the importing file. The `.nio` extension is optional.
* `'time'`, `'json'`, `'array'`, `'string'`, `'map'`, `'async'`, `'os'`, `'path'`, `'fs'`, `'process'`, `'regexp'`, `'net'`, `'crypto'`, `'math'`, `'random'`, `'test'`, `'http'`, `'tls'`, and `'x509'` always refer to the built-in standard library modules. A local file named `time.nio` is imported as `'./time'`.
* Without `as`, the module name is the base name of the file (`'lib/helpers'` → `helpers`). If the base name is not a valid identifier, for example `'string-utils'`, the import must use `as`.
* No other declaration in the file can use a module name. A module name cannot be shadowed. The name is reserved only in the file that imports the module. A file that does not import `path` can use `path` as a variable name. After `import 'path' as p`, the name `path` is also available in that file. [Naming](/docs/basics#reserved-names) gives the rules.
* Import cycles are compile errors.

## Exporting

`export` on a top-level declaration makes it visible to other files:

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

Importers use exports through the module name:

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

An exported variable declared `const` can be read but not assigned, by importers and by the module that declares it:

```nio
// config.nio
export int const maxRetries = 3;

// main.nio
import 'config' as cfg;
print(cfg.maxRetries);             // 3
cfg.maxRetries = 5;                // compile error: it is declared const
```

An exported record or enum type is the *same* type in every module that uses it. A `geo.Point` that one module returns and another module receives is one type. A `type Point` that a different module declares is a different type.

The [methods](/docs/basics#methods) of a type are exported with the type. They need no `export` of their own. Importers call them on the value, not through the alias:

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

An exported type can also be [extended](/docs/basics#extending-a-type). `type Segment extends g.Point { ... }` copies its fields and methods into a new type of the importing module. The copied method bodies resolve names in the module that declares the base type. As a result, they can use the private functions, variables and imports of that module. That module does not have to export them, and the extending file does not need those imports.

Built-in modules that declare record types work the same way. The record types are [`os.Cpu`](/docs/stdlib/os#types), `fs.Stat`, `fs.DeleteOptions`, `process.ChildRunResult`, `process.ChildRunOptions`, `process.ChildUsage`, `net.Options`, and `net.Datagram`. A program uses each one through its module name. A program can declare its own types named `Cpu`, `Stat`, `Options`, and `Datagram`. These types cannot be extended, because the compiler declares them.

## Re-exporting

`export` on an import alias republishes all the exports of that module as part of the module that contains the `export`. This lets a group of files present one module to its importers:

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

There are three forms. `export der;` publishes all the exports of `der`. `export der show A, B;` publishes only the names in the list. `export der hide C;` publishes all names except those in the list. `show` and `hide` are not keywords. A variable can have the name `show`.

Re-exports have these properties:

- **It names an alias, not a path.** The path is written once, in the import. As a result, a re-export adds no dependency. It cannot create an import cycle that the imports of the file do not already have.
- **It publishes names but does not bring them into scope.** If `lib.nio` also calls functions in `der.nio`, it uses the alias from its import. The re-export changes only what importers of `lib.nio` see.
- **A republished type is the same type.** A re-export adds a name for a declaration. It does not copy the declaration. A value made through `der.Tlv` is valid where an `x509.Tlv` is expected, because there is only one `Tlv`.
- **It applies through a chain.** If `mid` republishes `prim` and `top` republishes `mid`, then `top` also publishes the names of `prim`.

A re-export keeps a **private part** in a library. A file exports a declaration for the other files of the library. The file that importers use publishes only the declarations for external use.

```nio
// der.nio
export int readLength(Der d) { ... }    // chain.nio needs it
export type Certificate { ... }         // the world needs it
```

```nio
// lib.nio
export der show Certificate;            // readLength stays inside
```

`nio doc` prints the names that each re-export publishes. This shows an export that was not intended to be public:

```text
$ nio doc x509/lib.nio
export der show Tlv, Der, Certificate

    republished from der: Tlv, Der, Certificate
```

It is an error to publish one name two times, from two re-exports or from a re-export and a declaration of the same module. The error shows both locations. `show` or `hide` selects the name to publish.

## Initialization

The top-level statements of a module run once, before the code of any file that imports it. The top-level code of the entry file runs last. A module that several files import is also initialized only once.

```nio
// base.nio
print("base ready");

// main.nio
import 'base';
print("main");      // prints "base ready", then "main"
```
