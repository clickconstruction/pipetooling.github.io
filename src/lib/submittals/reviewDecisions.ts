/**
 * The reviewer's decisions as the office reads them (Submittals stage 4a-ii): the summary
 * line on the tab, the copyable text for a GC who works in their own system, and the rows
 * a next revision should carry when it answers only what was sent back.
 */
import type { SubmittalItemRow } from './submittalRevision'
import { asDecision, formatShortDate, type ReviewDecision } from './submittalRevision'

export const DECISION_LABELS: Record<ReviewDecision, string> = { approved: 'Approved', revise: 'Revise', rejected: 'Rejected' }

export type DecisionSummary = { decided: number; approved: number; revise: number; rejected: number; open: number; /** rows with no answer at all, whatever their status: what a resubmit carries beside the rows sent back */ noAnswer: number; sentBack: number; byName: string[]; /** rows the office entered on a reviewer's behalf (5b) */ entered: number; enteredBy: string[]; /** of `rejected` / `revise`: rows where only some of the parts the GC sees got that answer (2026-10-03) */ rejectedInPart?: number; reviseInPart?: number }

/** A part as the answer words need it. */
export type PartCall = { on_submittal: boolean; review_decision?: string | null }

/**
 * A row's answer as the office reads it in the Their call cell (2026-10-03). A row's own call is
 * the roll-up of its parts, and one part sent back sends the row back: LAV-1 read "Rejected" in
 * red when one faucet of three was rejected and two parts had no answer. With parts, the cell
 * gets one word only when every part the GC sees has the same answer; otherwise it counts.
 * null when nothing is answered.
 */
export type RowCallWords = { head: string; tone: ReviewDecision | 'open'; rest: string }

export function rowCallWords(decision: ReviewDecision | null, parts: ReadonlyArray<PartCall> = []): RowCallWords | null {
  const gc = parts.filter((p) => p.on_submittal)
  if (gc.length === 0) return decision ? { head: DECISION_LABELS[decision], tone: decision, rest: '' } : null
  const c = { approved: 0, revise: 0, rejected: 0, open: 0 }
  for (const p of gc) c[asDecision(p.review_decision) ?? 'open'] += 1
  const n = gc.length
  if (c.open === n) return decision ? { head: DECISION_LABELS[decision], tone: decision, rest: '' } : null
  for (const k of ['rejected', 'revise', 'approved'] as const) if (c[k] === n) return { head: DECISION_LABELS[k], tone: k, rest: '' }
  const tone: ReviewDecision = c.rejected > 0 ? 'rejected' : c.revise > 0 ? 'revise' : 'approved'
  const word = { approved: 'approved', revise: 'to revise', rejected: 'rejected' } as const
  const rest = (['approved', 'revise', 'rejected'] as const).filter((k) => k !== tone && c[k] > 0).map((k) => `${c[k]} ${word[k]}`)
  if (c.open > 0) rest.push(`${c.open} with no answer yet`)
  return { head: `${c[tone]} of ${n} ${word[tone]}`, tone, rest: rest.join(' · ') }
}

/** Open counts the rows that differ from the schedule and carry no decision — the ones a reviewer is asked about. */
export function summarizeDecisions(items: ReadonlyArray<Pick<SubmittalItemRow, 'status' | 'review_decision' | 'reviewed_by_name'> & { id?: string; decision_source?: string | null; decision_entered_by_name?: string | null }>, /** the rows' parts, so a row sent back for one part of three is counted as in part */ partsByItem?: ReadonlyMap<string, ReadonlyArray<PartCall>>): DecisionSummary {
  const s: DecisionSummary = { decided: 0, approved: 0, revise: 0, rejected: 0, open: 0, noAnswer: 0, sentBack: 0, byName: [], entered: 0, enteredBy: [] }
  for (const it of items) {
    const d = asDecision(it.review_decision)
    if (d) {
      s.decided += 1
      s[d] += 1
      if (d !== 'approved') {
        s.sentBack += 1
        const gc = (it.id ? partsByItem?.get(it.id) ?? [] : []).filter((p) => p.on_submittal)
        if (gc.length > 0 && gc.some((p) => asDecision(p.review_decision) !== d)) {
          if (d === 'rejected') s.rejectedInPart = (s.rejectedInPart ?? 0) + 1
          else s.reviseInPart = (s.reviseInPart ?? 0) + 1
        }
      }
      const n = (it.reviewed_by_name ?? '').trim()
      if (n && !s.byName.includes(n)) s.byName.push(n)
      if (it.decision_source === 'entered' || it.decision_source === 'robot') {
        s.entered += 1
        const e = (it.decision_entered_by_name ?? '').trim() || 'the office'
        if (!s.enteredBy.includes(e)) s.enteredBy.push(e)
      }
    } else {
      s.noAnswer += 1
      if (it.status !== 'as_specified' && it.status !== 'missing' && it.status !== 'accessory') s.open += 1
    }
  }
  return s
}

