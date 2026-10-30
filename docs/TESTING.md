# Test results

Only tests that were **actually executed** are listed as passing. Latest run: 30 October 2026, v1.13.0 (Android-only release). Environment: Linux, Node 20, Playwright 1.59.1 (Chromium) locally; GitHub Actions with JDK 21, Android SDK 35 and a KVM-accelerated Android 15 emulator in CI.

## Summary

| Suite | Command / workflow | Result (v1.13.0) |
|---|---|---|
| Unit tests (19 files) | `npm test` | **126 / 126 passed** — brand and version consistency, categorizer, search and query parsing (incl. CJK, Devanagari, Arabic, Cyrillic), backup, AI providers and vision, i18n parity for 12 languages incl. Android strings, OCR language catalogue, release notes, swipe, typewriter, dropdown placement |
| Real OCR recognition | `npm run test:ocr` | **13 / 13 passed** — tesseract.js recognizes rendered text in all 12 languages at 100 % character similarity, plus one worker switching jpn+eng → ara+eng → chi_sim+eng → tur+eng. Fixtures: `scripts/make-ocr-fixtures.py` (Noto fonts, HarfBuzz shaping) |
| UI tests on the production build | `npm run build && npm run test:e2e` | **53 passed, 3 skipped** (the 3 are mobile-only checks on the wide-screen profile) |
| APK WebView tests, files from the built APK + simulated bridge | Android workflow (job "Build and test APK") | **Passed** on every APK build; locally against `dist` with gunzipped language files: **12 / 12** |
| Device test on the Android 15 emulator | Device test workflow | **5 / 5 passed** — keyboard, built-in Japanese OCR, swipe, dropdowns, README screenshots |
| APK build, signing and contents | Android workflow | **Passed** — signed release APK, certificate matches the previous release, all 12 `assets/public/ocr/lang/*.traineddata` files present |
| TypeScript | `tsc -b` (part of `npm run build`) | clean |

UI test profiles:
- `android-pixel7`: Playwright's Pixel 7 profile (412×915, touch). This is emulation in Chromium; the real Android WebView is covered by the device test.
- `desktop-chromium`: 1280×860, a wide-screen layout check (tablets, foldables, Chromebooks).

Any uncaught page error (`pageerror`) fails a test. OCR tests never use fake data: test images (`scripts/make-fixtures.mjs`) are PNG, JPEG and WebP files with real text, and tesseract.js really runs.

## UI scenarios (`tests/e2e/workflows.spec.ts`, `tests/e2e/v112.spec.ts`)

| # | Scenario | Verified |
|---|---|---|
| 01 | First launch | Title, empty state, 11 default categories, Turkish default, TR↔EN switch |
| 02 | Category management | Create, reject duplicate names, rename (including defaults), color, reorder, persistence across reload, delete with confirmation; "Uncategorized" cannot be deleted |
| 03–05 | Multi-import + OCR + auto category | 9 images (PNG/JPEG/WebP); Turkish and English text recognized; category and confidence assigned; image without text marked "no text" + needs review; SHA-256 of the original unchanged |
| 06 | Learning from corrections | Manual fix sets source "manual" and clears review; creates rules visible in Settings; rules can be deleted |
| 07 | Search | Sample queries ("Makarna tarifi", "Geçen ay kaydettiğim adres", "Telefon ayarları", "Faturalar", "İngilizce kelimeler"), case, Turkish character folding, file name, highlighting, no results |
| 08 | Filters and bulk actions | Category and date filters, sorting, multi-select, bulk category, bulk delete with confirmation |
| 09 | Detail editing | Title, note, tags and OCR text; changes survive reload |
| 10 | Duplicate detection | Same content skipped in the same batch and in later imports; "open existing" link |
| 11 | Backup and restore | ZIP and JSON export, merge and replace restore, images byte-identical (SHA-256), API key not in backup, invalid backup rejected |
| 12 | Persistence | Data present after reload |
| 15 | Invalid files | Text file named .png, PDF, corrupt PNG, empty file: a clear error for each |
| 15b | OCR engine failure | If a language model cannot be loaded the status becomes "error" and "Retry" recovers |
| 15c | Quota error | `QuotaExceededError` is reported, no half-written record remains, the next import works |
| + | Paste and drag and drop | Import via clipboard and drop events |
| + | Theme | Light paper `rgb(255, 255, 255)` / ink `rgb(0, 0, 0)`; dark canvas `rgb(10, 10, 10)` |
| + | AI vision consent | With vision off the request contains OCR text only; with vision on a downscaled JPEG; results merge conservatively; the AI text editor works with preview + Apply |
| + | v1.12 features | Animated search hint (stop/resume), category sheet at 520/440/380 px heights (keyboard simulation), 12-option language menu, Arabic RTL after reload, built-in Japanese OCR on a real image, CDP touch swipes (order, no wrap, vertical rejection, edge guard, text fields, RTL), dark menu contrast |

