---
title: "Versions"
description: "What the Nio version number means before 1.0, how to check your version, and where to find the changes in each release."
---

# Versions

```sh
$ nio version
nio 0.1.0 darwin/arm
```

`nio --version` says the same thing. The host is on the line so that a bug
report names it without anybody having to ask.

## What the number means

Nio is at **0.1**. It is ready to try, but until 1.0 a release can change the
language in ways that break existing code. The
[changelog](https://github.com/nio-org/nio/blob/main/CHANGELOG.md) lists what
each release changed.

Version numbers are `MAJOR.MINOR.PATCH`. Before 1.0, the minor number moves
when the language changes, and the patch number moves for fixes.
