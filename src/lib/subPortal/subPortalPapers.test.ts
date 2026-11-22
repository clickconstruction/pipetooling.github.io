/**
 * The sub's papers as their own page reads them (punch list #371, step 1): the kernel the `sub-portal` function
 * builds its `papers` block and its two answers with. The load is that the page's sheets are the office's sheets:
 * the same rows through the office's builder (`paperSheetsFor`) and through the function's (`portalPaperSheets`)
 * give one set of papers.
 */
import { describe, expect, it } from 'vitest'
import { buildStatementOfAccount, buildWorkStatement, paperSendings, type PaperCompany } from '../../../supabase/functions/_shared/subPapers'
import { subPaperFingerprint } from '../../../supabase/functions/_shared/subPaperMarks'
import {
  buildSubPortalPapers,
  planPortalAnswer,
  portalAnswers,
  portalOwnSheetIds,
  portalPaperSet,
  portalPaperSheets,
  portalPayMethodWords,
  portalPaymentTarget,
  portalSheetNumbers,
  PORTAL_WRONG_NOTE_MAX,
  type PapersAckRow,
} from '../../../supabase/functions/_shared/subPortalPapers'
import type { LaborJob } from '../../types/laborJob'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { subPaperRegister, type SubPaperRow } from '../subWorkOrders/subPaperRegister'
import { paperSheetsFor } from '../subWorkOrders/subPapersInputs'
import { paymentDay } from '../subWorkOrders/subPaymentsLedger'
import { subPayMethodWords, SUB_PAY_FROM_CREDIT, SUB_PAY_METHODS } from '../subWorkOrders/subPaymentWindow'
import {
  ALDER_1,
  CEDAR_1,
  CEDAR_2,
  HARLAN,
  HIDDEN_MEMO,
  ORA_1,
  PAPER_CEDAR_1_REV_2,
  PAPER_SENDING_226,
  PAY_SEP_CASH,
  PAY_SEP_HIDDEN,
  RIDGE_1,
  SENDING_226,
  SENDING_231,
  harlanRows,
  registerRows,
} from './subPortalPapersFixture'

const COMPANY: PaperCompany = { name: 'Your Company Name', lines: ['100 Example Way, Suite 4', '(555) 010-0100'] }
const NOW = new Date('2026-11-16T15:30:00Z')
const WHO = { subName: 'Harlan Mechanical', company: COMPANY, officePhone: '(555) 010-0100', now: NOW }

/** The same rows as the office's screens hold them: the ledger hook's nesting (`useSubLaborLedger`). */
function officeView(rows: ReturnType<typeof harlanRows>) {
  const sendingNo = new Map(rows.sendings.map((s) => [s.id, Number(s.number)]))
  const kept = new Map(rows.credits.filter((c) => Number(c.amount) > 0 && c.payment_id).map((c) => [c.payment_id!, Number(c.amount)]))
  const jobs = rows.sheets.map(
    (s) =>
      ({
        ...s,
        items: rows.items.filter((i) => i.job_id === s.id).slice().sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)),
        payments: rows.payments
          .filter((p) => p.job_id === s.id)
          .map((p) => ({ ...p, amount: Number(p.amount), sending_no: p.sending_id ? (sendingNo.get(p.sending_id) ?? null) : null, credit_kept: kept.get(p.id) ?? null, hidden_from_sub: p.hidden_from_sub === true })),
      }) as unknown as LaborJob,
  )
  const role = new Map(rows.users.map((u) => [u.id, u.role]))
  const roster = rows.people.map((p) => ({ id: p.id, name: p.name ?? '', kind: p.kind ?? '', accountRole: p.account_user_id ? (role.get(p.account_user_id) ?? null) : null }))
  const name = new Map(roster.map((p) => [p.id, p.name]))
  const assigneesByJobId = new Map<string, Array<{ personId: string; personName: string | null }>>()
  for (const a of rows.assignees) assigneesByJobId.set(a.labor_job_id, [...(assigneesByJobId.get(a.labor_job_id) ?? []), { personId: a.person_id, personName: name.get(a.person_id) ?? null }])
  const register = subPaperRegister(rows.register as unknown as SubPaperRow[], (iso) => calendarYmdInAppTzFromIso(iso).slice(0, 10))
  return paperSheetsFor(`id:${rows.personId}`, jobs, assigneesByJobId, rows.jobNames as Record<string, string>, roster, { register: register.bySheet })
}

