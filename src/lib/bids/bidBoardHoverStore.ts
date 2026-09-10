/**
 * Row-hover store for the Bid Board map (v2.3251).
 *
 * Hovering a bid row pulses its pin on the "Bids on a map" card. The board tab
 * renders hundreds of rows; keeping the hovered id in React state there would
 * re-render every row on each mouse move. Instead the rows write into this
 * tiny external store and only the map card subscribes (`useSyncExternalStore`),
 * so a hover re-renders the card and nothing else.
 */
export type BidBoardHoverStore = {
  get: () => string | null
  set: (id: string | null) => void
  subscribe: (listener: () => void) => () => void
}

export function createBidBoardHoverStore(): BidBoardHoverStore {
  let current: string | null = null
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set: (id) => {
      if (id === current) return
      current = id
      for (const l of listeners) l()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
