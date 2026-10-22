# Shotrova

Shotrova organizes your screenshots and makes them searchable, entirely on your device. It reads Turkish and English text in images with **real on-device OCR** (tesseract.js), sorts images into categories and lets you find them by the text they contain.

It ships in two forms built from the same code:

- **Android app (APK)**: a native Android app (Capacitor). It shows up in the Android share sheet as **Share → Shotrova**, OCR language files are bundled, and it works offline from the first launch.
- **Web app (PWA)**: runs in any modern browser at **https://firatnexus.github.io/shotrova/** and can be installed to the home screen.

| Mobile, light theme | Mobile, dark theme: search | Desktop |
|---|---|---|
| ![Dashboard](docs/screenshots/mobile-light-dashboard.png) | ![Search](docs/screenshots/mobile-dark-search.png) | ![Desktop](docs/screenshots/desktop-light-dashboard.png) |

## Download

- **Android APK:** [latest release](https://github.com/firatnexus/shotrova/releases/latest) → `shotrova-<version>.apk` (signed release build, Android 8.0+ / API 26+). Each release has a `SHA256SUMS.txt` file.
- **Web:** [firatnexus.github.io/shotrova](https://firatnexus.github.io/shotrova/)

Installing the APK: download it on the phone, open it, and allow "Install unknown apps" for your browser or file manager when Android asks. The app is not on Google Play.

## Features

- **Import:** multi-select from the system photo picker, file picker, drag and drop, clipboard (Ctrl+V or "Paste from clipboard") and the Android share sheet. JPEG, PNG and WebP. Files are validated by their magic bytes, duplicates are detected with SHA-256, and progress and per-file errors are shown.
- **On-device OCR:** Turkish + English. Each image has a status (queued, processing, done, no text, error) and failures can be retried. Unchanged images are never processed twice. The recognized text is editable; the original image is never modified.
- **Categories:** 11 default categories. Create, rename, recolor, reorder and delete categories. Automatic categorization is keyword-based and comes with a confidence score; uncertain images go to a review queue. Corrections create **visible, deletable** rules.
- **Optional AI, any provider:** pick OpenAI, Anthropic (Claude), Google Gemini, OpenRouter or your own OpenAI-compatible endpoint in Settings and add your own key — each provider keeps its own credentials. With **vision off** (default) only the on-device OCR text is sent for categorization — the image never leaves the device. With **vision on** (explicit opt-in) the image itself is sent to the provider, and the model extracts a **clean title, category and the full text** of the image, which becomes the primary text in the UI — the raw device OCR stays available behind a disclosure. The two are stored in separate fields and can be compared. You can also ask free-form questions about an image ("what is this?"). Transcription quality depends on the provider and model you choose.
- **AI text editor:** the extracted text can be rewritten by the AI — "clean" fixes OCR garbling and formatting while keeping the original language and content; "emoji" adds tasteful emojis. Edits are always applied after a preview and never overwrite manual edits silently.
- **Entities:** links, e-mails, phone numbers and dates found in the text become one-tap chips — copy, open the URL, call the number. On the Images screen, "Copy text" copies the text of every selected image at once.
- **Native feel (Android):** pinch/zoom is disabled in the app (images scale to fit), a proper splash screen shows on launch, and system bars follow the theme.
- **Search:** **text-based** (not semantic) search over OCR text, title, note, tags, category and file name. Tolerant of Turkish characters; phrases like "last month" and category names become filters; matches are highlighted.
- **Screens:** Dashboard, Images (filters, sorting, multi-select, bulk actions), Detail, Categories, Settings.
- **Design:** a "precision scanner" visual identity unique to Shotrova — Clash Display + Switzer typography, cool graphite surfaces and a teal scan accent, with viewfinder-corner motifs. Mobile-first, light/dark theme, keyboard accessible, reduced-motion support, skeleton loading, empty states, toasts and confirmation dialogs.
- **Privacy:** no server, no account, no analytics. Everything stays in IndexedDB on the device. ZIP (with images) or JSON backup and validated restore.
- **Languages:** Turkish (default) and English.

### Android app specifics

- Appears in **Share → Shotrova** for one or many images from the gallery, Files, or any app that shares images.
- "Save original" and "Export backup" open the Android **Save as** dialog (Storage Access Framework), so you choose where files go.
- "Share" opens the Android share sheet with the original file.
- The hardware/gesture back button closes dialogs, then walks back through the app, then leaves the app.
- Status and navigation bar colors follow the theme.
- Permissions: **INTERNET only** (used only for the optional AI provider). No media/gallery permission is requested; the app only sees images you pick or share.
- Android cloud backup of app data is disabled (`allowBackup="false"`); use the in-app backup.

## Quick start (development)

```bash
npm ci --legacy-peer-deps
npm run dev                         # development server
npm run build && npm run preview    # production build → http://localhost:4173
npm test                            # unit tests
npm run test:e2e                    # Playwright end-to-end tests (build first)
```

Building the APK (JDK 21 and Android SDK 35 required):

```bash
npm run apk:debug                   # build + cap sync + gradlew assembleDebug
```

Details, signing and CI: [docs/DEPLOY.md](docs/DEPLOY.md)

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Test results](docs/TESTING.md): unit 47/47, web E2E 34/34 (root) and 34/34 (subpath), APK web-shell E2E 8/8 on both the debug and the signed release APK. All of them were actually executed.
- [Name research](docs/NAMING.md)
- [Build and deployment](docs/DEPLOY.md)

## Limitations

- **Not tested on a physical Android device or emulator.** The build environment has no KVM/emulator. The APK was built, signed and inspected (`aapt2`, `apksigner`), and its bundled web files were tested in Chromium with a simulated Android bridge, but the Java side (share intents, Save as dialog, share sheet, clipboard, back button) only runs on a real device. See [TESTING.md](docs/TESTING.md) for manual test steps.
- **The gallery is not monitored.** Neither the app nor the web version watches your gallery or sees screenshots saved by other apps in the background. You pick or share the images.
- **Storage is not guaranteed to be permanent.** Uninstalling the app or clearing its data (or browser data for the web version) deletes everything. Make regular backups.
- **OCR accuracy** depends on image quality; handwriting and very small or decorative text may be misread. The web version downloads about 17 MB of OCR files on first use; the APK bundles them.
- **No visual understanding.** Categorization relies only on recognized text. Photos without text are not guessed; they go to "Uncategorized" for review.
- **Search is text-based,** not semantic. Apart from a small TR↔EN synonym table it does not know synonyms.
- **APK is Android only.** There is no iOS build. On the web, the share target works only after installing the PWA in a Chromium-based Android browser; iOS Safari does not support it.
- **No legal guarantee for the name.** See [NAMING.md](docs/NAMING.md).

## License

MIT, see [LICENSE](LICENSE). Third-party components: [tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0), Tesseract language models `@tesseract.js-data/tur` and `eng` (Apache-2.0 / MIT), [Capacitor](https://capacitorjs.com/) (MIT), [Satoshi font](https://www.fontshare.com/fonts/satoshi) (ITF Free Font License), React (MIT), idb (ISC), fflate (MIT).
