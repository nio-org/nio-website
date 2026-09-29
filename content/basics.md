---
title: "Language basics"
description: "The basics of Nio: built-in types, variables, strings, optionals, records, enums, functions and control flow, with runnable examples."
---

# Basics

## Programs

A program is a sequence of top-level statements in a single `.nio` file. The statements run in order from top to bottom. There is no `main` function.

```nio
print("hello, world");
```

Every statement ends with `;`. The semicolon is optional after a statement whose last token is `}` (blocks, declarations, record literals).

There are two forms of comment. `//` continues to the end of the line, and `/* */` can span many lines:

```nio
// a line comment

/* a block comment,
   over several lines */

int x = 1 /* or between tokens */ + 2;
```

Block comments do not nest. The first `*/` closes the comment.

Comments have no effect on the compiled program. Two programs that differ only in their comments produce the same binary. Editors use one kind of comment: **the comment block on the lines directly above a declaration**. A hover over the name shows this block in the editor. This applies wherever the name is used, also in a file that imports it.

```nio
// A file comment. The blank line below is what keeps it the file's.

// Adds two numbers.
// Whichever two you pass.
int add(int a, int b) { return a + b; }

int seen = 0;   // a remark about seen, and about nothing after it
```

Consecutive `//` lines make one block. Both comment forms count. A blank line ends the block.

## Printing

`print` and `printInline` write to standard output. `print` ends the line, and `printInline` does not.

```nio
printInline("hello, ");
print("world");            // hello, world
```

Both take any number of values. They write one space between two values. They write nothing before the first value or after the last value, except the newline from `print`:

```nio
print("x", 1, true);               // x 1 true
print();                           // an empty line
printInline("a", "b");             // a b, with the next print continuing the line
```

They accept scalars: strings, all number types, `bool`, `DateTime`, `Duration`, enums, and optionals of these types. Strings print without quotes, and an absent optional prints `null`. To print a record, an array or a map, a program first converts it with [`json.toText`](/docs/stdlib/json).

All arguments are evaluated before output starts. If an argument [raises an error](/docs/errors), nothing is written.

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
> **Numeric types do not mix.** `1 + 1.5` is a compile error. The correct form is `1.0 + 1.5`. There are no implicit conversions between integers and floats, or between signed and unsigned integers.

### Picking a number type

`int` and `float` are the default choices. They have the width of the target machine: 64 bits on a 64-bit machine, 32 bits on a 32-bit machine. They are separate types, not other names for `int64` and `float64`. `uint` is the unsigned equivalent of `int`.

The sized types are for data where the width is part of the data definition, for example a wire format, a file header, or a JSON contract that specifies a small number.

```nio
int count = 0;                 // the default choice
int32 recordId = 70000;        // 32 bits because the format says so
float32 temperature = 21.5;    // and 32-bit floats because it says that too
```

