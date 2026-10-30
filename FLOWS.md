# Main flows

The flows the tests and manual checks cover. Names are user-visible text of the English UI (Turkish is the default UI language; labels have exact Turkish equivalents).

## Launch
- Start: tap the Shotrova icon.
- Expect: the Android splash hands off to the in-app launch screen with the mark at exactly the same size and position, then the home screen; no blank frame and no uncaught errors.

## Home / dashboard
- Expect: hero dropzone with "Add images" and "Paste from clipboard" buttons, recent strip, category chips, compact stats.
- 11 default categories visible on home (as chips/cards).

## Import an image
- Steps: "Add images" → pick fixture → OCR runs → toast "1 added".
- Expect: image appears in library; OCR text extracted; category auto-assigned.

## Library
- Steps: open "Images" tab → search "recipe" → filter by category chip → sort.
- Expect: tiles with left color bar; selection mode with select bar actions (copy text, delete).

## Detail
- Steps: open an image → title, category, "Text in image" panel.
- Expect: text panel with copy/edit; AI editor buttons when AI configured ("Fix with AI", "Add emojis"); entities (link/e-mail/phone/date) as chips with copy/open; raw OCR disclosure when AI text exists.
- Zoom: tapping the image toggles zoom in-app.

## Categories
- Steps: create, rename, recolor, reorder, delete a category.
- Expect: list management works; fallback category cannot be deleted.

## Settings
- Steps: theme switch, app language (12), OCR language (12, all built in), OCR toggle, AI section.
- Expect: AI vision toggle with privacy warning (image leaves device); key save; export ZIP/JSON; restore merge/replace.

## Native (APK)
- Splash: one continuous launch — the system splash and the in-app launch screen show the same mark in the same place.
- No pinch zoom in APK; viewer zoom still works.
- Share from gallery → Shotrova; back button; system bars match theme.

## Automatic screenshot capture (v1.4.0, Android, opt-in)
- First run: consent sheet explains each permission and what the AI receives; nothing runs before the user opts in. Existing screenshot history is never imported — only new screenshots.
- Detection: MediaStore + WorkManager content-URI trigger (fast path, re-armed after each run) + 15-min periodic catch-up + BOOT_COMPLETED re-arm + catch-up on launch. No foreground service, no persistent notification.
- Copy: staged into app-private storage (original or compressed per setting) — survives gallery deletion. Dedupe by MediaStore id + SHA-256.
- AI (optional): with consent, background analysis with the user's own key (key encrypted with Android Keystore). Vision consent on → downscaled image; off → on-device ML Kit OCR text only. Failures (no key/quota/network) are queued as "Analysis pending" and retried.
- Notification per capture: title/category/thumbnail, tap opens the image. Home status card: On / Off / Missing permission / Battery restricted with one-tap fixes; partial media access (Android 14+) handled with "Allow all" guidance.
- Detail: "Captured automatically" badge, "Analysis pending" state, per-item "Don't send to AI" exclusion, "Also delete from phone" (system delete request, Android 11+, with confirmation).
- Xiaomi/HyperOS: "Background work settings" screen with step-by-step guidance; no reliability promises after force-stop/reboot — 15-min floor is an OS limit.
