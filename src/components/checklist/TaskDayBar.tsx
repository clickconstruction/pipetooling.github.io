import { phoneTall } from '../../lib/phonePressFloor'

export type TaskDayTab = 'today' | 'history'

type Props = {
  tab: TaskDayTab
  onPick: (tab: TaskDayTab) => void
}

const SEGMENTS: ReadonlyArray<[TaskDayTab, string]> = [
  ['today', 'Today'],
  ['history', 'History'],
]

/**
 * Task Mode's two tabs as one joined bar (punch list #369): the shape the New task window gives *When*, lit the same
 * way. Task Mode shows only Today and History, so the tab strip and the page's title make way for this one row.
 * 38 px at a desk and a thumb's 44 on a phone (the phone walk of 2026-11-21).
 */
export function TaskDayBar({ tab, onPick }: Props) {
  return (
    <div role="group" aria-label="Checklist view" data-task-day-bar style={{ display: 'flex', flex: '1 1 200px', maxWidth: 320, border: '1px solid var(--border-strong)', borderRadius: 10, overflow: 'hidden', minWidth: 0 }}>
      {SEGMENTS.map(([key, label], i) => {
        const on = tab === key
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(key)}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              font: 'inherit',
              fontSize: 13,
              minHeight: phoneTall(38),
              padding: '0 12px',
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid var(--border)',
              borderRadius: on ? (i === 0 ? '9px 0 0 9px' : '0 9px 9px 0') : 0,
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
