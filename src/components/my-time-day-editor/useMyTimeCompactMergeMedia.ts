import { useSyncExternalStore } from 'react'

/** Aligns with `.myTimeDaySegmentOptionBRow` in `index.css` (`max-width: 520px`). */
export const MY_TIME_COMPACT_MERGE_MAX_PX = 520

const QUERY = `(max-width: ${MY_TIME_COMPACT_MERGE_MAX_PX}px)`

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot(): boolean {
  return false
}

/** True when viewport is narrow enough to show compact merge (single button + modal). */
export function useMyTimeCompactMergeMedia(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Aligns with `.myTimeDayClusterFormGrid` single-column breakpoint in `index.css` (`max-width: 560px`). */
export const MY_TIME_FORM_STACK_MAX_PX = 560

const FORM_STACK_QUERY = `(max-width: ${MY_TIME_FORM_STACK_MAX_PX}px)`

function subscribeFormStack(onChange: () => void): () => void {
  const mq = window.matchMedia(FORM_STACK_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function getSnapshotFormStack(): boolean {
  return window.matchMedia(FORM_STACK_QUERY).matches
}

/** True when Form layout stacks segment rows (time/actions line, job below). */
export function useMyTimeFormStackMedia(): boolean {
  return useSyncExternalStore(subscribeFormStack, getSnapshotFormStack, getServerSnapshot)
}
