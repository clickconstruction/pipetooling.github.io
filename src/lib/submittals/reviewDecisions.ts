/**
 * The reviewer's decisions as the office reads them (Submittals stage 4a-ii): the summary
 * line on the tab, the copyable text for a GC who works in their own system, and the rows
 * a next revision should carry when it answers only what was sent back.
 */
import type { SubmittalItemRow } from './submittalRevision'
import { asDecision, formatShortDate, type ReviewDecision } from './submittalRevision'

export const DECISION_LABELS: Record<ReviewDecision, string> = { approved: 'Approved', revise: 'Revise', rejected: 'Rejected' }

export type DecisionSummary = { decided: number; approved: number; revise: number; rejected: number; open: number; /** rows with no answer at all, whatever their status: what a resubmit carries beside the rows sent back */ noAnswer: number; /** of `noAnswer`: rows with no product yet, so nothing for the reviewer to answer (2026-10-05) */ noProduct?: number; sentBack: number; byName: string[]; /** rows the office entered on a reviewer's behalf (5b) */ entered: number; enteredBy: string[]; /** of `rejected` / `revise`: rows where only some of the parts the GC sees got that answer (2026-10-03) */ rejectedInPart?: number; reviseInPart?: number }

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
      if (it.status === 'missing') s.noProduct = (s.noProduct ?? 0) + 1
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

/**
 * The resubmit button. It says what the press does: it starts a draft. It used to read "Rev 2 from
 * the 4 rows sent back and the 10 with no answer", which named the rows and left the owner asking
 * whether it sent anything (2026-10-05). The rows are chosen in the question (`resubmitChooser`).
 */
export function resubmitLabel(nextRev: number): string {
  return `Start a Rev ${nextRev} draft…`
}

/** "Nothing is sent. The GC sees Rev 2 only after you press Share." */
export function resubmitNothingSent(nextRev: number): string {
  return `Nothing is sent. The GC sees Rev ${nextRev} only after you press Share.`
}

/** Which rows the next draft starts with: the rows that still need the GC, or every row. */
export type ResubmitRows = 'need' | 'every'

export type ResubmitChooserWords = {
  title: string
  lead: string
  choices: ReadonlyArray<{ key: ResubmitRows; label: string; detail: string }>
  foot: string
  confirmLabel: Record<ResubmitRows, string>
}

/**
 * Parts the GC approved on rows that go on the next draft (a row sent back, or one with no answer).
 * "Only the rows that need it" keeps these approvals; "Every row" asks them again.
 */
export function approvedPartsGoingOn(rows: ReadonlyArray<Pick<SubmittalItemRow, 'id' | 'review_decision'>>, partsOf: ReadonlyMap<string, ReadonlyArray<{ on_submittal: boolean; review_decision: string | null }>>): number {
  let n = 0
  for (const r of rows) {
    if (asDecision(r.review_decision) === 'approved') continue
    for (const p of partsOf.get(r.id) ?? []) if (p.on_submittal && p.review_decision === 'approved') n += 1
  }
  return n
}

/**
 * Is there anything to choose? With no row approved and no part approved, "Only the rows that
 * need it" and "Every row" make the same draft (BP375 on 2026-10-05), so the question is asked once.
 */
export function resubmitHasChoice(c: { approved: number; approvedParts?: number }): boolean {
  return c.approved > 0 || (c.approvedParts ?? 0) > 0
}

/** Beside the button when rows were sent back: the rows are chosen in the question, and nothing is sent. */
export function resubmitCaption(nextRev: number): string {
  return `You choose the rows next. ${resubmitNothingSent(nextRev)}`
}

export type ResubmitCounts = { sentBack: number; noAnswer: number; approved: number; orderOnly?: number; approvedParts?: number; needTotal: number; everyTotal: number }

/** "Start the draft with 14 rows" */
export function startDraftLabel(total: number, every = false): string {
  return `Start the draft with ${every && total > 1 ? `all ${total} rows` : rowsWord(total)}`
}

/**
 * The question before a draft is started on a revision with rows sent back (2026-10-05). It used
 * to be two buttons, and the owner asked whether they did the same thing. Now one button opens
 * this, and each choice says what happens to the approved rows. `needTotal` and `everyTotal` are
 * the rows each draft would hold, order-only rows included.
 */
export function resubmitChooser(rev: number, c: ResubmitCounts): ResubmitChooserWords {
  const next = rev + 1
  const one = (n: number, single: string, many: string) => (n === 1 ? single : many)
  const orderOnly = c.orderOnly ?? 0
  const need = [c.noAnswer > 0 ? `${c.sentBack} sent back and ${c.noAnswer} with no answer.` : `The ${rowsWord(c.sentBack)} sent back.`]
  if (orderOnly > 0) need.push(`${rowsWord(orderOnly)} you buy without the GC ${one(orderOnly, 'goes', 'go')} on it too.`)
  need.push(c.approved > 0 ? `The ${rowsWord(c.approved)} approved ${one(c.approved, 'stays', 'stay')} on Rev ${rev} and on the procurement log.` : `No row was approved on Rev ${rev}.`)
  const every = [c.approved > 0 ? `The ${rowsWord(c.approved)} approved ${one(c.approved, 'goes', 'go')} on Rev ${next} too.` : 'The same rows go on it.', c.approved > 0 ? 'The GC answers every row and every part again.' : 'The GC answers every part again, the approved parts too.', 'Use it when a product changed.']
  return {
    title: `Start a Rev ${next} draft`,
    lead: `Which rows go on Rev ${next}?`,
    choices: [
      { key: 'need', label: 'Only the rows that need it', detail: need.join(' ') },
      { key: 'every', label: 'Every row', detail: every.join(' ') },
    ],
    foot: `Rev ${next} starts as a draft. ${resubmitNothingSent(next)}`,
    confirmLabel: { need: startDraftLabel(c.needTotal), every: startDraftLabel(c.everyTotal, true) },
  }
}

/**
 * Rows were sent back but nothing was approved, so there is one kind of draft: every row goes on
 * it. One plain question, built from the chooser's own words.
 */
export function resubmitOneKind(rev: number, c: ResubmitCounts): { title: string; message: string; confirmLabel: string } {
  const words = resubmitChooser(rev, c)
  return { title: words.title, message: `Every row goes on Rev ${rev + 1}. ${words.choices[0]!.detail} ${words.foot}`, confirmLabel: words.confirmLabel.need }
}

export { formatShortDate }
