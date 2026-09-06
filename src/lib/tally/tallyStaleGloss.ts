/**
 * The Needs You card's number, said on the `/tally` page it opens (v2.2896,
 * journey-map Tier-2 #16 / J33-F7). The card says "100 purchases need a job"
 * (rows over the age floor); the page says "105 unlinked" (every row). Both are
 * honest — they count different piles — so the page carries the card's gloss
 * beside its own figure: "105 unlinked · 100 over 2 days old".
 *
 * `staleUnlinked` is the same RPC value the card's figure is built from
 * (`useTallyUnlinkedCounts`), so the two numbers agree by construction.
 */
export function tallyStaleGloss(staleUnlinked: number | null, minAgeDays: number): string | null {
  if (staleUnlinked == null || !Number.isFinite(staleUnlinked)) return null
  const days = Math.max(0, Math.floor(minAgeDays))
  const dayWord = days === 1 ? 'day' : 'days'
  if (staleUnlinked <= 0) return `none over ${days} ${dayWord} old`
  return `${staleUnlinked} over ${days} ${dayWord} old`
}
