---
title: "Testing with nio test"
description: "Tests for Nio programs and nio test: filtering by name, exit statuses, and a hand-written entry file."
---

# Testing

A test is an ordinary program. The `test` module
([Test](/docs/stdlib/test)) registers test cases when a module initializes. A
test file is a module of `test.start` calls. A test *program* is an entry file
that imports the test modules to run.

`nio test` writes that entry file automatically.

```sh
nio test                       # every *_test.nio under the working directory
nio test tests/ lib/           # ...or under each of these paths
nio test --filter parser       # only the tests whose title holds "parser"
nio test --coverage tests/     # ...and write coverage.lcov on exit
```

A directory argument means every `*_test.nio` file at or under it. The order
is fixed. Two runs register the tests in the same sequence. `nio test`
skips `.git` and `node_modules`. It gives the generated entry file to the
compiler as text, and does not write it into the source tree.

## Filtering by name

`--filter <text>` runs only the tests whose title contains that text. The text
is a substring, not a pattern. Characters in it need no escape:

```sh
nio test --filter "parser: a union"
nio test --filter=parser
```

The filter is part of the `test` module, not of the command. As a result, it
also works for a hand-written test program:

```sh
nio run tests/all.nio --filter lexer
```

A filtered run shows how many tests it did not run. This shows when a filter
matches no tests:

```text
ok   lexer: positions
36 passed, 0 failed, 250 filtered out
```

A filter does not stop an async test from running. The caller starts a test
registered with `test.startAsync` before the module receives it
([Async and futures](/docs/async)). A filter can stop only the report of that
test.

## Exit statuses

| Status | Meaning |
| --- | --- |
| `0` | every selected test passed |
| `1` | at least one test failed |
| `2` | the run could not happen: an unknown flag, no `*_test.nio` under the paths, or a program that does not build |

The test program returns 0 and 1. These statuses are the same from `nio test`
and from a direct run of the program. Only `nio test` returns 2. A
continuous-integration job can use it to tell a failed test from a run that
did not occur.

## One program, not one per file

`nio test` builds one program from all the test files that it finds. A test
module registers its tests when it is imported. As a result, the suite needs
one link instead of one link per file. The link is the slowest part of a Nio build.

The tests run one at a time. Nothing in a test program is async unless its
code declares it async. An `await` outside an async function runs the
scheduler until the future completes. As a result, test cases do not
interleave by accident. `nio test`
does not run tests in parallel.

## A hand-written entry file

A project can also write the entry file by hand. For example, a hand-written entry can
set the order of test suites, or remove a shared temporary directory after the
last suite. `--filter` also works with a hand-written entry, because the
`test` module reads it.

```nio
// tests/all.nio
import './unit' as unit;
import './e2e' as e2e;
import 'test';

test.run();
```
