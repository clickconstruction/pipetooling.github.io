/**
 * Sort-view switcher for the no-bid-selected picker on the bid workflow tabs,
 * shown in the search row's unused width. All eight tabs share one choice: the
 * view lives in a module store synced to localStorage (per browser), so
 * switching it on Counts also reorders Takeoffs, and it survives reloads.
 * `BidPickerStandardList` reads the same store to do the actual sorting.
 */
import { useSyncExternalStore } from 'react'
import {
  BID_PICKER_SORT_VIEWS,
  DEFAULT_BID_PICKER_SORT_VIEW,
  normalizeBidPickerSortView,
  type BidPickerSortView,
} from '../../lib/bidPickerSort'

const STORAGE_KEY = 'bidPickerSortView'

function readStoredView(): BidPickerSortView {
  try {
    return normalizeBidPickerSortView(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_BID_PICKER_SORT_VIEW
  }
}

let currentView: BidPickerSortView = typeof window === 'undefined' ? DEFAULT_BID_PICKER_SORT_VIEW : readStoredView()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setBidPickerSortView(view: BidPickerSortView) {
  currentView = view
  try {
    window.localStorage.setItem(STORAGE_KEY, view)
  } catch {
    // Private-mode storage failures just lose persistence, not the session's choice.
  }
  for (const l of listeners) l()
}

export function useBidPickerSortView(): BidPickerSortView {
  return useSyncExternalStore(subscribe, () => currentView, () => DEFAULT_BID_PICKER_SORT_VIEW)
}

export function BidPickerSortToggle() {
  const active = useBidPickerSortView()
  return (
    <div
      role="group"
      aria-label="Sort bids by"
      style={{
        display: 'inline-flex',
        border: '1px solid var(--border-strong)',
        borderRadius: 4,
        overflow: 'hidden',
        background: 'var(--surface)',
        flex: 'none',
      }}
    >
      {BID_PICKER_SORT_VIEWS.map((v, i) => {
        const on = v.key === active
        return (
          <button
            key={v.key}
            type="button"
            aria-pressed={on}
            title={v.title}
            onClick={() => setBidPickerSortView(v.key)}
            style={{
              font: 'inherit',
              fontSize: '0.8125rem',
              fontWeight: on ? 600 : 400,
              padding: '0.5rem 0.7rem',
              whiteSpace: 'nowrap',
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid var(--border)',
              cursor: 'pointer',
              background: on ? '#2563eb' : 'var(--surface)',
              color: on ? '#fff' : 'var(--text-700)',
            }}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}
