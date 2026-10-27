# Shotrova

Shotrova organizes your screenshots and makes them searchable, entirely on your device. It reads Turkish and English text in images with **real on-device OCR** (tesseract.js), sorts images into categories and lets you find them by the text they contain.

It ships in two forms built from the same code:

- **Android app (APK)**: a native Android app (Capacitor). It shows up in the Android share sheet as **Share → Shotrova**, OCR language files are bundled, and it works offline from the first launch.
- **Web app (PWA)**: runs in any modern browser at **https://firatnexus.github.io/shotrova/** and can be installed to the home screen.

| Mobile, light: dashboard | Mobile, dark: search | Mobile, light: AI settings | Desktop |
|---|---|---|---|
| ![Dashboard](docs/screenshots/mobile-light-dashboard.png) | ![Search](docs/screenshots/mobile-dark-search.png) | ![AI settings](docs/screenshots/mobile-light-settings-ai.png) | ![Desktop](docs/screenshots/desktop-light-dashboard.png) |
| Mobile, light: image detail | Mobile, dark: categories | Desktop, dark: image detail | |
| ![Detail](docs/screenshots/mobile-light-detail.png) | ![Categories](docs/screenshots/mobile-dark-categories.png) | ![Detail](docs/screenshots/desktop-dark-detail.png) | |

## Download

