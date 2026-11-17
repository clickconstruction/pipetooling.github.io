import { describe, expect, it } from 'vitest'
import { lienNoticeParted, lienNoticePartedHold, lienNoticePartedWords, runNoticePrintRefusal } from './lienNoticeParted'
import { plainWordsFailures } from '../plainWords'

describe('lienNoticeParted: the stored paper beside the bills (v2.7517)', () => {
  it('money that agrees to the cent is not parted, however it is written', () => {
    expect(lienNoticeParted({ claimAmount: '6150.00' }, { claimAmount: '6150' })).toBeNull()
    expect(lienNoticeParted({ claimAmount: '$6,150.00' }, { claimAmount: '6150.00' })).toBeNull()
    expect(lienNoticeParted({ claimAmount: '6150.00', retainageIncluded: '615.00', claimSplit: ' July 2026 $0.00 ' }, { claimAmount: '6150.00', retainageIncluded: '615', claimSplit: 'July 2026 $0.00' })).toBeNull()
  })

  it('nothing to compare holds nothing', () => {
    expect(lienNoticeParted(null, { claimAmount: '10.00' })).toBeNull()
    expect(lienNoticeParted({ claimAmount: '10.00' }, undefined)).toBeNull()
  })

  it('a bill corrected after the draft: the claim parts, with both figures and the gap', () => {
    const p = lienNoticeParted({ claimAmount: '18400.00' }, { claimAmount: '6150.00' })!
    expect(p.parts).toEqual(['claim'])
    expect(p.paperClaim).toBe(18400)
    expect(p.nowClaim).toBe(6150)
    expect(lienNoticePartedWords(p)).toBe('The paper claims $18,400.00. The bills now come to $6,150.00, $12,250.00 less.')
    expect(lienNoticePartedHold(p)).toBe('The paper claims $18,400.00. The bills now come to $6,150.00, $12,250.00 less. It prints once the notice is redrawn from the bills.')
  })

  it('one cent is a difference, and a claim that grew says more', () => {
    const p = lienNoticeParted({ claimAmount: '100.00' }, { claimAmount: '100.01' })!
    expect(p.parts).toEqual(['claim'])
    expect(lienNoticePartedWords(p)).toBe('The paper claims $100.00. The bills now come to $100.01, $0.01 more.')
  })

  it('a claim set by hand since the draft names its source', () => {
    const p = lienNoticeParted({ claimAmount: '9800.00' }, { claimAmount: '8300.00' }, 'hand')!
    expect(lienNoticePartedWords(p)).toBe('The paper claims $9,800.00. The claim set by hand is now $8,300.00, $1,500.00 less.')
  })

  it('retainage typed on the job after the draft parts the paper though the claim agrees', () => {
    const p = lienNoticeParted({ claimAmount: '6150.00' }, { claimAmount: '6150.00', retainageIncluded: '615.00' })!
    expect(p.parts).toEqual(['retainage'])
    expect(lienNoticePartedWords(p)).toBe('The paper names no retainage inside the claim. The job now holds $615.00.')
    const gone = lienNoticeParted({ claimAmount: '6150.00', retainageIncluded: '615.00' }, { claimAmount: '6150.00' })!
    expect(lienNoticePartedWords(gone)).toBe('The paper names $615.00 of retainage inside the claim. The job now holds none.')
  })

  it('the split by month alone says so, and stays quiet when the claim already says it', () => {
    const split = lienNoticeParted({ claimAmount: '5900.00', claimSplit: 'July 2026 $0.00 · August 2026 $5,900.00' }, { claimAmount: '5900.00' })!
    expect(split.parts).toEqual(['split'])
    expect(lienNoticePartedWords(split)).toBe('The paper splits the claim by month another way than the desk does now.')
    const both = lienNoticeParted({ claimAmount: '5900.00', claimSplit: 'July 2026 $0.00 · August 2026 $5,900.00' }, { claimAmount: '4000.00' })!
    expect(both.parts).toEqual(['claim', 'split'])
    expect(lienNoticePartedWords(both)).toBe('The paper claims $5,900.00. The bills now come to $4,000.00, $1,900.00 less.')
  })

  it('the words are plain', () => {
    const all = lienNoticeParted({ claimAmount: '18400.00' }, { claimAmount: '6150.00', retainageIncluded: '615.00' })!
    expect(plainWordsFailures(lienNoticePartedHold(all))).toEqual([])
  })
})

describe('runNoticePrintRefusal: no route prints a parted notice (v2.7517)', () => {
  const parted = lienNoticeParted({ claimAmount: '18400.00' }, { claimAmount: '6150.00' })

  it('a parted notice not yet printed is refused, named by its job', () => {
    expect(runNoticePrintRefusal({ parted, printedAt: null, jobNumber: '1204' })).toBe('1204: The paper claims $18,400.00. The bills now come to $6,150.00, $12,250.00 less. It prints once the notice is redrawn from the bills.')
  })

  it('a notice that agrees, or one the builder said nothing about, prints', () => {
    expect(runNoticePrintRefusal({ parted: null, jobNumber: '1204' })).toBeNull()
    expect(runNoticePrintRefusal({ jobNumber: '1204' })).toBeNull()
  })

  it('a notice already printed is past it: the record is not stopped', () => {
    expect(runNoticePrintRefusal({ parted, printedAt: '2026-11-16T21:53:59Z', jobNumber: '1204' })).toBeNull()
  })
})
