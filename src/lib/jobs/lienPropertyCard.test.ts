import { describe, expect, it } from 'vitest'
import { lienPropertyCardHead, lienPropertyPublicLine, lienPropertyRowDoor, lienPropertySameOwnerWords } from './lienPropertyCard'
import { lienPropertyAffidavitLine, lienPropertyNoticeLine, type LienProperty, type LienPropertyJobLine } from './lienPropertyPapers'
import type { LienTimelineBookRow } from './lienTimelineBook'

const line = (jobId: string, gcName: string, notice: Parameters<typeof lienPropertyNoticeLine>[0], affidavit: Parameters<typeof lienPropertyAffidavitLine>[0]): LienPropertyJobLine => ({ jobId, label: `${jobId} · Job`, months: 'Sep', gcName, notice: lienPropertyNoticeLine(notice), affidavit: lienPropertyAffidavitLine(affidavit), openBalance: 100 })
const row = (propertyKind: string) => ({ job: { propertyKind } }) as unknown as LienTimelineBookRow

function property(over: Partial<LienProperty> = {}): LienProperty {
  return {
    key: 'p1',
    addressId: 'p1',
    address: '412 Ridgeline Dr, Hollow Creek',
    ownerName: 'Avery and Jordan Pell',
    rows: [row('residential'), row('residential')],
    jobs: [
      line('1207', 'Marlow Builders', { isSub: true, pile: 'printed', noticed: false, sentOn: [] }, { pile: null, gateHeld: false, missing: [] }),
      line('1203', 'Marlow Builders', { isSub: true, pile: 'sent', noticed: true, sentOn: ['2026-10-14'] }, { pile: 'to_draft', gateHeld: false, missing: [] }),
    ],
    openBalance: 200,
    tally: '',
    sameOwner: [],
    ...over,
  }
}

describe('lienPropertyCardHead', () => {
  it('names the property, its owner, its kind and its GC', () => {
    expect(lienPropertyCardHead(property())).toMatchObject({ title: '412 Ridgeline Dr, Hollow Creek', sub: 'Owner of record: Avery and Jordan Pell · residential · GC: Marlow Builders' })
  })
  it('says when no owner is on record, names two GCs, and leaves out a kind the jobs do not share', () => {
    const p = property({ ownerName: '', address: '', rows: [row('residential'), row('non_residential')] })
    p.jobs[1] = { ...p.jobs[1]!, gcName: 'Brund and Sons' }
    expect(lienPropertyCardHead(p)).toMatchObject({ title: 'This property', sub: 'No owner of record yet · GCs: Brund and Sons, Marlow Builders' })
  })
  it('gives each paper its tone from its state', () => {
    expect(lienPropertyCardHead(property()).tones).toEqual({ '1207': { notice: 'going', affidavit: 'quiet' }, '1203': { notice: 'done', affidavit: 'waits' } })
  })
})

describe('the card’s smaller lines', () => {
  it('the public line shows only when the answer bears on the papers', () => {
    expect(lienPropertyPublicLine('off_path')).toBe('This property is answered public. Its jobs are off the lien path.')
    expect(lienPropertyPublicLine('asks')).toContain('Nobody has answered yet')
    expect(lienPropertyPublicLine('private')).toBe('')
    expect(lienPropertyPublicLine('clear')).toBe('')
    expect(lienPropertyPublicLine(undefined)).toBe('')
  })
  it('the owner’s other property is named with its count', () => {
    expect(lienPropertySameOwnerWords({ address: '88 Fenwick Ln, Hollow Creek', jobs: 1 })).toBe('88 Fenwick Ln, Hollow Creek · 1 job')
    expect(lienPropertySameOwnerWords({ address: '', jobs: 3 })).toBe('another property · 3 jobs')
    expect(lienPropertySameOwnerWords({ address: '412 Ridgeline Dr', jobs: 1, sameAddress: true })).toBe('a second record for this address · 1 job')
  })
})

describe('lienPropertyRowDoor: what a By job row says of its property', () => {
  const properties = [property(), property({ key: 'p2', address: '30 Quarry Rd', jobs: [property().jobs[0]!] })]
  it('counts every job at the property', () => {
    expect(lienPropertyRowDoor(properties, { job: { addressId: 'p1', address: 'typed' } })).toEqual({ addressId: 'p1', words: '412 Ridgeline Dr, Hollow Creek · 2 jobs here', shared: true })
  })
  it('a property with one job is its address alone', () => {
    expect(lienPropertyRowDoor(properties, { job: { addressId: 'p2', address: 'typed' } })).toEqual({ addressId: 'p2', words: '30 Quarry Rd', shared: false })
  })
  it('a job with no record says so', () => {
    expect(lienPropertyRowDoor(properties, { job: { addressId: null, address: '5 Typed St' } })).toEqual({ addressId: null, words: 'No property record', shared: false })
  })
})
