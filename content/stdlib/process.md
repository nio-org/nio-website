---
title: "process module"
description: "The Nio process module reads command-line arguments, sets the exit code, uses standard input and output, and runs other programs."
---

# Process

## Introduction

```nio
import 'process';
```

The `process` module provides command-line arguments, exit codes, standard input and output, and a way to run other programs.

```nio
import 'process';

String[] args = process.getArgs();
if (args.length == 0) {
    process.stderr.write("usage: tool <file>\n");
    process.exit(1);
}
```

## Notes

* `stdout` is the program's normal output. `stderr` is for diagnostics that should stay separate from that output.
* `process.stdout.write` and `process.stderr.write` write text exactly as given and do not add a newline.
* Output is sent on in blocks, and at exit. A program that writes a prompt and then waits for a reply must `flush` first.
* Standard-input reads are fallible and can be handled with `catch`. Reaching the end of input is not an error.
* `process.child.run` starts another program without using a shell. It returns a future so the caller chooses when to wait.

`process.child.run` returns a `process.ChildRunResult`:

| Field | Type | Description |
| --- | --- | --- |
| `stdout` | `byte[]` | Everything the child wrote to standard output. |
| `stderr` | `byte[]` | Everything the child wrote to standard error. |
| `code` | `int` | The child's exit code. |
| `usage` | `process.ChildUsage?` | What the child cost, or `null` where the platform does not report it. |

`process.ChildUsage` is what the operating system charged the child:

| Field | Type | Description |
| --- | --- | --- |
| `peakMemory` | `int` | The most memory it held at once, in bytes. |
| `userTime` | `Duration` | CPU time spent running its own code. |
| `systemTime` | `Duration` | CPU time the system spent on its behalf. |
| `minorFaults` | `int` | Page faults served without a device read. |
| `majorFaults` | `int` | Page faults that needed a read. |
| `blockReads` | `int` | Block input operations. |
| `blockWrites` | `int` | Block output operations. |
| `voluntarySwitches` | `int` | Times it gave up the CPU to wait for something. |
| `involuntarySwitches` | `int` | Times it was taken off the CPU. |

```nio
import 'process';

process.ChildRunResult r = await process.child.run("make", ["all"]);
process.ChildUsage? used = r.usage;
if (used != null) {
    print(used.peakMemory / 1048576, "MB peak,", used.userTime + used.systemTime, "ms of CPU");
}
```

The two times are `Duration`s, so they count milliseconds; a child that used
less than one reports none.

On Linux, `peakMemory` is never less than the memory the parent held when it
started the child, because the kernel charges that memory to the child. To
measure a small program, start it from a small parent.

Its optional third argument is a `process.ChildRunOptions`:

| Field | Type | Description |
| --- | --- | --- |
| `stdin` | `byte[]?` | Bytes provided as the child's standard input. |
| `cwd` | `String?` | Working directory for the child. |
| `env` | `Map<String, String>?` | Environment variables to add or replace. |
| `clearEnv` | `bool?` | Use only `env` instead of inheriting the current environment. |
| `inherit` | `bool?` | Let the child use this process's standard streams. |

## `process.getArgs()`

```nio
String[] process.getArgs()
```

Returns the command-line arguments in order, without the program's own name. A program started without arguments receives an empty array.

Each call returns a new array.

```nio
import 'process';

// $ nio run tool.nio build main.nio
String[] args = process.getArgs();

print(args.length);      // 2
print(args[0]);          // build
print(args[1]);          // main.nio
```

## `process.exit()`

```nio
void process.exit(int code)
```

Ends the program immediately with the given exit code. Code after the call and pending async work do not run.

Use `0` for success and a value from `1` to `255` for failure.

```nio
import 'process';

bool valid = false;

if (!valid) {
    process.stderr.write("invalid input\n");
    process.exit(1);
}

print("ready");
```

## `process.stdout.write()`

```nio
void process.stdout.write(String text)
```

Writes text to standard output without adding a newline.

