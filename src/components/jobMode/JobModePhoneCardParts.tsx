/**
 * The pieces the Job Mode card is drawn from under the new phone layout (`lib/phoneLayout/jobCard.ts`): the
 * first row's presses, the full-width rows and My spend. They look like the job window's phone rows
 * (`JobWindowPhoneSections.tsx`, a 44 px row with its name, its count and a mark at the end), so the card and the
 * window a press on it opens read as one thing. Each only draws: what a press opens is the card's own, as it was.
 */
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTallyUnlinkedCounts } from '../../hooks/useTallyUnlinkedCounts'
import { TOP_ROW_ARIA, TOP_ROW_WORDS, topRowBadge } from '../../lib/jobMode/topRow'
import { ORANGE_UNDER_WORDS, WORDS_ON_ORANGE } from '../../lib/orangeUnderWords'
import { JOB_CARD_ROW_PX } from '../../lib/phoneLayout/jobCard'
import { CARD_PRESS, recordCardPress } from './jobModePhoneCardLook'

const rowBox: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }
const rowPress: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  minHeight: JOB_CARD_ROW_PX,
  padding: '0.45rem 0.75rem',
  border: 'none',
  borderRadius: 10,
  background: 'none',
  color: 'var(--text-strong)',
  fontFamily: 'inherit',
  fontSize: '0.9375rem',
  fontWeight: 700,
  textAlign: 'left',
  cursor: 'pointer',
  boxSizing: 'border-box',
}
const rowCount: CSSProperties = { marginLeft: 'auto', flex: 'none', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8125rem', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
const rowNote: CSSProperties = { display: 'block', marginTop: 2, fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)', lineHeight: 1.3 }

type CardRowProps = {
  /** The row's name. */
  title: string
  /** The count at the end of the row, or other short words. Nothing when there is none. */
  count?: ReactNode
  /** A quiet line under the name. */
  note?: ReactNode
  onPress: () => void
  ariaLabel?: string
  tip?: string
  testId?: string
  /** Marks the row for the tests and the press record: which door it is. */
  row: string
}

/** One full-width row of the card: its name, its count and a mark at the end. 44 px or more. */
export function CardRow({ title, count, note, onPress, ariaLabel, tip, testId, row }: CardRowProps) {
  return (
    <div style={rowBox} data-job-card-row={row}>
      <button type="button" onClick={onPress} aria-label={ariaLabel} title={tip} data-testid={testId} style={rowPress}>
        <span style={{ minWidth: 0 }}>
          {title}
          {note ? <span style={rowNote}>{note}</span> : null}
        </span>
        {count != null && count !== '' ? <span style={rowCount}>{count}</span> : null}
        <span aria-hidden style={{ marginLeft: count != null && count !== '' ? 0 : 'auto', flex: 'none', color: 'var(--text-faint)' }}>
          ›
        </span>
      </button>
    </div>
  )
}

type CardFoldProps = {
  title: string
  count?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
  row: string
  testId?: string
}

/**
 * A row that opens in place: the same row, and its content under it while open. The content stays mounted while
 * shut, so words half typed in it are still there when it opens again.
 */
export function CardFold({ title, count, open, onToggle, children, row, testId }: CardFoldProps) {
  return (
    <div style={rowBox} data-job-card-row={row} data-open={open ? '' : undefined}>
      <button type="button" onClick={onToggle} aria-expanded={open} data-testid={testId} style={rowPress}>
        <span style={{ minWidth: 0 }}>{title}</span>
        {count != null && count !== '' ? <span style={rowCount}>{count}</span> : null}
        <span aria-hidden style={{ marginLeft: count != null && count !== '' ? 0 : 'auto', flex: 'none', color: 'var(--text-faint)', transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}>
          ›
        </span>
      </button>
      <div style={open ? { padding: '0 0.6rem 0.6rem' } : { display: 'none' }}>{children}</div>
    </div>
  )
}

const spendBadge: CSSProperties = { minWidth: 18, height: 18, padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, background: ORANGE_UNDER_WORDS, color: WORDS_ON_ORANGE, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1, boxSizing: 'border-box', flex: 'none' }

/**
 * My spend as a press of the card: the square's own link, its own count of charges to put on a job and its own
 * name for a screen reader (`topRow.ts`), in the shape of the presses beside it.
 */
export function MySpendPress({ userId, role }: { userId: string | null | undefined; role: string | null }) {
  const { unlinked: spendCount } = useTallyUnlinkedCounts(Boolean(userId) && role != null)
  const badge = topRowBadge(spendCount)
  return (
    <Link to="/tally?tab=transactions" data-job-card-press="spend" aria-label={TOP_ROW_ARIA.spend(spendCount)} style={CARD_PRESS} onClick={() => recordCardPress(userId, role, 'spend')}>
      <span>{TOP_ROW_WORDS.spend}</span>
      {badge ? (
        <span aria-hidden style={spendBadge}>
          {badge}
        </span>
      ) : null}
    </Link>
  )
}
