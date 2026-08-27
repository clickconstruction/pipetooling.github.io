import { useEffect, useRef, useState } from 'react'

/**
 * Land a cross-tab row jump (v2.2400): given a target DOM id, poll for the
 * element (the destination tab's data loads async after the switch), then
 * scroll it to center and flash it for ~2s — the Workbench jump-to-row /
 * Jobs → Pipeline idiom. Polling the DOM instead of each tab's data pipeline
 * keeps the hook agnostic to how a tab loads.
 *
 * `domId` null = nothing pending. `onHandled(found)` fires exactly once per
 * target: true after the scroll+flash starts, false when the element never
 * appeared (the caller toasts and clears its pending state either way).
 * Returns the DOM id currently flashing so rows can tint themselves.
 */
export function usePendingRowFlash(
  domId: string | null,
  onHandled: (found: boolean) => void,
  opts?: { timeoutMs?: number; flashMs?: number; pollMs?: number },
): string | null {
  const [flashDomId, setFlashDomId] = useState<string | null>(null)
  const onHandledRef = useRef(onHandled)
  onHandledRef.current = onHandled
  const timeoutMs = opts?.timeoutMs ?? 5000
  const flashMs = opts?.flashMs ?? 2000
  const pollMs = opts?.pollMs ?? 150

  useEffect(() => {
    if (!domId) return
    let cancelled = false
    const startedAt = Date.now()
    const tryFind = () => {
      if (cancelled) return
      const el = document.getElementById(domId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setFlashDomId(domId)
        window.setTimeout(() => setFlashDomId((cur) => (cur === domId ? null : cur)), flashMs)
        onHandledRef.current(true)
        return
      }
      if (Date.now() - startedAt >= timeoutMs) {
        onHandledRef.current(false)
        return
      }
      window.setTimeout(tryFind, pollMs)
    }
    // A beat for the tab's first render before the first look.
    const t = window.setTimeout(tryFind, 50)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domId])

  return flashDomId
}
