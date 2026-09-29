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

* The module accepts `/` and `\` as separators on all platforms.
* `join` and `localize` change only the path text. They do not check if an entry exists at the path.
* The [`fs`](/docs/stdlib/fs) module reads, writes, inspects, or deletes the entry at the path.
* `userData` is the only fallible function in the module. Its errors use `path.ErrorCode` codes. This is the same `ErrorCode` enum that `fs` uses.

## `path.getCwd()`

```nio
String path.getCwd()
```

Returns the current working directory as an absolute path. Relative file-system paths start from this directory.

If the working directory cannot be read, this function causes a runtime error.

```nio
import 'path';

print(path.getCwd());       // /Users/you/project
```

## `path.join()`

```nio
String path.join(String first, ...String more)
```

Joins one or more path parts with the separator of the platform and returns the result. It also removes repeated separators and `.` parts, and resolves `..` where possible.

The function ignores empty parts. The result ends in a separator only when it is the root. A call to `path.join()` with no arguments is a compile error.

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

Replaces each path separator with the separator of the platform and returns the result. It makes no other change to the path. It does not remove parts or resolve `..`, as `join` does.

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

Returns the directory where the platform stores the data of an application named `app`. The app name is the last element of the path:

| Platform | Result |
|---|---|
| macOS | `$HOME/Library/Application Support/<app>` |
| Windows | `%APPDATA%\<app>` |
| Linux and others | `$XDG_DATA_HOME/<app>`, else `$HOME/.local/share/<app>` |

The function returns only the path. It does not create the directory. `fs.createDir` makes the directory the first time.

This is the only fallible function in the module. If the environment does not give the base location (for example, `HOME` is not set), it raises `path.ErrorCode.NOT_FOUND`. The app name must be one path element. An empty name, or a name that contains a separator, raises `path.ErrorCode.INVALID`.

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
