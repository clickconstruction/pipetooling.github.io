import { useCallback, useEffect, useRef } from 'react'
import { isTopmostModal, registerModal, unregisterModal } from '../lib/modalStack'

/**
 * Register this component as an open modal for as long as `active` is true and
 * return `isTopmost()` for its Escape handler. A modal that isn't registered
 * (`active: false`, e.g. embedded inside a window that owns Escape) reports
 * topmost so callers keep their previous behaviour.
 */
export function useModalStackEntry(active = true): () => boolean {
  const idRef = useRef<number | null>(null)
  useEffect(() => {
    if (!active) return
    const id = registerModal()
    idRef.current = id
    return () => {
      unregisterModal(id)
      idRef.current = null
    }
  }, [active])
  return useCallback(() => (idRef.current == null ? true : isTopmostModal(idRef.current)), [])
}
