---
title: "async module"
description: "The Nio async module: handle a future's result with a callback using async.run, and wait for the first of several futures with async.race."
---

# Async

## Introduction

```nio
import 'async';
```

The `async` module contains two functions. `async.run` handles a future's result with a callback instead of awaiting it, and `async.race` waits for the first of several futures to finish.

Async functions, `Future<T>`, and `await` are language features and do not need an import. See [Async and futures](/docs/async) for an introduction.

## Notes

* Calling an async function returns a `Future<T>`.
* Use `await future` when later code needs the result.
* Use `async.run(future, callback)` when you want to register a callback and continue immediately.
* Use `async.race(a, b, ...)` when you want whichever of several futures finishes first.
* A fallible future (`Future<T!>`) must be awaited so its error can be caught.

## `async.run()`

```nio
void async.run(Future<T> future, Function(T)<void> callback)
```

Registers `callback` to run with the future's result. The call itself returns immediately.

For `Future<void>`, the callback takes no arguments. If the future has already completed, the callback runs during the call to `async.run`. Fallible futures are not accepted; await them so their errors can be caught.

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

Returns a future of the **index** of whichever argument completes first.

An index rather than a result, because the futures need not have the same type — racing a network read against a timer is what it is for, and those two have no answer type in common. Awaiting the winner afterwards costs nothing: awaiting an already-completed future never suspends.

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

Unlike `async.run`, the arguments may be fallible: a race hands back an index and leaves every future as it was, so the error is still waiting at the `await` that collects it.

**The losers keep running.** Nothing is cancelled, so a fallible loser still owes its error to someone — await it, or the program stops when it finishes (see [Errors](/docs/errors)). For a plain timeout on a network operation, the `timeout` option in [`net.Options`](/docs/stdlib/net#netoptions) is simpler and does cancel.

If one of the futures has already completed, it wins before the others are consulted; ties go to the earliest argument. Racing zero futures, or anything that is not a future, is a compile error.
