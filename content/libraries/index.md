---
title: "Libraries"
description: "Libraries that ship with the Nio repository beside the standard library, including a native webview for desktop apps."
---

# Libraries

Besides the standard library, the Nio repository contains some **external libraries**. These are ordinary Nio modules in [`libraries/`](https://github.com/nio-org/nio/tree/main/libraries). They are not part of the compiler. A program imports a library by path, as it imports any other file:

```nio
import './webview/webview';
```

A project uses a copy of the library's file or folder and imports it from there. A library that binds C or Objective-C keeps those sources beside its `.nio` file. The import adds them to the build through [native interop](/docs/native). No install step or build step comes first. As for all Nio programs, `clang` is the only requirement.

| Library | What it is |
|---|---|
| [`webview`](/docs/libraries/webview) | A native window that shows web content with the platform's engine, for desktop apps written in HTML and Nio. macOS only. |
| `sqlite` | An embedded SQL database: the SQLite amalgamation behind `open`, `exec`, `query` and `close`, with bound parameters. |
| `postgres.nio` | A PostgreSQL client that uses the PostgreSQL wire protocol over `net`. It is written in Nio. |
| `translation` | On-device text translation with the platform's translation engine (Apple's Translation framework, macOS 15+). |

Each library has a README in its folder.
