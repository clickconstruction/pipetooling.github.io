/**
 * The call sheet (punch list #49, step 3): one account man's GCs on one
 * screen, so one call covers them — the assistant fills a row as he answers
 * and saves the lot. Pure: the worklist group and the temperature board's
 * rows go in; the modal owns the drafts, GC Review owns the writes.
 */
import { addDaysYmd } from '../emailSchedule/emailScheduleWeek'
import type { GcReviewRow } from '../gcReviewRollup'
import type { PromisedPayDate } from './billedExpectedPay'
import type { GcWorklistGroup } from './gcWorklist'
import { isTemperature, type StatementSendChannel, type Temperature } from './gcStatementRounds'
import type { TemperatureBoardRow } from './temperatureBoard'
import { payPromiseLabel, payPromiseStatus, type PayPromise } from './payPromise'
import { isNoChangeNote, noChangeNote } from '../gcWordAsk'

/** One line of a GC's statement, with the date that job was last promised. */
export type CallSheetBill = GcReviewRow & { promisedYmd: string | null }

export type CallSheetRow = {
  gcId: string
  gcName: string
  /** What the GC owes on active bills — the sum of `bills`. */
  amount: number
  /** The bills behind `amount`, in the statement's order. Absent when the sheet was built without them. */
  bills?: CallSheetBill[]
  /** The GC's bills in Collections: owed, and not part of `amount` — the week's round works active bills only. */
  collections?: CallSheetBill[]
  oldestAgeDays: number | null
  /** The newest word on record, this week's included. */
  lastWord: { temperature: Temperature | null; note: string; by: string; at: string } | null
  promise: PayPromise | null
  /** The word is already in for this week. */
  wordIn: boolean
  /** "No change" may be recorded: there is a word to repeat, and the last one was not itself a repeat. */
  noChangeAllowed: boolean
}

export type CallSheet = { ownerUserId: string | null; rows: CallSheetRow[]; total: number }

// One rule for the call sheet and the ask-by-link page: what a "no change" writes, and how it is recognised.
export { isNoChangeNote, noChangeNote }

export function buildCallSheet(input: {
  group: Pick<GcWorklistGroup, 'ownerUserId' | 'rows'>
  boardRowByGc: ReadonlyMap<string, Pick<TemperatureBoardRow, 'now' | 'nowAt' | 'nowBy' | 'lastWord' | 'expectedPayBy'>>
  todayYmd: string
  /** The date each job was last promised (the Stages board's map), shown on its bill. */
  promisedPayDates?: Readonly<Record<string, Pick<PromisedPayDate, 'promisedYmd'>>> | null
  /** Each GC's bills in Collections, listed under its active ones. */
  collectionsByGc?: ReadonlyMap<string, readonly GcReviewRow[]>
}): CallSheet {
  const asBill = (r: GcReviewRow): CallSheetBill => {
    const promised = input.promisedPayDates?.[r.jobId]?.promisedYmd ?? null
    return { ...r, promisedYmd: promised && /^\d{4}-\d{2}-\d{2}$/.test(promised) ? promised : null }
  }
  const rows: CallSheetRow[] = input.group.rows
    .filter((r) => !r.skipped)
    .map((r) => {
      const b = input.boardRowByGc.get(r.gcId)
      const lastWord = b?.lastWord ? { temperature: b.now, note: b.lastWord.note, by: b.lastWord.by, at: b.lastWord.at } : null
      return {
        gcId: r.gcId,
        gcName: r.gcName,
        amount: r.amount,
        bills: r.group.rows.map(asBill),
        collections: (input.collectionsByGc?.get(r.gcId) ?? []).map(asBill),
        oldestAgeDays: r.oldestAgeDays,
        lastWord,
        promise: payPromiseStatus(b?.expectedPayBy, input.todayYmd, r.amount),
        wordIn: r.word,
        noChangeAllowed: lastWord != null && lastWord.temperature != null && !isNoChangeNote(lastWord.note),
      }
    })
  // The call goes where the money is: broken promises, then no word yet, then the largest balance.
  rows.sort((a, b) => Number(b.promise?.late ?? false) - Number(a.promise?.late ?? false) || Number(a.wordIn) - Number(b.wordIn) || b.amount - a.amount)
  return { ownerUserId: input.group.ownerUserId, rows, total: rows.reduce((t, r) => t + r.amount, 0) }
}

/** Bills this old are what a call is about. */
export const CALL_SHEET_OLD_BILL_DAYS = 90

export type CallSheetBillsSummary = { count: number; jobs: number; total: number; old: { count: number; total: number }; promised: number }

/** What a GC's bills come to: how many, on how many jobs, how much of it is over 90 days, how many carry a promised date. */
export function callSheetBillsSummary(bills: ReadonlyArray<Pick<CallSheetBill, 'jobId' | 'remaining' | 'ageDays' | 'promisedYmd'>>): CallSheetBillsSummary {
  const old = bills.filter((b) => b.ageDays != null && b.ageDays >= CALL_SHEET_OLD_BILL_DAYS)
  const cents = (rows: ReadonlyArray<{ remaining: number }>) => rows.reduce((t, b) => t + Math.round(b.remaining * 100), 0) / 100
  return {
    count: bills.length,
    jobs: new Set(bills.map((b) => b.jobId)).size,
    total: cents(bills),
    old: { count: old.length, total: cents(old) },
    promised: bills.filter((b) => b.promisedYmd).length,
  }
}

