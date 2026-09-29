---
title: "net module: TCP, UDP and Unix sockets"
description: "The Nio net module opens TCP, UDP and Unix domain sockets, accepts connections, and reads and writes over them without blocking."
---

# Net

## Introduction

```nio
import 'net';
```

The `net` module opens network connections (TCP, UDP and Unix domain sockets) and reads and writes data over them.

Each function that can wait returns a future. As a result, one program can serve many connections at the same time without threads. [Async and futures](/docs/async) describes how futures and `await` work.

This server sends back the data that it receives on each connection:

```nio
import 'net';
import 'async';
import 'string';

void async serve(Listener l) {
    while (true) {
        Socket c = await net.accept(l) catch e { return; };
        byte[] request = await net.read(c, 4096, { timeout: 30000 }) catch e {
            net.close(c);
            continue;
        };
        String text = string.fromByteArray(request);
        await net.write(c, string.toByteArray("you said: " + text)) catch e { };
        net.close(c);
    }
}

Listener? l = net.tcp.listen("127.0.0.1:8080") catch null;
if (l == null) {
    print("cannot listen");
} else {
    print("listening on " + (net.address(l) catch "?"));   // listening on 127.0.0.1:8080
    async.run(serve(l), void () -> { });
}
```

The top-level code is not in a function and cannot use `return`. It uses `catch null` instead. If the listen fails, `l` is `null`.

## Notes

The module uses two types:

| Type | What it is |
| --- | --- |
| `Listener` | Accepts incoming connections. Made by `net.tcp.listen` or `net.unix.listen`. |
| `Socket` | Sends and receives bytes: an accepted or connected stream, or a bound UDP socket. |

Both are built-in type names, like `String`. A program can declare a variable of either type without an import. Each one stands for a connection that the operating system owns, not for data. As a result, a program cannot print them, compare them with `==`, convert them to JSON or use them as map keys. A program can store them in variables, records, arrays and maps, and pass them as arguments like other values.

