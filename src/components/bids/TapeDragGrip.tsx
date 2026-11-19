/**
 * Bids → Pricing: the grip that drags a line of the bid onto the Pricing Tape. The Workbench
 * draws one on each grid row and each Kind breakdown line while the calculator is unfolded. The
 * drag carries the line's numbers (`lib/bids/tapeDrag.ts`); the calculator asks which one.
 *
 * A grip is for a mouse. The same row is made from the keyboard, and on a phone, with
 * **＋ Percent row**.
 */
import { TAPE_DRAG_TYPE, serializeTapeLine, type TapeDragLine } from '../../lib/bids/tapeDrag'

export function TapeDragGrip({ line }: { line: TapeDragLine }) {
  return (
    <span
      draggable
      data-tape-grip={line.label}
      title={`Drag ${line.label} onto the calculator`}
      aria-label={`Drag ${line.label} onto the calculator`}
      role="img"
      onDragStart={(e) => {
        e.dataTransfer.setData(TAPE_DRAG_TYPE, serializeTapeLine(line))
        e.dataTransfer.setData('text/plain', line.label)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      // A grip is not a brush stroke and not a row press.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 22, marginRight: 4, cursor: 'grab', color: 'var(--text-muted)', verticalAlign: 'middle' }}
    >
      <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
        <g fill="currentColor">
          <circle cx="2" cy="3" r="1.4" />
          <circle cx="8" cy="3" r="1.4" />
          <circle cx="2" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="2" cy="13" r="1.4" />
          <circle cx="8" cy="13" r="1.4" />
        </g>
      </svg>
    </span>
  )
}
