---
title: "Libraries"
description: "Libraries that ship with the Nio repository beside the standard library, including a native webview for desktop apps."
---

# Libraries

Besides the standard library, the Nio repository ships a few **external libraries**: ordinary Nio modules that live in [`libraries/`](https://github.com/nio-org/nio/tree/main/libraries) rather than in the compiler. Nothing in the compiler knows they exist. You reach one the way you reach any other file, with an import by path:

```nio
import './webview/webview';
```

Copy the library's file or folder into your project and import it from there. A library that binds C or Objective-C keeps those sources beside its `.nio` file, and the import brings them into the build through [native interop](/docs/native), so there is still nothing to install and nothing to build first: `clang` is the only requirement, as for any Nio program.

| Library | What it is |
|---|---|
| [`webview`](/docs/libraries/webview) | A native window that shows web content with the platform's engine, for desktop apps written in HTML and Nio. macOS today. |
| `sqlite` | An embedded SQL database: the SQLite amalgamation behind `open`, `exec`, `query` and `close`, with bound parameters. |
| `postgres.nio` | A PostgreSQL client that speaks the wire protocol over `net`, written entirely in Nio. |
| `translation` | On-device text translation through the platform's own engine (Apple's Translation framework, macOS 15+). |

Each one has a README in its folder.
