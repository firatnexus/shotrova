# Derleme ve yayınlama

## Gereksinimler

- Node.js 20 veya üzeri
- npm. Bağımlılıklar `--legacy-peer-deps` ile kurulmalı (vite 8 ile `@vitejs/plugin-react` arasındaki peer uyarısı nedeniyle).

## Yerel geliştirme

```bash
npm ci --legacy-peer-deps
npm run dev            # http://localhost:5173 (OCR dosyaları otomatik kopyalanır)
```

Service worker yalnızca üretim derlemesinde kaydedilir.

## Üretim derlemesi

```bash
npm run build          # tsc -b && vite build → dist/
npm run preview        # dist/ klasörünü http://localhost:4173 adresinde sunar
```

`dist/` klasöründeki her şey statiktir: HTML, JS, CSS, ikonlar, `manifest.webmanifest`, `sw.js` ve yaklaşık 17 MB'lık `ocr/` klasörü (WASM çekirdeği ile `tur` ve `eng` modelleri). Herhangi bir statik barındırma yeterlidir.

### Alt dizinde yayınlama

Uygulama bir alt dizinde çalışacaksa (örneğin `https://kullanici.github.io/shotrova/`), `VITE_BASE` ayarlanmalıdır:

```bash
VITE_BASE=/shotrova/ npm run build
```

Manifest (`start_url`, `scope`, `share_target.action`, ikonlar), service worker kapsamı ve yazı tipi adresleri bu değere göre üretilir. Bu düzen de uçtan uca test edildi (bkz. [TESTING.md](TESTING.md)).

## Barındırma gereksinimleri

- **HTTPS zorunlu.** Service worker, kurulum ve paylaşım hedefi yalnızca HTTPS'de (veya `localhost`'ta) çalışır.
- `sw.js` ve `index.html` için önbellek süresi kısa olmalı (`Cache-Control: no-cache`). Böylece güncellemeler hemen görünür. `assets/` altındaki dosyaların adları içerik özetiyle oluşturulduğundan bunlar uzun süre önbelleklenebilir.
- `.wasm` dosyaları `application/wasm` türüyle sunulmalı.
- Paylaşım hedefi bir POST isteğidir ve service worker tarafından yakalanır, yani sunucu tarafında kod gerekmez. Service worker henüz etkin değilse sunucu `share-target` adresine gelen POST isteğine hata (404 veya 405) dönebilir; uygulamayı bir kez açmak bunu çözer.

## GitHub Pages (CI)

`.github/workflows/ci.yml` her `main` gönderiminde şunları yapar:

1. Birim testlerini çalıştırır.
2. Üretim derlemesini alır ve E2E testlerini çalıştırır.
3. `/<depo-adı>/` alt diziniyle yeniden derler ve E2E testlerini bu düzende tekrar çalıştırır.
4. Sonucu GitHub Pages'e yükler.

Bir kez yapılacak ayar: depo **Settings → Pages → Source: GitHub Actions**. Not: GitHub'ın ücretsiz planında Pages yalnızca herkese açık depolarda kullanılabilir.

## Android'e kurulum (kullanıcı için)

1. Uygulamanın HTTPS adresini Android'de **Chrome** ile açın.
2. Menü (⋮) → **Uygulamayı yükle** veya **Ana ekrana ekle**.
3. Shotrova artık ana ekranda ve uygulama listesinde ayrı bir uygulama olarak görünür ve tam ekran açılır.
4. **Paylaş** menüsünden ekran görüntüsü göndermek için uygulamanın yüklenmiş olması gerekir. Galeri → görsel(ler) → Paylaş → Shotrova.
5. Çevrimdışı OCR için: Ayarlar → **Çevrimdışı için indir**.

Uygulama içinde de aynı adımlar var: Ayarlar → Android'e yükleme.

## Ad değişikliği

[`src/config/brand.ts`](../src/config/brand.ts) dosyasını düzenleyin, ardından `npm run icons && npm run build` çalıştırın. Ayrıntılar için bkz. [NAMING.md](NAMING.md).
