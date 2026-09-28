/**
 * Bid Board → Reply book: the wording the estimators share (v2.4025 the table, the window after).
 *
 * Pure rules for the window: the kinds, the search, who may change a reply, what a draft must
 * hold, and the text a Copy puts on the clipboard. The database is the authority on who may
 * write (`docs/migrations/20260928144511_bid_reply_book.md`); `canEditBidReply` only decides
 * which buttons are drawn.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

/** The kinds, in the order the chips draw. The keys are the table's CHECK list. */
export const BID_REPLY_KINDS = [
  { key: 'declining', label: 'Declining' },
  { key: 'following_up', label: 'Following up' },
  { key: 'asking', label: 'Asking for something' },
  { key: 'after_decision', label: 'After a decision' },
  { key: 'other', label: 'Other' },
] as const

export type BidReplyKind = (typeof BID_REPLY_KINDS)[number]['key']

export const BID_REPLY_TITLE_MAX = 120
export const BID_REPLY_BODY_MAX = 4000
/** The window reads the newest replies up to this many, and says so when it is reached. */
export const BID_REPLY_BOOK_READ_LIMIT = 500

export type BidReplyEntry = {
  id: string
  title: string
  kind: string
  body: string
  sign_with_sender: boolean
  created_by: string | null
  created_by_name: string
  created_at: string
  updated_at: string
}

export type BidReplyDraft = {
  title: string
  kind: BidReplyKind
  body: string
  signWithSender: boolean
}

export const EMPTY_BID_REPLY_DRAFT: BidReplyDraft = { title: '', kind: 'declining', body: '', signWithSender: true }

export function isBidReplyKind(kind: string | null | undefined): kind is BidReplyKind {
  return BID_REPLY_KINDS.some((k) => k.key === kind)
}

/** A kind the app does not know (a newer client wrote it) reads as Other. */
export function bidReplyKindLabel(kind: string | null | undefined): string {
  return BID_REPLY_KINDS.find((k) => k.key === kind)?.label ?? 'Other'
}

export type BidReplyViewer = { userId: string | null | undefined; role: string | null | undefined; readOnly?: boolean }

/** Posting: anyone who has the window, except in training mode. */
export function canPostBidReply(viewer: BidReplyViewer): boolean {
  return !!viewer.userId && !viewer.readOnly
}

/** Change or delete: the person who posted it, or a dev. */
export function canEditBidReply(entry: Pick<BidReplyEntry, 'created_by'>, viewer: BidReplyViewer): boolean {
  if (!viewer.userId || viewer.readOnly) return false
  if (viewer.role === 'dev') return true
  return entry.created_by != null && entry.created_by === viewer.userId
}

export type BidReplyFilter = { query: string; kind: BidReplyKind | 'all' }

/** Search reads what it is for, the wording and who posted it. A blank search keeps every reply. */
export function filterBidReplies(entries: readonly BidReplyEntry[], filter: BidReplyFilter): BidReplyEntry[] {
  const q = filter.query.trim().toLowerCase()
  return entries.filter((e) => {
    if (filter.kind !== 'all' && normalizedKind(e.kind) !== filter.kind) return false
    if (!q) return true
    return `${e.title}\n${e.body}\n${e.created_by_name}`.toLowerCase().includes(q)
  })
}

function normalizedKind(kind: string): BidReplyKind {
  return isBidReplyKind(kind) ? kind : 'other'
}

/** How many replies each chip holds, over the whole book (the search does not move the counts). */
export function bidReplyKindCounts(entries: readonly BidReplyEntry[]): Record<BidReplyKind | 'all', number> {
  const counts: Record<BidReplyKind | 'all', number> = { all: entries.length, declining: 0, following_up: 0, asking: 0, after_decision: 0, other: 0 }
  for (const e of entries) counts[normalizedKind(e.kind)] += 1
  return counts
}

/** The name a copy is signed with: the first name, as people sign a short letter. */
export function bidReplySignOffName(profileName: string | null | undefined): string {
  return (profileName ?? '').trim().split(/\s+/)[0] ?? ''
}

