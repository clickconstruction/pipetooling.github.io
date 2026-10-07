/** v2.4808: the firm's tables fold into cards on a narrow screen; small type reads 12px on a phone. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cardCellEmpty, LEGAL_CARD_VARS, lienCardMissingLine, portalSmall } from './legalPortalCards'
import { FAINT, HAIR } from '../portal/portalTheme'

const allIn = { owner: 'Sam Whitfield', lastOnSite: '2026-08-20', affidavit: 'Jan 15', bond: 'none', paidOut: '$0', reserved: '$0', contractCompleted: '2026-09-01' }

describe('cardCellEmpty', () => {
  it('drops a cell that says nothing, and keeps a dash, a zero and anything drawn', () => {
    for (const v of [null, undefined, false, '', '   ']) expect(cardCellEmpty(v)).toBe(true)
    for (const v of ['—', 0, 'PDF ↗', ['a'], { type: 'b' }]) expect(cardCellEmpty(v)).toBe(false)
  })
})

describe('portalSmall', () => {
  it('reads the phone’s size when the page sets it, else the desktop size', () => {
    expect(portalSmall(11.5)).toBe('var(--legal-small, 11.5px)')
    expect(portalSmall(10)).toBe('var(--legal-small, 10px)')
  })
})

describe('LEGAL_CARD_VARS', () => {
  it('hands the card CSS the portal’s own hairline and label colors', () => {
    expect(LEGAL_CARD_VARS).toEqual({ '--legal-card-hair': HAIR, '--legal-card-label': FAINT })
  })
})

describe('lienCardMissingLine', () => {
  it('names the facts not entered yet, in column order, as one line', () => {
    expect(lienCardMissingLine({ ...allIn, bond: '', reserved: '', owner: '' })).toBe('Not entered yet: owner of record, payment bond, 10 % reserved.')
    expect(lienCardMissingLine({ ...allIn, paidOut: '  ', contractCompleted: '' })).toBe('Not entered yet: paid out to the GC, contract completion.')
  })
  it('is null when every fact is in', () => {
    expect(lienCardMissingLine(allIn)).toBeNull()
  })
})

describe('the card CSS', () => {
  const css = readFileSync('src/index.css', 'utf8')
  it('folds by the table’s own box, not the window, and only below a record’s width', () => {
    expect(css).toContain('.legalCardWrap { container: legal-card / inline-size; }')
    expect(css).toContain('@container legal-card (max-width: 560px) {')
  })
  it('reads the column’s name from the cell, drops empty cells, and keeps the colors in portalTheme', () => {
    expect(css).toContain('content: attr(data-label);')
    expect(css).toMatch(/td\[data-card-drop\] \{ display: none; \}/)
    expect(css).toContain('var(--legal-card-hair)')
    expect(css).toContain('var(--legal-card-label)')
  })
  it('sets the small type to 12px on a phone, on the portal page only', () => {
    expect(css).toMatch(/\.legalPortalPage \{ padding: 16px 16px 48px; --legal-small: 12px; \}/)
  })
})
