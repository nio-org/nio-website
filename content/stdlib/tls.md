---
title: "tls module: TLS 1.3 client"
description: "The Nio tls module opens encrypted TLS 1.3 connections and verifies the server's certificate by default, with optional certificate pinning."
---

# TLS

## Introduction

```nio
import 'tls';
```

The `tls` module opens encrypted connections. It is a TLS 1.3 client, the protocol that `https://` uses. It has no dependency outside the standard library. The cryptography comes from [`crypto`](/docs/stdlib/crypto).

On each connection, the client checks the server, unless the options turn the checks off:

* the server's certificate must be signed, through a chain of certificates, by an authority that the system trusts;
* the certificate must be valid for the requested name;
* the server must prove that it holds the certificate's private key.

```nio
import 'tls';
import 'string';

void async fetch() {
    tls.Conn c = await tls.connect("example.com:443", "example.com",
        { alpn: ["http/1.1"] }) catch e {
        print("cannot connect: " + e.message);
        return;
    };
    print(c.alpn);                                  // http/1.1

    await c.write(string.toByteArray(
        "GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n")) catch e { return; };
    byte[] head = await c.read(1024) catch e { return; };
    print(string.fromByteArray(head));              // HTTP/1.1 200 OK ...
    await c.close();
}
```

An HTTP request does not need this module directly. [`http.request`](/docs/stdlib/http#httprequest) with an `https://` URL opens the connection and does the same checks.

## Notes

* **TLS 1.3 only.** Older versions are not supported.
* **Two ciphers.** ChaCha20-Poly1305 is always offered. AES-128-GCM is also offered when the processor has AES instructions, because some servers accept only AES-128-GCM.
* **Client only.** There is no TLS server. To serve HTTPS, a server runs behind a proxy that does the encryption. Client certificates are not supported. If a server requests one, the client replies that it has none. Most servers accept this reply.
* **RSA and ECDSA certificates are supported** (ECDSA on the P-256 and P-384 curves). A server certificate that uses a different algorithm is refused.
* **Do not compare secrets with `==`.** Use `string.bytesEqualConstantTime`, which compares them in constant time. [`crypto`](/docs/stdlib/crypto) gives the reason.
* **Most programs need only `tls.connect` and `tls.Options`.** The functions from [`tls.earlySecret()`](#tlsearlysecret) onward are the parts that a connection is made from. They are for protocol work and tests.

> [!WARNING]
>
> **Revoked certificates are not detected.** A certificate that its authority revoked before its expiry date is still accepted. [`x509`](/docs/stdlib/x509) describes what to use instead.

When a connection fails, the error's `code` gives the cause. A certificate problem keeps its [`x509.ErrorCode`](/docs/stdlib/x509#errors), for example expired, wrong host name or untrusted. As a result, the caller can tell the cases apart. Problems with the protocol use `tls.ErrorCode`:

| Code | Meaning |
| --- | --- |
| `ILLEGAL_PARAMETER`, `DECODE_ERROR`, `RECORD_OVERFLOW`, `UNEXPECTED_MESSAGE`, `UNSUPPORTED_EXTENSION`, `DECRYPT_ERROR` | The server sent a malformed message, or a message at the wrong time. |
| `HANDSHAKE_FAILURE` | The client and the server did not negotiate a common set of parameters. |
| `UNSUPPORTED_CERTIFICATE` | The server's certificate uses an algorithm or feature that this client cannot check. |
| `PEER_ALERT` | The server closed the connection with an error alert. |
| `TOO_MANY_MESSAGES` | The server sent more messages of one type than this client permits. |
| `PIN_MISMATCH` | The certificate is valid, but its key is not one of the pinned keys. [`tls.Options`](#tlsoptions) describes pins. |
| `MISCONFIGURED` | The options contradict each other. Nothing was sent. |

A changed or replayed message fails with `crypto.ErrorCode.AUTHENTICATION`.

## `tls.connect()`

```nio
Future<tls.Conn!> tls.connect(String address, String serverName, tls.Options? options)
```

Opens a connection to `address` (written `"host:port"`) and starts encryption. `serverName` is the name that the certificate must be valid for. The client also sends it to the server. This lets a server that hosts many sites select the correct certificate. `null` as the options gives the defaults.

All failures, such as no connection, a bad certificate or a protocol error, occur at the `await`:

```nio
import 'tls';
import 'x509';

void async check(String host) {
    tls.Conn c = await tls.connect(host + ":443", host, null) catch e {
        if (e.code == x509.ErrorCode.EXPIRED) {
            print("the server's certificate has expired");
        } else if (e.code == x509.ErrorCode.HOSTNAME_MISMATCH) {
            print("that certificate is for a different server");
        } else if (e.code == x509.ErrorCode.UNTRUSTED_ROOT) {
            print("certificate not signed by a trusted authority");
        } else {
            print(e.message);
        }
        return;
    };
    await c.close();
}
```

## `tls.Options`

The settings for a connection. All fields are optional.

| Field | Type | Description |
| --- | --- | --- |
| `timeout` | `Duration?` | How long to wait. A plain number means milliseconds. |
| `alpn` | `String[]?` | The protocols that the client supports, such as `["http/1.1"]`. The protocol that the server selects is in `c.alpn`. |
| `roots` | `x509.Certificate[]?` | The certificate authorities that the client trusts, in place of the authorities that the system trusts. |
| `pins` | `byte[][]?` | The client accepts only servers whose certificate chain contains one of these keys. |
| `insecureSkipVerify` | `bool?` | Turns off all checks. It is only for tests. |

**`roots`** lets a client connect to a server whose certificate comes from a company's own authority. It limits which authorities the client trusts. It does not turn off the checks.

```nio
import 'tls';
import 'x509';
import 'fs';

void async internal() {
    x509.Certificate ca = x509.parseCertificate(fs.readFile("internal-ca.der")) catch e { return; };
    tls.Conn c = await tls.connect("internal.corp:443", "internal.corp", { roots: [ca] })
        catch e { print(e.message); return; };
    await c.close();
}
```

**`pins`** adds a further check. After the certificate chain is verified, the connection is accepted only if a certificate in the chain contains one of the listed keys. This protects the client if a trusted authority incorrectly issues a certificate for the server's name. A pin is the SHA-256 hash of a certificate's public key. [`x509.spkiPin`](/docs/stdlib/x509#x509spkipin) calculates it. This `openssl` command also calculates it:

```sh
openssl x509 -in server.der -inform DER -pubkey -noout \
    | openssl pkey -pubin -outform DER | openssl dgst -sha256
```

```nio
import 'tls';
import 'x509';
import 'fs';

void async pinned() {
    x509.Certificate today = x509.parseCertificate(fs.readFile("server.der")) catch e { return; };
    x509.Certificate next = x509.parseCertificate(fs.readFile("rotation.der")) catch e { return; };
    tls.Conn c = await tls.connect("api.example.com:443", "api.example.com",
        { pins: [x509.spkiPin(today), x509.spkiPin(next)] }) catch e {
        print(e.message);
        return;
    };
    await c.close();
}
```

Any certificate in the chain can match. A pin on an intermediate authority's key stays valid when the server's own certificate is renewed.

> [!WARNING]
>
> **Always pin more than one key.** Pin the key that the server uses now *and* the key that it will use next, or an intermediate key that stays valid longer than both. If the server changes to a key that is not pinned, no client can connect until the clients are updated.
>
> An empty `pins` list, or `pins` together with `insecureSkipVerify`, is refused with `MISCONFIGURED`. Either one would otherwise connect without a pin check and without an error.

> [!CAUTION]
>
> `insecureSkipVerify: true` turns off **all** checks: the certificate, the host name and the proof of the key. The connection is still encrypted, but the client does not know who is on the other end. Anyone who can redirect the traffic can read it. Use it only for tests with [`tls.testAccept`](#tlstestaccept).

## `tls.Conn`

An open, encrypted connection. Its methods match the socket functions of [`net`](/docs/stdlib/net).

| Member | Type | Description |
| --- | --- | --- |
| `c.read(n)` | `Future<byte[]!>` | Up to `n` bytes. An empty array when the server has finished sending. |
| `c.write(data)` | `Future<void!>` | Sends all of `data`. |
| `c.close()` | `Future<void>` | Tells the server that the client is done, then closes the connection. |
| `c.closeWrite()` | `Future<void>` | Tells the server that the client is done sending, but continues to read. |
| `c.abort(description)` | `Future<void>` | Closes with an error alert that tells the server what was wrong. |
| `c.alpn` | `String` | The protocol that the server selected, or `""`. |
| `c.peerCertificates` | `byte[][]` | The server's certificates as sent, with the server's own certificate first. |

`close()` ends a connection correctly. The closing message tells the other side that the data ended intentionally, and not because an attacker cut the connection.

## `tls.handshakeClient()`

```nio
Future<tls.Conn!> tls.handshakeClient(tls.Transport io, String serverName, tls.Options? options)
```

`tls.connect` opens a TCP connection and then calls `handshakeClient`. `handshakeClient` is necessary only to run TLS over a transport that is not a plain TCP socket. A `tls.Transport` is a record of three functions, `read`, `write` and `close`. As a result, the connection can run over any byte stream, including a fake one in a test. [`tls.socketTransport()`](#tlssockettransport) makes a transport from a socket.

## `tls.socketTransport()`

```nio
tls.Transport tls.socketTransport(Socket s, Duration? timeout)
```

Makes a `tls.Transport` from a socket, for [`tls.handshakeClient()`](#tlshandshakeclient). As with `handshakeClient`, it is necessary only when the connection is not a plain TCP socket, for example a Unix socket:

```nio
import 'tls';
import 'net';

void async viaUnixSocket() {
    Socket s = await net.unix.connect("/run/proxy.sock") catch e { return; };
    tls.Conn c = await tls.handshakeClient(tls.socketTransport(s, 5000), "example.com", null)
        catch e {
        net.close(s);
        print(e.message);
        return;
    };
    await c.close();
}
```

## `tls.testAccept()`

```nio
Future<tls.Conn!> tls.testAccept(tls.Transport io, tls.TestConfig config)
```

A test server. It tests TLS code on the local machine without a network.

> [!WARNING]
>
> **This is not a real TLS server. Do not use it as one.** It cannot prove that it holds its certificate's key. As a result, a client connects to it only with `insecureSkipVerify: true`.

## `tls.earlySecret()`

```nio
byte[] tls.earlySecret(byte[]? psk)
```

TLS 1.3 derives all keys of a connection from one shared secret, in three steps. Three functions do the steps, in this order: `earlySecret`, [`handshakeSecret`](#tlshandshakesecret) and [`masterSecret`](#tlsmastersecret). The example under [`tls.masterSecret()`](#tlsmastersecret) runs all three.

`earlySecret` is the first step. `psk` is `null` when there is no pre-shared key.

## `tls.handshakeSecret()`

```nio
byte[] tls.handshakeSecret(byte[] early, byte[] shared)
```

The second of the [three steps](#tlsearlysecret). It takes the result of `earlySecret` and the secret that the two sides agreed on, for example a secret from `crypto.x25519SharedSecret`.

## `tls.masterSecret()`

```nio
byte[] tls.masterSecret(byte[] handshake)
```

The last of the [three steps](#tlsearlysecret). It takes the result of `handshakeSecret`.

```nio
import 'tls';
import 'crypto';

byte[] myPrivate = crypto.randomBytes(32);
byte[] peerPublic = crypto.x25519PublicKey(crypto.randomBytes(32));

byte[] early = tls.earlySecret(null);
byte[]? shared = crypto.x25519SharedSecret(myPrivate, peerPublic) catch null;
if (shared != null) {
    byte[] handshake = tls.handshakeSecret(early, shared);
    byte[] master = tls.masterSecret(handshake);
    print(master.length);                // 32
}
```

## `tls.deriveSecret()`

```nio
byte[] tls.deriveSecret(byte[] secret, String label, byte[] transcriptHash)
```

Makes one named 32-byte secret from a step above, with the labels that the TLS standard defines, such as `"c hs traffic"`. It is [`tls.hkdfExpandLabel()`](#tlshkdfexpandlabel) with the transcript hash as the context. It fails in the same way: with `ILLEGAL_PARAMETER` if the label or the transcript hash is too long.

```nio
import 'tls';
import 'crypto';

byte[] early = tls.earlySecret(null);
byte[] binder = tls.deriveSecret(early, "ext binder", crypto.sha256([])) catch [];
print(binder.length);                    // 32
```

## `tls.hkdfExpandLabel()`

```nio
byte[] tls.hkdfExpandLabel(byte[] secret, String label, byte[] context, int length)
```

The function that [`tls.deriveSecret()`](#tlsderivesecret) uses. It makes `length` bytes from `secret`, a label and a context. It fails with `ILLEGAL_PARAMETER` if the label or the context is too long.

```nio
import 'tls';
import 'crypto';

byte[] secret = crypto.randomBytes(32);
byte[] key = tls.hkdfExpandLabel(secret, "key", [], 16) catch [];
print(key.length);                       // 16
```

## `tls.transcript()`

```nio
tls.Transcript tls.transcript()
```

A running hash of all handshake messages up to this point. It binds each secret to all messages of the handshake. `t.push(message)` adds one message. `t.hash()` returns the SHA-256 of all messages added.

```nio
import 'tls';
import 'string';

tls.Transcript t = tls.transcript();
t.push(string.toByteArray("client hello"));
t.push(string.toByteArray("server hello"));
print(t.hash().length);                  // 32
```

## `tls.trafficKeys()`

```nio
tls.TrafficKeys tls.trafficKeys(byte[] trafficSecret, int keyLength)
```

Makes the key and the 12-byte initialization vector for one direction of a connection, as the fields `key` and `iv`. `keyLength` is 32 for ChaCha20-Poly1305 and 16 for AES-128-GCM.

```nio
import 'tls';
import 'crypto';

tls.TrafficKeys k = tls.trafficKeys(crypto.randomBytes(32), 32);
print(k.key.length);                     // 32
print(k.iv.length);                      // 12
```

## `tls.finishedVerifyData()`

```nio
byte[] tls.finishedVerifyData(byte[] trafficSecret, byte[] transcriptHash)
```

Calculates the value that each side sends to prove that it saw the same handshake. `string.bytesEqualConstantTime` checks a received value:

```nio
import 'tls';
import 'string';

bool finishedOk(byte[] trafficSecret, tls.Transcript t, byte[] received) {
    byte[] expected = tls.finishedVerifyData(trafficSecret, t.hash());
    return string.bytesEqualConstantTime(expected, received);
}
```

## `tls.plaintextRecord()`

```nio
byte[] tls.plaintextRecord(int contentType, byte[] payload)
```

TLS sends all data in records. A record is a 5-byte header followed by up to 16 KB of data. The record types are in `tls.ContentType`: `CHANGE_CIPHER_SPEC`, `ALERT`, `HANDSHAKE` and `APPLICATION_DATA`.

`plaintextRecord` wraps a payload that is sent unencrypted. It fails with `RECORD_OVERFLOW` for a payload larger than 16 KB.

```nio
import 'tls';
import 'string';

byte[] record = tls.plaintextRecord(tls.ContentType.HANDSHAKE,
    string.toByteArray("hello")) catch [];
print(record.length);                    // 10: the header and the payload
```

## `tls.parseRecordHeader()`

```nio
tls.RecordHeader tls.parseRecordHeader(byte[] data)
```

Reads the type and the length of a [record](#tlsplaintextrecord) from its first five bytes, as the fields `contentType` and `length`. The length is the length of the data after the header. It fails with:

* `DECODE_ERROR` when there are fewer than five bytes;
* `UNEXPECTED_MESSAGE` when the type is not one of the four in `tls.ContentType`;
* `RECORD_OVERFLOW` when the length is larger than the maximum record size.

```nio
import 'tls';
import 'string';

byte[] record = tls.plaintextRecord(tls.ContentType.HANDSHAKE,
    string.toByteArray("hello")) catch [];

tls.RecordHeader? h = tls.parseRecordHeader(record) catch null;
if (h != null) {
    print(h.contentType == tls.ContentType.HANDSHAKE);   // true
    print(h.length);                     // 5
}
```

## `tls.protectionKeys()`

```nio
tls.RecordProtection tls.protectionKeys(byte[] trafficSecret, int suite)
```

Encrypts and decrypts records for **one direction** of a connection. A connection uses two of them. `suite` is `tls.TLS_CHACHA20_POLY1305_SHA256` or `tls.TLS_AES_128_GCM_SHA256`. `p.seal(contentType, payload)` encrypts a record. `p.open(record)` verifies and decrypts a record, and returns a `tls.InnerPlaintext` with the real `contentType` and `data`.

Each side counts its records and includes the count in the encryption. As a result, a record that is replayed or delivered out of order fails to decrypt.

```nio
import 'tls';
import 'crypto';
import 'string';

byte[] secret = crypto.randomBytes(32);
tls.RecordProtection writer = tls.protectionKeys(secret, tls.TLS_CHACHA20_POLY1305_SHA256);
tls.RecordProtection reader = tls.protectionKeys(secret, tls.TLS_CHACHA20_POLY1305_SHA256);

byte[] record = writer.seal(tls.ContentType.APPLICATION_DATA,
    string.toByteArray("attack at dawn")) catch [];

tls.InnerPlaintext? p = reader.open(record) catch null;
if (p != null) {
    print(string.fromByteArray(p.data));   // attack at dawn
}

tls.InnerPlaintext? again = reader.open(record) catch null;
print(again == null);                      // true: a replay does not decrypt
```
