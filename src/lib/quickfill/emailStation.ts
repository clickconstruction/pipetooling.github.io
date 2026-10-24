/**
 * Quickfill's Email station (punch list #159, v2.5827, PR 4 of 5): the station's model from what the `gmail-count`
 * sweep keeps. For each box the viewer may see (a shared box; their own; everyone's when they are the lead), one row per
 * label it counts: the live count (Gmail's own, `labels_state.total`), the oldest thread's age, the threads sitting
 * past the limit with the day they arrived and a door into Gmail, and the newer ones as a number; what moved since the
 * station's last look; the words that say what is counted and who sees it; and the note a mark saves. While the app
 * counts nothing the viewer can see yet, the station stays the hand-typed rows it was (`mode: 'byHand'`), with the
 * reason, so the morning look never stops. Pure.
 */
import { cleanLabels } from '../emailIn/countedBoxes'
import type { LabelState, WatchView } from '../emailIn/countCard'
import { boxWords } from '../emailIn/readerBoxes'
import { composeLookNote, gmailLabelHref, labelFacts, missingLabelWords, sinceTotals, type LabelFacts, type NoteBox, type ThreadRow } from '../emailIn/labelFacts'
import { lineWhen } from '../messages/thread'

/** A thread row with the box it belongs to, as the station reads `email_box_threads`. */
export interface StationThreadRow extends ThreadRow {
  watch_id: string
}

export type StationLabel =
  /** Counted: `shown` is Gmail's own count; `cut` says the list stopped at the sweep's page cap. */
  | { kind: 'facts'; label: string; shown: number; cut: boolean; facts: LabelFacts; href: string | null }
  | { kind: 'missing'; label: string; words: string; href: string | null }
  /** On the row, not counted yet. */
  | { kind: 'waiting'; label: string }
  | { kind: 'error'; label: string; words: string }

export interface StationBox {
  watchId: string
  kind: 'shared' | 'person'
  /** The viewer's own box. */
  mine: boolean
  /** "bids@", "Your mail", "Marisol's mail". */
  title: string
  /** Who sees it: "for the office", "shows to you and Dale". */
  who: string
  /** "read 4 min ago", "not read yet". */
  readWords: string
  /** The last count's own words when it stopped. */
  problem: string | null
  labels: StationLabel[]
  open: number
  past: number
  /** The doors open for the box's own person and for a shared box; a lead looking at someone else's box asks them. */
  canOpen: boolean
}

export interface EmailStationModel {
  mode: 'live' | 'byHand'
  /** Why the station is still by hand. */
  byHandWhy: string | null
  boxes: StationBox[]
  open: number
  past: number
  limitDays: number
  /** The freshest count over the boxes: "read 4 min ago". */
  readWords: string | null
  since: { newSince: number; clearedSince: number; stillSince: number; words: string } | null
  /** What is counted and who sees it, one sentence each. */
  stance: string[]
  /** The note a mark saves: the boxes, the stuck threads by name, the moves, then the person's own word. */
  note: string
}

export interface EmailStationInput {
  on: boolean
  limitDays: number
  leadId: string | null
  rows: readonly WatchView[]
  threads: readonly StationThreadRow[]
  /** A person's first name by their users.id: the box owners and the lead. */
  names: Readonly<Record<string, string>>
  viewerId: string | null
  nowIso: string
  /** The station's last mark, anyone's; null when it was never marked. */
  sinceIso: string | null
  /** The person's own sentence, from the box under the rows. */
  word?: string | null
}

export const BY_HAND_OFF = 'The app does not count this mail yet. Until the owner turns it on in Settings, type what is still there.'
export const BY_HAND_NONE = 'The app counts no inbox you can see yet. Until the owner adds one in Settings, type what is still there.'
export const BY_HAND_NOT_YET = 'The app has not counted this mail yet. Until the first count, type what is still there.'
export const STANCE_WORDS = 'Senders, subjects and dates only, never the words.'
export const STANCE_GMAIL = 'It changes nothing in Gmail.'
export const WORD_PLACEHOLDER = 'A word about these (optional)'
export const READ_AGAIN = 'Read again'

/** "just now", "4 min ago", "3 h ago", or the day: "Thu, Oct 22". */
export function agoWords(iso: string, nowIso: string): string {
  const ms = new Date(nowIso).getTime() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return lineWhen(iso, nowIso).split(' · ')[0] ?? ''
}

const join = (items: readonly string[]): string => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

/** Whether the viewer may see this box's threads on the station, as `email_box_can_see` decides. */
function visible(row: WatchView, viewerId: string | null, leadId: string | null): boolean {
  if (!row.user_id) return true
  return !!viewerId && (row.user_id === viewerId || leadId === viewerId)
}

