import { describe, expect, it } from 'vitest'
import type { LienDeskItemRow, LienDeskMonth } from './lienDesk'
import type { JobLienFilingRow } from './lienDeadlines'
import { buildLienMonthGrid, lienGridPaperTitle, lienGridPaperWords } from './lienMonthGrid'

const TODAY = '2026-09-23'
const month = (key: string, deadline: string, over: Partial<LienDeskMonth> = {}): LienDeskMonth => ({ key, approvedHours: 10, deadline, daysLeft: Math.round((Date.parse(deadline) - Date.parse(TODAY)) / 86400000), noticed: false, fromCreation: false, ...over })
const filing = (over: Partial<JobLienFilingRow> & Record<string, unknown>): JobLienFilingRow => ({ id: 'f', job_id: 'j273', kind: 'notice_53_056', invoice_ids: [], amount: 17585, months_covered: [], fields: {}, sends: [], filed_at: null, county: '', recording_number: '', serve_due: null, served_at: null, created_by: null, created_at: '2026-09-22T20:00:00Z', voided_at: null, ...over }) as JobLienFilingRow
const item = (over: Partial<LienDeskItemRow>): LienDeskItemRow => ({ id: 'it', job_id: 'j273', kind: 'notice_53_056', status: 'awaiting_approval', months: ['2026-07', '2026-08'], fields: {}, cover_note: true, drafted_by: null, drafted_at: '2026-09-22T00:00:00Z', submitted_at: '2026-09-22T00:00:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-22T00:00:00Z', updated_at: '2026-09-22T00:00:00Z', voided_at: null, ...over }) as LienDeskItemRow

// 273 · Dudley (Lennox) on Sep 23: Jul closed Sep 15 (unnoted), Aug open to Oct 15; the Lenox paper (A) went out by hand Sep 22 naming Apr, Jun, Jul, Aug for $28,987 with 858 and 866.
const lenox = filing({ id: 'fA', months_covered: ['2026-04', '2026-06', '2026-07', '2026-08'], sends: [{ recipient: 'owner', method: 'mail', tracking: '', sent_on: '2026-09-22' }], by_hand: true, packet_id: 'p1', printed_claim: 28987, document_url: 'https://drive.google.com/file/d/lenox/view' })
const siblings = [filing({ id: 'f858', job_id: 'j858', amount: 7902, packet_id: 'p1', months_covered: ['2026-04', '2026-06', '2026-07', '2026-08'] }), filing({ id: 'f866', job_id: 'j866', amount: 3500, packet_id: 'p1', months_covered: ['2026-04', '2026-06', '2026-07', '2026-08'] })]

