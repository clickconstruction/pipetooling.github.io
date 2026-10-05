import { useSyncExternalStore } from 'react'
import { gcStoreDispatch, gcStoreState, gcStoreSubscribe, type GcAction, type GcState } from '../../lib/gcMode/gcModel'

/** The GC page's state: the session's one copy, shared with the dashboard's Needs you (gcStore.ts). */
export function useGcStore(): [GcState, (action: GcAction) => void] {
  const state = useSyncExternalStore(gcStoreSubscribe, gcStoreState, gcStoreState)
  return [state, gcStoreDispatch]
}
