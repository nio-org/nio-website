---
title: "json module"
description: "The Nio json module turns records and other values into JSON text, and parses JSON into typed values or into a tree you can navigate."
---

# JSON

## Introduction

```nio
import 'json';
```

Use `json.toText` to turn Nio values into JSON and `json.parse(text) as T` to read JSON into a type.

```nio
import 'json';

type User {
    String name;
    int age;
}

User user = json.parse('{"name":"Ada","age":36}') as User;
print(user.name);                  // Ada
print(json.toText(user));          // {"name":"Ada","age":36}
```

When the document's structure is not known in advance, `json.parse(text)` returns a `Json` value that can be inspected at run time.

## Notes

JSON values map to Nio values as follows:

| JSON | Nio |
| --- | --- |
| number | integer, float, `Duration`, or enum |
| string | `String` or `DateTime` |
| boolean | `bool` |
| array | `T[]` |
| object with known fields | record |
| object with dynamic keys | `Map<String, V>` |
| null | `T?` |
| any shape | `Json` |

Record fields use their declared names as JSON keys. Add a `'json:key'` annotation to use another name, for example `int horsePower 'json:horse_power';`.

<a id="function-typed-fields"></a>

Optional fields that are `null`, function fields, and `RegExp` fields are omitted when a record is serialized.

`Json` values have one of these `json.Type` members: `MISSING`, `NULL`, `BOOL`, `NUMBER`, `STRING`, `ARRAY`, or `OBJECT`. Index objects with a `String` and arrays with an `int`. Missing keys and out-of-range reads return `MISSING`. Indexed assignment inserts or replaces values; writing through a missing value or the wrong shape causes a runtime error.

```nio
import 'json';

Json doc = json.parse('{"tags":["nio","docs"]}');

print(json.getType(doc["owner"]) == json.Type.MISSING);   // true
doc["owner"] = "team";
doc["tags"][0] = "language";
doc["settings"] = json.parse("{}");
doc["settings"]["theme"] = "dark";

print(json.toText(doc));
// {"tags":["language","docs"],"owner":"team","settings":{"theme":"dark"}}
```

## `json.toText()`

```nio
String json.toText(any value)
```

Serializes records, arrays, scalars, optionals, `Json`, and maps with `String` keys.

A bare `null`, function, future, `RegExp`, or map with non-string keys cannot be serialized. Non-finite floats cause a runtime error.

```nio
import 'json';

type Project {
    String name;
    String? owner;
    String[] tags;
}

Project project = {
    name: "nio",
    tags: ["language", "compiler"]
};

print(json.toText(project));
// {"name":"nio","tags":["language","compiler"]}
```

## `json.parse()`

```nio
T json.parse(String text) as T
T json.parse(String text) strict as T
Json json.parse(String text)
```

Parses JSON text. Parsing is fallible for malformed JSON, missing required fields, wrong value types, and out-of-range numbers.

Each form also accepts a `byte[]` in place of the `String`. A document that arrives as bytes — a file from `fs.readFile`, a request body from `http` — is parsed in place, without the copy `string.fromByteArray` would make first:

```nio
import 'fs';
import 'json';

Json? doc = json.parse(fs.readFile("config.json")) catch e {
    print(e.message);
};
```

With `as T`, required fields must be present, optional fields may be missing or `null`, and unknown keys are ignored. `strict as T` rejects unknown keys. A `Json` field annotated with `'json*'` preserves them instead; nested records need their own such field, and it cannot be combined with `strict`.

Without `as T`, the result is a dynamic `Json`. An existing `Json` can also be converted later with `value as T`.

```nio
import 'json';

type Profile {
    String name;
    int score;
    String? nickname;
    Json extra 'json*';
}

Profile? profile = json.parse(
    '{"name":"Ada","score":100,"owner":"team"}'
) as Profile catch e {
    print(e.message);
};

if (profile != null) {
    print(profile.name);                              // Ada
    print(json.asText(profile.extra["owner"]));       // team
}

Json doc = json.parse('{"name":"api","ports":[80,443]}');
print(json.asInt(doc["ports"][1]));                   // 443

type Limits { int rate; int burst; }
Limits? limits = json.parse(
    '{"rat":100,"burst":20}'
) strict as Limits catch e {
    print(e.message);                 // cannot parse JSON: unknown key "rat"
};
```

### Union fields: one key, several shapes

