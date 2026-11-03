/**
 * When the header's global search box cannot reach a kind of thing it looks in (v2.6434, the header's side of
 * v2.6410's Pipeline fix). The box reads jobs, bids, estimates and customers from the server and finds the doors,
 * which are pages, Settings cards and guides, on the device. When a server read failed, by a lost signal or a
 * refusal, the box read `data ?? []` and said *No matches. The box looks in jobs, bids, …*, which was false:
 * nothing of that kind was searched.
 *
 * The box now keeps whatever did come back and, for each read that failed, says which kind was not searched and
 * why, on `OfflineRetryPanel`: a lost signal offers Retry and runs again by itself when the signal comes back, and
 * a refusal shows its reason with none. *No matches* stays for the case where every read answered.
 */
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../offlineRecoveryState'

/** A kind of thing the box reads from the server, in the order the box lists them. */
export type HeaderSearchReadKind = 'jobs' | 'bids' | 'estimates' | 'customers'

/** The office's box reads all four; a field role's lookup reads jobs alone (its own words: *your jobs*). */
export type HeaderSearchMode = 'office' | 'field'

export type HeaderSearchFailedRead = {
  kind: HeaderSearchReadKind
  failure: OfflineRecoveryLastError
}

/** One line of the panel: the kinds one failure kept from being searched, its words, and the failure to draw. */
export type HeaderSearchFailedLine = {
  kinds: HeaderSearchReadKind[]
  /** *Jobs and bids were not searched.* */
  words: string
  failure: OfflineRecoveryLastError
  /** The panel's lost-signal sentence: a read's words, since nothing was lost and it runs again by itself. */
  offlineMessage: string
}

export const HEADER_SEARCH_OFFICE_READ_KINDS: readonly HeaderSearchReadKind[] = ['jobs', 'bids', 'estimates', 'customers']
export const HEADER_SEARCH_FIELD_READ_KINDS: readonly HeaderSearchReadKind[] = ['jobs']

/** The lost-signal sentence under a line. *They* is every kind the box reads, all plural. */
export const HEADER_SEARCH_OFFLINE_MESSAGE = 'No connection, so they were not searched. The search runs again when the signal is back.'

const KIND_WORDS: Record<HeaderSearchMode, Record<HeaderSearchReadKind, string>> = {
  office: { jobs: 'jobs', bids: 'bids', estimates: 'estimates', customers: 'customers' },
  field: { jobs: 'your jobs', bids: 'bids', estimates: 'estimates', customers: 'customers' },
}

/** What the box finds on the device, which no lost signal keeps from answering. */
const LOCAL_WORDS: Record<HeaderSearchMode, readonly string[]> = {
  office: ['pages', 'settings', 'guides'],
  field: ['the guides for your role'],
}

export function headerSearchReadKinds(mode: HeaderSearchMode): readonly HeaderSearchReadKind[] {
  return mode === 'field' ? HEADER_SEARCH_FIELD_READ_KINDS : HEADER_SEARCH_OFFICE_READ_KINDS
}

/** *a*, *a and b*, *a, b and c*. */
function joinWords(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1)
}

/** The kinds in the box's order, each once. */
function orderedKinds(kinds: readonly HeaderSearchReadKind[], mode: HeaderSearchMode): HeaderSearchReadKind[] {
  const wanted = new Set(kinds)
  return headerSearchReadKinds(mode).filter((k) => wanted.has(k))
}

/** The line for the kinds one failure kept from being searched: *Jobs and bids were not searched.* */
export function headerSearchNotSearchedWords(kinds: readonly HeaderSearchReadKind[], mode: HeaderSearchMode): string {
  const ordered = orderedKinds(kinds, mode)
  if (ordered.length === 0) return ''
  return `${capitalize(joinWords(ordered.map((k) => KIND_WORDS[mode][k])))} were not searched.`
}

/**
 * A failed read from the error a Supabase result carried, or a thrown one. The words lead with the kind, so a
 * refusal reads *Could not search jobs. You don't have access to this record.*, and a lost signal is told by its
 * kind, never its text.
 */
export function headerSearchFailedRead(kind: HeaderSearchReadKind, error: unknown, mode: HeaderSearchMode): HeaderSearchFailedRead {
  return { kind, failure: recoveryFailureFromError(error, `Could not search ${KIND_WORDS[mode][kind]}.`) }
}

/**
 * The lines to draw: one per distinct failure, in the order the failures were met, each naming every kind that
 * failure kept from being searched. Four reads lost to the same signal are one line with one Retry.
 */
export function headerSearchFailedLines(failed: readonly HeaderSearchFailedRead[], mode: HeaderSearchMode): HeaderSearchFailedLine[] {
  const byFailure = new Map<string, { failure: OfflineRecoveryLastError; kinds: HeaderSearchReadKind[] }>()
  for (const f of failed) {
    const key = `${f.failure.kind}\n${f.failure.message}`
    const line = byFailure.get(key)
    if (line) line.kinds.push(f.kind)
    else byFailure.set(key, { failure: f.failure, kinds: [f.kind] })
  }
  return [...byFailure.values()].map(({ failure, kinds }) => {
    const ordered = orderedKinds(kinds, mode)
    return { kinds: ordered, words: headerSearchNotSearchedWords(ordered, mode), failure, offlineMessage: HEADER_SEARCH_OFFLINE_MESSAGE }
  })
}

/**
 * In place of *No matches* when nothing came back and a read failed: what was searched, and found nothing. The
 * kinds that answered come first, then what the device holds. Never *No matches*, which would say every kind
 * answered.
 */
export function headerSearchNothingMatchedWords(failed: readonly HeaderSearchFailedRead[], mode: HeaderSearchMode): string {
  const failedKinds = new Set(failed.map((f) => f.kind))
  const answered = headerSearchReadKinds(mode)
    .filter((k) => !failedKinds.has(k))
    .map((k) => KIND_WORDS[mode][k])
  return `Nothing matched in ${joinWords([...answered, ...LOCAL_WORDS[mode]])}.`
}
