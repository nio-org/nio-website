---
title: "fs module: files and directories"
description: "The Nio fs module creates, reads, writes, copies, renames, inspects and deletes files and directories, with errors you can catch."
---

# FS

## Introduction

```nio
import 'fs';
```

The `fs` module creates, reads, writes, inspects, and deletes files and directories.

Paths are strings. Relative paths start from the current working directory, and the [`path`](/docs/stdlib/path) module can build paths that work across platforms.

```nio
import 'fs';
import 'string';

fs.writeFile("hello.txt", string.toByteArray("hello\n"));
String text = string.fromByteArray(fs.readFile("hello.txt"));
print(text);
```

## Notes

File-system operations can fail for normal reasons: a file may be missing, permissions may be denied, or a disk may be full. Every function except `fs.exists` is therefore fallible and can be handled with [`catch`](/docs/errors).

```nio
import 'fs';

byte[]? content = fs.readFile("config.json") catch e {
    print(e.message);
};
```

The module exports two record types:

`fs.DeleteOptions` configures `fs.delete`.

| Field | Type | Description |
| --- | --- | --- |
| `recursive` | `bool?` | Delete the contents of a directory when `true`. |

`fs.Stat` describes a file-system entry.

| Field | Type | Description |
| --- | --- | --- |
| `name` | `String` | Final part of the path. |
| `extension` | `String` | Final extension, including `.`, or `""`. |
| `size` | `int` | Size in bytes. |
| `isDirectory` | `bool` | Whether the entry is a directory. |
| `isFile` | `bool` | Whether the entry is a regular file. |
| `permissions` | `String` | Permissions such as `"rw-r--r--"`. |
| `modified` | `DateTime` | Last modification time. |

`createDir` and `readDir` work on one directory at a time. Only `fs.delete(path, { recursive: true })` walks through a whole directory tree.

## `fs.copy()`

```nio
void fs.copy(String from, String to)
```

Copies the file at `from` to `to`, creating `to` or replacing whatever was there. The content is streamed, so a large file costs no more memory than a small one. The source must be a file — copying a directory raises `IS_DIRECTORY`.

Metadata (permissions, times) is not copied: the copy is a new file with the same bytes, exactly as `writeFile` would have made it.

```nio
import 'fs';

fs.copy("config.json", "config.json.bak");
```

## `fs.createDir()`

```nio
void fs.createDir(String path)
```

Creates one directory. Its parent must already exist, and the call fails if an entry already exists at the path.

```nio
import 'fs';

if (!fs.exists("out")) {
    fs.createDir("out");
}

print(fs.stat("out").isDirectory);   // true
```

## `fs.createTempDir()`

```nio
String fs.createTempDir(String prefix)
```

Creates a uniquely named directory inside the system's temporary directory and returns its path. The prefix becomes the start of the directory name and must not contain a path separator.

Temporary directories are not removed automatically.

```nio
import 'fs';
import 'path';
import 'string';

String work = fs.createTempDir("nio-build-");
fs.writeFile(path.join(work, "input.txt"), string.toByteArray("data"));

// Use the files...

fs.delete(work, { recursive: true });
```

## `fs.delete()`

```nio
void fs.delete(String path)
void fs.delete(String path, fs.DeleteOptions options)
```

Deletes a file or an empty directory. Pass `{ recursive: true }` to delete a directory and everything inside it.

Recursive deletion may leave a partly deleted tree if an entry cannot be removed. A symbolic link is deleted without deleting its target.

```nio
import 'fs';

if (fs.exists("old.log")) {
    fs.delete("old.log");
}

if (fs.exists("build")) {
    fs.delete("build", { recursive: true });
}
```

## `fs.exists()`

```nio
bool fs.exists(String path)
```

Returns whether an entry exists at `path`. This is the only function in the module that is not fallible.

The result can become stale immediately; perform the operation and catch its error when another process may change the path.

```nio
import 'fs';

if (fs.exists("config.json")) {
    print("config found");
}
```

## `fs.readDir()`

```nio
String[] fs.readDir(String path)
```

Returns the names directly inside a directory. The names do not include the directory path, `.` or `..`; hidden entries are included. No ordering is guaranteed.

```nio
import 'fs';
import 'path';

String[] names = fs.readDir("src") catch [];
forEach(names, name) {
    print(path.join("src", name));
}
```

## `fs.readFile()`

```nio
byte[] fs.readFile(String path)
```

Reads the entire file into a new byte array held in memory. Convert the result with `string.fromByteArray` when the file contains text.

```nio
import 'fs';
import 'string';

byte[] content = fs.readFile("message.txt") catch [];
print(string.fromByteArray(content));
```

## `fs.rename()`

```nio
void fs.rename(String from, String to)
```

Moves the entry at `from` — file or directory — to `to`, replacing anything already there.

On POSIX platforms the replacement is atomic, which makes write-then-rename the way to save a file that can never be left half-written: write the new content to a temporary name, then rename it over the real file. A reader (or a crash) sees either the old file or the new one, never a mixture. On Windows the replacement is not atomic, but the final state is the same.

Renaming moves a *name*; it does not copy bytes, so moving across file systems is whatever the operating system allows (usually a failure — use `fs.copy` then `fs.delete` there).

```nio
import 'fs';
import 'string';

// The atomic save.
fs.writeFile("state.json.tmp", string.toByteArray("{\"version\": 2}"));
fs.rename("state.json.tmp", "state.json");
```

## `fs.stat()`

```nio
fs.Stat fs.stat(String path)
```

Returns an [`fs.Stat`](#notes) record for the entry. Symbolic links are followed, so the result describes the target.

```nio
import 'fs';
import 'time';

fs.Stat? info = fs.stat("report.tar.gz") catch null;
if (info != null) {
    print(info.name);                         // report.tar.gz
    print(info.extension);                    // .gz
    print(info.size, "bytes");
    print(time.date.toText(info.modified));
}
```

## `fs.writeFile()`

```nio
void fs.writeFile(String path, byte[] content)
```

Writes all of `content` to a file. A missing file is created; an existing file is replaced. Parent directories are not created automatically.

An empty array creates an empty file. Use `string.toByteArray` to write text.

```nio
import 'fs';
import 'string';

fs.writeFile("message.txt", string.toByteArray("hello\n"));

String saved = string.fromByteArray(fs.readFile("message.txt"));
print(saved);                              // hello
```