A type narrower than `int` or `float` is a **storage type**. It holds a value and passes it on, but no operator produces one. A computed value needs a conversion before it can go into a storage type. [Converting between number types](#converting-between-number-types) gives the details.

```nio
int16 a = 300;
int16 b = 44;
int sum = a + b;               // arithmetic widens: a + b is an int
int16 nope = a + b;            // compile error: cannot use int as int16
a++;                           // compile error, for the same reason
```

A value can move to a numeric type that holds **every** value of its own type. It cannot move in the other direction:

```nio
int8 small = 100;
int32 wider = small;           // fine
float32 f = 0.5;
float64 g = f;                 // fine
int8 back = wider;             // compile error: cannot use int32 as int8
```

The compiler checks each literal against its target type. A number that does not fit is a compile error. It does not wrap:

```nio
int8 ok = 127;
int8 tooBig = 200;             // compile error: cannot use int as int8
```

### The unsigned types

`uint`, `uint8`, `uint16`, `uint32` and `uint64` hold no negative values. They are for numbers that cannot be negative: a count, a size, a bit pattern, a byte. `byte` is an alias for `uint8`. For this reason, each element that `string.toByteArray`, `fs.readFile` and the output of a child process give is in the range 0–255:

```nio
import 'string';

print("é"[0]);                 // 195, not −61
uint8 red = 255;
uint total = 0;
total = total - 1;             // 18446744073709551615 — unsigned wraps
```

**Signed and unsigned types do not mix.** An operator cannot take one signed operand and one unsigned operand, because neither type holds all the values of the other:

```nio
int i = 1;
uint u = 2;
bool oops = i < u;             // compile error: not defined on int and uint
uint bad = -u;                 // compile error: no negative values to produce
```

Two combinations are allowed: a pair where one type holds all the values of the other, and a number literal next to an unsigned value:

```nio
byte b = 200;
int widened = b + 1;           // fine: every byte is an int
uint count = 3;
print(count == 3, count > 0);  // true true — the literal takes the uint type
```


A `float32` literal is rounded to the nearest 32-bit value. This is not an error, because `0.1` is inexact at every width. But a `float32` value is not equal to the 64-bit literal with the same digits:

```nio
float32 tenth = 0.1;
print(tenth);                // 0.1     (printed at 32-bit precision)
print(tenth == 0.1);         // false   (0.1 on the right is a float64)
print(tenth + tenth);        // 0.20000000298023224  (the sum is a float64)
```

### Writing a number in hexadecimal

An integer literal can also be `0x` (or `0X`) followed by hexadecimal digits. Upper case and lower case both work, in the prefix and in the digits:

```nio
int  mask  = 0xFF;             // 255
int  big   = 0xDEADBEEF;       // 3735928559
uint every = 0xFFFFFFFF;       // 4294967295
byte high  = 0x80;             // 128
int  low   = -0x80;            // −128 — a minus applied to the literal
print(0x10 == 16);             // true
```

Hexadecimal is a different notation for the same value. `0xFF` and `255` are the same literal, with the same type and the same range check against a narrower type. Hexadecimal makes some code easier to read, for example a mask, a byte, or a value copied from a wire format or a published table of constants.

Hexadecimal works in all places where an integer literal works. This includes the three places that are not expressions: a map key, the value of an enum member, and the length of a fixed-size array:

```nio
enum Mask { LOW: 0x0F, HIGH: 0xF0 }
Map<int, String> names = { 0xFF: "high" };
int[0x4] quad = [1, 2, 3, 4];
```

Limits:

* There is **no hexadecimal float**. The compiler reads `0x1.8` as `0x1` followed by text that is not valid at that position.
* A `0x` with no digit after it is an error. The compiler does not read it as `0` followed by an identifier `x`.
* The range is the range of `int64`, in both notations. `0x7FFFFFFFFFFFFFFF` is the largest literal. `0xFFFFFFFFFFFFFFFF` is out of range. It does not give a `uint64` with all bits set. A value in the top half of the `uint64` range can come from arithmetic, JSON, or input from outside the program.

### Working with bits

The integer types have the bitwise operators `&`, `|`, `^`, `~`, `<<` and `>>`. These operators use the bits of a value, not its numeric value. They are defined only on integers.

```nio
int a = 12;                    // 1100
int b = 10;                    // 1010
print(a & b, a | b, a ^ b);    // 8 14 6
print(~a);                     // -13
print(a << 3, a >> 2);         // 96 3
```

The type of the **left** operand sets how `>>` fills the empty bits: with the sign for a signed type, and with zeros for an unsigned type. The right operand is a count, and it can be any integer type.

```nio
print(-13 >> 2);               // -4  — the sign keeps coming
uint u = 12;
print(u >> 2);                 // 3   — zeros come in
```

The bitwise operators bind tighter than comparisons. `|` and `^` bind like `+`, and `&`, `<<` and `>>` bind like `*`. As a result, the comparison below does not need parentheses:

```nio
print(a & 12 == 12);           // true — (a & 12) == 12
```

A shift by the width of the type or more gives `0`, or `-1` for `>>` on a negative value. The result is always defined. A **negative** shift count is a runtime error.

The `>>` operator is two `>` characters with nothing between them. `Map<String, Future<int>>` closes two type arguments and is not a shift.

### Converting between number types

Every operator widens its result (see [Picking a number type](#picking-a-number-type)). As a result, `a + b` on two `byte` values is a `uint`. The `as` operator converts a computed value to a narrower type:

```nio
byte a = 200;
byte b = 55;
byte sum = (a + b) as byte;        // 255
byte over = (a + b + 1) as byte;   // 256 wraps round to 0
```

`as` is the only way to compute a `byte`, because no operator result fits in one. The conversion always succeeds. It wraps, and keeps the low bits that fit in the target type.

`as` also converts between the signed and unsigned families at the same width, which assignment does not allow. The bits do not change:

```nio
int i = -1;
print(i as uint);              // 18446744073709551615 — the same bits, read unsigned
```

`as` does **not** convert between integers and floats, because that conversion needs a rounding rule and some values have no equivalent in the other type. [`math.toInt` and `math.toFloat`](/docs/stdlib/math) do these conversions.

### Writing a string

A string literal uses double quotes, single quotes or backticks. All three give the same kind of value. A program can use the form that needs the fewest escapes:

```nio
String a = "hello";
String b = 'hello';
String c = `hello`;

String awkward = "she said \"hi\"";
String better  = 'she said "hi"';    // the same string, nothing escaped
```

The escapes are `\n`, `\r`, `\t`, `\0` (a NUL byte), `\\`, `\$`, the three quotes (`\"`, `\'` and `` \` ``), and `\xNN` for the byte with the two-digit hexadecimal value NN. For example, `"\x41"` is `"A"`. Both digits are required. A backslash before any other character stays in the string. `\xNN` writes one byte, not one character. A string is a sequence of bytes. As a result, `"\xC3\xA9"` is `é`, and `"\xE9"` alone is not valid UTF-8.

A `"` or `'` string must fit on one line. A **backtick string** can span many lines, and each newline in it is part of the string:

```nio
String note = `dear reader,

regards`;

print(note == "dear reader,\n\nregards");   // true
```

A backtick string can hold a block of text that must keep its layout, for example a JSON payload, a usage message or a query:

```nio
String usage = `usage: report [options] <file>

  -v   verbose
  -o   output path`;
```

> [!NOTE]
>
> Indentation inside a backtick string is part of the string. Nio does not remove a margin. If the lines are indented to align with the code around them, the value contains that indentation. For this reason, the lines in the example above start at column 1.

Backtick strings also **interpolate**. In a backtick string, each `${expr}` (a *hole*) is replaced by the text that `print` writes for the value. A hole can hold any value that `print` accepts, and no import is necessary:

```nio
String who = "world";
int n = 3;
print(`hello ${who}, n = ${n + 1}`);    // hello world, n = 4
```

`` `n = ${n}` `` is the same as `"n = " + string.from(n)`. The result needs one allocation for any number of holes. Braces inside a hole must balance. A hole can contain a record literal or another backtick string. `\${` gives a literal `${`. A `$` that is not followed by `{` needs no escape. The other two quote forms never interpolate: `"${n}"` is those four characters. They are the correct form for a string that goes to a shell.

A quoted string stops at the end of its line. As a result, the compiler reports a missing closing quote on the line that has the mistake, and does not read the rest of the file as part of the string:

```nio
String oops = "hello;
// error on this line: unterminated string
```

## Strings are bytes

A `String` is a sequence of bytes. Every position and length in the language is a byte position or a byte count. Source text is UTF-8, and many characters use more than one byte:

```nio
import 'string';

String word = "café";
print(string.length(word));         // 5 -- é is two bytes
print(word[3]);                     // 195, the first byte of é
print(string.substring(word, 0, 4)); // "caf" plus half of é: not valid UTF-8
```

The compiler accepts the last line without an error or a warning. Text cut at a byte offset, for example to fit a display name in a column, can be invalid UTF-8.

To work with characters, a program iterates over **code points**, with the same `forEach` loop as for an array:

```nio
forEach(word, r, i) {    // r: the code point, an int; i: the byte offset it starts at
    print(string.from(i) + " " + string.fromRunes([r]));
}
// 0 c
// 1 a
// 2 f
// 3 é       <- i steps from 3 to 5, because é is two bytes
```

A byte that is not valid UTF-8 gives `0xFFFD`, and the loop moves on by one byte. As a result, the loop always ends and visits every byte. Four more functions work with code points:

* `string.runeCount(s)` returns the number of code points that the loop visits (4 for `café`).
* `string.runeAt(s, i)` returns the code point at the **byte** offset `i`.
* `string.fromRunes(rs)` makes a string from code points.
* `string.isValidUtf8(s)` returns whether a string is valid UTF-8.

No function returns the code points as an array. The `forEach` loop walks them one at a time. A loop over bytes gives incorrect results for multi-byte characters.

Case mapping applies only to ASCII. The case-mapping functions are `string.toUpperCaseAscii` and `string.toLowerCaseAscii`. The standard library has no full Unicode case mapping.

## Naming a type: `getType`

`getType(value)` returns the name of the type of a value, as a `String`. Like `print`, it is always available and needs no import:

```nio
int8[] bytes = [1, 2];
print(getType(bytes));       // int8[]
print(getType(bytes[0]));    // int8
print(getType(1.5));         // float
print(getType("hi") + "!");  // String!
```

It accepts any value except a `void` value. `print` does not accept records, arrays and maps, but `getType` does:

```nio
type Car { String make; int age; }
Car c = { make: "toyota", age: 4 }

print(getType(c));                     // Car
print(getType([c]));                   // Car[]
print(getType(int (int n) -> n * 2));  // Function(int)<int>
```

The returned name has the same spelling as in compile errors. As a result:

* `byte` is an alias for `uint8`, and the name of the alias is not kept: a `byte` value reports `uint8`. `int`, `uint` and `float` are not aliases. They report their own names. `getType(1)` is `int`, never `int64`, on all machines.
* A type from another module has the name of the module that *declared* it, not the name of the import alias in the importing file. With `import 'shapes' as sh;`, an `sh.Circle` reports `shapes.Circle`.

> [!NOTE]
>
> **`getType` is evaluated at compile time.** The type name is a constant string in the program. There is no run-time type information. The argument is still evaluated. Its side effects still occur, but its value is discarded.
>
> For the same reason, `getType` reports the *declared* type and ignores [narrowing](#narrowing). A `String?` reports `String?`, also inside `if (s != null)`, where it is usable as a `String`.

## Declaring variables

A declaration is a type followed by a name, with an optional initializer. A variable without an initializer starts at the zero value of its type:

```nio
int x;                 // 0
int y = 5;
String name = "ada";
bool ready = x < y;
```

A variable must be declared before its first use. A name cannot be declared two times in the same scope, but an inner block can shadow a name from an outer block.

### Reserved names

Four names are reserved everywhere: `print`, `printInline`, `getType` and `Error`. They are in scope in every file without an import, and no variable or type can have one of these names. Record and enum *types* also cannot have the name of a built-in type (`int`, `String`, `DateTime`, …).

The names of the standard library modules, such as `json`, `path` and `http`, are **not** reserved. A module name is taken only in a file that [imports](/docs/modules) the module:

```nio
String path = "/usr/local";    // fine: this file does not import 'path'
print(path);
```

```nio
import 'path';
String path = "/usr/local";    // compile error: "path" is already used as a module name
```

A file that uses both imports the module under a different name:

```nio
import 'path' as p;

String path = "/usr/local";
print(p.join(path, "bin"));  // /usr/local/bin
```

A use of a library that the file does not import is a compile error. The message says to import the library:

```nio
print(path.join("a", "b"));  // compile error: path is a built-in library; import it first: import 'path';
```

Field and method names have no restrictions, because code accesses them through a value. `item.print()` calls the method of the type, and `print(x)` calls the built-in function.

### `const` variables

`const` between the type and the name prevents reassignment. A const variable must have an initializer:

```nio
String const greeting = "ciao";
greeting = "hello";            // compile error: cannot assign to "greeting"

int const limit = 10;
limit++;                       // compile error
```

`const` applies to the *name*, not to the value. An array or record in a const variable stays mutable. Only the reassignment of the name is not allowed:

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

A plain `T` cannot hold `null`. A value that can be absent has the type `T?`:

```nio
String? owner;                 // starts as null
owner = "alice";
owner = null;
bool known = owner != null;
```

Optionals support only `==` and `!=`, against `null`, a plain `T` or another `T?`. Narrowing and optional chaining give access to the value.

### Narrowing

Where the compiler can prove that an optional is not null, the optional is usable as a plain `T`. No unwrap syntax is necessary:

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

Narrowing follows the control flow of the program. It applies:

* in a branch that a null check makes safe (`if`, `while`, the right side of `&&` and `||`),
* after an `if` whose other branch always returns,
* after an assignment of a value that cannot be null.

Narrowing stops when the compiler can no longer prove that the value is not null. An assignment of `null`, or of another optional, removes the narrowing. A loop that reassigns the variable keeps it optional in the full loop. A walk over a linked structure compiles as written:

```nio
type Node { int value; Node? next; }
Node first = { value: 1, next: { value: 2, next: null } };

Node? cur = first;
while (cur != null) {
    print(cur.value);          // cur is a Node here — prints 1, then 2
    cur = cur.next;            // Node? again; the loop re-checks
}
```

Other references can also reach a record field. As a result, another reference, or a called function, can set a narrowed *field* back to null between the check and the use. If this occurs, the read is a runtime error. It never corrupts memory.

### Optional chaining: `?.`

`?.` reaches through an optional. `a?.b` is `null` if `a` is null, and the value of `b` if not. The result is an optional. The operations after `?.` (fields, indexing, `.length`) are also part of the chain, and the chain gives `null` at the first absent link:

```nio
type Team { String name; String[] members; }
type Company { Team? boss; }

Company c = { boss: null };
print(c.boss?.name);         // null
print(c.boss?.members[0]);   // null — the whole chain stops at boss
```

A chain never gives `T??`. A field that is already optional stays `T?`. Chains are read-only: `a?.b = v` is a compile error, and `?.` cannot call a function.

## Record types

A record is a user-declared type with named fields. Two record types are always different types, also when their fields are identical. Records are declared at the top level of a file:

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

The name of the type must start with an upper-case letter: `type Car`, not `type car`. This rule applies to all user-declared types, records and enums. For a lower-case name, the compiler gives an error that shows the expected capitalized name. Only built-in types (`int`, `bool`, …) have lower-case names in a type position. `String`, `DateTime` and `Duration` are built-in types that start with an upper-case letter.

A field is written as type first, then name. This is the same order as in a variable declaration (`int age;`) or a parameter (`f(int age)`).

Field names can be keywords. A field name occurs only where a field name is expected: after the type of the field, before `:` in a literal, and after `.`. As a result, JSON keys such as `"type"` can be field names:

```nio
type Item { String type; int for; }
Item i = { type: "invoice", for: 3 }
print(i.type);               // invoice
```

A literal must contain every non-optional field. Record values are references: an assignment or a call does not copy the record.

A `;` is required between fields. The `;` after the last field is optional.

### Methods

The body of a type can also declare functions, called methods. A method is called on a value of the type. The method accesses the value through `self`:

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

A method is written the same as a function: the return type first (`void` when it returns nothing), `async` before the name for an async method, and no `;` after the body.

`self` is the value that the method was called on. It exists only inside a method body. A method always accesses fields through `self`. There is no implicit field scope. `make` alone is undefined, and `self.make` is the field. Records are references. An assignment to `self.make` changes the value that the caller holds.

Methods belong to the **type**, not to each value. A value stores nothing for its methods, and the compiler selects the method body from the type of the receiver. As a result, methods do not make a `Car` larger, and they do not appear in the output of `json.toText`:

```nio
import 'json';
print(json.toText(myCar));             // {"make":"honda","buildYear":1922}
```

Method names are in the namespace of the record. A method can have the same name as a function or a built-in function (`item.print()` is valid), but not the same name as a field of the same type. Methods can call each other and themselves in any order. The compiler infers from the body whether a method can fail, the same as for functions:

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

A method is not a value, the same as a declared function: `f = myCar.age;` and `myCar.age = ...;` are compile errors. A function value that wraps the call can take its place. The wrapper keeps the value that it calls the method on:

```nio
Function(int)<int> f = int (int now) -> myCar.age(now);
```

A function-typed *field* is different. It is for behavior that changes from value to value, not from type to type. [Function values](/docs/functions) gives the details.

### Extending a type

`extends` gives a type a copy of the members of another type. The new type can add members:

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

`Truck` has the fields of the base first, then its own fields. It also has all methods of `Car`. Optional fields, JSON renames and inferred fallibility are also copied, because the copy is of the full declaration.

A copied method belongs to the extending type. The compiler checks and compiles its body again, with `self` of type `Truck`. As a result, `describe`, written in `Car`, prints 6 wheels for a truck: `self.wheels()` calls the override.

The `override` modifier replaces a method. It goes in the same position as `async`. It is required: a replacement without `override` is a compile error. `override` is an error when there is no method to replace. The replacement must have the same signature. Fields cannot be overridden: a redeclaration of an inherited field name is an error.

**`extends` copies members. It does not relate the two types.** A `Truck` is not a `Car`, and it cannot be passed or assigned where a `Car` is expected. `getType(t)` is `"Truck"`, and its JSON is its own. Chains work: `type Van extends Truck` copies from `Truck`, and through it from `Car`. A `sealed` base relates the types. [Sealed types](#sealed-types) gives the details.

The base can come from another file, if that file `export`s it:

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

A copied body resolves its names in the file where it was written. As a result, `show` can still call the private `label` of `shapes.nio` and use its `json` import, which `main.nio` cannot access. Only `self` changes.

A base method that uses *its own type* in the position of the receiver, for example `Car me() { return self; }`, cannot be inherited, because `self` is a `Truck` there. The compiler reports this error on the type that inherits the body, and gives the file and line of the body.

### Sealed types

A `sealed` type can be extended only in the module that declares it. As a result, all the types that extend it are known at compile time. This gives two things that plain `extends` does not give. A value of an extending type is usable where the sealed type is expected. The compiler can also check that a `switch` covers all cases.

```nio
sealed type Expr { int line; }

type IntLit extends Expr { int value; }
type Ident  extends Expr { String name; }
type Binary extends Expr { String op; Expr left; Expr right; }

IntLit two = { line: 1, value: 2 };
Expr   e   = two;                          // an IntLit is usable as an Expr
Expr[] all = [two, { line: 1, name: "x" }];
```

As a result, one array can hold a tree of different node types, for example in a parser, an interpreter or a document model. `sealed` goes directly before `type`, and after `export` when both are present: `export sealed type Expr { … }`.

A match on the type gets a specific type back. A `switch` over a sealed value takes types as labels, and binds the value as the matched type:

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

**With no `default`, the clauses must cover all extending types.** If a later change adds `type Unary extends Expr`, this switch does not compile, and the error message names `Unary`. A `default` clause removes this check, for a switch that handles only some of the types.

`render` needs no `return` after the switch. The set of types is closed and each type has a clause. As a result, one clause always runs.

For a single test, `as` narrows and returns an optional:

```nio
IntLit? lit = e as IntLit;
if (lit != null) { print(lit.value); }
```

If the value is not an `IntLit`, `as` returns `null`. It does not raise an error.

Sealed types have three limits:

* A type that extends a sealed type **cannot be extended**. The hierarchy is one level deep.
* A **sealed type cannot be constructed**. `Expr e = { line: 1 };` is an error, because no clause of a switch over the extending types could match that value. For a "plain" value, a program declares an extending type that adds no fields. Each exhaustive switch must then handle that type too. Fields are not affected: a sealed type declares fields, each extending type gets them, and a field or array element *typed* as the sealed type is how a program writes a recursive tree.
* A method **cannot be called on a value whose type is the sealed type**. The compiler selects the method from the declared type. It cannot select a body for `describe()` on an `Expr`. After narrowing, the type of the receiver is known:

```nio
Shape s = square;
// s.describe();               // error: match its type first
switch (s) {
    case Square q:
        print(q.describe());   // runs Square's override
}
```

A sealed type cannot be extended from another module. Importers can use an exported sealed type and switch on it, but they cannot extend it.

### Union types

A record holds all of its fields. A `union` holds one value from a fixed set of types. Each type in the set is a member, and each member has a name, called its tag:

```nio
union Text {
    String,
    byte[] Bytes
}
```

A member is written as type first, then tag, the same as a field or a parameter. If the member type is a single capitalized name, the tag is the type name: `String` above is `Text.String`, and needs no tag. All other member types (`byte[]`, `int`, a function type) must have a tag.

A value converts to the union automatically when exactly one member can hold it:

```nio
Text a = "hi";
Text b = string.toByteArray("raw");
```

To get the value out, match on the member. The clause binds the value that the member holds:

```nio
String render(Text t) {
    switch (t) {
        case Text.String v: return "chars(" + v + ")";
        case Text.Bytes  v: return "bytes(" + string.fromByteArray(v) + ")";
    }
}
```

With no `default`, the clauses must cover all members. If a later change adds a member, each switch that does not handle it is a compile error. A record with one optional field for each case does not give this check. For a single member, `as` returns the value that the member holds:

```nio
String? s = t as Text.String;
if (s != null) { print(s); }
```

**Two members can have the same type.** Then only the tag identifies the member. The compiler cannot select a member for such a value. The value is constructed by name:

```nio
union Distance { float Meters, float Feet }

// Distance d = 3.0;               // error: Meters and Feet both take a float
Distance d = Distance.Meters(3.0);
```

`Union.Tag(value)` works for all members, also where it is not required.

A union is its own type, like a record: two unions with identical members are different types. A union can be exported, used in fields and arrays, and made optional with `Text?`. A member cannot be optional. `Text?` is the only way to show absence. A member cannot be a union. A union cannot extend a type, and no type can extend a union.

A member of an imported union has a name with three parts, `alias.Union.Tag`:

```nio
import './text' as tx;
tx.Text t = "hi";
switch (t) {
    case tx.Text.String v: print(v);
    case tx.Text.Bytes  v: print("bytes");
}
```

A union also has a JSON form. It serializes as the payload of the member, with no wrapper. `json.parse … as T` selects the member from the JSON kind of the value. This handles a document field that is sometimes a string and sometimes a number. The [JSON page](/docs/stdlib/json#union-fields) has the rules and an example.

Only the file that declares a union can add a member to it.

### Renaming a field in JSON

By default, the JSON key of a field is its name. A string literal after the field name sets a different key. As a result, a field can use the Nio naming style and still match the keys that an external API sends:

```nio
import 'json';

type Engine {
    float liters;
    int power 'json:engine_power';
}

Engine e = { liters: 12.8, power: 550 };
print(json.toText(e));    // {"liters":12.8,"engine_power":550}
```

The annotation changes only the serialized key. Nio code always reads the field as `e.power`. No keyword is necessary: a string literal after a field name is always a rename annotation.

The string has the form `target:key`. At present, `json` is the only target. The compiler rejects an unknown target, an empty key, a rename of a field to its own name, and two fields in one type with the same JSON key.

### Nested and anonymous types

The type of a field can be another record type, by name or declared inline without a name. An inline (anonymous) type can take the `[]` and `?` suffixes, like any other type:

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

Anonymous types are allowed only as field types inside a `type` declaration. Error messages name them by their path (`Car.repairs`).

## Enum types

An enum declares a fixed set of named integer constants as a separate type. Each member has an explicit value. Code names a member through the type:

```nio
enum HttpResponses {
    OK: 200,
    NOT_FOUND: 404
}

HttpResponses r = HttpResponses.OK;
print(r);                      // OK — printing shows the member's name
int code = r;                  // 200 — an enum value widens to int
```

The name of an enum must start with an upper-case letter, the same as the name of a record.

An enum is a separate type. An `int` cannot be assigned to an enum (`HttpResponses r = 200;` is a compile error), and two different enum types do not mix. The other direction is allowed: an assignment of the enum value to an `int` gives the numeric value.

Enum values compare with `==`, `!=`, `<`, `<=`, `>` and `>=`, against the same enum or against ints:

```nio
if (r == HttpResponses.NOT_FOUND) {
    print("missing");
}
bool ok = r < 400;             // compares as 200
```

Enums have no arithmetic. Arithmetic needs the value in an `int` first. An enum is usable in all positions where a scalar is allowed: optionals (`HttpResponses?`), arrays, record fields, function parameters and return values. `json.toText` writes the numeric value (`404`), not the name.

An enum variable without an initializer starts at the numeric value `0`. This is the member with the value 0, if the enum has one. If not, the value is not a member, and it prints as its number.

An enum can be exported like any type: `export enum Status { ... }`. Importers then write `m.Status` in type positions and `m.Status.OK` in expressions (see [Modules](/docs/modules)).

## Functions

Functions are declared at the top level. The return type comes first, as in a variable declaration, and it is required. A function that returns nothing has the return type `void`. There is no `function` keyword:

```nio
int add(int a, int b) {
    return a + b;
}

void log(String msg) {
    print(msg);
}
```

Code above a function declaration can call the function, and a function can call itself.

### Variadic parameters

`...` before the type of the **last** parameter makes it variadic. That parameter then collects all the arguments that the caller passes after the fixed ones:

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

In the body, the parameter is an array of the declared type. `...String logs` gives a `String[]`, with `.length`, indexing and `forEach`. With no trailing arguments, the array is empty. It is never null.

Only the last parameter can be variadic. The compiler checks each collected argument separately. As a result, `customPrint(0, "a", 1)` is an error. There is no spread operator: an existing `String[]` cannot be passed as the arguments. For callers that have an array, a `String[]` parameter is the correct choice.

Functions are also values. Function values can be created without a name, stored in variables and passed as arguments. They capture the variables around them. [Function values](/docs/functions) gives the details.

A function declared with `async` (`int async sum(int a) { ... }`) defers its body: a call returns a `Future<int>`, and a later `await` gets the result. [Async and futures](/docs/async) gives the details.

## Control flow

Conditions must be `bool` and are always in parentheses. Braces are always required:

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

The `for` header is `init; condition; post`. The init clause can declare a variable, which is visible only inside the loop, or assign to an existing variable. Init and post can be empty. The condition is required.

`break` leaves the innermost loop that contains it. `continue` goes to the next iteration of that loop. Both work in `while`, `for` and `forEach`:

```nio
forEach(scores, s) {
    if (s == 0) { continue; }      // skip this one
    if (s > 100) { break; }        // stop the loop entirely
    print(s);
}
```

`continue` always runs the next step of its loop. In a `for` loop it runs the post clause. The counter increases, and the loop does not repeat without end. `break` skips the post clause and continues after the loop. There are no loop labels. To leave two nested loops, a program breaks the inner loop and tests for this in the outer loop.

These are compile errors:

* `continue` outside a loop.
* `break` outside a loop and outside a `switch`.

A function value written inside a loop cannot break out of the loop, because its body runs when it is called, not where it is written.

After a `while` loop that contains `break`, the compiler cannot prove that the condition is false. As a result, an optional in the condition is not narrowed after the loop, as it is after a loop without `break`.

### `switch`

`switch` compares one value with a list of constants:

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

The subject is evaluated once. The switch compares each `case` label with it by the rules of `==`, in order, and the first match runs its clause. If no label matches, `default` runs. With no `default`, no clause runs.

**A clause never continues into the next clause.** When its last statement finishes, the switch ends. No `break` is necessary between clauses. `break` leaves a clause before its end:

```nio
switch (kind) {
    case "draft":
        if (empty) { break; }     // done with the switch
        publish();
    default:
        print("nothing to do");
}
```

Stacked labels share one clause. A clause with an empty body runs the next clause:

```nio
switch (day) {
    case "sat":
    case "sun":
        print("weekend");
    default:
        print("weekday");
}
```

A switch accepts all types that `==` accepts: the number types, `String`, `bool`, `DateTime`, `Duration`, enums, and optionals of these types. A switch also accepts a [sealed type](#sealed-types), whose clauses match the *type* of the value. An enum subject takes the members of its enum as labels, and an optional subject takes `null` as a label:

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

The compiler enforces these rules for a switch:

* Labels must be **constants**: a literal, a negative number, `null` or an enum member. A computed value needs `if` and `else if`.
* A label cannot occur **twice**.
* `default` must be **last**, and it can occur only once.
* A label that can never equal the subject is an error.

Each clause body is a separate scope. Two clauses can declare the same name. A `break` inside a switch leaves the switch, not the loop around it. A `continue` inside a switch applies to the loop around it:

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

`i++;` and `i--;` add 1 to or subtract 1 from a variable, an array element or a record field. The type must be `int`, `float`, or a sized number type of the same width. This includes a narrowed `int?` or `float?`, which stays narrowed after the operation. They are statements, not expressions, and they are allowed anywhere a statement is allowed. `int x = i++;` does not parse.
