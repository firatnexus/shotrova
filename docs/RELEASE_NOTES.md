Shotrova for Android: a native APK built from the same code as the web app.

## What's new in 1.12.1

- **Smoother tab swiping:** the page now follows your finger one-to-one and the next tab slides in from right beside it, so the motion is continuous instead of a short nudge and a jump. Past the first and last tab the page only stretches a little.
- **No stall on the Images tab:** opening Images used to draw every screenshot card at once, which froze large libraries during the swipe. The cards that fill the screen appear immediately and the rest follow right after the animation.
- **Swipes work on more of the screen:** a swipe that starts on the date or sort menu, or on a search field you are not typing in, now switches tabs. Category chips, carousels and fields you are typing in still keep their own gestures.
- Measured on a 4× slowed-down phone profile with 120 screenshots: dropped frames 84 → 27, longest freeze 267 ms → 67 ms.

## What's new in 1.12.0

- **Animated search hint:** the Home and Images search fields no longer show a static placeholder. A typewriter animation cycles through 25 example searches in the app language ("Pasta recipe", "Wi-Fi password", "Flight ticket and PNR"…). It stops the moment you tap the field, never touches what you type, resumes only when the field is empty again and pauses while the app is in the background.
- **Keyboard no longer covers forms:** on Android 15 the keyboard could hide the "Extra keywords" field and the Save/Cancel buttons of the category sheet. The app now resizes around the keyboard on every device (native inset handling plus a web fallback), the sheet body scrolls and its buttons stay pinned above the keyboard.
- **12 app languages:** English, Türkçe, Español, Français, Deutsch, Português, Italiano, हिन्दी, العربية, 中文, 日本語 and Русский, chosen from a new menu. Arabic switches the whole layout to right-to-left; Hindi, Chinese, Japanese and Arabic use matching system fonts. Translations other than Turkish and English were machine-assisted and may contain awkward wording.
- **12 OCR languages:** the same 12 languages for text recognition, optionally combined with English. Turkish and English are built in; the other 10 language files (0.7–2.7 MB each) are downloaded once when you pick them, checked with SHA-256 and stored on the device. Recognition always runs on your device; images are never uploaded. If a download fails, the previous language stays active.
- **Swipe between tabs:** swipe left or right to move between Home, Images, Categories and Settings. Swipes on chips, carousels, sliders, dialogs and text fields are left alone, there is no wrap-around, and the direction follows right-to-left layouts.
- **Fix:** an upstream tesseract.js bug that made every downloaded OCR language fail to load is patched in the bundled worker.
- Your data, categories and settings stay as they are.

## What's new in 1.11.0