Use [`string.fromByteArray`](/docs/stdlib/string#stringfrombytearray) to write a byte array.

```nio
import 'process';

process.stdout.write("loading");
process.stdout.write("...\n");
print("done");
```

## `process.stderr.write()`

```nio
void process.stderr.write(String text)
```

Writes text to standard error without adding a newline.

```nio
import 'process';

process.stderr.write("warning: using defaults\n");
print("result");                         // written to stdout
```

## `process.stdout.flush()`

```nio
void process.stdout.flush()
void process.stderr.flush()
```

Sends everything written so far on to whatever the stream is connected to.

Output is normally held back and sent on in blocks — at each newline when the stream is a terminal, and only once several thousand bytes have collected when it is a pipe or a file. This is invisible to a program that runs and ends, because everything left is sent on at exit, in order.

It matters in one case: a program that writes something and then **waits for a reply to it**. Under a pipe the request is still in this program's buffer, so the other side has nothing to answer and both wait forever. Write, flush, then read.

```nio
import 'process';

process.stdout.write("name? ");
process.stdout.flush();                  // without this, nothing is asked
String? answer = process.stdin.readLine() catch null;
```

`process.stderr.flush()` is the same for standard error, which may be held to the end of a line — enough to strand a prompt written without one.

## `process.stdin.read()`

```nio
byte[] process.stdin.read()
```

Reads all remaining standard input as bytes. It returns an empty array when the input has ended and is fallible when the input cannot be read.

The input is consumed by the call.

```nio
import 'process';
import 'string';

byte[] input = process.stdin.read() catch [];
String text = string.fromByteArray(input);

process.stdout.write(string.toUpperCaseAscii(text));
```

## `process.stdin.readBytes()`

```nio
byte[] process.stdin.readBytes(int n)
```

Reads up to `n` bytes. The result is shorter than `n` only when the input ended first, and empty exactly at the end of input — which is how "the stream is finished" is told from "the stream had less than I asked for". A negative `n` is a runtime error, not an `Error`.

Use it for input whose shape is a *count* rather than a delimiter. `read()` consumes everything, and `readLine()` needs a `"\n"`, so neither can read a framed message — one that states its length and then gives that many bytes with nothing between it and the next one.

Because a short read only ever means the input ended, a caller that needs exactly `n` bytes loops:

```nio
import 'process';
import 'array';

byte[] exactly(int n) {
    byte[] out = [];
    while (out.length < n) {
        byte[] chunk = process.stdin.readBytes(n - out.length) catch [];
        if (chunk.length == 0) {
            return out;                  // the input ended early
        }
        forEach(chunk, b) {
            array.push(out, b);
        }
    }
    return out;
}
```

## `process.stdin.readLine()`

```nio
String? process.stdin.readLine()
```

Reads the next line without its line ending. Both LF and CRLF endings are removed. The final line is returned even when it has no line ending.

The result is `null` at the end of input. Reading is fallible, so a loop can handle an error and end-of-input together:

```nio
import 'process';

String? line = process.stdin.readLine() catch null;
while (line != null) {
    process.stdout.write("> " + line + "\n");
    line = process.stdin.readLine() catch null;
}
```

## `process.child.run()`

```nio
Future<process.ChildRunResult!> process.child.run(
    String command,
    String[] args
)

Future<process.ChildRunResult!> process.child.run(
    String command,
    String[] args,
    process.ChildRunOptions options
)
```

Starts another program and returns a future for its result. The command is found through `PATH`, or used as a path when it contains a separator.

Arguments are passed exactly as written. No shell quoting, wildcard expansion, pipes, or redirection is performed.

Failure to start the program is carried by the future, so `catch` belongs on `await`. A program that starts and exits with a nonzero code still returns a normal result; inspect `result.code`.

By default, the child receives empty standard input and its output is collected in the result. The options record can provide input, change its directory or environment, or share this process's streams. With `{ inherit: true }`, the returned `stdout` and `stderr` arrays are empty and any `stdin` option is ignored.

The call returns immediately, so multiple children can be started before they are awaited.

```nio
import 'process';
import 'string';

Future<process.ChildRunResult!> pending = process.child.run(
    "git",
    ["status", "--short"],
    {
        cwd: "project",
        env: { "NO_COLOR": "1" }
    }
);

process.ChildRunResult? result = await pending catch e {
    process.stderr.write(e.message + "\n");
};

if (result != null) {
    process.stdout.write(string.fromByteArray(result.stdout));
    if (result.code != 0) {
        process.stderr.write(string.fromByteArray(result.stderr));
    }
}
```
