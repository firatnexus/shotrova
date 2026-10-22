# Mimari özeti

Shotrova, tamamen istemci tarafında çalışan bir PWA'dır. Sunucusu, hesabı ya da analitiği yoktur. Görseller, OCR metni ve ayarlar tarayıcının IndexedDB deposunda kalır.

## Teknoloji

| Katman | Seçim | Neden |
|---|---|---|
| Arayüz | React 19 + TypeScript (strict) | Bileşen modeli, sıkı tipler |
| Derleme | Vite 8 | Hızlı derleme, kod bölme (tesseract ayrı parça) |
| Veri | IndexedDB, `idb` sarmalayıcısıyla | Büyük ikili veri (Blob) ve indeksler |
| OCR | tesseract.js 7 (WASM, LSTM) + `tur` ve `eng` modelleri | Gerçek, cihaz üzerinde metin tanıma |
| Yedek | `fflate` (ZIP) | Küçük, bağımlılıksız |
| Testler | Vitest + fake-indexeddb, Playwright | Birim ve uçtan uca testler |

Çalışma zamanı bağımlılıkları yalnızca şunlar: `react`, `react-dom`, `idb`, `tesseract.js`, `fflate`. Router, durum yönetimi, i18n ve ikonlar elle yazıldı.

## Klasörler

```
src/
  config/brand.ts      Tüm marka ayarları (ad, renkler, logo SVG, depolama öneki)
  db/                  Şema, tipler, IndexedDB erişimi (kota hatası yakalama dahil)
  import/              Dosya doğrulama (sihirli baytlar, boyut, bozuk görsel), küçük resim
  ocr/engine.ts        tesseract.js çalışanı; tembel yükleme, dil değişimi, boşta kapatma
  categorize/          Varsayılan 11 kategori + anahtar kelimeler, puanlama, öğrenilen kurallar, isteğe bağlı AI
  search/              Türkçe karakter katlama, sorgu ayrıştırma (tarih/kategori), puanlama
  backup/              ZIP/JSON dışa aktarma, doğrulama, birleştirme/değiştirme ile geri yükleme
  lib/                 Uygulama durumu (store), eylemler (içe aktarma, OCR kuyruğu), bildirimler
  i18n/                tr.json (varsayılan), en.json
  pwa/sw.template.js   Service worker şablonu (derlemede dist/sw.js olur)
  ui/                  Ekranlar, bileşenler, hash router, stiller (açık/koyu tema)
scripts/               OCR dosyalarını kopyalama, ikon üretimi, statik sunucu, test görselleri
tests/unit, tests/e2e  Birim ve Playwright testleri
```

## Veri modeli

- `images`: meta veri (başlık, not, etiketler, OCR metni ve durumu, kategori, güven puanı, nedenler, `needsReview`, SHA-256 özeti, `searchTokens` çoklu indeksi).
- `blobs`: orijinal dosya (bayt bayt korunur) ve WebP küçük resim. Kayıt ve görsel aynı işlemde yazılır; biri başarısız olursa işlem geri alınır ve yarım kayıt kalmaz.
- `categories`, `rules` (düzeltmelerden öğrenilen kurallar), `settings`.

## Ana akışlar

1. **İçe aktarma.** Galeri çoklu seçimi, dosya seçici, sürükle-bırak, pano (Ctrl+V ve "Panodan yapıştır"), Android paylaşım hedefi. Her dosya şu sırayla işlenir: biçim kontrolü (JPEG/PNG/WebP, uzantıya değil sihirli baytlara bakılır), en fazla 40 MB, boş dosya, çözülebilirlik, SHA-256 ile kopya tespiti. İlerleme ve dosya bazlı hatalar gösterilir. Uygulama galerinin tamamına erişim istemez; yalnızca kullanıcının seçtiği dosyaları görür.
2. **OCR kuyruğu.** Görseller tek tek işlenir. `ocrSourceHash === hash` ise görsel yeniden işlenmez. Durumlar: sırada, işleniyor, tamam, yazı yok, hata. Hata durumunda "Tekrar dene" vardır. Dil indirme hatası tesseract'ta yalnızca `errorHandler` ile bildirildiği için motor bu sinyali de dinler; aksi halde işlem sonsuza kadar asılı kalırdı.
3. **Kategorileme.** Kelime tabanlıdır. OCR metni katlanır, durak kelimeler atılır, her kategorinin ağırlıklı anahtar kelimeleri ve öğrenilen kurallar puanlanır. Güven puanı, kazanan ile ikinci arasındaki farktan hesaplanır. Eşiğin altındaysa görsel "onay bekleyen" olarak işaretlenir. 3'ten az anlamlı kelime varsa otomatik karar verilmez. Kullanıcı bir kategoriyi düzelttiğinde metindeki ayırt edici kelimeler için görünür kurallar oluşturulur (Ayarlar → Öğrenilen kurallar; buradan silinebilir).
4. **İsteğe bağlı AI.** OpenAI uyumlu bir uç nokta kullanılabilir. Anahtarı kullanıcı girer; anahtar yalnızca bu tarayıcının IndexedDB'sinde durur, dışa aktarmaya dahil edilmez ve kaynak koduna gömülmez. Gönderilen tek şey OCR metni (en fazla 2000 karakter) ve kategori adlarıdır; görsel gönderilmez. Uygulama görsel içeriği anladığını iddia etmez.
5. **Arama.** Metin tabanlıdır, anlamsal değildir. OCR metni, başlık, not, etiket, kategori adı ve dosya adı üzerinde çalışır. Türkçe karakterler katlanır (ı/i, ş/s, ğ/g…), basit ek toleransı vardır ("tarifi" sorgusu "tarif" kelimesini bulur), küçük bir TR↔EN eş anlamlı tablosu bulunur ("İngilizce kelimeler" sorgusu "English vocabulary" metnini bulur). "geçen ay", "son 7 gün", "dün" gibi tarih ifadeleri ve kategori adları filtreye çevrilir. Eşleşmeler vurgulanır.
6. **PWA.** Manifest, standalone mod, maskable ve monokrom ikonlar, kısayollar ve `share_target` (POST, multipart). Service worker uygulama kabuğunu önbelleğe alır, gezinmelerde önce ağı dener ve 3 saniyede yanıt gelmezse önbelleğe döner. OCR dosyaları önbellekten sunulur ("Çevrimdışı için indir" ile önceden indirilebilir, yaklaşık 17 MB). Paylaşılan dosyalar Cache Storage'daki geçici bir gelen kutusuna konur ve uygulama `#/import?shared=N` adresinde açılır.

## Gizlilik

Ağa giden tek istek, uygulamanın kendi dosyalarıdır. Bunun tek istisnası, kullanıcı açıkça etkinleştirirse AI sağlayıcısıdır. Tarayıcı depolaması kalıcı değildir: tarayıcı verisi temizlenirse veya yer azalırsa silinebilir. Ayarlar ekranından `navigator.storage.persist()` ile kalıcı depolama istenebilir, ama tarayıcı bunu reddedebilir ve bu da bir garanti değildir. Düzenli yedek önerilir.
