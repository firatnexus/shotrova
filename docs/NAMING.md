# Ürün adı araştırması — Shotrova

Kontrol tarihi: **22 Ekim 2026**. Kapsam: Google Play, App Store, açık web, alan adı kayıtları (RDAP), WIPO Global Brand Database, TÜRKPATENT marka araştırması.

> **Önemli:** Bu bir hukuki görüş değildir. Bir aramada sonuç çıkmaması, adın yasal olarak kullanılabilir olduğunu **kanıtlamaz**. Marka tescil edilmedi, alan adı satın alınmadı, hiçbir platformda hesap açılmadı. Ürünü ticari olarak yayımlamadan önce bir marka vekiliyle resmi araştırma yaptırılmalıdır.

## Seçilen ad: Shotrova

- "Shot" (ekran görüntüsü) + "trove/rova" (hazine, keşif) çağrışımı; kısa, telaffuzu kolay, İngilizce.
- Kullanıcının isteğiyle ad İngilizce seçildi. Türkçe adaylar (Ekranot, Taranot, Ekranist, Pikselnot, Klipnot, Notakare, Snapbul, Ekrandex) ilk turda değerlendirilip elendi.
- Tüm marka ayarları tek dosyada: [`src/config/brand.ts`](../src/config/brand.ts). Manifest, HTML başlığı, ikonlar, depolama önekleri ve "Hakkında" bölümü buradan üretilir. Adı değiştirmek için bu dosyayı düzenleyip `npm run icons && npm run build` çalıştırmak yeterlidir. Not: `storagePrefix` değişirse uygulama boş bir veritabanıyla açılır; önce yedek alın.

## Yöntem

| Kaynak | Nasıl kontrol edildi | Durum |
|---|---|---|
| Alan adları | RDAP: `rdap.verisign.com` (.com/.net), `pubapi.registry.google` (.app), .io RDAP. HTTP 404 = kayıtlı değil | Doğrulandı (kontrol anında) |
| WIPO Global Brand Database | Basit, fonetik ve bulanık arama (bulut tarayıcı ile) | Doğrulandı |
| TÜRKPATENT | [Marka araştırma](https://www.turkpatent.gov.tr/arastirma-yap?form=trademark); arama işlevini doğrulamak için kontrol sorgusu "SNAP" = 306 kayıt | Doğrulandı |
| Google Play / App Store / web | Web araması + mağaza sayfaları | Doğrulandı (arama kapsamıyla sınırlı) |
| EUIPO / TMview (doğrudan) | Bulut tarayıcıda erişim engellendi | **Doğrulanmadı** |
| USPTO (doğrudan) | Yalnızca WIPO veritabanı üzerinden dolaylı | **Kısmen** |
| .com.tr | Kontrol edilmedi | **Doğrulanmadı** |
| TÜRKPATENT EPATS ayrıntılı benzerlik | e-Devlet girişi gerekiyor | **Doğrulanmadı** |

Ham veriler: [`docs/naming-evidence/`](naming-evidence/).

## Aday karşılaştırması

| Aday | .com / .app | WIPO tam eşleşme | TÜRKPATENT | Bulunan çakışmalar | Karar |
|---|---|---|---|---|---|
| **Shotrova** | İkisi de boş (.io, .net de boş) | Yok | Sonuç yok | Bulanık aramada en yakın: SHATROVA (İtalya, sınıf 3/12/14/20/25), TIOTROVA (Cezayir, sınıf 5); ikisi de yazılım sınıfı (9/42) değil | **Seçildi** |
| Sniplore | Boş | Yok | Sonuç yok | Benzer ürün: [Sniplo – Text Expander](https://chromewebstore.google.com/detail/sniplo-%E2%80%93-text-expander/pjiocjklennneaiihcacakicpphhggoo) | Yedek aday |
| ShotNook | Boş | Yok | Sonuç yok | "NOOK", Barnes & Noble'ın bilinen markası | Elendi |
| ShotTrove | Boş | Yok | Sonuç yok | [Trove · Visual Notes](https://apps.apple.com/pl/app/trove-visual-notes/id6770386643) aynı alanda | Elendi |
| ShotRecall | Boş | Yok | Sonuç yok | [RecallShot](https://apps.apple.com/kr/app/recallshot-photo-reminder/id6785822090), [SnapRecall](https://testflight.apple.com/join/9xqbQP4B) | Elendi |
| SiftShot | Boş | Yok | Sonuç yok | Aynı adlı ekran görüntüsü uygulaması: [App Store](https://apps.apple.com/us/app/siftshot/id6757947678), [Google Play](https://play.google.com/store/apps/details?id=com.devspera.siftshot), [Devspera](https://devspera.com/siftshot/) | Elendi |
| ShotSift | .app boş | Yok | — | [ShotSift (App Store)](https://apps.apple.com/ca/app/shotsift/id6758222349) | Elendi |
| ShotMind | .app boş | Yok | Sonuç yok | [shotmind.net](https://shotmind.net/en), [CodeCanyon'da ShotMind](https://codecanyon.net/item/shotmind-smart-screenshot-organizer-and-private-assistant-android-app/64934751) | Elendi |
| ShotCove | .app boş | Yok | — | [ShotCove (GitHub)](https://github.com/xacnio/shotcove) | Elendi |
| Pixlore | .app boş | Yok | — | [Pixlore AI Video (App Store)](https://apps.apple.com/pe/app/pixlore-ai-video-generator/id6756874159), [Google Play](https://play.google.com/store/apps/details?id=com.godhitech.ai.video.editor); ABD'de PIXLORA (8371557) | Elendi |
| ShotMemo | .app boş | Yok | — | [ShotMemory](https://apps.apple.com/tw/app/shotmemory-screenshot-reminder/id6771390521) | Elendi |
| PixRecall | .app boş | Yok | — | [Pixel Recall](https://pixelrecall.net/) | Elendi |

İlk turdaki diğer adaylar: Shotdex (mevcut ürün), Snaplore ([snaplore.com](https://snaplore.com) kayıtlı), Vizdex, Screva.

## Doğrulanmış / doğrulanmamış

- **Doğrulandı (22.10.2026):** shotrova.com ve shotrova.app kayıtlı değildi; WIPO'da "Shotrova" basit aramada kayıt yoktu; TÜRKPATENT'te "Shotrova" için sonuç yoktu; incelenen mağaza ve web sonuçlarında aynı adlı bir uygulama görülmedi.
- **Doğrulanmadı:** EUIPO ve TMview'de doğrudan arama, USPTO'da doğrudan arama, .com.tr, TÜRKPATENT EPATS benzerlik incelemesi, tescili olmayan ama kullanımda olan haklar.
- Alan adı durumu her an değişebilir.
