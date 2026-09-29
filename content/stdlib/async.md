---
title: "async module"
description: "The Nio async module: async.run handles a future's result with a callback, and async.race waits for the first of several futures."
---

# Async

## Introduction

```nio
import 'async';
```

The `async` module contains two functions. `async.run` handles a future's result with a callback instead of awaiting it, and `async.race` waits for the first of several futures to finish.

Async functions, `Future<T>`, and `await` are language features and do not need an import. [Async and futures](/docs/async) gives an introduction.

## Notes

* Calling an async function returns a `Future<T>`.
* `await future` waits for the result. It is for code that needs the result later.
* `async.run(future, callback)` registers a callback. The caller continues immediately.
* `async.race(a, b, ...)` tells which of several futures finishes first.
* A fallible future (`Future<T!>`) must be awaited. Its error can be caught only at an `await`.

## `async.run()`

```nio
void async.run(Future<T> future, Function(T)<void> callback)
```

Registers `callback` to run with the future's result. The call itself returns immediately.

For `Future<void>`, the callback takes no arguments. If the future has already completed, the callback runs during the call to `async.run`. Fallible futures are not accepted. A fallible future must be awaited, because its error can be caught only at an `await`.

```nio
import 'async';
import 'time';

int async loadCount() {
    await time.sleep(50);
    return 3;
}

async.run(loadCount(), void (int count) -> {
    print("loaded", count);
});

async.run(time.sleep(100), void () -> {
    print("timer finished");
});

String async loadName() {
    return Error("not found");
}

String name = await loadName() catch "unknown";

print("work continues");
print(name);                     // unknown

// work continues
// loaded 3
// timer finished
```

## `async.race()`

```nio
Future<int> async.race(Future<any> first, ...Future<any> more)
```

Returns a future that holds the **index** of the first argument to complete.

The result is an index because the futures can have different types. For example, a program can race a network read against a timer. An `await` on the first future gets its result. An `await` on a completed future does not suspend.

```nio
import 'async';
import 'net';
import 'time';

void async waitForReply(Socket sock) {
    Future<byte[]!> reply = net.read(sock, 4096);
    Future<void> giveUp = time.sleep(5000);

    if (await async.race(reply, giveUp) == 0) {
        byte[] b = await reply catch e { return; };
        print("got a reply");
    } else {
        print("gave up waiting");
    }
}
```

The arguments can be fallible futures, which `async.run` does not accept. `async.race` does not change the futures. An error stays in its future until an `await` on that future catches it.

**The other futures keep running.** `async.race` cancels nothing. Each fallible future must be awaited. If a future fails and no `await` collects its error, the program stops when it has no more work to do (see [Errors](/docs/errors)). The `timeout` option in [`net.Options`](/docs/stdlib/net#netoptions) sets a timeout on a network operation. That option cancels the operation.

If a future has already completed when `async.race` is called, `async.race` returns its index. When more than one future is complete, the result is the index of the earliest argument. A race with zero futures, or with an argument that is not a future, is a compile error.
