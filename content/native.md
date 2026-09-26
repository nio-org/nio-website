---
title: "Calling C from Nio"
description: "Bind functions written in C or Objective-C to Nio with extern declarations, ship the C source with your module, and add linker flags."
---

# Native interop

A module can bind functions written in C — or Objective-C — and link the
files that define them into the program. This is the mechanism libraries use
to reach what the built-in modules do not cover: a windowing system, a
database's client library, a hardware sensor. Nothing about it touches the
compiler's own tables; a library that binds C is still an ordinary file
reached by an ordinary import.

Three statements carry the whole feature:

```nio
native source './adder.c';
native flags darwin '-framework Cocoa';

extern int add(int a, int b);

print(add(2, 40));             // 42
```

None of the three words is a keyword. Like `sealed` and `union`, they are
recognized by position, so `int extern = 3;` still declares a variable and
`native` still names one.

## extern declarations

`extern` declares a function whose definition lives in a native source: a
function declaration with no body, ended by `;`. The name is the C symbol,
exactly as written — no module prefix — so it must be unique across the
whole program the way any C symbol is. Two modules may both declare the same
symbol, and then their signatures must agree; the compiler holds them to it.

```nio
extern int add(int a, int b);
extern String greet(String name);
extern float mean(float[] xs);
```

An extern function is called like any other function in its module. What it
cannot do:

- **Be exported.** A library wraps its externs in ordinary Nio functions —
  which is also where raising, records and optionals belong, since none of
  those cross the boundary.
- **Be async, variadic, or fallible.** It has no body to suspend or raise
  from. A C function reports failure in its return value, and the wrapper
  turns that into an `Error` (see the pattern below).
- **Use a name every program already links**: names beginning `rt_`, and
  `main`, are rejected.

### What crosses

The types allowed in an extern signature are the ones whose in-register unit
C can hold directly:

| Nio type | C side |
|---|---|
| `int`, `int8`…`int64`, `uint`…`uint64`, `byte`, `bool` | `int64_t` (`bool` is 0 or 1) |
| `float`, `float32`, `float64` | `double` |
| `String` | `Str *` (runtime.h) |
| arrays of any of the above | `Arr *` (runtime.h) |
| `void` | return only |

Records, optionals, maps, function values and futures stay on the Nio side;
the wrapper converts. The narrow integer types arrive in range but not
narrowed — an `int8` parameter is an `int64_t` between −128 and 127.

## native source

`native source` names a file to compile and link into any program that
imports the module. The path resolves relative to the file that declares it,
exactly as an import's does, and must end `.c`, `.m` or `.h`. At build time
the file is written into a directory of its own module, under its base name,
so the module's sources sit together and one may `#include` another by name.
Two sources of the *same* module may not share a base name; two different
modules may each ship a `util.c`. `.c`/`.m` files are handed to clang; a `.h`
is written where an `#include` will find it and nothing more.

There is no per-platform form of the statement. A file that differs by
platform selects with the preprocessor, the way the runtime's own per-OS
sources do:

```c
#ifdef __APPLE__
// the Cocoa body
#elif defined(_WIN32)
// the Win32 body
#else
// the X11 / stub body
#endif
```

## native flags

`native flags` adds arguments to the link, split on spaces. Name a platform
(`darwin`, `linux`, `windows`) and the flags apply only when that platform
is the one compiling — the compiler builds only for its host, so this is
decided at compile time and costs the build nothing. Omit it and they apply
everywhere:

```nio
native flags darwin '-framework WebKit -framework Cocoa';
native flags linux '-lX11';
native flags '-lm';
```

## Writing the C side

The native source may `#include "runtime.h"`, which is written beside it,
and with it the C side sees the same contracts the runtime's own libraries
are written against:

- **Memory for language values comes from the runtime.** A string returned
  to Nio is built with `rt_str_alloc`, an array with `rt_arr_new` — never
  `malloc`, whose blocks the collector would sweep past.
- **Root what you hold across an allocation.** The collector is precise: a
  `Str *` or `Arr *` held in a C local while anything allocates must sit in
  a pushed `GCFrame`, or the collector cannot see it.

```c
#include <stdint.h>
#include <string.h>
#include "runtime.h"

int64_t add(int64_t a, int64_t b) { return a + b; }

Str *greet(Str *name) {
    // name is held across rt_str_alloc, so it needs a root.
    TypeDesc *tds[1] = {&rt_td_string};
    int64_t slots[1] = {(int64_t)(intptr_t)name};
    GCFrame f = {rt_gc_top, 1, tds, slots};
    rt_gc_top = &f;

    Str *out = rt_str_alloc(7 + name->len);
    memcpy(out->data, "hello, ", 7);
    memcpy(out->data + 7, name->data, (size_t)name->len);

    rt_gc_top = f.prev;
    return out;
}
```

Run a program using native code under `NIO_GC_STRESS=1` while developing:
it collects at every allocation, which turns a missing root into an
immediate failure instead of a rare one.

## The wrapping pattern

An extern is a binding, not an API. The library face is ordinary Nio, where
failure can raise and types can be records:

```nio
native source './scale_native.c';
extern int sn_open(String device);      // < 0 is an errno

export type Scale { int handle; }

export Scale! open(String device) {
    int h = sn_open(device);
    if (h < 0) {
        return Error("cannot open " + device);
    }
    Scale s = { handle: h };
    return s;
}
```

This is also why externs cannot be exported: the seam between C and Nio
stays inside the module that owns it.

The [webview library](/docs/libraries/webview) is a complete example of this
pattern: an Objective-C body over Cocoa and WebKit, bound by `extern`, behind
an API written in ordinary Nio.
