---
title: "Maps"
description: "Maps in Nio are hash maps that keep insertion order: declare them, read and write entries, write map literals, iterate and convert to JSON."
---

# Maps

A `Map<K, V>` is a hash map: a mutable collection of key → value entries with fast lookup by key, iterated in insertion order. The type is part of the language — declaring, indexing, and literals need no import; only the functions of the [map library](/docs/stdlib/map) do.

## Declaring maps

A map declared without an initializer starts empty, like a growable array:

```nio
Map<String, int> ages;
print(ages.length);          // 0
```

Keys are `String` or one of the scalar types compared by value: the integer types, `bool`, `DateTime`, `Duration`, and enums. Floats cannot key a map — NaN never equals itself, so a float key could be stored and never found — and neither can records or arrays, which compare by reference. String keys hash and compare by *content*: a key built at run time finds an entry stored under a literal.

Values may be any type except an optional, because lookup already yields one (below): `Map<String, int?>` is a compile error — store the `int`.

Like arrays and records, a map is a reference: assignment and parameter passing share the one map, and `map.copy` makes a shallow copy.

## Writing and reading

`m[k] = v` inserts the key or overwrites its value. `m[k]` reads, and yields `V?` — an absent key is normal data, not an error, so the result is `null` rather than a crash, and it composes with [narrowing](/docs/basics) like any other optional:

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

A lookup is not a *path*, so `m[k]` itself never narrows — bind it to a variable and test that. For the same reason `m[k]++` is a compile error; the read-modify-write is spelled out:

```nio
Map<String, int> counts = { "alice": 1 };

int? hits = counts["alice"];
if (hits != null) {
    counts["alice"] = hits + 1;
}
print(counts["alice"]);      // 2
```

## Map literals

A map literal lists entries in braces, and the first key tells it apart from a record literal: a record field is named by a bare identifier, a map key is a *literal constant* — a string literal or a (possibly negated) number literal. `{}` is the empty map wherever a map type is expected, exactly as `[]` is the empty array:

```nio
Map<String, int> ages = { "alice": 31, "bob": 27 };
Map<int, String> codes = { 200: "ok", 404: "not found", -1: "minus" };
Map<String, float> scores = {};
```

The two brace literals nest without ambiguity — quoted keys mark map entries, bare names mark record fields:

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

Iteration goes through the keys, with the ordinary `forEach`:

```nio
import 'map';

Map<String, int> ages = { "alice": 32, "dana": 45 };
forEach(map.keys(ages), name) {
    print(name);             // alice, dana — insertion order
    print(ages[name]);       // 32, 45
}
```

Iteration order is **insertion order** — the order entries were first inserted, an overwrite keeping the entry's place and a removed-then-reinserted key moving to the end. `map.keys`, `map.values`, and JSON serialization all follow it, so output is deterministic.

## Maps and JSON

A `Map<String, V>` serializes to a JSON object and is the type for objects whose keys are *data* rather than declared fields — something a record cannot model:

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

JSON object keys are strings, so only String-keyed maps have a JSON form; see [JSON](/docs/stdlib/json).

Maps cannot be compared with `==` or printed directly — serialize with `json.toText`, or check entries individually.