/** "19 bills on 12 jobs · 4 over 90 days, $39,490.00" — the line that opens a GC's bills. */
export function callSheetBillsLabel(s: CallSheetBillsSummary, money: (n: number) => string): string {
  const bills = `${s.count} bill${s.count === 1 ? '' : 's'}`
  const jobs = s.jobs !== s.count ? ` on ${s.jobs} job${s.jobs === 1 ? '' : 's'}` : ''
  const old = s.old.count > 0 ? ` · ${s.old.count} over ${CALL_SHEET_OLD_BILL_DAYS} days, ${money(s.old.total)}` : ''
  return `${bills}${jobs}${old}`
}

export type CallSheetDraft = { temperature: Temperature | null; note: string; payBy: string; noChange: boolean }

export const EMPTY_CALL_SHEET_DRAFT: CallSheetDraft = { temperature: null, note: '', payBy: '', noChange: false }

/** Nothing typed on the row — it is left alone, not saved. */
export function callSheetDraftIsEmpty(d: CallSheetDraft): boolean {
  return !d.noChange && d.temperature == null && d.note.trim() === '' && d.payBy === ''
}

/** Why a started row cannot be saved, or null when it can. The same bar the mark form sets: a read, and a sentence. */
export function callSheetDraftProblem(d: CallSheetDraft, row: Pick<CallSheetRow, 'noChangeAllowed'>): string | null {
  if (callSheetDraftIsEmpty(d)) return null
  if (d.noChange) return row.noChangeAllowed ? null : 'The last word was already “no change” — write what he said this time.'
  if (!d.temperature) return 'Pick their temperature.'
  if (d.note.trim().length < 8) return 'A sentence, not a word.'
  return null
}

export type CallSheetAnswer = {
  gcId: string
  channel: StatementSendChannel
  note: string
  temperature: Temperature
  expectedPayBy: string | null
}

/**
 * The rows ready to save. "No change" repeats the last read and its pay date
 * under a sentence that says so; a pay date typed on the row wins.
 */
export function callSheetAnswers(sheet: Pick<CallSheet, 'rows'>, drafts: Readonly<Record<string, CallSheetDraft>>, heardVia: StatementSendChannel): { answers: CallSheetAnswer[]; problems: Record<string, string> } {
  const answers: CallSheetAnswer[] = []
  const problems: Record<string, string> = {}
  for (const row of sheet.rows) {
    const d = drafts[row.gcId]
    if (!d || callSheetDraftIsEmpty(d)) continue
    const problem = callSheetDraftProblem(d, row)
    if (problem) {
      problems[row.gcId] = problem
      continue
    }
    if (d.noChange && row.lastWord && isTemperature(row.lastWord.temperature)) {
      answers.push({ gcId: row.gcId, channel: heardVia, note: noChangeNote(row.lastWord), temperature: row.lastWord.temperature, expectedPayBy: d.payBy || row.promise?.payBy || null })
      continue
    }
    if (d.temperature) answers.push({ gcId: row.gcId, channel: heardVia, note: d.note.trim(), temperature: d.temperature, expectedPayBy: d.payBy || null })
  }
  return { answers, problems }
}

const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** The sheet on paper: what is owed and what was last said, with room to write the answer. */
export function buildCallSheetPrintHtml(sheet: CallSheet, opts: { ownerName: string; dateStr: string; weekEndsYmd?: string }): string {
  const rows = sheet.rows
    .map(
      (r) => `<tr>
  <td><b>${escapeHtml(r.gcName)}</b><br /><span class="m">${money(r.amount)}${r.oldestAgeDays != null ? ` · oldest ${r.oldestAgeDays}d` : ''}</span>${r.promise ? `<br /><span class="${r.promise.late ? 'late' : 'm'}">${escapeHtml(payPromiseLabel(r.promise))}</span>` : ''}</td>
  <td class="m">${r.lastWord ? `${r.lastWord.temperature ? `<b>${escapeHtml(r.lastWord.temperature)}</b> · ` : ''}${escapeHtml(new Date(r.lastWord.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))} · ${escapeHtml(r.lastWord.by)}<br />“${escapeHtml(r.lastWord.note)}”` : 'No word yet'}</td>
  <td class="w">hot &nbsp; warm &nbsp; cool &nbsp; cold</td>
  <td class="w line"></td>
  <td class="w"></td>
</tr>`,
    )
    .join('')
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8" /><title>Call sheet — ${escapeHtml(opts.ownerName)} — ${escapeHtml(opts.dateStr)}</title>
<style>
  body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 12px; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  p { margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; text-align: left; }
  th { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; }
  td.w { height: 56px; }
  td.line { width: 34%; }
  .m { font-size: 11px; }
  .late { font-size: 11px; font-weight: 700; }
  tr { page-break-inside: avoid; }
</style></head><body>
<h1>Call sheet — ${escapeHtml(opts.ownerName)}</h1>
<p>${sheet.rows.length} GC${sheet.rows.length === 1 ? '' : 's'} · ${money(sheet.total)} outstanding · ${escapeHtml(opts.dateStr)}${opts.weekEndsYmd ? ` · week ends ${escapeHtml(opts.weekEndsYmd)}` : ''}</p>
<table>
  <thead><tr><th>GC</th><th>Last word</th><th>Temperature</th><th>What he said</th><th>Pay by</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`
}

/** Friday of the Monday-keyed week — the round's deadline, for the printed sheet. */
export function callSheetWeekEnds(weekStartYmd: string): string {
  return addDaysYmd(weekStartYmd, 4)
}
