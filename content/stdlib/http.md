---
title: "http module: HTTP server and client"
description: "The Nio http module runs HTTP/1.1 servers with routing and streaming bodies, and makes HTTP and HTTPS requests."
---

# HTTP

## Introduction

```nio
import 'http';
```

The `http` module runs HTTP/1.1 servers and makes HTTP requests. The client can also make HTTPS requests. It is built on [`net`](/docs/stdlib/net) and [`tls`](/docs/stdlib/tls), and it is written in Nio itself.

A small server with three routes:

```nio
import 'http';
import 'string';

http.Response showUser(http.Request req) {
    return http.text(200, "user " + string.from(req.params["id"]));
}

http.Server s = http.server();
s.route(http.Method.GET, "/", http.Response (http.Request r) -> http.text(200, "hello"));
s.route(http.Method.GET, "/users/:id", http.Response (http.Request r) -> showUser(r));
s.route(http.Method.GET, "*", http.Response (http.Request r) -> http.text(404, "not found"));

await s.listen("0.0.0.0", 8080, null) catch e {
    print("cannot listen: " + e.message);
};
```

The last line keeps the program running and serving requests until the server stops.

## Notes

* **The client speaks HTTPS; the server does not.** A request to an `https://` URL is encrypted and the server's certificate is checked. The server only speaks plain HTTP, so to serve HTTPS, put it behind a proxy such as nginx or Caddy that handles the encryption — the usual way to deploy a web service anyway.
* **Only HTTP/1.1.** There is no HTTP/2 and no WebSocket support.
* **A server uses one CPU core.** Requests take turns at every `await`, as described in [Async and futures](/docs/async).
* **Bodies can be streamed** in every direction, so a large upload, a download, or a never-ending event stream never has to be held in memory whole. See [`http.stream()`](#httpstream), [`ClientResponse`](#httpclientresponse) and [`Server.routeStream()`](#serverroutestream).
* **Header names are case-insensitive**, so use `http.getHeader` and `http.setHeader` rather than indexing the map with a name you typed.
* **The server has fixed limits**, so one bad client cannot exhaust it:

| Limit | Value |
| --- | --- |
| One line (the request line, the status line, or a header) | 8 KB |
| The whole header block | 64 KB |
| Number of headers | 100 |
| Body the server reads before calling a handler | 10 MB, or `Options.maxBody` |
| Body the client holds | no limit, unless you set `ClientOptions.maxBody` |

A request that is too large gets a `413` answer, and a malformed one a `400`, before any of your code runs.

Requests and parsing functions can fail. The error's `code` is one of these `http.ErrorCode` values:

| Code | Meaning |
| --- | --- |
| `MALFORMED_REQUEST` | The request, URL or query could not be read. |
| `MALFORMED_RESPONSE` | The server's answer could not be read. |
| `TOO_LARGE` | Something was larger than one of the limits above. |
| `UNSUPPORTED_SCHEME` | The URL starts with neither `http://` nor `https://`. |
| `TOO_MANY_REDIRECTS` | More than five redirects in a row. |

A network failure underneath, such as a refused connection, keeps its [`net`](/docs/stdlib/net) error code, and a certificate problem on an HTTPS request keeps its [`tls`](/docs/stdlib/tls) or [`x509`](/docs/stdlib/x509) code. That way your program can tell "the certificate expired" from "nobody answered". The four sets of codes never overlap.

## `http.server()`

```nio
http.Server http.server()
```

Creates a server with no routes. A server is an ordinary value, so one program can run several — for example a public port and an admin port.

## `Server.route()`

```nio
void s.route(http.Method m, http.Pattern p, http.ResponseFunction handler)
```

Adds a route: requests with method `m` whose path matches `p` are answered by `handler`. The methods are `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD` and `OPTIONS`.

A pattern is a path split on `/`, and each part is one of these:

| Part | Matches |
| --- | --- |
| `users` | exactly that text |
| `:id` | any single part, which the handler reads as `req.params["id"]` |
| `*` | this part and everything after it |

**The first matching route wins**, so register a catch-all such as `*` last. A request that matches no route gets `404 not found`.

A handler is a function that takes an `http.Request` and returns an `http.Response`:

```nio
import 'http';

http.Server s = http.server();
s.route(http.Method.GET, "/", http.Response (http.Request r) -> http.text(200, "hello"));
```

A handler that needs to wait for something — a database, another HTTP service — is an `async` function instead, and returns a future of a response:

```nio
import 'http';

http.Response async proxy(http.Request req) {
    http.ClientResponse r = await http.request(http.Method.GET, "http://localhost:9000/x", null)
        catch e { return http.text(502, "bad gateway"); };
    byte[] body = await r.bytes() catch e { return http.text(502, "bad gateway"); };
    return http.bytes(r.status, body);
}

http.Server s = http.server();
s.route(http.Method.GET, "/proxy", Future<http.Response> (http.Request r) -> proxy(r));
```

You can mix both kinds of handler in one server; `route` accepts either.

* If an ordinary handler fails with an error, the server answers `500` without sending the error's details to the client.
* An `async` handler cannot fail: catch errors inside it and choose the status to answer with yourself, as `proxy` does above.

Instead of a text pattern, you can pass a compiled [`RegExp`](/docs/stdlib/regexp), which must match the whole path. Text patterns are faster, so use a regular expression only when you need one. A regular expression route sets no `req.params`.

```nio
import 'http';
import 'regexp';

http.Server s = http.server();
RegExp digits = regexp.create("^/item/[0-9]+$");
s.route(http.Method.GET, digits, http.Response (http.Request r) -> http.text(200, "numeric"));
```

## `Server.routeStream()`

```nio
void s.routeStream(http.Method m, http.Pattern p, http.ResponseFunction handler)
```

Like `route`, except that the server does **not** read the request body before calling the handler. The handler reads it piece by piece instead, with `req.read()`, which returns the next piece, and an empty array when the body has ended. Use it for large uploads that should not be held in memory.

```nio
import 'http';
import 'string';

http.Response async count(http.Request r) {
    int n = 0;
    while (true) {
        byte[] piece = await r.read() catch e { return http.text(400, e.message); };
        if (piece.length == 0) {
            break;
        }
        n = n + piece.length;
    }
    return http.text(200, "received " + string.from(n) + " bytes");
}

http.Server s = http.server();
s.routeStream(http.Method.POST, "/upload", Future<http.Response> (http.Request r) -> count(r));
```

On an ordinary route, `req.read()` returns the whole body once, so a handler written with `read` works on both kinds of route.

Streaming is not the default because reading a body means waiting, and only a named `async` function can wait. Making every route stream would stop you writing short handlers inline, as in the `route` examples.

If a streaming handler answers without reading the whole body, the server reads and throws away up to 256 KB of what is left, so the connection can be reused. Past that it closes the connection instead. Before it closes, it keeps reading and throwing away for up to 500 ms, so the client can read the response before the connection is torn down.

## `Server.listen()`

```nio
Future<void!> s.listen(String host, int port, http.Options? options)
```

Starts the server on `host` and `port` and handles requests until it is closed. It fails if the address cannot be used. Pass `null` for the options to use the defaults.

`http.Options` has three fields, all optional:

| Field | Type | Description |
| --- | --- | --- |
| `timeout` | `Duration?` | How long to wait on a slow client. |
| `backlog` | `int?` | How many waiting connections the system keeps. |
| `maxBody` | `int?` | The largest request body the server reads, in bytes. Default 10 MB. |

```nio
import 'http';

http.Server s = http.server();
http.Options o = { backlog: 256, maxBody: 1048576 };
await s.listen("0.0.0.0", 8080, o) catch e {
    print(e.message);
};
```

Host and port are separate arguments, so an IPv6 address needs no brackets: `s.listen("::1", 8080, null)`.

## `Server.bind()`

```nio
int s.bind(String host, int port, http.Options? options)
```

Starts listening on `host` and `port`, and returns the port it got. It takes the same options as [`listen`](#serverlisten), and fails if the address cannot be used. It does not handle requests: call [`serve`](#serverserve) for that.

`listen` is `bind` followed by `serve`. Call them separately when you need to know the port before the server starts handling requests — for example in a test, where port `0` asks the system for any free port:

```nio
import 'http';
import 'async';
import 'string';

void async background(http.Server s) {
    await s.serve() catch e { };
}

http.Server s = http.server();
int port = s.bind("127.0.0.1", 0, null);
async.run(background(s), void () -> { });
print("listening on " + string.from(port));
```

## `Server.serve()`

```nio
Future<void!> s.serve()
```

Handles requests until the server is closed. Call [`bind`](#serverbind) first; the example there shows the two together.

## `Server.port()`

```nio
int s.port()
```

Returns the port the server is bound to. After a bind to port `0`, this is the port the system picked.

```nio
import 'http';
import 'string';

http.Server s = http.server();
s.bind("127.0.0.1", 0, null);
print("port " + string.from(s.port()));        // port 52811 (a free port)
s.close();
```

## `Server.close()`

```nio
void s.close()
```

Stops the server.

## `http.Request`

What a handler receives.

```nio
type Request {
    http.Method method;
    String path;                        // percent-decoded
    String query;                       // not decoded: pass it to http.parseQuery
    Map<String, String> headers;        // names in lower case
    Map<String, String> params;         // set by ":name" parts of the pattern
    byte[] body;                        // empty on a streaming route
    String peer;                        // the client's address
    Function()<Future<byte[]!>> read;   // the body in pieces
    int? maxBody;

    byte[] async bytes();               // the whole body
    String async text();                // the whole body, as text
}
```

`query` is left encoded on purpose: decoding it before splitting it into parameters would lose the difference between a real `&` and an encoded one. `http.parseQuery` does both steps in the right order.

## `http.Response`

What a handler returns.

```nio
type Response {
    int status;
    Map<String, String> headers;
    byte[] body;
    BodyStream? stream;                 // set by http.stream
}
```

These functions build a response:

| Function | Response |
| --- | --- |
| [`http.text`](#httptext) | a `text/plain` body |
| [`http.json`](#httpjson) | an `application/json` body; build the text with `json.toText` |
| [`http.bytes`](#httpbytes) | a raw body with no content type |
| [`http.redirect`](#httpredirect) | an empty body with a `Location` header |
| [`http.stream`](#httpstream) | a body written in pieces |

A response is a record, so you can change it before returning it. The server adds `Content-Length` for you.

```nio
import 'http';
import 'json';

type User {
    String id;
    String name;
}

http.Response showUser(http.Request req) {
    User u = { id: "42", name: "ada" };
    http.Response res = http.json(200, json.toText(u));
    http.setHeader(res.headers, "cache-control", "no-store");
    return res;
}
```

## `http.text()`

```nio
http.Response http.text(int status, String body)
```

Returns a response with `status` and a `text/plain` body. See [`http.Response`](#httpresponse) for what a response holds.

```nio
import 'http';

http.Response r = http.text(200, "hello");
print(r.status);                               // 200
print(r.headers["content-type"]);              // text/plain; charset=utf-8
print(r.body.length);                          // 5
```

## `http.json()`

```nio
http.Response http.json(int status, String encoded)
```

Returns a response with `status` and an `application/json` body. `encoded` is JSON text that is already encoded: build it with `json.toText`.

```nio
import 'http';
import 'json';

type Point {
    int x;
    int y;
}

Point p = { x: 1, y: 2 };
http.Response r = http.json(200, json.toText(p));
print(r.headers["content-type"]);              // application/json
```

## `http.bytes()`

```nio
http.Response http.bytes(int status, byte[] body)
```

Returns a response with `status` and a raw body with no content type. Set one with `http.setHeader` when it matters.

```nio
import 'http';

byte[] data = [137, 80, 78, 71];
http.Response r = http.bytes(200, data);
http.setHeader(r.headers, "Content-Type", "image/png");
print(r.body.length);                          // 4
```

## `http.redirect()`

```nio
http.Response http.redirect(int status, String location)
```

Returns a redirect: a response with `status`, an empty body and a `Location` header that holds `location`.

```nio
import 'http';

http.Server s = http.server();
s.route(http.Method.GET, "/old", http.Response (http.Request r) -> http.redirect(301, "/new"));
```

## `http.stream()`

```nio
http.Response http.stream(int status, http.BodyStream produce)
```

A response whose body is written in pieces. `produce` is a function the server calls again and again: it returns the next piece of the body, or an empty array when the body is complete.

```nio
import 'http';
import 'string';

type Ticks {
    int left;

    byte[] async next() {
        if (self.left == 0) {
            return [];                          // the body ends here
        }
        self.left = self.left - 1;
        return string.toByteArray("tick " + string.from(self.left) + "\n");
    }
}

http.Server s = http.server();
s.route(http.Method.GET, "/events", http.Response (http.Request r) -> {
    Ticks t = { left: 3 };
    http.Response out = http.stream(200, Future<byte[]> () -> t.next());
    http.setHeader(out.headers, "content-type", "text/event-stream");
    return out;
});
```

A few things to know:

* The body's length is unknown when the headers are sent, so the response is sent in chunks and any `Content-Length` you set is dropped.
* A producer that never returns an empty array makes a response that never ends — which is exactly what server-sent events are.
* The producer can be one that fails (`Future<byte[]!>`) or one that cannot (`Future<byte[]>`). If it fails part-way through, the status has already been sent, so the server closes the connection to tell the client the body is incomplete.
* For a `HEAD` request, only the headers are sent and the producer is never called.

Because a client response's `read` has the same shape, you can pass a response from another server straight through, without holding it in memory:

```nio
import 'http';

http.Response async relay(http.Request r) {
    http.ClientResponse up = await http.request(http.Method.GET, "http://localhost:9000/big", null)
        catch e { return http.text(502, "bad gateway"); };
    return http.stream(200, up.read);
}
```

## `http.request()`

```nio
Future<http.ClientResponse!> http.request(http.Method m, String url, http.ClientOptions? options)
```

Sends a request and returns the response. Pass `null` for the options when you need none.

```nio
import 'http';

void async fetchUser() {
    http.ClientOptions options = { headers: { "accept": "application/json" }, timeout: 5000 };
    http.ClientResponse res = await http.request(
        http.Method.GET, "http://127.0.0.1:8080/users/42", options) catch e {
        print("request failed: " + e.message);
        return;
    };
    print(res.status);
    print(await res.text() catch "");
}
```

**HTTPS works the same way**: give an `https://` URL and the connection is encrypted. The server's certificate is checked by default — it must be signed by an authority your system trusts, it must be valid for the URL's host name, and the server must prove it holds the certificate's key. If any of that fails, the request fails with an error that says which problem it was, such as an expired certificate or the wrong host name.

```nio
import 'http';

void async fetchPage() {
    http.ClientResponse r = await http.request(http.Method.GET, "https://example.com/", null)
        catch e { print(e.message); return; };
    print(r.status);                     // 200
}
```

There are no shortcuts such as `http.get`: `http.request(http.Method.GET, url, null)` is already short. There is also no connection pool; each request opens its own connection.

## `http.ClientOptions`

The settings for one request. Every field is optional, so `{}` and any mix of fields are valid.

| Field | Type | Description |
| --- | --- | --- |
| `headers` | `Map<String, String>?` | Headers to send. |
| `body` | `String?` | A text body to send. |
| `bodyBytes` | `byte[]?` | A binary body to send. Used instead of `body` if both are set. |
| `timeout` | `Duration?` | How long to wait. A plain number means milliseconds. |
| `followRedirects` | `bool?` | Follow redirects, up to five. Off by default. |
| `tls` | `tls.Options?` | Settings for an HTTPS connection, such as your own trusted certificates. See [`tls`](/docs/stdlib/tls). |
| `maxBody` | `int?` | The largest response body `bytes()` and `text()` will read. No limit by default. |

```nio
import 'http';

http.ClientOptions a = {};
http.ClientOptions b = { body: "hello" };
http.ClientOptions c = { headers: { "x-token": "abc" }, timeout: 5000, followRedirects: true };
```

`http.options()` returns an empty set of options, and three methods change its headers without worrying about upper and lower case: `o.setHeader(name, value)`, `o.getHeader(name)` and `o.removeHeader(name)`.

To trust a private certificate authority, pass its certificate through `tls`:

```nio
import 'http';
import 'x509';
import 'fs';

void async internal() {
    x509.Certificate root = x509.parseCertificate(fs.readFile("company-ca.der")) catch e { return; };
    http.ClientOptions o = { tls: { roots: [root] } };
    http.ClientResponse r = await http.request(http.Method.GET, "https://internal.example/", o)
        catch e { print(e.message); return; };
    print(r.status);
}
```

> [!WARNING]
>
> With no `maxBody`, `await res.text()` reads whatever the server sends, however large. When you call a server you do not control, either set `maxBody`, or read the body piece by piece with `res.read()` and keep only what you need.

## `http.ClientResponse`

What `http.request` returns.

```nio
type ClientResponse {
    int status;
    String reason;                      // for example "OK" or "Not Found"
    Map<String, String> headers;
    String[] setCookies;                // every Set-Cookie header, separately
    Function()<Future<byte[]!>> read;   // the next piece of the body
    Function()<void> close;             // stop reading and close the connection
    int? maxBody;

    byte[] async bytes();               // the whole body
    String async text();                // the whole body, as text
}
```

Use `await res.text()` or `await res.bytes()` for the whole body. For a large body, read it piece by piece instead; `read()` returns an empty array at the end:

```nio
import 'http';

void async download() {
    http.ClientResponse res = await http.request(http.Method.GET, "http://localhost:8080/big", null)
        catch e { return; };
    int total = 0;
    while (true) {
        byte[] piece = await res.read() catch e { return; };
        if (piece.length == 0) {
            break;
        }
        total = total + piece.length;
    }
    print(total);
}
```

The connection closes by itself once the body has been read to the end. If you stop reading early, call `res.close()`.

A header that appears more than once is joined into one value with commas. `Set-Cookie` is the exception, because cookie values can contain commas; each one is kept separately in `setCookies`.

## Parsing helpers

The pieces the server and client are built from are exported too, for programs that handle HTTP over a connection of their own. The first six below can fail when their input is malformed; the rest always succeed.

| Function | What it does |
| --- | --- |
| `http.parseRequestLine(line)` | Reads `GET /path?q HTTP/1.1`. |
| `http.parseStatusLine(line)` | Reads `HTTP/1.1 200 OK`. |
| `http.parseHeaders(lines)` | Reads the header lines between the first line and the blank one. |
| `http.framingOf(headers)` | Says how the body is delimited: by `Content-Length`, or in chunks. |
| `http.decodeChunked(s, start, maxBody)` | Decodes as many complete chunks as `s` holds. |
| `http.parseUrl(url)` | Splits a URL into scheme, host, port, path and query. |
| `http.parseQuery(query)` | Turns `a=1&b=2` into a map, decoding each part. |
| `http.percentDecode(s)`, `http.percentEncode(s)` | Convert between `%41` and `A`. |
| `http.getHeader(h, name)`, `http.setHeader(h, name, value)` | Read and write a header, ignoring upper and lower case. |
| `http.reasonFor(status)` | The standard phrase for a status, such as `Not Found` for 404. |
| `http.CRLF`, `http.CRLF2` | The line ending `"\r\n"`, and the blank line `"\r\n\r\n"` that ends a header block. |

```nio
import 'http';

Map<String, String> q = http.parseQuery("name=ada+lovelace&lang=nio");
print(q["name"]);                     // ada lovelace
print(http.reasonFor(404));           // Not Found
```
