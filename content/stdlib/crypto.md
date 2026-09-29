---
title: "crypto module"
description: "The Nio crypto module: SHA-256 and SHA-384, HMAC, HKDF, authenticated encryption, X25519, signature checks, and encoding helpers."
---

# Crypto

## Introduction

```nio
import 'crypto';
```

The `crypto` module contains functions for hashing (SHA-256 and SHA-384), message authentication (HMAC), key derivation (HKDF), encryption (ChaCha20-Poly1305 and AES-128-GCM), key agreement (X25519), RSA and ECDSA signature verification, base64 and hex encoding, and secure random bytes from the operating system.

```nio
import 'crypto';
import 'string';

byte[] digest = crypto.sha256(string.toByteArray("abc"));
print(crypto.hexEncode(digest));
// ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad

byte[] key = crypto.randomBytes(32);
byte[] mac = crypto.hmacSha256(key, digest);
print(crypto.base64Encode(mac));
```

## Notes

* All functions operate on `byte[]`. A string is converted with
  `string.toByteArray` before it is hashed.
* The hash is part of each function's name (`sha256`, `sha384`). As a result, a
  wrong algorithm name is a compile error.
* **Do not compare secrets with `==`.** It stops at the first byte that is
  different. An attacker who can measure the time can find where the
  difference is. To compare a MAC, token or tag, use
  `string.bytesEqualConstantTime` or `string.equalsConstantTime`. They
  compare in constant time.
* `base64Decode` and `hexDecode` are fallible. Text that does not decode
  raises an error with the code `crypto.ErrorCode.INVALID`. A `catch`
  handles the error (see [Errors](/docs/errors)).
* The decoders are strict. They accept no whitespace, require exact padding
  and allow no trailing bits. Wrapped base64, such as PEM contents, does
  not decode until its newlines are removed.
* `randomBytes` uses the operating system's generator. A program cannot
  configure or seed it. The module has no other source of random data.
* Keys, nonces and curve points have fixed lengths: 32 bytes, except the
  AEAD nonce (12 bytes) and the AES-128-GCM key (16 bytes). A different
  length stops the program, because it is a program error, not bad input.
* **The module does not sign.** The RSA and ECDSA functions only verify
  signatures.

## `crypto.sha256()`

```nio
byte[] crypto.sha256(byte[] data)
```

Returns the SHA-256 digest of `data`: 32 bytes.

```nio
import 'crypto';
import 'string';

print(crypto.hexEncode(crypto.sha256(string.toByteArray(""))));
// e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## `crypto.sha384()`

```nio
byte[] crypto.sha384(byte[] data)
```

Returns the SHA-384 digest of `data`: 48 bytes.

```nio
import 'crypto';
import 'string';

print(crypto.sha384(string.toByteArray("")).length);   // 48
```

## `crypto.hmacSha256()`

```nio
byte[] crypto.hmacSha256(byte[] key, byte[] data)
```

Returns the HMAC-SHA-256 of `data` under `key` (RFC 2104): 32 bytes. It
authenticates a message with a shared secret. To verify a message, the
receiver calculates the HMAC again and compares the two values with
`string.bytesEqualConstantTime`.

```nio
import 'crypto';
import 'string';

byte[] key = crypto.randomBytes(32);
byte[] message = string.toByteArray("amount=25");
byte[] tag = crypto.hmacSha256(key, message);

// Later, on receipt:
byte[] again = crypto.hmacSha256(key, message);
print(string.bytesEqualConstantTime(tag, again));   // true
```

## `crypto.hmacSha384()`

```nio
byte[] crypto.hmacSha384(byte[] key, byte[] data)
```

Returns the HMAC-SHA-384 of `data` under `key` (RFC 2104): 48 bytes. It is
used and verified in the same way as [`hmacSha256`](#cryptohmacsha256).

```nio
import 'crypto';
import 'string';

