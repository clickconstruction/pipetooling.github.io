import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { doorsToDraw, type DoorId } from '../../lib/bridge/doors'

/**
 * The doors under the Bridge's first screen (v2.6840, punch list #303, PR 2): The flow, Money,
 * People, and the count of soft numbers when something is soft. A press opens that part of the
 * page under the row, and a press on the open door closes it. The page keeps which is open in
 * the address.
 */

export const BRIDGE_DOOR_PANEL_ID = 'bridge-door-panel'

export function BridgeDoors({ door, softCount, onDoor }: { door: DoorId | null; softCount: number; onDoor: (id: DoorId) => void }) {
  const narrow = useIsNarrowScreen()
  const doors = doorsToDraw(softCount)
  return (
    <nav id="bridge-doors" aria-label="Behind the first screen" data-testid="bridge-doors" style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(3, minmax(0, 1fr))' : `repeat(${doors.length}, minmax(0, 1fr))`, gap: narrow ? 8 : 12, margin: narrow ? '8px 0' : '12px 0', scrollMarginTop: 'calc(var(--app-top-chrome, 0px) + 0.5rem)' }}>
      {doors.map((d) => {
        const open = door === d.id
        const soft = d.id === 'soft'
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onDoor(d.id)}
            aria-expanded={open}
            aria-controls={BRIDGE_DOOR_PANEL_ID}
            data-testid={`bridge-door-${d.id}`}
            style={{
              gridColumn: soft && narrow ? '1 / -1' : undefined,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              textAlign: 'left',
              font: 'inherit',
              minHeight: soft && narrow ? 40 : 46,
              padding: open ? 'calc(0.4rem - 1px) calc(0.65rem - 1px)' : '0.4rem 0.65rem',
              borderRadius: 10,
              border: open ? '2px solid #2563eb' : soft ? '1px dashed var(--border-amber)' : '1px solid var(--border)',
              background: soft ? 'var(--bg-amber-tint)' : 'var(--surface)',
              color: soft ? 'var(--text-amber-800)' : 'var(--text-strong)',
              fontSize: soft && narrow ? '0.8rem' : '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>
              {d.name} <span aria-hidden>{open ? '▴' : '▾'}</span>
            </span>
            {!(soft && narrow) && <span style={{ fontSize: '0.68rem', fontWeight: 500, color: soft ? 'inherit' : 'var(--text-muted)', lineHeight: 1.25 }}>{narrow ? d.holdsShort : d.holds}</span>}
          </button>
        )
      })}
    </nav>
  )
}
