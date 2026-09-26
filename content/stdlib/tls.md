---
title: "tls module: TLS 1.3 client"
description: "The Nio tls module opens encrypted TLS 1.3 connections and verifies the server's certificate by default, with optional certificate pinning."
---

# TLS

## Introduction

```nio
import 'tls';
```

The `tls` module opens encrypted connections: it is a TLS 1.3 client, the same protocol a browser uses for `https://`. It needs no outside library; the cryptography underneath comes from [`crypto`](/docs/stdlib/crypto).

The server is checked on every connection unless you turn the checks off:

* its certificate must be signed, through a chain of certificates, by an authority your system trusts;
* the certificate must be valid for the name you asked for;
* the server must prove it holds the certificate's private key.

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

If what you want to send is HTTP, you do not need this module directly: [`http.request`](/docs/stdlib/http#httprequest) with an `https://` URL does all of the above for you.

## Notes

* **TLS 1.3 only.** Older versions are not supported; nearly every server on the web speaks 1.3.
* **Two ciphers.** ChaCha20-Poly1305 is always offered. AES-128-GCM is offered too when the processor has AES instructions, since some servers accept nothing else.
* **Client only.** There is no TLS server. To serve HTTPS, put your server behind a proxy that handles encryption. Client certificates are not supported either: if a server asks for one, the client answers that it has none, which most servers accept.
* **RSA and ECDSA certificates are supported** (ECDSA on the P-256 and P-384 curves) — between them, what the public web uses. A server using anything else is refused rather than trusted unchecked.
* **Compare secrets with `string.bytesEqualConstantTime`**, never with `==`. See [`crypto`](/docs/stdlib/crypto).
* **Most programs need only `tls.connect` and `tls.Options`.** The functions from [`tls.earlySecret()`](#tlsearlysecret) onward are the building blocks the connection is made from, for protocol work and testing.

> [!WARNING]
>
> **Revoked certificates are not detected.** A certificate that its authority withdrew before it expired is still accepted. This is the usual default for TLS libraries; [`x509`](/docs/stdlib/x509) explains why, and what to use instead.

When a connection fails, the error's `code` tells you why. A certificate problem keeps its [`x509.ErrorCode`](/docs/stdlib/x509#errors) — expired, wrong host name, untrusted — so you can tell the cases apart. Problems with the protocol itself use `tls.ErrorCode`:

| Code | Meaning |
| --- | --- |
| `ILLEGAL_PARAMETER`, `DECODE_ERROR`, `RECORD_OVERFLOW`, `UNEXPECTED_MESSAGE`, `UNSUPPORTED_EXTENSION`, `DECRYPT_ERROR` | The server sent something malformed or out of place. |
| `HANDSHAKE_FAILURE` | The two sides could not agree on how to talk. |
| `UNSUPPORTED_CERTIFICATE` | The server's certificate uses something this client cannot check. |
| `PEER_ALERT` | The server ended the connection with an error of its own. |
| `TOO_MANY_MESSAGES` | The server sent more of something than any honest server would. |
| `PIN_MISMATCH` | The certificate is valid, but its key is not one you pinned. See [`tls.Options`](#tlsoptions). |
| `MISCONFIGURED` | The options you passed contradict each other. Nothing was sent. |

A tampered or replayed message fails with `crypto.ErrorCode.AUTHENTICATION`.

## `tls.connect()`

```nio
Future<tls.Conn!> tls.connect(String address, String serverName, tls.Options? options)
```

Opens a connection to `address` (written `"host:port"`) and sets up encryption. `serverName` is the name the certificate must be valid for; it is also sent to the server, so a server hosting many sites knows which certificate to present. Pass `null` for the options to use the defaults.

Any failure — no connection, a bad certificate, a protocol error — arrives at the `await`:

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
            print("nobody I trust vouches for that certificate");
        } else {
            print(e.message);
        }
        return;
    };
    await c.close();
}
```

## `tls.Options`

The settings for a connection. Every field is optional.

| Field | Type | Description |
| --- | --- | --- |
| `timeout` | `Duration?` | How long to wait. A plain number means milliseconds. |
| `alpn` | `String[]?` | The protocols you can speak, such as `["http/1.1"]`. The one the server picks is in `c.alpn`. |
| `roots` | `x509.Certificate[]?` | Trust only these certificate authorities, instead of the ones your system trusts. |
| `pins` | `byte[][]?` | Accept only servers whose certificate chain contains one of these keys. |
| `insecureSkipVerify` | `bool?` | Turn off every check. For tests only. |

**`roots`** is how you connect to a server whose certificate comes from your own company's authority. It narrows who you trust; it does not switch checking off.

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

**`pins`** goes one step further: after the certificate chain has been checked, the connection is accepted only if some certificate in it carries one of the listed keys. That protects you even from a trusted authority that wrongly issues a certificate for your server's name. A pin is the SHA-256 hash of a certificate's public key, which [`x509.spkiPin`](/docs/stdlib/x509#x509spkipin) computes, or which you can compute with `openssl`:

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

Any certificate in the chain counts, so pinning an intermediate authority's key keeps working as the server's own certificate is renewed.

> [!WARNING]
>
> **Always pin more than one key.** Pin the key the server uses today *and* the one it will move to next, or an intermediate key that outlives both. If the server switches to a key you did not pin, every client stops connecting until it is updated.
>
> An empty `pins` list, or `pins` together with `insecureSkipVerify`, is refused with `MISCONFIGURED`: either would silently connect with nothing pinned.

> [!CAUTION]
>
> `insecureSkipVerify: true` turns off **every** check: the certificate, the host name, and the proof of the key. The connection is still encrypted, but you cannot know who is on the other end, so anyone who can redirect your traffic can read it. It exists only for testing against [`tls.testAccept`](#tlstestaccept).

## `tls.Conn`

An open, encrypted connection. Its methods mirror [`net`](/docs/stdlib/net)'s, so code that works with a socket reads the same way.

| Member | Type | Description |
| --- | --- | --- |
| `c.read(n)` | `Future<byte[]!>` | Up to `n` bytes; an empty array once the server has finished sending. |
| `c.write(data)` | `Future<void!>` | Sends all of `data`. |
| `c.close()` | `Future<void>` | Tells the server you are done, then closes the connection. |
| `c.closeWrite()` | `Future<void>` | Tells the server you are done sending, but keeps reading. |
| `c.abort(description)` | `Future<void>` | Closes with an error alert, telling the server what was wrong. |
| `c.alpn` | `String` | The protocol the server picked, or `""`. |
| `c.peerCertificates` | `byte[][]` | The server's certificates, its own first, as sent. |

Close connections with `close()` rather than just dropping them. The closing message tells the other side the data ended on purpose, rather than being cut off by an attacker.

## `tls.handshakeClient()`

```nio
Future<tls.Conn!> tls.handshakeClient(tls.Transport io, String serverName, tls.Options? options)
```

`tls.connect` is a TCP connection followed by `handshakeClient`. You need it only to run TLS over something other than a plain TCP socket. A `tls.Transport` is a record of three functions — `read`, `write` and `close` — so the connection can run over anything that carries bytes, including a fake one in a test. [`tls.socketTransport()`](#tlssockettransport) makes one from a socket.

## `tls.socketTransport()`

```nio
tls.Transport tls.socketTransport(Socket s, Duration? timeout)
```

Makes a `tls.Transport` from a socket, for [`tls.handshakeClient()`](#tlshandshakeclient). Like `handshakeClient`, you need it only when the connection is not a plain TCP socket, such as a Unix socket:

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

A stand-in server for tests, so you can test TLS code on your own machine without a network.

> [!WARNING]
>
> **This is not a real TLS server and must never be used as one.** It cannot prove it holds its certificate's key, so a client only connects to it with `insecureSkipVerify: true`.

## `tls.earlySecret()`

```nio
byte[] tls.earlySecret(byte[]? psk)
```

TLS 1.3 turns one shared secret into every key a connection uses, in three steps. Three functions are the steps, in order: `earlySecret`, [`handshakeSecret`](#tlshandshakesecret) and [`masterSecret`](#tlsmastersecret). The example under [`tls.masterSecret()`](#tlsmastersecret) runs all three.

`earlySecret` is the first step. Pass `null` when there is no pre-shared key.

## `tls.handshakeSecret()`

```nio
byte[] tls.handshakeSecret(byte[] early, byte[] shared)
```

The second of the [three steps](#tlsearlysecret). It takes the result of `earlySecret` and the secret the two sides agreed on, such as one from `crypto.x25519SharedSecret`.

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

Makes one named 32-byte secret from a step above, using the labels the TLS standard defines, such as `"c hs traffic"`. It is [`tls.hkdfExpandLabel()`](#tlshkdfexpandlabel) with the transcript hash as the context, and fails the same way: with `ILLEGAL_PARAMETER` if the label or transcript hash is too long.

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

The function underneath [`tls.deriveSecret()`](#tlsderivesecret). It makes `length` bytes from `secret`, a label and a context. It fails with `ILLEGAL_PARAMETER` if the label or context is too long.

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

A running hash of every handshake message so far, which ties each secret to the whole conversation. `t.push(message)` adds one message; `t.hash()` returns the SHA-256 of everything added.

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

Makes the key and the 12-byte starting value for one direction of a connection, as the fields `key` and `iv`. `keyLength` is 32 for ChaCha20-Poly1305 and 16 for AES-128-GCM.

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

Computes the value each side sends to prove it saw the same handshake. Check a received one with `string.bytesEqualConstantTime`:

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

Everything TLS sends travels in records: a 5-byte header followed by up to 16 KB of data. The types of record are in `tls.ContentType`: `CHANGE_CIPHER_SPEC`, `ALERT`, `HANDSHAKE` and `APPLICATION_DATA`.

`plaintextRecord` wraps a payload that is sent unencrypted, and fails with `RECORD_OVERFLOW` for one larger than 16 KB.

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

Reads the type and length of a [record](#tlsplaintextrecord) from its first five bytes, as the fields `contentType` and `length`. The length is that of the data after the header. It fails with `DECODE_ERROR` when there are fewer than five bytes, with `UNEXPECTED_MESSAGE` when the type is not one of the four in `tls.ContentType`, and with `RECORD_OVERFLOW` when the length is larger than any record may be.

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

Encrypts and decrypts records for **one direction** of a connection, so a connection holds two. `suite` is `tls.TLS_CHACHA20_POLY1305_SHA256` or `tls.TLS_AES_128_GCM_SHA256`. `p.seal(contentType, payload)` encrypts a record, and `p.open(record)` checks and decrypts one, returning a `tls.InnerPlaintext` with the real `contentType` and `data`.

Each side counts its records, and the count is mixed into the encryption, so a record that is replayed or delivered out of order fails to decrypt.

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
