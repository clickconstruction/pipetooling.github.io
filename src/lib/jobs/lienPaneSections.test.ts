import { describe, expect, it } from 'vitest'
import { LIEN_PANE_HEAD_H, LIEN_PANE_HEAD_H_PHONE, lienMissedNoticeStillGoes, lienNoticeFootHead, lienPaneHeadFactWords, lienPaneHeadOffsets, lienPaneHeadsOverPages, lienPaneSectionScrollTop, lienPaneSections, litLienPaneSection } from './lienPaneSections'

const monthShort = (k: string) => ({ '2026-07': 'Jul', '2026-08': 'Aug' })[k] ?? k
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

describe('the notice pane’s stacked heads (v2.4733)', () => {
  it('names the five sections in pane order, each with the fact a glance wants', () => {
    const heads = lienPaneSections({
      nextWords: 'Draft the Jul + Aug notice — 9 days.',
      gates: { ready: true, headline: 'Ready to go out', summary: 'All 4 clear' },
      houses: { count: 1, housesOwed: 1, owed: 6257.61, paid: 0, asOf: 'Oct 6' },
      months: ['2026-07', '2026-08'],
      claimWords: '$27,199',
      pages: 3,
      gcEmail: true,
      monthShort,
      money,
    })
    expect(heads.map((h) => [h.key, h.label, h.fact, h.tail])).toEqual([
      ['path', 'Where this notice is', 'Draft the Jul + Aug notice — 9 days', ''],
      ['gates', 'The four gates', '✓ Ready to go out', 'All 4 clear'],
      ['houses', 'Supply houses', '1 house owed · $6,258', 'from our books · Oct 6'],
      ['months', 'Months on this job', 'Jul + Aug · $27,199', ''],
      ['envelope', 'In the envelope', '3 pages · owner + GC', 'courtesy PDF to the GC'],
    ])
  })

  it('on a sent notice with nothing due the gates head reads the day it went, with no verdict (v2.6625, punch list #248)', () => {
    const heads = lienPaneSections({ nextWords: null, gates: { sentOn: 'Oct 14' }, houses: null, months: [], claimWords: '$285', pages: 1, gcEmail: false, monthShort, money })
    expect(heads[1]).toEqual({ key: 'gates', label: 'The four gates', fact: 'Sent Oct 14', tail: 'as the notice went' })
  })

  it('leaves the houses out when the job bought nothing, says all paid when it did and paid, and reads the gaps', () => {
    const base = { nextWords: null, gates: { ready: false, headline: 'Not ready', summary: '2 to fix' }, months: [], claimWords: '$0', pages: 1, gcEmail: false, monthShort, money }
    const none = lienPaneSections({ ...base, houses: null })
    expect(none.map((h) => h.key)).toEqual(['path', 'gates', 'months', 'envelope'])
    expect(none[0]!.fact).toBe('nothing due')
    expect(none[1]!.fact).toBe('✗ Not ready')
    expect(none[2]!.fact).toBe('no months · $0')
    expect(none[3]!.fact).toBe('1 page · owner + GC')
    expect(none[3]!.tail).toBe('')
    const paid = lienPaneSections({ ...base, houses: { count: 2, housesOwed: 0, owed: 0, paid: 4210, asOf: 'Oct 6' } })
    expect(paid.find((h) => h.key === 'houses')!.fact).toBe('2 houses, all paid · $4,210')
  })

  it('stacks like the list: passed heads under the strip at the top, coming heads at the bottom', () => {
    // 24 px a head since v2.7323 (the owner's ask: closer together, the words as they are), the list's number.
    expect(LIEN_PANE_HEAD_H).toBe(24)
    expect(lienPaneHeadOffsets(0, 5, 0)).toEqual({ top: 0, bottom: 4 * LIEN_PANE_HEAD_H, height: LIEN_PANE_HEAD_H })
    expect(lienPaneHeadOffsets(2, 5, 0)).toEqual({ top: 2 * LIEN_PANE_HEAD_H, bottom: 2 * LIEN_PANE_HEAD_H, height: LIEN_PANE_HEAD_H })
    expect(lienPaneHeadOffsets(4, 5, 44)).toEqual({ top: 44 + 4 * LIEN_PANE_HEAD_H, bottom: 0, height: LIEN_PANE_HEAD_H })
    expect(lienPaneHeadOffsets(0, 1, -5)).toEqual({ top: 0, bottom: 0, height: LIEN_PANE_HEAD_H })
  })

  it('lands a pressed head’s section under it, and lights the section the reader is in', () => {
    expect(lienPaneSectionScrollTop(800, 2, 44)).toBe(800 - 44 - 3 * LIEN_PANE_HEAD_H)
    expect(lienPaneSectionScrollTop(20, 0, 0)).toBe(0)
    const bodies = [
      { key: 'path', offsetTop: 60 },
      { key: 'gates', offsetTop: 400 },
      { key: 'houses', offsetTop: 900 },
      { key: 'months', offsetTop: 1300 },
      { key: 'envelope', offsetTop: 1700 },
    ] as const
    expect(litLienPaneSection(bodies, 0, 0)).toBe('path')
    // The gates body at 400 reaches its stuck head once scrollTop + 3·H ≥ 400.
    expect(litLienPaneSection(bodies, 400 - 3 * LIEN_PANE_HEAD_H - 1, 0)).toBe('path')
    expect(litLienPaneSection(bodies, 400 - 3 * LIEN_PANE_HEAD_H, 0)).toBe('gates')
    expect(litLienPaneSection(bodies, 1400, 44)).toBe('months')
    expect(litLienPaneSection(bodies, 5000, 0)).toBe('envelope')
    expect(litLienPaneSection([], 0, 0)).toBeNull()
  })
})

