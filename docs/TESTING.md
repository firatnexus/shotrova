# Test sonuçları

Bu belgede yalnızca **gerçekten çalıştırılmış** testler "geçti" olarak listelenir. Çalıştırma tarihi: 22 Ekim 2026. Ortam: Linux, Node 20, Playwright 1.59.1 (Chromium).

## Özet

| Paket | Komut | Sonuç |
|---|---|---|
| Birim testleri (6 dosya) | `npm test` | **43 / 43 geçti** ([log](test-results/unit.log)) |
| Uçtan uca, kök dizin (`/`) | `npm run build && npm run test:e2e` | **34 / 34 geçti** (17 senaryo × 2 cihaz profili) ([JSON](test-results/e2e-root.json), [log](test-results/e2e-root.log)) |
| Uçtan uca, alt dizin (`/shotrova/`, GitHub Pages düzeni) | aşağıya bakın | **34 / 34 geçti** ([JSON](test-results/e2e-subpath.json), [log](test-results/e2e-subpath.log)) |

Cihaz profilleri:
- `android-pixel7`: Playwright'ın Pixel 7 profili (412×915, dokunmatik, Android Chrome user agent). Chromium üzerinde emülasyondur, gerçek bir Android cihaz değildir.
- `desktop-chromium`: 1280×860.

Her testte yakalanmamış bir sayfa hatası (`pageerror`) olursa test başarısız sayılır.

OCR testlerinde sahte veri kullanılmaz. Test görselleri (`scripts/make-fixtures.mjs`) gerçek metin içeren PNG, JPEG ve WebP dosyalarıdır ve tesseract.js gerçekten çalıştırılır.

## Senaryolar (spec'teki 15 iş akışı)

| # | Senaryo | Doğrulanan |
|---|---|---|
| 01 | İlk açılış | Başlık, boş durum, 11 varsayılan kategori, TR varsayılan, TR↔EN geçişi |
| 02 | Kategori yönetimi | Oluşturma, aynı adı reddetme, yeniden adlandırma (varsayılan kategoriler dahil), renk, sıralama, yeniden yüklemede kalıcılık, onaylı silme; "Kategorisiz" silinemez |
| 03–05 | Çoklu içe aktarma + OCR + otomatik kategori | 9 görsel (PNG/JPEG/WebP); Türkçe metin ("Fırın Makarna Tarifi", "rendelenmiş kaşar") ve İngilizce metin doğru okunur; kategori ve güven puanı atanır; yazısız görsel "yazı yok" + onay bekliyor olarak işaretlenir; orijinal dosyanın SHA-256 özeti değişmez |
| 06 | Düzeltmeden öğrenme | Elle düzeltme kaynağı "manuel" yapar ve onayı kaldırır; Ayarlar'da görünen kurallar oluşturur; kural silinebilir; yazısız görselde "yeterli yazı yok" uyarısı |
| 07 | Arama | Spec'teki örnek sorgular ("Makarna tarifi", "Geçen ay kaydettiğim adres", "Telefon ayarları", "Alışveriş ürünleri", "Faturalar", "İngilizce kelimeler"), büyük/küçük harf, Türkçe karakter katlama, dosya adı, vurgulama, sonuç yok durumu |
| 08 | Filtre ve toplu işlem | Kategori ve tarih filtresi, sıralama, çoklu seçim, toplu kategori atama, onaylı toplu silme |
| 09 | Ayrıntı düzenleme | Başlık, not, etiket ve OCR metni düzenleme; değişiklikler yeniden yüklemeden sonra korunur |
| 10 | Kopya tespiti | Aynı partide ve sonraki içe aktarmada aynı içerik atlanır; "mevcut olanı aç" bağlantısı gösterilir |
| 11 | Yedek ve geri yükleme | ZIP (görsellerle) ve JSON dışa aktarma, birleştirme ve değiştirme ile geri yükleme, görsellerin bayt bayt aynı dönmesi (SHA-256), ikinci birleştirmede kopyaların atlanması, API anahtarının yedeğe girmemesi, geçersiz yedeğin reddedilmesi |
| 12 | Kalıcılık | Yeniden yükleme ve yeni sekmede veriler yerinde |
| 13 | PWA | Manifest alanları, ikonlar, service worker kontrolü, `share_target`: gerçek bir multipart POST gezinmesi service worker tarafından alınır ve görsel içe aktarılır |
| 14 | Çevrimdışı | OCR dosyaları indirildikten sonra ağ kapalıyken uygulama açılır, "Çevrimdışı" rozeti görünür, OCR çalışır ve kategori atanır |
| 15 | Geçersiz dosyalar | PNG uzantılı metin dosyası, PDF, bozuk PNG, boş dosya: her biri için anlaşılır hata |
| 15b | OCR motoru hatası | Dil modeli indirilemezse durum "hata" olur ve "Tekrar dene" ile düzelir |
| 15c | Kota hatası | `QuotaExceededError` kullanıcıya bildirilir, yarım kayıt kalmaz, sonraki içe aktarma çalışır |
| + | Yapıştırma ve sürükle-bırak | Pano ve bırakma olaylarıyla içe aktarma |
| + | Tema | Açık ve koyu tema renkleri |

