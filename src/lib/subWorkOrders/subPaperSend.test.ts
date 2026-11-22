import { describe, expect, it } from 'vitest'
import { buildPaymentRecord, buildStatementOfAccount, buildWorkStatement, paperSendings, type PaperContext, type PaperMoneyLine, type PaperSheet } from '../../../supabase/functions/_shared/subPapers'
import { SUB_PAPER_SEND_BY, SUB_PAPER_SEND_MAX, subPaperAttachmentName, subPaperEmailDoor, subPaperNotSentWords, subPaperSendPlan, subPaperSendSet, subPaperSendSubject, subPaperSentWords, type SubPaper } from './subPaperSend'

// Made-up people, jobs and money.
const CTX: PaperContext = { company: { name: 'Made-up Plumbing Co.', lines: [] }, sub: { name: 'Harlan Mechanical', lines: [] }, today: '2026-11-16', preparedAt: 'Nov 16, 2026 at 9:30 am', zone: 'Central time' }
const money = (id: string, amount: number, ymd: string, over: Partial<PaperMoneyLine> = {}): PaperMoneyLine => ({ id, amount, ymd, recorded: false, at: `${ymd}T16:00:00Z`, how: amount > 0 ? 'Check 1182' : '', memo: '', sendingId: null, sendingNo: null, fromCredit: false, creditKept: 0, clientDirect: false, ...over })
const sheet = (id: string, jobNumber: string, day: string, amount: number, lines: PaperMoneyLine[] = [], number = ''): PaperSheet => ({ id, number, revision: 1, replacesCopyOf: '', jobNumber, jobName: 'Cedar Hollow Clinic', address: '1 Made-up Way', day, lines: [{ label: 'Rough-in', amount }], money: lines, confirm: null })
const SHEETS: PaperSheet[] = [sheet('cedar-1', '2041', '2026-10-28', 4200, [money('p226', 1500, '2026-10-31', { sendingId: 'snd226', sendingNo: 226 })], 'WS-2041-1'), sheet('ridge-1', '2057', '2026-11-03', 2500)]
const STATEMENT = buildStatementOfAccount(SHEETS, { from: null, to: null }, CTX)
const WORK = SHEETS.map((s) => buildWorkStatement(s, CTX))
const RECORD = buildPaymentRecord(paperSendings(SHEETS)[0]!, SHEETS, CTX)
const base = { company: 'Made-up Plumbing Co.', subName: 'Harlan Mechanical', phone: null, portalUrl: null, lastPayment: { amount: 1500, day: 'Oct 31, 2026' } }

