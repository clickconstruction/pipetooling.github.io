import { describe, expect, it } from 'vitest'
import { buildPaymentRecord, buildStatementOfAccount, buildWorkStatement, paperSendings, type PaperContext, type PaperMoneyLine, type PaperSheet } from '../../../supabase/functions/_shared/subPapers'
import { mintRefusal, mintSubPaperArgs, mintedFrom, numberedSubPaper, subPaperFingerprint, subPaperRegister, type SubPaperRow } from './subPaperRegister'

// Made-up people, jobs and money.
const CTX: PaperContext = { company: { name: 'Made-up Plumbing Co.', lines: [] }, sub: { name: 'Harlan Mechanical', lines: [] }, today: '2026-11-16', preparedAt: 'Nov 16, 2026 at 9:30 am', zone: 'Central time' }
const money = (id: string, amount: number, ymd: string, over: Partial<PaperMoneyLine> = {}): PaperMoneyLine => ({ id, amount, ymd, recorded: false, at: `${ymd}T16:00:00Z`, how: amount > 0 ? 'Check 1182' : '', memo: '', sendingId: null, sendingNo: null, fromCredit: false, creditKept: 0, clientDirect: false, ...over })
const sheet = (id: string, jobNumber: string, day: string, amount: number, lines: PaperMoneyLine[] = []): PaperSheet => ({ id, number: '', revision: 1, replacesCopyOf: '', jobNumber, jobName: 'Cedar Hollow Clinic', address: '1 Made-up Way', day, lines: [{ label: 'Rough-in', amount }], money: lines, confirm: null })
const SHEETS: PaperSheet[] = [
  sheet('cedar-1', '2041', '2026-10-28', 4200, [money('p226', 1500, '2026-10-31', { sendingId: 'snd226', sendingNo: 226 }), money('lone', 200, '2026-09-30')]),
  sheet('ridge-1', '2057', '2026-11-03', 2500),
]
const ALL = { from: null, to: null }
const row = (over: Partial<SubPaperRow>): SubPaperRow => ({ kind: 'work_statement', number: 'WS-2041-1', revision: 1, labor_job_id: 'cedar-1', period_to: null, issued_at: '2026-10-29T15:00:00Z', replaced_by: null, voided_at: null, ...over })
const dayOf = (iso: string) => iso.slice(0, 10)

describe('subPaperRegister: what the window reads back', () => {
  it('a sheet’s live work statement is the copy that is not replaced and not void', () => {
    const r = subPaperRegister([row({ revision: 1, replaced_by: 'next' }), row({ revision: 2, issued_at: '2026-11-11T15:00:00Z' }), row({ number: 'WS-2057-1', labor_job_id: 'ridge-1', voided_at: '2026-11-12T00:00:00Z' })], dayOf)
    expect([...r.bySheet]).toEqual([['cedar-1', { number: 'WS-2041-1', revision: 2, issuedOn: '2026-11-11' }]])
  })

  it('the last statement of account is the one that ended latest, and one made to date ended the day it was made', () => {
    const r = subPaperRegister(
      [
        row({ kind: 'statement_of_account', number: 'SA-0001', labor_job_id: null, period_to: '2026-10-31', issued_at: '2026-11-01T15:00:00Z' }),
        row({ kind: 'statement_of_account', number: 'SA-0002', labor_job_id: null, period_to: null, issued_at: '2026-11-10T15:00:00Z' }),
        row({ kind: 'statement_of_account', number: 'SA-0003', labor_job_id: null, period_to: '2026-11-14', issued_at: '2026-11-14T15:00:00Z', voided_at: '2026-11-15T00:00:00Z' }),
      ],
      dayOf,
    )
    expect(r.lastStatement).toEqual({ number: 'SA-0002', endedOn: '2026-11-10' })
    expect(subPaperRegister([], dayOf)).toEqual({ bySheet: new Map(), lastStatement: null })
  })
})

describe('subPaperFingerprint: a change is told from a reprint', () => {
  const ws = buildWorkStatement(SHEETS[0]!, CTX)
  it('the same figures on another day, under another number, are the same paper', () => {
    const later = buildWorkStatement({ ...SHEETS[0]!, number: 'WS-2041-1', revision: 3 }, { ...CTX, today: '2026-12-01', preparedAt: 'Dec 1, 2026 at 8:00 am' })
    expect(subPaperFingerprint(later)).toBe(subPaperFingerprint(ws))
  })
  it('a back-charge, a payment or a changed line is a different paper', () => {
    const base = subPaperFingerprint(ws)
    expect(subPaperFingerprint(buildWorkStatement({ ...SHEETS[0]!, money: [...SHEETS[0]!.money, money('b1', -100, '2026-11-10', { memo: 'cleanup' })] }, CTX))).not.toBe(base)
    expect(subPaperFingerprint(buildWorkStatement({ ...SHEETS[0]!, money: [...SHEETS[0]!.money, money('p2', 300, '2026-11-12')] }, CTX))).not.toBe(base)
    expect(subPaperFingerprint(buildWorkStatement({ ...SHEETS[0]!, lines: [{ label: 'Rough-in', amount: 4300 }] }, CTX))).not.toBe(base)
  })
  it('each kind has a fingerprint of its own', () => {
    const pr = buildPaymentRecord(paperSendings(SHEETS)[0]!, SHEETS, CTX)
    const sa = buildStatementOfAccount(SHEETS, ALL, CTX)
    expect(new Set([subPaperFingerprint(ws), subPaperFingerprint(pr), subPaperFingerprint(sa)]).size).toBe(3)
  })
})

