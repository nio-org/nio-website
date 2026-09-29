---
title: "Packaging apps with nio package"
description: "nio package turns a Nio program into an installable application: a signed macOS app bundle and an optional disk image."
---

# Packaging

`nio build` produces a self-contained native binary. The runtime is compiled
into it, and its only dynamic dependencies are system frameworks that every
machine of the platform has. `nio package` puts that binary into an
installable application for the platform. On macOS, this is a signed `.app`
bundle and, on request, a disk image from which the user drags the app into
Applications. Packaging for Linux and Windows is planned.

```sh
nio package app.nio                # app.app, beside the working directory
nio package --dmg app.nio -o dist  # dist/app.app and dist/app.dmg
```

## The manifest

A small JSON file describes the package. `nio package` finds it automatically
as `<file>.pkg.json` beside the source (`app.nio` → `app.pkg.json`), or
`--manifest` gives its name. All keys are optional. With no manifest, the
app has the name of the source file.

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

- **`name`**: the display name of the app. It is also the file name of the
  bundle and of the image. The default is the stem of the source file.
- **`identifier`**: the bundle identifier. The default is `com.nio.<name>`.
- **`version`**: `CFBundleShortVersionString`. The default is `0.1.0`.
- **`icon`**: one 1024×1024 PNG, relative to the manifest. `sips` and
  `iconutil`, which are part of macOS, convert it into the full icon set.
  The source is converted to sRGB first. As a result, a wide-gamut export
  from a design tool is accepted. Its embedded color profile is not copied into each size
  of the set.
- **`resources`**: files and directories to copy into `Contents/Resources`
  of the bundle, relative to the manifest. Directories are copied completely,
  and file modes and symbolic links are kept.
- **`dmg`**: also produce `<name>.dmg`. The image contains the app and a
  symbolic link to `/Applications`. With this link, the user can drag the app
  into Applications to install it. The volume has the icon of the app. The image
  is lzma-compressed and mounts on macOS 10.15 and later, which includes the
  `minimumOS` default of 11.0. `--dmg` on the command line does the same for
  one run.
- **`macos.sign`**: a codesign identity. The value is the full certificate
  name, `"auto"` for the only Developer ID Application identity on the
  machine, or `"-"` for the ad-hoc signature also when a real identity is
  configured.
- **`macos.notarize`**: a notarytool keychain profile name. [Signing](#signing)
  describes it.
- **`macos.entitlements`**: an entitlements plist, for apps that need one.
- **`macos.provisioningProfile`**: a `.provisionprofile` from the Apple
  Developer portal. It is copied into the bundle as
  `Contents/embedded.provisionprofile` before the bundle is signed. Only apps
  with a *restricted* entitlement need one. macOS accepts those keys only when
  a profile authorizes them for that bundle identifier and team. The profile
  must match the identity in `macos.sign`. For this reason, `nio package`
  refuses a profile together with the ad-hoc signature.
- **`macos.minimumOS`**: `LSMinimumSystemVersion`. The default is `11.0`.
- **`macos.plistExtra`**: raw plist XML that is inserted into the top-level
  dict of the generated Info.plist. It adds keys that the manifest does not
  have. For example, a browser needs
  `<key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoadsInWebContent</key><true/></dict>`.
  This key lets its pages load `http://` sites. A menu-bar app needs
  `<key>LSUIElement</key><true/>`.

`nio package` ignores unknown keys. As a result, one manifest can contain sections for
platforms that this version does not support yet.

## Signing

Every bundle is signed, because on Apple Silicon an unsigned binary does not
launch. If no identity is configured, the signature is ad-hoc. An ad-hoc
signature is sufficient for an app that runs on the machine that built it.
macOS quarantines a *downloaded* copy of an ad-hoc-signed app. The first time,
the user must right-click the app and select Open. A paid Apple Developer ID
and notarization remove that dialog.

With a Developer ID, run the one-time setup:

```sh
nio package --setup
```

The setup lists the Developer ID Application identities in the Keychain and
selects one. If there are several, it shows a menu. Then it offers to set up
notarization: `notarytool store-credentials` prompts for the Apple ID, the
team, and an app-specific password from appleid.apple.com, and stores them in
the Keychain under a profile name. The setup validates the profile before it
saves it. The setup saves only two names, the identity and the profile. It
saves them for the user account, never in the project.

After the setup, `nio package --dmg app.nio` signs the app with the hardened
runtime, submits the DMG to Apple (`--wait`, usually one or two minutes), and
staples the ticket to the DMG. Gatekeeper then accepts the download, also
offline. An explicit `macos.sign` or `macos.notarize` in a manifest overrides
the per-user configuration. This is for CI, or for a project that must use a
specific identity.

A resource that is code, such as a dylib from a library (described in
[Native interop](/docs/native)) or a helper binary, is also signed with the
same identity before the bundle is signed. Notarization requires a Developer
ID signature with a secure timestamp on every Mach-O file in the archive.
`nio package` finds Mach-O files by their contents, and copies all other files
unchanged. This needs no configuration.

## What lands where

```text
Demo App.app/
  Contents/
    Info.plist          generated from the manifest
    MacOS/Demo App      the binary, compiled straight into place
    Resources/          the manifest's resources, plus app.icns
```

The binary is built as `nio build --release` builds it, with the same
compiler, the same runtime and `clang -O2 -flto`. It runs on any Mac with the
architecture of the build machine. The target CPU baseline is the default of
the toolchain for the platform (`apple-m1` on Apple Silicon), not the chip of
the build host. Universal binaries are not supported yet. An Intel DMG must be built
on an Intel host.
