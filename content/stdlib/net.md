---
title: "net module: TCP, UDP and Unix sockets"
description: "The Nio net module opens TCP, UDP and Unix domain sockets, accepts connections, and reads and writes over them without blocking."
---

# Net

## Introduction

```nio
import 'net';
```

The `net` module opens network connections — TCP, UDP, and Unix domain sockets — and reads and writes over them.

Anything that might have to wait returns a future, so one program can serve many connections at once without threads. See [Async and futures](/docs/async) for how futures and `await` work.

This small server answers every connection with what it received:

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

At the top level there is no function to `return` from, so `catch null` is used there: if listening fails, `l` is simply `null`.

## Notes

The module works with two types:

| Type | What it is |
| --- | --- |
| `Listener` | Something connections arrive on. Made by `net.tcp.listen` or `net.unix.listen`. |
| `Socket` | Something bytes go through: an accepted or connected stream, or a bound UDP socket. |

Both are built-in type names, like `String`, so you can declare a variable of either type without an import. Both stand for a connection the operating system owns, not for data, so they cannot be printed, compared with `==`, turned into JSON, or used as a map key. You can still store them in variables, records, arrays and maps, and pass them around like any other value.

* In the signatures below, `options?` marks an argument you can leave off. See [`net.Options`](#netoptions) for what it holds.
* Addresses are written `"host:port"`. For an IPv6 address, put the host in brackets: `"[::1]:8080"`. An empty host, as in `":8080"`, means every network interface. Unix sockets take a file path instead.
* **Port `0` asks the operating system to pick a free port.** `net.address` then tells you which one you got. This is the easy way for a test to get a port without guessing one.
* `net.read` returns *up to* the number of bytes you ask for. Getting fewer is normal. Getting **none** means the other side closed the connection.
* `net.write` finishes only when every byte has been sent.
* A socket can have one read and one write in progress at a time. Starting a second read (or write) on the same socket is an error.
* Host names are looked up synchronously, once per connection.
* A socket you stop using is closed by the garbage collector eventually, but call `net.close` to close it at a known moment.
* To wait for a socket *or* something else, such as a timer, use [`async.race`](/docs/stdlib/async#asyncrace). For a plain timeout, the `timeout` option is simpler.

Every function except `net.close` can fail. The ones that answer straight away fail at the call; the ones that wait fail at the `await`. The error's `code` is one of these `net.ErrorCode` values (the same shared error codes that [`fs`](/docs/stdlib/fs) and others use):

| Code | Meaning |
| --- | --- |
| `CONNECTION_REFUSED` | Nothing is listening at that address. |
| `CONNECTION_RESET` | The other side dropped the connection. |
| `CONNECTION_ABORTED` | The connection was abandoned before it was set up. |
| `NOT_CONNECTED` | The socket is closed, or was never connected. |
| `ADDRESS_IN_USE` | Something else is already using that address. |
| `ADDRESS_NOT_AVAILABLE` | That address does not belong to this machine. |
| `NETWORK_UNREACHABLE` | There is no route to that network. |
| `HOST_UNREACHABLE` | There is no route to that host. |
| `BROKEN_PIPE` | You wrote to a connection the other side has closed. |
| `MESSAGE_TOO_LONG` | The UDP message is too large to send. |
| `TIMED_OUT` | The `timeout` option ran out. |
| `INVALID` | A badly written address, or a TCP call on a UDP socket (or the other way round). |

## `net.tcp.listen()`

```nio
Listener net.tcp.listen(String addr, net.Options options?)
```

Starts listening for TCP connections on `addr`. It fails if the address is already in use or cannot be used.

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

Connects to a TCP server. If the connection fails, the error arrives at the `await`.

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

Creates a UDP socket on `addr`. UDP has no connections, so there is nothing to accept or connect to: use `net.receive` and `net.send` with it.

## `net.unix.listen()`

```nio
Listener net.unix.listen(String path, net.Options options?)
```

The same as [`net.tcp.listen`](#nettcplisten), but over a Unix domain socket, whose address is a file path.

Closing a Unix listener with `net.close` deletes its file, so the server can be started again later. `net.unix.listen` does **not** delete a file that is already there, because it might belong to a server that is still running.

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
> Unix sockets are not available on Windows yet: both `net.unix.listen` and `net.unix.connect` fail with `INVALID` there. A program that must run everywhere can use a TCP port on `127.0.0.1` instead.

## `net.unix.connect()`

```nio
Future<Socket!> net.unix.connect(String path, net.Options options?)
```

The same as [`net.tcp.connect`](#nettcpconnect), but over a Unix domain socket, whose address is a file path. It fails with `INVALID` on Windows, as the [note above](#netunixlisten) says.

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

Reads up to `n` bytes. An empty result means the other side closed the connection.

## `net.readExactly()`

```nio
Future<byte[]!> net.readExactly(Socket s, int n, net.Options options?)
```

Reads exactly `n` bytes, waiting for as many pieces as it takes. If the other side closes before sending them all, it fails with `END_OF_FILE`. A `timeout` in the options covers the whole read.

This is the call you want when a protocol tells you a length up front — a message behind its size field, an HTTP body behind its `Content-Length` — because it saves writing a loop that joins the pieces together.

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

Sends every byte of `data`.

## `net.receive()`

```nio
Future<net.Datagram!> net.receive(Socket s, int n, net.Options options?)
```

Waits for one UDP message of up to `n` bytes, and returns it together with the address it came from.

## `net.send()`

```nio
Future<void!> net.send(Socket s, String addr, byte[] data, net.Options options?)
```

Sends one UDP message to `addr`. A message is sent whole or not at all.

This UDP server sends every message back to whoever sent it:

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

Closes a socket or a listener. It never fails, and closing twice is safe. Anything still waiting on the socket fails with `NOT_CONNECTED`.

## `net.address()`

```nio
String net.address(Socket s)
String net.address(Listener l)
```

Returns the address this end is using. It is written in the same `"host:port"` form the other functions accept. After a listen on port `0`, this is how you learn the port you got.

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

The last argument of most functions in this module is an optional record of settings. Each function reads the fields that make sense for it and ignores the rest.

| Field | Type | Used by |
| --- | --- | --- |
| `timeout` | `Duration?` | `connect`, `accept`, `read`, `readExactly`, `write`, `receive`, `send` |
| `backlog` | `int?` | `tcp.listen`, `unix.listen`: how many waiting connections the system keeps. Default 128. |
| `noDelay` | `bool?` | `tcp.connect`, `accept`: sends small writes immediately instead of batching them (`TCP_NODELAY`). |

A plain number written for `timeout` means milliseconds, so `{ timeout: 5000 }` is five seconds. An operation that runs out of time fails with `TIMED_OUT` and is cancelled cleanly.

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

What `net.receive` returns: one UDP message.

| Field | Type | Description |
| --- | --- | --- |
| `address` | `String` | Who sent it, in the form `net.send` accepts. |
| `data` | `byte[]` | The message itself. |