## APK WebView tests (`tests/e2e-android/native.spec.ts`)

`scripts/extract-apk-assets.mjs` extracts `assets/public/` from the built APK and Playwright serves exactly those files (Pixel 7 profile). A fake `window.Capacitor` object replaces the Java plugin and records every call:

| # | Scenario | Verified |
|---|---|---|
| A1 | Packaged assets | No service worker inside the app; real OCR runs from the bundled, decompressed language files |
| A2 | Share → Shotrova | Images staged by Android are imported on cold start and while running; bytes unchanged (SHA-256); inbox files released |
| A3 | Partial share failure | A file that cannot be read is reported; the rest is imported |
| A4 | Save as | "Save original" and "Export backup" go through the Android Save as dialog in chunks; byte-identical original, ZIP backup |
| A5 | Share from the app | The Android share sheet receives the original file |
| A6 | Clipboard | "Paste from clipboard" reads an image from the Android clipboard |
| A7 | Back button | Closes dialogs first, then walks back in app history, then lets Android leave the app |
| A8 | System bars | Status/navigation bar colors follow the light and dark theme (`#0a0a0a` dark) |

## Real Android WebView (emulator)

`.github/workflows/device-test.yml` installs the debug APK (WebView debugging enabled for this build only) on a Pixel 6 / API 35 emulator with KVM, attaches Playwright over the WebView DevTools socket and drives input with `adb shell input`. It runs on every pull request and on `main`; results, screenshots and launch recordings are uploaded as the `device-test-report` artifact.

Results on 30 October 2026 (v1.13.0, Android 15, 1080×2400, `swiftshader` software GPU):

| Check | Result |
|---|---|
| Keyboard | PASS — a real tap on "Ek anahtar kelimeler" opens Gboard; the field, Kaydet and Vazgeç stay above the keyboard; text typed through the IME lands in the field and the category saves. |
| OCR | PASS — Japanese is selected with no network request (`fetched: []`); recognition of a real screenshot in 5.3 s; text "東京タワーの予約 / チケット番号 / ありがとうございます", language `jpn+eng`. |
| Swipe | PASS — Home → Images → Categories → Settings and back with real touches, no wrap-around, a vertical drag never switches tabs, a drag while typing in search stays in the field. |
| Dropdowns | PASS — the Images date and sort menus open attached to their fields and Android Back closes them. |
| Screenshots | PASS — `tests/device/screenshots.spec.ts` clears the app, imports the demo images from `scripts/make-showcase.mjs`, waits for real OCR and captures the nine README screenshots in light and dark (`docs/screenshots/`). |

### Swipe frames (v1.12.0 vs v1.12.1)

Same emulator, empty library, 2 runs × 8 swipes each (700 ms window per swipe; `workflow_dispatch` with `app_ref=v1.12.0` builds the old app with the same test):

| | v1.12.0 | v1.12.1 |
|---|---|---|
| `pointercancel` (browser took the gesture) | 16 / 16 swipes | 0 / 8 swipes measured |
| Dropped frames per swipe (mean) | 51.2 | 34.8 |
| Worst frame gap (median / max) | 233 / 483 ms | 150 / 467 ms |

The software-rendered emulator drops frames even when nothing moves, so these numbers only compare the two versions; they are not what a phone with a GPU shows. The first visit to a tab still costs one long task (70–200 ms on the emulator) while React builds that screen.

## Swipe smoothness probe (v1.12.1)

`npx playwright test -c playwright.perf.config.ts` (set `PERF_DIST`, `PERF_IMAGES`, `PERF_LABEL`): Pixel 7 profile, CPU throttled 4×, seeded library, 12 finger-speed swipes through all tabs and back. Same probe on the v1.12.0 build and on v1.12.1, 120 screenshots:

