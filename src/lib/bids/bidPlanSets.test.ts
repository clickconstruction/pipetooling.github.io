import { describe, expect, it } from 'vitest'
import {
  BID_OWN_PLANS_SET_ID,
  comparePlanSets,
  formatPlanSetBytes,
  planSetDateWords,
  planSetDraftProblem,
  planSetFileFromProbe,
  versionChipWords,
  planSetFileWords,
  planSetsForBid,
  planSetsIconCount,
  planSetsIconTitle,
  planSetsPress,
  samePlanLink,
  type BidPlanSetRow,
} from './bidPlanSets'

function row(over: Partial<BidPlanSetRow> & { id: string }): BidPlanSetRow {
  return {
    bid_id: 'b1',
    name: 'Issued set',
    memo: '',
    plan_date: null,
    link: 'https://drive.google.com/drive/folders/abc',
    file_name: null,
    file_size: null,
    file_count: null,
    checked_at: null,
    check_note: null,
    created_by: null,
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
    ...over,
  }
}

describe('planSetsForBid', () => {
  it('a bid with no rows and a plans link reads as one set, the link on the bid itself, which the robot reads', () => {
    const items = planSetsForBid([], { plans_link: 'https://drive.google.com/drive/folders/abc' })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: BID_OWN_PLANS_SET_ID, name: 'Plans', link: 'https://drive.google.com/drive/folders/abc', robotReads: true, onBid: true })
    expect(planSetsPress(items)).toBe('open')
    expect(planSetsIconTitle(items)).toBe('Job plans')
    expect(planSetsIconCount(items)).toBeNull()
  })

  it('a bid with no rows and no link has no plans', () => {
    expect(planSetsForBid([], { plans_link: '  ' })).toEqual([])
    expect(planSetsPress([])).toBe('none')
  })

  it('a row carrying the bid’s link is the robot’s set and the bid’s own link adds nothing', () => {
    const items = planSetsForBid([row({ id: 'r1', link: 'https://drive.google.com/drive/folders/abc/' })], { plans_link: 'https://drive.google.com/drive/folders/abc?usp=drive_link' })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'r1', name: 'Issued set', robotReads: true, onBid: false })
    expect(planSetsIconTitle(items)).toBe('Job plans · Issued set')
  })

  it('newest date first, undated rows after, and a plans link on no row comes last as Plans; two or more open the picker', () => {
    const items = planSetsForBid(
      [
        row({ id: 'old', name: 'Issued set', plan_date: '2026-09-14', link: 'https://drive.google.com/drive/folders/old' }),
        row({ id: 'new', name: 'Addendum 1', plan_date: '2026-10-02', link: 'https://drive.google.com/drive/folders/new' }),
        row({ id: 'undated', name: 'GC’s marked copy', link: 'https://drive.google.com/file/d/xyz/view', created_at: '2026-10-05T12:00:00Z' }),
      ],
      { plans_link: 'https://drive.google.com/drive/folders/other' },
    )
    expect(items.map((i) => i.id)).toEqual(['new', 'old', 'undated', BID_OWN_PLANS_SET_ID])
    expect(items.map((i) => i.robotReads)).toEqual([false, false, false, true])
    expect(planSetsPress(items)).toBe('pick')
    expect(planSetsIconTitle(items)).toBe('Job plans · 4 sets')
    expect(planSetsIconCount(items)).toBe('4')
  })

  it('comparePlanSets: among equal dates the newest made first', () => {
    const a = { plan_date: '2026-10-02', created_at: '2026-10-02T10:00:00Z' }
    const b = { plan_date: '2026-10-02', created_at: '2026-10-02T11:00:00Z' }
    expect(comparePlanSets(a, b)).toBeGreaterThan(0)
    expect(comparePlanSets(b, a)).toBeLessThan(0)
    expect(comparePlanSets(a, a)).toBe(0)
  })
})

