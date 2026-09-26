---
title: "Packaging apps with nio package"
description: "Turn a Nio program into an installable application with nio package: a signed macOS app bundle and an optional disk image."
---

# Packaging

`nio build` produces a self-contained native binary: the runtime is compiled
in, and the only dynamic dependencies are system frameworks every machine of
the platform already has. `nio package` wraps that binary in what the
platform calls an installable application. On macOS that is a signed `.app`
bundle and, on request, a drag-to-Applications disk image; Linux and Windows
packaging are planned.

```sh
nio package app.nio                # app.app, beside the working directory
nio package --dmg app.nio -o dist  # dist/app.app and dist/app.dmg
```

## The manifest

Packaging is described by a small JSON file. It is found automatically as
`<file>.pkg.json` beside the source (`app.nio` → `app.pkg.json`), or named
explicitly with `--manifest`. Every key is optional — with no manifest at
all, the app is named after the file.

```json
{
    "name": "Demo App",
    "identifier": "com.example.demo",
    "version": "1.2.3",
    "icon": "icon-1024.png",
    "resources": ["ui.html", "theme.css", "components"],
    "dmg": true,
    "macos": {
        "sign": "auto",
        "notarize": "nio-notary",
        "entitlements": "app.entitlements",
        "provisioningProfile": "app.provisionprofile",
        "minimumOS": "11.0"
    }
}
```

- **`name`** — the app's display name; also the bundle's and image's file
  name. Defaults to the source file's stem.
- **`identifier`** — the bundle identifier. Defaults to `com.nio.<name>`.
- **`version`** — `CFBundleShortVersionString`. Defaults to `0.1.0`.
- **`icon`** — one 1024×1024 PNG, relative to the manifest. `sips` and
  `iconutil` (both ship with macOS) turn it into the full icon set. The
  source is converted to sRGB first, so a wide-gamut export straight out of
  a design tool costs nothing: its embedded color profile would otherwise be
  copied into every size of the set.
- **`resources`** — files and directories copied into the bundle's
  `Contents/Resources`, relative to the manifest. Trees are copied whole,
  modes and symlinks preserved.
- **`dmg`** — also produce `<name>.dmg`: the app beside an `/Applications`
  symlink, so opening the image shows the classic drag-to-install window,
  with the app's icon as the volume's. The image is lzma-compressed (mounts
  on macOS 10.15+, within the 11.0 `minimumOS` floor). `--dmg` on the
  command line does the same for one run.
- **`macos.sign`** — a codesign identity: the full certificate name, `"auto"`
  to use the machine's only Developer ID Application identity, or `"-"` to
  force the ad-hoc signature even where a real identity is configured.
- **`macos.notarize`** — a notarytool keychain profile name; see below.
- **`macos.entitlements`** — an entitlements plist for apps that need one.
- **`macos.provisioningProfile`** — a `.provisionprofile` from the Apple
  Developer portal, copied into the bundle as
  `Contents/embedded.provisionprofile` before the signature seals it. Only
  apps with a *restricted* entitlement need one: macOS honors those keys
  only where a profile authorizes them for that exact bundle identifier and
  team. The profile pairs with the identity in `macos.sign`, so naming one
  with the ad-hoc signature is refused.
- **`macos.minimumOS`** — `LSMinimumSystemVersion`. Defaults to `11.0`.
- **`macos.plistExtra`** — raw plist XML spliced into the generated
  Info.plist's top-level dict, for keys the tool has no business
  enumerating. A browser, for instance, wants
  `<key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoadsInWebContent</key><true/></dict>`
  so its pages may load `http://` sites; a menu-bar app wants
  `<key>LSUIElement</key><true/>`.

Unknown keys are ignored, so one manifest can carry sections for platforms
this version does not read yet.

## Signing

Every bundle is signed — on Apple Silicon an unsigned binary will not launch
at all. With no identity configured the signature is ad-hoc, which is fine
for an app used on the machine that built it. A *downloaded* copy of an
ad-hoc-signed app is quarantined, and macOS makes the user right-click →
Open it the first time; making that dialog disappear requires a paid Apple
Developer ID and notarization.

With one, run the one-time setup:

```sh
nio package --setup
```

It lists the Developer ID Application identities in your Keychain and picks
one (a menu when there are several), then offers to set up notarization:
`notarytool store-credentials` prompts for your Apple ID, team, and an
app-specific password from appleid.apple.com, stores them in the Keychain
under a profile name, and the wizard validates the profile before saving.
What is saved — under your user, never in the project — is just the two
names: which identity, which profile.

After that, a plain `nio package --dmg app.nio` signs with the hardened
runtime, submits the DMG to Apple (`--wait`, typically a minute or two), and
staples the ticket to it, so Gatekeeper accepts the download even offline.
A manifest's explicit `macos.sign` / `macos.notarize` override the per-user
config, which is what CI or a team-pinned project wants.

A resource that is itself code — a dylib a library ships (see [Native interop](/docs/native)), a helper
binary — is signed too, with the same identity, before the bundle's own
signature seals it in. Notarization requires every Mach-O in the archive
to carry a Developer ID signature with a secure timestamp, and the outer
signature treats `Resources/` as data, so whatever signature the file's
build left it (typically the linker's ad-hoc one) would otherwise go in
unchanged and fail the submission. Nothing to configure: Mach-O files are
recognized by their contents, everything else is copied untouched.

## What lands where

```text
Demo App.app/
  Contents/
    Info.plist          generated from the manifest
    MacOS/Demo App      the binary, compiled straight into place
    Resources/          the manifest's resources, plus app.icns
```

The binary is built exactly as `nio build` builds it — same compiler, same
runtime, same `clang -O2 -flto` — and runs on any Mac of the build machine's
architecture: the target CPU baseline is the toolchain's default for the
platform (`apple-m1` on Apple Silicon), not the build host's own chip.
Universal binaries are not supported yet; an Intel DMG is built on (or for)
an Intel host.
