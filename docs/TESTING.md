# Test results

Only tests that were **actually executed** are listed as passing. Run date: 22 October 2026 (v1.2.0). Environment: Linux, Node 20, Playwright 1.59.1 (Chromium), JDK 21, Android SDK 35 (build-tools 35.0.0). No KVM, so no Android emulator.

## Summary

| Suite | Command | Result |
|---|---|---|
| Unit tests (9 files) | `npm test` | **57 / 57 passed** (includes `vision.test.ts` and `entities.test.ts` added in v1.2.0) |
| Web E2E, root (`/`) | `npm run build && npm run test:e2e` | **36 / 36 passed** (18 scenarios × 2 device profiles) ([JSON](test-results/e2e-root.json), [log](test-results/e2e-root.log)) |
| Web E2E, subpath (`/shotrova/`, GitHub Pages layout) | see below | **36 / 36 passed** ([JSON](test-results/e2e-subpath.json), [log](test-results/e2e-subpath.log)) |
| APK web-shell E2E, debug APK | see below | **8 / 8 passed** ([JSON](test-results/e2e-apk-shell.json), [log](test-results/e2e-apk-shell.log)) |
| APK web-shell E2E, signed release APK | see below | **8 / 8 passed** ([JSON](test-results/e2e-apk-shell-release.json), [log](test-results/e2e-apk-shell-release.log)) |
| APK build and inspection | `./gradlew assembleDebug` / `assembleRelease`, `aapt2 dump badging`, `apksigner verify` | **Built and verified** (see below) |

Device profiles for web E2E:
- `android-pixel7`: Playwright's Pixel 7 profile (412×915, touch, Android Chrome user agent). This is emulation in Chromium, not a real Android device.
- `desktop-chromium`: 1280×860.

Any uncaught page error (`pageerror`) fails the test.

OCR tests never use fake data. Test images (`scripts/make-fixtures.mjs`) are PNG, JPEG and WebP files with real text, and tesseract.js really runs.

## Web scenarios (the 15 workflows from the spec, plus v1.2.0 AI vision)

| # | Scenario | Verified |
|---|---|---|
| 01 | First launch | Title, empty state, 11 default categories, Turkish default, TR↔EN switch |
| 02 | Category management | Create, reject duplicate names, rename (including defaults), color, reorder, persistence across reload, delete with confirmation; "Uncategorized" cannot be deleted |
| 03–05 | Multi-import + OCR + auto category | 9 images (PNG/JPEG/WebP); Turkish ("Fırın Makarna Tarifi", "rendelenmiş kaşar") and English text recognized; category and confidence assigned; image without text marked "no text" + needs review; SHA-256 of the original unchanged |
| 06 | Learning from corrections | Manual fix sets source "manual" and clears review; creates rules visible in Settings; rules can be deleted; "not enough text" warning for images without text |
| 07 | Search | The spec's sample queries ("Makarna tarifi", "Geçen ay kaydettiğim adres", "Telefon ayarları", "Alışveriş ürünleri", "Faturalar", "İngilizce kelimeler"), case, Turkish character folding, file name, highlighting, no results |
| 08 | Filters and bulk actions | Category and date filters, sorting, multi-select, bulk category, bulk delete with confirmation |
| 09 | Detail editing | Title, note, tags and OCR text; changes survive reload |
| 10 | Duplicate detection | Same content skipped in the same batch and in later imports; "open existing" link |
| 11 | Backup and restore | ZIP (with images) and JSON export, restore with merge and replace, images byte-identical (SHA-256), duplicates skipped on second merge, API key not in backup, invalid backup rejected |
| 12 | Persistence | Data present after reload and in a new tab |
| 13 | PWA | Manifest fields, icons, service worker control, `share_target`: a real multipart POST navigation is handled by the service worker and the image is imported |
| 14 | Offline | After downloading OCR files, the app opens with the network off, shows the "Offline" badge, runs OCR and assigns a category |
| 15 | Invalid files | Text file named .png, PDF, corrupt PNG, empty file: a clear error for each |
| 15b | OCR engine failure | If the language model cannot be downloaded the status becomes "error" and "Retry" recovers |
| 15c | Quota error | `QuotaExceededError` is reported, no half-written record remains, the next import works |
| + | Paste and drag and drop | Import via clipboard and drop events |
| + | Theme | Light and dark theme colors (v1.2.0 graphite/teal palette) |
| + | AI vision consent and merge (v1.2.0) | With vision off, the AI request contains OCR text only and no `image_url`; with vision on, the request contains a downscaled JPEG data URL; the result merges title/category/text conservatively (manual edits never overwritten); raw OCR stays visible behind a disclosure; entities (URL/e-mail/phone/date) render from the extracted text; the AI text editor works over text only with preview + Apply |

## Android APK

### What was verified on the built APK

- `./gradlew assembleDebug` and `./gradlew assembleRelease`: **BUILD SUCCESSFUL**.
- `aapt2 dump badging` on the release APK: package `io.github.firatnexus.shotrova`, versionName `1.1.0`, versionCode `10100`, compileSdk/targetSdk 35, minSdk 26, launchable activity `io.github.firatnexus.shotrova.MainActivity`, label `Shotrova`.
- `apksigner verify --print-certs`: signed with the release key (`CN=Shotrova, O=firatnexus, C=TR`).
- Asset packaging: Android's build tools decompress `*.gz` assets and drop the extension, so `assets/public/ocr/lang/tur.traineddata` is stored uncompressed (4.68 MB). The OCR engine therefore loads models with `gzip: false` inside the app. This was found while inspecting the first APK and is covered by test A1.
- Unit test `brand.test.ts`: brand name, package id and version match across `brand.ts`, `package.json`, `capacitor.config.json`, `build.gradle`, `strings.xml` and the manifest; the manifest requests no media permissions and only accepts shared images.