describe('mintSubPaperArgs: what the register is handed', () => {
  it('a work statement goes with its sheet and its figures', () => {
    const ws = buildWorkStatement(SHEETS[0]!, CTX)
    expect(mintSubPaperArgs(ws, 'harlan', ALL)).toEqual({ p_kind: 'work_statement', p_person_id: 'harlan', p_snapshot: ws, p_fingerprint: subPaperFingerprint(ws), p_labor_job_id: 'cedar-1', p_comes_to: 4200, p_still_open: 2500 })
  })
  it('a payment record goes with its sending, and one from before sendings with its own payment', () => {
    const records = paperSendings(SHEETS).map((s) => buildPaymentRecord(s, SHEETS, CTX))
    const bySending = mintSubPaperArgs(records.find((r) => r.key === 'snd226')!, 'harlan', ALL)
    expect(bySending).toMatchObject({ p_kind: 'payment_record', p_sending_id: 'snd226', p_comes_to: 1500 })
    expect(bySending).not.toHaveProperty('p_payment_id')
    const lone = mintSubPaperArgs(records.find((r) => r.key === 'row:lone')!, 'harlan', ALL)
    expect(lone).toMatchObject({ p_payment_id: 'lone', p_comes_to: 200 })
    expect(lone).not.toHaveProperty('p_sending_id')
  })
  it('a statement of account goes with its period', () => {
    const range = { from: '2026-11-01', to: '2026-11-16' }
    expect(mintSubPaperArgs(buildStatementOfAccount(SHEETS, range, CTX), 'harlan', range)).toMatchObject({ p_kind: 'statement_of_account', p_period_from: '2026-11-01', p_period_to: '2026-11-16', p_still_open: 5000 })
  })
})

describe('numberedSubPaper: the paper under what the register answered', () => {
  const none = subPaperRegister([], dayOf)
  it('a first work statement takes its number, and its foot carries it', () => {
    const p = numberedSubPaper(buildWorkStatement(SHEETS[0]!, CTX), { number: 'WS-2041-1', revision: 1, reused: false }, SHEETS, CTX, ALL, none)
    expect(p).toMatchObject({ kind: 'work_statement', number: 'WS-2041-1', revision: 1, foot: 'WS-2041-1' })
  })
  it('a new revision says which copy it replaces, by the day that copy was issued', () => {
    const before = subPaperRegister([row({ revision: 1, issued_at: '2026-10-29T15:00:00Z' })], dayOf)
    const p = numberedSubPaper(buildWorkStatement(SHEETS[0]!, CTX), { number: 'WS-2041-1', revision: 2, reused: false }, SHEETS, CTX, ALL, before)
    expect(p.foot).toBe('WS-2041-1 · revision 2 · replaces the copy of Oct 29, 2026')
  })
  it('a reprint is the copy it was, with no new line about replacing anything', () => {
    const before = subPaperRegister([row({ revision: 2, issued_at: '2026-11-11T15:00:00Z' })], dayOf)
    const p = numberedSubPaper(buildWorkStatement(SHEETS[0]!, CTX), { number: 'WS-2041-1', revision: 2, reused: true }, SHEETS, CTX, ALL, before)
    expect(p.foot).toBe('WS-2041-1 · revision 2')
  })
  it('a statement of account takes its number, and a payment record is left as its sending numbered it', () => {
    const sa = numberedSubPaper(buildStatementOfAccount(SHEETS, ALL, CTX), { number: 'SA-0007', revision: 1, reused: false }, SHEETS, CTX, ALL, none)
    expect(sa).toMatchObject({ kind: 'statement_of_account', number: 'SA-0007' })
    expect(sa.foot.startsWith('SA-0007 · ')).toBe(true)
    const pr = buildPaymentRecord(paperSendings(SHEETS).find((s) => s.key === 'snd226')!, SHEETS, CTX)
    expect(numberedSubPaper(pr, { number: 'PR-0226', revision: 1, reused: false }, SHEETS, CTX, ALL, none)).toBe(pr)
  })
})

describe('what the register answers', () => {
  it('a table of one row, or the row itself', () => {
    expect(mintedFrom([{ id: 'x', number: 'WS-2041-1', revision: 2, reused: true }])).toEqual({ number: 'WS-2041-1', revision: 2, reused: true })
    expect(mintedFrom({ number: '', revision: 1, reused: false })).toEqual({ number: '', revision: 1, reused: false })
    expect(mintedFrom([])).toBeNull()
    expect(mintedFrom(null)).toBeNull()
  })
  it('a database the migration has not reached is told from a refusal, and a refusal keeps its reason', () => {
    expect(mintRefusal({ code: 'PGRST202', message: 'Could not find the function public.mint_sub_paper' })).toEqual({ missing: true, words: 'Could not find the function public.mint_sub_paper' })
    expect(mintRefusal({ code: '42501', message: 'A training account cannot make a sub paper.' })).toEqual({ missing: false, words: 'A training account cannot make a sub paper.' })
    expect(mintRefusal(null)).toEqual({ missing: false, words: 'the register gave no reason' })
  })
})
