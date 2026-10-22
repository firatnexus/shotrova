import type { Category } from '../db/types';

export const FALLBACK_CATEGORY_ID = 'uncategorized';

export interface DefaultCategory {
  id: string;
  nameKey: string;
  color: string;
  /**
   * Built-in Turkish + English keywords. They are matched after folding
   * (ç→c, ı→i …) with suffix tolerance, so "tarifi", "tarifler" match "tarif".
   * Weight 2 = strong signal, 1 = weak signal.
   */
  keywords: Record<string, 1 | 2>;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    id: 'recipes', nameKey: 'cat.recipes', color: '#D9480F',
    keywords: {
      tarif: 2, malzeme: 2, malzemeler: 2, yemek: 1, pisir: 2, firin: 2, derece: 1, dakika: 1, makarna: 2, corba: 2, tatli: 2,
      kek: 2, hamur: 2, sos: 1, tuz: 1, seker: 1, un: 1, yumurta: 2, sut: 1, tereyag: 2, zeytinyag: 2, sogan: 2, sarimsak: 2,
      domates: 1, biber: 1, kasik: 2, bardak: 2, gram: 1, salata: 2, kofte: 2, tavuk: 1, porsiyon: 2, haslan: 2, kavur: 2,
      recipe: 2, ingredients: 2, ingredient: 2, bake: 2, oven: 2, tbsp: 2, tsp: 2, cup: 1, cups: 1, flour: 2, sugar: 1, butter: 2,
      eggs: 2, garlic: 2, onion: 2, pasta: 2, sauce: 1, simmer: 2, boil: 2, minutes: 1, servings: 2, preheat: 2, cook: 1,
    },
  },
  {
    id: 'shopping', nameKey: 'cat.shopping', color: '#C2255C',
    keywords: {
      sepet: 2, sepete: 2, indirim: 2, fiyat: 2, kargo: 2, siparis: 2, urun: 2, satin: 2, odeme: 1, kampanya: 2, stok: 2, beden: 2,
      renk: 1, tl: 1, '₺': 2, kupon: 2, magaza: 2, ucretsiz: 1, teslimat: 2, iade: 1, firsat: 2, adet: 1, marka: 1, puan: 1,
      cart: 2, checkout: 2, price: 2, discount: 2, sale: 2, shipping: 2, order: 1, product: 2, buy: 2, stock: 2, size: 1,
      shop: 2, store: 1, coupon: 2, delivery: 2, add: 1, usd: 1, eur: 1, wishlist: 2, deal: 2, reviews: 1,
    },
  },
  {
    id: 'places', nameKey: 'cat.places', color: '#2B8A3E',
    keywords: {
      adres: 2, mahalle: 2, mah: 2, cadde: 2, cad: 2, sokak: 2, sok: 2, no: 1, kat: 1, daire: 1, ilce: 2, il: 1, posta: 1,
      konum: 2, harita: 2, yol: 1, tarifi: 1, restoran: 2, kafe: 2, acik: 1, kapali: 1, saatleri: 1, mersin: 1, istanbul: 1,
      ankara: 1, izmir: 1, bulvar: 2, bulvari: 2, apt: 2, apartmani: 2, plaza: 1, merkez: 1,
      address: 2, street: 2, st: 1, avenue: 2, ave: 2, road: 1, rd: 1, suite: 2, zip: 2, location: 2, map: 2, maps: 2,
      directions: 2, restaurant: 2, cafe: 2, open: 1, hours: 1, floor: 1, city: 1, near: 1,
    },
  },
  {
    id: 'travel', nameKey: 'cat.travel', color: '#1971C2',
    keywords: {
      ucus: 2, bilet: 2, havalimani: 2, havaalani: 2, otel: 2, rezervasyon: 2, pnr: 2, kapi: 1, koltuk: 1, bagaj: 2, kalkis: 2,
      varis: 2, gidis: 2, donus: 2, pasaport: 2, vize: 2, tatil: 2, gece: 1, konaklama: 2, otobus: 1, tren: 1, sefer: 2, check: 1,
      flight: 2, boarding: 2, airport: 2, hotel: 2, booking: 2, reservation: 2, gate: 1, seat: 1, baggage: 2, departure: 2,
      arrival: 2, passport: 2, visa: 2, trip: 2, itinerary: 2, terminal: 2, airline: 2, nights: 1, checkin: 2,
    },
  },
  {
    id: 'documents', nameKey: 'cat.documents', color: '#5F3DC4',
    keywords: {
      fatura: 2, fis: 2, makbuz: 2, dekont: 2, kdv: 2, toplam: 2, tutar: 2, odeme: 1, vergi: 2, tarih: 1, belge: 2, sozlesme: 2,
      iban: 2, banka: 2, hesap: 1, abonelik: 1, son: 1, borc: 2, tahsilat: 2, sgk: 2, tc: 1, kimlik: 2, imza: 2, nakit: 1, kart: 1,
      invoice: 2, receipt: 2, total: 2, subtotal: 2, tax: 2, vat: 2, amount: 2, payment: 1, due: 1, bill: 2, document: 2,
      contract: 2, account: 1, bank: 2, statement: 2, paid: 2, balance: 2, signature: 2, id: 1,
    },
  },
  {
    id: 'conversations', nameKey: 'cat.conversations', color: '#0B7285',
    keywords: {
      mesaj: 2, yaziyor: 2, cevrimici: 2, goruldu: 2, sohbet: 2, grup: 1, whatsapp: 2, telegram: 2, dm: 2, yanitla: 2, yanit: 1,
      merhaba: 1, selam: 1, tamam: 1, nasilsin: 2, tesekkurler: 1, dun: 1, bugun: 1, sesli: 1, cevapla: 2,
      message: 2, messages: 2, typing: 2, online: 1, seen: 2, chat: 2, reply: 2, replied: 2, sent: 1, delivered: 1, read: 1,
      hey: 1, hello: 1, thanks: 1, lol: 2, ok: 1, yesterday: 1, today: 1, imessage: 2, messenger: 2,
    },
  },
  {
    id: 'technology', nameKey: 'cat.technology', color: '#364FC7',
    keywords: {
      ayarlar: 2, ayar: 2, telefon: 2, uygulama: 2, guncelleme: 2, sistem: 1, wifi: 2, bluetooth: 2, sifre: 1, depolama: 2, pil: 2,
      batarya: 2, ekran: 1, bildirim: 2, gizlilik: 1, kod: 2, hata: 2, yazilim: 2, bilgisayar: 2, internet: 1, android: 2, ios: 2,
      settings: 2, setting: 2, phone: 2, app: 1, update: 2, system: 1, battery: 2, storage: 2, notification: 2, notifications: 2,
      code: 2, error: 2, function: 2, const: 2, install: 2, download: 1, software: 2, developer: 2, api: 2, github: 2, terminal: 1,
      npm: 2, python: 2, javascript: 2, server: 2, version: 1, device: 2, network: 1, display: 1,
    },
  },
  {
    id: 'learning', nameKey: 'cat.learning', color: '#E67700',
    keywords: {
      ders: 2, kelime: 2, kelimeler: 2, anlam: 2, anlami: 2, ingilizce: 2, gramer: 2, ornek: 1, cumle: 2, soru: 1, cevap: 1, sinav: 2,
      ogren: 2, egitim: 2, kurs: 2, not: 1, formul: 2, konu: 1, unite: 2, kitap: 1, ozet: 2, tanim: 2, ceviri: 2, eylem: 1, fiil: 2,
      lesson: 2, word: 1, words: 2, vocabulary: 2, meaning: 2, grammar: 2, example: 1, sentence: 2, quiz: 2, exam: 2, learn: 2,
      course: 2, chapter: 2, definition: 2, translation: 2, verb: 2, noun: 2, adjective: 2, synonym: 2, study: 2, tips: 1,
    },
  },
  {
    id: 'entertainment', nameKey: 'cat.entertainment', color: '#AE3EC9',
    keywords: {
      film: 2, dizi: 2, bolum: 2, sezon: 2, izle: 2, fragman: 2, oyuncu: 1, sarki: 2, muzik: 2, albüm: 2, album: 2, konser: 2,
      sinema: 2, vizyon: 2, imdb: 2, netflix: 2, spotify: 2, youtube: 2, podcast: 2, kitap: 1, meme: 2, komik: 2, video: 1,
      movie: 2, series: 2, episode: 2, season: 2, watch: 2, trailer: 2, actor: 1, song: 2, music: 2, concert: 2, cinema: 2,
      playlist: 2, artist: 1, show: 1, tickets: 1, funny: 2, followers: 1, likes: 1, reels: 2,
    },
  },
  {
    id: 'games', nameKey: 'cat.games', color: '#2F9E44',
    keywords: {
      oyun: 2, seviye: 2, skor: 2, puan: 1, gorev: 2, karakter: 1, oyuncu: 1, ganimet: 2, turnuva: 2, sezon: 1, sandik: 2,
      game: 2, level: 2, score: 2, quest: 2, achievement: 2, player: 2, victory: 2, defeat: 2, xp: 2, loot: 2, rank: 2, ranked: 2,
      match: 1, steam: 2, playstation: 2, xbox: 2, nintendo: 2, boss: 2, inventory: 2, gameplay: 2, multiplayer: 2, wins: 1,
    },
  },
  { id: FALLBACK_CATEGORY_ID, nameKey: 'cat.uncategorized', color: '#868E96', keywords: {} },
];

export const DEFAULT_KEYWORDS: Record<string, Record<string, 1 | 2>> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.id, c.keywords]),
);

export function buildDefaultCategories(now = Date.now()): Category[] {
  return DEFAULT_CATEGORIES.map((c, i) => ({
    id: c.id,
    nameKey: c.nameKey,
    color: c.color,
    order: i,
    keywords: [],
    builtIn: true,
    isFallback: c.id === FALLBACK_CATEGORY_ID,
    createdAt: now,
    updatedAt: now,
  }));
}

/** Palette offered when users create or recolour categories. */
export const CATEGORY_COLORS = [
  '#D9480F', '#C2255C', '#AE3EC9', '#5F3DC4', '#364FC7', '#1971C2', '#0B7285', '#087F5B',
  '#2B8A3E', '#5C940D', '#E67700', '#868E96',
];
