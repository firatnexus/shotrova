# Shotrova

Ekran görüntülerini düzenleyen, aramayı kolaylaştıran ve tamamen cihazda çalışan bir PWA. Görsellerdeki Türkçe ve İngilizce yazıyı **cihazda** okur (gerçek OCR, tesseract.js), görselleri kategorilere ayırır ve içlerindeki yazıyla bulmanızı sağlar. Android'de uygulama olarak yüklenebilir ve galeriden **Paylaş → Shotrova** ile görsel alabilir.

| Mobil, açık tema | Mobil, koyu tema: arama | Masaüstü |
|---|---|---|
| ![Ana sayfa](docs/screenshots/mobile-light-dashboard.png) | ![Arama](docs/screenshots/mobile-dark-search.png) | ![Masaüstü](docs/screenshots/desktop-light-dashboard.png) |

## Özellikler

- **İçe aktarma:** galeriden çoklu seçim, dosya seçici, sürükle-bırak, pano (Ctrl+V veya "Panodan yapıştır") ve Android paylaşım menüsü. JPEG, PNG ve WebP desteklenir. Dosyalar doğrulanır, kopyalar SHA-256 özetiyle tespit edilir, ilerleme ve dosya bazlı hatalar gösterilir.
- **Cihazda OCR:** Türkçe + İngilizce. Görsel başına durum gösterilir (sırada, işleniyor, tamam, yazı yok, hata), hata olursa yeniden denenebilir. Değişmeyen görseller tekrar işlenmez. Okunan metin düzenlenebilir ve orijinal görsel hiç değiştirilmez.
- **Kategoriler:** 11 varsayılan kategori. Kategoriler oluşturulabilir, yeniden adlandırılabilir, renklendirilebilir, sıralanabilir ve silinebilir. Otomatik kategorileme anahtar kelimelere dayanır ve güven puanı verir; emin olunmayan görseller onaya düşer. Düzeltmelerinizden **görünür ve silinebilir** kurallar öğrenilir.
- **İsteğe bağlı AI:** OpenAI uyumlu bir sağlayıcı kendi anahtarınızla eklenebilir. Bu durumda sağlayıcıya yalnızca OCR metni gider; anahtar kaynak koduna ya da yedeğe girmez.
- **Arama:** OCR metni, başlık, not, etiket, kategori ve dosya adında **metin tabanlı** arama (anlamsal değil). Türkçe karakter toleransı vardır; "geçen ay" gibi tarih ifadeleri ve kategori adları filtreye çevrilir; eşleşmeler vurgulanır.
- **Ekranlar:** Ana sayfa, Görseller (filtre, sıralama, çoklu seçim, toplu işlem), Ayrıntı, Kategoriler, Ayarlar.
- **Tasarım:** mobil öncelikli; açık/koyu tema; klavye erişimi; azaltılmış hareket desteği; iskelet yükleme, boş durumlar, bildirimler ve onay pencereleri.
- **Gizlilik:** sunucu, hesap ve analitik yok; her şey IndexedDB'de durur. ZIP (görsellerle) veya JSON yedekleme ve doğrulamalı geri yükleme.
- **PWA:** kurulabilir, çevrimdışı çalışır (OCR dosyaları önceden indirilebilir), Web Share Target desteği var.
- **Dil:** Türkçe (varsayılan) ve İngilizce.

## Hızlı başlangıç

```bash
npm ci --legacy-peer-deps
npm run dev                 # geliştirme
npm run build && npm run preview   # üretim derlemesi → http://localhost:4173
npm test                    # birim testleri
npm run test:e2e            # Playwright uçtan uca testleri (önce build)
```

Yayınlama ve Android kurulumu: [docs/DEPLOY.md](docs/DEPLOY.md)

## Belgeler

- [Mimari](docs/ARCHITECTURE.md)
- [Test sonuçları](docs/TESTING.md): birim 43/43, E2E 34/34 (kök dizin) ve 34/34 (alt dizin); hepsi gerçekten çalıştırıldı
- [Ad araştırması](docs/NAMING.md)
- [Derleme ve yayınlama](docs/DEPLOY.md)

## Sınırlamalar

- **Galeri otomatik izlenmez.** Bir web uygulaması, telefonun galerisini veya başka uygulamaların kaydettiği ekran görüntülerini arka planda göremez. Görselleri sizin seçmeniz ya da paylaşmanız gerekir.
- **Tarayıcı depolaması kalıcı değildir.** Tarayıcı verilerini temizlerseniz veya cihazda yer azalırsa veriler silinebilir. Düzenli yedek alın.
- **OCR doğruluğu** görselin netliğine bağlıdır; el yazısı, çok küçük veya süslü yazılar hatalı okunabilir. İlk OCR için yaklaşık 17 MB dosya indirilir.
- **Görsel içerik anlaşılmaz.** Kategorileme yalnızca okunan yazıya dayanır. Yazısız bir fotoğrafın içeriği tahmin edilmez; böyle görseller "Kategorisiz" olarak onaya düşer.
- **Arama metin tabanlıdır,** anlamsal değildir. Küçük bir TR↔EN eş anlamlı tablosu dışında eş anlamlıları bilmez.
- **Paylaşım hedefi** yalnızca uygulama yüklendikten sonra ve yalnızca Chromium tabanlı Android tarayıcılarında çalışır. iOS Safari bunu desteklemez.
- **Gerçek cihaz testi yapılmadı.** Testler Chromium'da Pixel 7 emülasyonuyla çalıştırıldı; ayrıntılar [TESTING.md](docs/TESTING.md) dosyasında.
- **Ad için hukuki garanti yok.** Bkz. [NAMING.md](docs/NAMING.md).

## Lisans

MIT, bkz. [LICENSE](LICENSE). Üçüncü taraf bileşenler: [tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0), Tesseract dil modelleri `@tesseract.js-data/tur` ve `eng` (Apache-2.0 / MIT), [Satoshi yazı tipi](https://www.fontshare.com/fonts/satoshi) (ITF Free Font License), React (MIT), idb (ISC), fflate (MIT).
