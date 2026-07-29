/**
 * Close-time autosave flush orchestration for JobFormModal.
 *
 * The billing autosave debounces ~1.2s, so "edit a line item, click away"
 * used to silently drop the pending change (the unmount cleanup cancels the
 * timer). Closing must instead: wait out any in-flight autosave write, then
 * save-and-recheck until the slice is clean — or report failure so the modal
 * can stay open and let the user choose Retry / Close without saving.
 *
 * Pure orchestration over injected callbacks so the wait/recheck/outcome
 * logic is unit-testable; the component supplies the real autosave engine.
 */

export type CloseFlushOutcome =
  /** Nothing was dirty — close immediately. */
  | 'clean'
  /** One or more saves ran and everything persisted. */
  | 'saved'
  /** A save failed — do NOT close silently. */
  | 'failed'

export interface CloseFlushDeps {
  /** True while an autosave write is in flight. */
  isRunning: () => boolean
  /** True when the slice state differs from the last persisted baseline. */
  isDirty: () => boolean
  /** Run one save pass; resolves true on success, false on failure. */
  runSave: () => Promise<boolean>
  /** Injectable for tests; defaults to a real setTimeout sleep. */
  sleep?: (ms: number) => Promise<void>
  /** In-flight poll interval; defaults to 100ms. */
  pollMs?: number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Flush a dirty autosave slice so the modal can close without losing edits.
 * Callers should wrap this in `withOperationTimeout` — a frozen DB never
 * settles the fetch, and the close guard must not trap the user forever.
 */
export async function flushDirtySliceForClose(deps: CloseFlushDeps): Promise<CloseFlushOutcome> {
  const sleep = deps.sleep ?? defaultSleep
  const pollMs = deps.pollMs ?? 100
  let didSave = false
  // Wait for any in-flight write; it may persist the current state (clean),
  // or its finally-block may kick a queued follow-up run (still running).
  while (deps.isRunning()) await sleep(pollMs)
  while (deps.isDirty()) {
    const ok = await deps.runSave()
    if (!ok) return 'failed'
    didSave = true
    while (deps.isRunning()) await sleep(pollMs)
  }
  return didSave ? 'saved' : 'clean'
}
