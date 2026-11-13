import { describe, expect, it } from 'vitest'
import { buildBilledDatesLedger } from './billedDatesLedger'
import { lienActFor } from './lienActWords'
import { lienArChipFor, lienArLedgerTone, type LienArJobInput } from './lienArChip'
import type { LienAffidavitEntry, LienAffidavitGateKey } from './lienDeskAffidavits'
import { lienPhoneChipWords } from './lienLineStep'
import type { LienNextUpAction, LienNextUpRow } from './lienNextUp'
import { buildLienPayRunway, type LienRunwayInput } from './lienPayRunway'
import { buildLienTimeline, type LienTimelineAffidavitState, type LienTimelineInput, type LienTimelineNoticeState } from './lienTimeline'
import { LIEN_WINDOW_TAB_LABEL, lienWindowNextStep } from './lienWindowNextStep'
import { buildLienTimelineFromWindow } from './lienTimelineDesk'
import { lienWindowSwornMonths } from './lienWindowAffidavit'
import type { JobWorkMonths } from './forecastWorkMonths'

/**
 * One job, one reading (v2.7048, punch list #325, PR 5). Four places name a job's next lien step: the Pipeline's
 * billed row (`buildBilledDatesLedger`), the Accounts Receivable chip (`lienArChipFor`), the act table both read
 * (`lienActFor`) and the Lien window's header (`buildLienTimeline`'s Next on the path). They were written at
 * different times and once said *File the lien*, *File the affidavit* and *Affidavit · Notice to draft* of one job.
 * This file holds them to the same step. Since v2.7184 (punch list #335, row 5) the phone row's chip (`lienPhoneChipWords`)
 * is held with them: it read the clock alone (*lien in 4 d*) over a row that named the step. The window's header keeps its own sentence (it names the month and counts
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
/** The phone row's lien chip for the same job: the clock and the desk's word, as `JobsStagesTab` hands them over. */
const phoneChip = (runway: ReturnType<typeof buildLienPayRunway>, chip: ReturnType<typeof chipFor> | null, todayYmd = TODAY) => lienPhoneChipWords(todayYmd, runway, chip ? { act: chip.act, paper: chip.paper, dueOn: chip.dueOn } : null)

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
      expect(phoneChip(buildLienPayRunway(runwayInput()), chip).label).toBe(`${step.act} · 54 d`)
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
    expect(phoneChip(buildLienPayRunway(runwayInput({ noticedMonths: ['2026-08'] })), chip)).toMatchObject({ label: 'File the affidavit · 83 d', tab: 'affidavit' })
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
    expect(phoneChip(runway, null, late)).toMatchObject({ label: 'Send the late notice · 25 d', tab: 'notice' })
    const next = buildLienTimeline(timelineInput({ todayYmd: late, months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'missed', at: '' }] })).next
    expect(next.kind).toBe('late_notice')
    expect(next.words).toMatch(/^Send the .+ notice late/)
    // Past the affidavit's own day both say the lien is gone.
    const after = '2026-12-20'
    expect(rowLabel(buildLienPayRunway(runwayInput({ todayYmd: after })), null, after)).toBe('Lien gone')
    expect(phoneChip(buildLienPayRunway(runwayInput({ todayYmd: after })), null, after).label).toBe('lien gone')
    expect(buildLienTimeline(timelineInput({ todayYmd: after, months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'missed', at: '' }] })).next.kind).toBe('lien_gone')
  })
})

