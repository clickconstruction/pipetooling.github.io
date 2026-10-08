import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BidHistoryWindow } from './BidHistoryWindow'
import { BID_HISTORY_OPEN_EVENT, type BidHistoryOpenDetail } from './BidCellPast'
import { useBidHistoryCellsSwitch } from '../../hooks/useBidHistoryCells'

/**
 * The door to a bid's history (punch list #73): beside the bid's title on every workflow tab.
 * **History** opens the read-only window (PR 2); nothing loads until it is pressed. **Past values**
 * (PR 3) turns on each typed cell’s earlier values on every bid tab, remembered on this device; "+N more"
 * under a cell opens the window searched on that row. The window goes to the page's body, as the
 * mark cards beside it do: inside the title's heading it would take the heading's type, and a click
 * inside it would reach the heading's hosts.
 */
export function BidHistoryDoor({ bid }: { bid: { id: string; label: string; bidNumber: string | null } }) {
  const [open, setOpen] = useState<{ search: string } | null>(null)
  const [pastOn, setPastOn] = useBidHistoryCellsSwitch()
  useEffect(() => {
    const hear = (e: Event) => {
      const d = (e as CustomEvent<BidHistoryOpenDetail>).detail
      if (d?.bidId === bid.id) setOpen({ search: d.search })
    }
    window.addEventListener(BID_HISTORY_OPEN_EVENT, hear)
    return () => window.removeEventListener(BID_HISTORY_OPEN_EVENT, hear)
  }, [bid.id])
  const pill = { marginLeft: '0.35rem', padding: '0.1rem 0.5rem', minHeight: 28, borderRadius: 999, fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', verticalAlign: 'middle' } as const
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen({ search: '' })}
        title="What changed on this bid, who changed it, and when"
        style={{ ...pill, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }}
      >
        History
      </button>
      <button
        type="button"
        aria-pressed={pastOn}
        onClick={() => setPastOn(!pastOn)}
        title={pastOn ? 'Hide the earlier values under prices, counts, quantities and hours' : 'Show the earlier values under prices, counts, quantities and hours'}
        style={{ ...pill, border: pastOn ? '1px solid #3b82f6' : '1px solid var(--border-strong)', background: pastOn ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'var(--text-700)', fontWeight: pastOn ? 600 : 500 }}
      >
        Past values {pastOn ? 'on' : 'off'}
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              <BidHistoryWindow bid={bid} initialSearch={open.search} onClose={() => setOpen(null)} />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