describe('buildLienMonthGrid · months down, papers across (#38)', () => {
  it('draws 273: every month once, the Lenox paper as column A with information checks on the closed months, this notice as column B', () => {
    const grid = buildLienMonthGrid({
      jobId: 'j273',
      months: [month('2026-07', '2026-09-15'), month('2026-08', '2026-10-15')],
      evidence: [{ key: '2026-04', hours: 11, people: 2, dayCount: 3 }, { key: '2026-06', hours: 8, people: 2, dayCount: 2 }, { key: '2026-07', hours: 2.5, people: 1, dayCount: 1 }, { key: '2026-08', hours: 46.4, people: 3, dayCount: 4 }, { key: '2026-09', hours: 0, people: 0, dayCount: 0, pendingHours: 6 }],
      items: [item({})],
      filings: [lenox],
      allFilings: [lenox, ...siblings],
      checked: new Set(['2026-07', '2026-08']),
      thisItem: item({}),
      thisPile: 'awaiting',
      propertyKind: 'residential',
      todayYmd: TODAY,
    })
    expect(grid.papers.map((p) => [p.letter, p.kind, p.sentOn, p.byHand, p.printedClaim, p.packetOthers])).toEqual([['A', 'filing', '2026-09-22', true, 28987, 2], ['B', 'this', '', false, null, 0]])
    expect(grid.rows.map((r) => r.month)).toEqual(['2026-04', '2026-06', '2026-07', '2026-08', '2026-09'])
    const by = Object.fromEntries(grid.rows.map((r) => [r.month, r]))
    // April: closed Jul 15 (residential: 2nd month), named on A after the window — information; noticed, so locked on this notice.
    expect(by['2026-04']!.window).toMatchObject({ state: 'closed', deadline: '2026-06-15', noticed: true })
    expect(by['2026-04']!.cells).toEqual({ fA: 'info', this: 'blank' })
    expect(by['2026-04']!.thisNotice).toEqual({ on: false, locked: true, info: false })
    expect(by['2026-04']!.crew).toBe('2 people · 3 days')
    // July: closed Sep 15, not noted; on this notice as information; A named it after the window too.
    expect(by['2026-07']!.window).toMatchObject({ state: 'closed', deadline: '2026-09-15', noted: false, noticed: true })
    expect(by['2026-07']!.cells).toEqual({ fA: 'info', this: 'info' })
    expect(by['2026-07']!.thisNotice).toEqual({ on: true, locked: true, info: true })
    // August: open to Oct 15, on this notice, named on A in time.
    expect(by['2026-08']!.window).toMatchObject({ state: 'open', deadline: '2026-10-15', daysLeft: 22 })
    expect(by['2026-08']!.cells).toEqual({ fA: 'named', this: 'named' })
    expect(by['2026-08']!.thisNotice.on).toBe(true)
    // September: sessions pending, nothing approved — not a work month yet, its window shown for what it would be.
    expect(by['2026-09']!.pendingOnly).toBe(true)
    expect(by['2026-09']!.window).toMatchObject({ state: 'none', deadline: '2026-11-16' })
    expect(by['2026-09']!.thisNotice.locked).toBe(true)
    expect(grid.earliestOpen).toBe('2026-10-15')
  })
  it('a skip and a noted miss read from the desk items; an unlettered draft with no papers is column A; a sent item is not a second column', () => {
    const skip = item({ id: 'sk', status: 'missed', months: ['2026-05'], fields: { notice: {}, gcEmail: '', skipReason: 'GC paid May by check', skippedBy: { name: 'Taunya', at: '2026-08-01T15:00:00Z' } } as never })
    const noted = item({ id: 'nt', status: 'missed', months: ['2026-06'], fields: { notice: {}, gcEmail: '', windowClosed: { name: 'Taunya', at: '2026-09-20T15:00:00Z' } } as never })
    const grid = buildLienMonthGrid({ jobId: 'j273', months: [month('2026-08', '2026-11-16')], items: [skip, noted], filings: [], checked: new Set(['2026-08']), thisItem: null, thisPile: 'to_draft', propertyKind: '', todayYmd: TODAY })
    expect(grid.papers.map((p) => [p.letter, p.kind])).toEqual([['A', 'this']])
    const by = Object.fromEntries(grid.rows.map((r) => [r.month, r]))
    expect(by['2026-05']!.window).toMatchObject({ state: 'closed', skipped: true, skipReason: 'GC paid May by check', skippedBy: 'Taunya' })
    expect(by['2026-06']!.window).toMatchObject({ state: 'closed', noted: true, notedBy: 'Taunya' })
    expect(by['2026-08']!.thisNotice).toEqual({ on: true, locked: false, info: false })
    const sent = buildLienMonthGrid({ jobId: 'j273', months: [], items: [item({ status: 'sent', sent_at: '2026-09-01T00:00:00Z', months: ['2026-06'] })], filings: [filing({ id: 'fS', months_covered: ['2026-06'], sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407', sent_on: '2026-09-01' }] })], checked: new Set(), thisItem: item({ status: 'sent' }), thisPile: 'sent', propertyKind: '', todayYmd: TODAY })
    expect(sent.papers.map((p) => p.kind)).toEqual(['filing'])
    expect(sent.rows[0]!.cells).toEqual({ fS: 'named', this: 'blank' })
  })
  it('words a paper', () => {
    const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    const label = (m: string) => ({ mail: 'mail', certified_mail: 'certified mail' })[m] ?? m
    const grid = buildLienMonthGrid({ jobId: 'j273', months: [], items: [], filings: [lenox], allFilings: [lenox, ...siblings], checked: new Set(), thisItem: null, thisPile: 'to_draft', propertyKind: '', todayYmd: TODAY })
    expect(lienGridPaperTitle(grid.papers[0]!, (d) => d)).toBe('Sent 2026-09-22 · by hand')
    expect(lienGridPaperWords(grid.papers[0]!, money, label)).toBe('$28,987 with 2 more jobs · mail')
    expect(lienGridPaperTitle(grid.papers[1]!, (d) => d)).toBe('This notice')
    expect(lienGridPaperWords(grid.papers[1]!, money, label)).toBe('')
  })
})
