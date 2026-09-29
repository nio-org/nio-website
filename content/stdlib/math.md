---
title: "math module"
description: "The Nio math module: square roots, powers, trigonometry, logarithms, rounding, abs, min, max, clamp, and the constants PI and E."
---

# Math

## Introduction

```nio
import 'math';
```

The `math` module contains square roots and powers, trigonometry, logarithms, rounding, `abs`, `min`, `max` and `clamp`. It also contains conversions between whole numbers and floats.

```nio
import 'math';

float side = math.sqrt(3.0 * 3.0 + 4.0 * 4.0);
print(side);                                   // 5
print(math.round(2.5), math.floor(-2.5));      // 3 -3
print(math.clamp(15, 0, 10));                  // 10
print(math.toInt(side) + 1);                   // 6
```

## Notes

* **Invalid results do not stop the program.** `math.sqrt(-1.0)` returns NaN ("not a number"), `math.log(0.0)` returns `-inf`, and `math.pow(10.0, 400.0)` returns `inf`. The float operators follow the same rule (`1.0 / 0.0` is `inf`). This behavior follows the IEEE 754 standard. `print` writes these values as `nan`, `inf` and `-inf`.
* NaN is not equal to any value, including NaN. `math.isNaN` tests for NaN. `math.isInfinite` tests for `inf` and `-inf`.
* **The float functions take a `float`.** `math.sqrt(4)` is a compile error, because `4` is a whole number. `math.sqrt(4.0)` is correct. A `float32` is permitted in all places where a `float` is permitted.
* **`abs`, `min`, `max` and `clamp` take all number types.** The arguments follow the same rules as `+`. They must be from the same family (signed, unsigned, or float), and the result has the type that `+` gives. A number literal next to a value gets the type of that value. For example, `math.max(u, 0)` is correct when `u` is a `uint`.
* **`toInt` and `toFloat` convert between whole numbers and floats.** `as` does not do these conversions (see [the `as` expression](/docs/basics)). `toInt` always rounds toward zero. For a different rounding direction, a program calls `floor`, `ceil` or `round` first.

## `math.PI`

```nio
float math.PI    // 3.141592653589793
```

