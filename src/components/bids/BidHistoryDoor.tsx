import { useState } from 'react'
import { createPortal } from 'react-dom'
import { BidHistoryWindow } from './BidHistoryWindow'

/**
 * The door to a bid's history (punch list #73, PR 2): a small History button beside the bid's
 * title on every workflow tab. Opens the read-only window; nothing loads until it is pressed.
 * The window goes to the page's body, as the mark cards beside it do: inside the title's
 * heading it would take the heading's type, and a click inside it would reach the heading's
 * hosts.
 */
export function BidHistoryDoor({ bid }: { bid: { id: string; label: string; bidNumber: string | null } }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="What changed on this bid, who changed it, and when"
        style={{ marginLeft: '0.35rem', padding: '0.1rem 0.5rem', minHeight: 28, border: '1px solid var(--border-strong)', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', verticalAlign: 'middle' }}
      >
        History
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              <BidHistoryWindow bid={bid} onClose={() => setOpen(false)} />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