byte[] key = crypto.randomBytes(48);
byte[] tag = crypto.hmacSha384(key, string.toByteArray("amount=25"));
print(tag.length);   // 48
```

## `crypto.hkdfExtractSha256()`

```nio
byte[] crypto.hkdfExtractSha256(byte[] salt, byte[] ikm)
```

HKDF (RFC 5869) derives any number of independent keys from one secret, in
two steps. `hkdfExtractSha256` is the first step. It condenses input key
material into a pseudorandom key.
[`hkdfExpandSha256`](#cryptohkdfexpandsha256) is the second step. Both steps
also exist for SHA-384, as `hkdfExtractSha384` and `hkdfExpandSha384`.

An empty `salt` means "no salt", as the RFC defines it.

```nio
import 'crypto';
import 'string';

byte[] shared = crypto.randomBytes(32);            // some negotiated secret
byte[] prk = crypto.hkdfExtractSha256(string.toByteArray(""), shared);
print(prk.length);   // 32
```

## `crypto.hkdfExpandSha256()`

```nio
byte[] crypto.hkdfExpandSha256(byte[] prk, byte[] info, int length)
```

The second step of HKDF. It expands the pseudorandom key from
[`hkdfExtractSha256`](#cryptohkdfextractsha256) into `length` bytes, bound to
the context string `info`. Different contexts give unrelated keys. The
SHA-384 form is `hkdfExpandSha384`.

```nio
import 'crypto';
import 'string';

byte[] shared = crypto.randomBytes(32);            // some negotiated secret
byte[] prk = crypto.hkdfExtractSha256(string.toByteArray(""), shared);
byte[] encKey = crypto.hkdfExpandSha256(prk, string.toByteArray("enc"), 32);
byte[] macKey = crypto.hkdfExpandSha256(prk, string.toByteArray("mac"), 32);
```

`length` must not be more than 255 times the hash length (8160 bytes for
SHA-256). A larger value stops the program.

## `crypto.chacha20Poly1305Seal()`

```nio
byte[] crypto.chacha20Poly1305Seal(byte[] key, byte[] nonce, byte[] plaintext, byte[] aad)
```

Authenticated encryption (RFC 8439). `key` is 32 bytes and `nonce` is 12
bytes. `Seal` returns the ciphertext with a 16-byte authentication tag
appended. [`chacha20Poly1305Open`](#cryptochacha20poly1305open) verifies the
tag and returns the plaintext.

`aad` (additional authenticated data) is data that is sent unencrypted but is
protected against changes, for example a message header, a type byte or a
sequence number. When there is no such data, `aad` is an empty array.

```nio
import 'crypto';
import 'string';

byte[] key = crypto.randomBytes(32);
byte[] nonce = crypto.randomBytes(12);

byte[] sealed = crypto.chacha20Poly1305Seal(key, nonce,
    string.toByteArray("attack at dawn"), string.toByteArray("msg-42"));
print(sealed.length);   // 30: 14 bytes of ciphertext and the 16-byte tag
```

**Do not use a nonce two times with the same key.** Both messages
lose their secrecy and the authentication key is disclosed. An attacker can
then forge messages. To prevent a repeated nonce, use a counter for each key,
or 12 new random bytes for each message, sent with the ciphertext.
Nonces are not secret.

ChaCha20-Poly1305 is safe on all processors. It is the default choice. [AES-128-GCM](#cryptoaes128gcmseal) is also available, but only on processors with AES instructions.

## `crypto.chacha20Poly1305Open()`

```nio
byte[]! crypto.chacha20Poly1305Open(byte[] key, byte[] nonce, byte[] ciphertext, byte[] aad)
```

Verifies the tag on a message from
[`chacha20Poly1305Seal`](#cryptochacha20poly1305seal) and returns the
plaintext, or fails. The key, nonce and `aad` must be the same as the ones
that sealed the message.

```nio
import 'crypto';
import 'string';

byte[] key = crypto.randomBytes(32);
byte[] nonce = crypto.randomBytes(12);

byte[] sealed = crypto.chacha20Poly1305Seal(key, nonce,
    string.toByteArray("attack at dawn"), string.toByteArray("msg-42"));

