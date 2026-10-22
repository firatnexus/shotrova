# Architecture overview

Shotrova runs entirely on the client. There is no server, account or analytics. Images, OCR text and settings stay in IndexedDB on the device. The same web build runs in the browser (PWA) and inside the Android app (Capacitor WebView).

## Technology

| Layer | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript (strict) | Component model, strict types |
| Build | Vite 8 | Fast builds, code splitting (tesseract is a separate chunk) |
| Data | IndexedDB via `idb` | Large binary data (Blob) and indexes |
| OCR | tesseract.js 7 (WASM, LSTM) + `tur` and `eng` models | Real on-device text recognition |
| Backup | `fflate` (ZIP) | Small, no dependencies |
| Android | Capacitor 7 + a small Java plugin | Native APK, share intents, Save as dialog |
| Tests | Vitest + fake-indexeddb, Playwright | Unit and end-to-end tests |

Runtime web dependencies: `react`, `react-dom`, `idb`, `tesseract.js`, `fflate`. Router, state management, i18n and icons are hand-written. `@capacitor/core` is not bundled; the web code talks to the `window.Capacitor` object that the Android runtime injects.

## Folders

```
src/
  config/brand.ts      All brand settings (name, package id, version, colors, logo SVG, storage prefix)
  db/                  Schema, types, IndexedDB access (including quota error handling)
  import/              File validation (magic bytes, size, broken images), thumbnails
  ocr/engine.ts        tesseract.js worker; lazy loading, language switching, idle shutdown
  categorize/          11 default categories + keywords, scoring, learned rules, optional AI
  search/              Turkish character folding, query parsing (dates/categories), scoring
  backup/              ZIP/JSON export, validation, restore with merge/replace
  lib/                 App state (store), actions (import, OCR queue), toasts
  native/bridge.ts     Web side of the Android bridge (no-op in the browser)
  i18n/                tr.json (default), en.json
  pwa/sw.template.js   Service worker template (becomes dist/sw.js at build time)
  ui/                  Screens, components, hash router, styles (light/dark theme)
android/               Capacitor Android project (Gradle, manifest, Java plugin, icons)
scripts/               OCR file copying, icon generation, static server, test images, APK asset extraction
tests/unit             Unit tests
tests/e2e              Web Playwright tests
tests/e2e-android      APK web-shell Playwright tests
```

## Data model

- `images`: metadata (title, note, tags, OCR text and status, category, confidence, reasons, `needsReview`, SHA-256 hash, multi-entry `searchTokens` index).
- `blobs`: the original file (kept byte for byte) and a WebP thumbnail. Record and blob are written in the same transaction; if one fails the transaction is rolled back and no half-written record remains.
- `categories`, `rules` (rules learned from corrections), `settings`.

## Main flows

1. **Import.** Photo picker multi-select, file picker, drag and drop, clipboard (Ctrl+V and "Paste from clipboard"), the web share target and, in the APK, Android share intents. Each file goes through: format check (JPEG/PNG/WebP by magic bytes, not extension), max 40 MB, empty file, decodability, SHA-256 duplicate check. Progress and per-file errors are shown. The app never asks for access to the whole gallery; it only sees files the user picks or shares.
2. **OCR queue.** Images are processed one at a time. If `ocrSourceHash === hash` the image is not processed again. Statuses: queued, processing, done, no text, error, with "Retry" on error. tesseract.js reports language download failures only through `errorHandler`, so the engine listens to that signal as well; otherwise the job would hang forever.
3. **Categorization.** Keyword-based. OCR text is folded, stop words are removed, and each category's weighted keywords plus learned rules are scored. Confidence comes from the margin between the winner and the runner-up. Below the threshold the image is marked "needs review". With fewer than 3 meaningful words no automatic decision is made. When the user corrects a category, visible rules are created for distinctive words (Settings → Learned rules, where they can be deleted).
4. **Optional AI.** An OpenAI-compatible endpoint can be used. The user enters the key; it is stored only in this device's IndexedDB, is excluded from exports and is never embedded in source code. Only the OCR text (max 2000 characters) and category names are sent, never the image. The app does not claim to understand visual content.
5. **Search.** Text-based, not semantic. Works over OCR text, title, note, tags, category name and file name. Turkish characters are folded (ı/i, ş/s, ğ/g…), there is simple suffix tolerance ("tarifi" finds "tarif"), and a small TR↔EN synonym table ("İngilizce kelimeler" finds "English vocabulary"). Phrases like "geçen ay" / "last month", "son 7 gün", "dün" and category names become filters. Matches are highlighted.
6. **PWA (web only).** Manifest, standalone mode, maskable and monochrome icons, shortcuts and `share_target` (POST, multipart). The service worker caches the app shell, tries the network first for navigations and falls back to the cache after 3 seconds. OCR files are served from the cache ("Download for offline use" prefetches about 17 MB). Shared files are put in a temporary inbox in Cache Storage and the app opens at `#/import?shared=N`.

