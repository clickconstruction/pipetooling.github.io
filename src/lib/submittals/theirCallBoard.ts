/**
 * What step 6, *Their call*, says without being asked (Submittals, 2026-10-05): where the
 * revision stands fixture by fixture, which parts came back and in whose words, who is still
 * owed an answer, and which fixtures have nothing to answer yet. Pure: `SubmittalTheirCallPanel`
 * draws what this returns.
 *
 * The four states are the page's own, so its counts agree with the rest of the tab:
 * - **sent back**: the row's answer is Revise or Rejected (what a resubmit fixes, `resubmitSplit`);
 * - **approved**: the row's answer is Approved;
 * - **waiting**: no answer, and a product to answer on (`rowsToApproveAll`, what one
 *   "mark them all approved" entry covers);
 * - **no product**: no answer and no product yet, so there is nothing for the reviewer to answer.
 */
import { rowsToApproveAll } from './enteredDecisions'
import { splitPartLabel, submittedParts, type SubmittalPartRow } from './itemParts'
import { DECISION_LABELS } from './reviewDecisions'
import { asDecision, formatShortDate, type SubmittalItemRow } from './submittalRevision'

export type BoardState = 'approved' | 'sentBack' | 'waiting' | 'noProduct'
export type BoardCell = { id: string; tag: string; state: BoardState }
export type SentBackPart = { key: string; /** maker and model */ head: string; tone: 'revise' | 'rejected'; /** "Rejected" */ word: string; /** the reviewer's own words */ note: string }
export type SentBackRow<T> = { item: T; tag: string; parts: SentBackPart[] }

type BoardItem = Pick<SubmittalItemRow, 'id' | 'tag' | 'status' | 'review_decision' | 'review_note' | 'submitted_label' | 'submitted_model'>
type BoardPart = Pick<SubmittalPartRow, 'id' | 'label' | 'on_submittal' | 'sequence_order' | 'review_decision' | 'review_note'>

export type TheirCallBoard<T> = {
  /** One cell a fixture, grouped: approved, sent back, waiting, then no product. */
  cells: BoardCell[]
  counts: Record<BoardState, number>
  sentBack: SentBackRow<T>[]
  /** How many parts the sent-back list names. */
  sentBackParts: number
  waiting: T[]
  noProduct: T[]
  /** Every fixture with a product is approved. */
  allApproved: boolean
}

const tagOf = (tag: string) => tag.trim() || 'Accessory'
const ORDER: BoardState[] = ['approved', 'sentBack', 'waiting', 'noProduct']

export function theirCallBoard<T extends BoardItem>(items: ReadonlyArray<T>, partsOf: ReadonlyMap<string, ReadonlyArray<BoardPart>> = new Map()): TheirCallBoard<T> {
  const waitingIds = new Set(rowsToApproveAll(items).map((it) => it.id))
  const stateOf = (it: T): BoardState => {
    const d = asDecision(it.review_decision)
    if (d === 'approved') return 'approved'
    if (d) return 'sentBack'
    return waitingIds.has(it.id) ? 'waiting' : 'noProduct'
  }
  const by: Record<BoardState, T[]> = { approved: [], sentBack: [], waiting: [], noProduct: [] }
  for (const it of items) by[stateOf(it)].push(it)
  const sentBack: SentBackRow<T>[] = by.sentBack.map((it) => {
    const d = asDecision(it.review_decision) as 'revise' | 'rejected'
    const marked = submittedParts(partsOf.get(it.id) ?? []).flatMap((p): SentBackPart[] => {
      const pd = asDecision(p.review_decision)
      return pd === 'revise' || pd === 'rejected' ? [{ key: p.id, head: splitPartLabel(p.label).head, tone: pd, word: DECISION_LABELS[pd], note: (p.review_note ?? '').trim() }] : []
    })
    // No part carries the answer: it was given on the row as a whole.
    const parts = marked.length > 0 ? marked : [{ key: it.id, head: (it.submitted_label ?? it.submitted_model ?? '').trim() || 'the whole fixture', tone: d, word: DECISION_LABELS[d], note: (it.review_note ?? '').trim() }]
    return { item: it, tag: tagOf(it.tag), parts }
  })
  const counts = { approved: by.approved.length, sentBack: by.sentBack.length, waiting: by.waiting.length, noProduct: by.noProduct.length }
  return {
    cells: ORDER.flatMap((state) => by[state].map((it) => ({ id: it.id, tag: tagOf(it.tag), state }))),
    counts,
    sentBack,
    sentBackParts: sentBack.reduce((n, r) => n + r.parts.length, 0),
    waiting: by.waiting,
    noProduct: by.noProduct,
    allApproved: counts.approved > 0 && counts.sentBack === 0 && counts.waiting === 0,
  }
}

