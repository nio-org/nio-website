---
title: "Error handling"
description: "How errors work in Nio: the compiler infers which functions can fail, errors go up to the caller by themselves, and catch handles them."
---

# Errors

A function that can fail returns an `Error` instead of its result:

```nio
String lookupName(int id) {
    if (id < 0) { return Error("negative id"); }
    return "Jean";
}
```

`Error` is a built-in record with two fields, `message` and `code`. No other part of the function changes. The declaration needs no keyword, the return type needs no wrapper, and the call sites need no marker.

## Which functions can fail is inferred

The compiler finds this from the body. A function is *fallible* when it can `return Error(...)`, or when it calls a fallible function and does not catch the error. This rule applies up the call chain. As a result, the functions in between contain no error-handling code:

```nio
String greeting(int id) {
    return "hello " + lookupName(id);   // greeting can fail too
}
String page(int id) {
    return greeting(id) + "\n";         // and so can page
}
```

If `lookupName` fails, `greeting` immediately returns that error to *its* caller, and `page` does the same. No code is necessary for this.

Standard library calls follow the same rule. The library functions that can fail are those whose failures come from outside the program, for example a missing file, a closed connection or text that is not a number. They include:

* every [`fs`](/docs/stdlib/fs) function except `fs.exists`, and [`path.userData`](/docs/stdlib/path#pathuserdata);
* the parsers: `string.toInt`, `string.toUint`, `string.toFloat`, [`json.parse`](/docs/stdlib/json#jsonparse), `regexp.create`, and the `crypto` decoders;
* reading from `process.stdin`;
* every [`net`](/docs/stdlib/net) function except `net.close`, and the [`http`](/docs/stdlib/http), [`tls`](/docs/stdlib/tls) and [`x509`](/docs/stdlib/x509) calls that use the network or read data from it.

Each page of the standard library tells which of its functions can fail. A function that reads a file or parses a number, and does not catch the error, is fallible for that reason alone. `process.child.run` is different: it returns a *future* that can fail. As a result, the `await` can fail, but the call cannot.

```nio
import 'fs';
import 'string';

String slurp(String p) {
    return string.fromByteArray(fs.readFile(p));   // slurp can fail
}
```

## An uncaught error stops the program

If no code catches an error, the program prints the message and exits with code 1. An out-of-range index has the same result:

```nio
print(page(-1));
// runtime error: negative id
```

A program can handle errors at any level of the call chain. A program with no `catch` stops at the first error. A `catch` at a level above the failure recovers from the error. No other change is necessary.

## Catching: a default value

The simplest form replaces the failure with a value. It is an expression. It can be used inside other expressions:

```nio
String name = lookupName(id) catch "anonymous";
print((lookupName(id) catch "anonymous") + "!");
```

## Catching: a block

The other form binds the error to a name and runs a block when the call fails:

```nio
String describe(int id) {
    String name = lookupName(id) catch e {
        print("lookup failed: " + e.message);
        return "unknown";
    };
    return "found " + name;
}
```

`e` is an `Error` value. It is visible only inside the block.

The block in this example ends with `return`. When the result of the catch is assigned to a variable, the block must leave the scope. If the block ended without leaving the scope, `name` would have no value, and Nio does not supply a default value. The block can leave the scope with `return`, `break` or `continue`.

In two cases, the block can end without leaving the scope.

**The variable is optional.** If the block ends without leaving the scope, the variable is `null`:

```nio
String? name = lookupName(id) catch e {
    print("lookup failed: " + e.message);
};
print(name);                  // null when the lookup failed

if (name != null) {
    print("hello " + name);   // narrowed to a plain String
}
```

The default form gives the same result without a handler block:

```nio
String? name = lookupName(id) catch null;
```

**The value is not assigned.** A catch used as a statement discards the value. The block does not have to supply one:

```nio
greeting(id) catch e { print("ignored: " + e.message); };
```

## Telling one failure from another

The `message` of a library error comes from the platform's `strerror`. Its text changes with the system and the locale. As a result, a comparison of messages does not reliably identify a failure. The `code` field identifies it:

```nio
import 'fs';

byte[] load(String path) {
    return fs.readFile(path) catch e {
        if (e.code == fs.ErrorCode.NOT_FOUND) {
            print("no config; using defaults");
            return [];
        }
        return e;                  // permission denied, a bad disk: rethrow
    };
}
```

`Error("...")` sets the code to `0`. The code argument is optional.

The codes of the standard library are the members of `ErrorCode`. A program reaches the enum through the module that raised the error: `fs.ErrorCode`, `string.ErrorCode`, `process.ErrorCode`, `regexp.ErrorCode`, `net.ErrorCode`. All of these names refer to the same enum. A `NOT_FOUND` from one module is equal to a `NOT_FOUND` from another. The members are `NONE`, `OTHER`, `NOT_FOUND`, `PERMISSION`, `EXISTS`, `NOT_DIRECTORY`, `IS_DIRECTORY`, `NOT_EMPTY`, `INVALID`, `IO`, `NO_SPACE`, `TOO_MANY_FILES`, `NAME_TOO_LONG`, `INTERRUPTED`, `END_OF_FILE`, `LOOP`, `READ_ONLY`, and these network codes: `CONNECTION_REFUSED`, `CONNECTION_RESET`, `CONNECTION_ABORTED`, `NOT_CONNECTED`, `ALREADY_CONNECTED`, `ADDRESS_IN_USE`, `ADDRESS_NOT_AVAILABLE`, `NETWORK_UNREACHABLE`, `HOST_UNREACHABLE`, `BROKEN_PIPE`, `MESSAGE_TOO_LONG` and `TIMED_OUT` (see [Net](/docs/stdlib/net)). The codes are symbolic names, not raw `errno` numbers, because `errno` numbers are different on each platform. An `errno` value that has no matching member becomes `OTHER`.

The `http`, `tls` and `x509` modules have their own codes: [`http.ErrorCode`](/docs/stdlib/http) starts at 100, [`tls.ErrorCode`](/docs/stdlib/tls) at 200, and [`x509.ErrorCode`](/docs/stdlib/x509) at 300. The ranges do not overlap. As a result, one handler can compare a caught error against both `net.ErrorCode` and `http.ErrorCode`. Enums that a program declares work in the same way.

## Custom error codes

The `code` field is a plain `int`, not a specific enum. As a result, the library and a program can each use their own codes. A program declares an enum and passes a member:

```nio
enum ParseErr { BAD_DIGIT: 1, OVERFLOW: 2 }

int parseCount(String s) {
    if (s == "") { return Error("empty", ParseErr.BAD_DIGIT); }
    return string.toInt(s);
}

int n = parseCount(text) catch e {
    if (e.code == ParseErr.BAD_DIGIT) { return 0; }
    return e;
};
```

An enum member converts to `int` when it is passed to `Error`. A program can compare `e.code` with an enum member directly.

## Passing an error up explicitly

`return e` inside a catch block passes the error to the caller of the function that contains the block. The block runs *outside* the expression that it guards. As a result, an error raised in the block propagates like any other error:

```nio
String shout(int id) {
    String name = lookupName(id) catch e {
        print("shout is giving up");
        return e;
    };
    return name + "!";
}
```

## One catch covers the whole expression

`catch` has a lower precedence than every operator. As a result, it handles an error from any part of the expression on its left. One handler covers both calls here:

```nio
String s = first(x) + second(y) catch "fallback";
```

Parentheses around a part of the expression limit the catch to that part.

A `catch` on an expression that cannot fail is a compile error. As a result, when the last `return Error(...)` is removed from a function, the compiler shows each caller that no longer needs to handle the error.

## Errors are not bugs

The [runtime errors](/docs/memory) that show bugs, for example an index out of range, a division by zero or a deadlock, cannot be caught. `catch` handles an `Error` that a function returns. It does not handle a mistake in the program.

For this reason, [`fs`](/docs/stdlib/fs) functions raise an `Error` and do not stop the program. A missing file is not a bug in the code that looked for it. The caller decides what to do.

When a runtime error stops the program, the program prints where the error occurred, with the innermost call first:

```text
runtime error: index 99 out of range (array length 3)

in:
  deepest
  middle
  top
  main
```

A method is shown as `Type.name`. A function literal is named after the function that contains it, for example `<function literal in outer>`.

The list can have gaps. The list has no run-time cost, because it uses information that the garbage collector already keeps. As a result, it shows only the functions that the collector tracks. Three kinds of function are not shown: a function that works only with numbers, a standard-library function (the list shows the Nio function that called it) and an `async` function.

An uncaught `Error` prints a list in the same format, but the list has a different meaning. An error goes up to the caller by a return. When no caller is left to catch the error, every function on its path has already returned. As a result, the list shows where the program stopped, not where the error came from. A different `code` for each call identifies which of several calls failed.

`NIO_NO_TRACE=1` prints the message without the list. This is useful when a program must compare the error text exactly.

## Function values and futures

A function type and a future type have no body from which the compiler can infer fallibility. A `!` after the result type shows that they can fail:

```nio
Function(int)<String!> gen = String (int id) -> {
    if (id == 0) { return Error("bad seed"); }
    return "Jack";
};
print(gen(1) catch "anonymous");   // Jack
print(gen(0) catch "anonymous");   // anonymous
```

A function value written where a fallible type is expected is fallible, even when its body cannot fail. A function value whose body can fail, written where a non-fallible type is expected, is a compile error. The error message names the type to use.

The compiler infers fallibility for async functions in the same way as for other functions. A call to an async function never fails, because the body has not run yet. The error goes into the future, and the `await` raises it:

```nio
String async fetchName(int id) {
    if (id < 0) { return Error("bad id"); }
    return "Remote";
}

print(await fetchName(3) catch "offline");    // Remote

Future<String!> pending = fetchName(-1);
print(await pending catch "offline");         // offline
```

An error raised by a future that is never awaited is not lost. When the program has no more work to do, the error stops the program. `async.run` does not accept a fallible future, because a callback cannot receive an error. A program awaits a fallible future instead.

## What is not here yet

`Error` holds a message and a code, and nothing else. The code is sufficient to tell one failure from another, as the examples above show. A program cannot declare its own error *type* or attach more data. At present, the message is the only place for more data.
