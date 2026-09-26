---
title: "test module"
description: "The Nio test module registers named test cases, checks values with assertions and expectations, and reports which tests pass or fail."
---

# Test

## Introduction

```nio
import 'test';
```

The `test` module runs named checks and reports which ones pass or fail.

```nio
import 'test';

int add(int a, int b) {
    return a + b;
}

test.start("adds two numbers", void () -> {
    test.expectInt(add(2, 3), 5);
});

test.run();

// ok   adds two numbers
// 1 passed, 0 failed
```

A test file is an ordinary Nio program:

```sh
nio run tests/math.nio
```

`nio test` writes the entry file for you and runs every `*_test.nio` under a
path — see [Testing](/docs/testing).

## Notes

* A test stops at its first failed assertion, but the remaining tests still run.
* Any uncaught error inside a test is reported as a test failure.
* `test.start` runs a synchronous test immediately. `test.startAsync` registers an async test that `test.run` waits for.
* Always call `test.run` after registering tests. It prints the summary and exits with status `1` if any test failed.
<a id="filter"></a>

**Running only some tests.** Every test program accepts `--filter <text>` and then runs only the tests whose title contains that text. This works whether `nio test` wrote the entry file or you did:

```sh
nio test --filter parser
nio run tests/all.nio --filter parser
nio run tests/all.nio --filter="parser: a union"
```

The text is matched as plain text, not as a pattern, so nothing needs escaping, and one filter can select a whole family of tests. The summary says how many tests were left out:

```text
ok   parser: a union declares a sealed base
ok   parser: a union member takes one payload
2 passed, 0 failed, 929 filtered out
```

A test registered with `test.startAsync` is still started when it is filtered out — only its result is hidden — so filtering does not make async tests faster.

<a id="coverage"></a>

**Coverage.** Run a test program with `--coverage` to see which lines of your code the tests ran:

```sh
nio run --coverage tests/math.nio
```

This writes `coverage.lcov`, which most editors and coverage tools can display. Set `NIO_COVERAGE_FILE` to write it somewhere else.

## `test.start()`

```nio
void test.start(String title, Function()<void!> body)
```

Runs `body` immediately and reports the result under `title`.

An uncaught error from the body fails the test with that error's message.

```nio
import 'test';

test.start("strings match", void () -> {
    test.expectString("nio", "nio");
});
```

## `test.startAsync()`

```nio
void test.startAsync(String title, Future<void!> task)
```

Registers an async test. The future is passed directly, and `test.run` waits for it.

The task must be fallible (`Future<void!>`), which it becomes when it contains an assertion or another fallible call.

```nio
import 'test';
import 'time';

void async completesLater() {
    await time.sleep(20);
    test.expectBool(true, true);
}

test.startAsync("completes later", completesLater());
test.run();
```

## `test.assert()`

```nio
void test.assert(bool ok, String message)
```

Fails the current test with `message` when `ok` is false. Use it for conditions that do not have a dedicated expectation.

```nio
import 'test';

int[] values = [1, 2, 3];

test.start("has three values", void () -> {
    test.assert(values.length == 3, "expected three values");
});
```

## `test.expectInt()`

```nio
void test.expectInt(int got, int want)
```

Fails unless `got` and `want` are equal. It accepts all integer types and enum values.

```nio
import 'test';

test.start("answer is 42", void () -> {
    test.expectInt(6 * 7, 42);
});
```

## `test.expectFloat()`

```nio
void test.expectFloat(float got, float want)
```

Fails unless the values are exactly equal. Use it for values that are written directly rather than results that may contain floating-point rounding.

```nio
import 'test';

test.start("reads a decimal", void () -> {
    test.expectFloat(1.5, 1.5);
});
```

## `test.expectFloatNear()`

```nio
void test.expectFloatNear(float got, float want, float tolerance)
```

Fails unless the difference between `got` and `want` is within `tolerance`.

```nio
import 'test';

test.start("adds decimals", void () -> {
    test.expectFloatNear(0.1 + 0.2, 0.3, 0.0001);
});
```

## `test.expectString()`

```nio
void test.expectString(String got, String want)
```

Fails unless the strings are equal.

```nio
import 'test';
import 'string';

test.start("uppercases a name", void () -> {
    test.expectString(string.toUpperCaseAscii("nio"), "NIO");
});
```

## `test.expectBool()`

```nio
void test.expectBool(bool got, bool want)
```

Fails unless the boolean values are equal.

```nio
import 'test';

test.start("feature is enabled", void () -> {
    test.expectBool(true, true);
});
```

## `test.run()`

```nio
void test.run()
```

Waits for all tests registered with `test.startAsync`, prints the total results, and exits with status `1` when anything failed. A successful call returns normally.

```nio
import 'test';

test.start("passes", void () -> {
    test.expectInt(1, 1);
});

test.run();

// ok   passes
// 1 passed, 0 failed
```
