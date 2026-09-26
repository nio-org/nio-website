---
title: "Install Nio"
description: "Install the Nio compiler on macOS, Linux or Windows, build it from source, run your first program, and set up your editor."
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

The script downloads `nio` for your computer, checks that the download is intact, and installs it. On macOS and Linux it goes in `~/.local/bin`. If that folder is not on your `PATH`, the script prints the line to add. On Windows it goes in `%LOCALAPPDATA%\Programs\nio`, and the script adds that folder to your `PATH`.

Prebuilt versions exist for macOS on Apple Silicon, Linux on x86-64 (glibc 2.35 or newer, which means Ubuntu 22.04, Debian 12, RHEL 9 or later), and Windows on x86-64. On any other system, [build Nio from source](#building-from-source).

To install a specific version, set `NIO_VERSION`, for example `NIO_VERSION=v0.1.0`. To install somewhere else, set `NIO_INSTALL`.

> [!NOTE]
>
> If you download the macOS file from the release page in a browser instead, macOS blocks it. Run `xattr -d com.apple.quarantine nio` to allow it. The install script does not have this problem.

## Prerequisites

`nio` uses **clang** to build your programs, so you also need clang on your `PATH`.

* **macOS:** clang comes with the Xcode command line tools. Install them with `xcode-select --install`.
* **Linux:** install clang from your distribution's packages, for example `sudo apt install clang`.
* **Windows:** install [LLVM](https://releases.llvm.org/) (or run `winget install LLVM.LLVM`) and the **Visual Studio Build Tools** with the "Desktop development with C++" workload, which provides the C runtime clang needs. Add `C:\Program Files\LLVM\bin` to your `PATH`. Programs built on Windows always get an `.exe` name.

## Building from source

You only need this if there is no prebuilt version for your system, or if you want to change the compiler. You need clang, as above, and on Windows also Git Bash, which comes with Git for Windows, to run the build script.

The compiler is written in Nio, so you need a Nio compiler to build it. The repository solves this with a copy of the compiler in `bootstrap/`, stored as LLVM IR, which clang can build on its own:

```sh
sh bootstrap/build.sh          # writes ./nio
./nio version
```

That first compiler works, but it is not the fastest one. Use it to build the compiler again, this time optimized:

```sh
./nio build --release src/nio.nio -o nio
```

Put `nio` somewhere on your `PATH`, and every command in this documentation works as written.

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

Flags go **before** the file name. With `run`, everything after the file name is passed to your program, not to the compiler.

| Flag | Effect |
| --- | --- |
| `-o <path>` | `build` only: where to write the executable |
| `--release` | make the program as fast as possible (see below) |
| `-g` | include debug information, so a debugger can read the program |
| `--coverage` | record which lines run ([coverage](/docs/stdlib/test#coverage)) |

```sh
nio run --coverage tests/math.nio
nio build -g server.nio -o server
nio build --release server.nio -o server
```

## Two build modes

There are two ways to build, and they trade build time against speed:

* **The default build** is quick to make, so you can change something and see the result straight away.
* **A `--release` build** takes longer, because it optimizes the whole program, and the result runs faster.

Both run your program the same way; only the speed differs. For small programs, both take under a second, so the difference only matters as a program grows. For example, building the Nio compiler itself:

| | build time | resulting program |
| --- | --- | --- |
| default | **5 s** | about 2× slower |
| `--release` | **34 s** | full speed |

Use the default while you work, and `--release` for anything you ship or measure. `nio package`, which builds an installable application, always uses `--release`.

A `--release` build is also *reproducible*: the same source always produces exactly the same file. A default build is not, although it behaves identically.

### The build cache

Nio's runtime — the C code linked into every program — is compiled once and then reused, which makes default builds much faster. It is kept in:

| Platform | Location |
|---|---|
| macOS | `~/Library/Application Support/nio/cache` |
| Windows | `%APPDATA%\nio\cache` |
| Linux and others | `$XDG_DATA_HOME/nio/cache`, or `~/.local/share/nio/cache` |

Upgrading Nio or clang starts a fresh cache automatically, and old ones are cleaned up. You can delete the folder at any time; the next build recreates what it needs.

## Reading an error

The compiler reports every error it finds at once, each with the code it is about:

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

The `^^^` underlines exactly the code the error is about. A `note:` points at a second place that explains it — here, the type the value had to match. Type errors are usually a disagreement between two places, and the second one is often where the fix belongs. It can even be in another file.

A `help:` line means the compiler knows the exact change that fixes the error:

```text
error: path is a built-in library; import it first: import 'path';
 --> main.nio:4:9
  |
4 | int n = path.join("a", "b");
  |         ^^^^
help: add import 'path';
```

In an editor using the [language server](#editor-support), the same fix is offered as a one-click quick fix. The compiler only offers a fix when it is certain of it.

## Debugging

Build with `-g` to include debug information, then run the program under `lldb` or `gdb`:

```sh
nio build -g server.nio -o server
lldb ./server
```

Breakpoints work on source lines, functions have the names you gave them (a method is `Type.name`), and parameters and local variables can be inspected — including inside `async` functions, across an `await`.

* On macOS the debug information is written to `server.dSYM` next to the program. Keep the two together.
* Top-level variables are globals, so inspect them with `target variable` rather than `frame variable`.
* A `String`, an array or a record shows as its type name and an address, not its contents. To see inside a value, `print` it or turn it into JSON with [`json.toText`](/docs/stdlib/json).
* Debug a default build rather than a `--release` one. The optimizer in a release build can remove variables (they show as *optimized out*) and reorder lines, which makes stepping confusing.

Without `-g`, no debug information is added at all, and with it the program runs just as fast.

## Editor support

```sh
nio lsp
```

`nio lsp` is a [language server](https://microsoft.github.io/language-server-protocol/): your editor starts it and talks to it. You never run it by hand. It is the same compiler as `nio build`, so it reports exactly the same errors.

In an editor it:

* shows errors as you type, including errors caused by files you have changed but not saved;
* shows the type of anything you hover over, with the documentation comment written above its declaration;
* jumps to a declaration with Cmd+click or `F12`, even in another file;
* completes names: `string.` lists what the `string` module offers, and `car.` lists a record's fields and methods.

**VS Code** needs the extension from the repository, which also provides syntax highlighting:

```sh
./editors/sync.sh
cd editors/vscode && npm install && npm run build
ln -s "$PWD" ~/.vscode/extensions/nio
```

Then run *Developer: Reload Window*. If `nio` is not on your `PATH`, set `nio.server.path` in the settings.

**Neovim, Helix and Zed** need nothing installed; add the command to your editor's configuration:

```lua
-- Neovim
vim.lsp.config.nio = { cmd = { "nio", "lsp" }, filetypes = { "nio" }, root_markers = { ".git" } }
vim.lsp.enable("nio")
```

Syntax highlighting works without the server. It comes from a TextMate grammar, which VS Code, JetBrains IDEs and Sublime Text can all read; the `editors/` folder in the repository has it, with instructions for each editor.