byte[]? plain = crypto.chacha20Poly1305Open(key, nonce, sealed,
    string.toByteArray("msg-42")) catch e {
    print("message was forged or corrupted");
};
if (plain != null) {
    print(string.fromByteArray(plain));   // attack at dawn
}
```

A failed tag check fails with `crypto.ErrorCode.AUTHENTICATION`. It means
that the message was forged or changed. It is different from `INVALID`,
which means that the input is malformed. The usual response to
`AUTHENTICATION` is to close the connection, not to try again. `Open`
verifies the tag before it decrypts. As a result, a failed call returns no
plaintext.

## `crypto.x25519PublicKey()`

```nio
byte[] crypto.x25519PublicKey(byte[] privateKey)
```

X25519 Diffie-Hellman key agreement (RFC 7748). A private key is 32 random
bytes. The function applies the required bit clamping. `x25519PublicKey`
returns the public key for a private key. When two parties exchange public
keys, each one calculates the same 32-byte shared secret with
[`x25519SharedSecret`](#cryptox25519sharedsecret).

```nio
import 'crypto';

byte[] privateKey = crypto.randomBytes(32);   // keep this secret
byte[] publicKey = crypto.x25519PublicKey(privateKey);   // send this to the peer
print(publicKey.length);   // 32
```

## `crypto.x25519SharedSecret()`

```nio
byte[]! crypto.x25519SharedSecret(byte[] privateKey, byte[] peerPublicKey)
```

Returns the 32-byte shared secret from the caller's private key and the peer's
public key (see [`x25519PublicKey`](#cryptox25519publickey)). Both parties
calculate the same value.

```nio
import 'crypto';

// Each side, independently:
byte[] alicePrivate = crypto.randomBytes(32);
byte[] alicePublic = crypto.x25519PublicKey(alicePrivate);

byte[] bobPrivate = crypto.randomBytes(32);
byte[] bobPublic = crypto.x25519PublicKey(bobPrivate);

// After exchanging the public keys, both compute the same secret:
byte[]? aliceSecret = crypto.x25519SharedSecret(alicePrivate, bobPublic) catch e {
    print("unusable public key from peer");
};
byte[]? bobSecret = crypto.x25519SharedSecret(bobPrivate, alicePublic) catch e {
    print("unusable public key from peer");
};
if (aliceSecret != null && bobSecret != null) {
    print(crypto.hexEncode(aliceSecret) == crypto.hexEncode(bobSecret));   // true
}
```

**Do not use the shared secret directly as a key.** Its bits are not uniformly random. Derive keys from it with HKDF:

```nio
import 'crypto';
import 'string';

byte[] deriveSessionKey(byte[] shared) {
    byte[] prk = crypto.hkdfExtractSha256(string.toByteArray(""), shared);
    return crypto.hkdfExpandSha256(prk, string.toByteArray("session"), 32);
}
```

`x25519SharedSecret` fails with `crypto.ErrorCode.INVALID` when the peer's
public key has small order. Such a key forces the shared secret to a value
that the peer selects. TLS 1.3 requires this check. Because the function is
fallible, the caller cannot skip the check.

## `crypto.base64Encode()`

```nio
String crypto.base64Encode(byte[] data)
```

Encodes `data` as standard base64 (RFC 4648 §4), with padding.

```nio
import 'crypto';
import 'string';

print(crypto.base64Encode(string.toByteArray("foobar")));   // Zm9vYmFy
```

## `crypto.base64Decode()`

```nio
byte[]! crypto.base64Decode(String s)
```

Decodes standard base64 (RFC 4648 §4), with padding. Decoding is strict. It
accepts only the standard alphabet, with correct padding and no whitespace.
All other input fails with `crypto.ErrorCode.INVALID`.

```nio
import 'crypto';
import 'string';

byte[]? decoded = crypto.base64Decode("Zm9vYmFy") catch e {
    print(e.message);
};
if (decoded != null) {
    print(string.fromByteArray(decoded));   // foobar
}
```

## `crypto.hexEncode()`

```nio
String crypto.hexEncode(byte[] data)
```

Encodes `data` as hex: two lower-case characters for each byte.

```nio
import 'crypto';
import 'string';