- **Android APK:** [latest release](https://github.com/firatnexus/shotrova/releases/latest) → `shotrova-<version>.apk` (signed release build, Android 8.0+ / API 26+). Each release has a `SHA256SUMS.txt` file.
- **Web:** [firatnexus.github.io/shotrova](https://firatnexus.github.io/shotrova/)

Installing the APK: download it on the phone, open it, and allow "Install unknown apps" for your browser or file manager when Android asks. The app is not on Google Play.

## Features

- **Automatic screenshot capture (Android, opt-in):** when enabled, the app detects new screenshots by itself (MediaStore + WorkManager background work, no persistent notification), copies them into its own storage so they survive gallery deletion, and — with your explicit consent — analyses them with your own AI key to produce a title and category. You get a notification like "Ekran görüntüsü 'Fatura Özeti' başlığıyla Alışveriş kategorisine kaydedildi". The home screen shows an honest status card (Otomatik algılama: Açık / Kapalı / İzin eksik / Pil kısıtı var) with one-tap fixes, and a Xiaomi/HyperOS guidance screen explains the background-work settings. Screenshot detection needs the media permission (partial access is supported); the app never imports your existing screenshot history on first enable — only new screenshots are captured. The copy stays in the app even if you delete the original from the gallery; deleting inside the app removes only the app's copy unless you confirm "Telefondan da sil".
- **Import:** multi-select from the system photo picker, file picker, drag and drop, clipboard (Ctrl+V or "Paste from clipboard") and the Android share sheet. JPEG, PNG and WebP. Files are validated by their magic bytes, duplicates are detected with SHA-256, and progress and per-file errors are shown.
- **On-device OCR:** Turkish + English. Each image has a status (queued, processing, done, no text, error) and failures can be retried. Unchanged images are never processed twice. The recognized text is editable; the original image is never modified.
- **Categories:** 11 default categories. Create, rename, recolor, reorder and delete categories. Automatic categorization is keyword-based and comes with a confidence score; uncertain images go to a review queue. Corrections create **visible, deletable** rules.
- **Optional AI, any provider:** pick OpenAI, Anthropic (Claude), Google Gemini, OpenRouter or your own OpenAI-compatible endpoint in Settings and add your own key — each provider keeps its own credentials. With **vision off** (default) only the on-device OCR text is sent for categorization — the image never leaves the device. With **vision on** (explicit opt-in) the image itself is sent to the provider, and the model extracts a **clean title, category and the full text** of the image, which becomes the primary text in the UI — the raw device OCR stays available behind a disclosure. The two are stored in separate fields and can be compared. You can also ask free-form questions about an image ("what is this?"). Transcription quality depends on the provider and model you choose.
- **AI text editor:** the extracted text can be rewritten by the AI — "clean" fixes OCR garbling and formatting while keeping the original language and content; "emoji" adds tasteful emojis. Edits are always applied after a preview and never overwrite manual edits silently.
- **Entities:** links, e-mails, phone numbers and dates found in the text become one-tap chips — copy, open the URL, call the number. On the Images screen, "Copy text" copies the text of every selected image at once.
- **Native feel (Android):** pinch/zoom is disabled in the app (images scale to fit), a proper splash screen shows on launch, and system bars follow the theme.
- **Search:** **text-based** (not semantic) search over OCR text, title, note, tags, category and file name. Tolerant of Turkish characters; phrases like "last month" and category names become filters; matches are highlighted.
- **Screens:** Dashboard, Images (filters, sorting, multi-select, bulk actions), Detail, Categories, Settings.
- **Design:** a Superhuman-inspired visual language with three canvases — an editorial indigo-navy hero (#1b1938) washed with a violet-sky atmospheric gradient, a quiet white body (#ffffff, alternating with #fafaf8) set in warm dark-grey ink (#292827, 14.7:1; secondary #73706d at 4.9:1), and a deep-teal closing band (#0e3030) that holds the import call to action. One variable sans (Inter, standing in for Super Sans VF) at the in-between weights 460 / 540 / 600 with tight display leading and negative tracking; system monospace for technical literals. 8px rounded-rectangle buttons (indigo fill, 16.9:1 with white labels), pill tabs for chips, 12px hairline cards with a subtle lift and one floating shadow for sheets, toasts and product imagery. Dark theme: indigo-deep body (#0e0c1f), indigo surfaces and pale violet (#c9b4fa) actions. Mobile-first, light/dark theme, keyboard accessible, reduced-motion support, skeleton loading, empty states, toasts and confirmation dialogs.
- **Privacy:** no server, no account, no analytics. Everything stays in IndexedDB on the device. ZIP (with images) or JSON backup and validated restore.
- **Languages:** Turkish (default) and English.

### Android app specifics

- **Automatic capture:** opt-in via the first-run consent screen (or Settings → Otomatik Algılama). MediaStore + WorkManager content triggers run as soon as the OS allows the background work (seconds on stock Android, potentially delayed by OEM power management), plus a periodic catch-up scan (minimum 15 minutes — an OS floor, not a promise of real-time), and a catch-up on every launch for anything missed. This is implemented and covered by automated tests of the web layer; detection timing on a specific device (e.g. Xiaomi/HyperOS with the screen off) still needs real-device verification. A notification is posted for each saved screenshot (tap it to open the image); failures are queued honestly as "Analiz bekliyor" and retried. Force-stop/reboot can still delay detection — the in-app "Arka plan çalışma ayarları" screen walks you through the battery-saver exceptions. Each capture can be excluded from AI ("Yapay zekaya gönderme").
- Appears in **Share → Shotrova** for one or many images from the gallery, Files, or any app that shares images.
- "Save original" and "Export backup" open the Android **Save as** dialog (Storage Access Framework), so you choose where files go.
- "Share" opens the Android share sheet with the original file.
- The hardware/gesture back button closes dialogs, then walks back through the app, then leaves the app.
- Status and navigation bar colors follow the theme.
- Permissions: **INTERNET**, plus — only if you enable automatic capture — **media access** (READ_MEDIA_IMAGES with partial-access support on Android 14+, READ_EXTERNAL_STORAGE on Android 8–12) and **POST_NOTIFICATIONS**. Without automatic capture the app only sees images you pick or share. **RECEIVE_BOOT_COMPLETED** re-arms the capture worker after a reboot. No location, camera, microphone or contacts permissions, ever.
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
- [Test results](docs/TESTING.md): unit 83/83, web E2E 38/38 (root) and 38/38 (subpath), APK web-shell E2E 8/8 on both the debug and the signed release APK, plus a live end-to-end run against the real Google Gemini API. All of them were actually executed.
- [Name research](docs/NAMING.md)
- [Build and deployment](docs/DEPLOY.md)

## Limitations

- **Not tested on a physical Android device or emulator.** The build environment has no KVM/emulator. The APK was built, signed and inspected (`aapt2`, `apksigner`), and its bundled web files were tested in Chromium with a simulated Android bridge, but the Java side (share intents, Save as dialog, share sheet, clipboard, back button) only runs on a real device. See [TESTING.md](docs/TESTING.md) for manual test steps.
- **The gallery is not monitored.** Neither the app nor the web version watches your gallery or sees screenshots saved by other apps in the background. You pick or share the images.
- **Storage is not guaranteed to be permanent.** Uninstalling the app or clearing its data (or browser data for the web version) deletes everything. Make regular backups.
- **OCR accuracy** depends on image quality; handwriting and very small or decorative text may be misread. The web version downloads about 17 MB of OCR files on first use; the APK bundles them.
- **Visual understanding is optional and off by default.** Without AI, categorization relies only on recognized text — photos without text go to "Uncategorized" for review. With AI vision enabled (explicit opt-in), the provider reads the image itself: clean title, category, full transcription and free-form questions about the photo.
- **Search is text-based,** not semantic. Apart from a small TR↔EN synonym table it does not know synonyms.
- **APK is Android only.** There is no iOS build. On the web, the share target works only after installing the PWA in a Chromium-based Android browser; iOS Safari does not support it.
- **No legal guarantee for the name.** See [NAMING.md](docs/NAMING.md).

## License

MIT, see [LICENSE](LICENSE). Third-party components: [tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0), Tesseract language models `@tesseract.js-data/tur` and `eng` (Apache-2.0 / MIT), [Capacitor](https://capacitorjs.com/) (MIT), React (MIT), idb (ISC), fflate (MIT). No webfonts are bundled — the UI uses the operating system font stack.