describe('the sheets the function builds are the sheets the office builds', () => {
  const rows = harlanRows()
  const mine = portalPaperSheets(rows)

  it('sheet for sheet: the same lines, money, days, numbers and revisions', () => {
    // The office's sheet also says when it was typed (`at`), which only the office's *Since the last statement*
    // reads. The sub's page cuts a period by the date alone, so its sheets do not carry it.
    expect(mine).toEqual(officeView(rows).map(({ at: _typed, ...sheet }) => sheet))
    expect(mine.map((s) => s.id)).toEqual([ALDER_1, CEDAR_1, CEDAR_2])
  })

  it('so the three papers come out the same, to the fingerprint', () => {
    const ctx = portalPaperSet(rows, WHO).ctx
    const office = officeView(rows)
    expect(mine.map((s) => subPaperFingerprint(buildWorkStatement(s, ctx)))).toEqual(office.map((s) => subPaperFingerprint(buildWorkStatement(s, ctx))))
    expect(subPaperFingerprint(buildStatementOfAccount(mine, { from: null, to: null }, ctx))).toBe(subPaperFingerprint(buildStatementOfAccount(office, { from: null, to: null }, ctx)))
    expect(paperSendings(mine)).toEqual(paperSendings(office))
  })

  it('a payment day and a method read as the office words them, for every method there is', () => {
    for (const method of [...SUB_PAY_METHODS, SUB_PAY_FROM_CREDIT, 'venmo', null]) {
      for (const method_ref of ['1182', '  ', null]) expect(portalPayMethodWords({ method, method_ref })).toBe(subPayMethodWords({ method, method_ref }))
    }
    // No Date sent: the day the row was recorded, in Central time, flagged.
    const backcharge = mine.find((s) => s.id === CEDAR_1)!.money.find((m) => m.amount < 0)!
    expect({ ymd: backcharge.ymd, recorded: backcharge.recorded }).toEqual(paymentDay({ payment_date: null, created_at: '2026-11-10T15:00:00Z' }))
    // A sheet with no job date is dated the day it was made, in Central time: 02:30 UTC is the evening before.
    expect(mine.find((s) => s.id === CEDAR_2)!.day).toBe('2026-11-03')
  })
})

describe('whose sheets, and what never leaves', () => {
  const rows = harlanRows()
  const mine = portalPaperSheets(rows)

  it('a sheet shared with another sub is left out, and a teammate riding along does not take a sheet away', () => {
    expect([...portalOwnSheetIds(rows)].sort()).toEqual([ALDER_1, CEDAR_1, CEDAR_2].sort())
    expect(mine.some((s) => s.id === RIDGE_1)).toBe(false)
    expect(mine.some((s) => s.id === ORA_1)).toBe(false)
  })

  it('paid sheets stay in: every sheet and every payment, not the open ones only', () => {
    const papers = buildSubPortalPapers(rows, WHO)
    if (!papers.ok) throw new Error('the set did not add up')
    expect(papers.sheets.map((s) => buildWorkStatement(s, papers.ctx).stillOpen)).toEqual([0, 1500, 0])
    expect(papers.stillOpen).toBe(1500)
    expect(papers.sharedSheets).toBe(1)
  })

  it('a memo the office hid is blank, and its amount still shows', () => {
    const hidden = mine.find((s) => s.id === ALDER_1)!.money.find((m) => m.id === PAY_SEP_HIDDEN)!
    expect(hidden).toMatchObject({ memo: '', amount: 900, how: 'Check 1140' })
    expect(JSON.stringify(buildSubPortalPapers(rows, WHO))).not.toContain(HIDDEN_MEMO)
  })

  it('one sending over two sheets is one payment, a payment from before sendings is its own, and credit kept rides with its payment', () => {
    const sendings = paperSendings(mine)
    expect(sendings.map((s) => [s.key, s.number, s.amount])).toEqual([
      [`row:${PAY_SEP_HIDDEN}`, '', 900],
      [`row:${PAY_SEP_CASH}`, '', 950],
      [SENDING_226, 'PR-0226', 1500],
      [SENDING_231, 'PR-0231', 2200],
    ])
    expect(sendings.find((s) => s.key === SENDING_231)!.rows.map((r) => r.sheetId).sort()).toEqual([CEDAR_1, CEDAR_2].sort())
  })
})

