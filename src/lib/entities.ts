/**
 * Conservative extraction of actionable entities (links, e-mails, phone
 * numbers, dates) from text read off an image. Deliberately strict: a wrong
 * link or phone number is worse than a missed one, so only well-formed
 * matches are returned. Values are shown as chips with copy/open actions.
 */

export type EntityKind = 'url' | 'email' | 'phone' | 'date';

export interface Entity {
  kind: EntityKind;
  value: string;
  /** href for the open action ('' when copy-only, e.g. dates). */
  href: string;
}

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]}]+[^\s<>"')\]}.,;:!?]/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// International phone numbers: optional +, 10–15 digits, allowing spaces,
// parentheses and dashes between digit groups.
const PHONE_RE = /(?:^|[^0-9A-Za-z])(\+?[0-9][0-9 ()-]{8,16}[0-9])(?![0-9])/g;
// ISO dates, dd.mm.yyyy and Turkish/English long forms are NOT guessed —
// only unambiguous machine formats are linked.
const DATE_RE = /\b(?:\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}|\d{2}\/\d{2}\/\d{4})\b/g;

function pushUnique(out: Entity[], e: Entity): void {
  if (!out.some((x) => x.value === e.value)) out.push(e);
}

/** Extracts entities from OCR/AI text. */
export function extractEntities(text: string): Entity[] {
  const out: Entity[] = [];
  if (!text) return out;
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0];
    pushUnique(out, { kind: 'url', value: raw, href: raw.startsWith('http') ? raw : `https://${raw}` });
  }
  for (const m of text.matchAll(EMAIL_RE)) {
    pushUnique(out, { kind: 'email', value: m[0], href: `mailto:${m[0]}` });
  }
  for (const m of text.matchAll(PHONE_RE)) {
    const val = m[1];
    if (!val) continue;
    const digits = val.replace(/\D/g, '');
    // Reject digit runs that are too short/long to be phone numbers.
    if (digits.length < 10 || digits.length > 15) continue;
    pushUnique(out, { kind: 'phone', value: val.trim(), href: `tel:${val.replace(/[\s()]/g, '')}` });
  }
  for (const m of text.matchAll(DATE_RE)) {
    pushUnique(out, { kind: 'date', value: m[0], href: '' });
  }
  return out.slice(0, 24);
}
