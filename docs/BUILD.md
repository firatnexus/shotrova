# Build and release

Shotrova is an Android app. Its interface is a React + TypeScript app that runs inside the APK's WebView ([Capacitor 7](https://capacitorjs.com/)), next to a small native plugin (`ShotrovaBridge`) for automatic capture, the share sheet, Save as, the clipboard and system bars. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Requirements

- Node.js 20 or newer, npm. Install dependencies with `--legacy-peer-deps` (peer warning between vite 8 and `@vitejs/plugin-react`).
- **JDK 21** and the **Android SDK** with `platforms;android-35`, `build-tools;35.0.0` and `platform-tools`. `JAVA_HOME` and `ANDROID_HOME` (or `android/local.properties` with `sdk.dir=...`) must be set.

## Working on the interface

```bash
npm ci --legacy-peer-deps
npm run dev            # live-reload dev server at http://localhost:5173
npm run build          # tsc -b && vite build → dist/ (copies the OCR engine and all 12 languages first)
npm run preview        # serves dist/ at http://localhost:4173, the exact files the APK ships
```

Use `npm run build` rather than `npx vite build`: its `prebuild` step (`scripts/copy-ocr-assets.mjs`) writes `public/ocr/` with the Tesseract worker, the WASM cores and the twelve language models.

## Debug build

```bash
npm run apk:debug
# → android/app/build/outputs/apk/debug/app-debug.apk
#   package io.github.firatnexus.shotrova.debug (installs next to the release build)
```

## Signed release build

The release build is signed only if a keystore is provided, either with environment variables:

```bash
export SH_KEYSTORE_FILE=/path/to/shotrova-release.jks
export SH_KEYSTORE_PASSWORD=...
export SH_KEY_ALIAS=shotrova
export SH_KEY_PASSWORD=...
npm run apk:release
# → android/app/build/outputs/apk/release/app-release.apk
```

or with `android/keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`). Keystores and `keystore.properties` are git-ignored; never commit them.

Verify the result:

```bash
$ANDROID_HOME/build-tools/35.0.0/apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
$ANDROID_HOME/build-tools/35.0.0/aapt2 dump badging android/app/build/outputs/apk/release/app-release.apk | head -3
```

**Keep the keystore safe.** Android only installs updates signed with the same key. If the key is lost, users must uninstall the old app (and lose its data unless they made a backup) to install a new build.

## Versioning

`versionName` comes from `package.json` (`version`) and `versionCode` is computed as `major·10000 + minor·100 + patch` (1.13.0 → 11300). `src/config/brand.ts` holds the same version; a unit test checks that they match.

## CI

| Workflow | When | What it does |
|---|---|---|
| `ci.yml` (CI) | every push to `main` and every PR | Unit tests, production build, real OCR in all 12 languages, Playwright UI tests on the build the APK ships |
| `android.yml` (Android APK) | `main`, PRs and `v*` tags | Builds the APK (signed when the keystore secrets exist), checks that all 12 OCR languages are packaged, runs the APK WebView tests on the files extracted from the APK, publishes the release for `v*` tags |
| `device-test.yml` (Device test) | every PR, `main`, or manually | Installs the debug APK on an Android 15 emulator and drives the real WebView: soft keyboard, OCR, swipes, launch videos and the README screenshots |

Repository secrets for signing: `SH_KEYSTORE_BASE64` (`base64 -w0 shotrova-release.jks`), `SH_KEYSTORE_PASSWORD`, `SH_KEY_ALIAS`, `SH_KEY_PASSWORD`.

## Releasing a new version

1. Bump `version` in `package.json` (and `package-lock.json`) and `src/config/brand.ts`.
2. Add a `## What's new in X.Y.Z` section at the top of `docs/RELEASE_NOTES.md` (a unit test fails without it, and the release step refuses to publish).
3. Merge to `main`, then `git tag -a vX.Y.Z -m "Shotrova vX.Y.Z" && git push origin vX.Y.Z`.

The release body is built by `scripts/release-notes.mjs`: only that version's section of `docs/RELEASE_NOTES.md`, followed by the template in `.github/release-template.md` (file name, size and SHA-256 are filled in from the built APK).

## Refreshing the README screenshots

The screenshots come from the real APK on the emulator (`tests/device/screenshots.spec.ts`, part of every device test run):

1. Optionally re-render the demo screenshots: `node scripts/make-showcase.mjs` → `tests/fixtures/showcase/`.
2. Download the `device-test-report` artifact of a device test run and copy `screenshots/*.png` to `docs/screenshots/` (720×1600 is plenty).
3. `node scripts/readme-hero.mjs` composes `docs/screenshots/readme-hero.png` from them; `node scripts/make-banner.mjs` rebuilds the animated banner `docs/banner.svg`.

## Installing (for users)

1. Open the [latest release](https://github.com/firatnexus/shotrova/releases/latest) on the phone and download `shotrova-<version>.apk`.
2. Open the file. If Android asks, allow "Install unknown apps" for the browser or file manager.
3. Open Shotrova. To import: Gallery or Files → select screenshot(s) → **Share → Shotrova**, or turn on automatic capture.

## Renaming

Edit [`src/config/brand.ts`](../src/config/brand.ts), then run `npm run icons && npm run build`. Also update `capacitor.config.json`, `android/app/build.gradle` (`namespace`/`applicationId`), `android/app/src/main/res/values/strings.xml` and the Java package; the `brand.test.ts` unit test fails if they drift apart. See [NAMING.md](NAMING.md).
