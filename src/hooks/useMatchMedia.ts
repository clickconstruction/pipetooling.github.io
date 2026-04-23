import { useSyncExternalStore } from 'react'

/**
 * Subscribes to `window.matchMedia(query)`. Server / SSR snapshot is `false`.
 */
export function useMatchMedia(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onStoreChange)
      return () => mql.removeEventListener('change', onStoreChange)
    },
    () => (typeof window === 'undefined' ? false : window.matchMedia(query).matches),
    () => false,
  )
}
