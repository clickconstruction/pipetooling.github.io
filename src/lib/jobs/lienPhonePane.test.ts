import { describe, expect, it } from 'vitest'
import { lienPhoneFootFold, lienPhoneFootStartsFolded, lienPhonePaneOpen } from './lienPhonePane'

const none = { notice: false, affidavit: false, retainage: false }

describe('lienPhonePaneOpen', () => {
  it('names the open paper and the list its way back returns to', () => {
    expect(lienPhonePaneOpen({ oneColumn: true, listShown: false, kind: 'notice', picked: { ...none, notice: true } })).toEqual({ kind: 'notice', back: 'Notices', backLabel: 'Back to the notices' })
    expect(lienPhonePaneOpen({ oneColumn: true, listShown: false, kind: 'affidavit', picked: { ...none, affidavit: true } })).toEqual({ kind: 'affidavit', back: 'Affidavits', backLabel: 'Back to the affidavits' })
    expect(lienPhonePaneOpen({ oneColumn: true, listShown: false, kind: 'retainage', picked: { ...none, retainage: true } })).toEqual({ kind: 'retainage', back: 'Retainage', backLabel: 'Back to the retainage notices' })
  })

  it('is nothing on a computer, with the list showing, with no paper picked, or on a view with no pane', () => {
    const all = { notice: true, affidavit: true, retainage: true }
    expect(lienPhonePaneOpen({ oneColumn: false, listShown: false, kind: 'notice', picked: all })).toBeNull()
    expect(lienPhonePaneOpen({ oneColumn: true, listShown: true, kind: 'notice', picked: all })).toBeNull()
    expect(lienPhonePaneOpen({ oneColumn: true, listShown: false, kind: 'affidavit', picked: { ...all, affidavit: false } })).toBeNull()
    for (const kind of ['next', 'calendar', 'timeline']) expect(lienPhonePaneOpen({ oneColumn: true, listShown: false, kind, picked: all })).toBeNull()
  })
})

describe('lienPhoneFootFold', () => {
  it('says what the press will do', () => {
    expect(lienPhoneFootFold(false)).toEqual({ words: 'Hide the next step', mark: '▾', expanded: true })
    expect(lienPhoneFootFold(true)).toEqual({ words: 'Show the next step', mark: '▴', expanded: false })
  })
})

describe('lienPhoneFootStartsFolded', () => {
  it('folds a footer that would leave the paper under 140 px, and no other', () => {
    // A sent notice at 390 × 720: 579 − 68 − 40 − 395 leaves 76.
    expect(lienPhoneFootStartsFolded({ panel: 579, header: 68, bar: 40, footer: 395 })).toBe(true)
    // A notice to draft: 579 − 68 − 40 − 184 leaves 287.
    expect(lienPhoneFootStartsFolded({ panel: 579, header: 68, bar: 40, footer: 184 })).toBe(false)
    expect(lienPhoneFootStartsFolded({ panel: 579, header: 68, bar: 40, footer: 331 })).toBe(false)
    expect(lienPhoneFootStartsFolded({ panel: 579, header: 68, bar: 40, footer: 332 })).toBe(true)
  })
  it('folds nothing before the page has heights to read', () => {
    expect(lienPhoneFootStartsFolded({ panel: 0, header: 0, bar: 0, footer: 0 })).toBe(false)
    expect(lienPhoneFootStartsFolded({ panel: 579, header: 68, bar: 40, footer: 0 })).toBe(false)
  })
})
