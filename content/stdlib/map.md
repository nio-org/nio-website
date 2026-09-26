---
title: "map module"
description: "The Nio map module copies maps, checks for and removes keys, and lists a map's keys or values."
---

# Map

## Introduction

```nio
import 'map';
```

The `Map<K, V>` type is built into the language. The `map` module adds functions for copying a map, checking and removing keys, and retrieving its keys or values.

See [Maps](/docs/maps) for map literals, indexing, assignment, and `.length`.

## Notes

* Maps keep their entries in insertion order.
* `keys` and `values` return new arrays. Changing those arrays does not change the map.
* `copy` creates a new map, but it does not copy records stored inside it.
* These are module functions: use `map.has(ages, "ada")`, not `ages.has("ada")`.

## `map.copy()`

```nio
Map<K, V> map.copy(Map<K, V> m)
```

Returns a new map with the same entries and order.

```nio
import 'map';

Map<String, int> ages = { "ada": 36, "grace": 40 };
Map<String, int> copy = map.copy(ages);

copy["linus"] = 22;

print(ages.length);      // 2
print(copy.length);      // 3
```

## `map.has()`

```nio
bool map.has(Map<K, V> m, K key)
```

Reports whether `key` is present in the map.

```nio
import 'map';

Map<String, int> ages = { "ada": 36 };

print(map.has(ages, "ada"));     // true
print(map.has(ages, "grace"));   // false
```

## `map.keys()`

```nio
K[] map.keys(Map<K, V> m)
```

Returns the keys in insertion order as a new growable array. Use it with `forEach` to iterate over a map.

```nio
import 'map';

Map<String, int> ages = { "ada": 36, "grace": 40 };

forEach(map.keys(ages), name) {
    print(name, ages[name]);
}
```

## `map.remove()`

```nio
bool map.remove(Map<K, V> m, K key)
```

Removes the entry for `key` and returns `true`. If the key was not present, the map is unchanged and the function returns `false`.

```nio
import 'map';

Map<String, int> ages = { "ada": 36, "grace": 40 };

print(map.remove(ages, "grace"));   // true
print(map.remove(ages, "grace"));   // false
print(ages.length);                 // 1
```

## `map.values()`

```nio
V[] map.values(Map<K, V> m)
```

Returns the values in insertion order as a new growable array. The result uses the same order as `map.keys(m)`.

```nio
import 'map';
import 'json';

Map<String, int> ages = { "ada": 36, "grace": 40 };
print(json.toText(map.values(ages)));   // [36,40]
```
