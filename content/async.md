---
title: "Async and futures"
description: "Write async code in Nio with async functions, futures and await. Many tasks run on one thread, with no locks and no data races."
---

# Async and futures

An `async` function is one that can wait — for a timer, a network reply, another program — without stopping the rest of your program. Calling it does not run its body straight away. Instead it immediately returns a **future**, a `Future<T>`: a promise of a `T` that will be ready later.

While one async function waits, others get to run. They take turns at each `await`, on a single thread: two pieces of your code never run at the same moment, so you never need locks. (Programs you start with [`process.child.run`](/docs/stdlib/process) do run at the same time as yours — it is only your own code that takes turns.)

The order is predictable: a program without timers produces the same output every time, and timers wake up in order of their deadlines.

## Declaring an async function

Write `async` between the return type and the name:

```nio
int async sum(int a) {
    return a;              // the body returns the declared type, as usual
}

void async log(String m) {     // void async
    print(m);
}
```

Inside the body nothing changes: `return` checks against the declared type, the body may call and await other functions (including itself), and `export` works like on any function.

## Calling one: futures

A call captures its arguments and hands back a future instead of a result. `sum(5)` has type `Future<int>`; `log("hi")` has type `Future<void>`:

```nio
Future<int> f = sum(5);    // nothing has run yet
```

Futures are ordinary values — store them in variables, record fields, arrays, and optionals, pass and return them. Two futures are the same type exactly when their element types are. What futures deliberately don't do: compare (`==`), print, or serialize to JSON — await the result and use that instead.

A future variable that was never assigned holds a *null future*, and awaiting it is a runtime error. Real futures come from calling an `async` function, and from library functions that wait on the outside world: [`time.sleep`](/docs/stdlib/time), [`process.child.run`](/docs/stdlib/process), and the [`net`](/docs/stdlib/net), [`http`](/docs/stdlib/http) and [`tls`](/docs/stdlib/tls) functions.

## await

`await f` yields the future's result. What happens while the result isn't ready depends on where the await stands:

- **Inside an async function**, `await` *suspends* the task. The function parks until `f` completes, other ready tasks run in the meantime, and the body later resumes exactly where it stopped — this is what makes async functions interleave.
- **Anywhere else** (top level, ordinary functions), `await` runs waiting tasks, in the order they were started, until `f` is done.

Either way the result is remembered — awaiting the same future again returns the same value without re-running anything:

```nio
int mySum = await sum(5);      // drives the scheduler until sum is done: 5

Future<int> f = sum(6);
print(await f + await f);    // 12 — the body ran once
```

`await` binds like a unary operator (`await sum(5) + 1` is `(await sum(5)) + 1`). Awaiting a `Future<void>` yields nothing — use it as a statement: `await t;`.

Two things to keep an eye on:

- An optional future (`Future<int>?`) must be narrowed before awaiting: `if (f != null) { await f; }`.
- A cycle of awaits — every pending future waiting on another, including a future awaiting its own result — is a deadlock and stops the program with a runtime error.

## Interleaving

Because an await inside an async function suspends rather than blocks, independent tasks make progress in turns:

```nio
void async announce(String m) {
    print(m);
}

void async task(String name) {
    print(name + ": step 1");
    await announce(name + ": helper");   // suspends; the other task runs
    print(name + ": step 2");
}

task("A");
task("B");
print("top");

// prints: top,
//         A: step 1, B: step 1,
//         A: helper, B: helper,
//         A: step 2, B: step 2
```

Both tasks run their first step, each pauses on its helper, the helpers run, and both carry on — taking turns in the order they were started. The same program always takes turns the same way.

One expression-level detail: operands evaluated before an `await` are captured before the suspension, left to right. In `x + await f`, the value of `x` is taken *before* the task parks and is not re-read afterwards.

## When do un-awaited futures run?

After the last top-level statement of your program, every task that has not finished yet runs, in the order it was started, including any new work they start. So an async call is never lost — if you do not keep its future, its body simply runs at the end ("fire and forget"):

```nio
void async announce(String m) {
    print(m);
}

announce("first");
announce("second");
print("top-level");

// prints: top-level, first, second
```

Arguments are captured when the call is made; global variables are read when the body actually runs:

```nio
int base = 10;

int async addBase(int x) {
    return x + base;
}

Future<int> f = addBase(1);
base = 100;
print(await f);          // 101 — x was captured as 1, base is read now
```

## Callbacks: `async.run`

To react to a future's completion without blocking on it, import the built-in `async` module and register a callback:

```nio
import 'async';

int async sum(int a) {
    return a;
}

Future<int> mySum = sum(5);
async.run(mySum, void (int i) -> print(i));
print("registered");

// prints: registered, 5
```

The callback's parameter follows the future's element type — for a `Future<void>` it takes none (`() -> ...`). A callback registered on an already-completed future runs immediately. Multiple callbacks on one future run in registration order, and a callback is ordinary code: it can await, register more callbacks, or start new async work.

Note the split: async functions, futures, and `await` are part of the language and need no import — only `async.run` needs the module. The scheduler's timer is `time.sleep`, below. The [`async` reference page](/docs/stdlib/async) has the full signature and its rules.

## Timers: `time.sleep`

`time.sleep(d)` takes a `Duration` and returns a `Future<void>` that completes that long from now. It lives in the [`time`](/docs/stdlib/time) module rather than in `async` — it is about the clock, and `async` is about tasks — but what it produces is an ordinary future. Awaiting it inside an async function parks that task for the duration, other tasks running in the meantime, which makes it the natural way to delay, poll, or stagger work:

```nio
import 'async';
import 'time';

void async worker(String name, Duration wait) {
    await time.sleep(wait);
    print(name + " woke");
}

worker("slow", 80);        // a bare number is that many milliseconds
worker("fast", 10);
async.run(time.sleep(40), void () -> print("timer"));
print("start");

// prints: start, fast woke, timer, slow woke
```

Timers complete in deadline order regardless of creation order (equal deadlines: creation order), measured on a monotonic clock. `time.sleep(0)` completes on the scheduler's next free turn. A pending timer counts as pending work — the end-of-program drain waits for it, so a program with a live timer keeps running until it fires.

## Not yet

**One thing here is a decision, not a gap.** Your code takes turns on one thread, and that will not change: there are no threads in Nio. To use several processor cores, run several copies of your program — for a server, several processes sharing the same listening port. Leaving threads out means two pieces of code can never change the same data at the same moment, which is a whole class of bugs that cannot happen in Nio. The cost is that one process uses one core.

The rest is planned, but not in this version:

- async function *values* (a function value cannot be declared `async`)
