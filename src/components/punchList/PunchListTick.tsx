import { canTick, tickLabel } from '../../lib/todos/punchListTicks'
import type { BoardItem } from '../../lib/todos/todoBoard'

/**
 * The "I am working on this" checkbox beside a punch list card (Taunya's ask of 2026-11-21). The box
 * is the browser's own, 20 px, inside a label 44 px square, so a thumb lands on it. Its name for a
 * screen reader carries the card's number. A card with no number yet takes no tick and draws none.
 *
 * The state is the page's (`usePunchListTicks`): the person's own rows, shown only while the card is
 * still in the section it was ticked in.
 */
export function PunchListTick({
  item,
  ticked,
  onToggle,
  className,
}: {
  item: Pick<BoardItem, 'number' | 'name' | 'group'>
  ticked: boolean
  onToggle: (item: Pick<BoardItem, 'number' | 'group'>, next: boolean) => void | Promise<void>
  className?: string
}) {
  if (!canTick(item)) return null
  const name = tickLabel(item)
  return (
    <label
      className={className}
      data-testid="punch-tick"
      data-number={item.number}
      title={ticked ? 'You are working on this. Untick it when you stop.' : 'Tick it when you are working on this. Only you see it.'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 44,
        minHeight: 44,
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={ticked}
        aria-label={name}
        onChange={(e) => void onToggle(item, e.currentTarget.checked)}
        style={{ width: 20, height: 20, margin: 0, cursor: 'pointer', accentColor: '#2563eb' }}
      />
    </label>
  )
}