print(crypto.hexEncode(string.toByteArray("Hi!")));   // 486921
```

## `crypto.hexDecode()`

```nio
byte[]! crypto.hexDecode(String s)
```

Decodes hex, two characters for each byte. It accepts upper and lower case.
It fails with `crypto.ErrorCode.INVALID` on an odd length or on a character
that is not a hex digit.

```nio
import 'crypto';
import 'string';

byte[]? decoded = crypto.hexDecode("48692A") catch e {
    print(e.message);
};
if (decoded != null) {
    print(string.fromByteArray(decoded));   // Hi*
}
```

## `crypto.randomBytes()`

```nio
byte[] crypto.randomBytes(int n)
```

Returns `n` cryptographically secure random bytes from the operating system
(`getentropy` on macOS, `getrandom` on Linux, `BCryptGenRandom` on Windows).
They are suitable for keys, tokens and nonces. If the system generator fails, the
program stops. There is no weaker fallback.

## `crypto.rsaVerifyPkcs1v15()`

```nio
void! crypto.rsaVerifyPkcs1v15(byte[] modulus, int exponent, String hash,
                               byte[] digest, byte[] signature)
```

Verifies an RSA PKCS #1 v1.5 signature over a digest that is already
calculated. `hash` names the hash function that made the digest: `"sha256"`
or `"sha384"`. `modulus` is the key's modulus without a leading zero byte.

**The function returns no value.** It raises an error when the signature
does not verify. As a result, the caller cannot ignore a failed verification:

```nio
import 'crypto';

void check(byte[] modulus, byte[] message, byte[] signature) {
    crypto.rsaVerifyPkcs1v15(modulus, 65537, "sha256", crypto.sha256(message), signature) catch e {
        print("not signed by that key");
        return;
    };
    print("signed");
}
```

The error code identifies the type of failure:

| Code | Means |
|---|---|
| `crypto.ErrorCode.INVALID` | The key or the signature is not usable: a modulus under 1024 bits or over 8192 bits, an even modulus, an even exponent or an exponent outside 3…2³¹−1, a digest of the wrong length for the named hash, a signature that is not the same length as the modulus, or a signature that is not less than the modulus. |
| `crypto.ErrorCode.AUTHENTICATION` | The key and the signature are well formed, but the signature does not verify. |

SHA-1 and MD5 are not accepted as hash names, because chosen-prefix
collision attacks against SHA-1 are practical.

## `crypto.rsaVerifyPss()`

```nio
void! crypto.rsaVerifyPss(byte[] modulus, int exponent, String hash,
                          byte[] digest, byte[] signature)
```

Verifies an RSA-PSS signature over a digest that is already calculated. The
arguments, the accepted hash names and the two error codes are the same as
for [`rsaVerifyPkcs1v15`](#cryptorsaverifypkcs1v15). It also returns no value
and raises an error on failure.

`rsaVerifyPss` expects the TLS 1.3 profile: MGF1 with the same hash, and a
salt length equal to the hash length.

```nio
import 'crypto';

void check(byte[] modulus, byte[] message, byte[] signature) {
    crypto.rsaVerifyPss(modulus, 65537, "sha256", crypto.sha256(message), signature) catch e {
        print("not signed by that key");
        return;
    };
    print("signed");
}
```

## `crypto.aes128GcmSeal()`

```nio
byte[]! crypto.aes128GcmSeal(byte[] key, byte[] nonce, byte[] plaintext, byte[] aad)
```

AES-128-GCM is the second AEAD cipher that TLS 1.3 uses. The key is 16 bytes and the nonce is 12 bytes. The 16-byte tag is appended to the ciphertext. The format is the same as for [`chacha20Poly1305Seal`](#cryptochacha20poly1305seal). A caller can use the two ciphers in the same way. [`aes128GcmOpen`](#cryptoaes128gcmopen) verifies the tag and returns the plaintext.

> [!WARNING]
>
> **AES-128-GCM is available only on processors with AES instructions.** On other processors, both functions fail, including `aes128GcmSeal`. The ChaCha20-Poly1305 seal function does not fail. Call [`crypto.aesGcmAvailable()`](#cryptoaesgcmavailable) to check the processor before use.
>
> There is no software implementation of AES.

```nio
import 'crypto';
import 'string';

