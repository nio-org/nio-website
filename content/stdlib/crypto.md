---
title: "crypto module"
description: "The Nio crypto module: SHA-256 and SHA-384, HMAC, HKDF, authenticated encryption, X25519, signature checks, and encoding helpers."
---

# Crypto

## Introduction

```nio
import 'crypto';
```

The `crypto` module holds the building blocks of secure software: hashing (SHA-256 and SHA-384), message authentication (HMAC), key derivation (HKDF), encryption (ChaCha20-Poly1305 and AES-128-GCM), key agreement (X25519), checking RSA and ECDSA signatures, base64 and hex encoding, and secure random bytes from the operating system.

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

* Everything works on `byte[]`. Hash a string by converting it first with
  `string.toByteArray`.
* The hash is part of each function's name (`sha256`, `sha384`), so a wrong
  algorithm name is a compile error, never a runtime surprise.
* **Never compare secrets with `==`** — it stops at the first differing
  byte, which leaks where the difference is to anyone who can time it.
  Compare a MAC, token, or tag with `string.bytesEqualConstantTime` or
  `string.equalsConstantTime`.
* `base64Decode` and `hexDecode` are fallible: text that does not decode
  raises an error with the code `crypto.ErrorCode.INVALID`, which `catch`
  handles like any other (see [Errors](/docs/errors)).
* The decoders are strict: no whitespace, exact padding, no trailing bits.
  Strip newlines yourself before decoding wrapped base64 (such as PEM
  contents).
* `randomBytes` is the operating system's generator. It cannot be
  configured or seeded, and the module offers no other randomness.
* Keys, nonces and curve points have fixed lengths (32 bytes, except the
  AEAD nonce at 12). Passing a different length stops the program — it is a
  bug, not bad input.
* **There is no signing here, and none is planned.** Signing is the most
  side-channel-fragile operation in a TLS stack, so this one simply does not
  contain it. The RSA and ECDSA functions verify only.

## `crypto.sha256()`

```nio
byte[] crypto.sha256(byte[] data)
```

The SHA-256 digest of `data`: 32 bytes.

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

The SHA-384 digest of `data`: 48 bytes.

```nio
import 'crypto';
import 'string';

print(crypto.sha384(string.toByteArray("")).length);   // 48
```

## `crypto.hmacSha256()`

```nio
byte[] crypto.hmacSha256(byte[] key, byte[] data)
```

The HMAC-SHA-256 of `data` under `key` (RFC 2104): 32 bytes. Use it to
authenticate a message with a shared secret; verify by recomputing and
comparing with `string.bytesEqualConstantTime`.

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

