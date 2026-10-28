Shotrova for Android: a native APK built from the same code as the web app.

{{NOTES}}

## Download

| File | Size | |
|---|---|---|
| [`{{APK}}`]({{DOWNLOAD}}/{{APK}}) | {{APK_SIZE}} | {{BUILD_KIND}} |
| [`SHA256SUMS.txt`]({{DOWNLOAD}}/SHA256SUMS.txt) | {{SUMS_SIZE}} | Checksum |

SHA-256: `{{SHA256}}`

Prefer the browser? The same app runs at **[firatnexus.github.io/shotrova](https://firatnexus.github.io/shotrova/)** and can be added to your home screen.

## Install

1. Download the APK on your phone (Android 8.0+ / API 26+).
2. Open it and, if Android asks, allow "Install unknown apps" for your browser or file manager.
3. {{UPDATE_NOTE}}
4. On first launch, turning on automatic screenshot capture is optional.

## Highlights

- **On-device OCR** for Turkish and English; images never leave your phone unless you enable AI vision.
- **Automatic capture (opt-in):** new screenshots are detected, copied into the app and sorted with a notification.
- **11 categories** with confidence scores, a review queue and rules learned from your corrections.
- **Text-based search** over OCR text, title, notes, tags, category and file name.
- **Optional AI** with your own key: OpenAI, Anthropic, Gemini, OpenRouter or any OpenAI-compatible endpoint.
- **Private by design:** no server, no account, no analytics; ZIP/JSON backup and restore.
- **Notebook design:** cream paper, charcoal ink and an orange marker, with a matching dark theme.

## Permissions

`INTERNET` (optional AI only). Media access, notifications and boot re-arm are requested only if you turn on automatic capture. No location, camera, microphone or contacts access.

## Known limitations

- Not yet tested on a physical device; background capture timing may vary with OEM battery savers (e.g. Xiaomi/HyperOS).
- OCR accuracy depends on image quality; search is text-based, not semantic.
- Uninstalling the app or clearing its data removes everything, so keep a backup.

---

[README](https://github.com/{{REPO}}#readme) · [Full changelog](https://github.com/{{REPO}}/blob/main/docs/RELEASE_NOTES.md) · [Test results](https://github.com/{{REPO}}/blob/main/docs/TESTING.md) · [Report an issue](https://github.com/{{REPO}}/issues)
