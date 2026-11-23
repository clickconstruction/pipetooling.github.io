/**
 * The register's side of a sub paper (punch list #350, the numbers on the papers): what the window reads from
 * `sub_papers`, what it hands `mint_sub_paper`, and the paper drawn again under the number that came back.
 *
 * A paper is numbered the moment it is made, never before: the preview carries no number of its own, and Print,
 * Download and Send each register the paper first, then draw the PDF under what the register answered.
 *
 *  - A work statement keeps its number for good. The same figures again are a reprint and make nothing. Different
 *    figures are the next revision, and the foot says which copy it replaces.
 *  - A payment record's number is its sending's own, so the mint only records that the paper was made.
 *  - A statement of account is a new paper every time.
 *
 * Papers that go out together are registered as one set (`registerSubPaperSet`): every work statement first, so
 * the statement of account and the payment records in the same email name each sheet by the number on the file
 * beside them.
 *
 * Pure: no React, no Supabase. The window makes the calls.
 */
import { buildPaymentRecord, buildStatementOfAccount, buildWorkStatement, paperSendings, type PaperContext, type PaperSheet, type StatementRange } from '../../../supabase/functions/_shared/subPapers'
import type { SubPaper } from './subPaperSend'
import type { PaperRegisterRow } from './subPapersInputs'
import { subPaperFingerprint } from '../../../supabase/functions/_shared/subPaperMarks'

// The fingerprint lives on the edge since v2.7569 (punch list #371): the sub's page reads it too.
export { subPaperFingerprint }

/** One row of `sub_papers`, as the window reads it. */
export type SubPaperRow = { kind: string; number: string; revision: number; labor_job_id: string | null; period_to: string | null; issued_at: string; replaced_by: string | null; voided_at: string | null }

export const SUB_PAPER_ROW_COLUMNS = 'kind, number, revision, labor_job_id, period_to, issued_at, replaced_by, voided_at'

/** What `mint_sub_paper` answers. */
export type MintedSubPaper = { number: string; revision: number; reused: boolean }

export type SubPaperRegister = {
  /** Each sheet's live work statement: not replaced, not void. */
  bySheet: Map<string, PaperRegisterRow & { issuedOn: string }>
  /**
   * The last statement of account made for this person, by the day it ended. Null before one has been made. With
   * `today` handed in it is the last one that ended before today: *Since the last statement* starts the day after
   * it, and a statement that ended today would start that period tomorrow, after its own end.
   */
  lastStatement: { number: string; endedOn: string; /** When it was made, an ISO instant: a line typed after it and dated inside it is carried to the next statement. */ madeAt: string } | null
  /** The newest statement that ended today, when `today` is handed in. It does not move the period. Null when none. */
  statementToday: { number: string } | null
}

/**
 * The register's rows for one person, as the papers read them. `dayOf` turns `issued_at` into the app's calendar
 * day: a statement of account made to date has no `period_to`, and it ended the day it was made.
 */
export function subPaperRegister(rows: readonly SubPaperRow[], dayOf: (iso: string) => string, today?: string): SubPaperRegister {
  const bySheet: SubPaperRegister['bySheet'] = new Map()
  let last: { number: string; endedOn: string; at: string } | null = null
  let madeToday: { number: string; at: string } | null = null
  for (const r of rows) {
    if (r.voided_at) continue
    if (r.kind === 'work_statement' && r.labor_job_id && !r.replaced_by) {
      const have = bySheet.get(r.labor_job_id)
      if (!have || r.revision > have.revision) bySheet.set(r.labor_job_id, { number: r.number, revision: r.revision, issuedOn: dayOf(r.issued_at) })
    }
    if (r.kind === 'statement_of_account' && r.number) {
      const endedOn = (r.period_to ?? '').slice(0, 10) || dayOf(r.issued_at)
      // A statement that ended today is set apart: the day is not over, so nothing can start after it yet.
      if (today && endedOn >= today) {
        if (!madeToday || r.issued_at > madeToday.at) madeToday = { number: r.number, at: r.issued_at }
        continue
      }
      if (endedOn && (!last || endedOn > last.endedOn || (endedOn === last.endedOn && r.issued_at > last.at))) last = { number: r.number, endedOn, at: r.issued_at }
    }
  }
  return { bySheet, lastStatement: last ? { number: last.number, endedOn: last.endedOn, madeAt: last.at } : null, statementToday: madeToday ? { number: madeToday.number } : null }
}

/** The arguments `mint_sub_paper` takes for one paper. The snapshot is the paper as drawn, before its number. */
export function mintSubPaperArgs(p: SubPaper, personId: string, range: StatementRange): Record<string, unknown> {
  const base = { p_kind: p.kind, p_person_id: personId, p_snapshot: p as unknown as Record<string, unknown>, p_fingerprint: subPaperFingerprint(p) }
  if (p.kind === 'work_statement') return { ...base, p_labor_job_id: p.sheetId, p_comes_to: p.comesTo, p_still_open: p.stillOpen }
  if (p.kind === 'payment_record') {
    // A sending's record is keyed by the sending. A payment from before sendings is its own, keyed `row:<payment id>`.
    const lone = p.key.startsWith('row:') ? p.key.slice(4) : null
    return { ...base, ...(lone ? { p_payment_id: lone } : { p_sending_id: p.key }), p_comes_to: p.amountSent, p_still_open: p.stillOpenAfter }
  }
  return { ...base, p_period_from: range.from, p_period_to: range.to, p_still_open: p.stillOpen }
}

