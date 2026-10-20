/**
 * The deck's small words (v2.5581, punch list #113 spots 5 and 6): what an empty lane says, and
 * when the Due chip has a day to count. The empty state used to point at Prospect List, which adds
 * nothing, and the Due chip showed bare on a card never called, which the never-called chip
 * already says.
 */
import { PROSPECT_KIND_WORDS, type ProspectKind } from './prospectKinds'

const FIRST: Record<ProspectKind, string> = { customer: 'company', gc_lead: 'lead', sub: 'company' }

/** An empty lane: who is missing, and the one control that fixes it. */
export function emptyLaneWords(kind: ProspectKind, trade: string | null): { main: string; door: 'new_prospect' | 'all_subs'; doorLabel: string; tail: string } {
  if (kind === 'sub' && trade) {
    return { main: `No subs for ${trade}.`, door: 'all_subs', doorLabel: 'All subs', tail: 'widens the queue.' }
  }
  return { main: `Nobody on ${PROSPECT_KIND_WORDS[kind].tab} yet.`, door: 'new_prospect', doorLabel: 'New Prospect', tail: `adds the first ${FIRST[kind]}.` }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The Due chip: null while the prospect was never contacted (the never-called chip says it) and
 * for the first week after a touch; `Due N days` from seven days on.
 */
export function dueChipWords(lastContact: string | null, nowMs: number = Date.now()): string | null {
  if (!lastContact) return null
  const t = new Date(lastContact).getTime()
  if (!Number.isFinite(t)) return null
  const days = Math.floor((nowMs - t) / DAY_MS)
  return days >= 7 ? `Due ${days} days` : null
}

/** The card's clock ticks only while a card is on the screen; the day's clock is the sum of card clocks. */
export function cardClockTicks(opts: { onDeck: boolean; visible: boolean; hasCard: boolean }): boolean {
  return opts.onDeck && opts.visible && opts.hasCard
}
