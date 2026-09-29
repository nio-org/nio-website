---
title: "fs module: files and directories"
description: "The Nio fs module creates, reads, writes, copies, renames, inspects and deletes files and directories, with catchable errors."
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

File-system operations can fail for normal reasons: a file may be missing, permissions may be denied, or a disk may be full. For this reason, each function except `fs.exists` is fallible. A [`catch`](/docs/errors) handles its errors.

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
| `isDirectory` | `bool` | `true` when the entry is a directory. |
| `isFile` | `bool` | `true` when the entry is a regular file. |
| `permissions` | `String` | Permissions such as `"rw-r--r--"`. |
| `modified` | `DateTime` | Last modification time. |

`createDir` and `readDir` work on one directory at a time. Only `fs.delete(path, { recursive: true })` goes through all levels of a directory tree.

## `fs.copy()`

```nio
void fs.copy(String from, String to)
```

Copies the file at `from` to `to`. If `to` does not exist, the function creates it. If an entry exists at `to`, the function replaces it. The content is streamed. The memory use does not increase with the file size. The source must be a file. A copy of a directory raises `IS_DIRECTORY`.

Metadata (permissions, times) is not copied. The copy is a new file with the same bytes, the same as a file that `writeFile` makes.

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

Deletes a file or an empty directory. With `{ recursive: true }`, it deletes a directory and everything inside it.

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

Returns `true` when an entry exists at `path`. It is the only function in the module that is not fallible.

The result can become incorrect immediately after the call. When another process can change the path, the reliable check is the operation itself, with a `catch` for its error.

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

Returns the names of the entries directly inside a directory. The names do not include the directory path. The result does not include `.` or `..`, but it includes hidden entries. The order of the names is not guaranteed.

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

Reads all of the file into a new byte array in memory and returns it. When the file contains text, `string.fromByteArray` converts the result to a string.

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

Moves the file or directory at `from` to `to`. If an entry exists at `to`, the function replaces it.

On POSIX platforms, the replacement is atomic. A program can use this to save a file that is never partly written. It writes the new content to a temporary name. Then it renames the temporary file to the real name. A reader, or a crash, sees the old file or the new file, never a mix of the two. On Windows, the replacement is not atomic, but the final state is the same.

A rename moves a name and does not copy bytes. A move to a different file system usually fails, but the result depends on the operating system. A move to a different file system is an `fs.copy` followed by an `fs.delete`.

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

Returns an [`fs.Stat`](#notes) record for the entry. Symbolic links are followed. The result describes the target.

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

Writes all of `content` to a file. If the file does not exist, the function creates it. If the file exists, the function replaces it. The function does not create parent directories.

An empty array creates an empty file. `string.toByteArray` converts text to the bytes that this function writes.

```nio
import 'fs';
import 'string';

fs.writeFile("message.txt", string.toByteArray("hello\n"));

String saved = string.fromByteArray(fs.readFile("message.txt"));
print(saved);                              // hello
```
