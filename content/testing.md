---
title: "Testing with nio test"
description: "Write tests for Nio programs and run them with nio test: filter by name, read exit statuses, and write the entry file yourself."
---

# Testing

A test is an ordinary program. The `test` module (see
[Test](/docs/stdlib/test)) registers cases as a module initializes, so a test
file is a module of `test.start` calls and a test *program* is an entry file
that imports the modules it wants to run.

`nio test` writes that entry file for you.

```sh
nio test                       # every *_test.nio under the working directory
nio test tests/ lib/           # ...or under each of these paths
nio test --filter parser       # only the tests whose title holds "parser"
nio test --coverage tests/     # ...and write coverage.lcov on exit
```

A directory means every `*_test.nio` at or under it, in a settled order, so
two runs register the tests in the same sequence. `.git` and `node_modules`
are skipped. The generated entry file is handed to the compiler as text and
is never written into your tree.

## Filtering by name

`--filter <text>` runs only the tests whose title holds that text — a
substring, not a pattern, so nothing has to be escaped:

```sh
nio test --filter "parser: a union"
nio test --filter=parser
```

The filter belongs to the `test` module rather than to the command, so it
works for a test program you wrote yourself as well:

```sh
nio run tests/all.nio --filter lexer
```

A filtered run says how many it left out, so a filter that matches nothing
is visible rather than silent:

```text
ok   lexer: positions
36 passed, 0 failed, 250 filtered out
```

One case does not save time: a test registered with `test.startAsync` has
already been started by the caller before the module hands it over
([Async and futures](/docs/async)), so a filter can only stop it being
*reported*, not stop it running.

## Exit statuses

| Status | Meaning |
| --- | --- |
| `0` | every selected test passed |
| `1` | at least one test failed |
| `2` | the run could not happen: an unknown flag, no `*_test.nio` under the paths, or a program that does not build |

0 and 1 come from the test program itself, which is why they are the same
whether you run `nio test` or the program directly. 2 is `nio test`'s own,
and it exists so that a continuous-integration job can tell "the tests say
no" from "the tests never ran".

## One program, not one per file

`nio test` builds a single program out of every test file it found. That is
a deliberate trade: a test module is registered by being imported, so one
program means one link for the whole suite instead of a link per file, and a
link is the expensive part of a Nio build.

It also means the tests run one at a time. Nothing in a test program is
async unless you make it so, and an `await` outside an async function drives
the scheduler to completion, so cases do not interleave by accident. Running
tests side by side would mean running *processes* side by side — which is
worth doing only where the tests themselves cost more than the links would,
and is not what this command does today.

## Writing the entry file yourself

You still can, and this repository does: `tests/all.nio` is a hand-written
entry, and it earns that because it fixes the order of two suites and cleans
up a shared temporary directory when the second finishes. A hand-written
entry gets `--filter` for free, since that lives in the module.

```nio
// tests/all.nio
import './unit' as unit;
import './e2e' as e2e;
import 'test';

test.run();
```
