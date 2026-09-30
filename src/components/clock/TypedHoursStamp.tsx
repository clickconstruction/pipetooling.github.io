/**
 * The mark an approver reads on hours someone typed (docs/recent-features/v2.4242.md): a pencil,
 * who typed them, and what the day read before and after. No pencil means a real punch. It sits
 * beside QuickAddChip wherever sessions are listed for approval, at the size the row has room for:
 * `full` (a chip and the day's before → after), `compact` (a chip; the rest in its title) or `dot`.
 */
import type { CSSProperties } from 'react'
import {
  addedEntry,
  dayChangeWords,
  holdWords,
  secondLookWords,
  trimmedEntry,
  typedByWords,
  type ApprovalHold,
  type TypedStamp,
} from '../../lib/clock/typedHours'

const chipBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0 0.45rem',
  borderRadius: 999,
  fontSize: '0.6875rem',
  fontWeight: 600,
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
// Blue: on the hours surfaces green is approved, amber pending, red rejected, violet a quick add.
const typedChip: CSSProperties = {
  ...chipBase,
  background: 'var(--bg-blue-tint)',
  color: 'var(--text-blue-800)',
  border: '1px solid var(--border-blue)',
}
const quietChip: CSSProperties = {
  ...chipBase,
  background: 'var(--bg-subtle)',
  color: 'var(--text-muted)',
  border: '1px solid var(--border-strong)',
}

export const TYPED_PENCIL = '✎'

type Props = {
  stamp: TypedStamp | null | undefined
  size: 'full' | 'compact' | 'dot'
  /** The session's work date: lets a person's own entry say how late it was typed. */
  workDate?: string | null
  style?: CSSProperties
}

export function TypedHoursStamp({ stamp, size, workDate, style }: Props) {
  const added = addedEntry(stamp)
  if (added) {
    const sentence = typedByWords(added, workDate)
    const change = dayChangeWords(added)
    const looked = secondLookWords(added)
    const title = `${sentence}. The day: ${change.was} → ${change.now}.${looked ? ` ${looked[0]?.toUpperCase()}${looked.slice(1)}.` : ' Not punched on the clock.'}`
    if (size === 'dot') {
      return (
        <span data-testid="typed-hours-stamp" title={title} aria-label={title} style={{ color: 'var(--text-blue-700)', fontWeight: 700, ...style }}>
          {TYPED_PENCIL}
        </span>
      )
    }
    if (size === 'compact') {
      return (
        <span data-testid="typed-hours-stamp" title={title} style={{ ...typedChip, ...style }}>
          <span aria-hidden="true">{TYPED_PENCIL}</span>
          {added.typedByName}
        </span>
      )
    }
    return (
      <span data-testid="typed-hours-stamp" style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', minWidth: 0, ...style }}>
        <span title={title} style={typedChip}>
          <span aria-hidden="true">{TYPED_PENCIL}</span>
          {sentence}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {change.was} → <strong style={{ color: 'var(--text-700)' }}>{change.now}</strong>
          {looked ? ` · ${looked}` : ''}
        </span>
      </span>
    )
  }

  // A trim holds nothing and is common (a forgotten clock-out cut back): only the full row says it.
  const trimmed = size === 'full' ? trimmedEntry(stamp) : null
  if (!trimmed) return null
  const change = dayChangeWords(trimmed)
  return (
    <span data-testid="typed-hours-trim" style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', minWidth: 0, ...style }}>
      <span style={quietChip}>{typedByWords(trimmed, workDate)}</span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {change.was} → {change.now}
      </span>
    </span>
  )
}

/** In place of an Approve button the viewer may not press: why, in a sentence. */
export function TypedHoldNote({ hold, style }: { hold: ApprovalHold; style?: CSSProperties }) {
  return (
    <span data-testid="typed-hours-hold" style={{ ...quietChip, whiteSpace: 'normal', borderRadius: 6, padding: '0.1rem 0.45rem', lineHeight: 1.35, ...style }}>
      {holdWords(hold)}
    </span>
  )
}
