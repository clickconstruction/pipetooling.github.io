/**
 * Which line's budget panel is open (v2.6300, punch list #234): one at a time,
 * as a row under the line on ① Line Items, with the entry it opened on so the
 * panel's Back to has something to go back to. The budgets themselves live on
 * the line item rows; this holds only the open state, in one module-level
 * snapshot read through `useSyncExternalStore` so the quiet line and the panel
 * agree without a provider.
 */
import { useCallback, useSyncExternalStore } from 'react'
import type { LineBudgetEntry } from '../lib/jobs/lineBudgets'

type Snapshot = { openId: string | null; base: LineBudgetEntry | null }

let snapshot: Snapshot = { openId: null, base: null }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}
const getSnapshot = () => snapshot

export function openLineBudget(id: string | null, base: LineBudgetEntry | null): void {
  snapshot = { openId: id, base }
  emit()
}

export function useLineBudgets() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const open = useCallback(openLineBudget, [])
  return { openId: snap.openId, base: snap.base, open }
}
