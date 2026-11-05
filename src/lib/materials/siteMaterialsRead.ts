/**
 * The material location report's read (punch list #268): the ledger's three tables over a site's
 * job ids, read when the window opens and never with the Development page. Every read is chunked
 * over the ids and paged (`fetchAllRowsChunkedIn`, four chunks at a time): PostgREST cuts an
 * un-ranged answer at 1,000 rows without a word, and Gun Dog's 24 jobs are never 24 round trips.
 * The rows come back in the store's shapes, so the kernel and the screens read one thing. The
 * gate is the tables' own, `on_site_can_touch_job`: a job the reader may not touch returns no row.
 */
import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { CONTAINER_COLS, containerOf, MOVEMENT_COLS, movementOf, PLACE_COLS, placeOf, type ContainerRow, type MovementRow, type PlaceRow } from './onSiteStore'
import type { SiteMaterialsRows } from './siteMaterialsReport'

export type SiteMaterialsReader = (jobIds: ReadonlyArray<string>) => Promise<SiteMaterialsRows>

export const fetchSiteMaterials: SiteMaterialsReader = async (jobIds) => {
  const ids = [...new Set(jobIds)]
  if (ids.length === 0) return { places: [], containers: [], movements: [] }
  const paged = { parallel: 4 }
  const [places, containers, movements] = await Promise.all([
    fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('job_places').select(PLACE_COLS).in('job_id', chunk).order('id').range(from, to), 'site places', paged),
    fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('job_containers').select(CONTAINER_COLS).in('job_id', chunk).order('id').range(from, to), 'site containers', paged),
    fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('job_material_movements').select(MOVEMENT_COLS).in('job_id', chunk).order('id').range(from, to), 'site movements', paged),
  ])
  return {
    places: (places as unknown as PlaceRow[]).map(placeOf),
    containers: (containers as unknown as ContainerRow[]).map(containerOf),
    movements: (movements as unknown as MovementRow[]).map(movementOf),
  }
}
