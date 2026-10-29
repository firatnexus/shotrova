#!/usr/bin/env python3
"""Renders one screenshot-like PNG per OCR language for tests/ocr (needs Pillow with raqm + Noto fonts)."""
import json, os
from PIL import Image, ImageDraw, ImageFont, features

assert features.check('raqm'), 'Pillow needs libraqm for Arabic/Devanagari shaping'
OUT = os.path.join(os.path.dirname(__file__), '..', 'tests', 'fixtures', 'ocr')
LATIN = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
CJK = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
SAMPLES = {
    'eng': (LATIN, None, ['Flight confirmation', 'Booking code: KX4821', 'Departure 10:45 Gate B12']),
    'tur': (LATIN, None, ['Kremalı makarna tarifi', 'Malzemeler: süt, şeker, ığdır', 'Fatura toplamı 1.250 TL']),
    'spa': (LATIN, None, ['Receta de paella', 'Añadir el azúcar y la sal', 'Reserva confirmada mañana']),
    'fra': (LATIN, None, ['Réservation confirmée', 'Hôtel près de la gare', 'Numéro de facture 2045']),
    'deu': (LATIN, None, ['Rechnung für März', 'Größe: mittel, Straße 12', 'Öffnungszeiten täglich']),
    'por': (LATIN, None, ['Confirmação da reserva', 'Lista de compras: pão, maçã', 'Ação válida até junho']),
    'ita': (LATIN, None, ['Ricetta della nonna', 'Città: Firenze, perché no', 'Prenotazione confermata']),
    'rus': (LATIN, None, ['Расписание поездов', 'Москва Казань', 'Номер заказа 4821']),
    'hin': ('/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf', None, ['नमस्ते दुनिया', 'बैठक का समय', 'आज का मौसम']),
    'ara': ('/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf', 'rtl', ['موعد الاجتماع غدا', 'رقم الحجز', 'قائمة التسوق']),
    'chi_sim': (CJK, None, ['会议时间下午三点', '北京市朝阳区', '购物清单']),
    'jpn': (CJK, None, ['東京タワーの予約', 'チケット番号', 'ありがとうございます']),
}
expected = {}
for code, (font, direction, lines) in SAMPLES.items():
    if not os.path.exists(font):
        font = font.replace('-Regular', 'UI-Regular')
    f = ImageFont.truetype(font, 44, layout_engine=ImageFont.Layout.RAQM)
    img = Image.new('RGB', (1000, 90 + 80 * len(lines)), 'white')
    d = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        kw = {'direction': direction} if direction else {}
        if direction == 'rtl':
            w = d.textlength(line, font=f, **kw)
            d.text((1000 - 50 - w, 50 + 80 * i), line, font=f, fill='black', **kw)
        else:
            d.text((50, 50 + 80 * i), line, font=f, fill='black', **kw)
    img.save(os.path.join(OUT, f'{code}.png'), optimize=True)
    expected[code] = lines
with open(os.path.join(OUT, 'expected.json'), 'w', encoding='utf-8') as fh:
    json.dump(expected, fh, ensure_ascii=False, indent=2)
print('ok', len(expected))
