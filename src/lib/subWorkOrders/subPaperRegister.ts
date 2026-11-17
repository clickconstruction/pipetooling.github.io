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
 * Pure: no React, no Supabase. The window makes the calls.
 */
import { buildStatementOfAccount, buildWorkStatement, type PaperContext, type PaperSheet, type StatementRange } from '../../../supabase/functions/_shared/subPapers'
import type { SubPaper } from './subPaperSend'
import type { PaperRegisterRow } from './subPapersInputs'

/** One row of `sub_papers`, as the window reads it. */
export type SubPaperRow = { kind: string; number: string; revision: number; labor_job_id: string | null; period_to: string | null; issued_at: string; replaced_by: string | null; voided_at: string | null }

export const SUB_PAPER_ROW_COLUMNS = 'kind, number, revision, labor_job_id, period_to, issued_at, replaced_by, voided_at'

/** What `mint_sub_paper` answers. */
export type MintedSubPaper = { number: string; revision: number; reused: boolean }

export type SubPaperRegister = {
  /** Each sheet's live work statement: not replaced, not void. */
  bySheet: Map<string, PaperRegisterRow & { issuedOn: string }>
  /** The last statement of account made for this person, by the day it ended. Null before one has been made. */
  lastStatement: { number: string; endedOn: string } | null
}

/**
 * The register's rows for one person, as the papers read them. `dayOf` turns `issued_at` into the app's calendar
 * day: a statement of account made to date has no `period_to`, and it ended the day it was made.
 */
export function subPaperRegister(rows: readonly SubPaperRow[], dayOf: (iso: string) => string): SubPaperRegister {
  const bySheet: SubPaperRegister['bySheet'] = new Map()
  let last: { number: string; endedOn: string; at: string } | null = null
  for (const r of rows) {
    if (r.voided_at) continue
    if (r.kind === 'work_statement' && r.labor_job_id && !r.replaced_by) {
      const have = bySheet.get(r.labor_job_id)
      if (!have || r.revision > have.revision) bySheet.set(r.labor_job_id, { number: r.number, revision: r.revision, issuedOn: dayOf(r.issued_at) })
    }
    if (r.kind === 'statement_of_account' && r.number) {
      const endedOn = (r.period_to ?? '').slice(0, 10) || dayOf(r.issued_at)
      if (endedOn && (!last || endedOn > last.endedOn || (endedOn === last.endedOn && r.issued_at > last.at))) last = { number: r.number, endedOn, at: r.issued_at }
    }
  }
  return { bySheet, lastStatement: last ? { number: last.number, endedOn: last.endedOn } : null }
}

/**
 * A short text of a paper's figures. The register holds it to tell a change from a reprint, so it leaves out what
 * moves by itself: the number, the revision, the day it was issued and the time it was prepared.
 */
export function subPaperFingerprint(p: SubPaper): string {
  if (p.kind === 'work_statement') {
    return JSON.stringify(['ws', p.sub.name, p.job.label, p.lines.map((l) => [l.label, l.amount]), p.backcharges.map((b) => [b.day, b.reason, b.amount]), p.payments.map((x) => [x.day, x.how, x.amount]), p.agreed, p.comesTo, p.paidSoFar, p.stillOpen, p.over])
  }
  if (p.kind === 'payment_record') {
    return JSON.stringify(['pr', p.sub.name, p.sentOn, p.how, p.amountSent, p.applied.map((a) => [a.sheetId, a.openBefore, a.thisPayment, a.openAfter]), p.creditKept, p.stillOpenAfter, p.note])
  }
  return JSON.stringify(['sa', p.sub.name, p.period, p.closingDay, p.rows.map((r) => [r.sheetId, r.comesTo, r.paid, r.open]), p.paidInPeriod, [p.adds.opening, p.adds.newWork, p.adds.backcharges, p.adds.payments, p.adds.closing], p.credit, p.stillOpen])
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
    const before = register.bySheet.get(p.sheetId)
    const replaces = !minted.reused && minted.revision > 1 && before && before.revision < minted.revision ? before.issuedOn : ''
    return buildWorkStatement({ ...sheet, number: minted.number, revision: minted.revision, replacesCopyOf: replaces || (minted.reused ? sheet.replacesCopyOf : '') }, ctx)
  }
  if (p.kind === 'statement_of_account') return buildStatementOfAccount(sheets, range, ctx, { number: minted.number })
  return p
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