describe('the pane’s heads on a phone (punch list #352, PR 6)', () => {
  it('one head pins under the strip, whichever section it is, and none at the bottom', () => {
    for (const i of [0, 2, 4]) expect(lienPaneHeadOffsets(i, 5, 0, true)).toEqual({ top: 0, bottom: 'auto', height: 40 })
    expect(lienPaneHeadOffsets(3, 5, 44, true)).toEqual({ top: 44, bottom: 'auto', height: 40 })
    expect(LIEN_PANE_HEAD_H_PHONE).toBe(40)
  })

  it('a press lands the section under its own head alone', () => {
    expect(lienPaneSectionScrollTop(800, 2, 44, true)).toBe(800 - 44 - 40)
    expect(lienPaneSectionScrollTop(800, 2, 44)).toBe(800 - 44 - 3 * LIEN_PANE_HEAD_H)
    expect(lienPaneSectionScrollTop(20, 0, 0, true)).toBe(0)
  })

  it('the lit head is the last section that has reached the one pinned head', () => {
    const bodies = [{ key: 'path' as const, offsetTop: 0 }, { key: 'gates' as const, offsetTop: 400 }, { key: 'months' as const, offsetTop: 1500 }]
    expect(litLienPaneSection(bodies, 0, 0, true)).toBe('path')
    expect(litLienPaneSection(bodies, 319, 0, true)).toBe('path')
    expect(litLienPaneSection(bodies, 320, 0, true)).toBe('gates')
    expect(litLienPaneSection(bodies, 1420, 0, true)).toBe('months')
  })
})

