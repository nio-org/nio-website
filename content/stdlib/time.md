---
title: "time module: dates and durations"
description: "The Nio time module reads the current time, creates durations, waits without blocking other async work, and works with UTC calendar dates."
---

# Time

## Introduction

```nio
import 'time';
```

The `time` module reads the current time, creates durations, waits without blocking other async work, and works with UTC calendar dates.

```nio
import 'time';

DateTime started = time.now();
await time.sleep(time.duration("1s"));
Duration elapsed = time.now() - started;

print(time.milliseconds(elapsed));
```

## Notes

The module uses two built-in types:

* `DateTime` is an instant in UTC with millisecond precision.
* `Duration` is a signed length of time measured in milliseconds.

Neither type stores a time zone. Date parsing, formatting, and calendar fields all use UTC.

A whole-number literal can be used where a `Duration` is expected and means milliseconds:

```nio
import 'time';

await time.sleep(250);       // 250 milliseconds
Duration timeout = 5000;     // 5 seconds
```

This shortcut applies to literals. An `int` variable is not automatically converted to a `Duration`.

Common arithmetic is built into the language:

| Expression | Result |
| --- | --- |
| `DateTime - DateTime` | `Duration` |
| `DateTime + Duration` | `DateTime` |
| `DateTime - Duration` | `DateTime` |
| `Duration + Duration` | `Duration` |
| `Duration - Duration` | `Duration` |
| `Duration * int` | `Duration` |
| `Duration / int` | `Duration` |

## `time.now()`

```nio
DateTime time.now()
```

Returns the current instant in UTC.

```nio
import 'time';

DateTime deadline = time.date.fromText("2026-12-31");
if (time.now() < deadline) {
    print("before the deadline");
}
```

## `time.duration()`

```nio
Duration time.duration(String text)
```

Parses a duration made of an optional sign, a whole-number count, and one unit:

| Unit | Meaning |
| --- | --- |
| `s` | seconds |
| `m` | minutes |
| `h` | hours |
| `d` | 24-hour days |

Malformed text causes a runtime error.

```nio
import 'time';

Duration short = time.duration("30s");
Duration long = time.duration("2h");
Duration before = time.duration("-1d");

print(time.milliseconds(short));     // 30000
print(long > short);                 // true
print(before < 0);                   // true
```

## `time.milliseconds()`

```nio
int time.milliseconds(Duration duration)
```

Returns a duration as a plain number of milliseconds.

```nio
import 'time';

Duration timeout = time.duration("2m");
print(time.milliseconds(timeout));   // 120000
```

## `time.sleep()`

```nio
Future<void> time.sleep(Duration duration)
```

Returns a future that completes after the duration. Await the future to pause the current task while allowing other async work to continue.

A negative duration is treated as zero.

```nio
import 'time';

void async remind() {
    await time.sleep(time.duration("1s"));
    print("one second later");
}
```

## `time.date.fromText()`

```nio
DateTime time.date.fromText(String text)
```

Parses either `"YYYY-MM-DD"` at midnight UTC or `"YYYY-MM-DDTHH:MM:SSZ"`.

The month must be from `1` to `12`, the written day from `1` to `31`, and the hour from `0` to `23`. A day beyond the length of its month carries into the next month; for example, `"2026-02-31"` becomes March 3. Other formats, including time-zone offsets other than `Z`, cause a runtime error.

```nio
import 'time';

DateTime day = time.date.fromText("2026-07-25");
DateTime instant = time.date.fromText("2026-07-25T09:31:04Z");

print(time.date.toText(day));       // 2026-07-25T00:00:00Z
print(time.date.toText(instant));   // 2026-07-25T09:31:04Z
```

## `time.date.toText()`

```nio
String time.date.toText(DateTime date)
```

Formats a `DateTime` as `"YYYY-MM-DDTHH:MM:SSZ"` in UTC.

Milliseconds are not included in the result.

```nio
import 'time';

DateTime date = time.date.fromText("2026-07-25");
print(time.date.toText(date));      // 2026-07-25T00:00:00Z
```

## `time.date.year()`

```nio
int time.date.year(DateTime date)
```

Returns the UTC calendar year.

```nio
import 'time';

DateTime date = time.date.fromText("2026-07-25");
print(time.date.year(date));        // 2026
```

## `time.date.month()`

```nio
int time.date.month(DateTime date)
```

Returns the UTC month from `1` to `12`.

```nio
import 'time';

DateTime date = time.date.fromText("2026-07-25");
print(time.date.month(date));       // 7
```

## `time.date.day()`

```nio
int time.date.day(DateTime date)
```

Returns the UTC day of the month from `1` to `31`.

```nio
import 'time';

DateTime date = time.date.fromText("2026-07-25");
print(time.date.day(date));         // 25
```

## `time.date.addDays()`

```nio
DateTime time.date.addDays(DateTime date, int days)
```

Adds or subtracts whole UTC days while preserving the time of day.

```nio
import 'time';

DateTime date = time.date.fromText("2026-07-25");

print(time.date.toText(time.date.addDays(date, 30)));
// 2026-08-24T00:00:00Z

print(time.date.toText(time.date.addDays(date, -25)));
// 2026-06-30T00:00:00Z
```
