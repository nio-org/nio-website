---
title: "regexp module: regular expressions"
description: "The Nio regexp module creates regular expressions and searches strings with them. Matching always runs in linear time."
---

# RegExp

## Introduction

```nio
import 'regexp';
```

The `regexp` module creates regular expressions and uses them to search strings.

```nio
import 'regexp';

RegExp digits = regexp.create("[0-9]+");

print(regexp.match("order 42", digits));   // true
print(regexp.find("order 42", digits));    // 6
```

## Notes

* Create a `RegExp` once and reuse it for multiple searches.
* `regexp.create` is fallible, so a pattern from a user or config file can be handled with `catch`.
* Matching works on bytes. Returned positions are byte offsets, `.` matches one byte, and case-insensitive matching covers ASCII letters.
* Matching time is bounded by the subject length and pattern size; patterns do not cause catastrophic backtracking.
* A pattern that begins with literal text — or with `\b` or `^` and then literal text — is much faster over a long subject: the search scans for that text and only runs the pattern where it could match. A pattern beginning with `.` or `.*`, or one that can match the empty string, gives the search nothing to scan for: `the .*cat` scans for `the `, where `.*the cat` is tried at every position.
* `RegExp` values can be stored and passed around, but they cannot be printed, compared, or serialized.
* A `RegExp` variable must be initialized with `regexp.create` before it is used.

## `regexp.create()`

```nio
RegExp regexp.create(String pattern, String? flags)
```

Compiles a pattern. Leave out `flags`, or pass `""`, for the default behavior.

The available flags are:

| Flag | Effect |
| --- | --- |
| `i` | Match ASCII letters without regard to case. |
| `m` | Let `^` and `$` also match line boundaries. |
| `s` | Let `.` match a newline. |

Invalid patterns and unknown flags produce a catchable error.

The supported pattern syntax is:

| Construct | Meaning |
| --- | --- |
| `abc` | Literal bytes |
| `.` | Any byte except newline, unless `s` is enabled |
| `^` `$` | Start and end of text, or line with `m` |
| `\b` `\B` | ASCII word boundary, or not a boundary |
| `x*` `x+` `x?` | Zero or more, one or more, optional |
| `x{n}` `x{n,}` `x{n,m}` | Counted repetition |
| `x*?` `x+?` `x??` `x{n,m}?` | Lazy repetition |
| `a\|b` | Either `a` or `b` |
| `(…)` `(?:…)` | Grouping |
| `[abc]` `[^abc]` `[a-z]` | Byte sets and ranges |
| `\d` `\D` | Digit, or not a digit |
| `\w` `\W` | ASCII word byte, or not a word byte |
| `\s` `\S` | Whitespace, or not whitespace |
| `\n` `\r` `\t` `\f` `\v` `\0` `\xHH` | Escaped byte |

Backslashes must be escaped in Nio strings. Groups are available for repetition and alternatives, but captures cannot be read. Backreferences, lookahead, lookbehind, inline flags, Unicode classes, and POSIX named classes are not supported.

```nio
import 'regexp';

RegExp digits = regexp.create("\\d+");
RegExp caseless = regexp.create("hello", "i");

print(regexp.match("year 2026", digits));       // true
print(regexp.match("HELLO", caseless));         // true

RegExp? invalid = regexp.create("a(b") catch e {
    print(e.message);
};
print(invalid == null);                         // true
```

## `regexp.find()`

```nio
int regexp.find(String text, RegExp pattern)
```

Returns the byte offset where the leftmost match begins, or `-1` when there is no match.

```nio
import 'regexp';
import 'string';

String log = "level=warn message=disk full";
RegExp message = regexp.create("message=.*");
int start = regexp.find(log, message);

if (start >= 0) {
    print(string.substring(log, start, string.length(log)));
    // message=disk full
}
```

## `regexp.match()`

```nio
bool regexp.match(String text, RegExp pattern)
```

Reports whether the pattern matches anywhere in the string. Use `^` and `$` when the entire string must match.

```nio
import 'regexp';

RegExp email = regexp.create(
    "^[\\w.]+@[\\w.]+\\.[a-z]{2,}$",
    "i"
);

print(regexp.match("nio@example.com", email));   // true
print(regexp.match("not an address", email));    // false

print(regexp.match("xxabcyy", regexp.create("abc")));    // true
print(regexp.match("xxabcyy", regexp.create("^abc$")));  // false
```