describe('a number is read, never given', () => {
  it('a sheet carries the number and the live revision the office made, and a voided paper gives none', () => {
    const numbers = portalSheetNumbers(registerRows())
    expect(numbers.get(CEDAR_1)).toMatchObject({ number: 'WS-2041-1', revision: 2, issuedOn: '2026-11-13' })
    expect(numbers.get(CEDAR_2)).toMatchObject({ number: 'WS-2041-2', revision: 1 })
    expect(numbers.has(ALDER_1)).toBe(false)
    const sheets = portalPaperSheets(harlanRows())
    expect(sheets.map((s) => [s.id, s.number, s.revision])).toEqual([
      [ALDER_1, '', 1],
      [CEDAR_1, 'WS-2041-1', 2],
      [CEDAR_2, 'WS-2041-2', 1],
    ])
  })

  it('says whether today’s figures are the ones the office issued', () => {
    const ctx = portalPaperSet(harlanRows(), WHO).ctx
    const asIssuedPrint = subPaperFingerprint(buildWorkStatement(portalPaperSheets(harlanRows()).find((s) => s.id === CEDAR_1)!, ctx))
    const papers = buildSubPortalPapers(harlanRows({ register: registerRows(asIssuedPrint) }), WHO)
    if (!papers.ok) throw new Error('the set did not add up')
    // cedar-1 is as the office issued it. cedar-2 was paid after its copy was made, so today's figures are not that copy's.
    expect(papers.numbers).toEqual({
      [CEDAR_1]: { number: 'WS-2041-1', revision: 2, issuedOn: '2026-11-13', asIssued: true },
      [CEDAR_2]: { number: 'WS-2041-2', revision: 1, issuedOn: '2026-11-05', asIssued: false },
    })
  })

  it('the block carries the letterhead, the sub and the day, and nothing that registers a paper', () => {
    const papers = buildSubPortalPapers(harlanRows(), WHO)
    if (!papers.ok) throw new Error('the set did not add up')
    expect(papers.ctx).toEqual({ company: COMPANY, sub: { name: 'Harlan Mechanical', lines: [] }, today: '2026-11-16', preparedAt: 'Nov 16, 2026 at 9:30 am', zone: 'Central time' })
    expect(papers.officePhone).toBe('(555) 010-0100')
  })
})

describe('a set that does not add up', () => {
  it('hands back no figure at all, only the office’s phone', () => {
    const rows = harlanRows()
    const papers = buildSubPortalPapers(rows, WHO, { ...portalPaperSet(rows, WHO), ok: false, problems: ['made up'] })
    expect(papers).toEqual({ ok: false, officePhone: '(555) 010-0100' })
  })
})

describe('what the sub answered', () => {
  const ack = (over: Partial<PapersAckRow>): PapersAckRow => ({ kind: 'received', paper_id: null, labor_job_id: null, sending_id: null, payment_id: null, note: null, created_at: '2026-11-13T18:00:00Z', ...over })

  it('a payment is received once, on the day of the first answer, and notes come back oldest first', () => {
    const answers = portalAnswers([
      ack({ sending_id: SENDING_231, created_at: '2026-11-14T03:00:00Z' }),
      ack({ sending_id: SENDING_231, created_at: '2026-11-20T18:00:00Z' }),
      ack({ payment_id: PAY_SEP_HIDDEN, created_at: '2026-09-05T18:00:00Z' }),
      ack({ kind: 'something_wrong', labor_job_id: CEDAR_1, note: ' The back-charge was never talked about with me. ', created_at: '2026-11-13T18:00:00Z' }),
      ack({ kind: 'something_wrong', sending_id: SENDING_226, note: 'The check was short.', created_at: '2026-11-01T18:00:00Z' }),
      ack({ kind: 'confirmed', labor_job_id: CEDAR_1 }),
    ])
    // 03:00 UTC on the 14th is the evening of the 13th in Central time.
    expect(answers.received).toEqual({ [SENDING_231]: 'Nov 13, 2026', [`row:${PAY_SEP_HIDDEN}`]: 'Sep 5, 2026' })
    expect(answers.wrong).toEqual([
      { about: 'payment', key: SENDING_226, day: 'Nov 1, 2026', note: 'The check was short.' },
      { about: 'statement', key: CEDAR_1, day: 'Nov 13, 2026', note: 'The back-charge was never talked about with me.' },
    ])
  })

  it('a key points at a sending or at one payment row', () => {
    expect(portalPaymentTarget(SENDING_231)).toEqual({ sending_id: SENDING_231, payment_id: null })
    expect(portalPaymentTarget(`row:${PAY_SEP_CASH}`)).toEqual({ sending_id: null, payment_id: PAY_SEP_CASH })
    expect(portalPaymentTarget('row:')).toBeNull()
    expect(portalPaymentTarget('  ')).toBeNull()
  })
})

