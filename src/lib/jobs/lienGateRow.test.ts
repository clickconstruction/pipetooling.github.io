import { describe, expect, it } from 'vitest'
import { lienGateRow } from './lienGateRow'

const doors = { property: true, contractor: true }
const facts = { isSub: true, ownerName: 'RIZVI SYED ZULFIQAR', county: 'Bexar', legalDescription: 'CB 9848 BLK B LOT 7 FHA 60/0 3080002', gcName: 'RGJ- Della Mackay', gcAddress: '454 Co Rd 660, Devine TX 78016', noticeSentWords: 'sent Sep 22' }

describe('lienGateRow · every gate row is a press that opens its home (v2.7313)', () => {
  it('a failed gate keeps its named door; a passed one shows its fact and ends in Change ›', () => {
    expect(lienGateRow({ key: 'owner', ok: false }, facts, doors)).toEqual({ fact: 'RIZVI SYED ZULFIQAR', door: 'property_owner', doorWords: 'Fill in the record ›', title: 'Opens the property record at the owner of record' })
    expect(lienGateRow({ key: 'owner', ok: true }, facts, doors).doorWords).toBe('Change ›')
    expect(lienGateRow({ key: 'legal', ok: true }, facts, doors)).toMatchObject({ fact: 'Bexar · CB 9848 BLK B LOT 7 FHA 60/0 3080002', door: 'property_legal', doorWords: 'Change ›' })
    expect(lienGateRow({ key: 'contractor', ok: false }, facts, doors)).toMatchObject({ fact: 'RGJ- Della Mackay · 454 Co Rd 660, Devine TX 78016', door: 'contractor', doorWords: 'Add the address ›' })
    expect(lienGateRow({ key: 'contractor', ok: true }, facts, doors).doorWords).toBe('Change ›')
    expect(lienGateRow({ key: 'homestead_answer', ok: false }, facts, doors)).toMatchObject({ door: 'property_homestead', doorWords: 'Answer it ›' })
    expect(lienGateRow({ key: 'homestead', ok: true }, facts, doors)).toMatchObject({ door: 'property_homestead', doorWords: 'Change ›' })
    expect(lienGateRow({ key: 'homestead', ok: false }, facts, doors).doorWords).toBe('Property record ›')
    expect(lienGateRow({ key: 'public_owner', ok: false }, facts, doors).doorWords).toBe('Property record ›')
  })

  it('the notice row opens Monthly notices: Send the notice first › until one is recorded, then its day and See it ›', () => {
    expect(lienGateRow({ key: 'notice', ok: false }, facts, doors)).toEqual({ fact: '', door: 'notices', doorWords: 'Send the notice first ›', title: 'Opens Monthly notices on this job' })
    expect(lienGateRow({ key: 'notice', ok: true }, facts, doors)).toMatchObject({ fact: 'sent Sep 22', doorWords: 'See it ›' })
  })

  it('a closed notice row says where the notice stands: only the late notice is *Send the notice first ›*', () => {
    const closed = (noticeStanding: NonNullable<Parameters<typeof lienGateRow>[1]['noticeStanding']>, leaderName?: string) => lienGateRow({ key: 'notice', ok: false }, { ...facts, noticeStanding, leaderName }, doors)
    expect(closed('approved')).toEqual({ fact: 'approved · not mailed yet', door: 'notices', doorWords: 'Open the notice ›', title: 'Opens Monthly notices on this job' })
    expect(closed('printed')).toMatchObject({ fact: 'printed · not mailed yet', doorWords: 'Open the notice ›' })
    expect(closed('awaiting')).toMatchObject({ fact: 'awaiting approval', doorWords: 'Open the notice ›' })
    expect(closed('to_send')).toMatchObject({ fact: 'not sent for approval yet', doorWords: 'Open the notice ›' })
    expect(closed('late')).toMatchObject({ fact: '', doorWords: 'Send the notice first ›' })
    // A standing that says the gate is open never overrules the gate: the row keeps its old words.
    expect(closed('on_record')).toMatchObject({ fact: '', doorWords: 'Send the notice first ›' })
    // Open, the standing changes nothing.
    expect(lienGateRow({ key: 'notice', ok: true }, { ...facts, noticeStanding: 'on_record' }, doors)).toMatchObject({ fact: 'sent Sep 22', doorWords: 'See it ›' })
  })

  it('a job contracted with the owner has no GC row and no notice row to open; a GC row with no record wired is words alone', () => {
    const none = { fact: '', door: null, doorWords: '', title: '' }
    expect(lienGateRow({ key: 'contractor', ok: true }, { ...facts, isSub: false }, doors)).toEqual(none)
    expect(lienGateRow({ key: 'notice', ok: true }, { ...facts, isSub: false }, doors)).toEqual(none)
    expect(lienGateRow({ key: 'contractor', ok: false }, facts, { ...doors, contractor: false })).toEqual(none)
    expect(lienGateRow({ key: 'something_else', ok: true }, facts, doors)).toEqual(none)
  })

  it('without the property window the record doors say Property record › and still open', () => {
    expect(lienGateRow({ key: 'owner', ok: false }, facts, { ...doors, property: false }).doorWords).toBe('Property record ›')
    expect(lienGateRow({ key: 'legal', ok: true }, facts, { ...doors, property: false }).doorWords).toBe('Change ›')
  })

  it('a long legal description is cut to one line, and missing facts leave the label alone', () => {
    const long = 'LOT 12 BLOCK 3 OF THE SUBDIVISION OF THE NORTH HALF OF SECTION 9 TOWNSHIP 2 RANGE 4'
    expect(lienGateRow({ key: 'legal', ok: true }, { ...facts, legalDescription: long }, doors).fact).toBe('Bexar · LOT 12 BLOCK 3 OF THE SUBDIVISION OF THE NORTH…')
    expect(lienGateRow({ key: 'legal', ok: false }, { isSub: true }, doors).fact).toBe('')
    expect(lienGateRow({ key: 'owner', ok: false }, { isSub: true, ownerName: '  ' }, doors).fact).toBe('')
  })
})
