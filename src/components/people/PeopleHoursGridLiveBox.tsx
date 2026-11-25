import type { CSSProperties, MouseEvent } from 'react'
import type { HoursGridLiveCellView } from '../../lib/people/hoursGridLiveByCell'

/**
 * The Hours grid's box for a person still on the clock (punch list #446): a press, never a
 * field. Green, with the day so far and the words "on the clock" under it, so the mark does
 * not lean on colour alone; amber and "left open" for a session nobody clocked out of. A
 * press opens that person's My Time for the day. On a phone it fills the cell like every
 * other cell's tap target.
 */
export function PeopleHoursGridLiveBox({
  view,
  cellKey,
  narrow,
  besideBadge,
  onOpen,
}: {
  view: HoursGridLiveCellView
  /** `person|day`, so a test or the focus hand-back can find this box. */
  cellKey: string
  narrow: boolean
  /** The amber pending badge sits on the cell's top right corner: the lines move left of it. */
  besideBadge: boolean
  onOpen: (e: MouseEvent<HTMLButtonElement>) => void
}) {
  const leftOpen = view.tone === 'leftOpen'
  const ink = leftOpen ? 'var(--text-amber-800)' : 'var(--text-green-700)'
  const fill = leftOpen ? 'var(--bg-amber-tint)' : 'var(--bg-green-tint)'
  const box: CSSProperties = narrow
    ? {
        width: '100%',
        minHeight: 44,
        padding: '0.2rem 0.1rem',
        border: 'none',
        boxShadow: `inset 0 0 0 1px ${ink}`,
        alignItems: 'center',
        gap: 1,
      }
    : {
        width: 72,
        minHeight: 34,
        padding: '2px 4px 3px',
        border: `1px solid ${ink}`,
        alignItems: besideBadge ? 'flex-start' : 'flex-end',
        gap: 0,
      }
  return (
    <button
      type="button"
      data-hours-live-cell={cellKey}
      data-hours-live-tone={view.tone}
      aria-label={view.title}
      title={view.title}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(e)
      }}
      style={{
        ...box,
        display: 'inline-flex',
        flexDirection: 'column',
        justifyContent: 'center',
        borderRadius: 6,
        background: fill,
        color: ink,
        fontFamily: 'inherit',
        lineHeight: 1.15,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          fontSize: leftOpen ? '0.75rem' : '0.875rem',
          fontWeight: view.figureMuted ? 400 : 700,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          ...(view.figureMuted ? { color: 'var(--text-muted)' } : {}),
        }}
      >
        {view.figure}
      </span>
      <span style={{ fontSize: '0.62rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{view.word}</span>
    </button>
  )
}