describe('the footer’s section at the pane’s end (v2.7422, Taunya’s ask of 2026-11-15)', () => {
  const base = { nextWords: null, gates: null, houses: null, months: [], claimWords: '$0', pages: 1, gcEmail: false, monthShort, money }

  it('is the last section, marked as the footer’s, only where the footer is in the pane', () => {
    const withFoot = lienPaneSections({ ...base, foot: { label: 'Sign and send', fact: 'Not signed yet' } })
    expect(withFoot.map((h) => h.key)).toEqual(['path', 'gates', 'months', 'envelope', 'sign'])
    expect(withFoot[4]).toEqual({ key: 'sign', label: 'Sign and send', fact: 'Not signed yet', tail: '', foot: true })
    expect(withFoot.slice(0, 4).every((h) => !h.foot)).toBe(true)
    // A phone keeps the desk's strip, so the pane has no such section.
    expect(lienPaneSections({ ...base, foot: null }).map((h) => h.key)).toEqual(['path', 'gates', 'months', 'envelope'])
    expect(lienPaneSections(base).map((h) => h.key)).toEqual(['path', 'gates', 'months', 'envelope'])
  })

  it('does not count among the heads that stack over the pages', () => {
    expect(lienPaneHeadsOverPages(lienPaneSections({ ...base, foot: { label: 'Sign and send', fact: 'Not signed yet' } }))).toBe(4)
    expect(lienPaneHeadsOverPages(lienPaneSections(base))).toBe(4)
  })

  it('a missed notice is still a notice to send while a month is due or the late window is open, and only past both is it closed (v2.8170)', () => {
    // A month still due: drafted like any other row.
    expect(lienMissedNoticeStillGoes({ dueMonths: 1, lateUntil: null })).toBe(true)
    // Every window closed unsent, the affidavit's day still ahead: v2.4708 says a late notice can go and the affidavit follow it.
    expect(lienMissedNoticeStillGoes({ dueMonths: 0, lateUntil: '2026-10-15' })).toBe(true)
    // Past both, or the day unknown: the footer says the lien right on that work is gone.
    expect(lienMissedNoticeStillGoes({ dueMonths: 0, lateUntil: null })).toBe(false)
    expect(lienMissedNoticeStillGoes({ dueMonths: 0 })).toBe(false)
    expect(lienMissedNoticeStillGoes({ dueMonths: 0, lateUntil: '' })).toBe(false)
  })

  it('says where the signature stands, by the pile the notice is in', () => {
    const head = (pile: Parameters<typeof lienNoticeFootHead>[0]['pile'], signed = false, signerFirst = 'Dee', dueMonths = 1) => lienNoticeFootHead({ pile, signed, signerFirst, dueMonths })
    expect(head('to_draft')).toEqual({ label: 'Sign and send', fact: 'Not signed yet' })
    expect(head('needs_owner')).toEqual({ label: 'Sign and send', fact: 'Not signed yet' })
    // A missed notice with a month still due is drafted like any other; with none, its footer only says the window closed.
    expect(head('missed')).toEqual({ label: 'Sign and send', fact: 'Not signed yet' })
    expect(head('missed', false, 'Dee', 0)).toEqual({ label: 'Window closed', fact: 'Nothing to sign' })
    // In the late window (v2.4708) a missed notice with nothing due is still a notice to send, so its bar is the draft's (v2.8170).
    expect(lienNoticeFootHead({ pile: 'missed', signed: false, signerFirst: 'Dee', dueMonths: 0, lateUntil: '2026-10-15' })).toEqual({ label: 'Sign and send', fact: 'Not signed yet' })
    expect(lienNoticeFootHead({ pile: 'missed', signed: false, signerFirst: 'Dee', dueMonths: 0, lateUntil: null })).toEqual({ label: 'Window closed', fact: 'Nothing to sign' })
    expect(head('awaiting')).toEqual({ label: 'Sign and send', fact: 'Waiting on Dee’s signature' })
    expect(head('awaiting', false, ' ')).toEqual({ label: 'Sign and send', fact: 'Waiting on the signature' })
    // Approved (v2.7448): unsigned, the section holds the signature first; signed, the press to print and mail.
    expect(head('ready')).toEqual({ label: 'Sign it', fact: 'Approved, not signed yet' })
    expect(head('ready', true)).toEqual({ label: 'Print and mail', fact: 'Signed, to print' })
    expect(head('held')).toEqual({ label: 'Sign and send', fact: 'On hold' })
    expect(head('printed')).toEqual({ label: 'Enter mail numbers', fact: 'Printed, not mailed' })
    expect(head('sent')).toEqual({ label: 'After the send', fact: 'Sent' })
  })
})

describe('a head’s fact as whole words, for the tip of a fact a narrow pane cuts (v2.7446)', () => {
  it('joins the fact and its tail as the bar draws them', () => {
    expect(lienPaneHeadFactWords({ fact: '✗ Can’t go out yet', tail: '1 blocker' })).toBe('✗ Can’t go out yet · 1 blocker')
    expect(lienPaneHeadFactWords({ fact: '1 house owed · $5,400', tail: 'from our books · Nov 16' })).toBe('1 house owed · $5,400 · from our books · Nov 16')
  })
  it('is the fact alone with no tail', () => {
    expect(lienPaneHeadFactWords({ fact: 'Not signed yet', tail: '' })).toBe('Not signed yet')
  })
})
