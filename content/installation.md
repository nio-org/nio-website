---
title: "Install Nio"
description: "Install the Nio compiler on macOS, Linux or Windows, build it from source, run a first program, and set up an editor."
---

# Installation

## Install Nio

On macOS and Linux, run:

```sh
curl -fsSL https://github.com/nio-org/nio/releases/latest/download/install.sh | sh
```

On Windows, run this in PowerShell:

```powershell
irm https://github.com/nio-org/nio/releases/latest/download/install.ps1 | iex
```

The script downloads `nio` for the computer, checks that the download is correct, and installs it. On macOS and Linux, it installs `nio` in `~/.local/bin`. If that folder is not on the `PATH`, the script prints the line to add. On Windows, it installs `nio` in `%LOCALAPPDATA%\Programs\nio` and adds that folder to the `PATH`.

Prebuilt versions are available for macOS on Apple Silicon, Linux on x86-64 (glibc 2.35 or newer: Ubuntu 22.04, Debian 12, RHEL 9 or later), and Windows on x86-64. On other systems, Nio must be [built from source](#building-from-source).

The variable `NIO_VERSION` selects a specific version, for example `NIO_VERSION=v0.1.0`. The variable `NIO_INSTALL` selects a different install location.

> [!NOTE]
>
> macOS blocks the file when a browser downloads it from the release page. The command `xattr -d com.apple.quarantine nio` removes the block. The install script does not have this problem.

## Prerequisites

`nio` uses **clang** to build programs. clang must also be on the `PATH`.

* **macOS:** clang is part of the Xcode command line tools. Install them with `xcode-select --install`.
* **Linux:** install clang from the packages of the distribution, for example `sudo apt install clang`.
* **Windows:** install [LLVM](https://releases.llvm.org/) (or run `winget install LLVM.LLVM`) and the **Visual Studio Build Tools** with the "Desktop development with C++" workload, which supplies the C runtime that clang needs. Add `C:\Program Files\LLVM\bin` to the `PATH`. Programs built on Windows always have an `.exe` extension.

## Building from source

A build from source is necessary only if no prebuilt version is available for the system, or to change the compiler. The build needs clang, as above. On Windows, it also needs Git Bash to run the build script. Git Bash is part of Git for Windows.

The compiler is written in Nio. A Nio compiler is necessary to build it. The `bootstrap/` folder of the repository contains a copy of the compiler as LLVM IR. clang can build this copy without other tools:

```sh
sh bootstrap/build.sh          # writes ./nio
./nio version
```

This first compiler works, but it is slower than an optimized build. Use it to build the compiler again with optimization:

```sh
./nio build --release src/nio.nio -o nio
```

Put `nio` in a folder on the `PATH`. Then every command in this documentation works as written.

## Running programs

```sh
# run a program directly
nio run hello.nio

# build a native executable
nio build hello.nio -o hello
./hello

# see the LLVM IR the compiler generates
nio emit hello.nio

# format every .nio file in this folder and below
nio format .

# run every *_test.nio file in this folder and below
nio test

# show what a module declares, with its documentation
nio doc http

# show the compiler's version
nio version
```

## Flags

Flags go **before** the file name. With `run`, all arguments after the file name go to the program, not to the compiler.

| Flag | Effect |
| --- | --- |
| `-o <path>` | `build` only: where to write the executable |
| `--release` | optimize the program for speed (described below) |
| `-g` | include debug information for a debugger |
| `--coverage` | record which lines run ([coverage](/docs/stdlib/test#coverage)) |

```sh
nio run --coverage tests/math.nio
nio build -g server.nio -o server
nio build --release server.nio -o server
```

## Two build modes

There are two build modes. One builds faster, and the other produces a faster program:

* **The default build** takes less time to build. It shows the result of a change quickly.
* **A `--release` build** takes more time because it optimizes the whole program. The result runs faster.

The program behaves the same in both modes. Only the speed is different. For small programs, both modes take less than a second, and the difference increases as a program grows. For example, these are the results for the Nio compiler itself:

| | build time | resulting program |
| --- | --- | --- |
| default | **5 s** | about 2× slower |
| `--release` | **34 s** | full speed |

The default build is for development. A `--release` build is for programs that are shipped or measured. `nio package`, which builds an installable application, always uses `--release`.

A `--release` build is also *reproducible*: the same source always produces the same file, byte for byte. A default build is not reproducible, but it behaves the same.

### The build cache

Nio's runtime is the C code that is linked into every program. It is compiled once and used again in later builds, which makes default builds much faster. The compiled runtime is kept in:

| Platform | Location |
|---|---|
| macOS | `~/Library/Application Support/nio/cache` |
| Windows | `%APPDATA%\nio\cache` |
| Linux and others | `$XDG_DATA_HOME/nio/cache`, or `~/.local/share/nio/cache` |

After an upgrade of Nio or clang, Nio starts a new cache automatically and removes the old ones. It is safe to delete the folder at any time. The next build creates again the files that it needs.

## Reading an error

The compiler reports all the errors it finds in one run. Each error shows the code it refers to:

```text
error: cannot use String as int in declaration of "x"
 --> main.nio:2:9
  |
2 | int x = "hello";
  |         ^^^^^^^
note: expected because of this type
 --> main.nio:2:1
  |
2 | int x = "hello";
  | ---
```

The `^^^` marks the code that the error is about. A `note:` shows a second location that explains the error. In this example, it is the type that the value must match. For a type error, the fix is frequently at the second location. The second location can be in a different file.

A `help:` line gives the change that fixes the error:

```text
error: path is a built-in library; import it first: import 'path';
 --> main.nio:4:9
  |
4 | int n = path.join("a", "b");
  |         ^^^^
help: add import 'path';
```

In an editor that uses the [language server](#editor-support), the same fix is available as a quick fix. The compiler gives a fix only when it knows the complete correct change.

## Debugging

Build with `-g` to include debug information. Then run the program with `lldb` or `gdb`:

```sh
nio build -g server.nio -o server
lldb ./server
```

The debugger can set breakpoints on source lines. Functions have their declared names, and a method is `Type.name`. The debugger can examine parameters and local variables, also in `async` functions and across an `await`.

* On macOS, the debug information is in `server.dSYM`, next to the program. The two files must stay together.
* Top-level variables are globals. `target variable` shows them. `frame variable` does not show them.
* A `String`, an array or a record shows as its type name and an address, not its contents. `print` or a conversion to JSON with [`json.toText`](/docs/stdlib/json) shows the contents of a value.
* A default build is better for debugging than a `--release` build. The optimizer in a release build can remove variables (they show as *optimized out*) and change the order of lines. This makes stepping difficult to follow.

Without `-g`, the compiler adds no debug information. With `-g`, the program runs at the same speed.

## Editor support

```sh
nio lsp
```

`nio lsp` is a [language server](https://microsoft.github.io/language-server-protocol/). The editor starts it and communicates with it. It is not started by hand. It uses the same compiler as `nio build`, and it reports the same errors.

In an editor, the language server:

* shows errors during typing, including errors caused by files that are changed but not saved;
* shows the type of an item when the pointer is over it, with the documentation comment above its declaration;
* goes to a declaration with Cmd+click or `F12`, also in another file;
* completes names: `string.` lists the members of the `string` module, and `car.` lists the fields and methods of a record.

**VS Code** needs the extension from the repository. The extension also supplies syntax highlighting:

```sh
./editors/sync.sh
cd editors/vscode && npm install && npm run build
ln -s "$PWD" ~/.vscode/extensions/nio
```

Then run *Developer: Reload Window*. If `nio` is not on the `PATH`, set `nio.server.path` in the settings.

**Neovim, Helix and Zed** need no extension. Add the command to the configuration of the editor:

```lua
-- Neovim
vim.lsp.config.nio = { cmd = { "nio", "lsp" }, filetypes = { "nio" }, root_markers = { ".git" } }
vim.lsp.enable("nio")
```

Syntax highlighting works without the server. It uses a TextMate grammar, which VS Code, JetBrains IDEs and Sublime Text can read. The grammar is in the `editors/` folder of the repository, with instructions for each editor.