## Testler sırasında bulunan ve düzeltilen hatalar

- **OCR sonsuza kadar asılı kalıyordu.** Dil modeli indirilemediğinde tesseract.js `createWorker` sözünü reddetmiyor, hatayı yalnızca `errorHandler` ile bildiriyordu. Motor artık bu sinyali de dinliyor (`src/ocr/engine.ts`).
- **Yakalanmamış AbortError.** Bir IndexedDB işlemi iptal edildiğinde kardeş istekler işlenmemiş ret olarak kalıyordu. `txAll` yardımcısıyla düzeltildi (`src/db/db.ts`).
- **Ana sayfadaki "Son eklenenler" satırı.** `scroll-snap` nedeniyle ilk kart kesik başlıyordu; snap kaldırıldı.

## Görsel kontrol

390 px mobil ve masaüstü görünümler, açık ve koyu temada elle incelendi ([ekran görüntüleri](screenshots/)). İncelenen ekranlar: ana sayfa, görseller, ayrıntı, kategoriler, ayarlar, içe aktarma, arama.

## Burada test EDİLEMEYENLER (dürüst not)

- **Gerçek Android cihaz ve kurulum.** Bu ortamda KVM ya da emülatör yok. "Uygulamayı yükle", ana ekran ikonu ve Android paylaşım menüsünde Shotrova'nın görünmesi gerçek cihazda **denenmedi**. Paylaşım hedefi yalnızca service worker'a aynı POST isteği gönderilerek test edildi.
- **Safari / iOS ve Firefox.** Yalnızca Chromium çalıştırıldı. iOS Safari Web Share Target'ı desteklemez.
- **Gerçek kota dolması.** Kota hatası enjekte edilerek test edildi.
- **AI sağlayıcısı.** Gerçek bir API anahtarı olmadığı için uçtan uca test edilmedi; varsayılan olarak kapalıdır.
- **Erişilebilirlik.** Klavye ile gezinme, odak tuzağı ve ARIA etiketleri kodda var ve testler rol/etiket seçicileriyle çalışıyor, ancak otomatik bir a11y denetimi (axe) ya da ekran okuyucu testi yapılmadı.

## Gerçek cihazda elle test adımları

1. Uygulamayı HTTPS üzerinden açın (bkz. [DEPLOY.md](DEPLOY.md)).
2. Chrome menüsü → **Ana ekrana ekle** veya **Uygulamayı yükle**.
3. Ana ekrandaki Shotrova ikonundan açın; adres çubuğu olmadan açılmalı.
4. Galeri veya Dosyalar'da bir ekran görüntüsü seçin → **Paylaş** → **Shotrova**. Uygulama içe aktarma ekranında açılmalı.
5. Ayarlar → **Çevrimdışı için indir**, ardından uçak modu: uygulama açılmalı ve yeni görselin yazısı okunmalı.

## Testleri yeniden çalıştırma

```bash
npm ci --legacy-peer-deps
npx playwright install chromium
npm test
npm run build && npm run test:e2e

# Alt dizin (GitHub Pages) düzeni
VITE_BASE=/shotrova/ npx vite build --outDir /tmp/dist_base
PORT=4174 E2E_BASE=/shotrova/ E2E_DIST=/tmp/dist_base npx playwright test
```