/** "19 approved · 2 revise · 1 rejected · by Dana W. · 2 entered by Wendi" — "" when nobody decided. */
export function describeDecisions(s: DecisionSummary): string {
  if (s.decided === 0) return ''
  const parts: string[] = []
  if (s.approved) parts.push(`${s.approved} approved`)
  // 2026-10-03 · a row sent back for one part of three is not a rejected fixture: it is counted apart, in words that say so.
  const reviseWhole = s.revise - (s.reviseInPart ?? 0)
  const rejectedWhole = s.rejected - (s.rejectedInPart ?? 0)
  if (reviseWhole) parts.push(`${reviseWhole} revise`)
  if (s.reviseInPart) parts.push(`${s.reviseInPart} with a part to revise`)
  if (rejectedWhole) parts.push(`${rejectedWhole} rejected`)
  if (s.rejectedInPart) parts.push(`${s.rejectedInPart} with a part rejected`)
  if (s.byName.length) parts.push(`by ${s.byName.join(', ')}`)
  if (s.entered > 0) parts.push(`${s.entered} entered by ${s.enteredBy.join(', ')}`)
  return parts.join(' · ')
}

/** The decisions as plain text a GC can paste into their own system. */
export function decisionsAsText(items: ReadonlyArray<Pick<SubmittalItemRow, 'tag' | 'submitted_label' | 'submitted_model' | 'review_decision' | 'review_note' | 'reviewed_by_name' | 'reviewed_at'> & { decision_source?: string | null; decision_entered_by_name?: string | null }>, heading: string, tz: string): string {
  const lines = [heading]
  for (const it of items) {
    const d = asDecision(it.review_decision)
    if (!d) continue
    const entered = it.decision_source === 'entered' || it.decision_source === 'robot' ? `entered by ${(it.decision_entered_by_name ?? '').trim() || 'the office'}` : ''
    const who = [it.reviewed_by_name, entered, formatShortDateTz(it.reviewed_at, tz)].filter(Boolean).join(' · ')
    lines.push(`${it.tag.trim() || 'Accessory'} · ${it.submitted_label ?? it.submitted_model ?? '—'} — ${DECISION_LABELS[d]}${it.review_note ? `: "${it.review_note}"` : ''}${who ? ` (${who})` : ''}`)
  }
  return lines.length > 1 ? lines.join('\n') : `${heading}\n(no decisions yet)`
}

function formatShortDateTz(iso: string | null, tz: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz })
}

/** Rows the reviewer sent back: Revise or Reject. */
export function itemsSentBack<T extends Pick<SubmittalItemRow, 'review_decision'>>(items: ReadonlyArray<T>): T[] {
  return items.filter((it) => {
    const d = asDecision(it.review_decision)
    return d === 'revise' || d === 'rejected'
  })
}

/**
 * How a revision's rows split when the next one answers what was sent back (2026-10-03). Only an
 * approved row stays behind: it stands on its revision and on the procurement log. A row sent back
 * goes on to be fixed, and a row with no answer goes on to keep waiting. Before this the resubmit
 * carried the rows sent back alone and called the rest approved: on BP375, four rows sent back
 * would have dropped nine rows nobody had answered, off the draft and off the log.
 */
export type ResubmitSplit<T> = { sentBack: T[]; noAnswer: T[]; approved: T[] }

export function resubmitSplit<T extends Pick<SubmittalItemRow, 'review_decision'>>(items: ReadonlyArray<T>): ResubmitSplit<T> {
  const split: ResubmitSplit<T> = { sentBack: [], noAnswer: [], approved: [] }
  for (const it of items) {
    const d = asDecision(it.review_decision)
    if (d === 'approved') split.approved.push(it)
    else if (d) split.sentBack.push(it)
    else split.noAnswer.push(it)
  }
  return split
}

const rowsWord = (n: number) => `${n} row${n === 1 ? '' : 's'}`

/** The resubmit button: "Rev 2 from the 4 rows sent back", and "… and the 9 with no answer" when some still wait. */
export function resubmitLabel(nextRev: number, sentBack: number, noAnswer = 0): string {
  return `Rev ${nextRev} from the ${rowsWord(sentBack)} sent back${noAnswer > 0 ? ` and the ${noAnswer} with no answer` : ''}`
}

/**
 * The question before the resubmit is built: every kind of row, counted, and where it goes.
 * `total` is the rows the new draft will hold, order-only rows included.
 */
export function resubmitConfirm(rev: number, c: { sentBack: number; noAnswer: number; approved: number; orderOnly?: number; total: number }): { title: string; message: string; confirmLabel: string } {
  const next = rev + 1
  const one = (n: number, single: string, many: string) => (n === 1 ? single : many)
  const lines = [`${rowsWord(c.sentBack)} ${one(c.sentBack, 'was', 'were')} sent back. ${one(c.sentBack, 'It goes', 'They go')} on Rev ${next} so you can fix ${one(c.sentBack, 'it', 'them')}.`]
  if (c.noAnswer > 0) lines.push(`${rowsWord(c.noAnswer)} ${one(c.noAnswer, 'has', 'have')} no answer yet. ${one(c.noAnswer, 'It goes', 'They go')} on Rev ${next} too and ${one(c.noAnswer, 'keeps', 'keep')} waiting.`)
  lines.push(c.approved > 0 ? `${rowsWord(c.approved)} ${one(c.approved, 'was', 'were')} approved. ${one(c.approved, 'It stays', 'They stay')} on Rev ${rev} and on the procurement log.` : `No row was approved on Rev ${rev}.`)
  if ((c.orderOnly ?? 0) > 0) lines.push(`${rowsWord(c.orderOnly ?? 0)} you buy without the GC ${one(c.orderOnly ?? 0, 'goes', 'go')} on Rev ${next} too.`)
  return { title: resubmitLabel(next, c.sentBack, c.noAnswer), message: lines.join(' '), confirmLabel: `Build Rev ${next} with ${rowsWord(c.total)}` }
}

export { formatShortDate }
