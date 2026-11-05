import { describe, expect, it } from 'vitest'
import { parseLegalPortalThemes } from './legalPortalPayload'
import { firmThemesSectionHtml } from './legalFirmPacketPrint'
import type { LegalEntryRow } from './legalMatters'
import type { LegalPortalDocument } from './legalMatterDocuments'

describe('themes on the firm’s portal (v2.6549)', () => {
  it('parses the function’s themes and drops a row without an id and a name', () => {
    expect(parseLegalPortalThemes(undefined)).toEqual([])
    const out = parseLegalPortalThemes([
      { id: 't1', name: 'Dishonesty', whatCounts: 'A false statement.', counselWords: 'fraud', documentIds: ['d1', 7], entryIds: ['e1'], proof: { document: 2, firsthand: 'x' } },
      { name: 'no id' },
    ])
    expect(out).toEqual([{ id: 't1', name: 'Dishonesty', whatCounts: 'A false statement.', counselWords: 'fraud', documentIds: ['d1'], entryIds: ['e1'], proof: { document: 2, own_words: 0, firsthand: 0, relayed: 0 } }])
  })

  it('prints a block a theme under Section D with the words, the counts and the items', () => {
    const docs = [{ id: 'd1', title: 'Bank statement, April' } as LegalPortalDocument]
    const entries = [{ id: 'e1', occurred_on: '2026-07-20', body: 'Trip taken after three refusals.' } as LegalEntryRow]
    expect(firmThemesSectionHtml([], docs, entries)).toBe('')
    const html = firmThemesSectionHtml([{ id: 't1', name: 'Dishonesty', whatCounts: 'A false statement.', counselWords: 'fraud & more', documentIds: ['d1', 'gone'], entryIds: ['e1'], proof: { document: 1, own_words: 0, firsthand: 1, relayed: 0 } }], docs, entries)
    expect(html).toContain('<h3>Evidence by theme</h3>')
    expect(html).toContain('<h3>Dishonesty <span class="muted">· fraud &amp; more</span></h3>')
    expect(html).toContain('<p>A false statement.</p>')
    expect(html).toContain('3 items · 1 by a document · 0 by their own words · 1 firsthand · 0 relayed')
    expect(html).toContain('<li>Bank statement, April</li><li>2026-07-20 · Trip taken after three refusals.</li>')
  })
})
