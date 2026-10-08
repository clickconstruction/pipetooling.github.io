/**
 * Take back a printed run (punch list #101 PR 1). Printing stamps each notice printed, and the
 * desk then reads it as in the mail. When nothing was mailed — the packet's look changed, a notice
 * needs a fix, the run waits a day — the office takes the run back: the printed stamps clear, the
 * approvals stand, and each notice keeps one line saying who took it back and when. Pure: the
 * run window and the desk draw what this says; `takeBackLienDeskItems` writes it.
 */
import { demandDate } from '../jobsDocuments/demandLetter'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { RunNotice } from './lienDeskRun'
import { shortDay } from './lienFootChip'

/** Kept on the item's `fields` as `runTakenBack`: the latest take-back only. */
export type LienRunTakenBack = {
  /** When it was taken back (an instant). */
  at: string
  by: string | null
  byName: string | null
  /** When the packet had printed (an instant), so the line can say which print it undid. */
  printedAt: string | null
}

export function runTakenBackOf(fields: unknown): LienRunTakenBack | null {
  if (!fields || typeof fields !== 'object') return null
  const v = (fields as { runTakenBack?: unknown }).runTakenBack
  if (!v || typeof v !== 'object') return null
  const t = v as Partial<LienRunTakenBack>
  if (typeof t.at !== 'string' || !t.at) return null
  return { at: t.at, by: typeof t.by === 'string' ? t.by : null, byName: typeof t.byName === 'string' && t.byName.trim() ? t.byName.trim() : null, printedAt: typeof t.printedAt === 'string' ? t.printedAt : null }
}

/** The item's fields with the take-back line set; every other field is kept. */
export function fieldsWithTakeBack(fields: unknown, takenBack: LienRunTakenBack): Record<string, unknown> {
  const base = fields && typeof fields === 'object' && !Array.isArray(fields) ? (fields as Record<string, unknown>) : {}
  return { ...base, runTakenBack: { ...takenBack } }
}

/** A row the take-back may clear: printed, not sent, not voided. The write filters on the same rule. */
export function canTakeBackItem(item: { printed_at?: string | null; status?: string | null; voided_at?: string | null }): boolean {
  return Boolean(item.printed_at) && item.status !== 'sent' && item.status !== 'missed' && !item.voided_at
}

/**
 * The run's notices that printed — before this sitting (`printedAt`) or in it (`printedNow`, the
 * item ids the window stamped) — in run order, each once.
 */
export function runPrintedItemIds(notices: ReadonlyArray<Pick<RunNotice, 'itemId' | 'printedAt'>>, printedNow: ReadonlyArray<string> = []): string[] {
  const now = new Set(printedNow)
  const out: string[] = []
  for (const n of notices) if ((n.printedAt || now.has(n.itemId)) && !out.includes(n.itemId)) out.push(n.itemId)
  return out
}

/** Tracking numbers typed in the window on these notices and not recorded: the take-back drops them. */
export function runTypedTrackingCount(notices: ReadonlyArray<Pick<RunNotice, 'itemId' | 'recipients'>>, itemIds: ReadonlyArray<string>): number {
  const ids = new Set(itemIds)
  let n = 0
  for (const notice of notices) {
    if (!ids.has(notice.itemId)) continue
    for (const r of notice.recipients) if (r.method !== 'email' && r.method !== 'hand' && (r.tracking ?? '').trim()) n++
  }
  return n
}

/** The notices with their printed day and typed numbers cleared, as the window shows them after a take-back. */
export function runNoticesTakenBack<T extends Pick<RunNotice, 'itemId' | 'printedAt' | 'recipients'>>(notices: ReadonlyArray<T>, itemIds: ReadonlyArray<string>): T[] {
  const ids = new Set(itemIds)
  return notices.map((n) => (ids.has(n.itemId) ? { ...n, printedAt: null, recipients: n.recipients.map((r) => ({ ...r, tracking: '' })) } : n))
}

function notices(n: number): string {
  return `${n} ${n === 1 ? 'notice' : 'notices'}`
}

/** "Oct 7" for an instant, or "" when there is none. */
function dayOf(iso: string | null | undefined): string {
  return iso ? shortDay(iso) : ''
}

/** The confirm's words, in plain sentences. */
export function runTakeBackConfirm(input: { count: number; printedAt: string | null; typed: number; all: boolean }): { title: string; lines: string[]; button: string } {
  const day = dayOf(input.printedAt)
  const lines = [
    `${input.count === 1 ? 'The notice goes' : `The ${notices(input.count)} go`} back to Ready to send. The approvals stand.`,
    'Then print the packet again. It prints the way the app draws it today.',
    `The ${input.count === 1 ? 'copy' : 'copies'} printed${day ? ` ${day}` : ''} ${input.count === 1 ? 'stays' : 'stay'} in ${input.count === 1 ? 'the job’s' : 'each job’s'} Documents, filed as printed.`,
  ]
  if (input.typed > 0) lines.push(`The ${input.typed === 1 ? 'tracking number' : `${input.typed} tracking numbers`} typed here ${input.typed === 1 ? 'is' : 'are'} not saved.`)
  if (!input.all) lines.push('The notices in this run that have not printed stay as they are.')
  return { title: input.all ? 'Take back the run?' : `Take back the ${notices(input.count)} that printed?`, lines, button: `Take back ${notices(input.count)}` }
}

/** The strip after a take-back: "Taken back. 19 notices are in Ready to send again. Print the packet when it is ready." */
export function runTakenBackWords(count: number, printedAt: string | null): string {
  const day = printedAt ? demandDate(calendarYmdInAppTzFromIso(printedAt)) : ''
  return `Taken back. ${count === 1 ? 'The notice' : `The ${notices(count)}`}${day ? ` printed ${day}` : ''} ${count === 1 ? 'is' : 'are'} in Ready to send again. Print the packet when it is ready.`
}

/** The ready chip's tail and hover: "taken back Oct 8", "Printed Oct 7, taken back Oct 8 by Dana." */
export function takenBackChipWords(t: LienRunTakenBack | null): { tail: string; sentence: string } | null {
  if (!t) return null
  const back = dayOf(t.at)
  const printed = dayOf(t.printedAt)
  return {
    tail: `taken back ${back}`,
    sentence: `${printed ? `Printed ${printed}, taken back ${back}` : `Taken back ${back}`}${t.byName ? ` by ${t.byName}` : ''}. Nothing was mailed.`,
  }
}
