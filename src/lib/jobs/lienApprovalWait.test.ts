import { describe, expect, it } from 'vitest'
import { lienApprovalWaitWords, lienApproverFor, lienLeaderWords } from './lienApprovalWait'
import { lienActFor } from './lienActWords'
import { lienArChipFor, type LienArJobInput } from './lienArChip'
import type { LienAffidavitEntry } from './lienDeskAffidavits'
import type { LienDeskItemRow, LienNoticeMonthRow } from './lienDesk'
import type { LienNextUpAction, LienNextUpRow } from './lienNextUp'
import { buildLienTimeline, lienFirmWaitingOn, lienMoveWords, type LienTimelineInput } from './lienTimeline'
import { buildLienTimelineFromDesk, buildLienTimelineFromWindow, lienWindowDeskAffidavit, lienWindowDeskNotice } from './lienTimelineDesk'
import type { JobWorkMonths } from './forecastWorkMonths'

/**
 * A paper sent for approval names who it waits on, in the header as on the row (punch list #335, Also seen).
 * The row read *Waiting on Rosa*; the header's second line read *the leader’s approval of the notice*. Rosa is a
 * made-up leader, and so are the job and its numbers.
 */

const TODAY = '2026-09-23'
const timelineInput = (over: Partial<LienTimelineInput> = {}): LienTimelineInput => ({
  todayYmd: TODAY,
  isSub: true,
  propertyKind: 'non_residential',
  lastMonth: '2026-08',
  lastMonthFromCreation: false,
  months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'open', at: '' }],
  noticeState: 'awaiting',
  retainage: null,
  affidavit: null,
  originalContractCompletedOn: null,
  releasedAt: null,
  paid: false,
  ...over,
})
// An affidavit sent for approval, on a job whose August notice went out.
const affidavitAwaiting = (over: Partial<LienTimelineInput> = {}): LienTimelineInput =>
  timelineInput({
    months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'sent', at: '2026-09-10' }],
    noticeState: 'sent',
    affidavit: { deadline: '2026-12-15', filedAt: null, recordingNumber: '', county: '', servedAt: null, serveDue: null, missingGates: [], state: 'awaiting', missingKeys: [] },
    ...over,
  })
const deskRow = (kind: 'notice' | 'affidavit', action: LienNextUpAction, sub: string): LienNextUpRow =>
  ({ key: `${kind}:j1`, kind, jobId: 'j1', gcId: 'g1', title: '412 · Made-up job', sub, dueOn: '2026-11-16', daysLeft: 54, severity: 'quiet', group: 'coming', action, button: null, target: kind === 'notice' ? { open: 'notices', jobId: 'j1', pile: 'awaiting' } : { open: 'affidavits', jobId: 'j1' } }) as LienNextUpRow
const chipFor = (row: LienNextUpRow) => lienArChipFor({ jobId: 'j1', todayYmd: TODAY, nextUp: [row], entry: null, affidavit: null, filings: [], piecesByFiling: {}, letterTwo: null } as LienArJobInput)!
/** The header's second line as the strip draws it: *Waiting on us — Rosa’s approval of the notice*. */
const headerLine = (input: LienTimelineInput) => {
  const t = buildLienTimeline(input)
  return t.waitingOn ? `Waiting on ${lienMoveWords(t.waitingOn.who)} — ${t.waitingOn.words}` : ''
}

