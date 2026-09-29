---
title: "Versions"
description: "What the Nio version number means before 1.0, how to check the installed version, and where to find the changes in each release."
---

# Versions

```sh
$ nio version
nio 0.1.0 darwin/arm
```

`nio --version` gives the same output. The output includes the host platform.
A bug report needs this line.

## What the number means

Nio is at **0.1**. Until 1.0, a release can change the language in ways that
break existing code. The
[changelog](https://github.com/nio-org/nio/blob/main/CHANGELOG.md) lists the
changes in each release.

Version numbers are `MAJOR.MINOR.PATCH`. Before 1.0, the minor number
increases when the language changes, and the patch number increases for fixes.