* In the signatures below, `options?` marks an argument that a caller can omit. [`net.Options`](#netoptions) lists its fields.
* Addresses are written `"host:port"`. An IPv6 host is written in brackets: `"[::1]:8080"`. An empty host, as in `":8080"`, means all network interfaces. Unix sockets use a file path.
* **Port `0` tells the operating system to select a free port.** `net.address` then returns the port. Tests can use this to get a free port.
* `net.read` returns *up to* the requested number of bytes. Fewer bytes is normal. **No** bytes means that the other side closed the connection.
* `net.write` completes only when all bytes are sent.
* A socket can have one read and one write in progress at a time. A second read, or a second write, on the same socket at the same time is an error.
* Host names are looked up synchronously, once for each connection.
* The garbage collector eventually closes a socket that is no longer used. `net.close` closes it at a known time.
* [`async.race`](/docs/stdlib/async#asyncrace) waits for a socket *or* for another event, such as a timer. For a timeout only, the `timeout` option is sufficient.

All functions except `net.close` can fail. A function that returns its result immediately fails at the call. A function that returns a future fails at the `await`. The error's `code` is one of these `net.ErrorCode` values. They are the shared error codes that [`fs`](/docs/stdlib/fs) and other modules also use:

| Code | Meaning |
| --- | --- |
| `CONNECTION_REFUSED` | Nothing is listening at that address. |
| `CONNECTION_RESET` | The other side reset the connection. |
| `CONNECTION_ABORTED` | The connection was aborted before it was set up. |
| `NOT_CONNECTED` | The socket is closed, or was never connected. |
| `ADDRESS_IN_USE` | Another socket already uses that address. |
| `ADDRESS_NOT_AVAILABLE` | That address does not belong to this machine. |
| `NETWORK_UNREACHABLE` | There is no route to that network. |
| `HOST_UNREACHABLE` | There is no route to that host. |
| `BROKEN_PIPE` | The program wrote to a connection that the other side has closed. |
| `MESSAGE_TOO_LONG` | The UDP message is too large to send. |
| `TIMED_OUT` | The time set by the `timeout` option expired. |
| `INVALID` | An incorrectly written address, or a TCP call on a UDP socket (or the reverse). |

## `net.tcp.listen()`

```nio
Listener net.tcp.listen(String addr, net.Options options?)
```

Starts to listen for TCP connections on `addr`. It fails if the address is already in use or is not usable.

```nio
import 'net';

Listener? l = net.tcp.listen("127.0.0.1:0") catch null;
if (l != null) {
    print(net.address(l) catch "?");     // 127.0.0.1:52811 (a free port)
    net.close(l);
}
```

## `net.tcp.connect()`

```nio
Future<Socket!> net.tcp.connect(String addr, net.Options options?)
```

Connects to a TCP server. If the connection fails, the error occurs at the `await`.

```nio
import 'net';

void async ping() {
    Socket s = await net.tcp.connect("127.0.0.1:8080", { timeout: 5000 }) catch e {
        print("cannot connect: " + e.message);
        return;
    };
    net.close(s);
}
```

## `net.udp.bind()`

```nio
Socket net.udp.bind(String addr)
```

Creates a UDP socket on `addr`. UDP has no connections. A UDP socket cannot accept or connect. `net.receive` and `net.send` operate on the socket.

## `net.unix.listen()`

```nio
Listener net.unix.listen(String path, net.Options options?)
```

The same as [`net.tcp.listen`](#nettcplisten), but over a Unix domain socket. The address is a file path.

When `net.close` closes a Unix listener, it deletes the listener's file. This lets the server start again later. `net.unix.listen` does **not** delete a file that already exists, because the file can belong to a server that is still running.

```nio
import 'net';

Listener? l = net.unix.listen("/tmp/demo.sock") catch null;
if (l != null) {
    print(net.address(l) catch "?");     // /tmp/demo.sock
    net.close(l);                        // also deletes /tmp/demo.sock
}
```

> [!NOTE]
>
> Unix sockets are not available on Windows. On Windows, `net.unix.listen` and `net.unix.connect` fail with `INVALID`. A program that must run on all platforms can use a TCP port on `127.0.0.1`.

## `net.unix.connect()`

```nio
Future<Socket!> net.unix.connect(String path, net.Options options?)
```

The same as [`net.tcp.connect`](#nettcpconnect), but over a Unix domain socket. The address is a file path. It fails with `INVALID` on Windows (see the [note above](#netunixlisten)).

```nio
import 'net';

void async ping() {
    Socket s = await net.unix.connect("/tmp/demo.sock", { timeout: 5000 }) catch e {
        print("cannot connect: " + e.message);
        return;
    };
    net.close(s);
}
```

## `net.accept()`

```nio
Future<Socket!> net.accept(Listener l, net.Options options?)
```

Waits for the next connection on `l` and returns its socket.

## `net.read()`

```nio
Future<byte[]!> net.read(Socket s, int n, net.Options options?)
```

Reads up to `n` bytes. An empty result means that the other side closed the connection.

## `net.readExactly()`

```nio
Future<byte[]!> net.readExactly(Socket s, int n, net.Options options?)
```

Reads exactly `n` bytes. It waits for as many pieces as necessary. If the other side closes the connection before it sends all bytes, the read fails with `END_OF_FILE`. A `timeout` in the options applies to the complete read.

It is for a protocol that sends a length before the data, for example a message after its size field, or an HTTP body after its `Content-Length`. No loop is necessary to join the pieces.

```nio
import 'net';

void async readMessage(Socket s) {
    byte[] header = await net.readExactly(s, 4) catch e { return; };
    int size = header[0] * 16777216 + header[1] * 65536 + header[2] * 256 + header[3];
    byte[] body = await net.readExactly(s, size) catch e { return; };
    print(body.length);
}
```

## `net.write()`

```nio
Future<void!> net.write(Socket s, byte[] data, net.Options options?)
```

Sends all bytes of `data`.

## `net.receive()`

```nio
Future<net.Datagram!> net.receive(Socket s, int n, net.Options options?)
```

Waits for one UDP message of up to `n` bytes, and returns it with the address of the sender.

## `net.send()`

```nio
Future<void!> net.send(Socket s, String addr, byte[] data, net.Options options?)
```

Sends one UDP message to `addr`. The message is sent complete or not at all.

This UDP server sends each message back to its sender:

```nio
import 'net';

void async echo() {
    Socket s = net.udp.bind("127.0.0.1:9000") catch e { return; };
    while (true) {
        net.Datagram d = await net.receive(s, 2048) catch e { return; };
        await net.send(s, d.address, d.data) catch e { };
    }
}
```

## `net.close()`

```nio
void net.close(Socket s)
void net.close(Listener l)
```

Closes a socket or a listener. It never fails, and it is safe to close a socket two times. Any operation that waits on the socket fails with `NOT_CONNECTED`.

## `net.address()`

```nio
String net.address(Socket s)
String net.address(Listener l)
```

Returns the local address of the socket or the listener, in the same `"host:port"` form that the other functions accept. After a listen on port `0`, the address that it returns contains the selected port number.

```nio
import 'net';

Listener? l = net.tcp.listen("127.0.0.1:0") catch null;
if (l != null) {
    print(net.address(l) catch "?");     // 127.0.0.1:52811 (a free port)
    net.close(l);
}
```

## `net.peer()`

```nio
String net.peer(Socket s)
```

Returns the address of the other end, in the same form as [`net.address`](#netaddress).

```nio
import 'net';
import 'async';

void async demo() {
    Listener l = net.tcp.listen("127.0.0.1:0") catch e { return; };
    String addr = net.address(l) catch e { return; };
    Socket client = await net.tcp.connect(addr) catch e { return; };
    Socket server = await net.accept(l) catch e { return; };
    print(net.peer(client) catch "?");   // 127.0.0.1:52811 (the listener's address)
    print(net.peer(server) catch "?");   // 127.0.0.1:52812 (the client's own address)
    net.close(client);
    net.close(server);
    net.close(l);
}

async.run(demo(), void () -> { });
```

## `net.Options`

The last argument of most functions in this module is an optional record of settings. Each function reads the fields that apply to it and ignores the other fields.

| Field | Type | Used by |
| --- | --- | --- |
| `timeout` | `Duration?` | `connect`, `accept`, `read`, `readExactly`, `write`, `receive`, `send` |
| `backlog` | `int?` | `tcp.listen`, `unix.listen`: the number of pending connections that the system keeps in its queue. Default 128. |
| `noDelay` | `bool?` | `tcp.connect`, `accept`: sends small writes immediately and does not batch them (`TCP_NODELAY`). |

A plain number for `timeout` means milliseconds. For example, `{ timeout: 5000 }` is five seconds. An operation that does not complete in time fails with `TIMED_OUT` and is cancelled.

```nio
import 'net';

void async readReply(Socket s) {
    byte[] b = await net.read(s, 4096, { timeout: 5000 }) catch e {
        if (e.code == net.ErrorCode.TIMED_OUT) {
            print("no reply in five seconds");
        }
        return;
    };
    print(b.length);
}
```

## `net.Datagram`

The value that `net.receive` returns: one UDP message.

| Field | Type | Description |
| --- | --- | --- |
| `address` | `String` | The address of the sender, in the form that `net.send` accepts. |
| `data` | `byte[]` | The message. |
