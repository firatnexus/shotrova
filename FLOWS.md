# Main flows (v1.1.0 → v1.2.0 redesign)

Checked after every edit. Names are user-visible text.

## Launch
- Start: index.html
- Expect: branded boot splash (logo + name) while storage loads, then home screen; no uncaught errors.

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
- Splash: launch shows branded splash (background + icon) then app.
- No pinch zoom in APK; viewer zoom still works.
- Share from gallery → Shotrova; back button; system bars match theme.
