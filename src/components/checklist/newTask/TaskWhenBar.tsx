import type { WhenBarChoice } from '../../../lib/tasks/newTaskWindow'

type Props = {
  choice: WhenBarChoice
  /** The third segment's words, from `whenBarDayLabel`: *Pick a day*, or the day once it is lit. */
  dayLabel: string
  onPick: (choice: WhenBarChoice) => void
}

/**
 * The When row of the New task window (punch list #331): one joined bar of four. Most tasks are
 * for today, so Today is lit when the window opens and the bar is the whole row. A date box or
 * the weekdays open under it only when *Pick a day* or *Repeats* is pressed; the window owns those.
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
              font: 'inherit',
              fontSize: 13,
              minHeight: 38,
              padding: '0 5px',
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid var(--border)',
              borderRadius: on ? (i === 0 ? '9px 0 0 9px' : i === segments.length - 1 ? '0 9px 9px 0' : 0) : 0,
              background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
              color: on ? 'var(--text-blue-800)' : 'var(--text-strong)',
              fontWeight: on ? 700 : 400,
              boxShadow: on ? 'inset 0 0 0 1.5px #2563eb' : 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
