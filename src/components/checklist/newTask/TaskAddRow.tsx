import type { TaskAddKey, TaskAddPress } from '../../../lib/tasks/newTaskWindow'

type Props = {
  /** From `taskAddRow`. */
  presses: readonly TaskAddPress[]
  /** The press whose panel is open under the row, or null. */
  openKey: TaskAddKey | null
  onPress: (press: TaskAddPress) => void
}

/**
 * The Add row of the New task window (punch list #331): the rare things, each by name. Seven tasks
 * in ten use none of them, so they wait here as quiet presses instead of standing open. A press
 * opens that one thing under the row, or flips in place. A thing that is set is lit and shows its
 * value, so the row doubles as the list of what this task carries.
 */
export function TaskAddRow({ presses, openKey, onPress }: Props) {
  return (
    <div role="group" aria-label="Add" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
      {presses.map((press) => {
        const lit = press.on || openKey === press.key
        return (
          <button
            key={press.key}
            type="button"
            data-add-press={press.key}
            {...(press.toggle ? { 'aria-pressed': press.on } : { 'aria-expanded': openKey === press.key })}
            onClick={() => onPress(press)}
            style={{
              font: 'inherit',
              fontSize: 12.5,
              fontWeight: press.on ? 700 : 400,
              minHeight: 32,
              padding: '4px 11px',
              borderRadius: 999,
              border: lit ? '1px solid #2563eb' : '1px solid transparent',
              background: lit ? 'var(--bg-blue-tint)' : 'var(--bg-muted)',
              color: lit ? 'var(--text-blue-800)' : 'var(--text-700)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {press.label}
          </button>
        )
      })}
    </div>
  )
}
