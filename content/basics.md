---
title: "Language basics"
description: "The basics of Nio: built-in types, variables, strings, optionals, records, enums, functions and control flow, with runnable examples."
---

# Basics

## Programs

A program is a sequence of top-level statements in a single `.nio` file, executed in order from top to bottom. There is no `main` function.

```nio
print("hello, world");
```

Every statement ends with `;`, except statements whose last token is `}` (blocks, declarations, record literals), where the semicolon is optional.

Comments come in two forms — `//` to the end of the line, and `/* */` over as many lines as you like:

```nio
// a line comment

/* a block comment,
   over several lines */

int x = 1 /* or between tokens */ + 2;
```

Block comments do not nest: the first `*/` closes the comment, whatever comes before it.

A comment means nothing to the compiler — two programs differing only in their comments produce the same binary. Your editor reads them, though, and there is one place it looks: **the comment block on the lines directly above a declaration**. That is what an editor shows when you hover the name, wherever it is used and whichever file it was imported from.

```nio
// A file comment. The blank line below is what keeps it the file's.

// Adds two numbers.
// Whichever two you pass.
int add(int a, int b) { return a + b; }

int seen = 0;   // a remark about seen, and about nothing after it
```

Consecutive `//` lines are one block, either form counts, and a blank line ends it.

## Printing

`print` and `printInline` write to standard output. They differ in one thing: `print` ends the line, `printInline` does not.

```nio
printInline("hello, ");
print("world");            // hello, world
```

Both take any number of values, written with a single space between two of them — and nothing before the first or after the last, apart from `print`'s newline:

```nio
print("x", 1, true);               // x 1 true
print();                           // an empty line
printInline("a", "b");             // a b, with the next print continuing the line
```

They take scalars: strings, any number type, `bool`, `DateTime`, `Duration`, and enums, or an optional of one of those. Strings print unquoted, an absent optional prints `null`, and records, arrays, and maps go through [`json.toText`](/docs/stdlib/json) first.

Every argument is evaluated before anything is written, so an argument that [raises an error](/docs/errors) leaves nothing behind on the line.

## Built-in types

| Type | Description | Zero value |
| --- | --- | --- |
| `int` | signed integer, as wide as the machine | `0` |
| `int8` | 8-bit signed integer, −128…127 | `0` |
| `int16` | 16-bit signed integer, −32768…32767 | `0` |
| `int32` | 32-bit signed integer, −2147483648…2147483647 | `0` |
| `int64` | 64-bit signed integer | `0` |
| `uint` | unsigned integer, as wide as the machine | `0` |
| `uint8` (alias `byte`) | 8-bit unsigned integer, 0…255 | `0` |
| `uint16` | 16-bit unsigned integer, 0…65535 | `0` |
| `uint32` | 32-bit unsigned integer, 0…4294967295 | `0` |
| `uint64` | 64-bit unsigned integer, 0…18446744073709551615 | `0` |
| `float` | IEEE 754 floating point, as wide as the machine | `0` |
| `float32` | 32-bit IEEE 754 floating point | `0` |
| `float64` | 64-bit IEEE 754 floating point | `0` |
| `String` | immutable byte string | `""` |
| `bool` | `true` or `false` | `false` |
| `DateTime` | an instant on the timeline (UTC, millisecond precision) | Unix epoch |
| `Duration` | a signed length of time, in milliseconds | `0` |

> [!NOTE]
>
> **Numeric types do not mix.** `1 + 1.5` is a compile error — write `1.0 + 1.5`. There are no implicit conversions between the integers and the floats, and none between the signed and unsigned integers either.

### Picking a number type

`int` and `float` are the ones to reach for. They are as wide as the machine you build for — 64 bits on a 64-bit machine, 32 on a 32-bit one — and they are types of their own, not other spellings of `int64` and `float64`. `uint` is the same thing for the unsigned family.

The sized types are for when the width is part of what the program *means*: a wire format, a file header, a JSON contract that promises a small number.

```nio
int count = 0;                 // the default choice
int32 recordId = 70000;        // 32 bits because the format says so
float32 temperature = 21.5;    // and 32-bit floats because it says that too
```

