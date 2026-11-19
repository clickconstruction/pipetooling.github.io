/**
 * GC difficulty rating (punch list #357, PR 2): the chip beside a GC's name — *Rated 4 points* — on the Bid Board's
 * GC/Builder cell and the Workbench's title line, with the sentences behind the points in its title and a press that
 * opens the rating on the GC's record. A GC with no rating shows *Rate them* for the people who may rate, a quiet link
 * to the same card. Read only: the rating is made on the GC's record, or on the master's sheet where `onRate` opens it.
 */
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { GC_DIFFICULTY_WORDS, gcDifficultyCardHref, gcDifficultyChipTitle, gcDifficultyChipWords, type GcDifficultyStanding } from '../../lib/bids/gcDifficultyRating'

const CHIP: CSSProperties = { display: 'inline-block', fontSize: '0.7rem', fontWeight: 600, padding: '0.08rem 0.5rem', borderRadius: 999, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)', textDecoration: 'none', whiteSpace: 'nowrap', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' }
const RATE: CSSProperties = { fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none', whiteSpace: 'nowrap' }

const PRESS: CSSProperties = { fontFamily: 'inherit', cursor: 'pointer' }

/**
 * `onRate` (PR 5): on the Bid Board the chip and *Rate them* open the master's sheet for that bid instead of leaving
 * for the GC's record, which the sheet offers as a door.
 */
export default function GcDifficultyChip({ standing, customerId, canRate = false, onRate }: { standing: GcDifficultyStanding | null | undefined; customerId: string | null | undefined; canRate?: boolean; onRate?: () => void }) {
  const press = onRate
    ? (e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        onRate()
      }
    : null
  if (standing) {
    if (press) {
      return (
        <button type="button" style={{ ...CHIP, ...PRESS }} title={gcDifficultyChipTitle(standing)} data-testid="gc-difficulty-chip" onClick={press}>
          {gcDifficultyChipWords(standing)}
        </button>
      )
    }
    return (
      <Link to={gcDifficultyCardHref(standing.customerId)} style={CHIP} title={gcDifficultyChipTitle(standing)} data-testid="gc-difficulty-chip" onClick={(e) => e.stopPropagation()}>
        {gcDifficultyChipWords(standing)}
      </Link>
    )
  }
  if (canRate && customerId) {
    if (press) {
      return (
        <button type="button" style={{ ...RATE, ...PRESS, background: 'none', border: 'none', padding: 0 }} data-testid="gc-difficulty-rate-them" onClick={press}>
          {GC_DIFFICULTY_WORDS.rateThem}
        </button>
      )
    }
    return (
      <Link to={gcDifficultyCardHref(customerId)} style={RATE} data-testid="gc-difficulty-rate-them" onClick={(e) => e.stopPropagation()}>
        {GC_DIFFICULTY_WORDS.rateThem}
      </Link>
    )
  }
  return null
}
