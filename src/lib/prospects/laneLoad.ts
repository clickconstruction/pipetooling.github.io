/**
 * The deck's lane on a cold load (v2.5578, punch list #113 spot 1). The page used to start every
 * load as the customer deck and read `?kind=` only afterwards, so two loads raced and whichever
 * answered last painted the deck: a refresh of Jobs to GC could show the Customers deck under the
 * lane's tab with the lane's last press. Three rules close it: the kind is read from the link
 * before the first load, only the newest load's answer counts, and a card is drawn only when it
 * is the lane's kind.
 */
import { PROSPECT_KIND_WORDS, kindFromUrlKey, type ProspectKind } from './prospectKinds'

/** The lane a link names: the `?tab=subs` / `?tab=gc-leads` doors first, then `?kind=`, else the customer deck. */
export function kindFromSearch(search: string): ProspectKind {
  const params = new URLSearchParams(search)
  const tab = params.get('tab')
  if (tab === 'subs') return 'sub'
  if (tab === 'gc-leads') return 'gc_lead'
  return kindFromUrlKey(params.get('kind'))
}

/** True when the card is the lane's own kind; the deck draws nothing else. */
export function cardOnLane(card: { kind: ProspectKind } | null | undefined, kind: ProspectKind): boolean {
  return !!card && card.kind === kind
}

/** What the deck says while the lane's own load has not answered yet. */
export function laneLoadingWords(kind: ProspectKind): string {
  return `Loading ${PROSPECT_KIND_WORDS[kind].tab}…`
}

/**
 * Only the newest load's answer counts: `start()` numbers a load, `isLatest(n)` says whether that
 * load's answer may still touch the screen. A load that lost the race returns without painting.
 */
export function makeLatestOnly(): { start: () => number; isLatest: (n: number) => boolean } {
  let seq = 0
  return {
    start: () => ++seq,
    isLatest: (n) => n === seq,
  }
}