describe('samePlanLink', () => {
  it('ignores space, a trailing slash and Drive’s usp tail; an empty link matches nothing', () => {
    expect(samePlanLink(' https://drive.google.com/drive/folders/abc/ ', 'https://drive.google.com/drive/folders/abc?usp=sharing')).toBe(true)
    expect(samePlanLink('https://drive.google.com/drive/folders/abc', 'https://drive.google.com/drive/folders/abd')).toBe(false)
    expect(samePlanLink('', '')).toBe(false)
    expect(samePlanLink(null, undefined)).toBe(false)
  })
})

describe('the words', () => {
  it('formatPlanSetBytes reads as people do', () => {
    expect(formatPlanSetBytes(null)).toBeNull()
    expect(formatPlanSetBytes(512)).toBe('512 B')
    expect(formatPlanSetBytes(880_640)).toBe('860 KB')
    expect(formatPlanSetBytes(2_202_009)).toBe('2.1 MB')
    expect(formatPlanSetBytes(44_040_192)).toBe('42 MB')
    expect(formatPlanSetBytes(1_288_490_189)).toBe('1.2 GB')
  })

  it('planSetDateWords reads the civil date by its parts', () => {
    expect(planSetDateWords('2026-10-02')).toBe('Oct 2, 2026')
    expect(planSetDateWords(null)).toBeNull()
    expect(planSetDateWords('not a date')).toBeNull()
  })

  it('planSetFileWords: a folder counts its PDFs, a file names itself, a failed read says why, an unread set says so', () => {
    expect(planSetFileWords({ fileName: '3 PDFs', fileSize: 44_040_192, fileCount: 3, checkedAt: 'x', checkNote: null })).toBe('3 PDFs · 42 MB')
    expect(planSetFileWords({ fileName: 'A-101.pdf', fileSize: 2_202_009, fileCount: 1, checkedAt: 'x', checkNote: null })).toBe('A-101.pdf · 2.1 MB')
    expect(planSetFileWords({ fileName: 'A-101.pdf', fileSize: null, fileCount: null, checkedAt: 'x', checkNote: null })).toBe('A-101.pdf')
    expect(planSetFileWords({ fileName: null, fileSize: null, fileCount: null, checkedAt: 'x', checkNote: 'Drive 404 — the folder is not shared with the intake service account (or was moved/deleted)' })).toMatch(/^Could not read the link: Drive 404/)
    expect(planSetFileWords({ fileName: null, fileSize: null, fileCount: null, checkedAt: 'x', checkNote: null })).toBe('Nothing readable behind the link')
    expect(planSetFileWords({ fileName: null, fileSize: null, fileCount: null, checkedAt: null, checkNote: null })).toBe('Not read yet')
  })

  it('planSetFileFromProbe keeps what the probe read and the reason when it could not', () => {
    const now = new Date('2026-10-30T15:00:00Z')
    expect(planSetFileFromProbe({ readable: true, note: 'folder · 3 PDFs', name: '3 PDFs', size: 44_040_192, count: 3 }, now)).toEqual({ file_name: '3 PDFs', file_size: 44_040_192, file_count: 3, checked_at: '2026-10-30T15:00:00.000Z', check_note: null })
    expect(planSetFileFromProbe({ readable: false, note: 'Drive 403 — no permission' }, now)).toEqual({ file_name: null, file_size: null, file_count: null, checked_at: '2026-10-30T15:00:00.000Z', check_note: 'Drive 403 — no permission' })
    expect(planSetFileFromProbe({ readable: false, note: null }, now).check_note).toBe('could not read the link')
  })

  it('planSetDraftProblem asks for the name, then a link that starts with https://', () => {
    expect(planSetDraftProblem({ name: ' ', link: 'https://x' })).toBe('Give the set a name.')
    expect(planSetDraftProblem({ name: 'Addendum 1', link: 'drive.google.com/x' })).toBe('Paste the set’s link, starting with https://')
    expect(planSetDraftProblem({ name: 'Addendum 1', link: 'https://drive.google.com/x' })).toBeNull()
  })
})

describe('versionChipWords (v2.6230)', () => {
  it('names the version an adopted bid became, and stays off with no name', () => {
    expect(versionChipWords('William · April set')).toBe('version · William · April set')
    expect(versionChipWords('  ')).toBe('')
    expect(versionChipWords(null)).toBe('')
  })
})