describe('an answer, planned', () => {
  const rows = harlanRows()
  const set = portalPaperSet(rows, WHO)
  const plan = (body: Record<string, unknown>, r = rows) => planPortalAnswer(body, r, set)

  it('Got it on a sending names the sending, its amount, and the office’s paper where there is one', () => {
    expect(plan({ action: 'got_it', key: SENDING_226 })).toEqual({
      ok: true,
      already: null,
      what: 'PR-0226',
      row: { kind: 'received', person_id: HARLAN, note: null, labor_job_id: null, sending_id: SENDING_226, payment_id: null, paper_id: PAPER_SENDING_226, revision: 1, amount: 1500 },
    })
    // The office has not made sending 231's record: the answer hangs on the sending, with no paper.
    expect(plan({ action: 'got_it', key: SENDING_231 })).toMatchObject({ ok: true, row: { sending_id: SENDING_231, paper_id: null, revision: null, amount: 2200 } })
    expect(plan({ action: 'got_it', key: `row:${PAY_SEP_CASH}` })).toMatchObject({ ok: true, row: { sending_id: null, payment_id: PAY_SEP_CASH, amount: 950 } })
  })

  it('a second Got it reads the first day back and plans no new word', () => {
    const answered = harlanRows({ acks: [{ kind: 'received', paper_id: null, labor_job_id: null, sending_id: SENDING_231, payment_id: null, note: null, created_at: '2026-11-13T18:00:00Z' }] })
    expect(plan({ action: 'got_it', key: SENDING_231 }, answered)).toMatchObject({ ok: true, already: 'Nov 13, 2026' })
  })

  it('Something is wrong on a statement names the sheet, what stays open on it, the live paper and the note', () => {
    expect(plan({ action: 'something_wrong', about: 'statement', key: CEDAR_1, note: '  The back-charge was never talked about with me.  ' })).toEqual({
      ok: true,
      already: null,
      what: 'WS-2041-1 · #2041 Cedar Hollow Clinic',
      row: { kind: 'something_wrong', person_id: HARLAN, note: 'The back-charge was never talked about with me.', labor_job_id: CEDAR_1, sending_id: null, payment_id: null, paper_id: PAPER_CEDAR_1_REV_2, revision: 2, amount: 1500 },
    })
    // A sheet the office has not papered still takes a note: it hangs on the sheet.
    expect(plan({ action: 'something_wrong', about: 'statement', key: ALDER_1, note: 'Wrong address.' })).toMatchObject({ ok: true, row: { labor_job_id: ALDER_1, paper_id: null, revision: null, amount: 0 } })
    expect(plan({ action: 'something_wrong', about: 'payment', key: SENDING_231, note: 'Short by $50.' })).toMatchObject({ ok: true, already: null, what: 'PR-0231', row: { kind: 'something_wrong', sending_id: SENDING_231, amount: 2200 } })
    // What the office reads the note is about: the job where the sheet has no number, the day where the payment has none.
    expect(plan({ action: 'something_wrong', about: 'statement', key: ALDER_1, note: 'x' })).toMatchObject({ what: '#2033 Alder Court Remodel' })
    expect(plan({ action: 'something_wrong', about: 'payment', key: `row:${PAY_SEP_HIDDEN}`, note: 'x' })).toMatchObject({ what: 'the payment of recorded Sep 2, 2026' })
  })

  it('refuses what is not on the person’s own papers, with the reason', () => {
    expect(plan({ action: 'confirm', key: CEDAR_1 })).toEqual({ ok: false, status: 400, error: 'Unknown action.' })
    expect(plan({ action: 'got_it' })).toEqual({ ok: false, status: 400, error: 'Say which statement or payment this is about.' })
    expect(plan({ action: 'something_wrong', key: CEDAR_1, note: 'x' })).toEqual({ ok: false, status: 400, error: 'Say which statement or payment this is about.' })
    // A sheet shared with another sub, another sub's own sheet, and a payment that is not theirs.
    expect(plan({ action: 'something_wrong', about: 'statement', key: RIDGE_1, note: 'x' })).toEqual({ ok: false, status: 404, error: 'That statement is not on your page.' })
    expect(plan({ action: 'something_wrong', about: 'statement', key: ORA_1, note: 'x' })).toEqual({ ok: false, status: 404, error: 'That statement is not on your page.' })
    expect(plan({ action: 'got_it', key: 'row:not-a-payment' })).toEqual({ ok: false, status: 404, error: 'That payment is not on your page.' })
    expect(plan({ action: 'something_wrong', about: 'statement', key: CEDAR_1, note: '   ' })).toEqual({ ok: false, status: 400, error: 'Tell the office what looks wrong.' })
    expect(plan({ action: 'something_wrong', about: 'statement', key: CEDAR_1, note: 'x'.repeat(PORTAL_WRONG_NOTE_MAX + 1) })).toMatchObject({ ok: false, status: 400 })
  })

  it('takes no answer while the papers do not add up', () => {
    expect(planPortalAnswer({ action: 'got_it', key: SENDING_231 }, rows, { ...set, ok: false })).toEqual({ ok: false, status: 409, error: 'The office is checking your statements. Please call the office.' })
  })
})
