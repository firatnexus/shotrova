import { describe, expect, it } from 'vitest';
import { displayTitle } from '../../src/search/search';

describe('displayTitle', () => {
  it('uses the record title when present', () => {
    expect(displayTitle({ title: 'Manuel başlık', fileName: 'a83a759c-5d83-4390-a890-9740be32e70.jpg' })).toBe('Manuel başlık');
  });

  it('falls back to the file name for normal files', () => {
    expect(displayTitle({ title: '', fileName: 'invoice_tr.png' })).toBe('invoice_tr');
  });

  it('hides machine-generated names (UUID, long hex, clipboard stamp) — the caller shows a localized label', () => {
    // Android share sheet often stages files with bare UUID names.
    expect(displayTitle({ title: '', fileName: 'a83a759c-5d83-4390-a890-9740be32e70.jpg' })).toBe('');
    expect(displayTitle({ title: '', fileName: 'f30ab91c7d55e2c81b044d9.jpg' })).toBe('');
    expect(displayTitle({ title: '', fileName: 'clipboard-1732243200000.png' })).toBe('');
    expect(displayTitle({ title: '', fileName: 'clipboard-1732243200000-2.png' })).toBe('');
  });
});