describe('the Lien window’s tab names the paper the row and the header name (v2.7181, punch list #335, row 6)', () => {
  const noticed = { months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'sent' as const, at: '2026-09-10' }], affidavit: { deadline: '2026-12-15', filedAt: null, recordingNumber: '', county: '', servedAt: null, serveDue: null, missingGates: [] } }

  it('a row that reads File the affidavit opens a tab that says affidavit, and so does the header’s button', () => {
    const chip = chipFor(deskRow('affidavit', 'file_affidavit', 'Affidavit approved · ready to file', '2026-12-15'))
    const ledger = buildBilledDatesLedger({ todayYmd: TODAY, row: null, data: null, promise: null, runway: buildLienPayRunway(runwayInput({ noticedMonths: ['2026-08'] })), inCollections: false, lienState: { words: chip.words, tone: lienArLedgerTone(chip.tone), lead: chip.lead, dueOn: chip.dueOn, paper: chip.paper, action: chip.action, act: chip.act } })
    expect(ledger.rows.find((r) => r.action === 'lien-desk')?.label).toBe('File the affidavit')
    expect(ledger.lienTab).toBe('affidavit')
    expect(LIEN_WINDOW_TAB_LABEL[ledger.lienTab!]).toBe('Lien affidavit')
    const t = buildLienTimeline(timelineInput(noticed))
    const step = lienWindowNextStep(t.next, t.waitingOn)
    expect(step.button).toEqual({ label: 'Go to the affidavit', door: { to: 'tab', tab: 'affidavit' } })
    expect(LIEN_WINDOW_TAB_LABEL.affidavit.toLowerCase()).toContain('affidavit')
  })

  it('a notice row opens the tab that says notice', () => {
    const chip = chipFor(deskRow('notice', 'draft', 'Notice to draft', '2026-11-16'))
    const ledger = buildBilledDatesLedger({ todayYmd: TODAY, row: null, data: null, promise: null, runway: buildLienPayRunway(runwayInput()), inCollections: false, lienState: { words: chip.words, tone: lienArLedgerTone(chip.tone), lead: chip.lead, dueOn: chip.dueOn, paper: chip.paper, action: chip.action, act: chip.act } })
    expect(ledger.lienTab).toBe('notice')
    expect(LIEN_WINDOW_TAB_LABEL[ledger.lienTab!]).toBe('§ 53.056 notice')
  })
})

describe('the phone row’s chip names an affidavit’s step as the billed row does (v2.7184, punch list #335, row 5)', () => {
  // The notice is out, so the line is the affidavit's: by Dec 15, 83 days from today.
  const runway = buildLienPayRunway(runwayInput({ noticedMonths: ['2026-08'] }))
  const gate = (key: LienAffidavitGateKey) => ({ key, ok: false, label: key })
  const entry = (missing: LienAffidavitGateKey[]) => ({ jobId: 'j1', gates: missing.map(gate) }) as unknown as LienAffidavitEntry
  const chipWith = (row: LienNextUpRow, missing: LienAffidavitGateKey[] = []) => lienArChipFor({ jobId: 'j1', todayYmd: TODAY, nextUp: [row], entry: null, affidavit: missing.length ? entry(missing) : null, filings: [], piecesByFiling: {}, letterTwo: null } as LienArJobInput)!

  // The Lien window's header for the same paper (v2.7187, punch list #335, row 2): it read *File the affidavit* at every
  // one of these steps. It opens on the act's own first word, with two readings kept apart on purpose. A paper that waits
  // on someone else's approval is *Waiting on Robert* on the row and *Approve the affidavit* in the header, whose second
  // line says who. A hold is the act on the row (*Review the hold*) and the state in the header (*Held*), as a notice's is.
  const STEPS: Array<{ action: LienNextUpAction; state: LienTimelineAffidavitState; sub: string; missing?: LienAffidavitGateKey[]; act: string; dated?: boolean; headerOpens?: string }> = [
    { action: 'draft', state: 'to_draft', sub: 'Affidavit to draft', act: 'Draft the affidavit' },
    { action: 'approve', state: 'awaiting', sub: 'Affidavit · waiting on your approval', act: 'Approve the affidavit' },
    { action: 'approve', state: 'awaiting', sub: 'Affidavit · waiting on Robert · since Sep 20', act: 'Waiting on Robert', headerOpens: 'Approve' },
    { action: 'fix_property', state: 'needs_property', sub: 'Affidavit · the property record is not complete', missing: ['homestead_answer'], act: 'Answer the homestead question' },
    { action: 'fix_property', state: 'needs_property', sub: 'Affidavit · the property record is not complete', missing: ['owner'], act: 'Find the owner' },
    { action: 'fix_property', state: 'needs_property', sub: 'Affidavit · the general contractor has no address on file', missing: ['contractor'], act: 'Add the GC’s address' },
    { action: 'fix_property', state: 'needs_property', sub: 'Affidavit · public property, no lien attaches. Ask the attorney about the bond', missing: ['public_owner'], act: 'Public property, no lien', dated: false },
    { action: 'review_hold', state: 'held', sub: 'Affidavit held', act: 'Review the hold', headerOpens: 'Held' },
  ]
  for (const step of STEPS) {
    it(`an affidavit at "${step.sub}": ${step.act}`, () => {
      const chip = chipWith(deskRow('affidavit', step.action, step.sub, '2026-12-15'), step.missing)
      expect(chip.act?.words).toBe(step.act)
      expect(rowLabel(runway, chip)).toBe(step.act)
      expect(phoneChip(runway, chip)).toMatchObject({ label: step.dated === false ? step.act : `${step.act} · 83 d`, tab: 'affidavit', step: true })
      const next = buildLienTimeline(
        timelineInput({
          months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'sent', at: '2026-09-10' }],
          affidavit: { deadline: '2026-12-15', filedAt: null, recordingNumber: '', county: '', servedAt: null, serveDue: null, missingGates: [], state: step.state, missingKeys: step.missing ?? [] },
        }),
      ).next
      expect(next.kind).toBe('affidavit')
      expect(firstWord(next.words)).toBe(step.headerOpens ?? firstWord(step.act))
      // The header counts the same days the row and the chip count, and none where no lien can attach.
      expect(next.daysLeft).toBe(step.dated === false ? null : 83)
    })
  }
})

