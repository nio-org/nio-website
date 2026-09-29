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
* `process.stdout.write` and `process.stderr.write` write the text as given. They do not add a newline.
* Output is buffered. It is written in blocks, and the remaining output is written when the program exits. A program that writes a prompt and then waits for a reply must call `flush` first.
* Standard-input reads are fallible. `catch` handles their errors. The end of input is not an error.
* `process.child.run` starts another program without a shell. It returns a future. The caller selects when to wait.

`process.child.run` returns a `process.ChildRunResult`:

| Field | Type | Description |
| --- | --- | --- |
| `stdout` | `byte[]` | Everything the child wrote to standard output. |
| `stderr` | `byte[]` | Everything the child wrote to standard error. |
| `code` | `int` | The child's exit code. |
| `usage` | `process.ChildUsage?` | The resources that the child used, or `null` if the platform does not report them. |

`process.ChildUsage` holds the resource usage that the operating system recorded for the child:

| Field | Type | Description |
| --- | --- | --- |
| `peakMemory` | `int` | The maximum memory that the child used at one time, in bytes. |
| `userTime` | `Duration` | CPU time used to run the child's own code. |
| `systemTime` | `Duration` | CPU time that the system used for the child. |
| `minorFaults` | `int` | Page faults resolved without a read from a device. |
| `majorFaults` | `int` | Page faults that needed a read from a device. |
| `blockReads` | `int` | Block input operations. |
| `blockWrites` | `int` | Block output operations. |
| `voluntarySwitches` | `int` | Voluntary context switches: the child released the CPU to wait for a resource. |
| `involuntarySwitches` | `int` | Involuntary context switches: the system preempted the child. |

```nio
import 'process';

process.ChildRunResult r = await process.child.run("make", ["all"]);
process.ChildUsage? used = r.usage;
if (used != null) {
    print(used.peakMemory / 1048576, "MB peak,", used.userTime + used.systemTime, "ms of CPU");
}
```

The two times are `Duration` values, in milliseconds. A child that used less
than one millisecond reports `0`.

On Linux, `peakMemory` is never less than the memory that the parent used when
it started the child, because the kernel counts that memory as the child's
usage. For a useful measurement of a small program, its parent must use little
memory.

The optional third argument of `process.child.run` is a `process.ChildRunOptions`:

| Field | Type | Description |
| --- | --- | --- |
| `stdin` | `byte[]?` | Bytes to give to the child as its standard input. |
| `cwd` | `String?` | Working directory for the child. |
| `env` | `Map<String, String>?` | Environment variables to add or replace. |
| `clearEnv` | `bool?` | The child gets only `env`. It does not inherit the current environment. |
| `inherit` | `bool?` | The child uses this process's standard streams. |

## `process.getArgs()`

```nio
String[] process.getArgs()
```

Returns the command-line arguments in order, without the program's own name. If there are no arguments, the result is an empty array.

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

`0` means success. A value from `1` to `255` means failure.

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

To write a byte array, a program converts it with [`string.fromByteArray`](/docs/stdlib/string#stringfrombytearray) first.

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

Writes all buffered output of the stream to the terminal, pipe or file that the stream is connected to.

Output is usually buffered and written in blocks. When the stream is a terminal, output is written at each newline. When the stream is a pipe or a file, output is written only after several thousand bytes collect. When the program exits, all remaining output is written, in order.

A program that writes a request and then **waits for a reply** must flush the stream. With a pipe, the request stays in the buffer of this program. The other program cannot reply, and both programs wait forever. The correct sequence is write, flush, then read.

```nio
import 'process';

process.stdout.write("name? ");
process.stdout.flush();                  // without this, nothing is asked
String? answer = process.stdin.readLine() catch null;
```

`process.stderr.flush()` does the same for standard error. Standard error can be buffered until the end of a line. A prompt without a newline may not appear until the flush.

## `process.stdin.read()`

```nio
byte[] process.stdin.read()
```

Reads all remaining standard input as bytes. It returns an empty array when the input has ended. It is fallible: it fails when the input cannot be read.

The call consumes the input.

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

Reads up to `n` bytes. The result is shorter than `n` only when the input ended first. The result is empty if, and only if, the input has ended. Because of this, an empty result means that the stream is finished. A short result does not. A negative `n` is a runtime error, not an `Error`.

It is for input that is divided by a byte *count*, not by a delimiter. `read()` reads all of the input, and `readLine()` needs a `"\n"`. Neither can read a framed message. A framed message states its length and then holds that number of bytes, with no delimiter before the next message.

A short read occurs only when the input ended. A caller that needs all `n` bytes must read in a loop:

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

The result is `null` at the end of input. Reading is fallible. A loop can handle an error and end-of-input together:

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

Starts another program and returns a future for its result. The command is found through `PATH`. If the command contains a path separator, it is used as a path.

Arguments are passed as written. There is no shell quoting, wildcard expansion, pipe or redirection.

If the program cannot start, the future holds the error. The `catch` goes on the `await`. A program that starts and exits with a nonzero code returns a normal result. `result.code` holds the exit code.

By default, the child gets empty standard input, and its output is collected in the result. The options record can give input, change the child's directory or environment, or share the streams of this process. With `{ inherit: true }`, the returned `stdout` and `stderr` arrays are empty and any `stdin` option is ignored.

The call returns immediately. A program can start more than one child before it awaits them.

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
