---
title: "path module"
description: "The Nio path module joins and localizes file-system paths, reads the working directory, and finds where an app should store its data."
---

# Path

## Introduction

```nio
import 'path';
```

The `path` module builds file-system paths as strings. It uses `\` on Windows and `/` on other platforms.

```nio
import 'path';

String file = path.join("build", "reports", "result.txt");
print(file);
```

## Notes

* Both `/` and `\` are accepted as separators on every platform.
* `join` and `localize` only work with path text. They do not check whether anything exists.
* Use [`fs`](/docs/stdlib/fs) to read, write, inspect, or delete the path.
* `userData` is the module's one fallible function; its failures carry `path.ErrorCode` codes (the same shared `ErrorCode` enum `fs` raises).

## `path.getCwd()`

```nio
String path.getCwd()
```

Returns the current working directory as an absolute path. Relative file-system paths are resolved from this directory.

If the working directory cannot be read, this function causes a runtime error.

```nio
import 'path';

print(path.getCwd());       // /Users/you/project
```

## `path.join()`

```nio
String path.join(String first, ...String more)
```

Joins one or more path parts using the platform's separator. It also removes repeated separators and `.` parts, and resolves `..` where possible.

Empty parts are ignored. The result only ends in a separator when it is the root. Calling `path.join()` without any arguments is a compile error.

```nio
import 'path';

print(path.join("a", "b", "file.txt"));          // a/b/file.txt
print(path.join("/usr/local", "../bin", "nio")); // /usr/bin/nio
print(path.join("a//b", "./c"));                 // a/b/c
print(path.join("x", ".."));                     // .
```

## `path.localize()`

```nio
String path.localize(String p)
```

Replaces every path separator with the platform's separator. Unlike `join`, it does not otherwise clean or resolve the path.

```nio
import 'path';

print(path.localize("./thisdir/file"));
print(path.localize("a//b"));        // repeated separators are kept
print(path.localize("../up"));       // .. is kept
```

## `path.userData()`

```nio
String path.userData(String app)
```

Returns where the platform says an application named `app` should keep its data, with the app name as the last element:

| Platform | Answer |
|---|---|
| macOS | `$HOME/Library/Application Support/<app>` |
| Windows | `%APPDATA%\<app>` |
| Linux and others | `$XDG_DATA_HOME/<app>`, else `$HOME/.local/share/<app>` |

It answers the path only — nothing is created. Use `fs.createDir` to make the directory the first time.

This is the module's one fallible function. If the environment does not say where the base location is (`HOME` unset), it raises `path.ErrorCode.NOT_FOUND`. The app name must be a single path element: an empty name, or one containing a separator, raises `path.ErrorCode.INVALID`.

```nio
import 'path';
import 'fs';

String? dir = path.userData("myapp") catch e {
    print(e.message);
};
if (dir != null && !fs.exists(dir)) {
    fs.createDir(dir) catch e { print(e.message); };
}
```
