---
title: "Packages"
description: "Use packages in Nio with nio get: exact versions, compatibility bands, hash verification on every build, updating and vendoring."
---

# Packages

A Nio program imports files. A **package** is the case where the file is not
yours: code in someone else's repository, fetched, verified, and compiled into
your binary like any other module.

## Getting one

```sh
nio get 'github.com/nio-lang/nio-log' v0.2.0
```

```text
fetching github.com/nio-lang/nio-log v0.2.0 ... done
added to nio.deps as `log`
  github.com/nio-lang/nio-log v0.2.0  band v0.2
```

That writes `nio.deps`, which is the whole dependency state of the project:

```text
package notes

require 'github.com/nio-lang/nio-log' v0.2.0 as log;

// resolved -- maintained by nio, do not edit
resolved 'github.com/nio-lang/nio-log' v0.2.0 sha256:71acdd90...;
```

Everything above the resolved block is yours; the block itself is the tool's.
Your source files then name the **alias** and nothing else:

```nio
import 'log';

log.Logger l = log.create("notes");
log.info(l, "started");
```

The URL appears exactly once, in the manifest. Moving a dependency to a fork,
or across a major version, is a one-line edit rather than a sweep through every
file that imports it. A package with several modules is reached by path —
`import 'log/rotate'` — though most packages present everything through one file by
[re-exporting](/docs/modules#re-exporting) their parts.

On a fresh clone, or whenever `nio.deps` changed under you, run `nio get` with no
arguments:

```sh
nio get
```

That fetches every package `nio.deps` requires that is not already on the
machine, and checks each one against the hash recorded for it. To move a
package to another version, name the version:

```sh
nio get 'github.com/nio-lang/nio-log' v0.2.7
```

The `require` line changes to the new version and keeps its alias, so no
import changes. A new package whose default alias is already taken is refused
and not renamed; write its `require` line with an alias of your choosing, then
run `nio get`.

## Versions are exact, and a band is a package

A requirement names one version. There are no ranges, no `^1.2.3`, and
therefore no solver and no lock file: resolution is a pure function of the
manifests, so it gives the same answer on every machine, in any order, offline.

The idea that makes that work is that **a compatibility band is a package**.
`nio-log` at `v0.1.4` and at `v0.2.0` are not two versions of one thing to be
reconciled — they are two packages that happen to share a name.

| releases | band | copies in a build |
| --- | --- | --- |
| `v0.1.0` … `v0.1.9` | `v0.1` | one |
| `v0.2.0` … `v0.2.4` | `v0.2` | one, separate from `v0.1` |
| `v1.0.0` … `v1.9.3` | `v1` | one, for every `1.x` ever released |
| `v2.0.0` … | `v2` | one, separate from `v1` |

That is semver read literally: major versions are incompatible, and below 1.0
so are minors. The band is computed from the version and never written, so
there is nothing for a package author to do when they cut `0.3.0`.

Within a band, the newest version anybody asks for wins — semver's own claim is
that they are compatible. So if you require `v0.2.0` and a dependency requires
`v0.2.5`, the build uses `v0.2.5`, including for your own `import 'log'`.

Reaching 1.0 is a gift to the people who depend on you rather than a ceremony:
from then on every future minor and patch collapses into a single copy.

## When two bands meet

Two bands in one build means two `log.Logger` types, and a value of one is not
a value of the other. A type from a package is named by the package, and by its
version as well once the build holds two bands of it, so the compiler says
which is which and who brought each one in:

```text
error: argument 1 of old.describe: cannot use log@v0.2.5.Logger as log@v0.1.4.Logger
 --> main.nio:3:30
  |
3 | print(old.describe(log.create("notes")));
  |                              ^
note: log@v0.2.5 is github.com/nio-lang/nio-log v0.2.5, required by notes
note: log@v0.1.4 is github.com/nio-lang/nio-log v0.1.4, required by github.com/a/nio-old v1.0.0
note: these are different types, and no value crosses between them; `unify 'github.com/nio-lang/nio-log' v0.2.5;` in the project's nio.deps makes every band of it one version
```

This is correct — the two records may have different fields at different
offsets — and it is usually invisible, because a package that logs internally
and never hands a `Logger` out can be duplicated freely. It bites only when a
package puts a third-party type in its own public API, which is a design smell
independently of any of this. `nio get` and `nio update` say when the graph
holds a package at two bands, before anything is written against it.

Two things follow that are worth knowing: both bands' top-level code runs, so a
package holding a connection pool or a cache has two of them; and both compile
into the binary.

The same name is what `getType` answers for a value of such a type:
`log.Logger` with one band, and
`log@v0.2.5.Logger` with two.

## Unify and replace

Two lines in `nio.deps` change what a requirement leads to. Both are honoured
**only in the project's own manifest**, so a dependency can never rewrite your
graph; the same lines in a dependency's manifest are ignored.

```text
// every band of nio-log is this one version
unify 'github.com/nio-lang/nio-log' v0.2.5;

// a fork, at a version of its own
replace 'github.com/nio-lang/nio-fmt' with 'github.com/me/nio-fmt' v1.0.3;

// a directory, for two packages written together
replace 'github.com/a/nio-webview' with '../nio-webview';
```

`unify` makes the types cross, and a package written against another band is
compiled against the version it names — so if that band changed its API, the
error is in that package, and `unify` is the wrong tool. A `replace` applies
before a `unify`, and a package may be named by one of them only.

A package replaced by a directory is being edited: no hash is recorded for it,
and `nio vendor` leaves it where it is.

## What a package is

A repository with a `nio.deps` in it. A version is a tag.

```text
nio-log/
  nio.deps        package nio-log
  lib.nio         the entry module, unless `entry` names another
  rotate.nio
```

Publishing is `git tag v0.2.1 && git push --tags`. There is no registry
account, no upload step, and no build artifact.

## Where packages come from

A tag tarball over HTTPS, using Nio's own [`http`](/docs/stdlib/http),
[`tls`](/docs/stdlib/tls) and [`x509`](/docs/stdlib/x509) — so `nio` verifies the
certificate chain with the same code your programs do, and reads the gzip and
the tar itself. Fetching a package needs nothing installed but `nio`. Nothing in
a package is executed at fetch time: fetching is download, verify, extract, and
nothing else. An archive holding a symbolic link, or a path that would be
written outside the package's own directory, is refused.

Packages land in a cache shared by every project on the machine. A build
**never** touches the network: a package that is not there is reported as
missing, and `nio get`, `nio update` or `nio vendor` fetches it. That makes an
offline build and a CI build the normal case rather than a supported edge.

## Verification

`nio get` records the hash of the tree it fetched, and **every build checks the
trees on disk against those hashes**. Editing a cached package — or a tag that
moved under you — is a compile error naming the package and both hashes:

```text
package github.com/pkg/errors v0.9.1 does not match the hash nio.deps recorded for it
  recorded: sha256:67c78ecb...
  on disk:  sha256:7c3ad431...
  the tree at ...pkg/github.com/pkg/errors@v0.9.1 changed after it was resolved
```

The **tree** is hashed, never the archive. A host's generated tarballs are not
byte-stable — GitHub changed its compression in 2023 and altered the checksum
of every already-published tag — so hashing content is what keeps a recorded
hash meaningful, and what makes a force-moved tag detectable rather than
silently trusted.

## Updating

```sh
nio update
```

```text
  github.com/nio-lang/nio-log  v0.2.0 -> v0.2.7  (band v0.2)
    v1.2.0 is available in a new band (v1); `nio get 'github.com/nio-lang/nio-log' v1.2.0` moves to it
updated nio.deps
```

moves each requirement to the newest version **of its own band**, fetches it,
and records its hash. A newer band is named and not taken: it is a different
package, entitled to break its API, so moving to one is a deliberate
`nio get`. `nio update log` updates one requirement, named by its alias or its
path.

The versions come from the repository itself, through the request every
`git clone` starts with, so there is no API to be rate-limited by. A tag counts
when it is a version like `v1.2.3`; branches and pre-releases such as
`v1.3.0-rc1` are ignored. Every version is asked for before anything is
written, so an update applies whole or not at all.

## Vendoring

```sh
nio vendor
```

copies the resolved packages into `./modules`, which a build prefers over the
shared cache. A vendored tree needs no network and survives a deleted upstream
tag, which the cache and the hashes cannot: they protect an existing checkout
and detect tampering, but neither can conjure a repository that is gone.

## What is not built yet

- **Anything but GitHub.** The tarball path is a host's convention rather than
  a standard, so another host is reported rather than guessed at.
- **Private repositories.** Fetching is unauthenticated.
