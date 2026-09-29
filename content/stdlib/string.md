---
title: "string module"
description: "The Nio string module: search, split, join, slice, trim, convert and compare strings, including UTF-8 code points and constant-time comparison."
---

# String

## Introduction

```nio
import 'string';           // or: import 'string' as str;
```

The `String` *type* is built into the language. The `string` *functions* are in a built-in module that a program must import first. The functions search, split, join, change and measure strings. They also convert between a string and its bytes, and between a string and the value that it represents.

## Notes

* Strings are **immutable**. No function in this module changes its arguments. Each function returns its result as a new string.
* Positions and lengths count **bytes**, not characters. A multi-byte UTF-8 character counts as one element for each of its bytes. `string.length("café")` is 5. `runeCount` counts characters. `forEach` over the string iterates over characters (see [Basics](/docs/basics#strings-are-bytes)).
* Case mapping covers **ASCII only**. `toUpperCaseAscii` and `toLowerCaseAscii` do not change bytes outside `a`–`z` and `A`–`Z`.
* Strings can contain any byte, including `0`. Indexing a string returns a read-only `byte`. `toByteArray` and `fromByteArray` convert the complete value.

## `string.append()`

```nio
String string.append(String s, String t)
```

`string.append(s, t)` returns `s` followed by `t`. It is the same operation as `s + t`. It is useful when a program needs the operation as a function value.

```nio
import 'string';

print(string.append("nio", "lang"));   // niolang
print("nio" + "lang");                 // niolang — the same thing
```

## `string.equalsConstantTime()`

```nio
bool string.equalsConstantTime(String a, String b)
```

Reports whether `a` and `b` hold the same bytes. The time that it takes depends only on their length. It does not depend on the position of the first difference. [`string.bytesEqualConstantTime`](#stringbytesequalconstanttime) is the same comparison for two `byte[]` values.

It is the correct comparison when one side is a secret: a session token, an API key, a MAC or a signature.

```nio
import 'string';

bool checkToken(String presented, String expected) {
    return string.equalsConstantTime(presented, expected);
}

print(checkToken("s3cret", "s3cret"));   // true
print(checkToken("s3creT", "s3cret"));   // false
```

`==` is not safe for secrets. `==` stops at the first byte that is different. Its duration tells an attacker how many bytes of a guess are correct. An attacker can then find the secret one byte at a time. The constant-time functions compare every byte and test the result once, at the end.

These functions do **not** hide the length. If the two values have different lengths, the result is `false` and no bytes are read. When the length is a secret, the caller must pad the values to the same length before the comparison.

It allocates nothing. A [`noalloc`](/docs/memory) function can call it.

## `string.bytesEqualConstantTime()`

```nio
bool string.bytesEqualConstantTime(byte[] a, byte[] b)
```

Reports whether `a` and `b` hold the same bytes. The time that it takes depends only on their length. It does not depend on the position of the first difference. It is the `byte[]` form of [`string.equalsConstantTime`](#stringequalsconstanttime). That section tells why `==` is not safe for secrets.

It does not hide the length. If the two arrays have different lengths, the result is `false` and no bytes are read. It allocates nothing. A [`noalloc`](/docs/memory) function can call it.

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

Strings are immutable. A copy is not necessary to protect a string from changes. `copy` is only for a program that needs a new allocation.

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

`string.find(s, sub)` returns the **byte** index of the first occurrence of `sub` in `s`, or `-1` when there is none. A search for the empty string returns `0`.

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

`string.fromByteArray(bytes)` returns a string that holds those bytes. A `0` element stays in the result.

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

`string.join(parts, sep)` returns the elements of `parts` in order with `sep` between each adjacent pair. It is the inverse of [`split`](#stringsplit).

The separator goes only *between* elements. The result holds one separator fewer than there are elements. An empty array gives the empty string. A one-element array gives that element, with no separator. An empty separator is permitted: the elements are joined with nothing between them.

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

`string.replace(s, old, new)` returns `s` with the **first** occurrence of `old` replaced by `new`. When `old` does not occur, or when `old` is empty, the result is `s` unchanged.

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

`string.replaceAll(s, old, new)` returns `s` with **every** occurrence of `old` replaced by `new`, left to right. The function does not search the inserted text again. As a result, a `new` that contains `old` does not cause a loop. As in `replace`, an empty `old` leaves `s` unchanged.

```nio
import 'string';

print(string.replaceAll("a-b-c", "-", "+"));    // a+b+c
print(string.replaceAll("aa", "a", "aa"));      // aaaa — not rescanned
```

## `string.split()`

```nio
String[] string.split(String s, String sep)
```

`string.split(s, sep)` returns the parts of `s` between occurrences of `sep`, without the separators, in a new growable array.

It keeps empty parts. A leading, trailing or doubled separator gives an empty string. As a result, [`string.join(string.split(s, sep), sep)`](#stringjoin) is equal to `s` for any non-empty `sep`. If `s` does not contain `sep`, the result is an array that holds only `s`.

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

[`fs.writeFile`](/docs/stdlib/fs) accepts this byte-array form.

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

`string.toFloat(s)` returns the float that `s` represents. It accepts an optional sign, then digits with an optional `.` fraction, then an optional `e` or `E` exponent. Either side of the `.` can be empty, but not both. It accepts nothing else: no whitespace, no `inf` and no hexadecimal. `trim` removes whitespace before the conversion.

It is **fallible** ([errors](/docs/errors)). If the text is not a number, the function raises an `Error`. The caller can catch the error or replace it with a default value. A value too large for a float is also an error. A value too small to distinguish from zero rounds to zero.

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

`string.toInt(s)` returns the integer that `s` represents. `s` must be an optional sign followed by decimal digits. It must not contain whitespace, separators or hexadecimal digits. `trim` removes whitespace before the conversion.

It is **fallible** ([errors](/docs/errors)), like `toFloat`. Text that is not an integer, or an integer that does not fit in 64 bits, is an `Error`. The function does not stop the program and does not wrap the value. The caller can catch the error, or let it propagate like any other error.

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

`string.toLowerCaseAscii(s)` returns `s` with ASCII `A`–`Z` changed to `a`–`z`. It does not change other bytes.

```nio
import 'string';

print(string.toLowerCaseAscii("NIO Lang"));   // nio lang
print(string.toLowerCaseAscii("ÉCOLE"));      // École — only the ASCII letters change
```

## `string.toUint()`

```nio
uint string.toUint(String s)   // fallible
```

`string.toUint(s)` returns the unsigned integer that `s` represents: an optional `+` followed by decimal digits. It is the form of `toInt` for the [unsigned family](/docs/basics#the-unsigned-types). `toInt` cannot do this, because an `int` does not assign to a `uint`, and values in the top half of the `uint64` range do not fit in an `int`.

It is **fallible** for the same reasons as `toInt`. It also fails for a well-formed negative number, with an *out of range* error, not a format error.

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

`string.toUpperCaseAscii(s)` returns `s` with ASCII `a`–`z` changed to `A`–`Z`. It does not change other bytes. `toUpperCaseAscii("straße")` is `"STRAßE"`, because `ß` is not an ASCII letter.

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

Returns the number of code points that `forEach` visits in `s`. Each valid UTF-8 sequence counts as one, and each byte outside a valid sequence counts as one. `string.runeCount("café")` is 4, and `string.length("café")` is 5.

```nio
import 'string';

print(string.runeCount("café"));    // 4
print(string.length("café"));       // 5
```

## `string.runeAt()`

```nio
int string.runeAt(String s, int i)
```

Returns the code point that starts at **byte** offset `i`. This is the same value that `forEach` binds at that offset. If the byte at `i` does not start a valid sequence, the result is `0xFFFD`. An `i` outside `0 ≤ i < string.length(s)` is a runtime error.

The offset is a byte offset, not a character index. As a result, the call does not iterate over the string. To find the *n*-th character, a program iterates with `forEach` and counts:

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

Returns a string that holds the UTF-8 encoding of each code point, in order. A value that is not a code point (negative, above `0x10FFFF`, or in the surrogate range `0xD800`–`0xDFFF`) is written as `0xFFFD`. Because of this, the result is always valid UTF-8.

```nio
import 'string';

print(string.fromRunes([104, 233, 108, 108, 111]));    // héllo
print(string.fromRunes([0x1F600]));                    // 😀, four bytes
```

## `string.isValidUtf8()`

```nio
bool string.isValidUtf8(String s)
```

Reports whether every byte of `s` is part of a valid UTF-8 sequence. Valid UTF-8 has no overlong encodings, no surrogates, no values above `0x10FFFF` and no incomplete sequence at the end. A string built from literals or from `fromRunes` is always valid. A string read from a file or a socket can be invalid, and `substring` can split a character. `isValidUtf8` checks the text before it goes to a function or system that requires valid UTF-8.

```nio
import 'string';

print(string.isValidUtf8("café"));                             // true
print(string.isValidUtf8(string.substring("café", 0, 4)));     // false: half of é
print(string.isValidUtf8(string.fromByteArray([0xC0, 0x80]))); // false: overlong NUL
```
