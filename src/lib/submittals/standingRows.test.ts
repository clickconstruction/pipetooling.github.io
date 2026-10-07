import { describe, expect, it } from 'vitest'
import { revisionWasRead, rowsThatStand } from './standingRows'

type Row = { tag: string; call: 'approved' | 'revise' | 'rejected' | null }
const row = (tag: string, call: Row['call'] = null): Row => ({ tag, call })
const approved = (r: Row) => r.call === 'approved'
const tags = (out: ReturnType<typeof rowsThatStand<Row>>) => out.map((s) => `${s.row.tag}@${s.rev}`)

describe('rowsThatStand', () => {
  it('a resubmit from the rows sent back: the approved rows of the revision before stand, the row carried does not', () => {
    const out = rowsThatStand([
      { rev: 2, rows: [row('DWH-1')] },
      { rev: 1, rows: [row('WC-1', 'approved'), row('DWH-1', 'rejected'), row('LAV-1', 'approved')] },
    ], approved)
    expect(tags(out)).toEqual(['WC-1@1', 'LAV-1@1'])
  })

  it('a row never called, or sent back and dropped, was not released: it does not stand', () => {
    const out = rowsThatStand([
      { rev: 2, rows: [row('DWH-1')] },
      { rev: 1, rows: [row('WC-1'), row('PRV-1', 'revise'), row('DWH-1', 'rejected')] },
    ], approved)
    expect(tags(out)).toEqual([])
  })

  it('the newest revision that holds a tag speaks for it: a later revision asking about a tag again outranks an older approval', () => {
    const out = rowsThatStand([
      { rev: 3, rows: [row('DWH-1')] },
      { rev: 2, rows: [row('WC-1'), row('DWH-1', 'rejected')] },
      { rev: 1, rows: [row('WC-1', 'approved'), row('LAV-1', 'approved')] },
    ], approved)
    // WC-1 was asked again on Rev 2 and never called there; LAV-1 stands from Rev 1.
    expect(tags(out)).toEqual(['LAV-1@1'])
  })

  it('a tag on the newest revision is the newest’s, whatever an older revision said', () => {
    const out = rowsThatStand([
      { rev: 2, rows: [row('WC-1')] },
      { rev: 1, rows: [row('WC-1', 'approved')] },
    ], approved)
    expect(tags(out)).toEqual([])
  })

  it('two rows under one tag on the same revision both stand; a blank tag never does; with one revision nothing stands', () => {
    expect(tags(rowsThatStand([{ rev: 2, rows: [] }, { rev: 1, rows: [row('WC-1', 'approved'), row('WC-1', 'approved'), row('', 'approved')] }], approved))).toEqual(['WC-1@1', 'WC-1@1'])
    expect(tags(rowsThatStand([{ rev: 1, rows: [row('WC-1', 'approved')] }], approved))).toEqual([])
    expect(tags(rowsThatStand([], approved))).toEqual([])
  })

  it('a superseded draft asked about nothing: its rows with no call claim no tag, and a call entered on it by hand stands', () => {
    const out = rowsThatStand([
      { rev: 4, rows: [row('DWH-1')] },
      // Rev 3 was a draft: WC-1 carried with no call, LAV-1 approved by hand, DWH-1 rejected by hand; it was superseded by the resubmit.
      { rev: 3, rows: [row('WC-1'), row('LAV-1', 'approved'), row('DWH-1', 'rejected')], asked: false },
      { rev: 2, rows: [row('WC-1', 'approved'), row('LAV-1', 'approved')] },
    ], approved)
    expect(tags(out)).toEqual(['LAV-1@3', 'WC-1@2'])
  })

  it('the GC read a shared or reviewed revision, never a draft or a superseded one', () => {
    expect(['shared', 'reviewed', 'draft', 'superseded', null, undefined].map(revisionWasRead)).toEqual([true, true, false, false, false, false])
  })
})
