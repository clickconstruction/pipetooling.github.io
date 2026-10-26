import { supabase } from './supabase'
import { readOverheadPoolSnapshot, readOverheadPoolSnapshotInputs, type OverheadPoolSnapshot, type OverheadPoolSnapshotInputs } from './overheadPoolSnapshotReads'

/**
 * The ONE 90-day overhead scan (v2.2676): the Dashboard's Overhead card, People → Overhead, Review's rates and the
 * Bridge compute from one code path. The scan itself lives in `overheadPoolSnapshotReads.ts` with the client passed
 * in (v2.5880), so the Bridge's weekly sheet can run it as the service role on the edge; this file binds the app's
 * client for every reader in the app.
 */
export { buildOverheadWageLookups, type OverheadPoolSnapshot, type OverheadPoolSnapshotInputs, type OverheadWageLookup } from './overheadPoolSnapshotReads'

/** The three snapshot inputs the tab otherwise gets from its page: the office job id, pay-config wages, the users → people link map. */
export function loadOverheadPoolSnapshotInputs(): Promise<OverheadPoolSnapshotInputs> {
  return readOverheadPoolSnapshotInputs(supabase)
}

export function loadOverheadPoolSnapshot(inputs: OverheadPoolSnapshotInputs, opts: { isCancelled?: () => boolean } = {}): Promise<OverheadPoolSnapshot | null> {
  return readOverheadPoolSnapshot(supabase, inputs, opts)
}
