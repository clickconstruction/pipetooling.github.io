/**
 * The read behind `siteLabor.ts` (v2.6407): one crew read per job of the site (a crew row holds a
 * day's assignments as JSON, so the match is containment, as the Job window's own read does), six
 * at a time; then one read of the recorded hours for those people on those days, chunked by day,
 * and one pay-config read for those people. Never one round per person or per day. Runs under the
 * reader's own policies: a role that may not read wages gets hours with $0 labor, as everywhere.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchLaborPayConfigMap, hoursFrom, resolveRecordedHoursTable } from '../../utils/teamLabor'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { allocateSiteLabor, type SiteCrewRow, type SiteHoursRow, type SiteLabor } from './siteLabor'

const CREW_READS_AT_ONCE = 6

export async function fetchSiteLabor(supabase: SupabaseClient, jobIds: ReadonlyArray<string>): Promise<SiteLabor> {
  const ids = [...new Set(jobIds)]
  const crewRows: SiteCrewRow[] = []
  for (let i = 0; i < ids.length; i += CREW_READS_AT_ONCE) {
    const group = ids.slice(i, i + CREW_READS_AT_ONCE)
    const results = await Promise.all(
      group.map((id) =>
        supabase
          .from('people_crew_jobs')
          .select('work_date, person_name, person_id, job_assignments, crew_lead_person_name')
          .contains('job_assignments', JSON.stringify([{ job_id: id }]))
          .limit(5000),
      ),
    )
    for (const r of results) {
      if (r.error) throw r.error
      crewRows.push(...((r.data ?? []) as unknown as SiteCrewRow[]))
    }
  }
  if (crewRows.length === 0) return { byJobId: new Map(), siteDays: 0, people: 0 }
  const persons = [...new Set(crewRows.map((r) => r.person_name))]
  const dates = [...new Set(crewRows.map((r) => r.work_date))].sort()
  const table = await resolveRecordedHoursTable(supabase)
  const personIds = [...new Set(crewRows.map((r) => r.person_id).filter((id): id is string => !!id))]
  const [hoursRows, config, userIdByPersonId] = await Promise.all([
    fetchAllRowsChunkedIn<SiteHoursRow, string>(
      dates,
      (chunk, from, to) => hoursFrom(supabase, table).select('person_name, person_id, work_date, hours').in('person_name', persons).in('work_date', chunk).range(from, to) as unknown as PromiseLike<{ data: SiteHoursRow[] | null; error: { message: string } | null }>,
      'site labor hours',
      { chunkSize: 120, parallel: 3 },
    ),
    fetchLaborPayConfigMap(supabase, persons),
    readUserIdsOfPeople(supabase, personIds),
  ])
  return allocateSiteLabor({ jobIds: ids, crewRows, hoursRows, config, userIdByPersonId })
}

/** The logins of the roster people (`people.account_user_id`), for the gold row; an unread or refused read is an empty map. */
async function readUserIdsOfPeople(supabase: SupabaseClient, personIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (personIds.length === 0) return out
  try {
    const rows = await fetchAllRowsChunkedIn<{ id: string; account_user_id: string | null }, string>(
      personIds,
      (chunk, from, to) => supabase.from('people').select('id, account_user_id').in('id', chunk).range(from, to) as unknown as PromiseLike<{ data: { id: string; account_user_id: string | null }[] | null; error: { message: string } | null }>,
      'site labor people',
      { chunkSize: 150, parallel: 2 },
    )
    for (const r of rows) if (r.account_user_id) out.set(r.id, r.account_user_id)
  } catch {
    /* the board stands without the gold row's ids; the name match still finds the viewer */
  }
  return out
}