Anything narrower than `int` or `float` is a **storage type**: it holds a value and passes it around, but no operator produces one. To put a computed value back into one, write the conversion — see [Converting between number types](#converting-between-number-types).

```nio
int16 a = 300;
int16 b = 44;
int sum = a + b;               // arithmetic widens: a + b is an int
int16 nope = a + b;            // compile error: cannot use int as int16
a++;                           // compile error, for the same reason
```

Values move to any numeric type that holds **every** value of their own, and never back the other way:

```nio
int8 small = 100;
int32 wider = small;           // fine
float32 f = 0.5;
float64 g = f;                 // fine
int8 back = wider;             // compile error: cannot use int32 as int8
```

Literals are checked against the type they are going into, so a number that does not fit is caught at compile time rather than silently wrapping:

```nio
int8 ok = 127;
int8 tooBig = 200;             // compile error: cannot use int as int8
```

### The unsigned types

`uint`, `uint8`, `uint16`, `uint32` and `uint64` hold no negative value. They are what a program reaches for when a number cannot be negative in the first place — a count, a size, a bit pattern, a byte. `byte` is an alias for `uint8`, which is why every element of `string.toByteArray`, `fs.readFile` and a child's output is 0–255:

```nio
import 'string';

print("é"[0]);                 // 195, not −61
uint8 red = 255;
uint total = 0;
total = total - 1;             // 18446744073709551615 — unsigned wraps
```

They are a **family of their own**. An unsigned value and a signed one never meet in an operator, because neither type holds the other's values:

```nio
int i = 1;
uint u = 2;
bool oops = i < u;             // compile error: not defined on int and uint
uint bad = -u;                 // compile error: no negative values to produce
```

What does work is the pair where one side holds the other outright, and a plain number written next to an unsigned value:

```nio
byte b = 200;
int widened = b + 1;           // fine: every byte is an int
uint count = 3;
print(count == 3, count > 0);  // true true — the literal takes the uint type
```


A `float32` literal is rounded to the nearest 32-bit value, which is not an error — `0.1` is inexact at any width. It does mean a `float32` is not equal to the 64-bit literal that looks like it:

```nio
float32 tenth = 0.1;
print(tenth);                // 0.1     (printed at 32-bit precision)
print(tenth == 0.1);         // false   (0.1 on the right is a float64)
print(tenth + tenth);        // 0.20000000298023224  (the sum is a float64)
```

### Writing a number in hexadecimal

An integer literal can be written as `0x` (or `0X`) and hexadecimal digits. Both cases work in the prefix and in the digits:

```nio
int  mask  = 0xFF;             // 255
int  big   = 0xDEADBEEF;       // 3735928559
uint every = 0xFFFFFFFF;       // 4294967295
byte high  = 0x80;             // 128
int  low   = -0x80;            // −128 — a minus applied to the literal
print(0x10 == 16);             // true
```

This is a second **spelling**, not a second kind of value: `0xFF` and `255` are the same literal afterwards, with the same type and the same range check against a narrower type. Which to write is a question about the reader — a mask, a byte, or a value copied out of a wire format or a published constant table reads as hexadecimal, and a count does not.

It works anywhere an integer literal does, including the three places that are not expressions — a map key, an enum member's value, and a fixed-size array's length:

```nio
enum Mask { LOW: 0x0F, HIGH: 0xF0 }
Map<int, String> names = { 0xFF: "high" };
int[0x4] quad = [1, 2, 3, 4];
```

Three things it does not do:

* There is **no hexadecimal float**. The notation is for integers, so `0x1.8` is `0x1` followed by something the parser has no use for.
* A `0x` with **no digit** after it is an error naming itself, rather than a `0` and an identifier called `x`.
* The range is still an `int64`'s, whichever notation writes it. `0x7FFFFFFFFFFFFFFF` is the largest literal there is, and `0xFFFFFFFFFFFFFFFF` is out of range rather than every bit of a `uint64` — worth knowing precisely because hexadecimal is where you would reach for such a mask. The top half of a `uint64` still comes from arithmetic, from JSON, or from outside the program.

### Working with bits

The integer types have the usual bitwise operators: `&`, `|`, `^`, `~`, `<<` and `>>`. They read a value as bits rather than as a number, and are defined on integers only — a float's bits are a sign, an exponent and a mantissa, so masking them is never what you mean.

```nio
int a = 12;                    // 1100
int b = 10;                    // 1010
print(a & b, a | b, a ^ b);    // 8 14 6
print(~a);                     // -13
print(a << 3, a >> 2);         // 96 3
```

`>>` fills with whatever the **left** operand's type says: the sign for a signed type, zeros for an unsigned one. The right operand is a count, so it can be any integer type.

```nio
print(-13 >> 2);               // -4  — the sign keeps coming
uint u = 12;
print(u >> 2);                 // 3   — zeros come in
```

The bitwise operators bind tighter than comparisons: `|` and `^` bind like `+`, and `&`, `<<` and `>>` bind like `*`. That means the comparison below reads the way it looks:

```nio
print(a & 12 == 12);           // true — (a & 12) == 12
```

Shifting by more than the type is wide gives `0` (or `-1` for `>>` on a negative value) rather than something undefined. A **negative** shift count is a runtime error, since it is a shift in a direction you did not ask for.

One spelling rule: `>>` must be written as two `>` with nothing between them, so that `Map<String, Future<int>>` still closes two type arguments rather than shifting.

### Converting between number types

Every operator widens its result (see [Picking a number type](#picking-a-number-type)), so `a + b` on two `byte`s is a `uint`. To put a computed value back into a narrower type, write `as`:

```nio
byte a = 200;
byte b = 55;
byte sum = (a + b) as byte;        // 255
byte over = (a + b + 1) as byte;   // 256 wraps round to 0
```

This is the only way to compute a `byte` — without it, nothing an operator produces will fit back in one. It always succeeds and it wraps, keeping the target type's low bits.

It also reinterprets between the signed and unsigned families at the same width, which assignment refuses:

```nio
int i = -1;
print(i as uint);              // 18446744073709551615 — the same bits, read unsigned
```

It does **not** convert between integers and floats. That asks about rounding and about values no integer can hold, so it is refused rather than guessed at.

### Writing a string

A string literal is written with double quotes, single quotes, or backticks. All three produce the same kind of value, so the choice is only about what you would otherwise have to escape:

```nio
String a = "hello";
String b = 'hello';
String c = `hello`;

String awkward = "she said \"hi\"";
String better  = 'she said "hi"';    // the same string, nothing escaped
```

The escapes are `\n`, `\r`, `\t`, `\0` (a NUL byte), `\\`, `\$`, each of the three quotes — `\"`, `\'`, `` \` `` — and `\xNN` for the byte with that two-digit hex value (`"\x41"` is `"A"`; both digits are required). A backslash before anything else is kept as written. `\xNN` writes one byte, not a character: a string is bytes, so `"\xC3\xA9"` is `é` and `"\xE9"` on its own is not valid UTF-8.

A `"` or `'` string has to fit on one line. A **backtick string does not**, and every newline you write in it is part of it:

```nio
String note = `dear reader,

regards`;

print(note == "dear reader,\n\nregards");   // true
```

That makes backticks the natural way to hold a block of text — a JSON payload, a usage message, a query — with its shape intact:

```nio
String usage = `usage: report [options] <file>

  -v   verbose
  -o   output path`;
```

> [!NOTE]
>
> Indentation inside a backtick string is part of the string. There is no margin stripping, so a line indented to line up with the surrounding code carries that indentation into the value — which is why the example above starts its lines at column 1.

Backticks change one more thing: **they interpolate.** `${expr}` inside a backtick string is replaced by the text the value prints as, so anything `print` accepts can sit in a hole, and nothing needs importing:

```nio
String who = "world";
int n = 3;
print(`hello ${who}, n = ${n + 1}`);    // hello world, n = 4
```

It is exactly the concatenation it reads as — `` `n = ${n}` `` means `"n = " + string.from(n)` — and it costs one allocation however many holes it has. Braces inside a hole balance, so a record literal or another backtick string can sit in one. Write `\${` for a literal `${`; a `$` that is not followed by `{` needs no escape. The other two forms never interpolate: `"${n}"` is those four characters, which is what you want when the string is going to a shell.

Because a quoted string stops at the end of its line, a forgotten closing quote is reported on the line that has the mistake instead of swallowing everything after it:

```nio
String oops = "hello;
// error on this line: unterminated string
```

## Strings are bytes

A `String` is a sequence of bytes, and every position and length in the language is a byte position or a byte count. That is worth stating loudly, because the text you type is UTF-8 and most of the world's characters are more than one byte of it:

```nio
import 'string';

String word = "café";
print(string.length(word));         // 5 -- é is two bytes
print(word[3]);                     // 195, the first byte of é
print(string.substring(word, 0, 4)); // "caf" plus half of é: not valid UTF-8
```

Nothing stops the last line, and nothing warns. If you are cutting a display name to fit a column, that is the bug you ship.

Correct code walks **code points**, and the loop that does it is the same loop as for an array:

```nio
forEach(word, r, i) {    // r: the code point, an int; i: the byte offset it starts at
    print(string.from(i) + " " + string.fromRunes([r]));
}
// 0 c
// 1 a
// 2 f
// 3 é       <- i steps from 3 to 5, because é is two bytes
```

A byte that is not valid UTF-8 comes out as `0xFFFD` and the loop moves one byte on, so the loop always ends and never skips a byte. Four functions answer what a walk does not: `string.runeCount(s)` is how many code points the walk visits (4 for `café`), `string.runeAt(s, i)` is the code point at a **byte** offset, `string.fromRunes(rs)` builds a string from code points, and `string.isValidUtf8(s)` says whether a string is whole. There is no function that hands back the code points as an array, on purpose: it is the kind of helper people skip on a hot path, and a byte loop is not slower, it is *wrong*. The loop is the short spelling and the correct one.

Case mapping is ASCII only, and the functions are named for it: `string.toUpperCaseAscii` and `string.toLowerCaseAscii`. Full Unicode case mapping is a table that belongs in a package, not in the core.

## Naming a type: `getType`

`getType(value)` returns the name of a value's type as a `String`. Like `print`, it is always available and needs no import:

```nio
int8[] bytes = [1, 2];
print(getType(bytes));       // int8[]
print(getType(bytes[0]));    // int8
print(getType(1.5));         // float
print(getType("hi") + "!");  // String!
```

It takes anything but a `void` value. Where printing refuses records, arrays, and maps, `getType` names them happily:

```nio
type Car { String make; int age; }
Car c = { make: "toyota", age: 4 }

print(getType(c));                     // Car
print(getType([c]));                   // Car[]
print(getType(int (int n) -> n * 2));  // Function(int)<int>
```

The name you get back is spelled the way compile errors spell it. Two things follow from that:

* `byte` is an alias for `uint8`, and the alias is not remembered: a `byte` value reports `uint8`. `int`, `uint` and `float` are not aliases, so they report themselves — `getType(1)` is `int`, never `int64`, however wide the machine makes it.
* A type from another module is named by the module that *declared* it, not by your alias for it. With `import 'shapes' as sh;`, an `sh.Circle` reports `shapes.Circle`.

> [!NOTE]
>
> **`getType` answers at compile time.** The type is baked into the program as a constant string — there is no run-time type information behind it. The argument is still evaluated, so side effects in it still happen; only its value is thrown away.
>
> This is also why `getType` reports the type you *declared*, ignoring [narrowing](#narrowing): a `String?` reports `String?` even inside an `if (s != null)` where it is otherwise usable as a `String`.

## Declaring variables

A declaration is a type followed by a name, with an optional initializer. Without an initializer, the variable starts at its type's zero value:

```nio
int x;                 // 0
int y = 5;
String name = "ada";
bool ready = x < y;
```

Variables must be declared before use. A name cannot be redeclared in the same scope, but inner blocks may shadow outer names.

### Names you cannot use

Four names are taken everywhere: `print`, `printInline`, `getType`, and `Error`. They are in scope in every file and no import brings them in, so declaring one could only hide it. The same goes for record and enum *types*: they may not be named after a built-in type (`int`, `String`, `DateTime`, …).

The names of the standard library's modules — `json`, `path`, `http` and the rest — are **not** on that list. A module's name is taken only in a file that [imports](/docs/modules) it:

```nio
String path = "/usr/local";    // fine: this file does not import 'path'
print(path);
```

```nio
import 'path';
String path = "/usr/local";    // compile error: "path" is already used as a module name
```

Importing under another name gives the name back, which is how a file has both:

```nio
import 'path' as p;

String path = "/usr/local";
print(p.join(path, "bin"));  // /usr/local/bin
```

Using a library you did not import says so rather than calling it undefined:

```nio
print(path.join("a", "b"));  // compile error: path is a built-in library; import it first: import 'path';
```

Field and method names are never restricted — they are reached through a value, so `item.print()` calls your method and `print(x)` the built-in.

### `const` variables

Adding `const` between the type and the name makes the variable impossible to reassign. A const variable must be initialized when declared:

```nio
String const greeting = "ciao";
greeting = "hello";            // compile error: cannot assign to "greeting"

int const limit = 10;
limit++;                       // compile error
```

`const` freezes the *name*, not the value it refers to. An array or record held by a const variable stays mutable — only pointing the name at something else is forbidden:

```nio
int[] const nums = [1, 2, 3];
nums[0] = 9;                   // fine: writes an element
nums = [4, 5];                 // compile error: reassigns the binding

type Car { String make; int age; }

Car const myCar = { make: "fiat", age: 4 };
myCar.age++;                   // fine: writes a field
```

(Record types are introduced [below](#record-types).)

## Optionals: `T?`

A plain `T` can never hold `null`. When a value may be absent, declare it as `T?`:

```nio
String? owner;                 // starts as null
owner = "alice";
owner = null;
bool known = owner != null;
```

Optionals only support `==` and `!=` — against `null`, against a plain `T`, or against another `T?`. The value itself comes out in one of two ways: narrowing, or optional chaining.

### Narrowing

Where the compiler can see an optional is not null, you use it as a plain `T` — no unwrapping syntax:

```nio
String? owner;
owner = "alice";
print(owner + "!");          // alice! — assigning a value narrows it

int? n;
if (n != null) {
    print(n + 1);            // n is an int inside this branch
} else {
    print("absent");
}

if (n != null && n > 3) {      // the right side of && already knows n
    print("big");
}
```

Narrowing follows the flow of your program. It covers the branch a null check proves safe (`if`, `while`, the right side of `&&`/`||`), continues after an `if` whose other branch always returns, and starts whenever a value that cannot be null is assigned. It stops as soon as the certainty does: assigning `null` (or another optional) un-narrows, and a loop that reassigns the variable keeps it optional throughout. The classic walk over a linked structure just works:

```nio
type Node { int value; Node? next; }
Node first = { value: 1, next: { value: 2, next: null } };

Node? cur = first;
while (cur != null) {
    print(cur.value);          // cur is a Node here — prints 1, then 2
    cur = cur.next;            // Node? again; the loop re-checks
}
```

Because a record field can be reached through other references, a narrowed *field* can in principle be set back to null behind your back (by an alias, or by a function you call) between the check and the use. If that happens, reading it is a clean runtime error — never memory corruption.

### Optional chaining: `?.`

When you only want to reach through an optional, `?.` keeps the chain short: `a?.b` is `null` if `a` is null, and `b`'s value otherwise. The result is again an optional, and everything after the `?.` — plain fields, indexing, `.length` — rides along, short-circuiting to `null` at the first absent link:

```nio
type Team { String name; String[] members; }
type Company { Team? boss; }

Company c = { boss: null };
print(c.boss?.name);         // null
print(c.boss?.members[0]);   // null — the whole chain stops at boss
```

A chain never produces `T??` — a field that is already optional passes through unchanged. Chains are read-only: `a?.b = v` is a compile error, and you cannot call a function through `?.`.

## Record types

A record is a type you declare yourself, with named fields. Two record types are always different types, even when their fields are identical. Records are declared at the top level of a file:

```nio
type Car {
    String make;
    int age;
    String? owner;            // optional field
}

Car myCar = {
    make: "toyota",
    age: 4                     // optional fields may be omitted (they are null)
}

myCar.owner = "bob";
print(myCar.age);            // 4
```

The type's name must start with an upper-case letter — `type Car`, not `type car`. That holds for every user-declared type, records and enums alike, and the compiler rejects a lower-case one with the capitalized name it expected. Built-in types (`int`, `bool`, …) are the only lower-case names in a type position; `String`, `DateTime` and `Duration` are the ones that are not.

A field is written type first, then name — the same order as a variable declaration (`int age;`) or a parameter (`f(int age)`). One rule covers every binding in the language.

Field names may be keywords. A field name only appears where one is already expected — after the field's type, before `:` in a literal, and after `.` — so nothing is ambiguous, and JSON keys like `"type"` stay modelable:

```nio
type Item { String type; int for; }
Item i = { type: "invoice", for: 3 }
print(i.type);               // invoice
```

Every non-optional field must be present in a literal. Record values are references — assigning or passing a record does not copy it.

The `;` between fields is required, but the one after the last field may be omitted.

### Methods

A type's body can also declare functions. They are called on a value of the type and reach it through `self`:

```nio
type Car {
    String make;
    int buildYear;

    int age(int now) {
        return now - self.buildYear;     // self is the car the call was made on
    }

    void rename(String name) {
        self.make = name;
    }
}

Car myCar = { make: "toyota", buildYear: 1922 };
print(myCar.age(2026));                // 104
myCar.rename("honda");
print(myCar.make);                     // honda
```

A method is written exactly like a function: return type first (omitted when it returns nothing), `async` before the name for an async one, and no `;` needed after the body.

`self` is the value the method was called on, and only exists inside a method body. Fields are always reached through it — there is no implicit field scope, so `make` on its own is undefined where `self.make` is the field. Since records are references, assigning to `self.make` changes the very value the caller holds.

Methods belong to the **type**, not to each value. Nothing is stored per value, and which body runs is decided at compile time from the receiver's type — so a method costs a `Car` nothing, and stays out of `json.toText`:

```nio
import 'json';
print(json.toText(myCar));             // {"make":"honda","buildYear":1922}
```

Method names live in the record's own namespace: they can repeat function names or even built-in ones (`item.print()` is fine), but not a field name of the same type. Methods may call each other and themselves in any order, and whether one can fail is inferred from its body, exactly as for functions:

```nio
type Box {
    int n;

    int risky() {
        if (self.n > 10) {
            return Error("too big");
        }
        return self.n;
    }

    int safe() {
        return self.risky() catch 0;     // handled here, so safe() cannot fail
    }
}
```

Like a declared function, a method is not a value: `f = myCar.age;` and `myCar.age = ...;` are compile errors. Wrap it in a function value to get one — the wrapper remembers which value to call it on:

```nio
Function(int)<int> f = int (int now) -> myCar.age(now);
```

A function-typed *field* is still a different thing, and the right one when the behavior differs from value to value rather than from type to type. See [Function values](/docs/functions).

### Extending a type

`extends` gives a type a copy of another type's members, and lets it add to them:

```nio
type Car {
    String make;
    String? owner;

    int wheels() { return 4; }

    void describe() {
        print(self.make, "on", self.wheels(), "wheels");
    }
}

type Truck extends Car {
    int load;                                  // added on top

    int override wheels() { return 6; }        // replaces Car's

    int carry(int extra) { return self.load + extra; }
}

Truck t = { make: "volvo", load: 900 };
t.describe();                                  // volvo on 6 wheels
print(t.make, t.load, t.carry(100));           // volvo 900 1000
```

`Truck` has the base's fields first and its own after them, and every method `Car` has. Optional fields, JSON renames, and inferred fallibility all come along — what is copied is the declaration itself.

A copied method belongs to the extending type: its body is checked and compiled again with `self` typed as `Truck`. That is why `describe`, written in `Car`, says 6 wheels for a truck — `self.wheels()` finds the override.

Replacing a method takes the `override` modifier, which goes where `async` goes. It is required (a silent replacement is a compile error), it is rejected when there is nothing to replace, and the replacement must keep the same signature. Fields cannot be overridden at all: redeclaring an inherited field name is an error.

Extending **copies members; on its own it does not relate the two types**. A `Truck` is not a `Car`, and cannot be passed or assigned where one is expected; `getType(t)` is `"Truck"`, and its JSON is its own. Chains work as expected — `type Van extends Truck` copies from `Truck` and, through it, from `Car`. Marking the base `sealed` is what relates them; see [Sealed types](#sealed-types) below.

The base may come from another file, and can be anything that file `export`s:

```nio
// shapes.nio
import 'json';
String label(String s) { return "<" + s + ">"; }    // not exported

export type Shape {
    String name;
    String show() { return label(self.name); }
}
```

```nio
// main.nio
import './shapes.nio';

type Square extends shapes.Shape {                  // no import 'json' here
    int side;
}

Square s = { name: "sq", side: 4 };
print(s.show());                                  // <sq>
```

A copied body keeps resolving its names where it was written, so `show` still reaches `shapes.nio`'s private `label` and its `json` import — things `main.nio` cannot even name. The one thing that changes is `self`.

That last point has a consequence worth knowing: a base method that uses *its own type* where the receiver goes — `Car me() { return self; }` — cannot be inherited, because `self` is a `Truck` there. The compiler reports it against the type that inherited the body and names the file and line the body came from.

### Sealed types

A `sealed` type may be extended only inside the module that declares it. Because the compiler then knows every type that extends it, two things become possible that plain `extends` cannot offer: a value of an extending type is usable where the sealed type is expected, and a `switch` over it can be checked to cover every case.

```nio
sealed type Expr { int line; }

type IntLit extends Expr { int value; }
type Ident  extends Expr { String name; }
type Binary extends Expr { String op; Expr left; Expr right; }

IntLit two = { line: 1, value: 2 };
Expr   e   = two;                          // an IntLit is usable as an Expr
Expr[] all = [two, { line: 1, name: "x" }];
```

This is what lets one array hold a whole tree, which is the shape a parser, an interpreter or a document model wants. `sealed` goes right before `type`, after `export` when both appear: `export sealed type Expr { … }`.

To get back to a specific type, match on it. A `switch` over a sealed value takes types as labels and binds the value at the matched type:

```nio
String render(Expr e) {
    switch (e) {
        case IntLit n:
            return string.from(n.value);
        case Ident n:
            return n.name;
        case Binary n:
            return "(" + render(n.left) + " " + n.op + " " + render(n.right) + ")";
    }
}
```

**With no `default`, the clauses must cover every extending type** — and that is the point of the whole feature. Add `type Unary extends Expr` later and this stops compiling, with a message naming `Unary`, instead of quietly falling through a case nobody updated. Writing a `default` opts out, for a switch that only cares about a few of the types.

Notice `render` needs no `return` after the switch: the set is closed and every member is named, so one clause always runs.

For a one-off test, `as` narrows and yields an optional:

```nio
IntLit? lit = e as IntLit;
if (lit != null) { print(lit.value); }
```

It yields `null` rather than raising because there is only one way it can fail — the value is not an `IntLit` — and nothing to report about it.

Three limits are worth knowing. A type extending a sealed one **cannot itself be extended**: the hierarchy is one level deep. A **sealed type cannot be constructed** — `Expr e = { line: 1 };` is an error, because such a value would be no case of any switch over the extenders, and the guarantee that an exhaustive switch always runs a clause would be false. Write a type extending it that adds no fields when a "plain" one is what you want; it costs a line and every switch is then asked about it. (Fields are unaffected: a sealed type declares them, every extending type gets them, and a field or array element *typed* as the sealed type is how a recursive tree is written.) And a **method cannot be called on a value whose type is the sealed one** — a method is chosen by the type written down, so calling `describe()` on an `Expr` could not know which body to run. Narrow first, and the receiver's type is certain:

```nio
Shape s = square;
// s.describe();               // error: match its type first
switch (s) {
    case Square q:
        print(q.describe());   // runs Square's override
}
```

Sealing costs the ability to extend the type from another module: the set has to be closed to be known, and a module cannot see who imports it. An exported sealed type can still be used and switched on by importers — just not extended.

### Union types

A record says "this **and** that". A `union` says "this **or** that" — a value that is exactly one of a fixed set of types, each named by a tag:

```nio
union Text {
    String,
    byte[] Bytes
}
```

Members are written type first then tag, like fields and parameters. A member whose type is a single capitalized name takes its tag from the type — `String` above is `Text.String` and needs no tag written. Anything else (`byte[]`, `int`, a function type) has no name to borrow and must be tagged.

A value goes in on its own, whenever exactly one member can hold it:

```nio
Text a = "hi";
Text b = string.toByteArray("raw");
```

and comes out by matching, with the clause binding what the member holds:

```nio
String render(Text t) {
    switch (t) {
        case Text.String v: return "chars(" + v + ")";
        case Text.Bytes  v: return "bytes(" + string.fromByteArray(v) + ")";
    }
}
```

With no `default`, the clauses must cover every member — so adding one later is a compile error at every switch that does not handle it, which is the whole reason to reach for a union rather than a record with one optional field per case. For a single member, `as` is the one-off, and answers what the member holds:

```nio
String? s = t as Text.String;
if (s != null) { print(s); }
```

**Two members may share a type**, and then the tag is what tells them apart. The compiler cannot guess which is meant, so those are constructed by name:

```nio
union Distance { float Meters, float Feet }

// Distance d = 3.0;               // error: Meters and Feet both take a float
Distance d = Distance.Meters(3.0);
```

`Union.Tag(value)` always works, whether or not it is required.

Like a record, a union is its own type — two unions with identical members are still different types — and it can be exported, nested in fields and arrays, and made optional with `Text?`. That optional is the only way to express absence: a *member* may not be optional, so a `Text?` has exactly one way to be nothing. Members also cannot be unions themselves, and a union neither extends a type nor is extended.

An imported union's member takes all three names — `alias.Union.Tag` — which is the only place in the language a name has three parts:

```nio
import './text' as tx;
tx.Text t = "hi";
switch (t) {
    case tx.Text.String v: print(v);
    case tx.Text.Bytes  v: print("bytes");
}
```

A union also has a JSON form: it serializes as the member's payload, bare, and `json.parse … as T` picks the member from the JSON kind of the value — which is exactly what a document field that is sometimes a string and sometimes a number calls for. The [JSON page](/docs/stdlib/json#union-fields-one-key-several-shapes) has the rules and an example.

Underneath, a union *is* a sealed type: the compiler writes the sealed type and one type extending it per member for you. That is why every member must be handled, why matching is fast, and why only the file that declares a union can add a member.

### Renaming a field in JSON

By default a field's JSON key is its name. A string literal after the name gives it a different one, so a field can follow Nio's naming style while still matching what an external API sends:

```nio
import 'json';

type Engine {
    float liters;
    int power 'json:engine_power';
}

Engine e = { liters: 12.8, power: 550 };
print(json.toText(e));    // {"liters":12.8,"engine_power":550}
```

The annotation changes only the serialized key — `e.power` is how you read the field in Nio, everywhere. No keyword introduces it: a string literal is the only thing that may follow a field name, so its position is enough to identify it.

The string is `target:key`. `json` is the only target for now; the prefix is there so another format can be added without changing the syntax. The compiler rejects an unknown target, an empty key, a rename of a field to its own name, and two fields in one type that would claim the same JSON key.

### Nested and anonymous types

A field's type can be another record type — by name, or declared inline without a name. An inline (anonymous) type can take `[]` and `?` suffixes like any other type:

```nio
import 'time';

type CarWeight {
    int empty;
    int? full
}

type Car {
    String make;
    CarWeight weight;         // a named type used inside another type
    {                 // an anonymous type: exists only as this field
        DateTime date;
        int amount;
        String? piece
    }[]? repairs;
}

Car myCar = {
    make: "toyota",
    weight: { empty: 1200, full: 1600 }
}

myCar.repairs = [{ date: time.now(), amount: 250 }];
```

Anonymous types are only allowed as field types inside a `type` declaration. Error messages name them by their path (`Car.repairs`).

## Enum types

An enum declares a fixed set of named integer constants as a type of its own. Every member carries an explicit value, and members are named through the type:

```nio
enum HttpResponses {
    OK: 200,
    NOT_FOUND: 404
}

HttpResponses r = HttpResponses.OK;
print(r);                      // OK — printing shows the member's name
int code = r;                  // 200 — an enum value widens to int
```

Like a record, an enum's name must start with an upper-case letter.

An enum is a type of its own: an `int` cannot be assigned to one (`HttpResponses r = 200;` is a compile error), and two different enum types never mix. The protection runs one way — reading the numeric value out is just an assignment to an `int`.

Enum values compare with `==`, `!=`, `<`, `<=`, `>`, `>=` — against the same enum, or against ints:

```nio
if (r == HttpResponses.NOT_FOUND) {
    print("missing");
}
bool ok = r < 400;             // compares as 200
```

Arithmetic is not defined on enums; widen to `int` first. Enums work anywhere a scalar does — optionals (`HttpResponses?`), arrays, record fields, function parameters and returns — and `json.toText` serializes the numeric value (`404`), not the name.

Declared without an initializer, an enum variable starts at the numeric value `0`: the member with value 0 if the enum has one, otherwise a value outside the members that prints as its number.

An enum can be exported like any type: `export enum Status { ... }`, then `m.Status` in type positions and `m.Status.OK` in expressions (see [Modules](/docs/modules)).

## Functions

Functions are declared at the top level. The return type comes first, just like in a variable declaration, and is required: a function that returns nothing writes `void`. There is no `function` keyword:

```nio
int add(int a, int b) {
    return a + b;
}

void log(String msg) {
    print(msg);
}
```

You can call a function from code above its declaration, and a function may call itself.

### Variadic parameters

Put `...` in front of the **last** parameter's type and it collects however many arguments the caller passes after the fixed ones:

```nio
void customPrint(int myInt, ...String logs) {
    print(myInt);
    forEach(logs, log) {
        print(log);
    }
}

customPrint(0, "hello", "world", "!");
customPrint(7);                          // logs is empty
```

Inside the body it is just an array of the type you wrote — `...String logs` gives you a `String[]`, with `.length`, indexing and `forEach`. Passing no trailing arguments gives an empty array, never null.

Only the last parameter can be variadic. Each collected argument is type-checked on its own, so `customPrint(0, "a", 1)` is an error. There is no spread: you cannot hand an existing `String[]` over as the arguments — if that is what your callers have, take a `String[]` parameter instead.

Functions are also values: they can be created without a name, stored in variables, and passed around, and they remember the variables around them. See [Function values](/docs/functions).

A function declared with `async` (`int async sum(int a) { ... }`) defers its body: calling it returns a `Future<int>` to `await` later. See [Async and futures](/docs/async).

## Control flow

Conditions must be `bool`, are always parenthesized, and braces are always required:

```nio
if (x > 10) {
    print("big");
} else if (x > 5) {
    print("medium");
} else {
    print("small");
}

while (x > 0) {
    x = x - 1;
}

for (int i = 0; i < 3; i++) {
    print(i);     // 0, 1, 2
}
```

The `for` header is `init; condition; post`. The init clause may declare a variable — visible only inside the loop — or assign to an existing one; init and post may each be left empty, but the condition is required.

`break` leaves the innermost loop it is written in, and `continue` skips to that loop's next iteration. Both work in `while`, `for`, and `forEach`:

```nio
forEach(scores, s) {
    if (s == 0) { continue; }      // skip this one
    if (s > 100) { break; }        // stop the loop entirely
    print(s);
}
```

`continue` always does the loop's own next step, so in a `for` loop it still runs the post clause — the counter advances and the loop cannot spin. `break` skips the post clause and resumes after the loop. There are no loop labels: to leave two nested loops, break the inner one and check for it in the outer. Writing `continue` outside a loop is a compile error, as is writing `break` outside both a loop and a `switch`; and a function value written inside a loop cannot break out of it — its body runs when it is called, not where it was written.

One thing to watch: a `while` loop that can `break` no longer proves its condition false afterwards, so it stops narrowing an optional the way a plain loop does.

### `switch`

`switch` matches one value against a list of constants:

```nio
switch (statusCode) {
    case 200:
        print("ok");
    case 404:
        print("not found");
    default:
        print("something else");
}
```

The subject is evaluated once, and each `case` label is compared against it with the rules of `==`, in order; the first match runs its clause. If nothing matches, `default` runs — and with no `default`, nothing does.

**A clause never falls into the next one.** When its last statement finishes, the switch is over, so no `break` is needed to separate the clauses. `break` is still there when a clause wants to leave from the middle of itself:

```nio
switch (kind) {
    case "draft":
        if (empty) { break; }     // done with the switch
        publish();
    default:
        print("nothing to do");
}
```

Several labels share one clause by stacking them — an empty clause body means "run whatever the next one runs":

```nio
switch (day) {
    case "sat":
    case "sun":
        print("weekend");
    default:
        print("weekday");
}
```

You can switch on anything `==` accepts: the number types, `String`, `bool`, `DateTime`, `Duration`, an enum, and optionals of those — plus a [sealed type](#sealed-types), whose clauses match the value's *type* rather than its value. So an enum subject takes its own members, and an optional subject takes `null` as a label like any other:

```nio
switch (level) {
    case Level.Low:
        print("low");
    case Level.High:
        print("high");
    default:
        print("unknown");
}

int? found = lookup();
switch (found) {
    case null:
        print("nothing");
    case 0:
        print("zero");
    default:
        print("something");
}
```

A few rules keep a switch readable, each a compile error when broken: labels must be **constants** (a literal, a negated number, `null`, or an enum member — anything computed is what `if` / `else if` is for), the same label may not appear **twice**, `default` comes **last** and only once, and a label that could never equal the subject is rejected rather than left as a clause that silently never runs.

Each clause body is its own scope, so two clauses can declare the same name. A `break` inside a switch leaves the switch, not the loop around it; a `continue` inside one belongs to that loop, since a switch is a choice rather than an iteration:

```nio
for (int i = 0; i < 5; i++) {
    switch (i) {
        case 1:
            continue;      // next iteration of the for loop
        case 2:
            break;         // leaves the switch; the loop carries on
        default:
            print(i);
    }
    print("end of " + string.from(i));
}
```

`i++;` and `i--;` add or subtract 1 from an `int`, `float`, or equally wide sized-number variable, array element, or record field — including a narrowed `int?`/`float?`, which stays narrowed afterwards. They are statements, usable anywhere, not expressions: `int x = i++;` does not parse.
