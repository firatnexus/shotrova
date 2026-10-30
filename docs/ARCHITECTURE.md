# Architecture overview

Shotrova is an Android app that runs entirely on the phone. There is no server, account or analytics. Images, OCR text and settings stay in IndexedDB on the device. The interface is a React + TypeScript app shipped inside the APK and shown in the system WebView (Capacitor 7); a Java plugin provides automatic capture, the share sheet, Save as, the clipboard and system bars.

## Technology

| Layer | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript (strict) | Component model, strict types |
| Build | Vite 8 | Fast builds, code splitting (tesseract is a separate chunk) |
| Data | IndexedDB via `idb` | Large binary data (Blob) and indexes |
| OCR | tesseract.js 7 (WASM, LSTM) + 12 `4.0.0_best_int` models; ML Kit for background analysis | Real on-device text recognition |
| Backup | `fflate` (ZIP) | Small, no dependencies |
| Android | Capacitor 7 + a Java plugin, WorkManager, ML Kit | Native APK, automatic capture, share intents, Save as dialog |
| Tests | Vitest + fake-indexeddb, Playwright, Android emulator | Unit, UI, APK WebView and on-device tests |

Runtime dependencies of the interface: `react`, `react-dom`, `idb`, `tesseract.js`, `fflate`. Router, state management, i18n and icons are hand-written. `@capacitor/core` is not bundled; the code talks to the `window.Capacitor` object that the Android runtime injects.

## Folders

```
src/
  config/brand.ts      All brand settings (name, package id, version, colors, logo SVG, storage prefix)
  db/                  Schema, types, IndexedDB access (including quota error handling)
  import/              File validation (magic bytes, size, broken images), thumbnails
  ocr/engine.ts        tesseract.js worker; lazy loading, language switching (single or code+eng), CJK/RTL parameters, idle shutdown
  ocr/packs.ts         OCR language catalogue (12 built-in languages), configuration parsing, CJK/RTL handling
  categorize/          11 default categories + keywords, scoring, learned rules, optional AI
  ai/                  Optional AI providers (OpenAI, Anthropic, Gemini, OpenRouter, custom), vision and the AI text editor
  auto/                Automatic capture sync with the native side
  lib/entities.ts      Link/e-mail/phone/date extraction from extracted text
  search/              Turkish character folding, query parsing (dates/categories), scoring
  backup/              ZIP/JSON export, validation, restore with merge/replace
  lib/                 App state (store), actions (import, OCR queue), toasts
  native/bridge.ts     JavaScript side of the Android bridge (no-op outside the app, e.g. in UI tests)
  i18n/                index.ts (LANGS, lazy loading, fallback lang → en → tr) + 12 JSON files (tr default)
  ui/                  Screens, components, hash router, styles (light/dark theme, RTL via logical properties)
  ui/typewriter.ts     Animated search placeholder (one timer, pauses when hidden, never touches the value)
  ui/SearchInput.tsx   Shared search field for Home and Images
  ui/Dropdown.tsx      Custom listbox used for the app and OCR language menus
  ui/keyboard.ts       Keyboard (visual viewport) tracking; hides the bottom nav and keeps sheets above the keyboard
  ui/swipe.ts          Tab swipe gesture (direction lock, edge guard, interactive-element exclusion, RTL)
android/               Capacitor Android project (Gradle, manifest, Java plugin, capture worker, icons)
scripts/               OCR file copying + tesseract.js worker patch (tesseract-fix.mjs), icon generation, test and demo images, README cover, static test server, APK asset extraction, release notes
tests/unit             Unit tests
tests/e2e              Playwright UI tests on the production build (Pixel 7 + wide screen)
tests/e2e-android      APK WebView Playwright tests (files extracted from the APK, simulated bridge)
tests/device           On-device tests and README screenshots on the Android emulator
```

## OCR languages

All 12 models (`tur`, `eng`, `spa`, `fra`, `deu`, `por`, `ita`, `hin`, `ara`, `chi_sim`, `jpn`, `rus`) come from the `@tesseract.js-data/*` packages and are copied at build time by `scripts/copy-ocr-assets.mjs` to `public/ocr/lang/<code>.traineddata.gz`, together with the patched worker and the WASM cores. `cap sync` packages them as `assets/public/ocr/lang/`; the Android workflow fails if any of the 12 is missing from the APK.

Tesseract loads every language by name from `langPath`, so nothing is ever downloaded and recognition works offline from the first launch. Language packs stored by versions before 1.12.3 are deleted at startup (`removeLegacyPackStore`), and their old error records are shown as "ready" so a retry recognises the image.

tesseract.js 7.0.0 joins `l.data` instead of `l.code` when languages are passed in memory. `scripts/tesseract-fix.mjs` patches the shipped `worker.min.js` (idempotent; the build fails if the pattern is not found exactly once, so an upgrade forces a re-check).

## Data model

- `images`: metadata (title, note, tags, OCR text and status, category, confidence, reasons, `needsReview`, SHA-256 hash, multi-entry `searchTokens` index).
- `blobs`: the original file (kept byte for byte) and a WebP thumbnail. Record and blob are written in the same transaction; if one fails the transaction is rolled back and no half-written record remains.
- `categories`, `rules` (rules learned from corrections), `settings`.

## Main flows

