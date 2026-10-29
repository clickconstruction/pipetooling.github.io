/**
 * Questions on a record (punch list #208 PR 4b): a bid's or a job's own log of what was asked about
 * it, drawn on its window as *Questions on this bid* / *Questions on this job* with the two presses,
 * **Ask the estimators** and **Ask Dispatch**, the same rows the Development page's Questions card
 * draws (`MemberRequest`). A question asked on the bid a job came from shows on the job too, marked
 * *asked on BP418*, one direction. Pure; the read is `fetchRecordQuestions.ts`, the window
 * `components/developments/RecordQuestions.tsx`.
 */
import type { UserRole } from '../../hooks/useAuth'
import { GC_OFFICE_TEAM } from '../gc/access'
import type { AskAbout } from './ask'
import { requestIsOpen, type MemberRequest } from './overview'

export type RecordKind = 'job' | 'bid'

/** The record a log is about: its kind, its id, and the label the inbox's reference line and the sheet read (*JP1085 Lot 14 rough-in*). */
export type RecordPiece = { kind: RecordKind; id: string; label: string }

export const RECORD_QUESTIONS_TITLE: Record<RecordKind, string> = { job: 'Questions on this job', bid: 'Questions on this bid' }

/** What the sheet's foot says the question lands with. */
export const RECORD_LANDS_WITH: Record<RecordKind, string> = { job: 'this job', bid: 'this bid' }

/** Who sees the log and the presses: the office team, who read every question that names a record (the PR 4 policy). */
export function recordQuestionsOffered(role: UserRole | null | undefined): boolean {
  return role != null && GC_OFFICE_TEAM.includes(role)
}

/** *JP1085 Lot 14 rough-in*: the number's label and the name, the name alone when there is no number. */
export function recordPieceLabel(numberLabel: string | null | undefined, name: string | null | undefined): string {
  return `${(numberLabel ?? '').trim()} ${(name ?? '').trim()}`.trim()
}

/** Open first, then answered, newest first within each: the order the Questions card and the record's log share. */
export function sortQuestions<T extends Pick<MemberRequest, 'status' | 'closed_at' | 'created_at'>>(requests: readonly T[]): T[] {
  return [...requests].sort((a, b) => {
    const ao = requestIsOpen(a)
    const bo = requestIsOpen(b)
    if (ao !== bo) return ao ? -1 : 1
    return b.created_at.localeCompare(a.created_at)
  })
}

/** The section's meta words: *1 waiting · 1 answered*, *nothing waiting · 2 answered*, or *none yet*. */
export function recordQuestionsMeta(requests: ReadonlyArray<Pick<MemberRequest, 'status' | 'closed_at'>>): string {
  if (requests.length === 0) return 'none yet'
  const open = requests.filter(requestIsOpen).length
  const answered = requests.length - open
  const parts = [open > 0 ? `${open} waiting` : 'nothing waiting']
  if (answered > 0) parts.push(`${answered} answered`)
  return parts.join(' · ')
}

/** The `or` filter the read uses: the record's own questions, and for a job those asked on the bid it came from. */
export function recordQuestionsFilter(piece: Pick<RecordPiece, 'kind' | 'id'>, fromBidId: string | null): string {
  const own = piece.kind === 'job' ? `job_ledger_id.eq.${piece.id}` : `bid_id.eq.${piece.id}`
  return piece.kind === 'job' && fromBidId ? `${own},bid_id.eq.${fromBidId}` : own
}

export type RecordQuestion = MemberRequest & {
  /** *asked on BP418* when a bid's question shows on the job it became; null on the record's own. */
  askedOn: string | null
}

/** The rows with their mark: on a job, a question that names the bid it came from carries that bid's label. */
export function markAskedOn(requests: readonly MemberRequest[], piece: Pick<RecordPiece, 'kind'>, fromBid: { id: string; label: string } | null): RecordQuestion[] {
  return requests.map((r) => ({ ...r, askedOn: piece.kind === 'job' && fromBid && r.bid_id === fromBid.id ? fromBid.label : null }))
}

/** The Ask sheet's one About on a record: that record. */
export function recordAskAbout(piece: RecordPiece): AskAbout {
  return { kind: piece.kind, id: piece.id, label: piece.label }
}

export function recordAskKey(piece: Pick<RecordPiece, 'kind' | 'id'>): string {
  return `${piece.kind}:${piece.id}`
}
