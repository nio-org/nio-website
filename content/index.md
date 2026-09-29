---
title: "Introduction to Nio"
description: "Nio is a small, statically typed, compiled language. It compiles to one native executable and is made for back-end services."
---

# Introduction

**Nio** is a small, statically typed programming language for back-end services and other programs. The compiler checks the types before the program runs. It compiles the code into a standalone native program. No virtual machine or interpreter is necessary to run it.

The compiler, `nio`, is written in Nio. It produces LLVM IR and uses `clang` to build the final program. The only other necessary tool is `clang`.

```text
source.nio ──lexer──► tokens ──parser──► AST ──checker──► typed AST
                                                              │
                                                           codegen
                                                              ▼
                       native binary ◄──clang── LLVM IR (.ll) + runtime
```

## Example

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

* **Static types.** Every value has a type. The compiler finds errors such as text where a number is expected. Nio does not convert numbers from one type to another implicitly.
* **Native programs.** `nio build` produces one executable file. The file can be copied and run.
* **Optional types.** A `String` always holds a string. A value that can be missing has an optional type, such as `String?`. The compiler requires a check for `null` before the program uses the value.
* **Records and methods.** `type Car { ... }` declares a record with fields and methods. One call converts a record to JSON, and one call converts it back.
* **Extending types.** `type Truck extends Car { ... }` gets all the fields and methods of `Car`, can add more, and can replace methods with `override`.
* **Enums and unions.** `enum Status { OK: 200, NOT_FOUND: 404 }` names a fixed set of values. A `union` holds one of several kinds of value, and the compiler checks that the code handles every kind.
* **Maps.** `Map<String, int>` stores values by key and keeps them in the order they were added. A missing key returns `null` and does not stop the program.
* **Functions as values.** A program can store functions in variables and pass them to other functions. A function captures the variables around it.
* **Errors.** A function that fails returns `Error("...")`. The compiler finds which functions can fail. An error passes up to the caller automatically. A `catch` handles it at the point that the program chooses.
* **Async without threads.** A function marked `async` can wait for the network, the disk or a timer with `await` while other work continues. All of this runs on one thread.
* **Standard library.** Modules for text, arrays, maps, JSON, dates, files, paths, processes, regular expressions, networking, HTTP servers and clients, TLS, cryptography, math, random numbers, and testing.
* **Packages.** `nio get` adds published code to a project at exact versions. Every build checks each package against a hash.
* **Tools.** A formatter (`nio format`), a test runner (`nio test`), a documentation viewer (`nio doc`), debugger support, and an editor language server (`nio lsp`).

## Where to go next

* [Installation](/docs/installation): install the compiler.
* [Quickstart](/docs/quickstart): the core of the language in a few complete examples.
* [Basics](/docs/basics): types, variables, and control flow.
* [Function values](/docs/functions): functions as values.
* [Errors](/docs/errors): failing, passing errors on, and `catch`.
* [Async and futures](/docs/async): `async`, `await`, and callbacks.
* [Arrays](/docs/arrays) and [Maps](/docs/maps): collections.
* [Packages](/docs/packages): code that other people published.
* [Versions](/docs/versions): what the version number means.
* The [language reference](https://github.com/nio-org/nio/blob/main/specs.md) contains all the rules of the language.

> [!NOTE]
>
> Nio is at version **0.1**. Before 1.0, a release can change the language in ways that break existing code. [Versions](/docs/versions) gives the rules. Some features, such as loop labels and exponent number literals (`1e3`), are planned but not available yet. These features are not planned: generics, threads, and a TLS server. A program uses several cores through several processes.