describe('subPaperSendPlan: by email', () => {
  it('a statement of account with its work statements: the message, the files and the press with its count', () => {
    const plan = subPaperSendPlan({ ...base, lead: STATEMENT, attached: WORK, by: 'email', email: 'harlan@harlanmechanical.example' })
    expect(plan.subject).toBe('Your statement of account from Made-up Plumbing Co.')
    expect(plan.body).toBe('Hi Harlan Mechanical. Here is your statement to date, Nov 16, 2026. We still have $5,200.00 open with you. Our last payment was $1,500.00 on Oct 31, 2026.')
    // A period with a first day reads *for*, and one with a last day alone reads *to*.
    const cut = (from: string | null, to: string | null) => subPaperSendPlan({ ...base, lead: buildStatementOfAccount(SHEETS, { from, to }, CTX), attached: [], by: 'email', email: 'harlan@harlanmechanical.example' }).body
    expect(cut('2026-11-01', '2026-11-16')).toContain('Here is your statement for Nov 1, 2026 to Nov 16, 2026.')
    expect(cut(null, '2026-11-10')).toContain('Here is your statement to Nov 10, 2026.')
    expect(plan.files).toEqual(['Statement of account.pdf', 'WS-2041-1.pdf', 'Work statement 2057 Cedar Hollow Clinic.pdf'])
    expect(plan.steps).toEqual(['The PDFs are made and numbered.', 'The email goes to harlan@harlanmechanical.example with 3 files.', 'A copy is filed under Sent copies, on the sub and on each job.'])
    expect(plan).toMatchObject({ confirmLabel: 'Send 3 papers by email', blocked: null, needs: null, held: null })
  })

  it('a payment record alone says what was sent, how, and what stays open', () => {
    const plan = subPaperSendPlan({ ...base, lead: RECORD, attached: [], by: 'email', email: 'harlan@harlanmechanical.example' })
    expect(plan.subject).toBe('Payment record PR-0226 from Made-up Plumbing Co.')
    expect(plan.body).toBe('Hi Harlan Mechanical. We sent you $1,500.00 on Oct 31, 2026 by Check 1182. The record shows how much went to each statement. $2,700.00 is still open with you after it.')
    // It carries its sending's number already, so nothing is left to number.
    expect(plan.steps[0]).toBe('The PDF is made.')
    expect(plan.confirmLabel).toBe('Send 1 paper by email')
  })

  it('a sub with no email has a dead press, and the plan says what it waits on', () => {
    const one = subPaperSendPlan({ ...base, lead: WORK[1]!, attached: [], by: 'email', email: null })
    expect(one).toMatchObject({ confirmLabel: null, needs: 'email', blocked: 'Harlan Mechanical has no email on the roster, so there is nowhere to send it.' })
    const three = subPaperSendPlan({ ...base, lead: STATEMENT, attached: WORK, by: 'email', email: null })
    expect(three.blocked).toBe('Harlan Mechanical has no email on the roster, so there is nowhere to send them.')
    // The window draws the door after the reason. The paper itself is not held up.
    expect(subPaperEmailDoor().words).toBe('Print or download the paper for now. A dev can add an email to their roster row.')
  })

  it('an address the window could not read is not a missing one: the press stays live', () => {
    const plan = subPaperSendPlan({ ...base, lead: WORK[1]!, attached: [], by: 'email', email: null, emailUnread: true })
    expect(plan).toMatchObject({ confirmLabel: 'Send 1 paper by email', blocked: null, needs: null })
    expect(plan.steps[1]).toBe('The email goes to the address on their roster row with 1 file.')
  })

  it('no word of the message says invoice, receipt or owed', () => {
    for (const lead of [STATEMENT, WORK[0]!, RECORD] as SubPaper[]) {
      const plan = subPaperSendPlan({ ...base, lead, attached: [], by: 'email', email: 'harlan@harlanmechanical.example' })
      expect(`${plan.subject} ${plan.body} ${plan.files.join(' ')} ${plan.steps.join(' ')}`).not.toMatch(/\binvoice\b|\breceipt\b|\bowed\b/i)
    }
  })
})

describe('subPaperSendSubject: the subject names the number on the file', () => {
  const COMPANY = 'Made-up Plumbing Co.'

  it('a sheet’s first work statement has no number in the step, and names it once the press has numbered it', () => {
    // As previewed: the sheet has no work statement yet.
    expect(subPaperSendSubject(WORK[1]!, COMPANY)).toBe('Work statement from Made-up Plumbing Co.')
    // As made: the same sheet under the number the register answered. Its file is `WS-2057-1.pdf`.
    const numbered = buildWorkStatement({ ...SHEETS[1]!, number: 'WS-2057-1' }, CTX)
    expect(subPaperSendSubject(numbered, COMPANY)).toBe('Work statement WS-2057-1 from Made-up Plumbing Co.')
    expect(subPaperAttachmentName(numbered)).toBe('WS-2057-1.pdf')
  })

  it('a payment record carries its sending’s number from the start, and one from before sendings has none', () => {
    expect(subPaperSendSubject(RECORD, COMPANY)).toBe('Payment record PR-0226 from Made-up Plumbing Co.')
    expect(subPaperSendSubject({ ...RECORD, number: '' }, COMPANY)).toBe('Payment record from Made-up Plumbing Co.')
  })

  it('a statement of account reads the same before and after its number', () => {
    const numbered = buildStatementOfAccount(SHEETS, { from: null, to: null }, CTX, { number: 'SA-0007' })
    expect(subPaperSendSubject(STATEMENT, COMPANY)).toBe('Your statement of account from Made-up Plumbing Co.')
    expect(subPaperSendSubject(numbered, COMPANY)).toBe('Your statement of account from Made-up Plumbing Co.')
  })

  it('the step shows the same words for the paper it was handed', () => {
    for (const lead of [STATEMENT, WORK[0]!, WORK[1]!, RECORD] as SubPaper[]) {
      expect(subPaperSendPlan({ ...base, lead, attached: [], by: 'email', email: 'harlan@harlanmechanical.example' }).subject).toBe(subPaperSendSubject(lead, COMPANY))
    }
  })
})

