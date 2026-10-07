/**
 * One evidence rule (punch list #85, item 25): an approved clock session that was
 * not rejected or revoked is evidence — for the hours, the days worked, the GPS
 * count, the sworn-account check and the lien clock — exactly as the timeline's
 * work months count it. A session nobody has approved is said, never counted.
 */
import { describe, expect, it } from 'vitest'
import { makeInvoice, makeJob } from '../../test/renderSmokeMocks'
import { buildLegalPacket, groupCollectionsByPayer, legalSessionWords, type LegalAccountSummary } from './legalPacket'
import { legalLastWorkBasis, legalLastWorkWords, workMonthsFromSessions } from './legalLienPaper'

const TODAY = '2026-09-01'
const s = (jobId: string, day: string, approved: boolean, disqualified = false) => ({ jobId, workDate: day, clockedInAt: `${day}T13:00:00Z`, clockedOutAt: `${day}T21:00:00Z`, hasGps: true, approved, disqualified })

describe('one evidence rule for clock sessions', () => {
  it('counts approved sessions only, says the rest, and the evidence, the lien clock and the timeline agree', () => {
    const job = (id: string, label: string) => makeJob({ id, created_at: '2026-07-01T15:00:00Z', hcp_number: label, status: 'billed', customer_id: 'c1', customer_name: 'Sample', collections_at: '2026-08-25T15:00:00Z', last_work_date: null, invoices: [makeInvoice({ id: `inv-${id}`, amount: 1_000, status: 'billed', billed_at: '2026-06-20T15:00:00Z', sent_to_customer_at: '2026-06-20T15:05:00Z' })] })
    const a = job('j-a', '1042')
    const b = job('j-b', '1189')
    const sessions = [
      s('j-a', '2026-05-14', true), s('j-a', '2026-05-29', true), s('j-a', '2026-06-12', false), s('j-a', '2026-06-20', true, true),
      s('j-b', '2026-08-20', false), s('j-b', '2026-08-21', false),
    ]
    const account = groupCollectionsByPayer([a, b], new Map(), TODAY)[0] as LegalAccountSummary
    const p = buildLegalPacket({ todayYmd: TODAY, account, customer: null, contacts: [], contactEntries: [], addresses: [], contracts: [], signedEstimates: [], demandLetters: [], lienFilings: [], promises: [], promiseOutcomes: [], chaseTouches: [], reports: [], clockSessions: sessions, threadNotes: [], users: [] })
    const ev = Object.fromEntries(p.evidence.map((e) => [e.jobLabel, e]))
    const clock = Object.fromEntries(p.paper.lienClock.map((c) => [c.jobLabel, c]))

    // Job 1042: two approved May days count; the June session waits; the rejected one is gone.
    expect(ev['1042']).toEqual(expect.objectContaining({ sessions: 2, awaitingApproval: 1, sessionsWithGps: 2, hours: 16, firstWorkYmd: '2026-05-14', lastWorkYmd: '2026-05-29' }))
    expect(legalSessionWords(ev['1042']!)).toBe('2 approved (2 with GPS) · 1 awaiting approval')
    expect(clock['1042']?.lastWorkYmd).toBe('2026-05-29')
    expect(workMonthsFromSessions('j-a', sessions, { isSub: false, propertyKind: '' })?.months.map((m) => m.key)).toEqual(['2026-05'])

    // Job 1189: nothing approved — no hours, no work day, the same as the timeline, and the desk is told why.
    expect(ev['1189']).toEqual(expect.objectContaining({ sessions: 0, awaitingApproval: 2, hours: 0, firstWorkYmd: null, lastWorkYmd: null }))
    expect(legalSessionWords(ev['1189']!)).toBe('0 approved · 2 awaiting approval')
    // No approved session and no last work date: the clock and the Paper tab both run from the creation month, and say so.
    expect(clock['1189']).toEqual(expect.objectContaining({ lastWorkYmd: '2026-07-01', lastWorkSource: 'created' }))
    const t1189 = p.paper.timelines.find((t) => t.jobLabel === '1189')
    expect(t1189).toEqual(expect.objectContaining({ lastWorkYmd: '2026-07-01', lastWorkSource: 'created' }))
    expect(legalLastWorkWords(t1189!.lastWorkYmd, t1189!.lastWorkSource)).toBe("no work date on file: dated from the job's creation month, 2026-07")
    expect(workMonthsFromSessions('j-b', sessions, { isSub: false, propertyKind: '' })).toBeNull()
    expect(p.account.jobs.find((j) => j.label === '1189')?.swornMissing).toContain('field evidence on the property')
    expect(p.gaps.find((g) => g.key === 'evidence:j-b')?.detail).toMatch(/2 clock sessions are awaiting approval/)
  })
})

describe('legalLastWorkBasis · one fallback chain (item 25)', () => {
  it('the last approved session, else the last work date, else the creation day, else nothing', () => {
    expect(legalLastWorkBasis(['2026-05-14', '2026-05-29'], { last_work_date: '2026-06-30', created_at: '2026-01-01T15:00:00Z' })).toEqual({ ymd: '2026-05-29', source: 'sessions' })
    expect(legalLastWorkBasis([], { last_work_date: '2026-06-30', created_at: '2026-01-01T15:00:00Z' })).toEqual({ ymd: '2026-06-30', source: 'last_work_date' })
    expect(legalLastWorkBasis([], { last_work_date: null, created_at: '2026-01-01T15:00:00Z' })).toEqual({ ymd: '2026-01-01', source: 'created' })
    expect(legalLastWorkBasis([], {})).toEqual({ ymd: null, source: 'none' })
    expect(legalLastWorkWords('2026-06-30', 'last_work_date')).toBe('last work date on the job 2026-06-30 (no approved clock session)')
    expect(legalLastWorkWords('2026-05-29', 'sessions')).toBe('last approved clock day 2026-05-29')
  })
})
