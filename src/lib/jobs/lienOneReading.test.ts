import { describe, expect, it } from 'vitest'
import { buildBilledDatesLedger } from './billedDatesLedger'
import { lienActFor } from './lienActWords'
import { lienArChipFor, lienArLedgerTone, type LienArJobInput } from './lienArChip'
import type { LienNextUpAction, LienNextUpRow } from './lienNextUp'
import { buildLienPayRunway, type LienRunwayInput } from './lienPayRunway'
import { buildLienTimeline, type LienTimelineInput, type LienTimelineNoticeState } from './lienTimeline'

/**
 * One job, one reading (v2.7048, punch list #325, PR 5). Four places name a job's next lien step: the Pipeline's
 * billed row (`buildBilledDatesLedger`), the Accounts Receivable chip (`lienArChipFor`), the act table both read
 * (`lienActFor`) and the Lien window's header (`buildLienTimeline`'s Next on the path). They were written at
 * different times and once said *File the lien*, *File the affidavit* and *Affidavit · Notice to draft* of one job.
 * This file holds them to the same step. The window's header keeps its own sentence (it names the month and counts
 * the days), so what is held there is the verb it opens on.
 */

const TODAY = '2026-09-23'
// A commercial sub job last worked in August: the notice by Nov 16, the affidavit by Dec 15.
const runwayInput = (over: Partial<LienRunwayInput> = {}): LienRunwayInput => ({ todayYmd: TODAY, openBalance: 4200, lastWorkYmd: '2026-08-14', propertyKind: 'non_residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null, isSub: true, ...over })
const timelineInput = (over: Partial<LienTimelineInput> = {}): LienTimelineInput => ({
  todayYmd: TODAY,
  isSub: true,
  propertyKind: 'non_residential',
  lastMonth: '2026-08',
  lastMonthFromCreation: false,
  months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'open', at: '' }],
  noticeState: 'to_draft',
  retainage: null,
  affidavit: null,
  originalContractCompletedOn: null,
  releasedAt: null,
  paid: false,
  ...over,
})
const deskRow = (kind: 'notice' | 'affidavit', action: LienNextUpAction, sub: string, dueOn: string): LienNextUpRow =>
  ({ key: `${kind}:j1`, kind, jobId: 'j1', gcId: 'g1', title: '412 · Made-up job', sub, dueOn, daysLeft: 54, severity: 'quiet', group: 'coming', action, button: null, target: kind === 'notice' ? { open: 'notices', jobId: 'j1', pile: 'to_draft' } : { open: 'affidavits', jobId: 'j1' } }) as LienNextUpRow
const chipFor = (row: LienNextUpRow) => lienArChipFor({ jobId: 'j1', todayYmd: TODAY, nextUp: [row], entry: null, affidavit: null, filings: [], piecesByFiling: {}, letterTwo: null } as LienArJobInput)!
const rowLabel = (runway: ReturnType<typeof buildLienPayRunway>, chip: ReturnType<typeof chipFor> | null, todayYmd = TODAY) =>
  buildBilledDatesLedger({ todayYmd, row: null, data: null, promise: null, runway, inCollections: false, lienState: chip ? { words: chip.words, tone: lienArLedgerTone(chip.tone), lead: chip.lead, dueOn: chip.dueOn, paper: chip.paper, action: chip.action, act: chip.act } : null }).rows.find((r) => r.action === 'lien-desk')?.label
const firstWord = (s: string) => s.split(/[\s,]/)[0]

describe('one job reads one way on the billed row, the AR chip and the Lien window’s header (v2.7048)', () => {
  const NOTICE_STEPS: Array<{ state: LienTimelineNoticeState; action: LienNextUpAction; sub: string; act: string; chipSaysState?: boolean }> = [
    { state: 'needs_owner', action: 'find_owner', sub: 'Needs the owner of record', act: 'Find the owner' },
    { state: 'to_draft', action: 'draft', sub: 'Notice to draft', act: 'Draft the notice' },
    { state: 'awaiting', action: 'approve', sub: 'Waiting on your approval', act: 'Approve the notice' },
    { state: 'ready', action: 'send', sub: 'Approved · ready to send', act: 'Send the notice' },
    // v2.7077: a printed notice has its own step on the path, so the header no longer falls back to *Draft*.
    // The chip keeps the state it always said of a paper that is out (*In the mail*); the row and the header name the act.
    { state: 'printed', action: 'add_tracking', sub: 'In the mail · tracking owed', act: 'Record the mailing', chipSaysState: true },
  ]
  for (const step of NOTICE_STEPS) {
    it(`a notice at "${step.state}": ${step.act}`, () => {
      const chip = chipFor(deskRow('notice', step.action, step.sub, '2026-11-16'))
      expect(lienActFor({ paper: 'notice', action: step.action, yours: true })?.words).toBe(step.act)
      expect(chip.act?.words).toBe(step.act)
      if (!step.chipSaysState) {
        expect(chip.lead).toBe(step.act)
        expect(chip.words).toBe(`${step.act} · by Nov 16 · 54d`)
      }
      expect(rowLabel(buildLienPayRunway(runwayInput()), chip)).toBe(step.act)
      const next = buildLienTimeline(timelineInput({ noticeState: step.state })).next
      expect(next.kind).toBe('notice')
      expect(firstWord(next.words)).toBe(firstWord(step.act))
    })
  }

  it('an affidavit ready to file: File the affidavit, everywhere', () => {
    const noticed = { months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'sent' as const, at: '2026-09-10' }], affidavit: { deadline: '2026-12-15', filedAt: null, recordingNumber: '', county: '', servedAt: null, serveDue: null, missingGates: [] } }
    const chip = chipFor(deskRow('affidavit', 'file_affidavit', 'Affidavit approved · ready to file', '2026-12-15'))
    expect(chip.lead).toBe('File the affidavit')
    expect(rowLabel(buildLienPayRunway(runwayInput({ noticedMonths: ['2026-08'] })), chip)).toBe('File the affidavit')
    const next = buildLienTimeline(timelineInput(noticed)).next
    expect(next.kind).toBe('affidavit')
    expect(next.words.startsWith('File the affidavit')).toBe(true)
    // With no desk row at all the asking row still names the same paper (it read *File the lien* before v2.7042).
    expect(rowLabel(buildLienPayRunway(runwayInput({ todayYmd: '2026-12-01', noticedMonths: ['2026-08'] })), null, '2026-12-01')).toBe('File the affidavit')
  })

  it('a notice window closed with the affidavit’s day still ahead: a late notice on the row and in the window, never Lien gone', () => {
    const late = '2026-11-20'
    const runway = buildLienPayRunway(runwayInput({ todayYmd: late }))
    expect(runway).toMatchObject({ state: 'closed', closedBy: 'notice' })
    expect(rowLabel(runway, null, late)).toBe('Send the late notice')
    const next = buildLienTimeline(timelineInput({ todayYmd: late, months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'missed', at: '' }] })).next
    expect(next.kind).toBe('late_notice')
    expect(next.words).toMatch(/^Send the .+ notice late/)
    // Past the affidavit's own day both say the lien is gone.
    const after = '2026-12-20'
    expect(rowLabel(buildLienPayRunway(runwayInput({ todayYmd: after })), null, after)).toBe('Lien gone')
    expect(buildLienTimeline(timelineInput({ todayYmd: after, months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'missed', at: '' }] })).next.kind).toBe('lien_gone')
  })
})