describe('a last day set by hand, with approved hours after it: the row and the window count from the same day (v2.7193, punch list #335, row 1)', () => {
  // The owner's reading of 2026-11-13: the day set by hand counts. A commercial sub job with hours in May, the last day
  // set by hand as Jun 12, and hours approved in October. The row's clock counted from June (v2.4830) and read *Lien
  // gone*; the window took October, the later of the two (v2.4676), and read *File the affidavit* with months to spare.
  const month = (key: string, due: string): JobWorkMonths['months'][number] => ({ key, label: key, weeks: [], people: ['M'], hours: 20, pendingHours: 0, dayCount: 3, hoursShare: 50, notice: { due, daysLeft: 0, state: 'open' } as never })
  const wm: JobWorkMonths = { jobId: 'j1', role: 'sub', propertyKind: 'non_residential', months: [month('2026-05', '2026-08-17'), month('2026-10', '2027-01-15')], totalHours: 40, sessionCount: 6, pendingSessions: 0, lastMonthKey: '2026-10', affidavitDue: '2027-02-16' }
  const job = { id: 'j1', created_at: '2026-05-02T00:00:00Z', last_work_date: '2026-10-20', lien_last_work_on: '2026-06-12' }
  const row = (todayYmd: string) => buildLienPayRunway(runwayInput({ todayYmd, lastWorkYmd: job.last_work_date, handLastWorkYmd: job.lien_last_work_on, workMonths: wm.months.map((m) => m.key) }))
  const header = (todayYmd: string) => buildLienTimelineFromWindow({ workMonths: wm, filings: [], job, isSub: true, propertyKind: 'non_residential', openBalance: 4200, todayYmd }).next

  it('both count the affidavit from June: its last day is Oct 15, never a day in 2027', () => {
    const before = '2026-09-23'
    expect(row(before)).toMatchObject({ lienByYmd: '2026-10-15', datedByHand: true })
    expect(header(before).date).toBe('2026-10-15')
    // May's and June's notice windows are closed with none sent: the late notice, on the row, the chip and the header.
    expect(rowLabel(row(before), null, before)).toBe('Send the late notice')
    expect(phoneChip(row(before), null, before).label).toBe('Send the late notice · 22 d')
    expect(header(before).kind).toBe('late_notice')
  })

  it('past that day both say the lien is gone', () => {
    const after = '2026-11-13'
    expect(rowLabel(row(after), null, after)).toBe('Lien gone')
    expect(phoneChip(row(after), null, after).label).toBe('lien gone')
    expect(header(after).kind).toBe('lien_gone')
  })
})

