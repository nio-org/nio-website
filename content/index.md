---
title: "Introduction to Nio"
description: "Nio is a small, statically typed language for fast, safe programs. It compiles to one native executable and is built for back-end services."
---

# Introduction

**Nio** is a small programming language for writing fast, safe programs — especially back-end services. Types are checked before your program runs, and the compiler turns your code into a standalone native program, with no virtual machine or interpreter needed to run it.

The compiler, `nio`, is itself written in Nio. It produces LLVM IR and uses `clang` to build the final program, so `clang` is the only thing you need installed.

```text
source.nio ──lexer──► tokens ──parser──► AST ──checker──► typed AST
                                                              │
                                                           codegen
                                                              ▼
                       native binary ◄──clang── LLVM IR (.ll) + runtime
```

## A taste

```nio
import 'json';

type Car {
    String make;
    int age;
    String? owner;          // optional field
}

int[] myArray = [2, 5, 4];

int sum;

forEach(myArray, element) {
    sum = sum + element;
}
print(sum);                // 11

Car myCar = {
    make: "toyota",
    age: 4
}

print(json.toText(myCar)); // {"make":"toyota","age":4}
```

## Highlights

* **Checked before it runs.** Every value has a type, and mistakes like passing text where a number is expected are caught by the compiler. Numbers are never silently converted from one type to another.
* **Native programs.** `nio build` produces a single executable file you can copy and run.
* **No surprise nulls.** A `String` always holds a string. When a value might be missing, you say so with `String?`, and the compiler makes you check before you use it.
* **Records and methods.** `type Car { ... }` declares a record with fields and methods. Records turn into JSON and back with one call.
* **Extending types.** `type Truck extends Car { ... }` starts from everything `Car` has, adds to it, and can replace methods with `override`.
* **Enums and unions.** `enum Status { OK: 200, NOT_FOUND: 404 }` names a fixed set of values, and a `union` holds one of several kinds of value, with the compiler checking that you handle every kind.
* **Maps.** `Map<String, int>` stores values by key, keeps them in the order they were added, and returns `null` for a missing key instead of crashing.
* **Functions as values.** Functions can be stored in variables, passed to other functions, and remember the variables around them.
* **Simple error handling.** A function that fails returns `Error("...")`. The compiler works out which functions can fail, errors pass up to the caller on their own, and you handle them with `catch` wherever you choose.
* **Async without threads.** Functions marked `async` can wait for network, disk or timers with `await` while other work carries on, all on one thread.
* **A useful standard library.** Text, arrays, maps, JSON, dates, files, paths, processes, regular expressions, networking, HTTP servers and clients, TLS, cryptography, math, random numbers, and a testing library.
* **Packages.** `nio get` adds published code to your project, at exact versions checked against a hash on every build.
* **Tooling included.** A formatter (`nio format`), a test runner (`nio test`), a documentation viewer (`nio doc`), debugger support, and an editor language server (`nio lsp`).

## Where to go next

* [Installation](/docs/installation) — get the compiler running.
* [Quickstart](/docs/quickstart) — the core of the language in a few complete examples.
* [Basics](/docs/basics) — types, variables, and control flow.
* [Function values](/docs/functions) — passing functions around.
* [Errors](/docs/errors) — failing, passing errors on, and `catch`.
* [Async and futures](/docs/async) — `async`, `await`, and callbacks.
* [Arrays](/docs/arrays) and [Maps](/docs/maps) — collections.
* [Packages](/docs/packages) — using code other people published.
* [Versions](/docs/versions) — what the version number means.
* The [language reference](https://github.com/nio-org/nio/blob/main/specs.md) has every rule and edge case.

> [!NOTE]
>
> Nio is at version **0.1**. It is ready to try, but it may still change in ways that break existing code before 1.0 — see [Versions](/docs/versions). A few features you might expect, such as loop labels and exponent number literals (`1e3`), are planned but not available yet. Some others were decided *against*, so you can plan around them: there are no generics, no threads (run several processes to use several cores), and no TLS server.