function labelOf(name: string, state: LabelState | undefined, threads: readonly StationThreadRow[], row: WatchView, box: { words: string; canOpen: boolean }, input: EmailStationInput): StationLabel {
  const href = box.canOpen ? gmailLabelHref(row.address, name) : null
  if (state?.missing) return { kind: 'missing', label: name, words: missingLabelWords(name, box.words), href: box.canOpen ? 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(row.address) + '#settings/labels' : null }
  if (state?.error) return { kind: 'error', label: name, words: `${name} was not counted: ${state.error}` }
  if (!state) return { kind: 'waiting', label: name }
  const facts = labelFacts(name, threads, { address: row.address, limitDays: input.limitDays, nowIso: input.nowIso, sinceIso: input.sinceIso })
  const factsHref = box.canOpen ? facts : { ...facts, past: facts.past.map((t) => ({ ...t, href: '' })) }
  return { kind: 'facts', label: name, shown: typeof state.total === 'number' ? state.total : facts.count, cut: state.cut === true, facts: factsHref, href }
}

/** The station's model. */
export function emailStation(input: EmailStationInput): EmailStationModel {
  const lead = input.leadId ? (input.names[input.leadId] ?? null) : null
  const seen = input.rows.filter((r) => r.is_on && visible(r, input.viewerId, input.leadId))
  // Shared boxes first, then the viewer's own, then the others the lead sees, each in the order added.
  const ordered = [...seen].sort((a, b) => {
    const rank = (r: WatchView) => (!r.user_id ? 0 : r.user_id === input.viewerId ? 1 : 2)
    return rank(a) - rank(b) || a.created_at.localeCompare(b.created_at)
  })

  const boxes: StationBox[] = ordered.map((row) => {
    const mine = !!row.user_id && row.user_id === input.viewerId
    const name = row.user_id ? (input.names[row.user_id] ?? row.address) : ''
    const words = boxWords(row.address)
    const title = !row.user_id ? words : mine ? 'Your mail' : `${name}'s mail`
    const who = !row.user_id
      ? 'for the office'
      : mine
        ? lead && input.leadId !== input.viewerId
          ? `shows to you and ${lead}`
          : 'shows to you alone'
        : `shows to ${name} and you`
    const canOpen = !row.user_id || mine
    const threads = input.threads.filter((t) => t.watch_id === row.id)
    const labels = cleanLabels(row.labels).map((l) => labelOf(l, row.labels_state?.[l], threads, row, { words, canOpen }, input))
    const counted = labels.filter((l): l is Extract<StationLabel, { kind: 'facts' }> => l.kind === 'facts')
    return {
      watchId: row.id,
      kind: row.user_id ? 'person' : 'shared',
      mine,
      title,
      who,
      readWords: row.last_ok_at ? `read ${agoWords(row.last_ok_at, input.nowIso)}` : 'not read yet',
      problem: row.last_error?.trim() || null,
      labels,
      open: counted.reduce((n, l) => n + l.shown, 0),
      past: counted.reduce((n, l) => n + l.facts.past.length, 0),
      canOpen,
    }
  })

  const counted = seen.filter((r) => r.last_ok_at)
  const mode: EmailStationModel['mode'] = input.on && counted.length > 0 ? 'live' : 'byHand'
  const byHandWhy = mode === 'live' ? null : !input.on ? BY_HAND_OFF : seen.length === 0 ? BY_HAND_NONE : BY_HAND_NOT_YET
  const freshest = counted.map((r) => r.last_ok_at!).sort().pop() ?? null

  const facts = boxes.flatMap((b) => b.labels.filter((l): l is Extract<StationLabel, { kind: 'facts' }> => l.kind === 'facts').map((l) => l.facts))
  const totals = sinceTotals(facts)
  const since = input.sinceIso ? { ...totals, words: `Since the last look, ${lineWhen(input.sinceIso, input.nowIso).replace(' · ', ' at ')}` } : null

  // What is counted and who sees it.
  const titles = boxes.map((b) => (b.mine ? 'your mail' : b.title))
  const stance: string[] = []
  if (titles.length) stance.push(`Counts ${join(titles)}.`)
  stance.push(STANCE_WORDS)
  if (boxes.some((b) => b.mine)) stance.push(lead && input.leadId !== input.viewerId ? `Your rows show to you and ${lead}.` : 'Your rows show to you alone.')
  if (boxes.some((b) => b.kind === 'person' && !b.mine)) stance.push('As the lead, you see each person’s rows. Nobody else on the station does.')
  stance.push(STANCE_GMAIL)

  const noteBoxes: NoteBox[] = boxes.map((b) => ({
    words: b.kind === 'shared' ? b.title : b.mine ? (input.viewerId ? (input.names[input.viewerId] ?? 'Mine') : 'Mine') : b.title.replace(/'s mail$/, ''),
    labels: b.labels.flatMap((l) => (l.kind === 'facts' ? [l.facts] : l.kind === 'missing' ? [{ label: l.label, missing: true as const }] : [])),
  }))

  return {
    mode,
    byHandWhy,
    boxes,
    open: boxes.reduce((n, b) => n + b.open, 0),
    past: boxes.reduce((n, b) => n + b.past, 0),
    limitDays: input.limitDays,
    readWords: freshest ? `read ${agoWords(freshest, input.nowIso)}` : null,
    since,
    stance,
    note: mode === 'live' ? composeLookNote(noteBoxes, input.sinceIso, input.word) : '',
  }
}
