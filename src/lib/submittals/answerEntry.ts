/**
 * Their answer on one submittal row, typed by the office (Submittals stage 5b, 2026-10-02): one
 * line per part the GC sees, each with its own Approved / Revise / Rejected and its own note,
 * saved once. A row with no part the GC sees is one line, the row itself. Pure: the window holds
 * the drafts, the tab writes what `answerWrites` returns.
 *
 * A line starts on the call it already carries. Saving writes only the lines that changed. A
 * call the office or the robot entered can be taken back; one the reviewer made on the room, or
 * one carried from an earlier revision, can be changed here but not emptied.
 */
import type { ReviewDecision, SubmittalItemRow } from './submittalRevision'
import { asDecision } from './submittalRevision'
import { splitPartLabel, type SubmittalPartRow } from './itemParts'

/** The key of the one line a row with no parts gets. */
export const ROW_LINE = 'row'

export type AnswerLine = {
  /** The part's id, or `ROW_LINE`. */
  key: string
  partId: string | null
  /** Maker and model, in bold. */
  head: string
  /** The rest of the catalog name, quiet. */
  words: string
  current: ReviewDecision | null
  currentNote: string
  /** Who made the call it carries, as the row reads it; '' when it has none. */
  currentBy: string
  /** Entered by the office or read by the robot: it can be taken back here. */
  canClear: boolean
}

export type AnswerDraft = { decision: ReviewDecision | null; note: string }
export type AnswerDrafts = Record<string, AnswerDraft>

type CallFields = { review_decision?: string | null; review_note?: string | null; reviewed_by_name?: string | null; decision_source?: string | null }

const clearable = (c: CallFields): boolean => c.decision_source === 'entered' || c.decision_source === 'robot'

function lineFrom(key: string, partId: string | null, label: string, c: CallFields): AnswerLine {
  const { head, words } = splitPartLabel(label)
  const current = asDecision(c.review_decision)
  return { key, partId, head: head || label.trim(), words, current, currentNote: current ? (c.review_note ?? '').trim() : '', currentBy: current ? (c.reviewed_by_name ?? '').trim() : '', canClear: current == null || clearable(c) }
}

/** One line per part the GC sees, in the row's order; the row itself when it has none. */
export function answerLines(item: Pick<SubmittalItemRow, 'submitted_label' | 'submitted_manufacturer' | 'submitted_model' | 'review_decision' | 'review_note' | 'reviewed_by_name' | 'decision_source'>, parts: ReadonlyArray<SubmittalPartRow>): AnswerLine[] {
  const gc = parts.filter((p) => p.on_submittal).slice().sort((a, b) => a.sequence_order - b.sequence_order)
  if (gc.length > 0) return gc.map((p) => lineFrom(p.id, p.id, p.label, p))
  const product = item.submitted_label?.trim() || [item.submitted_manufacturer, item.submitted_model].filter(Boolean).join(' ').trim() || 'The row'
  return [lineFrom(ROW_LINE, null, product, item)]
}

export function initialAnswerDrafts(lines: ReadonlyArray<AnswerLine>): AnswerDrafts {
  return Object.fromEntries(lines.map((l) => [l.key, { decision: l.current, note: l.currentNote }]))
}

const draftOf = (l: AnswerLine, drafts: AnswerDrafts): AnswerDraft => drafts[l.key] ?? { decision: l.current, note: l.currentNote }

/** A tap on an answer: it picks it; a tap on the one already picked takes it off, where that is allowed. */
export function tapAnswer(line: AnswerLine, drafts: AnswerDrafts, decision: ReviewDecision): AnswerDrafts {
  const d = draftOf(line, drafts)
  if (d.decision !== decision) return { ...drafts, [line.key]: { ...d, decision } }
  return line.canClear ? { ...drafts, [line.key]: { ...d, decision: null } } : drafts
}