void sealOne() {
    if (!crypto.aesGcmAvailable()) {
        print("no AES instructions on this CPU; use ChaCha20-Poly1305");
        return;
    }
    byte[] key = crypto.randomBytes(16);
    byte[] nonce = crypto.randomBytes(12);
    byte[] aad = string.toByteArray("msg-1");
    byte[] sealed = crypto.aes128GcmSeal(key, nonce, string.toByteArray("hello"), aad) catch e { return; };
    print(sealed.length);   // 21: 5 bytes of ciphertext and the 16-byte tag
}
```

**Do not use a nonce two times with the same key.** The rule and the consequences are the same as for ChaCha20-Poly1305. With GCM, a repeated nonce discloses the GHASH authentication key, and an attacker can then forge any message.

## `crypto.aes128GcmOpen()`

```nio
byte[]! crypto.aes128GcmOpen(byte[] key, byte[] nonce, byte[] ciphertext, byte[] aad)
```

Verifies the tag on a message from [`aes128GcmSeal`](#cryptoaes128gcmseal)
and returns the plaintext, or fails. The sizes and the processor requirement
are the same as for `aes128GcmSeal`. A forged or changed message fails with
`crypto.ErrorCode.AUTHENTICATION`.

```nio
import 'crypto';
import 'string';

void roundTrip() {
    if (!crypto.aesGcmAvailable()) {
        print("no AES instructions on this CPU; use ChaCha20-Poly1305");
        return;
    }
    byte[] key = crypto.randomBytes(16);
    byte[] nonce = crypto.randomBytes(12);
    byte[] aad = string.toByteArray("msg-1");
    byte[] sealed = crypto.aes128GcmSeal(key, nonce, string.toByteArray("hello"), aad) catch e { return; };
    byte[] plain = crypto.aes128GcmOpen(key, nonce, sealed, aad) catch e {
        print("forged or corrupted");   // e.code == crypto.ErrorCode.AUTHENTICATION
        return;
    };
    print(string.fromByteArray(plain));   // hello
}
```

## `crypto.aesGcmAvailable()`

```nio
bool crypto.aesGcmAvailable()
```

Returns `true` if this processor can run AES-128-GCM, that is, if
[`aes128GcmSeal`](#cryptoaes128gcmseal) and
[`aes128GcmOpen`](#cryptoaes128gcmopen) work on it. A program must check it before
it uses those functions.

```nio
import 'crypto';

if (crypto.aesGcmAvailable()) {
    print("AES-128-GCM");
} else {
    print("ChaCha20-Poly1305");
}
```

## `crypto.ecdsaVerify()`

```nio
void! crypto.ecdsaVerify(String curve, byte[] publicKey, byte[] digest,
                         byte[] r, byte[] s)
```

Verifies an ECDSA signature on the P-256 or P-384 curve. Like the RSA
functions, it returns no value and raises an error on failure. `curve` is
`"p256"` or `"p384"`. The function does not infer the curve from the key
length. `publicKey` is the SEC 1 uncompressed point (`0x04 ‖ X ‖ Y`), which
is the only form that certificates contain. `r` and `s` are the two integers
of the signature as big-endian bytes, already decoded from DER.
[`x509.parseEcdsaSignature`](/docs/stdlib/x509) decodes them.

```nio
import 'crypto';
import 'x509';

void check(byte[] publicKey, byte[] message, byte[] derSignature) {
    x509.EcdsaSignature sig = x509.parseEcdsaSignature(derSignature) catch e { return; };
    crypto.ecdsaVerify("p256", publicKey, crypto.sha256(message), sig.r, sig.s) catch e {
        print("not signed by that key");
        return;
    };
    print("signed");
}
```

The error codes are the same as for [the RSA functions](#cryptorsaverifypkcs1v15). A key that is not an uncompressed point
on the named curve, or an `r` or `s` outside 1…n−1, fails with `INVALID`. A
well-formed signature that does not verify fails with `AUTHENTICATION`. A
digest longer than the curve's order is truncated to its leftmost bytes, as
FIPS 186-5 specifies. As a result, a P-256 key can verify a SHA-384
signature.