### APK web-shell E2E (`tests/e2e-android/native.spec.ts`)

`scripts/extract-apk-assets.mjs` extracts `assets/public/` from the built APK, and Playwright serves exactly those files (Pixel 7 profile). A fake `window.Capacitor` object replaces the Java plugin and records every call, so these tests check the web side of the native integration with the real packaged files:

| # | Scenario | Verified |
|---|---|---|
| A1 | Packaged assets | No service worker registered inside the app; real OCR runs from the bundled, decompressed language files |
| A2 | Share → Shotrova | Images staged by Android are imported both on cold start and while the app is running; bytes are stored unchanged (SHA-256); temporary inbox files are released |
| A3 | Partial share failure | A file that cannot be read is reported; the rest is imported |
| A4 | Save as | "Save original" and "Export backup" go through the Android Save as dialog in chunks; the saved original is byte-identical (SHA-256) and the backup is a ZIP; native-only Settings texts are shown and "Download for offline use" is hidden |
| A5 | Share from the app | The Android share sheet receives the original file |
| A6 | Clipboard | "Paste from clipboard" reads an image from the Android clipboard |
| A7 | Back button | Closes dialogs first, then walks back in app history, then lets Android leave the app |
| A8 | System bars | Status/navigation bar colors follow the light and dark theme |

### What could NOT be tested here (honest note)

- **Real Android device or emulator.** There is no KVM or emulator in this environment. The Java plugin (`ShotrovaBridgePlugin.java`) and `MainActivity.java` compile, but intent handling, the Save as dialog, FileProvider sharing, clipboard reading, the back button and the WebView itself were **not run on Android**.
- **Web install flow on a device.** "Install app", the home screen icon and Shotrova appearing in the share sheet for the PWA were not tried on a real device. The web share target was tested by sending the same POST to the service worker.
- **Safari / iOS and Firefox.** Only Chromium was run. iOS Safari does not support Web Share Target.
- **Real quota exhaustion.** Tested by injecting the error.
- **AI provider.** Not tested end to end because there is no real API key; it is off by default.
- **Accessibility audit.** Keyboard navigation, focus trapping and ARIA labels exist and tests use role/label selectors, but no automated a11y audit (axe) or screen reader test was run.

## Manual test steps on a real device

### APK

1. Install `shotrova-<version>.apk` from the [latest release](https://github.com/firatnexus/shotrova/releases/latest).
2. Open Shotrova: no address bar, the theme color fills the status bar, the first-run screen appears.
3. Gallery → select 2–3 screenshots → **Share → Shotrova**. The app opens on the import screen and imports them; OCR runs without a network connection.
4. Share again while the app is open in the background: the new images are imported.
5. Open an image → **Save original**: the Android Save as dialog opens; check the saved file in Files.
6. **Share**: the share sheet opens with the image attached.
7. Copy an image in another app, then tap **Paste from clipboard** on the dashboard.
8. Settings → **Export backup**: Save as dialog; then restore from that file.
9. Back button: closes an open dialog, then goes back a screen, then leaves the app from the dashboard.
10. Switch the theme in Settings: status and navigation bar colors follow.

### Web (PWA)

1. Open the app over HTTPS (see [DEPLOY.md](DEPLOY.md)).
2. Chrome menu → **Add to Home screen** or **Install app**.
3. Open Shotrova from the home screen icon; it should open without an address bar.
4. Gallery or Files → screenshot → **Share** → **Shotrova**. The app should open on the import screen.
5. Settings → **Download for offline use**, then airplane mode: the app should open and read the text of a new image.

## Running the tests again

```bash
npm ci --legacy-peer-deps
npx playwright install chromium
npm test
npm run build && npm run test:e2e

# Subpath (GitHub Pages) layout
VITE_BASE=/shotrova/ npx vite build --outDir /tmp/dist_base
PORT=4174 E2E_BASE=/shotrova/ E2E_DIST=/tmp/dist_base npx playwright test

# APK web shell (needs JDK 21 + Android SDK 35)
npm run apk:debug
node scripts/extract-apk-assets.mjs android/app/build/outputs/apk/debug/app-debug.apk test-reports/apk-public
npx playwright test -c playwright.android.config.ts
```

## Bugs found and fixed during testing

- **OCR hung forever.** When a language model could not be downloaded, tesseract.js did not reject `createWorker` and reported the error only through `errorHandler`. The engine now listens to that signal too (`src/ocr/engine.ts`).
- **Uncaught AbortError.** When an IndexedDB transaction was aborted, sibling requests were left as unhandled rejections. Fixed with the `txAll` helper (`src/db/db.ts`).
- **"Recently added" row on the dashboard.** `scroll-snap` made the first card start clipped; snapping was removed.
- **OCR models in the APK.** Android packaging decompresses `.gz` assets, so loading them as gzip would fail inside the app. The engine uses `gzip: false` in the native app (test A1).

## Visual review

Mobile (390 px) and desktop views were reviewed by hand in light and dark themes ([screenshots](screenshots/)): dashboard, images, detail, categories, settings, import, search.
