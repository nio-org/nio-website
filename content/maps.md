---
title: "Maps"
description: "Maps in Nio are hash maps that keep insertion order. This page shows how to declare them, read and write entries, write map literals, iterate and convert to JSON."
---

# Maps

A `Map<K, V>` is a hash map: a mutable collection of key → value entries with fast lookup by key. Iteration follows insertion order. The type is part of the language. Declarations, indexing and literals need no import. Only the functions of the [map library](/docs/stdlib/map) need an import.

## Declaring maps

A map declared without an initializer is empty, like a growable array:

```nio
Map<String, int> ages;
print(ages.length);          // 0
```

A key is a `String` or one of the scalar types that compare by value: the integer types, `bool`, `DateTime`, `Duration` and enums. A float cannot be a key, because NaN is not equal to itself. A lookup could never find an entry with a NaN key. Records and arrays cannot be keys, because they compare by reference. String keys hash and compare by *content*. As a result, a key built at run time finds an entry stored under a literal.

A value can have any type except an optional, because a lookup already returns an optional (see below). `Map<String, int?>` is a compile error. The value type is `int` instead.

Like arrays and records, a map is a reference. Assignment and parameter passing share the same map. `map.copy` makes a shallow copy.

## Writing and reading

`m[k] = v` inserts the key or overwrites its value. `m[k]` reads the value and returns `V?`. A missing key is not an error: the result is `null`. The result can be [narrowed](/docs/basics) like any other optional:

```nio
Map<String, int> ages;
ages["alice"] = 31;
ages["alice"] = 32;            // overwrite; the entry keeps its place

int? age = ages["alice"];
if (age != null) {
    print(age);              // 32 — narrowed to a plain int
}
print(ages["carol"]);        // null
print(ages.length);          // 1
```

Narrowing applies to variables and record fields, not to a map lookup. As a result, a null test on `m[k]` does not narrow `m[k]`. A program assigns the lookup to a variable and tests the variable. `m[k]++` is also a compile error. A program writes the read, the change and the write as separate steps:

```nio
Map<String, int> counts = { "alice": 1 };

int? hits = counts["alice"];
if (hits != null) {
    counts["alice"] = hits + 1;
}
print(counts["alice"]);      // 2
```

## Map literals

A map literal lists entries in braces. The first key tells a map literal from a record literal. A record field has a bare identifier as its name. A map key is a *literal constant*: a string literal or a number literal, which can be negative. `{}` is the empty map where a map type is expected, as `[]` is the empty array:

```nio
Map<String, int> ages = { "alice": 31, "bob": 27 };
Map<int, String> codes = { 200: "ok", 404: "not found", -1: "minus" };
Map<String, float> scores = {};
```

One kind of brace literal can be inside the other. Quoted keys mark map entries, and bare names mark record fields:

```nio
type Car { String make; int age; }

Map<String, Car> fleet = {
    "garage-1": { make: "toyota", age: 4 },
    "garage-2": { make: "volvo", age: 11 },
};
print(fleet["garage-1"]?.make); // toyota — ?. chains through the lookup

// Only a literal can key an entry of a literal; anything computed — a
// variable, a bool, an enum member — goes through indexed assignment:
String slot = "garage-3";
fleet[slot] = { make: "fiat", age: 1 };
print(fleet.length);            // 3
```

## Iterating

A `forEach` on the keys of a map iterates over the map:

```nio
import 'map';

Map<String, int> ages = { "alice": 32, "dana": 45 };
forEach(map.keys(ages), name) {
    print(name);             // alice, dana — insertion order
    print(ages[name]);       // 32, 45
}
```

Iteration order is **insertion order**: the order in which the entries were first inserted. An overwrite does not change the position of an entry. A key that is removed and then inserted again moves to the end. `map.keys`, `map.values` and JSON serialization all use this order. As a result, the output is always the same.

## Maps and JSON

A `Map<String, V>` serializes to a JSON object. It is for objects whose keys are *data*, not declared fields. A record cannot hold such objects:

```nio
import 'json';

type Ledger { int total; }

String text = '{"user-1":{"total":30},"user-2":{"total":12}}';
Map<String, Ledger>? byUser = json.parse(text) as Map<String, Ledger> catch e {
    print(e.message);
};
if (byUser != null) {
    print(byUser["user-2"]?.total); // 12
    print(json.toText(byUser));     // {"user-1":{"total":30},"user-2":{"total":12}}
}
```

JSON object keys are strings. As a result, only maps with `String` keys have a JSON form. The [JSON](/docs/stdlib/json) page has the details.

Maps cannot be compared with `==` or printed directly. A program serializes a map with `json.toText`, or it checks the entries one by one.