1. **Import.** Automatic capture, Android share intents (**Share → Shotrova**), photo picker multi-select, file picker, drag and drop and the clipboard ("Paste from clipboard"). Each file goes through: format check (JPEG/PNG/WebP by magic bytes, not extension), max 40 MB, empty file, decodability, SHA-256 duplicate check. Progress and per-file errors are shown. Without automatic capture the app never asks for media access; it only sees files the user picks or shares. With automatic capture on, it reads only new screenshots.
2. **OCR queue.** Images are processed one at a time. If `ocrSourceHash === hash` the image is not processed again. Statuses: queued, processing, done, no text, error, with "Retry" on error. tesseract.js reports language load failures only through `errorHandler`, so the engine listens to that signal as well; otherwise the job would hang forever.
3. **Categorization.** Keyword-based. OCR text is folded, stop words are removed, and each category's weighted keywords plus learned rules are scored. Confidence comes from the margin between the winner and the runner-up. Below the threshold the image is marked "needs review". With fewer than 3 meaningful words no automatic decision is made. When the user corrects a category, visible rules are created for distinctive words (Settings → Learned rules, where they can be deleted).
4. **Optional AI.** OpenAI, Anthropic, Gemini, OpenRouter or any OpenAI-compatible endpoint. The user enters the key per provider; it is stored on the device (encrypted with Android Keystore), is excluded from exports and is never embedded in source code. With **vision off** (default) only the OCR text (max 2000 characters) and category names are sent, never the image. With **vision on** (explicit opt-in in Settings) the image itself — downscaled to max 1280 px, JPEG quality 0.85 — is sent as a data URL in the standard OpenAI vision message format, and the model returns a clean transcription, a title and a category suggestion. Results are merged conservatively (`mergeVisionResult`): a title is applied only while the user has not set one, a category only if it is not manual and beats the current confidence, and the AI text never overwrites a manual edit. Raw device OCR and AI text are stored in separate fields (`ocrText` / `aiText`); the Detail screen shows the AI text as primary when present and keeps the raw OCR behind a disclosure.
5. **AI text editor + entities.** The extracted text can be rewritten by the AI ("clean" fixes OCR garbling, "emoji" adds emojis) — text only, never the image, always behind a preview with Apply/Cancel. Links, e-mails, phone numbers and dates in the text become entity chips (`lib/entities.ts`) with copy/open/call actions; the Images screen can copy the text of all selected images at once.
6. **Search.** Text-based, not semantic. Works over OCR text, title, note, tags, category name and file name. Turkish characters are folded (ı/i, ş/s, ğ/g…), there is simple suffix tolerance ("tarifi" finds "tarif"), and a small TR↔EN synonym table ("İngilizce kelimeler" finds "English vocabulary"). Phrases like "geçen ay" / "last month", "son 7 gün", "dün" and category names become filters. Matches are highlighted.

## Android app

The APK is a Capacitor 7 project (`android/`, package `io.github.firatnexus.shotrova`, minSdk 26, targetSdk 35). `npx cap sync android` copies `dist/` into `android/app/src/main/assets/public/`, and the WebView loads it from `https://localhost` (`androidScheme: https`), so IndexedDB, WASM and Web Workers are available.

### Native plugin `ShotrovaBridge`

`android/app/src/main/java/io/github/firatnexus/shotrova/ShotrovaBridgePlugin.java` exposes:

| Method / event | Purpose |
|---|---|
| `takeSharedFiles`, event `share` | `ACTION_SEND` / `ACTION_SEND_MULTIPLE` with `image/*`: the shared content URIs are copied to `cache/inbox/` on a background thread (max 64 MB per file) and handed to the JavaScript side. The event is retained so a cold start does not lose it. |
| `releaseFiles` | Deletes inbox files after import (paths outside `cache/inbox/` are rejected). |
| `createDocument`, `writeDocumentChunk` | Storage Access Framework "Save as" dialog for saving originals and backups. |
| `writeOutboxChunk`, `shareOutboxFile` | Writes a file to `cache/outbox/` and opens the share sheet through a `FileProvider` (only `outbox/` is exposed). |
| `shareText` | Shares plain text. |
| `readClipboardImage` | Reads an image from the clipboard for "Paste from clipboard". |
| `setSystemBars` | Status and navigation bar colors and icon contrast for the current theme. |

`MainActivity.java` registers the plugin, forwards new intents and installs an `OnBackPressedCallback` that calls `window.__shotrovaBack()`. The JavaScript side closes an open dialog or goes back in its hash history and returns `true`; at the root it returns `false` and Android handles the back press normally.

On the JavaScript side, `src/native/bridge.ts` wraps the plugin (`Capacitor.nativePromise`, `addListener`, `convertFileSrc`). Binary data moves in 768 KB base64 chunks. Outside the app (UI tests in Chromium) every function is a no-op that returns `null`.

### Runtime details

- **No service worker:** every file is already inside the APK, and sharing uses Android intents. The `native-app` class is set on `<html>` so styles and tests can tell the app from a plain browser.
- **OCR models without gzip.** Android's asset packaging decompresses `*.gz` files and strips the extension, so the engine loads the models with `gzip: false` inside the app. Gradle's `noCompress` keeps `.wasm` files uncompressed.
- **No pinch zoom:** the app injects a `user-scalable=no` viewport, and the Detail image scales to fit.
- **Splash screen:** the launch theme shows the brand background and mark; `MainActivity` installs the AndroidX splash screen API before `super.onCreate()`, and the in-app launch screen (`#boot` in `index.html`) takes over at exactly the same size and position until the app is ready.
- **Manifest:** `INTERNET` (optional AI only); media access, notifications and boot re-arm only for automatic capture (see the README permissions table). `allowBackup="false"` and data extraction rules keep IndexedDB contents (and any AI key) out of Android cloud backups; the in-app backup is the supported path.

### Signing

The release build is signed from environment variables or `android/keystore.properties` (see [BUILD.md](BUILD.md)). The keystore is never committed. CI restores it from repository secrets.

## Privacy

The only network requests go to the AI provider, and only if the user explicitly enables it. App storage is not permanent: uninstalling the app or clearing its data deletes it. Regular backups are recommended.
