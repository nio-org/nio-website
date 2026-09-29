---
title: "Packages"
description: "Packages in Nio and nio get: exact versions, compatibility bands, hash verification on every build, updating and vendoring."
---

# Packages

A Nio program imports files. A **package** is code in another person's
repository. Nio fetches it, verifies it, and compiles it into the binary like
any other module.

## Getting one

```sh
nio get 'github.com/nio-lang/nio-log' v0.2.0
```

```text
fetching github.com/nio-lang/nio-log v0.2.0 ... done
added to nio.deps as `log`
  github.com/nio-lang/nio-log v0.2.0  band v0.2
```

This command writes `nio.deps`, which contains all the dependency state of the
project:

```text
package notes

require 'github.com/nio-lang/nio-log' v0.2.0 as log;

// resolved -- maintained by nio, do not edit
resolved 'github.com/nio-lang/nio-log' v0.2.0 sha256:71acdd90...;
```

All the lines above the resolved block can be edited by hand. `nio` maintains
the resolved block. It must not be edited by hand. The source files of the
project use only the **alias**:

```nio
import 'log';

log.Logger l = log.create("notes");
log.info(l, "started");
```

The URL appears only once, in the manifest. A move of a dependency to a fork or
to a different major version changes one line. A module in a package with
several modules is imported by its path, for example `import 'log/rotate'`.
Most packages make all their parts available through one file by
[re-exporting](/docs/modules#re-exporting) them.

On a fresh clone, or when `nio.deps` has changed, run `nio get` with no
arguments:

```sh
nio get
```

This command fetches every package that `nio.deps` requires and that is not
already on the machine. It checks each package against the hash recorded for
it. To move a package to a different version, give the version:

```sh
nio get 'github.com/nio-lang/nio-log' v0.2.7
```

The `require` line changes to the new version and keeps its alias. No import
changes. If the default alias of a new package is already in use,
`nio get` refuses the package and does not rename it. Write its `require` line
with a different alias, then run `nio get`.

## Versions are exact, and a band is a package

A requirement names one version. There are no version ranges such as
`^1.2.3`. As a result, there is no solver and no lock file. Resolution uses
only the manifests. It gives the same result on every machine, in any order,
and offline.

Nio treats each **compatibility band** as a separate package. `nio-log` at
`v0.1.4` and `nio-log` at `v0.2.0` are two different packages with the same
name.

| releases | band | copies in a build |
| --- | --- | --- |
| `v0.1.0` … `v0.1.9` | `v0.1` | one |
| `v0.2.0` … `v0.2.4` | `v0.2` | one, separate from `v0.1` |
| `v1.0.0` … `v1.9.3` | `v1` | one, for all `1.x` releases |
| `v2.0.0` … | `v2` | one, separate from `v1` |

Different major versions are in different bands. Before 1.0, different minor
versions are also in different bands. Nio computes the band from the version.
A package author does not declare it.

Versions in one band must be compatible. As a result, within a band, the build
uses the newest version that any manifest requires. If the project requires
`v0.2.0` and a dependency requires `v0.2.5`, the build uses `v0.2.5`, also for
the project's own `import 'log'`.

From 1.0, all minor and patch releases of a package are in one band. A build
contains only one copy of them.

## When two bands meet

If a build contains two bands of a package, it has two `log.Logger` types. A
value of one type is not a value of the other. A type from a package is named
by the package. When the build contains two bands of the package, the name
also includes the version. The error shows which type is which, and which
package required each band:

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

The two records can have different fields at different offsets. This is why
they are different types. Usually two bands cause no problem. A package that
uses a `Logger` internally and never returns one can have two copies in a
build. The error occurs only when a package uses a type from another package in
its public API. `nio get` and `nio update` report when the graph contains a
package at two bands. The report comes before any code that uses the package
exists.

When a build contains two bands of a package:

- the top-level code of both bands runs. A package that holds a connection
  pool or a cache has two of them;
- both bands are compiled into the binary.

`getType` returns the same name for a value of such a type: `log.Logger` with
one band, and `log@v0.2.5.Logger` with two.

## Unify and replace

Two lines in `nio.deps` change what a requirement resolves to. Nio uses them
**only in the manifest of the project**. A dependency cannot change the graph
of the project. Nio ignores these lines in the manifest of a dependency.

```text
// every band of nio-log is this one version
unify 'github.com/nio-lang/nio-log' v0.2.5;

// a fork, at a version of its own
replace 'github.com/nio-lang/nio-fmt' with 'github.com/me/nio-fmt' v1.0.3;

// a directory, for two packages written together
replace 'github.com/a/nio-webview' with '../nio-webview';
```

`unify` lets values of the type cross between bands. A package written for a
different band is compiled against the version that `unify` names. If the API
of that band changed, the error is in that package, and `unify` is not the
correct solution. A `replace` applies before a `unify`. A package can appear
in only one of the two.

Nio treats a package replaced by a directory as code in development. It
records no hash for the package, and `nio vendor` does not copy it.

## What a package is

A package is a repository that contains a `nio.deps` file. A version is a tag.

```text
nio-log/
  nio.deps        package nio-log
  lib.nio         the entry module, unless `entry` names another
  rotate.nio
```

To publish a version, run `git tag v0.2.1 && git push --tags`. No other step
is necessary.

## Where packages come from

`nio` downloads the tarball of a tag over HTTPS. It uses Nio's own
[`http`](/docs/stdlib/http), [`tls`](/docs/stdlib/tls) and
[`x509`](/docs/stdlib/x509) modules, and verifies the certificate chain. It
reads the gzip and tar archive itself. Only `nio` is necessary to fetch a
package. Nio does not run code from a package when it fetches it. It
downloads, verifies and extracts, and does nothing else. Nio refuses an
archive that contains a symbolic link, or a path that would be written
outside the directory of the package.

Packages are stored in a cache that all the projects on the machine share. A
build **never** uses the network. If a package is not in the cache, the build
reports it as missing. `nio get`, `nio update` or `nio vendor` fetches it.

## Verification

`nio get` records the hash of the tree that it fetched, and **every build
checks the trees on disk against those hashes**. If someone edits a cached
package, or moves a tag to different contents, the build fails with an error
that names the package and both hashes:

```text
package github.com/pkg/errors v0.9.1 does not match the hash nio.deps recorded for it
  recorded: sha256:67c78ecb...
  on disk:  sha256:7c3ad431...
  the tree at ...pkg/github.com/pkg/errors@v0.9.1 changed after it was resolved
```

Nio calculates the hash from the contents of the file **tree**, not from the
archive. As a result, a recorded hash stays valid when a host changes how it
compresses its tarballs. Also, Nio detects a tag that was moved to different
contents.

## Updating

```sh
nio update
```

```text
  github.com/nio-lang/nio-log  v0.2.0 -> v0.2.7  (band v0.2)
    v1.2.0 is available in a new band (v1); `nio get 'github.com/nio-lang/nio-log' v1.2.0` moves to it
updated nio.deps
```

This command moves each requirement to the newest version **of its own
band**, fetches it, and records its hash. It shows a newer band but does not
move to it. A newer band is a different package, and its API can be
incompatible. Only `nio get` moves to it. `nio update log` updates one
requirement, named by its alias or its path.

Nio gets the list of versions from the git repository, with the same request
that `git clone` sends first. It does not use the API of the host. API rate
limits do not apply. A tag is a version when it has the form `v1.2.3`. Nio
ignores branches, and pre-release tags such as `v1.3.0-rc1`. Nio gets all the
versions before it writes anything. As a result, an update applies completely
or not at all.

## Vendoring

```sh
nio vendor
```

This command copies the resolved packages into `./modules`. A build uses
`./modules` before the shared cache. A vendored tree needs no network, and it
stays available if the upstream tag is deleted. The cache and the hashes do
not give this protection: they protect an existing copy and detect changes,
but they cannot restore a repository that was deleted.

## What is not built yet

- **Hosts other than GitHub.** The tarball path is a convention of each host,
  not a standard. Nio reports an error for other hosts.
- **Private repositories.** Fetching is unauthenticated.
