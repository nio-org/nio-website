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

`Error` is a built-in record with two fields, `message` and `code`. Nothing else about the function changes — there is no keyword on the declaration, no wrapper type on the return, and no marker at the places that call it.

## Which functions can fail is inferred

The compiler works it out from the body. A function is *fallible* when it can `return Error(...)`, or when it calls something fallible without catching it. That travels up the call graph on its own, so the code in between never mentions errors:

```nio
String greeting(int id) {
    return "hello " + lookupName(id);   // greeting can fail too
}
String page(int id) {
    return greeting(id) + "\n";         // and so can page
}
```

If `lookupName` fails, `greeting` returns that error to *its* caller immediately, and so does `page`. You do not write anything to make that happen — which is the point: the levels in between usually have nothing useful to say about a failure.

This works because Nio compiles the whole program from source, so the compiler can see every body. It is what lets a signature stay quiet about failure while every call site is still compiled against the truth.

Standard library calls count the same way. The library functions that can fail are the ones whose failures come from outside your program — a missing file, a closed connection, text that is not a number. For example:

* every [`fs`](/docs/stdlib/fs) function except `fs.exists`, and [`path.userData`](/docs/stdlib/path#pathuserdata);
* the parsers: `string.toInt`, `string.toUint`, `string.toFloat`, [`json.parse`](/docs/stdlib/json#jsonparse), `regexp.create`, and the `crypto` decoders;
* reading from `process.stdin`;
* every [`net`](/docs/stdlib/net) function except `net.close`, and [`http`](/docs/stdlib/http), [`tls`](/docs/stdlib/tls) and [`x509`](/docs/stdlib/x509) calls that talk to the network or read what it sent.

Each page of the standard library says which of its functions can fail. A function that reads a file or parses a number without catching the error can fail for that reason alone. `process.child.run` is slightly different: it returns a *future* that can fail, so what can fail is the `await`, not the call.

```nio
import 'fs';
import 'string';

String slurp(String p) {
    return string.fromByteArray(fs.readFile(p));   // slurp can fail
}
```

## An uncaught error stops the program

An error that reaches the top with nothing handling it prints its message and exits with code 1, exactly like an out-of-range index would:

```nio
print(page(-1));
// runtime error: negative id
```

So error handling is opt-in at whatever depth you want it. A program that never writes `catch` behaves the way a program with no error handling always has, and adding one `catch` somewhere up the chain is the only change needed to recover.

## Catching: a default value

The simplest form replaces the failure with a value. It is an ordinary expression, so it nests anywhere:

```nio
String name = lookupName(id) catch "anonymous";
print((lookupName(id) catch "anonymous") + "!");
```

## Catching: a block

The other form binds the error and runs a block on the failure path:

```nio
String describe(int id) {
    String name = lookupName(id) catch e {
        print("lookup failed: " + e.message);
        return "unknown";
    };
    return "found " + name;
}
```

`e` is an ordinary `Error` value, visible only inside the block.

Notice that the block ends with `return`. That is required whenever the catch is bound to a variable: if the block simply ended, `name` would have no value, and Nio never invents one. `return`, `break`, or `continue` all work — anything that leaves the scope.

There are two situations where the block may fall through instead.

**The variable is optional.** Then falling out of the block leaves it `null`, which is the whole reason to declare it that way:

```nio
String? name = lookupName(id) catch e {
    print("lookup failed: " + e.message);
};
print(name);                  // null when the lookup failed

if (name != null) {
    print("hello " + name);   // narrowed to a plain String
}
```

If you want that without a handler, the default form says it in one line:

```nio
String? name = lookupName(id) catch null;
```

**Nothing is bound.** A catch standing alone as a statement discards the value, so there is nothing to supply:

```nio
greeting(id) catch e { print("ignored: " + e.message); };
```

## Telling one failure from another

A message is prose. It is written to be read, and for a library failure it comes from the platform's `strerror`, which varies by system and by locale — so matching on it is not something a program should do. That is what `code` is for:

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

`Error("...")` leaves the code `0`, so nothing has to change in a program that does not care.

The standard library's codes are the members of `ErrorCode`, reached through whichever module raised: `fs.ErrorCode`, `string.ErrorCode`, `process.ErrorCode`, `regexp.ErrorCode`, `net.ErrorCode`. All of them name the same enum, so a `NOT_FOUND` from one compares equal to a `NOT_FOUND` from another. The members are `NONE`, `OTHER`, `NOT_FOUND`, `PERMISSION`, `EXISTS`, `NOT_DIRECTORY`, `IS_DIRECTORY`, `NOT_EMPTY`, `INVALID`, `IO`, `NO_SPACE`, `TOO_MANY_FILES`, `NAME_TOO_LONG`, `INTERRUPTED`, `END_OF_FILE`, `LOOP`, `READ_ONLY`, and the network ones — `CONNECTION_REFUSED`, `CONNECTION_RESET`, `CONNECTION_ABORTED`, `NOT_CONNECTED`, `ALREADY_CONNECTED`, `ADDRESS_IN_USE`, `ADDRESS_NOT_AVAILABLE`, `NETWORK_UNREACHABLE`, `HOST_UNREACHABLE`, `BROKEN_PIPE`, `MESSAGE_TOO_LONG` and `TIMED_OUT` (see [Net](/docs/stdlib/net)). They are symbolic rather than raw `errno` numbers, which differ between platforms; an `errno` that is not one of these becomes `OTHER`.

The library modules written in Nio have codes of their own: [`http.ErrorCode`](/docs/stdlib/http) starts at 100, [`tls.ErrorCode`](/docs/stdlib/tls) at 200, and [`x509.ErrorCode`](/docs/stdlib/x509) at 300. The ranges never overlap, so one handler can compare a caught error against `net.ErrorCode` and `http.ErrorCode` both. Your own enums work the same way.

## Your own codes

The field is a plain `int`, not any particular enum, so that the library and your program can each use their own codes. Declare an enum and pass a member:

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

An enum widens to `int` on the way in and compares against one on the way out, so this needs no rules of its own.

## Passing an error up yourself

`return e` inside a catch block hands the error to your own caller. The block runs *outside* the expression it guards, so an error raised in it propagates like any other — which is all a rethrow is here:

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

`catch` binds looser than every operator, so it handles an error from anywhere on its left. One handler covers both calls here:

```nio
String s = first(x) + second(y) catch "fallback";
```

Parenthesize to narrow it to part of the expression.

Catching something that cannot fail is a compile error, in the same spirit as `?.` on a non-optional — the handler would be dead code. That also means deleting the last `return Error(...)` from a function tells you exactly which callers no longer need to handle it.

## Errors are not bugs

The [runtime errors](/docs/memory) that mark bugs — an index out of range, division by zero, a deadlock — are not catchable. `catch` handles the `Error` a function chose to return, not a mistake in the program. Keeping the two apart is deliberate: the first is a result your caller can act on, the second means the code is wrong.

That line is also why [`fs`](/docs/stdlib/fs) raises `Error`s instead of stopping the program. A file that is not there is not a bug in the code that looked for it, so it is the caller's business what to do about it.

When one does stop the program, it prints where it happened — innermost call first:

```text
runtime error: index 99 out of range (array length 3)

in:
  deepest
  middle
  top
  main
```

A method reads as `Type.name`, and a function literal is named by the function it was written in, like `<function literal in outer>`.

The list can have gaps. Recording it costs your program nothing, because it reuses information the garbage collector already keeps — but that means it can only name functions the collector tracks. Three kinds are missing: a function that works only with numbers, a standard-library function (you see the Nio function that called it instead), and an `async` function.

An uncaught `Error` prints the same way, but the list means something different. An error is passed up by returning, so by the time nothing is left to catch it, every function it passed through has already returned. The list therefore shows where the program stopped, not where the error came from. To tell which of several calls failed, give each a different `code`.

Set `NIO_NO_TRACE=1` if a program needs to compare the error text exactly.

## Function values and futures

Inference reads bodies, so the two types that describe a function *without* one have to say it. Both mark the result with `!`:

```nio
Function(int)<String!> gen = String (int id) -> {
    if (id == 0) { return Error("bad seed"); }
    return "Jack";
};
print(gen(1) catch "anonymous");   // Jack
print(gen(0) catch "anonymous");   // anonymous
```

A function value written where a fallible type is expected takes that contract on even when its own body cannot fail, since its callers are already compiled against it. One whose body *can* fail, written where a plain type is expected, is a compile error that names the type you meant.

Async functions are inferred like any other. Calling one never fails — the body has not run yet — so the fallibility rides on the future and surfaces at the `await`:

```nio
String async fetchName(int id) {
    if (id < 0) { return Error("bad id"); }
    return "Remote";
}

print(await fetchName(3) catch "offline");    // Remote

Future<String!> pending = fetchName(-1);
print(await pending catch "offline");         // offline
```

An error raised by a future nobody ever awaits is not lost: it stops the program when it runs out of work. For the same reason `async.run` does not take a fallible future — a completion callback has no error channel — so await it instead.

## What is not here yet

`Error` carries a message and a code, and nothing else. The code is enough to tell one failure from another, as the examples above do, but you cannot declare an error *type* of your own or attach more data; if you need more today, put it in the message.