The HMAC-SHA-384 of `data` under `key` (RFC 2104): 48 bytes. Use and verify
it the same way as [`hmacSha256`](#cryptohmacsha256).

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

HKDF (RFC 5869) is the standard way to turn one secret into as many
independent keys as needed, in two steps. `hkdfExtractSha256` is the first:
it condenses input key material into a pseudorandom key.
[`hkdfExpandSha256`](#cryptohkdfexpandsha256) is the second. Both exist in
SHA-384 form as `hkdfExtractSha384` and `hkdfExpandSha384`.

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

The second step of HKDF. It stretches the pseudorandom key from
[`hkdfExtractSha256`](#cryptohkdfextractsha256) into `length` bytes, bound to
a context string `info`, so different contexts get unrelated keys. The
SHA-384 form is `hkdfExpandSha384`.

```nio
import 'crypto';
import 'string';

byte[] shared = crypto.randomBytes(32);            // some negotiated secret
byte[] prk = crypto.hkdfExtractSha256(string.toByteArray(""), shared);
byte[] encKey = crypto.hkdfExpandSha256(prk, string.toByteArray("enc"), 32);
byte[] macKey = crypto.hkdfExpandSha256(prk, string.toByteArray("mac"), 32);
```

`length` may not exceed 255 times the hash length (8160 bytes for SHA-256);
asking for more stops the program.

## `crypto.chacha20Poly1305Seal()`

```nio
byte[] crypto.chacha20Poly1305Seal(byte[] key, byte[] nonce, byte[] plaintext, byte[] aad)
```

Authenticated encryption (RFC 8439). `key` is 32 bytes, `nonce` is 12.
`Seal` returns the ciphertext with a 16-byte authentication tag appended;
[`chacha20Poly1305Open`](#cryptochacha20poly1305open) verifies that tag and
returns the plaintext.

`aad` ("additional authenticated data") is data that travels in the clear but
must not be alterable — a message header, a type byte, a sequence number.
Pass an empty array if there is none.

```nio
import 'crypto';
import 'string';

byte[] key = crypto.randomBytes(32);
byte[] nonce = crypto.randomBytes(12);

byte[] sealed = crypto.chacha20Poly1305Seal(key, nonce,
    string.toByteArray("attack at dawn"), string.toByteArray("msg-42"));
print(sealed.length);   // 30: 14 bytes of ciphertext and the 16-byte tag
```

**Never reuse a nonce with the same key.** Doing so destroys the secrecy of
both messages and leaks the authentication key, letting an attacker forge
freely. Either keep a per-key counter, or generate 12 fresh random bytes for
every message and transmit them next to the ciphertext (they are not
secret).

ChaCha20-Poly1305 works on every processor at full safety, which makes it the default choice. [AES-128-GCM](#cryptoaes128gcmseal) is also available, but only on processors with AES instructions.

## `crypto.chacha20Poly1305Open()`

```nio
byte[]! crypto.chacha20Poly1305Open(byte[] key, byte[] nonce, byte[] ciphertext, byte[] aad)
```

Verifies the tag on a message from
[`chacha20Poly1305Seal`](#cryptochacha20poly1305seal) and returns the
plaintext, or fails. Pass the same key, nonce and `aad` the message was
sealed with.

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

Failure carries `crypto.ErrorCode.AUTHENTICATION` rather than `INVALID`: the
message was readable and *is a forgery*, which usually means dropping the
connection rather than retrying. `Open` verifies before it decrypts, so a
failed call never yields partial plaintext.

## `crypto.x25519PublicKey()`

```nio
byte[] crypto.x25519PublicKey(byte[] privateKey)
```

X25519 Diffie-Hellman key agreement (RFC 7748). A private key is 32 random
bytes; the required bit-clamping happens inside. `x25519PublicKey` answers
the public key that goes with a private key. Two parties who exchange
public keys arrive at the same 32-byte shared secret with
[`x25519SharedSecret`](#cryptox25519sharedsecret).

```nio
import 'crypto';

byte[] privateKey = crypto.randomBytes(32);   // keep this secret
byte[] publicKey = crypto.x25519PublicKey(privateKey);   // send this to the peer
print(publicKey.length);   // 32
```

The curve arithmetic is fiat-crypto's formally verified code, used unmodified.

## `crypto.x25519SharedSecret()`

```nio
byte[]! crypto.x25519SharedSecret(byte[] privateKey, byte[] peerPublicKey)
```

The 32-byte shared secret from your own private key and the peer's public
key (see [`x25519PublicKey`](#cryptox25519publickey)). Both parties compute
the same value.

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

**Do not use the shared secret as a key directly.** It is not evenly random. Turn it into keys with HKDF:

```nio
import 'crypto';
import 'string';

byte[] deriveSessionKey(byte[] shared) {
    byte[] prk = crypto.hkdfExtractSha256(string.toByteArray(""), shared);
    return crypto.hkdfExpandSha256(prk, string.toByteArray("session"), 32);
}
```

`x25519SharedSecret` fails when the peer's public key has small order — a
key chosen to force the shared secret to a value the peer picked, which
would make the "agreement" meaningless. Rejecting it is mandatory for TLS
1.3, and this function is fallible so that the check cannot be skipped.

## `crypto.base64Encode()`

```nio
String crypto.base64Encode(byte[] data)
```

Standard base64 (RFC 4648 §4), with padding.

```nio
import 'crypto';
import 'string';

print(crypto.base64Encode(string.toByteArray("foobar")));   // Zm9vYmFy
```

## `crypto.base64Decode()`

```nio
byte[]! crypto.base64Decode(String s)
```

Decodes standard base64 (RFC 4648 §4), with padding. Decoding is strict —
the standard alphabet only, correct padding, no whitespace — and fails with
`crypto.ErrorCode.INVALID` on anything else.

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

Hex encoding: two characters per byte, in lower case.

```nio
import 'crypto';
import 'string';

print(crypto.hexEncode(string.toByteArray("Hi!")));   // 486921
```

## `crypto.hexDecode()`

```nio
byte[]! crypto.hexDecode(String s)
```

Decodes hex, two characters per byte. It accepts either case, and fails
with `crypto.ErrorCode.INVALID` on an odd length or a character that is not
a hex digit.

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

`n` cryptographically secure random bytes from the operating system
(`getentropy` on macOS, `getrandom` on Linux, `BCryptGenRandom` on Windows).
Suitable for keys, tokens, and nonces. If the system generator fails — which
does not happen on a working machine — the program stops; there is no weaker
fallback.

## `crypto.rsaVerifyPkcs1v15()`

```nio
void! crypto.rsaVerifyPkcs1v15(byte[] modulus, int exponent, String hash,
                               byte[] digest, byte[] signature)
```

Checks an RSA PKCS #1 v1.5 signature over an already-computed digest.
`hash` names the digest that produced it — `"sha256"` or `"sha384"` — and
`modulus` is the key's modulus without a leading zero byte.

**It answers nothing and fails instead.** A verifier that returned a `bool`
would eventually have a caller who forgot to test it, and that is a whole
family of real vulnerabilities. One that raises cannot be ignored:

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

The two failures are told apart, and it matters:

| Code | Means |
|---|---|
| `crypto.ErrorCode.INVALID` | The key or signature cannot be used at all — a modulus under 1024 bits or over 8192, an even modulus, an even exponent or one outside 3…2³¹−1, a digest of the wrong length for the named hash, a signature that is not exactly as long as the modulus, or one not below it. |
| `crypto.ErrorCode.AUTHENTICATION` | Everything was well-formed and the signature does not verify. |

SHA-1 and MD5 are not accepted as hash names. Chosen-prefix collisions
against SHA-1 are practical, so a signature over one means nothing.

This function and [`rsaVerifyPss`](#cryptorsaverifypss) are tested against Google's Wycheproof collection of known-tricky signatures. Only public values are involved, so neither function needs to guard against timing attacks.

## `crypto.rsaVerifyPss()`

```nio
void! crypto.rsaVerifyPss(byte[] modulus, int exponent, String hash,
                          byte[] digest, byte[] signature)
```

Checks an RSA-PSS signature over an already-computed digest. The arguments,
the accepted hash names, and the two failure codes are the same as for
[`rsaVerifyPkcs1v15`](#cryptorsaverifypkcs1v15), and it also answers nothing
and fails instead.

`rsaVerifyPss` expects the profile TLS 1.3 uses: MGF1 with the same hash, and
a salt length equal to the hash length.

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

AES-128-GCM, the other AEAD TLS 1.3 uses. A 16-byte key, a 12-byte nonce, and the 16-byte tag appended to the ciphertext — the same shape as [`chacha20Poly1305Seal`](#cryptochacha20poly1305seal), so the two are interchangeable to a caller that holds either. [`aes128GcmOpen`](#cryptoaes128gcmopen) verifies the tag and returns the plaintext.

> [!WARNING]
>
> **This cipher exists only where the CPU can run it in constant time**, and both functions — seal included, unlike the ChaCha pair — fail when it cannot. Ask [`crypto.aesGcmAvailable()`](#cryptoaesgcmavailable) first if you need to know before committing.
>
> There is no software fallback, and that is the point. A software AES is either a table indexed by key-derived bytes — a cache-timing oracle, and the most exploited implementation flaw the cipher has — or a bitsliced implementation, which is a project of its own. Refusing is the honest third option.

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

**A nonce may never repeat under one key** — the same rule, and the same consequences, as the ChaCha AEAD above. GCM is if anything less forgiving: repeating a nonce leaks the GHASH authentication key, after which an attacker can forge any message.

Everything is done with the processor's own AES instructions, and the implementation is tested against Google's Wycheproof vectors and against OpenSSL on both arm64 and x86-64.

## `crypto.aes128GcmOpen()`

```nio
byte[]! crypto.aes128GcmOpen(byte[] key, byte[] nonce, byte[] ciphertext, byte[] aad)
```

Verifies the tag on a message from [`aes128GcmSeal`](#cryptoaes128gcmseal)
and returns the plaintext, or fails. The sizes and the CPU requirement are
the same as for `aes128GcmSeal`. A forged or corrupted message fails with
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

Whether this processor can run AES-128-GCM, that is, whether
[`aes128GcmSeal`](#cryptoaes128gcmseal) and
[`aes128GcmOpen`](#cryptoaes128gcmopen) work here. Ask it first if you need
to know before committing.

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

The same contract for ECDSA over the two NIST curves the web serves.
`curve` is `"p256"` or `"p384"` — named rather than inferred from the key's
length, so a mistake is a loud `INVALID` rather than a quiet guess.
`publicKey` is the SEC 1 uncompressed point (`0x04 ‖ X ‖ Y`, the only form
certificates carry), and `r` and `s` are the signature's two integers as
big-endian bytes — already out of their DER, which is
[`x509.parseEcdsaSignature`](/docs/stdlib/x509)'s job, because ASN.1 parsing does not
belong in C.

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

The failure split is [the RSA one](#cryptorsaverifypkcs1v15): a key that is not an uncompressed point
on the named curve, or an `r` or `s` outside 1…n−1, is `INVALID`; a
well-formed signature that does not verify is `AUTHENTICATION`. A digest
longer than the curve's order is truncated to its leftmost bytes, which is
what FIPS 186-5 says and what lets a SHA-384 signature ride a P-256 key.

The arithmetic underneath is fiat-crypto's formally verified code, and the function is tested against Google's Wycheproof vectors for both curves.
