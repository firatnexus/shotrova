# Product name research — Shotrova

Checked on **22 October 2026**. Scope: Google Play, App Store, the open web, domain registries (RDAP), WIPO Global Brand Database, TÜRKPATENT trademark search.

> **Important:** This is not legal advice. The absence of search results does **not** prove that a name is legally available. No trademark was registered, no domain was purchased and no account was created on any platform. Before commercial publication, a formal clearance search should be done by a trademark attorney.

## Chosen name: Shotrova

- "Shot" (screenshot) + "trove/rova" (treasure, discovery); short, easy to pronounce, English.
- At the user's request the name is English. Turkish candidates (Ekranot, Taranot, Ekranist, Pikselnot, Klipnot, Notakare, Snapbul, Ekrandex) were considered in the first round and dropped.
- All brand settings live in one file: [`src/config/brand.ts`](../src/config/brand.ts). The manifest, HTML title, icons, storage prefixes and the "About" section are generated from it. Note: changing `storagePrefix` makes the app start with an empty database; make a backup first.
- **Android package id:** `io.github.firatnexus.shotrova` (debug builds: `io.github.firatnexus.shotrova.debug`). It is based on the GitHub Pages domain the project controls (`firatnexus.github.io`), so no domain had to be bought. The same id is used in `capacitor.config.json`, `android/app/build.gradle` and the Java package; `tests/unit/brand.test.ts` checks that they match. Changing the id after users have installed the APK makes Android treat it as a different app.

## Method

| Source | How it was checked | Status |
|---|---|---|
| Domains | RDAP: `rdap.verisign.com` (.com/.net), `pubapi.registry.google` (.app), .io RDAP. HTTP 404 = not registered | Verified (at check time) |
| WIPO Global Brand Database | Simple, phonetic and fuzzy search (cloud browser) | Verified |
| TÜRKPATENT | [Trademark search](https://www.turkpatent.gov.tr/arastirma-yap?form=trademark); control query "SNAP" = 306 records to confirm the search worked | Verified |
| Google Play / App Store / web | Web search + store pages | Verified (limited to search coverage) |
| EUIPO / TMview (direct) | Access blocked in the cloud browser | **Not verified** |
| USPTO (direct) | Only indirectly through the WIPO database | **Partial** |
| .com.tr | Not checked | **Not verified** |
| TÜRKPATENT EPATS detailed similarity | Requires e-Devlet login | **Not verified** |

Raw data: [`docs/naming-evidence/`](naming-evidence/).

## Candidate comparison

| Candidate | .com / .app | WIPO exact match | TÜRKPATENT | Conflicts found | Decision |
|---|---|---|---|---|---|
| **Shotrova** | Both free (.io, .net free too) | None | No results | Closest fuzzy matches: SHATROVA (Italy, classes 3/12/14/20/25), TIOTROVA (Algeria, class 5); neither in software classes (9/42) | **Chosen** |
| Sniplore | Free | None | No results | Similar product: [Sniplo – Text Expander](https://chromewebstore.google.com/detail/sniplo-%E2%80%93-text-expander/pjiocjklennneaiihcacakicpphhggoo) | Backup candidate |
| ShotNook | Free | None | No results | "NOOK" is a well-known Barnes & Noble mark | Dropped |
| ShotTrove | Free | None | No results | [Trove · Visual Notes](https://apps.apple.com/pl/app/trove-visual-notes/id6770386643) in the same space | Dropped |
| ShotRecall | Free | None | No results | [RecallShot](https://apps.apple.com/kr/app/recallshot-photo-reminder/id6785822090), [SnapRecall](https://testflight.apple.com/join/9xqbQP4B) | Dropped |
| SiftShot | Free | None | No results | Screenshot app with the same name: [App Store](https://apps.apple.com/us/app/siftshot/id6757947678), [Google Play](https://play.google.com/store/apps/details?id=com.devspera.siftshot), [Devspera](https://devspera.com/siftshot/) | Dropped |
| ShotSift | .app free | None | — | [ShotSift (App Store)](https://apps.apple.com/ca/app/shotsift/id6758222349) | Dropped |
| ShotMind | .app free | None | No results | [shotmind.net](https://shotmind.net/en), [ShotMind on CodeCanyon](https://codecanyon.net/item/shotmind-smart-screenshot-organizer-and-private-assistant-android-app/64934751) | Dropped |
| ShotCove | .app free | None | — | [ShotCove (GitHub)](https://github.com/xacnio/shotcove) | Dropped |
| Pixlore | .app free | None | — | [Pixlore AI Video (App Store)](https://apps.apple.com/pe/app/pixlore-ai-video-generator/id6756874159), [Google Play](https://play.google.com/store/apps/details?id=com.godhitech.ai.video.editor); PIXLORA in the US (8371557) | Dropped |
| ShotMemo | .app free | None | — | [ShotMemory](https://apps.apple.com/tw/app/shotmemory-screenshot-reminder/id6771390521) | Dropped |
| PixRecall | .app free | None | — | [Pixel Recall](https://pixelrecall.net/) | Dropped |

Other first-round candidates: Shotdex (existing product), Snaplore ([snaplore.com](https://snaplore.com) registered), Vizdex, Screva.

## Verified / not verified

- **Verified (22 Oct 2026):** shotrova.com and shotrova.app were not registered; WIPO simple search had no record for "Shotrova"; TÜRKPATENT returned no results for "Shotrova"; no app with the same name appeared in the store and web results reviewed.
- **Not verified:** direct EUIPO and TMview search, direct USPTO search, .com.tr, TÜRKPATENT EPATS similarity review, unregistered rights in use.
- Domain status can change at any time.
