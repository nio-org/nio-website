---
title: "os module"
description: "The Nio os module reports the current platform, the processor architecture, and the logical processors of the machine."
---

# OS

## Introduction

```nio
import 'os';
```

The `os` module reports the current platform, processor architecture, and logical processors.

```nio
import 'os';

print(os.getPlatform());        // linux, darwin, win32, ...
print(os.getArch());            // x64, arm, ...
print(os.getCpus().length);     // number of logical processors
```

## Notes

<a id="types"></a>

`os.getCpus()` returns `os.Cpu` records:

| Field | Type | Description |
| --- | --- | --- |
| `model` | `String?` | Processor model, or `null` when unavailable. |
| `speed` | `int?` | Clock speed in MHz, or `null` when unavailable. |

No function in this module is fallible. Information that the system does not provide is returned as `"unknown"` or `null`.

## `os.getArch()`

```nio
String os.getArch()
```

Returns the processor architecture: `"arm"` for 64-bit ARM, `"arm32"`, `"x64"`, `"x86"`, or `"unknown"`.

```nio
import 'os';

if (os.getArch() == "arm") {
    print("running on 64-bit ARM");
}
```

## `os.getCpus()`

```nio
os.Cpu[] os.getCpus()
```

Returns one `os.Cpu` entry per logical processor.

```nio
import 'os';

os.Cpu[] cpus = os.getCpus();
print(cpus.length, "logical processors");

forEach(cpus, cpu) {
    if (cpu.model != null) {
        print(cpu.model);
    }
}
```

## `os.getPlatform()`

```nio
String os.getPlatform()
```

Returns `"darwin"`, `"win32"`, `"linux"`, `"openbsd"`, `"freebsd"`, or `"unknown"`.

```nio
import 'os';

if (os.getPlatform() == "win32") {
    print("Windows");
}
```