Real-world documents often carry a field that is sometimes one kind and
sometimes another — a price that is usually `"$4.99"` but occasionally the
bare number `100`. A union models it directly: the JSON kind of the value
(string, number, `true`/`false`, array, object) picks the member, and
`json.toText` writes the payload back bare, so the document round-trips
exactly as it arrived.

```nio
import 'json';
import 'string';

union Price { String, int Amount }
type Item  { Price price; String name; }

String doc = '[{"price":"$4.99","name":"a"},{"price":100,"name":"b"}]';
Item[] items = json.parse(doc) as Item[];

forEach(items, it) {
    switch (it.price) {
        case Price.String s: print(it.name + " costs " + s);
        case Price.Amount n: print(it.name + " costs " + string.from(n));
    }
}

print(json.toText(items) == doc);                     // true
```

The choice must be unambiguous, and the compiler checks it where the `as`
is written: no two members may be read from the same JSON kind. `String`
and `DateTime` both arrive as strings, every numeric type as a number, and
every record or `Map<String, V>` as an object, so `union Bad { int I, float F }`
is refused as a parse target with both tags named. JSON `null` chooses no
member — a field that may be null is `Price?`, like any other type — and a
value of a kind no member takes is a catchable failure naming the kinds the
union does take: `expected a string or a number at [0].price`.

## `json.getType()`

```nio
json.Type json.getType(Json value)
```

Returns the current shape of a `Json` value.

```nio
import 'json';

Json doc = json.parse('{"active":true,"owner":null}');

print(json.getType(doc) == json.Type.OBJECT);             // true
print(json.getType(doc["active"]) == json.Type.BOOL);     // true
print(json.getType(doc["owner"]) == json.Type.NULL);      // true
print(json.getType(doc["missing"]) == json.Type.MISSING); // true
```

## `json.asInt()`

```nio
int json.asInt(Json value)
```

Reads a whole JSON number as an `int`. The call is fallible when the value is missing, has another type, is fractional, or is outside the integer range.

```nio
import 'json';

Json doc = json.parse('{"count":42,"ratio":1.5}');

print(json.asInt(doc["count"]));             // 42
print(json.asInt(doc["ratio"]) catch 0);     // 0
```

## `json.asFloat()`

```nio
float json.asFloat(Json value)
```

Reads a JSON number as a `float`. The call is fallible when the value is missing or is not a number.

```nio
import 'json';

Json doc = json.parse('{"ratio":0.75}');
print(json.asFloat(doc["ratio"]) catch 0.0);  // 0.75
```

## `json.asText()`

```nio
String json.asText(Json value)
```

Reads a JSON string. The call is fallible when the value is missing or is not a string.

```nio
import 'json';

Json doc = json.parse('{"name":"nio"}');
print(json.asText(doc["name"]) catch "unknown");   // nio
```

## `json.asBool()`

```nio
bool json.asBool(Json value)
```

Reads a JSON boolean. The call is fallible when the value is missing or is not a boolean.

```nio
import 'json';

Json doc = json.parse('{"enabled":true}');
print(json.asBool(doc["enabled"]) catch false);    // true
```

## `json.keys()`

```nio
String[] json.keys(Json value)
```

Returns an object's keys in document order. For any other JSON shape, it returns an empty array.

```nio
import 'json';

Json doc = json.parse('{"name":"nio","stars":10}');

forEach(json.keys(doc), key) {
    print(key);
}
```

## `json.length()`

```nio
int json.length(Json value)
```

Returns the number of elements in an array or keys in an object. For other JSON shapes, it returns `0`.

```nio
import 'json';

Json doc = json.parse('{"tags":["one","two"],"empty":{}}');

print(json.length(doc));           // 2
print(json.length(doc["tags"]));   // 2
print(json.length(doc["empty"]));  // 0
```

## `json.push()`

```nio
void json.push(Json array, any value)
```

Adds a value to the end of a JSON array. The value may be anything accepted by `json.toText`.

Calling `push` on a value that is not an array causes a runtime error.

```nio
import 'json';

Json doc = json.parse('{"tags":["nio"]}');
json.push(doc["tags"], "docs");

print(json.toText(doc));       // {"tags":["nio","docs"]}
```

## `json.remove()`

```nio
void json.remove(Json object, String key)
```

Removes `key` from a JSON object. Removing a missing key, or calling the function on another JSON shape, does nothing.

```nio
import 'json';

Json doc = json.parse('{"name":"nio","old":true}');
json.remove(doc, "old");

print(json.toText(doc));       // {"name":"nio"}
```
