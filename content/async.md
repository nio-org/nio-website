---
title: "Async and futures"
description: "Async code in Nio uses async functions, futures and await. Many tasks run on one thread, with no locks and no data races."
---

# Async and futures

An `async` function can wait for a timer, a network reply or another program without stopping the rest of the program. A call to an `async` function does not run its body immediately. The call returns a **future**, of type `Future<T>`. A future holds a `T` value that becomes available later.

While one async function waits, other async functions run. Tasks take turns at each `await`, on a single thread. Two parts of the program never run at the same time. As a result, the program needs no locks. Programs started with [`process.child.run`](/docs/stdlib/process) run at the same time as the program that started them. Only the tasks of one program take turns.

The order of execution is predictable. A program without timers produces the same output every time. Timers complete in the order of their deadlines.

## Declaring an async function

The keyword `async` goes between the return type and the name:

```nio
int async sum(int a) {
    return a;              // the body returns the declared type, as usual
}

void async log(String m) {     // void async
    print(m);
}
```

The body of an async function follows the usual rules. `return` checks against the declared type. The body can call and await other functions, and it can call itself. `export` works as on any other function.

## Calling one: futures

A call captures its arguments and returns a future instead of a result. `sum(5)` has type `Future<int>`, and `log("hi")` has type `Future<void>`:

```nio
Future<int> f = sum(5);    // nothing has run yet
```

Futures are ordinary values. A program can store them in variables, record fields, arrays and optionals, and it can pass and return them. Two future types are the same type when their element types are the same. Futures cannot be compared with `==`, printed or serialized to JSON. A program awaits the future and uses its result instead.

A future variable that was never assigned holds a *null future*. Awaiting a null future is a runtime error. Futures come from calls to `async` functions, and from library functions that wait on the outside world: [`time.sleep`](/docs/stdlib/time), [`process.child.run`](/docs/stdlib/process), and the [`net`](/docs/stdlib/net), [`http`](/docs/stdlib/http) and [`tls`](/docs/stdlib/tls) functions.

## await

`await f` returns the result of the future. If the result is not ready, the behavior depends on where the `await` is:

- **Inside an async function**, `await` *suspends* the task. Other ready tasks run while the task waits. When `f` completes, the task resumes at the point where it stopped. This is how async functions interleave.
- **Anywhere else** (at the top level or in an ordinary function), `await` runs the waiting tasks, in the order they were started, until `f` completes.

In both cases, the future keeps its result. A second `await` on the same future returns the same value, and the body does not run again:

```nio
int mySum = await sum(5);      // drives the scheduler until sum is done: 5

Future<int> f = sum(6);
print(await f + await f);    // 12 — the body ran once
```

`await` has the precedence of a unary operator: `await sum(5) + 1` is `(await sum(5)) + 1`. Awaiting a `Future<void>` returns no value. It is used as a statement: `await t;`.

- An optional future (`Future<int>?`) must be narrowed before an `await`: `if (f != null) { await f; }`.
- A cycle of awaits is a deadlock. In a cycle, every pending future waits on another pending future. A future that awaits its own result is also a cycle. A deadlock stops the program with a runtime error.

## Interleaving

An `await` inside an async function suspends the task and does not block the program. As a result, independent tasks make progress in turns:

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

Both tasks run their first step. Then each task suspends at the `await` on its helper. The helpers run, and then both tasks continue. The tasks take turns in the order they were started. A program always interleaves its tasks in the same order.

Operands to the left of an `await` are evaluated before the task suspends, from left to right. In `x + await f`, the value of `x` is read *before* the task suspends. It is not read again when the task resumes.

## Futures that are not awaited

After the last top-level statement, the program runs every task that has not finished, in the order the tasks were started. This includes the new tasks that these tasks start. As a result, every async call runs. When a program does not keep the future of a call, the body of the call runs at the end of the program:

```nio
void async announce(String m) {
    print(m);
}

announce("first");
announce("second");
print("top-level");

// prints: top-level, first, second
```

The arguments are captured when the call is made. Global variables are read when the body runs:

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

`async.run`, in the built-in `async` module, registers a callback. The callback runs when a future completes, and the caller does not wait for the future:

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

The parameter of the callback has the element type of the future. For a `Future<void>`, the callback has no parameter (`() -> ...`). A callback registered on a future that is already complete runs immediately. Callbacks on one future run in the order they were registered. A callback is ordinary code: it can await, register more callbacks or start new async work.

Async functions, futures and `await` are part of the language and need no import. Only `async.run` needs the `async` module. The timer is `time.sleep`, described below. The [`async` reference page](/docs/stdlib/async) gives the full signature and its rules.

## Timers: `time.sleep`

`time.sleep(d)` takes a `Duration` and returns a `Future<void>` that completes after that duration. It is in the [`time`](/docs/stdlib/time) module, not in `async`, but it returns an ordinary future. When an async function awaits it, that task suspends for the duration and other tasks run. It can delay, poll or stagger work:

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

Timers complete in the order of their deadlines, not in the order they were created. Timers with equal deadlines complete in the order they were created. Deadlines are measured on a monotonic clock. `time.sleep(0)` completes at the next free turn of the scheduler. A pending timer is pending work. At the end of the program, the program waits for it. A program with a pending timer continues to run until the timer completes.

## Limits

### One thread per program

A Nio program runs on a single thread. Tasks share it: a task runs until it reaches an `await`, and then the next ready task runs. Nio has no threads, and there is no plan to add them.

Only one task runs at a time. Two tasks can never change the same data at the same moment. Data races cannot occur, and shared data needs no locks.

As a result, one program uses one processor core. More copies of the program use more cores. For example, several servers can run on different ports behind a load balancer.

### Not available yet

**Async function values.** Only a named `async` function can suspend at an `await` and let other tasks run. A function value can return a future, but its own body cannot suspend. An `await` inside a function value waits for the result and blocks its caller until the result is available.

A function value can do async work through a named `async` function. The function value calls the named function and passes the variables that it needs as arguments:

```nio
import 'time';

int async delayed(int value, Duration wait) {
    await time.sleep(wait);
    return value;
}

Duration wait = 20;
Function(int)<Future<int>> later = Future<int> (int value) -> delayed(value, wait);
print(await later(7));   // 7
```