describe('the words', () => {
  it('names the leader, falls back to the leader, and says your to the leader himself', () => {
    expect(lienLeaderWords('Rosa')).toBe('Rosa')
    expect(lienLeaderWords('  Rosa ')).toBe('Rosa')
    expect(lienLeaderWords('')).toBe('the leader')
    expect(lienLeaderWords(null)).toBe('the leader')
    expect(lienApprovalWaitWords('notice', { name: 'Rosa' })).toBe('Rosa’s approval of the notice')
    expect(lienApprovalWaitWords('affidavit', { name: 'Rosa' })).toBe('Rosa’s approval of the affidavit')
    expect(lienApprovalWaitWords('notice')).toBe('the leader’s approval of the notice')
    expect(lienApprovalWaitWords('affidavit', { name: '  ' })).toBe('the leader’s approval of the affidavit')
    expect(lienApprovalWaitWords('notice', { name: 'Rosa', yours: true })).toBe('your approval of the notice')
  })

  it('whose approval it is follows the row’s rule: a leader on his own job, or on a job with no leader set', () => {
    expect(lienApproverFor({ leaderName: 'Rosa', masterUserId: 'u-rosa', viewerUserId: 'u-rosa', role: 'master_technician' })).toEqual({ name: 'Rosa', yours: true })
    // The office reads the name.
    expect(lienApproverFor({ leaderName: 'Rosa', masterUserId: 'u-rosa', viewerUserId: 'u-office', role: 'assistant' })).toEqual({ name: 'Rosa', yours: false })
    // Another leader's job: his name, not *your*.
    expect(lienApproverFor({ leaderName: 'Rosa', masterUserId: 'u-rosa', viewerUserId: 'u-other', role: 'master_technician' })).toEqual({ name: 'Rosa', yours: false })
    // No leader on the job: a leader who looks is the one it waits on, the office reads *the leader*.
    expect(lienApproverFor({ leaderName: '', masterUserId: null, viewerUserId: 'u-other', role: 'master_technician' })).toEqual({ name: null, yours: true })
    expect(lienApproverFor({ leaderName: '', masterUserId: null, viewerUserId: 'u-office', role: 'controller' })).toEqual({ name: null, yours: false })
  })
})

describe('the row and the header name the same leader (punch list #335, Also seen)', () => {
  it('a notice sent for approval: Waiting on Rosa on the row, Rosa’s approval in the header', () => {
    const chip = chipFor(deskRow('notice', 'approve', 'Waiting on Rosa · since Sep 20'))
    expect(chip.act?.words).toBe('Waiting on Rosa')
    expect(headerLine(timelineInput({ approver: { name: 'Rosa' } }))).toBe('Waiting on us — Rosa’s approval of the notice')
  })

  it('an affidavit sent for approval reads the same two ways', () => {
    const chip = chipFor(deskRow('affidavit', 'approve', 'Affidavit · waiting on Rosa · since Sep 20'))
    expect(chip.act?.words).toBe('Waiting on Rosa')
    const input = affidavitAwaiting({ approver: { name: 'Rosa' } })
    expect(buildLienTimeline(input).next.words).toMatch(/^Approve the affidavit/)
    expect(headerLine(input)).toBe('Waiting on us — Rosa’s approval of the affidavit')
  })

  it('with no name both keep the leader, the words from before', () => {
    expect(chipFor(deskRow('notice', 'approve', 'Waiting on the leader')).act?.words).toBe('Waiting on the leader')
    expect(lienActFor({ paper: 'notice', action: 'approve', waitingOn: '  ' })?.words).toBe('Waiting on the leader')
    expect(lienActFor({ paper: 'affidavit', action: 'send_notice', noticeStanding: 'awaiting' })?.words).toBe('Waiting on the leader')
    expect(headerLine(timelineInput())).toBe('Waiting on us — the leader’s approval of the notice')
    expect(headerLine(affidavitAwaiting({ approver: null }))).toBe('Waiting on us — the leader’s approval of the affidavit')
  })

  it('the leader himself reads Approve on the row and your approval in the header', () => {
    expect(chipFor(deskRow('notice', 'approve', 'Waiting on your approval')).act?.words).toBe('Approve the notice')
    expect(headerLine(timelineInput({ approver: { name: 'Rosa', yours: true } }))).toBe('Waiting on us — your approval of the notice')
    expect(headerLine(affidavitAwaiting({ approver: { name: 'Rosa', yours: true } }))).toBe('Waiting on us — your approval of the affidavit')
  })

  it('a paper on any other step reads as it did, named or not', () => {
    for (const state of ['needs_owner', 'to_draft', 'ready', 'printed', 'held'] as const) {
      expect(headerLine(timelineInput({ noticeState: state, approver: { name: 'Rosa' } }))).toBe(headerLine(timelineInput({ noticeState: state })))
    }
    const toDraft = (approver: LienTimelineInput['approver']) => affidavitAwaiting({ approver, affidavit: { ...affidavitAwaiting().affidavit!, state: 'to_draft' } })
    expect(headerLine(toDraft({ name: 'Rosa' }))).toBe(headerLine(toDraft(null)))
    expect(headerLine(toDraft(null))).toBe('Waiting on us — the affidavit to be drafted')
  })

  it('the firm’s page, which is handed no leader, reads the words from before', () => {
    expect(lienFirmWaitingOn(buildLienTimeline(timelineInput()))).toEqual({ who: 'the office', words: 'the leader’s approval of the notice' })
  })
})