## Android app

The APK is a Capacitor 7 project (`android/`, package `io.github.firatnexus.shotrova`, minSdk 26, targetSdk 35). `npx cap sync android` copies `dist/` into `android/app/src/main/assets/public/`, and the WebView loads it from `https://localhost` (`androidScheme: https`), so IndexedDB, WASM and Web Workers behave as on the web.

### Native plugin `ShotrovaBridge`

`android/app/src/main/java/io/github/firatnexus/shotrova/ShotrovaBridgePlugin.java` exposes:

| Method / event | Purpose |
|---|---|
| `takeSharedFiles`, event `share` | `ACTION_SEND` / `ACTION_SEND_MULTIPLE` with `image/*`: the shared content URIs are copied to `cache/inbox/` on a background thread (max 64 MB per file) and handed to the web side. The event is retained so a cold start does not lose it. |
| `releaseFiles` | Deletes inbox files after import (paths outside `cache/inbox/` are rejected). |
| `createDocument`, `writeDocumentChunk` | Storage Access Framework "Save as" dialog for saving originals and backups. |
| `writeOutboxChunk`, `shareOutboxFile` | Writes a file to `cache/outbox/` and opens the share sheet through a `FileProvider` (only `outbox/` is exposed). |
| `shareText` | Shares plain text. |
| `readClipboardImage` | Reads an image from the clipboard for "Paste from clipboard". |
| `setSystemBars` | Status and navigation bar colors and icon contrast for the current theme. |

`MainActivity.java` registers the plugin, forwards new intents and installs an `OnBackPressedCallback` that calls `window.__shotrovaBack()`. The web side closes an open dialog or goes back in its hash history and returns `true`; at the root it returns `false` and Android handles the back press normally.

On the web side, `src/native/bridge.ts` wraps the plugin (`Capacitor.nativePromise`, `addListener`, `convertFileSrc`). Binary data moves in 768 KB base64 chunks. In the browser every function is a no-op that returns `null`, and the regular web code path runs.

### Differences from the web build at runtime

- **No service worker** inside the app: assets are already local, and the share target is replaced by Android intents. The `native-app` class is set on `<html>` so styles and tests can tell the two apart.
- **OCR models without gzip.** Android's asset packaging decompresses `*.gz` files and strips the extension, so the engine loads the models with `gzip: false` when `isNativeApp()` is true. Gradle's `noCompress` keeps `.wasm` files uncompressed.
- **Settings** shows "OCR files are bundled with the app" and an app-specific storage note instead of the offline download and PWA install sections. The web version shows a link to the APK instead.
- **Manifest:** `INTERNET` permission only (needed only for the optional AI provider); no media or storage permissions. `allowBackup="false"` and data extraction rules keep IndexedDB contents (and any AI key) out of Android cloud backups; the in-app backup is the supported path.

### Signing

The release build is signed from environment variables or `android/keystore.properties` (see [DEPLOY.md](DEPLOY.md)). The keystore is never committed. CI restores it from repository secrets.

## Privacy

The only network requests are the app's own files (web only) and, if the user explicitly enables it, the AI provider. Browser storage is not permanent: clearing browser data, low disk space, uninstalling the app or clearing app data can delete it. In the web version, Settings can request persistent storage with `navigator.storage.persist()`, but the browser may refuse and it is still not a guarantee. Regular backups are recommended.
