/**
 * Bills sent: the looks its two views share (punch list #422, PR 3). The list by day sent
 * (`BillsSentLedger.tsx`) and the month by day paid (`BillsPaidByDay.tsx`) are one page behind one switch, so a
 * tile, a chip and a bill's name look the same in both.
 */
import type { CSSProperties } from 'react'
import { PHONE_PRESS_MIN_HEIGHT } from '../../lib/phonePress'

/** A press a thumb can hit: the least height a phone's own controls take, from the app's one source for it. */
export const THUMB = PHONE_PRESS_MIN_HEIGHT

/** A tile. `flex` is read only where the row wraps (`tileRow`, an odd count on a phone): it grows from the width three of them fit a phone at. */
export const tile: CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: '0.4rem 0.6rem', minWidth: 0, flex: '1 1 5.2rem' }
export const tileSmall: CSSProperties = { display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)' }
export const strong: CSSProperties = { color: 'var(--text-strong)', fontWeight: 700 }
export const money: CSSProperties = { ...strong, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }
export const jobLink: CSSProperties = { color: 'var(--text-green-700)', fontWeight: 600, textDecoration: 'none' }
/** A bill's name as a press: the underline alone marks it, in the words' own colour. */
export const billLink: CSSProperties = { ...strong, textDecoration: 'underline', textUnderlineOffset: 2 }
export const phoneButton: CSSProperties = { font: 'inherit', fontSize: '0.875rem', fontWeight: 700, minHeight: THUMB, padding: '0 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }

/**
 * The row of tiles over either view. A desk fits as many to a row as have room. On a phone an even count sits two
 * to a row, so no tile is left alone. An odd count wraps three to a row and the last row's tiles grow to fill it:
 * five tiles once sat three and two in a three-column grid, with a hole where the sixth would be (the live test
 * of 2026-11-24). Tiles of one row are one height. Two rows may still differ.
 */
export function tileRow(phone: boolean, count: number): CSSProperties {
  if (!phone) return { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '0.4rem' }
  if (count % 2 === 0) return { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem' }
  return { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }
}

/** A desk takes nothing: one frozen object, so a caller's spread is a no-op there. */
const DESK: CSSProperties = Object.freeze({})

/**
 * A name or a word that is a press and has no box of its own: a bill's name and a job's name in a sentence, *Show
 * all*, *Show them*. On a phone it stands a fingertip tall, its words in the middle, and the line grows with it.
 * The live test of 2026-11-24 measured the names in By day paid's day box at 16 px.
 */
export function linePress(phone: boolean): CSSProperties {
  return phone ? { display: 'inline-flex', alignItems: 'center', minHeight: THUMB } : DESK
}

/** A chip of either view. On a phone it is a fingertip tall (it was 38 px) and keeps to one line in a row that slides. */
export function chipStyle(pressed: boolean, phone = false): CSSProperties {
  return {
    ...(phone ? { minHeight: THUMB, flex: '0 0 auto', whiteSpace: 'nowrap' as const } : {}),
    font: 'inherit',
    padding: '0.2rem 0.7rem',
    fontSize: '0.8125rem',
    borderRadius: 999,
    cursor: 'pointer',
    fontWeight: pressed ? 700 : 500,
    border: `1px solid ${pressed ? 'var(--text-strong)' : 'var(--border-strong)'}`,
    background: pressed ? 'var(--text-strong)' : 'var(--surface)',
    color: pressed ? 'var(--surface)' : 'var(--text-700)',
  }
}
