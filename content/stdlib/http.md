---
title: "http module: HTTP server and client"
description: "The Nio http module runs HTTP/1.1 servers with routing and streaming bodies, and makes HTTP and HTTPS requests."
---

# HTTP

## Introduction

```nio
import 'http';
```

The `http` module runs HTTP/1.1 servers and makes HTTP requests. The client can also make HTTPS requests. The module uses [`net`](/docs/stdlib/net) and [`tls`](/docs/stdlib/tls).

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

* **The client supports HTTPS. The server does not.** A request to an `https://` URL is encrypted, and the client checks the server's certificate. The server supports only plain HTTP. To serve HTTPS, a program needs a proxy in front of the server that does the encryption, such as nginx or Caddy.
* **Only HTTP/1.1.** There is no HTTP/2 and no WebSocket support.
* **A server uses one CPU core.** The server changes from one request to another at each `await`, as described in [Async and futures](/docs/async).
* **Bodies can be streamed.** The server can read a request body and write a response body in pieces. The client can read a response body in pieces. As a result, a large upload, a download, or an event stream that does not end is not kept in memory at one time. [`http.stream()`](#httpstream), [`ClientResponse`](#httpclientresponse) and [`Server.routeStream()`](#serverroutestream) give the details.
* **Header names are case-insensitive.** `http.getHeader` and `http.setHeader` ignore case. A direct index into the map uses the exact case of the name.
* **The server has fixed limits.** This prevents a bad client from using all of the server's resources. The limits are:

| Limit | Value |
| --- | --- |
| One line (the request line, the status line, or a header) | 8 KB |
| The full header block | 64 KB |
| Number of headers | 100 |
| Body the server reads before calling a handler | 10 MB, or `Options.maxBody` |
| Body the client holds | no limit, unless `ClientOptions.maxBody` is set |

The server returns `413` for a request that is too large and `400` for a malformed request. It does this before any handler code runs.

Requests and parsing functions can fail. The error's `code` is one of these `http.ErrorCode` values:

| Code | Meaning |
| --- | --- |
| `MALFORMED_REQUEST` | The request, URL or query could not be read. |
| `MALFORMED_RESPONSE` | The server's response could not be read. |
| `TOO_LARGE` | Something was larger than one of the limits above. |
| `UNSUPPORTED_SCHEME` | The URL starts with neither `http://` nor `https://`. |
| `TOO_MANY_REDIRECTS` | More than five redirects in a row. |

A network failure, such as a refused connection, keeps its [`net`](/docs/stdlib/net) error code. A certificate problem on an HTTPS request keeps its [`tls`](/docs/stdlib/tls) or [`x509`](/docs/stdlib/x509) code. As a result, a program can use the code to tell a certificate error from a connection error. The four sets of codes do not overlap.

## `http.server()`

```nio
http.Server http.server()
```

Creates a server with no routes. A server is an ordinary value. One program can run more than one server. For example, one server can listen on a public port and another on an admin port.

## `Server.route()`

```nio
void s.route(http.Method m, http.Pattern p, http.ResponseFunction handler)
```

Adds a route. `handler` handles each request that has method `m` and a path that matches `p`. The methods are `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD` and `OPTIONS`.

A pattern is a path split on `/`, and each part is one of these:

| Part | Matches |
| --- | --- |
| `users` | that text only |
| `:id` | any single part, which the handler reads as `req.params["id"]` |
| `*` | this part and everything after it |

**The first matching route wins.** A catch-all such as `*` hides every route that is registered after it. The server returns `404 not found` for a request that matches no route.

A handler is a function that takes an `http.Request` and returns an `http.Response`:

```nio
import 'http';

http.Server s = http.server();
s.route(http.Method.GET, "/", http.Response (http.Request r) -> http.text(200, "hello"));
```

A handler that must wait for an operation, for example a database query or a request to another HTTP service, is an `async` function. It returns a future of a response:

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

One server can have both kinds of handler. `route` accepts either kind.

* If an ordinary handler fails with an error, the server returns `500`. It does not send the error's details to the client.
* An `async` handler cannot fail. It must catch its errors and select the response status itself, as `proxy` does above.

A pattern can also be a compiled [`RegExp`](/docs/stdlib/regexp) instead of text. It must match the full path. Text patterns are faster than regular expressions. A regular expression route sets no `req.params`.

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

Like `route`, but the server does **not** read the request body before it calls the handler. The handler reads the body in pieces with `req.read()`. Each call returns the next piece, or an empty array when the body has ended. `routeStream` is for large uploads that must not be kept in memory.

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

On an ordinary route, the first call to `req.read()` returns the full body. As a result, a handler that uses `read` works on both kinds of route.

Reading the body waits. Only a named `async` function can wait. For this reason, a streaming handler must be a named `async` function.

If a streaming handler returns a response before it reads all of the body, the server reads and discards up to 256 KB of the remaining body. The connection can then be used again. If more than 256 KB remains, the server closes the connection. Before it closes the connection, it continues to read and discard data for up to 500 ms. This lets the client read the response.

## `Server.listen()`

```nio
Future<void!> s.listen(String host, int port, http.Options? options)
```

Starts the server on `host` and `port`, and handles requests until the server is closed. It fails if the address cannot be used. With `null` as the options, the server uses the defaults.

`http.Options` has three fields, all optional:

| Field | Type | Description |
| --- | --- | --- |
| `timeout` | `Duration?` | How long to wait for a slow client. |
| `backlog` | `int?` | The maximum number of pending connections that the system keeps. |
| `maxBody` | `int?` | The largest request body the server reads, in bytes. Default 10 MB. |

```nio
import 'http';

http.Server s = http.server();
http.Options o = { backlog: 256, maxBody: 1048576 };
await s.listen("0.0.0.0", 8080, o) catch e {
    print(e.message);
};
```

Host and port are separate arguments. An IPv6 address needs no brackets: `s.listen("::1", 8080, null)`.

## `Server.bind()`

```nio
int s.bind(String host, int port, http.Options? options)
```

Starts listening on `host` and `port`, and returns the port it got. It takes the same options as [`listen`](#serverlisten), and fails if the address cannot be used. It does not handle requests. [`serve`](#serverserve) handles them.

`listen` is `bind` followed by `serve`. Separate calls are necessary when a program must know the port before the server starts to handle requests. For example, a test can bind to port `0`, which makes the system select a free port:

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

Handles requests until the server is closed. [`bind`](#serverbind) must come first. The example there shows the two together.

## `Server.port()`

```nio
int s.port()
```

Returns the port the server is bound to. After a bind to port `0`, this is the port that the system selected.

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

The request that a handler receives.

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

`query` is not decoded, because a query decoded before it is split cannot show the difference between a real `&` and an encoded `&`. `http.parseQuery` splits the query and then decodes each part.

## `http.Response`

The response that a handler returns.

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

A response is a record. A handler can change it before it returns it. The server adds `Content-Length`.

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

Returns a response with `status` and a `text/plain` body. [`http.Response`](#httpresponse) lists the contents of a response.

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

Returns a response with `status` and an `application/json` body. `encoded` is JSON text that is already encoded. `json.toText` makes this text.

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

Returns a response with `status` and a raw body with no content type. `http.setHeader` adds a content type when the client needs one.

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

Returns a response whose body is written in pieces. `produce` is a function that the server calls repeatedly. Each call returns the next piece of the body, or an empty array when the body is complete.

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

* The server sends the headers before the body length is known. As a result, it sends the response in chunks. It removes any `Content-Length` header that the handler sets.
* A producer that never returns an empty array makes a response that does not end. Server-sent events use this type of response.
* The producer can be a function that can fail (`Future<byte[]!>`) or one that cannot fail (`Future<byte[]>`). If the producer fails after the status is sent, the server closes the connection. This tells the client that the body is incomplete.
* For a `HEAD` request, the server sends only the headers and does not call the producer.

A client response's `read` has the same type as a producer. As a result, a server can send a response from another server to its own client without keeping it in memory:

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

Sends a request and returns the response. The options can be `null`.

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

**HTTPS works the same way.** If the URL starts with `https://`, the connection is encrypted. By default, the client checks the server's certificate:

* An authority that the system trusts must sign the certificate.
* The certificate must be valid for the host name in the URL.
* The server must prove that it holds the certificate's key.

If a check fails, the request fails with an error that identifies the problem, for example an expired certificate or the wrong host name.

```nio
import 'http';

void async fetchPage() {
    http.ClientResponse r = await http.request(http.Method.GET, "https://example.com/", null)
        catch e { print(e.message); return; };
    print(r.status);                     // 200
}
```

There is no connection pool. Each request opens its own connection.

## `http.ClientOptions`

The settings for one request. Every field is optional. `{}` and any mix of fields are valid.

| Field | Type | Description |
| --- | --- | --- |
| `headers` | `Map<String, String>?` | Headers to send. |
| `body` | `String?` | A text body to send. |
| `bodyBytes` | `byte[]?` | A binary body to send. Used instead of `body` if both are set. |
| `timeout` | `Duration?` | How long to wait. A plain number means milliseconds. |
| `followRedirects` | `bool?` | Follow redirects, up to five. Off by default. |
| `tls` | `tls.Options?` | Settings for an HTTPS connection, such as a program's own trusted certificates. [`tls`](/docs/stdlib/tls) gives the details. |
| `maxBody` | `int?` | The largest response body that `bytes()` and `text()` read. No limit by default. |

```nio
import 'http';

http.ClientOptions a = {};
http.ClientOptions b = { body: "hello" };
http.ClientOptions c = { headers: { "x-token": "abc" }, timeout: 5000, followRedirects: true };
```

`http.options()` returns an empty set of options. These three methods read and change its headers, and ignore upper and lower case in header names: `o.setHeader(name, value)`, `o.getHeader(name)` and `o.removeHeader(name)`.

To trust a private certificate authority, a program passes its certificate through `tls`:

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
> With no `maxBody`, `await res.text()` reads all of the body that the server sends, with no size limit. A server that the program does not control can send a body of any size. For such a server, set `maxBody`, or read the body in pieces with `res.read()` and keep only the necessary data.

## `http.ClientResponse`

The response that `http.request` returns.

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

`await res.text()` and `await res.bytes()` return the full body. A large body can be read in pieces. `read()` returns an empty array at the end of the body:

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

The connection closes automatically when the body has been read to the end. A program that stops reading before the end must call `res.close()`.

A header that occurs more than once is joined into one value with commas. `Set-Cookie` is the exception, because cookie values can contain commas. Each `Set-Cookie` value is kept separately in `setCookies`.

## Parsing helpers

The module also exports the functions that the server and client use. Programs that handle HTTP over their own connections can use them. The first six functions below can fail when their input is malformed. The other functions always succeed.

| Function | What it does |
| --- | --- |
| `http.parseRequestLine(line)` | Reads `GET /path?q HTTP/1.1`. |
| `http.parseStatusLine(line)` | Reads `HTTP/1.1 200 OK`. |
| `http.parseHeaders(lines)` | Reads the header lines between the first line and the blank one. |
| `http.framingOf(headers)` | Returns how the body is delimited: by `Content-Length`, or in chunks. |
| `http.decodeChunked(s, start, maxBody)` | Decodes as many complete chunks as `s` holds. |
| `http.parseUrl(url)` | Splits a URL into scheme, host, port, path and query. |
| `http.parseQuery(query)` | Turns `a=1&b=2` into a map, decoding each part. |
| `http.percentDecode(s)`, `http.percentEncode(s)` | Convert between `%41` and `A`. |
| `http.getHeader(h, name)`, `http.setHeader(h, name, value)` | Read and write a header, ignoring upper and lower case. |
| `http.reasonFor(status)` | Returns the standard reason phrase for a status, such as `Not Found` for 404. |
| `http.CRLF`, `http.CRLF2` | The line ending `"\r\n"`, and the blank line `"\r\n\r\n"` that ends a header block. |

```nio
import 'http';

Map<String, String> q = http.parseQuery("name=ada+lovelace&lang=nio");
print(q["name"]);                     // ada lovelace
print(http.reasonFor(404));           // Not Found
```
