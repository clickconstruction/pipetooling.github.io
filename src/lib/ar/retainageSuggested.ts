import { cents } from '../aiaPayApplicationLines'
import { formatYmdMonthDay } from '../jobs/billedExpectedPay'
import { formatCurrency } from '../jobs/jobFormatting'
import type { RetainageHeldInput } from './retainageHeld'
import type { RetainageJobFacts } from './retainageHeldRows'

/**
 * Retainage the job's own money shows and nobody typed (the owner's pick of 2026-11-16, fix A of
 * the retainage clock check). The Lien desk clocks retainage only from the figure in the lien
 * details, and that figure is typed by hand: a GC that pays every bill ten percent short holds
 * retainage the desk never hears of, so the job gets no § 53.057 clock and its monthly notice
 * names no retainage. This kernel reads the two signs the office already leaves behind. Pure;
 * `retainageHeldIo.ts` fetches.
 *
 * - **A bill paid at a round share.** A bill whose payments come to exactly 90% or 95% of it, to
 *   the cent: the rest reads as retainage held back. The figure is a suggestion a person
 *   confirms; nothing is written from it by itself.
 * - **A note that says so.** A note on the job that uses the word retainage or retention: a
 *   sign with no figure, so the row asks for one.
 *
 * Only a job with no answer is read: no figure in the lien details (zero is an answer, and
 * means none) and no pay application, whose own figure is the source there.
 */

/** The percents a GC holds back that the kernel reads as retainage, largest first. */
export const RETAINAGE_HOLD_PERCENTS: ReadonlyArray<number> = [10, 5]

/** A payment within a cent of the round share still reads as that share: a GC rounds its own check. */
const SHARE_TOLERANCE = 0.011

export type RetainageSuggestionBill = { id: string; amount: number; paid?: number }

export type RetainageSuggestion = {
  /** The dollars the payments left behind on the bills paid at a round share. */
  held: number
  /** The percent held back when every such bill agrees, else null. */
  percent: number | null
  /** How many bills were paid at a round share. */
  billCount: number
  billIds: string[]
}

/** The percent this bill's payments held back (10 or 5), or null when it was not paid at a round share. */
export function retainageShareHeld(amount: number, paid: number): number | null {
  const a = cents(Number(amount) || 0)
  const p = cents(Number(paid) || 0)
  if (a <= 0 || p <= 0 || p >= a) return null
  for (const pct of RETAINAGE_HOLD_PERCENTS) {
    if (Math.abs(p - (a * (100 - pct)) / 100) <= SHARE_TOLERANCE) return pct
  }
  return null
}

/** The retainage the job's bills show held back, or null when no bill was paid at a round share. */
export function retainageSuggestion(bills: ReadonlyArray<RetainageSuggestionBill>): RetainageSuggestion | null {
  let held = 0
  const percents = new Set<number>()
  const billIds: string[] = []
  for (const b of bills) {
    const pct = retainageShareHeld(b.amount, b.paid ?? 0)
    if (pct == null) continue
    held += cents(Number(b.amount) || 0) - cents(Number(b.paid) || 0)
    percents.add(pct)
    billIds.push(b.id)
  }
  if (billIds.length === 0) return null
  return { held: cents(held), percent: percents.size === 1 ? [...percents][0]! : null, billCount: billIds.length, billIds }
}

/** "3 bills paid at 90%" / "1 bill paid at 95%" / "2 bills paid 5% or 10% short" — why the figure is offered. */
export function retainageSuggestionWords(s: Pick<RetainageSuggestion, 'percent' | 'billCount'>): string {
  const bills = `${s.billCount} ${s.billCount === 1 ? 'bill' : 'bills'}`
  return s.percent == null ? `${bills} paid 5% or 10% short` : `${bills} paid at ${100 - s.percent}%`
}

/** True when a note's words name retainage (retainage, retention, retained, retainer is not one). */
export function noteSaysRetainage(body: string | null | undefined): boolean {
  return /\b(retainage|retention|retained|retain)\b/i.test(body ?? '')
}

/** One note on a job that names retainage: the job and the day it was written ('YYYY-MM-DD' in the app's zone). */
export type RetainageNoteSign = { jobId: string; day: string }

export type RetainageUnrecordedRow = {
  jobId: string
  /** The job's number as the app shows it. */
  label: string
  name: string
  /** Who would be holding it: the GC on the job. */
  heldBy: string
  status: string
  /** The figure the bills show, or null when only a note says so. */
  suggestion: RetainageSuggestion | null
  /** The newest note that names retainage, or null when only the bills say so. */
  noteDay: string | null
}

/**
 * The jobs whose money or notes say retainage is held while the lien details hold no answer.
 * Largest suggested figure first; the jobs with a note alone after, newest note first.
 */
export function retainageUnrecordedRows(
  inputs: ReadonlyArray<RetainageHeldInput>,
  facts: ReadonlyMap<string, RetainageJobFacts>,
  notes: ReadonlyArray<RetainageNoteSign> = [],
): RetainageUnrecordedRow[] {
  const noteDayByJob = new Map<string, string>()
  for (const n of notes) {
    const prev = noteDayByJob.get(n.jobId)
    if (!prev || n.day > prev) noteDayByJob.set(n.jobId, n.day)
  }
  const rows: RetainageUnrecordedRow[] = []
  for (const input of inputs) {
    if (input.typedHeld != null || input.applications.length > 0) continue
    const suggestion = retainageSuggestion(input.bills)
    const noteDay = noteDayByJob.get(input.jobId) ?? null
    if (!suggestion && !noteDay) continue
    const f = facts.get(input.jobId)
    rows.push({ jobId: input.jobId, label: f?.label ?? input.jobId.slice(0, 8), name: f?.name ?? '', heldBy: f?.heldBy ?? '', status: f?.status ?? '', suggestion, noteDay })
  }
  return rows.sort((a, b) => {
    const ah = a.suggestion?.held ?? -1
    const bh = b.suggestion?.held ?? -1
    if (ah !== bh) return bh - ah
    const ad = a.noteDay ?? ''
    const bd = b.noteDay ?? ''
    if (ad !== bd) return ad < bd ? 1 : -1
    return a.label < b.label ? -1 : a.label > b.label ? 1 : 0
  })
}

/** "$2,460 looks held · 3 bills paid at 90%" / "a note of Sep 21 says retainage · no figure yet" — the row's reason. */
export function retainageUnrecordedWords(row: Pick<RetainageUnrecordedRow, 'suggestion' | 'noteDay'>, fmt: { money: (n: number) => string; day: (ymd: string) => string }): string {
  const parts: string[] = []
  if (row.suggestion) parts.push(`${fmt.money(row.suggestion.held)} looks held`, retainageSuggestionWords(row.suggestion))
  if (row.noteDay) parts.push(`a note of ${fmt.day(row.noteDay)} says retainage`)
  if (!row.suggestion) parts.push('no figure yet')
  return parts.join(' · ')
}

/** The row's reason as the Retainage list and To do print it: money to the cent, the note's day as *Sep 8*. */
export function retainageUnrecordedWhy(row: Pick<RetainageUnrecordedRow, 'suggestion' | 'noteDay'>): string {
  return retainageUnrecordedWords(row, { money: (n) => '$' + formatCurrency(n), day: formatYmdMonthDay })
}
