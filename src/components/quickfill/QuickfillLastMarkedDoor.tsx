import type { CSSProperties } from 'react'

/**
 * The words that say when a station was last looked at, as a door to its Mark history
 * (punch list #156, v2.5826): *Last marked: Oct 23, 9:54 AM* in a station's header and on
 * its Focus fold, *last look 22h ago · Dana* on the round and the Roller. The press opens the
 * same window as the chart icon and *📈 history*, which stay. Without `onOpen` the words stay
 * plain text, for the stations that keep no history (Schedule, Tomorrow's Schedule).
 */
export function QuickfillLastMarkedDoor({
  text,
  stationLabel,
  onOpen,
  title,
  style,
}: {
  text: string
  /** The station's name, for the press's accessible name. */
  stationLabel: string
  onOpen?: (() => void) | null
  /** The plain words' hover, when there is no door. */
  title?: string
  style?: CSSProperties
}) {
  if (!onOpen) {
    return (
      <span style={style} title={title}>
        {text}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Open the mark history for ${stationLabel}`}
      aria-label={`${text}. Open the mark history for ${stationLabel}`}
      data-testid="quickfill-last-marked-door"
      style={{
        ...style,
        // The global button rule draws a box; this one is words on a line.
        background: 'none',
        border: 'none',
        borderRadius: 0,
        padding: 0,
        margin: 0,
        font: 'inherit',
        fontSize: style?.fontSize ?? 'inherit',
        color: style?.color ?? 'var(--text-link)',
        textAlign: 'left',
        cursor: 'pointer',
        textDecorationLine: 'underline',
        textDecorationStyle: 'dotted',
        textUnderlineOffset: 3,
      }}
    >
      {text}
    </button>
  )
}