const SIGN_OFF_WORDS = 'thank you very much|thank you|thanks|best regards|kind regards|regards|sincerely|best'
// A closing line, then at most one short line that reads as a name (letters, no sentence).
const TRAILING_SIGN_OFF = new RegExp(`(?:^|\\n)[ \\t]*(?:${SIGN_OFF_WORDS})[ \\t]*[,.!]?[ \\t]*(?:\\n[ \\t]*[A-Za-z][A-Za-z .'-]{0,39}[ \\t]*)?$`, 'i')

/**
 * The wording without the sign-off it was pasted with ("Thank you,\nWendi"), so a copy does not
 * carry two closings or the wrong name. `signOff` is what was taken off, for the form to say so.
 * Wording that is nothing but a sign-off is left alone.
 */
export function splitTrailingSignOff(body: string): { body: string; signOff: string | null } {
  const text = body.replace(/\r\n/g, '\n').trim()
  const m = TRAILING_SIGN_OFF.exec(text)
  if (!m) return { body: text, signOff: null }
  const rest = text.slice(0, m.index).trim()
  if (!rest) return { body: text, signOff: null }
  return { body: rest, signOff: m[0].trim().replace(/\s*\n\s*/g, ' ') }
}

/** What is saved for a draft: trimmed, and without a pasted sign-off when copies are signed. */
export function bidReplyDraftToSave(draft: BidReplyDraft): { title: string; kind: BidReplyKind; body: string; sign_with_sender: boolean } {
  const body = draft.signWithSender ? splitTrailingSignOff(draft.body).body : draft.body.replace(/\r\n/g, '\n').trim()
  return { title: draft.title.trim(), kind: draft.kind, body, sign_with_sender: draft.signWithSender }
}

/** Why a draft cannot be posted, in the form's words; null when it can. */
export function bidReplyDraftProblem(draft: BidReplyDraft): string | null {
  const saved = bidReplyDraftToSave(draft)
  if (!saved.title) return 'Say what the reply is for.'
  if (saved.title.length > BID_REPLY_TITLE_MAX) return `Keep "what it is for" to ${BID_REPLY_TITLE_MAX} characters.`
  if (!saved.body) return 'Add the wording.'
  if (saved.body.length > BID_REPLY_BODY_MAX) return `The wording is ${saved.body.length.toLocaleString('en-US')} characters; the most is ${BID_REPLY_BODY_MAX.toLocaleString('en-US')}.`
  return null
}

export function bidReplyEntryToDraft(entry: BidReplyEntry): BidReplyDraft {
  return { title: entry.title, kind: normalizedKind(entry.kind), body: entry.body, signWithSender: entry.sign_with_sender }
}

/** What Copy puts on the clipboard: the wording, signed by whoever pressed it. */
export function bidReplyCopyText(entry: Pick<BidReplyEntry, 'body' | 'sign_with_sender'>, profileName: string | null | undefined): string {
  if (!entry.sign_with_sender) return entry.body
  const name = bidReplySignOffName(profileName)
  return `${entry.body}\n\nThank you,${name ? `\n${name}` : ''}`
}

/** "You · Sep 28", "Wendi · Sep 28 · edited Sep 30", "Wendi · Sep 28 · edited" (the same day). A reply whose author is gone keeps the name. */
export function bidReplyByline(entry: BidReplyEntry, viewerUserId: string | null | undefined): string {
  const mine = entry.created_by != null && entry.created_by === viewerUserId
  const who = mine ? 'You' : entry.created_by_name.trim() || 'Someone no longer here'
  const postedYmd = calendarYmdInAppTzFromIso(entry.created_at)
  const parts = [who, formatWorkDateYmdMonthDayShort(postedYmd)].filter(Boolean)
  const editedMs = Date.parse(entry.updated_at) - Date.parse(entry.created_at)
  if (Number.isFinite(editedMs) && editedMs > 60_000) {
    const editedYmd = calendarYmdInAppTzFromIso(entry.updated_at)
    parts.push(editedYmd === postedYmd ? 'edited' : `edited ${formatWorkDateYmdMonthDayShort(editedYmd)}`)
  }
  return parts.join(' · ')
}
