/**
 * The job form's footer rules (§15 of the Job form map): what the autosave line says, and who
 * sees Delete. Pure, so the footer component only draws them.
 */

/** The footer's one-word autosave state, worst-first across the edit-mode slices (v2.1080). */
export type JobFormAutosaveAggregate = 'saving' | 'error' | 'blocked' | 'pending' | 'saved'

/** Where the guarded close is: idle, flushing the dirty slices, or stopped on a failed save. */
export type JobFormCloseFlushState = 'idle' | 'saving' | 'error'

/** The part of an autosave slice the footer reads. */
export interface JobFormAutosaveSliceState {
  status: string
  isDirty: () => boolean
}

/**
 * Worst-first: a write in flight, then a failed one, then the identity slice held back by a
 * missing required field, then anything unsaved. `isDirty` is only asked when nothing above it
 * answered.
 */
export function jobFormAutosaveAggregate(
  slices: readonly JobFormAutosaveSliceState[],
  identityBlocked: boolean,
): JobFormAutosaveAggregate {
  if (slices.some((s) => s.status === 'saving')) return 'saving'
  if (slices.some((s) => s.status === 'error')) return 'error'
  if (identityBlocked) return 'blocked'
  if (slices.some((s) => s.isDirty())) return 'pending'
  return 'saved'
}

/** The footer's autosave line. */
export function jobFormAutosaveStatusWords(aggregate: JobFormAutosaveAggregate): string {
  if (aggregate === 'saving') return 'Saving…'
  if (aggregate === 'error') return 'Autosave failed — edit the field again to retry'
  if (aggregate === 'blocked') return 'Waiting on required fields'
  if (aggregate === 'pending') return 'Unsaved changes…'
  return 'All changes saved'
}

/** Red on a failed save, green once everything is saved, muted in between. */
export function jobFormAutosaveStatusColor(aggregate: JobFormAutosaveAggregate): string {
  if (aggregate === 'error') return 'var(--text-red-600)'
  if (aggregate === 'saved') return 'var(--text-green-600)'
  return 'var(--text-muted)'
}

/**
 * Delete is an edit-mode door for every role but `primary`; in the Job window (embedded) it
 * lives on the Edit region only (owner call).
 */
export function jobFormFooterShowsDelete(params: {
  editing: boolean
  role: string | null | undefined
  embedded: boolean
  embeddedRegion: 'edit' | 'bill' | 'costs' | null
}): boolean {
  const { editing, role, embedded, embeddedRegion } = params
  return editing && role !== 'primary' && (!embedded || embeddedRegion === 'edit')
}
