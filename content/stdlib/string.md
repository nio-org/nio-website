---
title: "string module"
description: "The Nio string module: search, split, join, slice, trim, convert and compare strings, including UTF-8 code points and constant-time comparison."
---

# String

## Introduction

```nio
import 'string';           // or: import 'string' as str;
```

The `String` *type* is built into the language; the `string` *functions* live in a built-in module that must be imported first. They search, slice apart, join back together, reshape, and measure strings, convert between a string and its raw bytes, and convert between a string and the value it spells.

## Notes

* Strings are **immutable**. Every function here leaves its arguments untouched and returns its result as a new string — there is no in-place variant of anything.
* Positions and lengths count **bytes**, not characters, so a multi-byte UTF-8 character counts as many elements as it has bytes. `string.length("café")` is 5. What counts characters is `runeCount`, and what walks them is `forEach` over the string (see [Basics](/docs/basics#strings-are-bytes)).
* Case mapping covers **ASCII only**, and the names say so: `toUpperCaseAscii` and `toLowerCaseAscii` leave every byte outside `a`–`z` / `A`–`Z` exactly as it was. Full Unicode case mapping is a table that belongs in a package.
* Strings can contain any byte, including `0`. Indexing a string returns a read-only `byte`; use `toByteArray` and `fromByteArray` to convert the complete value.

## `string.append()`

```nio
String string.append(String s, String t)
```

`string.append(s, t)` returns `s` followed by `t`. It is the same operation as `s + t`, spelled as a function for when one is wanted as a value.

```nio
import 'string';

print(string.append("nio", "lang"));   // niolang
print("nio" + "lang");                 // niolang — the same thing
```

## `string.equalsConstantTime()`

```nio
bool string.equalsConstantTime(String a, String b)
```

Reports whether `a` and `b` hold the same bytes, in a time that depends only on their length — never on *where* they first differ. [`string.bytesEqualConstantTime`](#stringbytesequalconstanttime) is the same comparison for two `byte[]` values.

Use it whenever one side is a secret: a session token, an API key, a MAC or a signature.

```nio
import 'string';

bool checkToken(String presented, String expected) {
    return string.equalsConstantTime(presented, expected);
}

print(checkToken("s3cret", "s3cret"));   // true
print(checkToken("s3creT", "s3cret"));   // false
```

`==` is the wrong tool there. It stops at the first differing byte, so how long it takes tells an attacker how much of their guess was right, and a guess can be refined one byte at a time until it is correct. The constant-time functions combine every byte and test once at the end, so there is no early exit to measure.

What they do **not** hide is the length: two values of different lengths are unequal without reading a byte of either. That is deliberate — the length of a token or a MAC is public. If the length itself is the secret, pad before comparing.

It allocates nothing, so a [`noalloc`](/docs/memory) function can call it.

## `string.bytesEqualConstantTime()`

```nio
bool string.bytesEqualConstantTime(byte[] a, byte[] b)
```

Reports whether `a` and `b` hold the same bytes, in a time that depends only on their length — never on *where* they first differ. It is the `byte[]` form of [`string.equalsConstantTime`](#stringequalsconstanttime); read that section for why `==` is the wrong tool for a secret.

It does not hide the length: two arrays of different lengths are unequal without reading a byte of either. It allocates nothing, so a [`noalloc`](/docs/memory) function can call it.

```nio
import 'string';

byte[] expected = [1, 2, 3, 4];
byte[] presented = [1, 2, 3, 5];
print(string.bytesEqualConstantTime(presented, expected));     // false
print(string.bytesEqualConstantTime(expected, [1, 2, 3, 4]));  // true
```

## `string.contains()`

```nio
bool string.contains(String s, String sub)
```

`string.contains(s, sub)` reports whether `sub` occurs anywhere in `s`. The empty string occurs in every string, including the empty one.

```nio
import 'string';

print(string.contains("hello world", "lo w"));  // true
print(string.contains("hello", "H"));           // false — the search is exact
print(string.contains("hello", ""));            // true
```

## `string.copy()`

```nio
String string.copy(String s)
```

`string.copy(s)` returns a new string with the same bytes.

Since strings are immutable, a copy is never needed to protect one from change; it matters only when a fresh allocation is wanted for its own sake.

```nio
import 'string';

String s = "hello";
String c = string.copy(s);
print(c);          // hello
print(c == s);     // true — equality is by content
```

## `string.find()`

```nio
int string.find(String s, String sub)
```

`string.find(s, sub)` returns the **byte** index of the first occurrence of `sub` in `s`, or `-1` when there is none. Searching for the empty string answers `0`.

The result is a byte offset, not a character position.

```nio
import 'string';

print(string.find("my findValue", "findValue"));  // 3
print(string.find("hello", "z"));                 // -1
```

## `string.from()`

```nio
String string.from(any scalar v)
```

`string.from(v)` returns the text [`printInline`](/docs/basics#printing) writes for a string, number, `bool`, `DateTime`, `Duration`, enum, or an optional of one. It cannot fail.

Records, arrays, and maps use [`json.toText`](/docs/stdlib/json) instead.

```nio
import 'string';
import 'time';

enum Status { OK: 200, NOT_FOUND: 404 }

print("port " + string.from(8080));          // port 8080
print(string.from(0.1));                     // 0.1
print(string.from(true));                    // true
print(string.from(Status.NOT_FOUND));        // NOT_FOUND
print(string.from(time.duration("1s")));     // 1000

int? missing = null;
print(string.from(missing));                 // null
```

## `string.fromByteArray()`

```nio
String string.fromByteArray(byte[] bytes)
```

`string.fromByteArray(bytes)` builds a string from those bytes. A `0` element remains part of the result.

```nio
import 'string';

print(string.fromByteArray([104, 105]));                  // hi
print(string.fromByteArray(string.toByteArray("héllo"))); // héllo
print(string.length(string.fromByteArray([97, 0, 98])));  // 3
```

## `string.join()`

```nio
String string.join(String[] parts, String sep)
```

`string.join(parts, sep)` returns the elements of `parts` in order with `sep` between each adjacent pair — the inverse of [`split`](#stringsplit).

The separator goes *between* pieces, so it appears one time fewer than there are elements. An empty array joins to the empty string and a one-element array to that element, neither of them touching `sep`. Unlike `split`, an empty separator is fine here: it concatenates.

```nio
import 'string';

print(string.join(["a", "b", "c"], ", "));   // a, b, c
print(string.join(["a"], ", "));             // a — no separator to place
print(string.join([], ", "));                // (empty)
print(string.join(["a", "b"], ""));          // ab
print(string.join(string.split("a-b-c", "-"), "/"));   // a/b/c

String[] lines = ["first line", "second line"];
print(string.join(lines, "\n"));
// first line
// second line
```

## `string.length()`

```nio
int string.length(String s)
```

`string.length(s)` returns the length of `s` in bytes.

```nio
import 'string';

print(string.length("hello"));   // 5
print(string.length("héllo"));   // 6 — é is two bytes
print(string.length(""));        // 0
```

## `string.replace()`

```nio
String string.replace(String s, String old, String new)
```

`string.replace(s, old, new)` returns `s` with the **first** occurrence of `old` replaced by `new`. When `old` does not occur, the result is `s` unchanged — and so it is when `old` is empty, since every position matches it and none of them means anything.

```nio
import 'string';

print(string.replace("a-b-c", "-", "+"));   // a+b-c
print(string.replace("a-b-c", "z", "+"));   // a-b-c
print(string.replace("abc", "", "+"));      // abc — an empty old changes nothing
```

## `string.replaceAll()`

```nio
String string.replaceAll(String s, String old, String new)
```

`string.replaceAll(s, old, new)` returns `s` with **every** occurrence of `old` replaced by `new`, left to right. The replacements themselves are never rescanned, so a replacement that contains `old` does not loop. As in `replace`, an empty `old` leaves `s` unchanged.

```nio
import 'string';

print(string.replaceAll("a-b-c", "-", "+"));    // a+b+c
print(string.replaceAll("aa", "a", "aa"));      // aaaa — not rescanned
```

## `string.split()`

```nio
String[] string.split(String s, String sep)
```

`string.split(s, sep)` returns the pieces of `s` between occurrences of `sep`, separators omitted, as a new growable array.

It keeps empty pieces: a leading, trailing, or doubled separator contributes an empty string, so [`string.join(string.split(s, sep), sep)`](#stringjoin) is `s` again for any non-empty `sep`. A string with no separator in it splits into one piece — itself.

An empty separator causes a runtime error.

```nio
import 'string';
import 'json';

print(json.toText(string.split("hello - world", "-"))); // ["hello "," world"]
print(json.toText(string.split("a--b", "-")));          // ["a","","b"]
print(json.toText(string.split("-a-", "-")));           // ["","a",""]
print(json.toText(string.split("abc", ",")));           // ["abc"]
```

## `string.substring()`

```nio
String string.substring(String s, int start, int end)
```

`string.substring(s, start, end)` returns the bytes from `start` (inclusive) to `end` (exclusive). Bounds must satisfy `0 <= start <= end <= string.length(s)`; invalid bounds cause a runtime error.

```nio
import 'string';

String s = "hello world";
print(string.substring(s, 6, 11));   // world
print(string.substring(s, 0, 5));    // hello
print(string.substring("héllo", 1, 3));   // é — bytes, not characters

String line = "name: nio";
int at = string.find(line, ": ");
if (at >= 0) {
    print(string.substring(line, at + 2, string.length(line)));   // nio
}
```

## `string.toByteArray()`

```nio
byte[] string.toByteArray(String s)
```

`string.toByteArray(s)` returns the bytes of `s`, one `byte` element each, in a new growable array. Writing into that array does not change the string.

It is the byte-array form accepted by [`fs.writeFile`](/docs/stdlib/fs).

```nio
import 'string';
import 'json';

print(json.toText(string.toByteArray("Az")));  // [65,122]
print(json.toText(string.toByteArray("é")));   // [195,169]
```

## `string.toFloat()`

```nio
float string.toFloat(String s)   // fallible
```

`string.toFloat(s)` returns the float `s` spells. It accepts an optional sign, digits with an optional `.` fraction (either side of the dot may be empty, but not both), and an optional `e`/`E` exponent — and nothing else: no whitespace (`trim` first), no `inf`, no hex.

It is **fallible** ([errors](/docs/errors)): text that is not a number is the expected case for a parser, so it is an `Error` you can catch — or answer with a default — rather than a crash. A value too large for a float is an error too; one too small to distinguish from zero rounds there.

```nio
import 'string';

print(string.toFloat("3.14"));              // 3.14
print(string.toFloat("2.5e2"));             // 250
print(string.toFloat(".5"));                // 0.5
print(string.toFloat("x") catch -1.0);      // -1
string.toFloat("1e999") catch e {
    print(e.message);   // string.toFloat "1e999": out of range
}
```

## `string.toInt()`

```nio
int string.toInt(String s)   // fallible
```

`string.toInt(s)` returns the integer `s` spells: an optional sign followed by decimal digits, and nothing else — no whitespace (`trim` first), no separators, no hex.

It is **fallible** ([errors](/docs/errors)), like `toFloat`: text that is not an integer, or an integer that does not fit in 64 bits, is an `Error` rather than a crash or a silent wrap. Catch it, or let it propagate like any other error.

```nio
import 'string';

print(string.toInt("42"));                  // 42
print(string.toInt("-42"));                 // -42
print(string.toInt("abc") catch 0);         // 0 — the default answers
print(string.toInt(" 42") catch 0);         // 0 — trim first
string.toInt("12x") catch e {
    print(e.message);   // string.toInt "12x": not an integer
}

int parsePort(String text) {
    return string.toInt(text);
}
int port = parsePort("8080") catch 80;
print(port);                                  // 8080
```

## `string.toLowerCaseAscii()`

```nio
String string.toLowerCaseAscii(String s)
```

`string.toLowerCaseAscii(s)` returns `s` with ASCII `A`–`Z` mapped to `a`–`z`, and every other byte left alone. The name is the promise: what a byte-oriented function can honestly do is the ASCII half.

```nio
import 'string';

print(string.toLowerCaseAscii("NIO Lang"));   // nio lang
print(string.toLowerCaseAscii("ÉCOLE"));      // École — only the ASCII letters change
```

## `string.toUint()`

```nio
uint string.toUint(String s)   // fallible
```

`string.toUint(s)` returns the unsigned integer `s` spells: an optional `+` followed by decimal digits. It is `toInt` in the [unsigned family](/docs/basics#the-unsigned-types), and it exists because `toInt` cannot stand in for it — an `int` does not assign to a `uint`, and the top half of a `uint64` has no `int` to come back as.

It is **fallible** for the same reasons `toInt` is, with one case of its own: a well-formed negative is *out of range* rather than badly shaped, since `-1` is a perfectly good integer and simply not one this type has.

```nio
import 'string';

print(string.toUint("42"));                          // 42
print(string.toUint("18446744073709551615"));        // the largest uint64
print(string.toUint("abc") catch 0);                 // 0 — the default answers
string.toUint("-1") catch e {
    print(e.message);   // string.toUint "-1": out of range
}
```

## `string.toUpperCaseAscii()`

```nio
String string.toUpperCaseAscii(String s)
```

`string.toUpperCaseAscii(s)` returns `s` with ASCII `a`–`z` mapped to `A`–`Z`, and every other byte left alone. `toUpperCaseAscii("straße")` is `"STRAßE"`: the `ß` is not an ASCII letter, so it stays.

```nio
import 'string';

print(string.toUpperCaseAscii("nio"));        // NIO
print(string.toUpperCaseAscii("nio-lang_1")); // NIO-LANG_1
```

## `string.trim()`

```nio
String string.trim(String s)
```

`string.trim(s)` returns `s` without leading and trailing whitespace. Whitespace inside the string is kept.

```nio
import 'string';

print(string.trim("  Hello, World  "));   // Hello, World
print(string.trim("\n\tx\n"));            // x
print(string.length(string.trim("   ")));  // 0
```

## `string.runeCount()`

```nio
int string.runeCount(String s)
```

How many code points `forEach` over `s` would visit: each valid UTF-8 sequence counts one, and each byte outside a valid sequence counts one. `string.runeCount("café")` is 4 where `string.length` is 5.

```nio
import 'string';

print(string.runeCount("café"));    // 4
print(string.length("café"));       // 5
```

## `string.runeAt()`

```nio
int string.runeAt(String s, int i)
```

The code point that starts at **byte** offset `i` — exactly what `forEach` binds at that offset — or `0xFFFD` for a byte that begins no valid sequence. An `i` outside `0 ≤ i < string.length(s)` is a runtime error.

The offset is a byte offset, not a character index, so the call costs nothing. Finding the *n*-th character means walking to it, and that is written as the walk:

```nio
import 'string';

String s = "héllo";
print(string.runeAt(s, 1));    // 233, which is é

int n = 0;
forEach(s, r, i) {
    if (n == 3) {
        print(string.fromRunes([r]));    // l, the fourth character
    }
    n++;
}
```

## `string.fromRunes()`

```nio
String string.fromRunes(int[] runes)
```

The UTF-8 encoding of each code point in turn. A value that is not a code point — negative, above `0x10FFFF`, or in the surrogate range `0xD800`–`0xDFFF` — is written as `0xFFFD`, so the result is always valid UTF-8.

```nio
import 'string';

print(string.fromRunes([104, 233, 108, 108, 111]));    // héllo
print(string.fromRunes([0x1F600]));                    // 😀, four bytes
```

## `string.isValidUtf8()`

```nio
bool string.isValidUtf8(String s)
```

Whether every byte of `s` belongs to a valid UTF-8 sequence: no overlong encodings, no surrogates, nothing above `0x10FFFF`, and no truncated tail. Every string a program builds from literals and from `fromRunes` is valid; one read from a file or a socket may not be, and `substring` can cut a character in half. Check before handing text on to something that will refuse it.

```nio
import 'string';

print(string.isValidUtf8("café"));                             // true
print(string.isValidUtf8(string.substring("café", 0, 4)));     // false: half of é
print(string.isValidUtf8(string.fromByteArray([0xC0, 0x80]))); // false: overlong NUL
```