describe('subPaperSendSet: one email carries so many papers', () => {
  const many: SubPaper[] = Array.from({ length: 14 }, (_, i) => buildWorkStatement(sheet(`s${i}`, String(3001 + i), '2026-10-01', 100), CTX))

  it('the limit is the function’s own', () => {
    expect(SUB_PAPER_SEND_MAX).toBe(12)
  })

  it('everything rides when it fits', () => {
    expect(subPaperSendSet(WORK)).toEqual({ attached: WORK, held: [] })
    expect(subPaperSendSet(many.slice(0, 11)).held).toEqual([])
  })

  it('past the limit the first ride with the lead and the rest are held, in the order given', () => {
    const set = subPaperSendSet(many)
    expect(set.attached).toHaveLength(11)
    expect(set.held.map((p) => (p.kind === 'work_statement' ? p.job.label : ''))).toEqual(['#3012 Cedar Hollow Clinic', '#3013 Cedar Hollow Clinic', '#3014 Cedar Hollow Clinic'])
    const plan = subPaperSendPlan({ ...base, lead: STATEMENT, ...set, by: 'email', email: 'harlan@harlanmechanical.example' })
    expect(plan.confirmLabel).toBe('Send 12 papers by email')
    expect(plan.held).toBe('3 more papers do not fit, since one email carries 12. Send them next: the work statement for #3012 Cedar Hollow Clinic, the work statement for #3013 Cedar Hollow Clinic, the work statement for #3014 Cedar Hollow Clinic.')
    const one = subPaperSendPlan({ ...base, lead: STATEMENT, attached: set.attached, held: [WORK[0]!], by: 'email', email: 'harlan@harlanmechanical.example' })
    expect(one.held).toBe('1 more paper does not fit, since one email carries 12. Send it next: WS-2041-1.')
  })
})

describe('what the window says after the press', () => {
  it('names how many went, to whom and where the copies are', () => {
    expect(subPaperSentWords({ count: 1, subName: 'Harlan Mechanical', to: 'harlan@harlanmechanical.example' })).toBe('Sent 1 paper to Harlan Mechanical at harlan@harlanmechanical.example. A copy is under Documents → Sent copies.')
    expect(subPaperSentWords({ count: 3, subName: 'Harlan Mechanical', to: null })).toBe('Sent 3 papers to Harlan Mechanical. The copies are under Documents → Sent copies.')
  })

  it('a send that did not go says why, and names a statement of account that took a number for nothing', () => {
    const numbered = buildStatementOfAccount(SHEETS, { from: null, to: null }, CTX, { number: 'SA-0007' })
    expect(subPaperNotSentWords({ reason: 'The email did not go: The domain is not verified', numbered: [numbered, ...WORK] })).toBe('Nothing was sent: The email did not go: The domain is not verified. SA-0007 took its number and did not go. The next send takes a new one.')
    // A work statement keeps its number for its sheet, and a payment record carries its sending's: neither is spent.
    expect(subPaperNotSentWords({ reason: 'Harlan Mechanical has no email on the roster. Add one on People → Subs, then send.', numbered: [WORK[0]!, RECORD] })).toBe('Nothing was sent: Harlan Mechanical has no email on the roster. Add one on People → Subs, then send.')
    // Refused before any paper was registered.
    expect(subPaperNotSentWords({ reason: '', numbered: [] })).toBe('Nothing was sent: no reason was given.')
  })
})

describe('the ways a paper may go', () => {
  it('keeps the words of the ways that are not built, so a window offers only what it is handed', () => {
    expect(SUB_PAPER_SEND_BY.map((o) => o.key)).toEqual(['email', 'text', 'link'])
    const text = subPaperSendPlan({ ...base, lead: STATEMENT, attached: [], by: 'text', email: null })
    expect(text).toMatchObject({ confirmLabel: null, needs: null, held: null, blocked: 'Harlan Mechanical has no page to link to yet. Open their portal link on People → Subs first.' })
  })

  it('a file is named for its number, else for what it is', () => {
    expect([STATEMENT, WORK[0]!, WORK[1]!, RECORD].map(subPaperAttachmentName)).toEqual(['Statement of account.pdf', 'WS-2041-1.pdf', 'Work statement 2057 Cedar Hollow Clinic.pdf', 'PR-0226 Payment record.pdf'])
  })
})