- **New design (Figma-inspired "white gallery wall"):** a pure white canvas (#ffffff) with black text and hairlines where the only saturated color is Electric Indigo (#4d49fc) — used for the primary action, links and active states. The interface is achromatic on purpose: your screenshots carry every color. Grid cards are flat white with mist hairlines (#e2e2e2) and no shadows; the single floating shadow (0 24px 70px at 10%) lifts only the hero card and overlays.
- **Radius system:** a strict four-tier curvature language — 2px fine UI (badges, dividers), 8px ghost buttons and inputs, 16px cards, 50px pill buttons and chips.
- **Buttons:** the default action is a ghost button with a 1px black border; the primary CTA is the one indigo pill per screen; inverse actions are solid black pills.
- **Hero:** the home screen's display moment is now a floating white card — an ultra-light (weight 340) whisper headline with -0.02em tracking over the single soft shadow, replacing the cyan→violet gradient wash.
- **Typography:** Inter (variable, OFL, latin + latin-ext with full Turkish support, bundled offline) stands in for figmaSans: 16px minimum body size, weight-driven hierarchy with headings at 520 and the whisper-weight hero at 340.
- **Dark theme:** the same gallery at night — near-black canvas (#0a0a0a), white type, and a lighter indigo (#8f8cff) for links on dark surfaces so contrast meets AA; the indigo CTA keeps white text.
- **New logo:** a minimal two-color mark — the ink screenshot frame whose second text line ends in a single indigo dot ("the word you searched for, found inside"). App icon (adaptive foreground/background/monochrome), notification icon, favicon, PWA icons, splash (light: white with ink mark, dark: near-black with white mark), web boot splash and README logo were regenerated from this one source.
- No functional changes; your data stays as it is.

## What's new in 1.10.0

- **New design (Contra-inspired "editorial gallery on white"):** a bright white Paper canvas (#ffffff) where almost every element is deep Ink (#14171f) or hairline gray (#e5e7eb). Charcoal (#222834) is the single filled action color, lifted by a soft two-layer shadow instead of borders. Mist (#f5f6f9) is the only secondary surface. Cards are sharp 4px, buttons and tags are 24px pills, inputs 10px.
- **Hero wash:** the home screen's display moment — a 58px tight-tracked headline over the cyan→violet hero gradient wash (the only gradient on any screen), centered like a magazine cover.
- **Typography:** Inter (variable, OFL, latin + latin-ext with full Turkish support, bundled offline) stands in for GT Standard: 15px body with -0.01em tracking, uppercase-free sentence case, weight-driven hierarchy. Fraunces/Geist removed.
- **Decorations removed:** stickers, handwritten captions, marker underlines, tilted polaroid stacks and the orange brand band are gone — the gallery look carries itself. Image cards are now sharp paper cards with full-bleed thumbnails; the category cards carry a soft tint of the user's own category color.
- **Import card:** the closing band is now the featured dark card — Charcoal with a white display headline.
- **Dark theme:** the same gallery at night — Ink canvas (#14171f), graphite hairlines, white primary buttons (the inverse action).
- **New logo:** a minimal single-color mark — a rounded screenshot frame holding two text lines ("a screenshot you find by the words inside"). App icon (adaptive foreground/background/monochrome), notification icon, favicon, PWA icons, splash (light: white with ink mark, dark: ink with white mark), web boot splash and README logo were regenerated from this one source.
- No functional changes; your data stays as it is.

## What's new in 1.9.1

- **Search:** a single match now reads "1 result" instead of "1 results" (Turkish: "1 sonuç").
- **English documentation:** the README was rewritten from scratch in English with a new hero image, and all README screenshots now show the English UI. Release notes, user flows and the repository description are in English too.
- No other functional or design changes.

## What's new in 1.9.0

- **New design (Superr-inspired "school notebook"):** a warm notebook in afternoon light. Cream paper canvas (#fdfbf9); every line, button outline and structural edge in charcoal ink (#171717); headlines in cocoa ink (#2b1a07). The only chromatic accent is Marker Orange (#ff6f1e), used only for handwritten captions, the highlighted word and the closing band. No gradients, glass or neon; shadows are a whisper (6% on cards, 1–2px at 25% on buttons).
- **Typography:** Fraunces (soft, rounded serif via its SOFT 100 axis, standing in for gelica) for headlines, buttons and handwritten captions; Geist for UI text. Both are variable, OFL-licensed, latin + latin-ext (full Turkish support) and bundled with the app — no CDN. Headlines are lowercase, normal letter-spacing, left-aligned.
- **Home:** a large lowercase headline with one word ("organized" / "findable") highlighted in orange marker with a hand-drawn wavy underline, a handwritten caption above it ("dear screenshots,") and a thin hand-drawn arrow. On desktop your three latest screenshots sit on the right as a tilted polaroid stack with a school-style name label (title / category / no.). Home ends with an orange brand band with 56px top corners ("add your screenshots").
- **Stickers:** flat decorative stickers with a 2px ink outline (bolt, heart with eyes, sparkle, ghost, star), tilted 5–15° as if stuck on by hand. Decoration only: hidden from screen readers, and their colors are never used on functional elements.
- **Components:** cream-filled pill buttons with a 1.5px ink outline and 20px radius (no filled primary button), 12px cards, 8px inputs, 20px pill tags. Image cards look like polaroids — paper frame, 8px photo window — slightly tilted in the "Recently added" strip. Orange accents on switches, sliders and progress bars.
- **Layout:** polaroid brand mark top left, a single pill button ("Add images") top right. On desktop navigation is a plain text menu centred in the top bar; content widens to 1200px while settings and categories stay in a 760px notebook column. Image detail shows image and text side by side on desktop. On mobile a bottom tab bar with icons and labels; the active tab sits in a small ink-outlined pill.
- **Dark theme:** a night notebook — warm cocoa canvas (#17120d), cream ink, the same orange marker. Text/background pairs meet WCAG AA; the focus ring is green (Sprout).
- **Logo and icons:** an ink-drawn cream polaroid on an orange tile; its second text line is orange, i.e. a highlighted word. App icon (adaptive foreground / background / monochrome), favicon, PWA icons, splash (light: cream, dark: #17120d) and README logo were regenerated. The web splash draws an orange squiggle.
- No functional changes otherwise; your data stays as it is.

## What's new in 1.8.0

- **New design (Threads-inspired):** a quiet, content-first interface. #fafafa canvas, white cards, pure black text. Shadows and gradients removed; surfaces are separated by 1px grey hairlines (#d5d5d5).
- **Color use:** Verified Indigo (#385898) only for links, focus rings and badges; Signal Blue (#0095f6) only as the outline of the primary action. The only filled button is the black "Add images" pill in the top bar. Resting icons are colorless.
- **Typography:** webfonts (Inter, Plus Jakarta Sans) removed in favour of the system font stack. Hierarchy is weight-driven (400/600/700); text sizes 12/13/15px, headings 17/24px. Smaller app bundle.
- **Layout:** a white 56px top bar with a hairline and centred title. On desktop an 80px icon-only left rail (logo on top, 4px black marker on the active item) and a centred 600px content column. On mobile an icon-only bottom tab bar (labels kept for screen readers).
- **Components:** 18px cards, 8px media and inputs, fully rounded buttons/tags/avatars. Tight spacing (4px base, 16px card padding, 12px gaps).
- **Dark theme:** derived from Threads' own dark palette (#101010 canvas, #181818 surfaces, #f3f5f7 text). Text/background pairs meet WCAG AA.
- **Logo and icons:** the polaroid logo went black and white and inverts with the theme inside the app. App icon, favicon, PWA icons, splash (light: white, dark: white glyph on #101010) and README logo regenerated.
- **Smoothness:** shadows, blur and tilted card rendering removed; off-screen cards in long lists are skipped (`content-visibility`); the loading skeleton uses a light opacity pulse instead of a shimmer.
- No functional changes; only look and layout.

## What's new in 1.7.0

- **New design (Portrait-inspired):** a single white canvas and no colored bands. Text, hairlines and outlines all in one ink color (#08304c). The single accent is Nautical Teal (#084e72), with soft pastels on small surfaces (mint #d7ffe2, sky #e8f1ff, peach #ffebd6).
- **Rainbow accent:** in only three places — the 1.5px outline of the "Add images" button in the top bar, the one slanted word in the home headline ("organized" / "findable") and the thin line on the splash.
- **Components:** floating pill top bar and bottom menu, 24px cards, 28px pill buttons (primary outlined in ink instead of filled, secondary ghost), 16px inputs, pill tags, polaroid-style image cards (recently added slightly tilted). Shadows at most 8% black, layered, with a 1px hairline.
- **Typography:** Inter for UI text, Plus Jakarta Sans (variable, OFL) for large headlines with tight negative tracking.
- **New logo:** a slightly tilted minimal white polaroid on an ink tile. App icon (adaptive foreground / background / monochrome), notification icon, favicon, PWA icons and README logo regenerated.
- **Splash:** white in light theme, deep ink (#061f33) in dark theme; Android system bar and theme colors adapted to the new palette.
- **Dark theme:** deep ink canvas (#061f33), ink surfaces (#08304c), white text. Text/background pairs meet WCAG AA.
- No functional changes; only look and layout.

## What's new in 1.6.0

- **New design (Superhuman-inspired):** a three-canvas visual language. Home opens with a navy (#1b1938) hero with an atmospheric violet-sky gradient; the white headline, white search box, pill-shaped sample searches and a hairline-separated stats row live inside it. The body is white (#ffffff / #fafaf8) and text is a warm dark grey (#292827) instead of pure black. Home always ends with a dark teal (#0e3030) closing band — the "Add your screenshots" area.
- **Typography:** a single font family (Inter, variable) with in-between weights (460 / 540 / 600), tight heading line-height and negative tracking. Bricolage Grotesque and JetBrains Mono removed (smaller bundle); technical text such as file names uses the system monospace font.
- **Components:** 8px rectangular buttons (navy primary, outlined secondary), pill filter chips, 12px hairline cards, 6px inputs, navy toasts and 16px dialogs. Shadows are light on cards and pronounced only on dialogs, toasts and product imagery.
- **Dark theme:** midnight canvas (#0e0c1f), navy surfaces, light violet (#c9b4fa) for buttons and links. All text/background pairs meet WCAG AA (≥ 4.5:1).
- **Brand:** app icons (web + Android launcher), splash screens (light: white, dark: midnight), manifest and Android system bar colors regenerated with the new palette.
- **Fixes merged since 1.5.0 and first released with this version:**
  - Double splash fixed: on Android the web splash is hidden and the native splash stays until the first frame is drawn.
  - Added a dark native splash for the dark theme; system bars follow the theme.
  - Hid the WebView vertical scrollbar that appeared while scrolling.

## What's new in 1.5.0

- **New design:** an Apple-inspired visual language — Action Blue (#0066cc) as the single interaction color, parchment (#f5f5f7) and near-black (#1d1d1f) surfaces, hairline borders, pill buttons and a press-to-scale (0.95) micro-interaction. Body text at 17px and headings in the system font stack (SF Pro on Apple devices) with negative tracking; shadow is reserved for product imagery, while cards, dialogs and toasts are flat. Clash Display/Switzer webfonts removed (smaller bundle), iOS-style segmented controls and switches added, compact controls grow to 44px touch targets on touch widths. In dark theme button fills stay Action Blue while links and focus rings become the brighter Sky Link Blue (#2997ff). Brand colors, splash, manifest theme colors and all app icons (web + Android launcher) regenerated with the new palette.

## What's new in 1.4.0

- **Automatic screenshot detection (opt-in):** using background work (MediaStore + WorkManager; no persistent notification) the app aims to detect new screenshots — instantly while open, and as soon as the OS allows background work while closed. It copies the image into its own storage (the app's copy stays even if you delete it from the gallery) and, with explicit permission, the AI suggests a title + category. Each saved screenshot posts a notification like "Saved to Shopping as 'Invoice summary'"; tapping it opens the image. Note: device-specific detection speed (screen off, Xiaomi/HyperOS) needs real-device testing.
- **First-run consent screen:** automatic detection does nothing on first launch without consent. Each permission is explained one by one, and you choose what is sent to the AI (text only / downscaled image). Your existing screenshot history is never imported on first launch — only new screenshots are captured.
- **Honest status card:** home shows "Automatic capture: On / Off / Missing permission / Battery restricted" with a one-tap fix for each problem. Partial media access (Android 14+ "Allow all" flow) is supported.
- **AI privacy:** the key is stored on the device encrypted with Android Keystore; each image has a "Don't send to AI" exclusion switch; on key/quota/network errors the image is honestly queued as "Analysis pending" and retried.
- **Also delete from phone:** in image detail, a system delete flow that also removes the original gallery file once you confirm (Android 11+).
- **Xiaomi/HyperOS guide:** a "Background work settings" screen with step-by-step guidance for battery restrictions. Force-stop/reboot can cause delays; missed screenshots are picked up on launch and by the 15-minute WorkManager scan — this is an OS limit, not a real-time promise.
- New end-to-end tests: simultaneous sync of a captured screenshot with its analysis, content-hash dedupe, opening via notification tap and the AI exclusion switch.

## What's new in 1.3.1

- **Image Q&A fix:** the image is now sent with every question (required for follow-ups because provider APIs are stateless). The conversation resets when the image changes; no question can be sent without an image.
- **Search this text on the web:** now an editable search box — photos without readable text can be searched by title/object name too.
- **Copy text** now copies the text shown on screen (AI result or hand-corrected text), not the raw device OCR.
- **Forget key** removes only the key of the provider currently selected on screen and leaves other providers' keys untouched (UI and action now look at the same provider).
- New end-to-end test: with different keys entered for two providers, switching between them never mixes the keys, they survive a reload, and "forget" removes only one.

## What's new in 1.3.0

- **Multi-provider AI:** pick your provider in Settings — OpenAI, Anthropic (Claude), Google Gemini, OpenRouter or your own OpenAI-compatible endpoint. Each provider keeps its own API key, model and (for custom) base URL; switching providers never mixes credentials. Your saved v1.2.x key and endpoint carry over automatically to the matching provider.
- **Ask about this image (Lens-style):** with AI vision consent on, open the detail screen and ask free-form questions about a photo ("what is this?", "where was it taken?") — the image is sent to your provider with the first question, follow-ups continue as text with conversation context.
- **Search the web:** a "Search this text on the web" link opens a Google search for the recognised text. Google Lens itself has no official third-party API, so the app pairs this with the existing share action — on Android you can send the image to the Lens app (or any other app) through the share sheet.
- **Key hygiene:** backups never contain any provider's API key (keys are stripped from exports entirely).

## What's new in 1.2.2

- A photo shared from Android with a machine-generated file name (UUID) is no longer shown with that UUID as its title — the app shows a clean "Untitled image" label until you or the AI set a real title.
- When the on-device OCR result is low-confidence (hard-to-read photos), the raw garbled text is collapsed behind a "Low-confidence OCR result" disclosure with a hint about AI vision, instead of being the main result.
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
