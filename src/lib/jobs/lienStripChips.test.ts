import { describe, expect, it } from 'vitest'
import { buildLienDeskGates, lienSentGatesFold, type LienDeskGatesInput } from './lienDeskGates'
import { lienStripChips, type LienStripChipsInput } from './lienStripChips'
import { plainWordsFailures } from '../plainWords'

const clear: LienDeskGatesInput = {
  ownerName: 'Della Mackay LLC',
  ownerMailingAddress: '4 Example Way, Schertz, TX',
  gcName: 'Lowbeck Contracting',
  gcAddress: '2904 Corporate Cr, Flower Mound, TX',
  propertyKind: 'non_residential',
  county: 'Bexar',
  monthLabels: ['Sep'],
  pickedMonthsCount: 1,
  pendingSessions: 0,
}

const base: Omit<LienStripChipsInput, 'gates'> = {
  monthWords: 'Sep',
  next: { kind: 'notice', words: 'Send the Sep notice — tomorrow.', tone: 'amber' },
  claimWords: '$33,500',
  claimByHand: false,
  wordingWords: '',
  fold: null,
}

describe('lienStripChips', () => {
  it('a missing owner: one red chip in the gate’s own words, no Can’t go out yet, and no next chip since the step repeats it', () => {
    const { gates } = buildLienDeskGates({ ...clear, ownerName: '', ownerMailingAddress: '' })
    const chips = lienStripChips({ ...base, gates, next: { kind: 'notice', words: 'Find the owner, then send the Sep notice — tomorrow.', tone: 'red' } })
    expect(chips.map((c) => [c.key, c.words, c.tone, c.act])).toEqual([
      ['gate:owner', 'Owner of record missing ›', 'red', 'gate:owner'],
      ['months', 'Sep ›', 'quiet', 'months'],
      ['claim', 'Claim $33,500 ›', 'quiet', 'claim'],
    ])
    expect(chips.find((c) => c.key === 'gate:owner')?.title).toBe('No owner of record with a mailing address on the property record')
    expect(chips.some((c) => /go out/i.test(c.words))).toBe(false)
  })

  it('every gate that blocks is its own red chip; a months blocker takes the quiet months chip’s place', () => {
    const { gates } = buildLienDeskGates({ ...clear, ownerName: '', ownerMailingAddress: '', gcName: '', pickedMonthsCount: 0, monthLabels: [] })
    const chips = lienStripChips({ ...base, gates, monthWords: '' })
    expect(chips.map((c) => c.words)).toEqual(['Owner of record missing ›', 'No GC on the job ›', 'No month picked ›', 'Claim $33,500 ›'])
    expect(chips.filter((c) => c.tone === 'red').map((c) => c.act)).toEqual(['gate:owner', 'gate:gc', 'gate:months'])
  })

  it('all clear: one green Ready to go out › to the footer’s press, and the next chip stays since it adds the day', () => {
    const { gates } = buildLienDeskGates(clear)
    const chips = lienStripChips({ ...base, gates })
    expect(chips.map((c) => [c.key, c.words, c.tone, c.act])).toEqual([
      ['ready', 'Ready to go out ›', 'green', 'ready'],
      ['months', 'Sep ›', 'quiet', 'months'],
      ['next', 'Send the Sep notice — tomorrow ›', 'amber', 'next'],
      ['claim', 'Claim $33,500 ›', 'quiet', 'claim'],
    ])
    expect(chips.some((c) => c.tone === 'red')).toBe(false)
  })

  it('an unknown kind is an amber chip to its gate, after the green one', () => {
    const { gates } = buildLienDeskGates({ ...clear, propertyKind: '' })
    const chips = lienStripChips({ ...base, gates })
    expect(chips.slice(0, 2).map((c) => [c.words, c.tone, c.act])).toEqual([
      ['Ready to go out ›', 'green', 'ready'],
      ['Property kind unknown ›', 'amber', 'gate:kind'],
    ])
  })

  it('a next step that is another paper is kept beside a blocker, since it is a different act', () => {
    const { gates } = buildLienDeskGates({ ...clear, ownerName: '', ownerMailingAddress: '' })
    const chips = lienStripChips({ ...base, gates, next: { kind: 'affidavit', words: 'File the affidavit — in 20 days.', tone: 'amber' } })
    expect(chips.find((c) => c.key === 'next')).toMatchObject({ words: 'File the affidavit — in 20 days ›', act: 'next', tone: 'amber' })
  })

  it('a claim set by hand and edited wording are amber presses to their places', () => {
    const { gates } = buildLienDeskGates(clear)
    const chips = lienStripChips({ ...base, gates, claimByHand: true, wordingWords: '2 lines edited by Taunya' })
    expect(chips.find((c) => c.key === 'claim')).toMatchObject({ words: 'Claim $33,500, set by hand ›', tone: 'amber', act: 'claim' })
    expect(chips.find((c) => c.key === 'wording')).toMatchObject({ words: '2 lines edited by Taunya ›', tone: 'amber', act: 'wording' })
  })

  it('a sent notice with nothing due: the grey Sent chip is the way back up, and no gate judges it', () => {
    const { gates } = buildLienDeskGates({ ...clear, ownerName: '', ownerMailingAddress: '', pickedMonthsCount: 0, monthLabels: [], monthsOnJob: 0 })
    const fold = lienSentGatesFold({ sentOn: 'Oct 14', gates, noticeMonths: ['2026-07'], monthShort: () => 'Jul' })
    const chips = lienStripChips({ ...base, gates, monthWords: '', fold, next: { kind: 'affidavit', words: 'File the affidavit — in 40 days.', tone: 'quiet' } })
    expect(chips.map((c) => [c.key, c.words, c.tone, c.act])).toEqual([
      ['sent', 'Sent Oct 14 ›', 'quiet', 'top'],
      ['months', 'No month picked ›', 'quiet', 'months'],
      ['next', 'File the affidavit — in 40 days ›', 'quiet', 'next'],
      ['claim', 'Claim $33,500 ›', 'quiet', 'claim'],
    ])
  })

  it('every chip ends in › and the kernel’s own words are plain', () => {
    const { gates } = buildLienDeskGates({ ...clear, ownerName: '', ownerMailingAddress: '', propertyKind: '', gcName: '' })
    const chips = lienStripChips({ ...base, gates, claimByHand: true, wordingWords: 'the claimant line edited', next: { kind: 'retainage', words: 'Send the retainage notice — in 30 days.', tone: 'quiet' } })
    for (const c of chips) expect(c.words.endsWith(' ›')).toBe(true)
    // The next chip carries the timeline's own sentence; every other chip is the kernel's words and reads plain.
    for (const c of chips.filter((c) => c.key !== 'next')) expect(plainWordsFailures(c.words.replace(/ ›$/, ''))).toEqual([])
    // A gate chip's hover is the gate's own sentence from `buildLienDeskGates`; the rest are this kernel's.
    for (const c of chips.filter((c) => !c.key.startsWith('gate:'))) expect(plainWordsFailures(c.title)).toEqual([])
  })
})
