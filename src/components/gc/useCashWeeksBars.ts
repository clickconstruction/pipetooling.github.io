/**
 * GC mode design spike: how The next 6 weeks reads the work not on the books yet (G-140): **As the
 * schedule stands**, the default since the owner's yes of 2026-10-06, or **As reported so far**, the
 * way back. One choice per browser, the lien timeline's pattern (`useLienTimelineView`): a module
 * store synced to localStorage. Storage that cannot be read falls back to the schedule; it is a
 * convenience, never state anyone else relies on.
 */
import { useSyncExternalStore } from 'react'
import type { CashBars } from '../../lib/gcMode/gcCashForecast'

const STORAGE_KEY = 'gcCashWeeksBars'
const DEFAULT_BARS: CashBars = 'schedule'

function readStored(): CashBars {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'reported' ? 'reported' : DEFAULT_BARS
  } catch {
    return DEFAULT_BARS
  }
}

let current: CashBars = typeof window === 'undefined' ? DEFAULT_BARS : readStored()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setCashWeeksBars(bars: CashBars) {
  current = bars
  try {
    window.localStorage.setItem(STORAGE_KEY, bars)
  } catch {
    // Storage that refuses the write only loses the memory, not this session's choice.
  }
  for (const l of listeners) l()
}

export function useCashWeeksBars(): CashBars {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULT_BARS)
}
