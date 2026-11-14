import type { WhenBarChoice } from '../../../lib/tasks/newTaskWindow'

type Props = {
  choice: WhenBarChoice
  /** The third segment's words, from `whenBarDayLabel`: *Pick a day*, or the day once it is lit. */
  dayLabel: string
  onPick: (choice: WhenBarChoice) => void
}

/** 13 px at 361 px of screen and wider, 12 px at 333 and narrower. */
export const WHEN_BAR_FONT = 'clamp(12px, 3.6vw, 13px)'
/** 5 px beside each word at 360 px of screen and wider, 2 px at 324 and narrower. */
export const WHEN_BAR_PAD = 'clamp(2px, calc((100vw - 300px) / 12), 5px)'

/**
 * The When row of the New task window (punch list #331): one joined bar of four. Most tasks are
 * for today, so Today is lit when the window opens and the bar is the whole row. A date box or
 * the weekdays open under it only when *Pick a day* or *Repeats* is pressed; the window owns those.
 *
 * On a narrow screen, or with Safari's text at 125% (322 px wide), the four words did not fit and *Repeats* was
 * cut at the bar's edge (punch list #348). The words and the room beside them now tighten with the screen, from
 * 13 px and 5 px down to 12 px and 2 px, and a segment that still cannot fit shortens with … and is not cut off.
 */
export function TaskWhenBar({ choice, dayLabel, onPick }: Props) {
  const segments: Array<[WhenBarChoice, string]> = [
    ['today', 'Today'],
    ['tomorrow', 'Tomorrow'],
    ['day', dayLabel],
    ['repeat', 'Repeats'],
  ]
  return (
    <div role="group" aria-label="When" style={{ display: 'flex', border: '1px solid var(--border-strong)', borderRadius: 10, overflow: 'hidden', minWidth: 0 }}>
      {segments.map(([key, label], i) => {
        const on = choice === key
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(key)}
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              font: 'inherit',
              fontSize: WHEN_BAR_FONT,
              minHeight: 38,
              padding: `0 ${WHEN_BAR_PAD}`,
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid var(--border)',
              borderRadius: on ? (i === 0 ? '9px 0 0 9px' : i === segments.length - 1 ? '0 9px 9px 0' : 0) : 0,
              background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
              color: on ? 'var(--text-blue-800)' : 'var(--text-strong)',
              fontWeight: on ? 700 : 400,
              boxShadow: on ? 'inset 0 0 0 1.5px #2563eb' : 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
