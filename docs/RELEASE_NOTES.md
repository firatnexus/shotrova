Shotrova for Android: a native APK built from the same code as the web app.

## What's new in 1.3.0

- **Multi-provider AI:** pick your provider in Settings — OpenAI, Anthropic (Claude), Google Gemini, OpenRouter or your own OpenAI-compatible endpoint. Each provider keeps its own API key, model and (for custom) base URL; switching providers never mixes credentials. Your saved v1.2.x key and endpoint carry over automatically to the matching provider.
- **Ask about this image (Lens-style):** with AI vision consent on, open the detail screen and ask free-form questions about a photo ("what is this?", "where was it taken?") — the image is sent to your provider with the first question, follow-ups continue as text with conversation context.
- **Search the web:** a "Metni web'de ara" link opens a Google search for the recognised text. Google Lens itself has no official third-party API, so the app pairs this with the existing share action — on Android you can send the image to the Lens app (or any other app) through the share sheet.
- **Key hygiene:** backups never contain any provider's API key (keys are stripped from exports entirely).

## What's new in 1.2.2

- A photo shared from Android with a machine-generated file name (UUID) is no longer shown with that UUID as its title — the app shows a clean "Adsız görsel" label until you or the AI set a real title.
- When the on-device OCR result is low-confidence (hard-to-read photos), the raw garbled text is collapsed behind a "Düşük güvenli OCR sonucu" disclosure with a hint about AI vision, instead of being the main result.
- A text you corrected by hand stays the primary text even after an AI vision result arrives (the AI transcription is kept as its own field).

## What's new in 1.2.1

- Scrolled-to content (e.g. jumping to the extracted text) now lands clear of the top bar instead of sliding under it.
- Documentation: AI vision wording clarified — transcription quality depends on your provider and model.

## What's new in 1.2.0

- **AI vision (opt-in):** when enabled in Settings, images are sent to your own OpenAI-compatible provider and the model extracts a **clean title, category and the full text** of the image — replacing the garbled on-device OCR as the primary text. The raw device OCR remains available behind a "raw OCR" disclosure. With vision off (default), only text is ever sent — images never leave the device.
- **AI text editor:** "clean" fixes OCR garbling and formatting in the extracted text; "emoji" adds tasteful emojis. Always previewed before applying; manual edits are never overwritten silently.
- **Entities:** links, e-mails, phone numbers and dates in the text become one-tap chips — copy, open, call. "Copy text" copies the text of all selected images at once.
- **New design:** a "precision scanner" identity unique to Shotrova — Clash Display + Switzer typography, cool graphite surfaces, teal scan accent and viewfinder-corner motifs. Not a template of any other app.
- **Splash screen:** the app now opens with a proper branded splash (web boot screen + native Android splash) instead of launching straight into a half-loaded UI.
- **No accidental zoom (APK):** pinch zoom is disabled in the native app, so it no longer behaves like a zooming web page. The web version keeps zoom for accessibility.

## The app

- Share one or many screenshots to Shotrova from the Android share sheet.
- OCR (Turkish + English) files are bundled, so text recognition works offline from the first launch.
- Save originals and backups with the Android "Save as" dialog; share images through the share sheet.
- Paste images from the Android clipboard, back button support, system bar colors follow the theme.
- Only the INTERNET permission (for the optional AI provider); no gallery or media permission.

Install: download `shotrova-<version>.apk` below, open it and allow installing from this source if Android asks. Requires Android 8.0 or newer. Check the file with `SHA256SUMS.txt` if you like.

Honest note: the APK was built, signed and tested in a simulated Android WebView, but not on a physical device or emulator. See [docs/TESTING.md](https://github.com/firatnexus/shotrova/blob/main/docs/TESTING.md).

Web version: https://firatnexus.github.io/shotrova/
