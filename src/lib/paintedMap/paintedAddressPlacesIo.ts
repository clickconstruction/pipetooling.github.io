/**
 * Places kept at this address (punch list #413, step 4): the reads. The rules are
 * `paintedAddressPlaces.ts`'s. The database decides who may read what: `job_address_place_lists`
 * answers only for a job the caller may touch, and each list it names is read under the caller's
 * own row security.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { addressListsOf, type AddressList } from './paintedAddressPlaces'
import { loadPaintedMapsFor, type Landed } from './paintedMapIo'

type ListRow = { map_id: string; job_id: string; created_at: string }

/**
 * The lists of places kept by other jobs at this job's customer address, the oldest first. Empty
 * for a job with no customer address and for a job no earlier job shares one with.
 */
export async function loadAddressPlaceLists(jobId: string): Promise<Landed<AddressList[]>> {
  try {
    const res = (await supabase.rpc('job_address_place_lists' as never, { p_job_id: jobId } as never)) as unknown as { data: ListRow[] | null; error: unknown }
    if (res.error) return { ok: false, error: formatErrorMessage(res.error, 'The places kept at this address did not load.') }
    const jobIds = [...new Set((res.data ?? []).map((r) => r.job_id).filter(Boolean))]
    if (jobIds.length === 0) return { ok: true, value: [] }
    const maps = await loadPaintedMapsFor({ jobIds })
    if (!maps.ok) return maps
    // The job that kept a list is named when this reader may read that job. A helper may not, and the line then says the month.
    const labels = new Map<string, string>()
    try {
      const jobs = await supabase.from('jobs_ledger').select('id, hcp_number, job_name').in('id', jobIds)
      for (const j of (jobs.data ?? []) as Array<{ id: string; hcp_number: string | null; job_name: string | null }>) {
        const label = [j.hcp_number, j.job_name].filter(Boolean).join(' ').trim()
        if (label) labels.set(j.id, label)
      }
    } catch {
      // No names: the month alone.
    }
    return { ok: true, value: addressListsOf(maps.value, jobId, labels) }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'The places kept at this address did not load.') }
  }
}

/**
 * A person opened a place. The database counts it when they can read the place and did not set
 * it. Nothing waits on the answer, and a count that was not taken is never an error to show.
 */
export function notePaintedPlaceOpened(placeId: string): void {
  try {
    void (supabase.rpc('note_painted_place_opened' as never, { p_place_id: placeId } as never) as unknown as Promise<unknown>).then(
      () => undefined,
      () => undefined,
    )
  } catch {
    // Not counted.
  }
}
