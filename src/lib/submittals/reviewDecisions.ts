/**
 * The reviewer's decisions as the office reads them (Submittals stage 4a-ii): the summary
 * line on the tab, the copyable text for a GC who works in their own system, and the rows
 * a next revision should carry when it answers only what was sent back.
 */
import type { SubmittalItemRow } from './submittalRevision'
import { asDecision, formatShortDate, type ReviewDecision } from './submittalRevision'

export const DECISION_LABELS: Record<ReviewDecision, string> = { approved: 'Approved', revise: 'Revise', rejected: 'Rejected' }

export type DecisionSummary = { decided: number; approved: number; revise: number; rejected: number; open: number; sentBack: number; byName: string[]; /** rows the office entered on a reviewer's behalf (5b) */ entered: number; enteredBy: string[] }

/** Open counts the rows that differ from the schedule and carry no decision — the ones a reviewer is asked about. */
export function summarizeDecisions(items: ReadonlyArray<Pick<SubmittalItemRow, 'status' | 'review_decision' | 'reviewed_by_name'> & { decision_source?: string | null; decision_entered_by_name?: string | null }>): DecisionSummary {
  const s: DecisionSummary = { decided: 0, approved: 0, revise: 0, rejected: 0, open: 0, sentBack: 0, byName: [], entered: 0, enteredBy: [] }
  for (const it of items) {
    const d = asDecision(it.review_decision)
    if (d) {
      s.decided += 1
      s[d] += 1
      if (d !== 'approved') s.sentBack += 1
      const n = (it.reviewed_by_name ?? '').trim()
      if (n && !s.byName.includes(n)) s.byName.push(n)
      if (it.decision_source === 'entered' || it.decision_source === 'robot') {
        s.entered += 1
        const e = (it.decision_entered_by_name ?? '').trim() || 'the office'
        if (!s.enteredBy.includes(e)) s.enteredBy.push(e)
      }
    } else if (it.status !== 'as_specified' && it.status !== 'missing' && it.status !== 'accessory') s.open += 1
  }
  return s
}

/** "19 approved · 2 revise · 1 rejected · by Dana W. · 2 entered by Wendi" — "" when nobody decided. */
export function describeDecisions(s: DecisionSummary): string {
  if (s.decided === 0) return ''
  const parts: string[] = []
  if (s.approved) parts.push(`${s.approved} approved`)
  if (s.revise) parts.push(`${s.revise} revise`)
  if (s.rejected) parts.push(`${s.rejected} rejected`)
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

/** Rows a next revision should carry when it answers only what was sent back. */
export function itemsSentBack<T extends Pick<SubmittalItemRow, 'review_decision'>>(items: ReadonlyArray<T>): T[] {
  return items.filter((it) => {
    const d = asDecision(it.review_decision)
    return d === 'revise' || d === 'rejected'
  })
}

export { formatShortDate }
