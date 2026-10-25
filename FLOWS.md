# Main flows (v1.1.0 → v1.2.0 redesign)

Checked after every edit. Names are user-visible text.

## Launch
- Start: index.html
- Expect: branded boot splash (logo + name) while storage loads, then home screen; no uncaught errors.
- Android: the native launch splash (background + icon) stays on screen until the web layer paints its first usable frame (markFirstFrame, 3s safety cap) — a single splash, the PWA boot screen never stacks on top of it.

## Home / dashboard
- Expect: hero dropzone with "Görsel ekle" and "Panodan yapıştır" buttons, recent strip, category chips, compact stats.
- 11 default categories visible on home (as chips/cards).

## Import an image
- Steps: "Görsel ekle" → pick fixture → OCR runs → toast "1 görsel eklendi".
- Expect: image appears in library; OCR text extracted; category auto-assigned.

## Library
- Steps: open "Görseller" tab → search "tarif" → filter by category chip → sort.
- Expect: tiles with left color bar; selection mode with select bar actions (copy text, delete).

## Detail
- Steps: open an image → title, category, "Görseldeki yazı" panel.
- Expect: text panel with copy/edit; AI editor buttons when AI configured ("Yapay zekâ ile düzenle", "Emoji ekle"); entities (link/e-posta/telefon/tarih) as chips with copy/open; raw OCR disclosure when AI text exists.
- Zoom: tapping the image toggles zoom in-app.

## Categories
- Steps: create, rename, recolor, reorder, delete a category.
- Expect: list management works; fallback category cannot be deleted.

## Settings
- Steps: theme switch, language switch, OCR toggle, AI section.
- Expect: AI vision toggle with privacy warning (image leaves device); key save; export ZIP/JSON; restore merge/replace.

## Native (APK)
- Splash: one splash on every platform — Android keeps the native launch splash until the app's first frame (no second web splash); web/PWA shows the boot splash while storage loads.
- No pinch zoom in APK; viewer zoom still works.
- Share from gallery → Shotrova; back button; system bars match theme.

## Automatic screenshot capture (v1.4.0, Android, opt-in)
- First run: consent sheet explains each permission and what the AI receives; nothing runs before the user opts in. Existing screenshot history is never imported — only new screenshots.
- Detection: MediaStore + WorkManager content-URI trigger (fast path, re-armed after each run) + 15-min periodic catch-up + BOOT_COMPLETED re-arm + catch-up on launch. No foreground service, no persistent notification.
- Copy: staged into app-private storage (original or compressed per setting) — survives gallery deletion. Dedupe by MediaStore id + SHA-256.
- AI (optional): with consent, background analysis with the user's own key (key encrypted with Android Keystore). Vision consent on → downscaled image; off → on-device ML Kit OCR text only. Failures (no key/quota/network) are queued as "Analiz bekliyor" and retried.
- Notification per capture: title/category/thumbnail, tap opens the image. Home status card: Açık / Kapalı / İzin eksik / Pil kısıtı var with one-tap fixes; partial media access (Android 14+) handled with "Tümüne izin ver" guidance.
- Detail: "Otomatik alındı" badge, "Analiz bekliyor" state, per-item "Yapay zekaya gönderme" exclusion, "Telefondan da sil" (system delete request, Android 11+, with confirmation).
- Xiaomi/HyperOS: "Arka plan çalışma ayarları" screen with step-by-step guidance; no reliability promises after force-stop/reboot — 15-min floor is an OS limit.