/**
 * The paper drawn again under what the register answered. A work statement takes its number, its revision and,
 * on a new revision, the day of the copy it replaces. A statement of account takes its number. A payment record
 * already carries its sending's number, and one from before sendings stays unnumbered.
 */
export function numberedSubPaper(p: SubPaper, minted: MintedSubPaper, sheets: readonly PaperSheet[], ctx: PaperContext, range: StatementRange, register: SubPaperRegister): SubPaper {
  if (p.kind === 'work_statement') {
    const sheet = sheets.find((s) => s.id === p.sheetId)
    if (!sheet) return p
    return buildWorkStatement(numberedSheet(sheet, minted, register), ctx)
  }
  if (p.kind === 'statement_of_account') return buildStatementOfAccount(sheets, range, ctx, { number: minted.number })
  return p
}

/**
 * A sheet as it reads once the register has answered for its work statement: the number, the revision and, on a
 * new revision, the day of the copy it replaces. Every paper that names the sheet is built over this.
 */
export function numberedSheet(sheet: PaperSheet, minted: MintedSubPaper, register: SubPaperRegister): PaperSheet {
  const before = register.bySheet.get(sheet.id)
  const replaces = !minted.reused && minted.revision > 1 && before && before.revision < minted.revision ? before.issuedOn : ''
  return { ...sheet, number: minted.number, revision: minted.revision, replacesCopyOf: replaces || (minted.reused ? sheet.replacesCopyOf : '') }
}

/**
 * One paper, or several that go out together, registered and drawn again as one set.
 *
 * Every work statement is registered first. A payment record and a statement of account name a sheet by its work
 * statement's number, so each is built again over the sheets as numbered and only then registered: the statement
 * a sub opens names `WS-2057-1`, the file beside it. The statement of account is last. It takes a new number every
 * time, so a refusal ahead of it spends none.
 *
 * `mint` registers one paper and answers what the register said. It answers null where the register is not on the
 * database yet, and the paper then goes as it is. It throws the register's reason when the register refuses, and
 * then nothing comes back. The papers come back in the order they were given.
 *
 * `received` answers whether the sub marked a payment received, by the record's key. A payment record is built
 * again here, so without it the paper as made would read *Not marked yet* under a preview that said otherwise.
 */
export async function registerSubPaperSet(
  papers: readonly SubPaper[],
  io: { mint: (p: SubPaper) => Promise<MintedSubPaper | null>; sheets: readonly PaperSheet[]; ctx: PaperContext; range: StatementRange; register: SubPaperRegister; received?: (key: string) => { at: string } | null },
): Promise<SubPaper[]> {
  let sheets = io.sheets
  const made = new Map<number, SubPaper>()
  for (const [i, p] of papers.entries()) {
    if (p.kind !== 'work_statement') continue
    const minted = await io.mint(p)
    const sheet = sheets.find((s) => s.id === p.sheetId)
    if (!minted || !sheet) {
      made.set(i, p)
      continue
    }
    const numbered = numberedSheet(sheet, minted, io.register)
    sheets = sheets.map((s) => (s.id === numbered.id ? numbered : s))
    made.set(i, buildWorkStatement(numbered, io.ctx))
  }
  const sendings = paperSendings(sheets)
  for (const [i, p] of papers.entries()) {
    if (p.kind !== 'payment_record') continue
    const sending = sendings.find((s) => s.key === p.key)
    // Its number is its sending's own, so the register only records that the paper was made.
    const fresh = sending ? buildPaymentRecord(sending, sheets, io.ctx, io.received?.(sending.key) ?? null) : p
    await io.mint(fresh)
    made.set(i, fresh)
  }
  for (const [i, p] of papers.entries()) {
    if (p.kind !== 'statement_of_account') continue
    const fresh = buildStatementOfAccount(sheets, io.range, io.ctx)
    const minted = await io.mint(fresh)
    made.set(i, minted ? buildStatementOfAccount(sheets, io.range, io.ctx, { number: minted.number }) : fresh)
  }
  return papers.map((p, i) => made.get(i) ?? p)
}

/** A refusal from the register, as the window says it. `missing` is a database the migration has not reached. */
export function mintRefusal(error: unknown): { missing: boolean; words: string } {
  const e = (error ?? {}) as { code?: string; message?: string }
  const missing = e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(e.message ?? '')
  return { missing, words: (e.message ?? '').trim() || 'the register gave no reason' }
}

/** `mint_sub_paper` returns a table: one row, or the row itself. Null when the answer is not a paper. */
export function mintedFrom(data: unknown): MintedSubPaper | null {
  const row = (Array.isArray(data) ? data[0] : data) as { number?: unknown; revision?: unknown; reused?: unknown } | null | undefined
  if (!row || typeof row.number !== 'string') return null
  return { number: row.number, revision: Number(row.revision) || 1, reused: row.reused === true }
}
