---
title: "Calling C from Nio"
description: "Bind functions written in C or Objective-C to Nio with extern declarations, ship the C source with a module, and add linker flags."
---

# Native interop

A module can bind functions written in C or Objective-C, and link the files
that define them into the program. Libraries use this to get access to
features that the built-in modules do not supply, for example a windowing
system, the client library of a database, or a hardware sensor. A library that
binds C is an ordinary file. A program uses it with an ordinary import.

The feature uses three statements:

```nio
native source './adder.c';
native flags darwin '-framework Cocoa';

extern int add(int a, int b);

print(add(2, 40));             // 42
```

None of the three words is a keyword. As with `sealed` and `union`, the
compiler recognizes them by their position. As a result, `int extern = 3;`
still declares a variable, and a variable can have the name `native`.

## extern declarations

`extern` declares a function that a native source defines. It is a function
declaration with no body, followed by `;`. The name is the C symbol as
written, with no module prefix. As a result, the name must be unique in all the
modules of the program, as every C symbol must be. Two modules can declare the same symbol,
but then their signatures must be the same. The compiler reports an error if
they are different.

```nio
extern int add(int a, int b);
extern String greet(String name);
extern float mean(float[] xs);
```

Code in its module calls an extern function like any other function. An extern
function cannot:

- **Be exported.** A library wraps its externs in ordinary Nio functions.
  Errors, records and optionals do not cross to C. The wrapper must handle
  them.
- **Be async, variadic, or fallible.** It has no body that can suspend or
  raise an error. A C function reports failure in its return value, and the
  wrapper converts that value into an `Error` (the pattern below shows this).
- **Use a name that every program already links.** The compiler rejects names
  that start with `rt_`, and the name `main`.

### What crosses

An extern signature can use only these types:

| Nio type | C side |
|---|---|
| `int`, `int8`…`int64`, `uint`…`uint64`, `byte`, `bool` | `int64_t` (`bool` is 0 or 1) |
| `float`, `float32`, `float64` | `double` |
| `String` | `Str *` (runtime.h) |
| arrays of any of the above | `Arr *` (runtime.h) |
| `void` | return only |

Records, optionals, maps, function values and futures cannot cross. The
wrapper converts them. The narrow integer types arrive in range but are not
narrowed. For example, an `int8` parameter is an `int64_t` between −128 and
127.

## native source

`native source` names a file to compile and link into every program that
imports the module. The path is relative to the file that declares it, as for
an import. The file name must end with `.c`, `.m` or `.h`. At build time, the
sources of each module are written into one directory, under their base
names. As a result, one source can `#include` another source of the same module
by name. Two sources of the *same* module cannot have the same base name. Two
different modules can each ship a `util.c`, but two modules cannot define the
same C symbol. The compiler gives `.c` and `.m` files to clang. It writes a
`.h` file where an `#include` can find it, and does not compile it.

The statement has no per-platform form. Code that is different on each
platform uses the preprocessor in the source file:

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

`native flags` adds arguments to the link command, separated by spaces. If the
statement names a platform (`darwin`, `linux`, `windows`), the flags apply only
when the compiler runs on that platform. The compiler builds only for its host
platform. If the statement names no platform, the flags apply on all platforms:

```nio
native flags darwin '-framework WebKit -framework Cocoa';
native flags linux '-lX11';
native flags '-lm';
```

## Writing the C side

The native source can `#include "runtime.h"`. The compiler writes this file
beside the source. The C code must obey the same rules as the runtime's own
libraries:

- **Memory for language values comes from the runtime.** A string that the C
  code returns to Nio comes from `rt_str_alloc`, and an array comes from
  `rt_arr_new`. Language values must not come from `malloc`, because the
  collector does not manage blocks from `malloc`.
- **Root every value held across an allocation.** The collector is precise. If a
  C local holds a `Str *` or `Arr *` while an allocation occurs, the value
  must be in a pushed `GCFrame`. If it is not, the collector cannot see it.

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

During development, a program that uses native code can run with
`NIO_GC_STRESS=1`. This setting collects at every allocation. As a result, a
missing root causes an immediate failure instead of a rare one.

## The wrapping pattern

The module exports an API written in ordinary Nio, where functions can raise
errors and types can be records:

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

The [webview library](/docs/libraries/webview) is a complete example of this
pattern. It has an Objective-C implementation that uses Cocoa and WebKit,
binds it with `extern`, and exports an API written in ordinary Nio.