| | v1.12.0 | v1.12.1 |
|---|---|---|
| Dropped frames (12 swipes) | 84 | 27 |
| Worst frame gap | 267 ms | 67 ms |
| Long tasks | 546 ms | 74 ms |
| touchmove events delivered | 216 / 216 | 216 / 216 |

Root causes: the Images tab rendered every card on mount (scaled with library size), the page moved only 25 % of the finger (max 40 px) and then jumped, the drag offset was a CSS variable on `main` (style recalculation of the whole subtree per move), and selects / idle fields blocked swipes.

## Bugs found and fixed during testing

- **v1.12.0 — OCR languages passed in memory never loaded.** tesseract.js 7.0.0 builds the language string from `l.data` instead of `l.code` for in-memory languages, so loading failed with "Tesseract couldn't load any languages!". Found by `npm run test:ocr`; fixed by `scripts/tesseract-fix.mjs`, which patches the shipped worker and is checked by a unit test.
- **v1.12.0 — swipe hijacked by the WebView.** Horizontal overscroll triggered history navigation instead of the tab swipe; fixed with `overscroll-behavior-x: none` on touch devices (E2E swipe tests).
- **v1.12.0 — keyboard covered the category sheet on Android 15.** Edge-to-edge is forced with targetSdk 35 and the IME inset was ignored. Native fix in `MainActivity`, JavaScript fallback in `ui/keyboard.ts`; the JavaScript side is tested with shrunken viewports, the native side is now verified on the API 35 emulator (see above).
- **OCR hung forever.** When a language model could not be loaded, tesseract.js did not reject `createWorker` and reported the error only through `errorHandler`. The engine now listens to that signal too (`src/ocr/engine.ts`).
- **Uncaught AbortError.** When an IndexedDB transaction was aborted, sibling requests were left as unhandled rejections. Fixed with the `txAll` helper (`src/db/db.ts`).
- **"Recently added" row on the dashboard.** `scroll-snap` made the first card start clipped; snapping was removed.
- **OCR models in the APK.** Android packaging decompresses `.gz` assets, so loading them as gzip would fail inside the app. The engine uses `gzip: false` in the native app (test A1).

## Not covered

- **Physical devices and OEM power management.** The emulator runs stock Android; background capture timing on Xiaomi/HyperOS and other aggressive battery savers with the screen off can only be checked on a real phone.
- **AI providers end to end.** Not run with a real API key; requests are verified with mocked endpoints. AI is off by default.
- **Translations** other than Turkish and English were not reviewed by native speakers.
- **Accessibility audit.** Tests use role/label selectors and focus handling exists, but no automated audit (axe) or screen reader test was run.

## Manual test steps on a phone

1. Install `shotrova-<version>.apk` from the [latest release](https://github.com/firatnexus/shotrova/releases/latest).
2. Open Shotrova: one seamless launch screen, the theme color fills the status bar, the welcome screen appears.
3. Gallery → select 2–3 screenshots → **Share → Shotrova**. The app imports them; OCR runs without a network connection.
4. Share again while the app is in the background: the new images are imported.
5. Turn on automatic capture, take a screenshot: a notification says where it was saved.
6. Open an image → **Save original**: the Android Save as dialog opens; check the file in Files. **Share** opens the share sheet.
7. Copy an image in another app, then tap **Paste from clipboard**.
8. Settings → **Export backup**, then restore from that file.
9. Settings → OCR language → pick Japanese or Arabic in airplane mode: it is marked "Built in" and recognizes text.
10. Back button: closes a dialog, then goes back a screen, then leaves the app from Home.

## Running the tests again

```bash
npm ci --legacy-peer-deps
npx playwright install chromium
npm test
npm run test:ocr
npm run build && npm run test:e2e

# APK WebView tests (needs JDK 21 + Android SDK 35)
npm run apk:debug
node scripts/extract-apk-assets.mjs android/app/build/outputs/apk/debug/app-debug.apk test-reports/apk-public
npx playwright test -c playwright.android.config.ts
```

The device test needs an emulator with KVM; run it from the Actions tab ("Device test", optional `grep`) or locally with `npx playwright test -c playwright.device.config.ts` while an emulator with the debug APK is attached.