type WhoItem = Pick<SubmittalItemRow, 'review_decision' | 'reviewed_by_name' | 'reviewed_at'> & { decision_source?: string | null; decision_entered_by_name?: string | null }

const andList = (names: ReadonlyArray<string>) => (names.length <= 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)
const unique = (xs: ReadonlyArray<string>) => [...new Set(xs.filter(Boolean))]

/** Who answered, by name, or "the reviewer" while nobody has. */
export function reviewerNames(items: ReadonlyArray<WhoItem>): string {
  return andList(unique(items.filter((it) => asDecision(it.review_decision)).map((it) => (it.reviewed_by_name ?? '').trim()))) || 'the reviewer'
}

/**
 * One or two plain sentences on where the answers came from: "structura answered. Wendi typed the
 * answers in on Oct 2." / "Dana Whitfield answered on the review link, last on Oct 9." — "" while
 * nothing is answered.
 */
export function whoAnsweredLine(items: ReadonlyArray<WhoItem>): string {
  const decided = items.filter((it) => asDecision(it.review_decision))
  if (decided.length === 0) return ''
  const who = reviewerNames(items)
  // A name is written as its owner writes it ("structura"); only the stand-in takes a capital.
  const Who = who === 'the reviewer' ? 'The reviewer' : who
  const typed = decided.filter((it) => it.decision_source === 'entered' || it.decision_source === 'robot')
  const typists = andList(unique(typed.map((it) => (it.decision_entered_by_name ?? '').trim()))) || 'The office'
  const last = decided.map((it) => it.reviewed_at ?? '').sort().pop() ?? ''
  const day = formatShortDate(last)
  if (typed.length === decided.length) return `${Who} answered. ${typists} typed the answers in${day ? ` on ${day}` : ''}.`
  if (typed.length === 0) return `${Who} answered on the review link${day ? `, last on ${day}` : ''}.`
  return `${Who} answered. ${typists} typed in ${typed.length} of the ${decided.length} answers.${day ? ` The last came on ${day}.` : ''}`
}

/** "All 13 approved by structura on Oct 9. Nothing is left to do here. Order them in step 8." */
export function allApprovedLine(approved: number, items: ReadonlyArray<WhoItem>): string {
  const last = items.filter((it) => asDecision(it.review_decision)).map((it) => it.reviewed_at ?? '').sort().pop() ?? ''
  const day = formatShortDate(last)
  return `${approved === 1 ? 'The 1 fixture is' : `All ${approved}`} approved by ${reviewerNames(items)}${day ? ` on ${day}` : ''}. Nothing is left to do here. Order them in step 8.`
}

/** "UTILITY SINK has no product yet" / "FD and UTILITY SINK have no product yet" — the sentence's subject and verb. */
export function noProductWords(tags: ReadonlyArray<string>): string {
  if (tags.length === 0) return ''
  return `${andList(tags.map(tagOf))} ${tags.length === 1 ? 'has' : 'have'} no product yet, so there is nothing for them to answer.`
}