The constant pi, as a `float`. The other constant in this module is [`math.E`](#mathe).

```nio
import 'math';

float radius = 2.0;
print(math.PI * radius * radius);     // 12.566370614359172
```

## `math.E`

```nio
float math.E     // 2.718281828459045
```

The constant e, the base of the natural logarithm, as a `float`.

```nio
import 'math';

print(math.E);                 // 2.718281828459045
print(math.log(math.E));       // 1
```

## `math.sqrt()`

```nio
float math.sqrt(float x)
```

Returns the square root of `x`. A negative `x` returns NaN.

```nio
import 'math';

print(math.sqrt(16.0));    // 4
```

## `math.pow()`

```nio
float math.pow(float x, float y)
```

Returns `x` raised to the power `y`.

```nio
import 'math';

print(math.pow(2.0, 10.0));   // 1024
print(math.pow(9.0, 0.5));    // 3
```

## `math.sin()`

```nio
float math.sin(float x)
```

Returns the sine of the angle `x`. The angle is in radians. A full turn is `2.0 * math.PI`. This is also true for `math.cos` and `math.tan`.

```nio
import 'math';

print(math.sin(0.0));                // 0
print(math.sin(math.PI / 2.0));      // 1
```

## `math.cos()`

```nio
float math.cos(float x)
```

Returns the cosine of the angle `x`. The angle is in radians, as for [`math.sin`](#mathsin).

```nio
import 'math';

print(math.cos(0.0));          // 1
print(math.cos(math.PI));      // -1
```

## `math.tan()`

```nio
float math.tan(float x)
```

Returns the tangent of the angle `x`. The angle is in radians, as for [`math.sin`](#mathsin).

```nio
import 'math';

print(math.tan(0.0));          // 0
```

## `math.asin()`

```nio
float math.asin(float x)
```

Returns the inverse sine of `x`: it takes a ratio and returns an angle in radians. `math.acos` and `math.atan` also return radians.

```nio
import 'math';

print(math.asin(1.0) == math.PI / 2.0);   // true
```

## `math.acos()`

```nio
float math.acos(float x)
```

Returns the inverse cosine of `x`: it takes a ratio and returns an angle in radians.

```nio
import 'math';

print(math.acos(-1.0) == math.PI);   // true
```

## `math.atan()`

```nio
float math.atan(float x)
```

Returns the inverse tangent of `x`: it takes a ratio and returns an angle in radians. [`math.atan2`](#mathatan2) returns the angle of a point.

```nio
import 'math';

print(math.atan(1.0) == math.PI / 4.0);   // true
```

## `math.atan2()`

```nio
float math.atan2(float y, float x)
```

Returns the angle, in radians, from the positive x axis to the point `(x, y)`. The result is correct in all four quadrants, and the function works when `x` is zero. `atan(y / x)` does not give these results. The first argument is `y`.

```nio
import 'math';

print(math.atan2(1.0, 1.0) == math.PI / 4.0);   // true
```

## `math.log()`

```nio
float math.log(float x)
```

Returns the logarithm of `x` in base e. `log(0.0)` returns `-inf`, and a negative `x` returns NaN. `math.log2` and `math.log10` follow the same rule.

```nio
import 'math';

print(math.log(1.0));                   // 0
print(math.log(math.E));                // 1
print(math.log(0.0), math.log(-1.0));   // -inf nan
```

## `math.log2()`

```nio
float math.log2(float x)
```

Returns the logarithm of `x` in base 2. As with [`math.log`](#mathlog), zero returns `-inf` and a negative `x` returns NaN.

```nio
import 'math';

print(math.log2(1024.0));     // 10
```

## `math.log10()`

```nio
float math.log10(float x)
```

Returns the logarithm of `x` in base 10. As with [`math.log`](#mathlog), zero returns `-inf` and a negative `x` returns NaN.

```nio
import 'math';

print(math.log10(1000.0));    // 3
```

## `math.exp()`

```nio
float math.exp(float x)
```

Returns e raised to the power `x`. It is the inverse of `math.log`.

```nio
import 'math';

print(math.exp(0.0));               // 1
print(math.exp(1.0) == math.E);     // true
```

## `math.floor()`

```nio
float math.floor(float x)
```

Rounds `x` down to a whole number and returns it as a `float`. `math.ceil` and `math.round` also return a `float`.

```nio
import 'math';

print(math.floor(2.7), math.floor(-2.5));   // 2 -3
```

## `math.ceil()`

```nio
float math.ceil(float x)
```

Rounds `x` up to a whole number. As with [`math.floor`](#mathfloor), the result is a `float`.

```nio
import 'math';

print(math.ceil(2.1), math.ceil(-2.5));     // 3 -2
```

## `math.round()`

```nio
float math.round(float x)
```

Rounds `x` to the nearest whole number. A value halfway between two whole numbers rounds away from zero. As with [`math.floor`](#mathfloor), the result is a `float`.

```nio
import 'math';

print(math.round(2.4), math.round(2.5));    // 2 3
print(math.round(-2.5));                    // -3
```

## `math.isNaN()`

```nio
bool math.isNaN(float x)
```

Returns `true` when `x` is NaN. This function is the test for NaN, because `x == x` is `false` when `x` is NaN.

```nio
import 'math';

float bad = math.sqrt(-1.0);
print(math.isNaN(bad));        // true
print(bad == bad);             // false
print(math.isNaN(1.0));        // false
```

## `math.isInfinite()`

```nio
bool math.isInfinite(float x)
```

Returns `true` when `x` is `inf` or `-inf`. Together with [`math.isNaN`](#mathisnan), it tests for results that are not finite numbers.

```nio
import 'math';

print(math.isInfinite(1.0 / 0.0));         // true
print(math.isInfinite(math.log(0.0)));     // true
print(math.isInfinite(1.0));               // false
```

## `math.toInt()`

```nio
int math.toInt(float x)
```

Converts a float to an `int`. It removes the fractional part. It always rounds toward zero. For a different rounding direction, a program calls `floor`, `ceil` or `round` first.

> [!WARNING]
>
> `toInt` is the only function in this module that can stop the program. It causes a runtime error when `x` is NaN, infinite, or too large for an `int`.

```nio
import 'math';

print(math.toInt(2.9), math.toInt(-2.9));      // 2 -2
print(math.toInt(math.round(2.9)));            // 3
```

## `math.toFloat()`

```nio
float math.toFloat(integer n)
```

Converts a whole number of an integer type, signed or unsigned, to the nearest `float`. It does not fail.

```nio
import 'math';

print(math.toFloat(7) / 2.0);        // 3.5

uint count = 3;
print(math.toFloat(count));          // 3
```

## `math.abs()`

```nio
T math.abs(T x)
```

Returns the absolute value of `x`. It works on all number types.

```nio
import 'math';

int n = -3;
float f = -2.5;
print(math.abs(n), math.abs(f));     // 3 2.5
```

## `math.min()`

```nio
T math.min(T a, T b)
```

Returns the smaller of two numbers. When one of two floats is NaN, the other one is returned. `math.max` follows the same NaN rule.

```nio
import 'math';

int n = -3;
print(math.min(n, 2));                      // -3
print(math.min(math.sqrt(-1.0), 1.5));      // 1.5
```

## `math.max()`

```nio
T math.max(T a, T b)
```

Returns the larger of two numbers. As with [`math.min`](#mathmin), when one of two floats is NaN, the other one is returned.

```nio
import 'math';

int n = -3;
print(math.max(n, 2));                      // 2
print(math.max(math.sqrt(-1.0), 1.5));      // 1.5
```

## `math.clamp()`

```nio
T math.clamp(T x, T lo, T hi)
```

Limits `x` to the range from `lo` to `hi`. It returns `lo` when `x` is less than `lo`, `hi` when `x` is more than `hi`, and `x` in all other cases.

```nio
import 'math';

print(math.clamp(-3, 0, 10));             // 0
print(math.clamp(-2.5, -1.0, 1.0));       // -1
```