describe('a job nobody clocked on, dated from its bill: the row, the window and the paper count from the same month (v2.7224)', () => {
  // The owner's call of 2026-11-13: with no clock hours the month comes from the bill, not from the day the job was made.
  // A commercial sub job typed in on Aug 18, weeks after its work, whose sent, unpaid bill carries Jul 24. Every reader
  // said August, the month it was typed in: the notice by Nov 16 and the affidavit by Dec 15, a month too generous.
  const bill = { status: 'billed', billed_at: '2026-08-18T06:01:42Z', sent_to_customer_at: '2026-07-24T17:00:00Z' }
  const job = { id: 'j1', created_at: '2026-08-18T05:59:40Z', last_work_date: null, invoices: [bill] }
  const row = (todayYmd: string) => buildLienPayRunway(runwayInput({ todayYmd, lastWorkYmd: null, createdAt: job.created_at, bills: job.invoices }))
  const window = (todayYmd: string) => buildLienTimelineFromWindow({ workMonths: null, filings: [], job, isSub: true, propertyKind: 'non_residential', openBalance: 4200, todayYmd })

  it('all three name July: the notice by Oct 15, the affidavit by Nov 16', () => {
    const before = '2026-09-23'
    expect(row(before)).toMatchObject({ basisYmd: '2026-07-24', noticeByYmd: '2026-10-15', lienByYmd: '2026-11-16', datedFromBill: true })
    const t = window(before)
    expect(t.next).toMatchObject({ kind: 'notice', date: '2026-10-15' })
    expect(t.steps.find((s) => s.kind === 'last_work')?.words).toBe('dated from the bill · no clock hours')
    // The paper's month: a notice that names July and August is read against the job's own month, July.
    const filings = [{ kind: 'notice_53_056', voided_at: null, months_covered: ['2026-07', '2026-08'], sends: [{ recipient: 'owner', method: 'certified_mail', tracking: 't', sent_on: '2026-09-10' }] }]
    expect(lienWindowSwornMonths({ job, workMonths: null, isSub: true, todayYmd: before, filings: filings as never })).toEqual(['2026-07'])
  })

  it('past July’s notice day both ask for the late notice, and past the affidavit’s day both say the lien is gone', () => {
    const late = '2026-10-20'
    expect(rowLabel(row(late), null, late)).toBe('Send the late notice')
    expect(window(late).next.kind).toBe('late_notice')
    const after = '2026-11-20'
    expect(rowLabel(row(after), null, after)).toBe('Lien gone')
    expect(phoneChip(row(after), null, after).label).toBe('lien gone')
    expect(window(after).next.kind).toBe('lien_gone')
  })

  it('with no dated unpaid bill the creation month stands, on the row and in the window alike', () => {
    const made = { ...job, invoices: [{ ...bill, status: 'paid' }] }
    const before = '2026-09-23'
    expect(buildLienPayRunway(runwayInput({ todayYmd: before, lastWorkYmd: null, createdAt: made.created_at, bills: made.invoices }))).toMatchObject({ noticeByYmd: '2026-11-16', lienByYmd: '2026-12-15', datedFromBill: false, datedFromCreation: true })
    expect(buildLienTimelineFromWindow({ workMonths: null, filings: [], job: made, isSub: true, propertyKind: 'non_residential', openBalance: 4200, todayYmd: before }).next).toMatchObject({ kind: 'notice', date: '2026-11-16' })
  })
})
