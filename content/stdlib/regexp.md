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

* A `RegExp` can be created once and used for multiple searches.
* `regexp.create` is fallible. When a pattern comes from a user or a config file, a `catch` handles its errors.
* Matching works on bytes. Returned positions are byte offsets, `.` matches one byte, and case-insensitive matching covers ASCII letters.
* Matching time is linear in the length of the subject. It also increases with the size of the pattern.
* On a long subject, a pattern that starts with literal text is much faster. This is also true when `\b` or `^` comes before the literal text. The search looks for that text and runs the pattern only at the positions where it can match.
* The search has no text to look for when a pattern starts with `.` or `.*`, or when a pattern can match the empty string. For example, the search for `the .*cat` looks for `the `. The search for `.*the cat` tries the pattern at each position.
* A program can store `RegExp` values and pass them to functions. It cannot print, compare, or serialize them.
* A `RegExp` variable must be initialized with `regexp.create` before it is used.

## `regexp.create()`

```nio
RegExp regexp.create(String pattern, String? flags)
```

Compiles a pattern. Without `flags`, or with `""`, the behavior is the default.

The available flags are:

| Flag | Effect |
| --- | --- |
| `i` | Match ASCII letters without regard to case. |
| `m` | `^` and `$` also match line boundaries. |
| `s` | `.` also matches a newline. |

An invalid pattern or an unknown flag raises a catchable error.

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

Each backslash in a Nio string must be escaped. Groups work with repetition and alternatives. Captures cannot be read. Backreferences, lookahead, lookbehind, inline flags, Unicode classes, and POSIX named classes are not supported.

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

Returns `true` when the pattern matches at a position in the string. A pattern that must match all of the string starts with `^` and ends with `$`.

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