/** "All approved": every line with no answer picked reads Approved; a line that has one keeps it. */
export function approveOpenLines(lines: ReadonlyArray<AnswerLine>, drafts: AnswerDrafts): AnswerDrafts {
  const next = { ...drafts }
  for (const l of lines) {
    const d = draftOf(l, drafts)
    if (d.decision == null) next[l.key] = { ...d, decision: 'approved' }
  }
  return next
}

/** "Clear all": every line that can be emptied is; a call made on the room goes back to what it was. */
export function clearLines(lines: ReadonlyArray<AnswerLine>, drafts: AnswerDrafts): AnswerDrafts {
  return Object.fromEntries(lines.map((l) => [l.key, l.canClear ? { decision: null, note: draftOf(l, drafts).note } : { decision: l.current, note: l.currentNote }]))
}

const changed = (l: AnswerLine, d: AnswerDraft): boolean => d.decision !== l.current || (d.decision != null && d.note.trim() !== l.currentNote)

export type AnswerSet = { decision: ReviewDecision; note: string; partIds: string[]; row: boolean }
export type AnswerWrites = {
  /** Lines that take an answer, grouped by the answer and its note: one write each. */
  sets: AnswerSet[]
  /** Parts whose entered answer is taken back. */
  clearPartIds: string[]
  /** The row's own entered answer is taken back (a row with no parts). */
  clearRow: boolean
  /** The answers this save records, for the thread line. */
  counts: { approved: number; revise: number; rejected: number }
  /** How many lines change at all. */
  changed: number
}

/** What Save writes: only the lines that changed. */
export function answerWrites(lines: ReadonlyArray<AnswerLine>, drafts: AnswerDrafts): AnswerWrites {
  const sets: AnswerSet[] = []
  const clearPartIds: string[] = []
  let clearRow = false
  const counts = { approved: 0, revise: 0, rejected: 0 }
  let n = 0
  for (const l of lines) {
    const d = draftOf(l, drafts)
    if (!changed(l, d)) continue
    if (d.decision == null) {
      // Only an entered call can be emptied; anything else was never offered the tap.
      if (!l.canClear) continue
      n += 1
      if (l.partId) clearPartIds.push(l.partId)
      else clearRow = true
      continue
    }
    n += 1
    counts[d.decision] += 1
    const note = d.note.trim()
    const row = l.partId == null
    const into = sets.find((s) => s.decision === d.decision && s.note === note && s.row === row)
    if (into) {
      if (l.partId) into.partIds.push(l.partId)
    } else sets.push({ decision: d.decision, note, partIds: l.partId ? [l.partId] : [], row })
  }
  return { sets, clearPartIds, clearRow, counts, changed: n }
}

const countWords = (c: { approved: number; revise: number; rejected: number }): string => [c.approved ? `${c.approved} approved` : '', c.revise ? `${c.revise} revise` : '', c.rejected ? `${c.rejected} rejected` : ''].filter(Boolean).join(' · ')

/** How the row will read once saved: "4 approved · 1 rejected", and how many lines are still open. */
export function answerSummary(lines: ReadonlyArray<AnswerLine>, drafts: AnswerDrafts): { words: string; open: number } {
  const c = { approved: 0, revise: 0, rejected: 0 }
  let open = 0
  for (const l of lines) {
    const d = draftOf(l, drafts).decision
    if (d) c[d] += 1
    else open += 1
  }
  return { words: countWords(c), open }
}

/** The Save button says what it will do. */
export function answerSaveLabel(w: AnswerWrites): string {
  const answers = w.counts.approved + w.counts.revise + w.counts.rejected
  const back = w.changed - answers
  if (w.changed === 0) return 'Nothing to save'
  if (back === 0) return `Record ${answers} answer${answers === 1 ? '' : 's'}`
  if (answers === 0) return `Take back ${back} answer${back === 1 ? '' : 's'}`
  return `Save ${w.changed} changes`
}

/** A save that records an answer needs to know who answered; one that only takes answers back does not. */
export function answerNeedsReviewer(w: AnswerWrites): boolean {
  return w.sets.length > 0
}