describe('the two builders hand the leader through', () => {
  const month = { key: '2026-07', label: 'Jul 2026', hours: 20, notice: { due: '2026-10-15', daysLeft: 22 } } as unknown as JobWorkMonths['months'][number]
  const wm: JobWorkMonths = { jobId: 'j1', role: 'sub', propertyKind: 'non_residential', months: [month], totalHours: 20, sessionCount: 3, pendingSessions: 0, lastMonthKey: '2026-07', affidavitDue: '2026-11-16' }
  const src = { workMonths: wm, filings: [], job: { id: 'j1', created_at: '2026-05-02T00:00:00Z', last_work_date: '2026-07-20' }, isSub: true, propertyKind: 'non_residential', openBalance: 5_000, todayYmd: TODAY }
  const entry = (pile: string) => ({ pile, item: null, gates: [] }) as never

  it('the Lien window: the opener’s leader reaches the header of a notice and of an affidavit', () => {
    const notice = buildLienTimelineFromWindow({ ...src, deskNotice: lienWindowDeskNotice(entry('awaiting')), approver: { name: 'Rosa' } })
    expect(notice.next.words).toBe('Approve the Jul notice — 22 days.')
    expect(notice.waitingOn).toEqual({ who: 'ours', words: 'Rosa’s approval of the notice' })
    const sent = [{ id: 'n1', job_id: 'j1', kind: 'notice_53_056', months_covered: ['2026-07'], filed_at: '2026-09-01', created_at: '2026-09-01T15:00:00Z', voided_at: null }] as never
    const affidavit = buildLienTimelineFromWindow({ ...src, filings: sent, deskAffidavit: lienWindowDeskAffidavit(entry('awaiting')), approver: { name: 'Rosa' } })
    expect(affidavit.next.kind).toBe('affidavit')
    expect(affidavit.waitingOn).toEqual({ who: 'ours', words: 'Rosa’s approval of the affidavit' })
    // An opener with no name to give: the words from before.
    expect(buildLienTimelineFromWindow({ ...src, deskNotice: lienWindowDeskNotice(entry('awaiting')) }).waitingOn?.words).toBe('the leader’s approval of the notice')
  })

  it('the Lien desk’s own path: the pane’s leader reaches it the same way', () => {
    const affidavit = { ...(entry('awaiting') as object), jobId: 'j1', isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: '2026-11-16', daysLeft: 54 } as LienAffidavitEntry
    const row = { job_id: 'j1', work_month: '2026-07', approved_hours: 20, deadline: '2026-10-15', noticed: true } as unknown as LienNoticeMonthRow
    const sent = { id: 'i1', job_id: 'j1', kind: 'notice_53_056', status: 'sent', months: ['2026-07'], sent_at: '2026-09-01T15:00:00Z', voided_at: null, created_at: '2026-08-30T00:00:00Z', fields: {} } as unknown as LienDeskItemRow
    const desk = { rows: [row], items: [sent], filings: [], entry: null, affidavit, isSub: true, propertyKind: 'non_residential', openBalance: 5_000, todayYmd: TODAY }
    expect(buildLienTimelineFromDesk('j1', { ...desk, approver: { name: 'Rosa' } }).waitingOn).toEqual({ who: 'ours', words: 'Rosa’s approval of the affidavit' })
    expect(buildLienTimelineFromDesk('j1', { ...desk, approver: { name: 'Rosa', yours: true } }).waitingOn).toEqual({ who: 'ours', words: 'your approval of the affidavit' })
    expect(buildLienTimelineFromDesk('j1', desk).waitingOn).toEqual({ who: 'ours', words: 'the leader’s approval of the affidavit' })
  })
})
