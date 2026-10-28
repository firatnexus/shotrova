# Build and deployment

## Requirements

- Node.js 20 or newer, npm. Install dependencies with `--legacy-peer-deps` (peer warning between vite 8 and `@vitejs/plugin-react`).
- For the APK: **JDK 21** and the **Android SDK** with `platforms;android-35`, `build-tools;35.0.0` and `platform-tools`. `JAVA_HOME` and `ANDROID_HOME` (or `android/local.properties` with `sdk.dir=...`) must be set.

## Local development

```bash
npm ci --legacy-peer-deps
npm run dev            # http://localhost:5173 (OCR files are copied automatically)
```

The service worker is registered only in production web builds.

## Web production build

```bash
npm run build          # tsc -b && vite build → dist/
npm run preview        # serves dist/ at http://localhost:4173
```

Everything in `dist/` is static: HTML, JS, CSS, icons, `manifest.webmanifest`, `sw.js` and the ~17 MB `ocr/` folder (WASM core plus `tur` and `eng` models). Any static host works.

### Serving from a subpath

If the app lives under a subpath (for example `https://user.github.io/shotrova/`), set `VITE_BASE`:

```bash
VITE_BASE=/shotrova/ npm run build
```

The manifest (`start_url`, `scope`, `share_target.action`, icons), the service worker scope and font URLs are generated from this value. This layout is tested end to end as well (see [TESTING.md](TESTING.md)).

### Hosting requirements

- **HTTPS is required.** Service worker, install and share target work only over HTTPS (or on `localhost`).
- Serve `sw.js` and `index.html` with a short cache lifetime (`Cache-Control: no-cache`) so updates show up immediately. Files under `assets/` have content hashes and can be cached long-term.
- Serve `.wasm` files as `application/wasm`.
- The share target is a POST handled by the service worker, so no server code is needed. If the service worker is not active yet, the server may answer the POST to `share-target` with 404/405; opening the app once fixes this.

## Android APK

The Android app is a [Capacitor 7](https://capacitorjs.com/) project in `android/`. It loads the same `dist/` build from the APK's assets, plus a small native plugin (`ShotrovaBridge`) for share intents, the Save as dialog, the share sheet, the clipboard and system bars. See [ARCHITECTURE.md](ARCHITECTURE.md#android-app).

### Debug build

```bash
npm run apk:debug
# → android/app/build/outputs/apk/debug/app-debug.apk
#   package io.github.firatnexus.shotrova.debug (installs next to the release build)
```

### Signed release build

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

### Versioning

`versionName` comes from `package.json` (`version`) and `versionCode` is computed as `major·10000 + minor·100 + patch` (1.1.0 → 10100). `src/config/brand.ts` holds the same version; a unit test checks that they match.

## CI

### `.github/workflows/ci.yml` (web, every push to `main`)

1. Unit tests.
2. Production build and web E2E tests.
3. Rebuild under `/<repo-name>/` and run the E2E tests again in that layout.
4. Deploy to GitHub Pages.

One-time setting: **Settings → Pages → Source: GitHub Actions**. On the free GitHub plan Pages is available for public repositories only.

### `.github/workflows/android.yml` (APK, every push to `main` and every `v*` tag)

1. `npm ci`, web build, `npx cap sync android`.
2. If the `SH_KEYSTORE_BASE64` secret exists: restore the keystore and run `assembleRelease`; otherwise `assembleDebug`.
3. `apksigner verify` and `SHA256SUMS.txt`.
4. APK web-shell E2E tests on the files extracted from the built APK.
5. Upload the APK as a workflow artifact. For `v*` tags, create (or update) the GitHub release and attach the APK. The release body is built by `scripts/release-notes.mjs`: only that version's `## What's new in X.Y.Z` section of `docs/RELEASE_NOTES.md`, followed by the download / install / highlights / permissions / limitations template in `.github/release-template.md` (file name, size and SHA-256 are filled in from the built APK). Older versions never appear on a release page.

Repository secrets: `SH_KEYSTORE_BASE64` (`base64 -w0 shotrova-release.jks`), `SH_KEYSTORE_PASSWORD`, `SH_KEY_ALIAS`, `SH_KEY_PASSWORD`.

Releasing a new version: bump `version` in `package.json` and `src/config/brand.ts`, add a `## What's new in X.Y.Z` section at the top of `docs/RELEASE_NOTES.md` (a unit test fails without it, and the release step refuses to publish), commit, then `git tag vX.Y.Z && git push origin vX.Y.Z`.

## Installing (for users)

### Android APK

1. Open the [latest release](https://github.com/firatnexus/shotrova/releases/latest) on the phone and download `shotrova-<version>.apk`.
2. Open the file. If Android asks, allow "Install unknown apps" for the browser or file manager.
3. Open Shotrova. To import: Gallery or Files → select screenshot(s) → **Share → Shotrova**, or use the import screen inside the app.

### Web (PWA)

1. Open the HTTPS address in **Chrome** on Android.
2. Menu (⋮) → **Install app** or **Add to Home screen**.
3. To send screenshots from the share sheet the PWA must be installed: Gallery → image(s) → Share → Shotrova.
4. For offline OCR: Settings → **Download for offline use**.

## Renaming

Edit [`src/config/brand.ts`](../src/config/brand.ts), then run `npm run icons && npm run build`. For the Android app also update `capacitor.config.json`, `android/app/build.gradle` (`namespace`/`applicationId`), `android/app/src/main/res/values/strings.xml` and the Java package; the `brand.test.ts` unit test fails if they drift apart. See [NAMING.md](NAMING.md).
