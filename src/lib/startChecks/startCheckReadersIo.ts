/**
 * Before we start (punch list #382, PR 8): the reads behind a bullet of ours that reads the app. Each goes the way its
 * own screen goes, under this person's own row security, so a bullet never shows a fact its reader could not open:
 * the order log as Bids → Submittals builds it (`buildProcurementLog` over the newest revision's rows, the rows that
 * stand approved on an earlier one, the records and each tag's stage), the site's trips as the Trips look reads them,
 * and the city's permits at the job's address as the bid form's site panel reads them (`startCheckPermitsIo.ts`,
 * fetched when asked for). A seat that cannot read a source is told so in words (`cannot`). The rules are
 * `startCheckReaders.ts`.
 */
import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { checkSupabaseError } from '../../utils/errorHandling'
import { isOfficeRole } from '../doorRoles'
import type { SubmittalPartRow } from '../submittals/itemParts'
import { buildProcurementLog, type ProcurementItemSource } from '../submittals/procurementLog'
import type { ProcurementItemLike } from '../submittals/procurementItemSources'
import { loadProcurementRecords, loadTagStagesForBid, procurementItemsFrom } from '../submittals/procurementLogIo'
import { revisionWasRead, rowsThatStand } from '../submittals/standingRows'
import { tripsOnJob } from '../trips/jobTrips'
import { readSiteTrips } from '../trips/tripsIo'
import { tripNameOfRecord, tripRecordSpan } from '../trips/tripsLook'
import type { JobReads, OrderLogRead, PermitsRead, TripsRead } from './startCheckReaders'

/** A job as the readers need it. */
export type ReaderJob = { id: string; bidId: string | null; address: string | null; developmentId: string | null }
/** Which jobs want which read, and who is asking. */
export type ReadsAsked = { jobs: readonly ReaderJob[]; orderLog: readonly string[]; trips: readonly string[]; permits: readonly string[]; role: string | null; todayYmd: string }
export type StartReadersIo = { read: (asked: ReadsAsked) => Promise<Map<string, JobReads>> }

type Rev = { id: string; rev_number: number; status: string }
type Item = ProcurementItemLike & { id: string; submittal_id: string; sequence_order: number; review_decision: string | null }
type Paged<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** One bid's order log, line by line. */
async function readOrderLog(bidId: string): Promise<OrderLogRead> {
  // A bid this seat cannot open hands back no row: the bullet says so, and reads nothing behind it.
  const bid = await supabase.from('bids').select('id').eq('id', bidId).maybeSingle()
  checkSupabaseError(bid, 'read the bid')
  if (!bid.data) return { state: 'cannot' }
  const revs = await supabase.from('bid_submittals').select('id, rev_number, status').eq('bid_id', bidId).order('rev_number', { ascending: false }).limit(200)
  checkSupabaseError(revs, 'read the submittals')
  const revisions = (revs.data ?? []) as Rev[]
  const newest = revisions[0] ?? null
  const records = await loadProcurementRecords(supabase, bidId)
  let sources: ProcurementItemSource[] = []
  if (newest) {
    const items = (
      await fetchAllRowsChunkedIn<Item, string>(revisions.map((r) => r.id), (chunk, from, to) => supabase.from('bid_submittal_items').select('*').in('submittal_id', chunk).order('id').range(from, to) as unknown as Paged<Item>, 'read the submittal rows')
    ).sort((a, b) => a.sequence_order - b.sequence_order || a.id.localeCompare(b.id))
    const parts = (
      await fetchAllRowsChunkedIn<SubmittalPartRow, string>(items.map((i) => i.id), (chunk, from, to) => supabase.from('bid_submittal_item_parts').select('*').in('item_id', chunk).order('id').range(from, to) as unknown as Paged<SubmittalPartRow>, 'read the submittal parts')
    ).sort((a, b) => a.sequence_order - b.sequence_order)
    const rowsOf = (revId: string) => items.filter((i) => i.submittal_id === revId)
    const partsOf = (ids: ReadonlySet<string>) => parts.filter((p) => ids.has(p.item_id))
    const rows = rowsOf(newest.id)
    sources = await procurementItemsFrom(supabase, rows, newest.status !== 'draft', partsOf(new Set(rows.map((r) => r.id))))
    const earlier = revisions.slice(1)
    if (earlier.length > 0) {
      const earlierRows = earlier.map((r) => rowsOf(r.id))
      const earlierIds = new Set(earlierRows.flat().map((r) => r.id))
      // Approved whole, or part by part, as the Procure step reads it.
      const approvedParts = new Set(parts.filter((p) => earlierIds.has(p.item_id) && p.on_submittal && (p as { review_decision?: string | null }).review_decision === 'approved').map((p) => p.item_id))
      const stands = rowsThatStand(
        [{ rev: newest.rev_number, rows }, ...earlier.map((r, i) => ({ rev: r.rev_number, rows: earlierRows[i] ?? [], asked: revisionWasRead(r.status) }))],
        (it) => it.review_decision === 'approved' || approvedParts.has(it.id),
      )
      if (stands.length > 0) sources = [...sources, ...(await procurementItemsFrom(supabase, stands.map((s) => s.row), true, partsOf(new Set(stands.map((s) => s.row.id)))))]
    }
  }
  const tagStage = await loadTagStagesForBid(supabase, bidId, [...new Set(sources.map((s) => s.tag))])
  const log = buildProcurementLog({ items: sources, records, tagStage, stageDates: {} })
  return { state: 'read', bidId, lines: log.map((r) => ({ stage: r.stage, orderedOn: r.orderedOn, expectedOn: r.expectedOn, deliveredOn: r.deliveredOn })) }
}

/** The roles that read every trip, as the table's own policy has it. Anyone else reads the trips they are on. */
const TRIP_ROLES: ReadonlySet<string> = new Set(['dev', 'master_technician', 'assistant', 'controller', 'primary'])

async function readTrips(jobs: readonly ReaderJob[], role: string | null, todayYmd: string): Promise<Map<string, TripsRead>> {
  const out = new Map<string, TripsRead>()
  const bySite = new Map<string, ReaderJob[]>()
  for (const j of jobs) {
    if (!j.developmentId) out.set(j.id, { state: 'no_site' })
    else bySite.set(j.developmentId, [...(bySite.get(j.developmentId) ?? []), j])
  }
  for (const [developmentId, onSite] of bySite) {
    const records = await readSiteTrips(developmentId, onSite.map((j) => j.id))
    for (const j of onSite) {
      const mine = tripsOnJob(records, j.id)
      // A seat outside the office reads only the trips it is on: none found is not none planned.
      if (mine.length === 0 && !TRIP_ROLES.has(role ?? '')) out.set(j.id, { state: 'cannot' })
      else out.set(j.id, { state: 'read', developmentId, trips: mine.map((t) => ({ id: t.id, name: tripNameOfRecord(t, todayYmd).number ?? 'The trip', first: tripRecordSpan(t)?.first ?? null, last: tripRecordSpan(t)?.last ?? null, people: t.people.map((p) => p.name).filter(Boolean) })) })
    }
  }
  return out
}

/**
 * The permit read is the only one whose rules the rest of the app loads on demand (the city list, the feeds, the
 * names), so it is fetched when a bullet asks for it, by a seat that may read permits. A static import here put
 * all of it in the first download (v2.8015); `startCheckReadersIo.test.ts` holds the line.
 */
async function readPermits(jobs: readonly ReaderJob[], role: string | null): Promise<Map<string, PermitsRead>> {
  if (!(isOfficeRole(role) || role === 'estimator')) return new Map<string, PermitsRead>(jobs.map((j) => [j.id, { state: 'cannot' }]))
  const { readPermitsOnSites } = await import('./startCheckPermitsIo')
  return readPermitsOnSites(jobs)
}

export const supabaseStartReadersIo: StartReadersIo = {
  read: async ({ jobs, orderLog, trips, permits, role, todayYmd }) => {
    const out = new Map<string, JobReads>()
    const put = (jobId: string, patch: JobReads) => out.set(jobId, { ...(out.get(jobId) ?? {}), ...patch })
    const jobOf = new Map(jobs.map((j) => [j.id, j]))
    const pick = (ids: readonly string[]) => ids.map((id) => jobOf.get(id)).filter((j): j is ReaderJob => !!j)
    // Each kind stands alone: one that fails says so on its own bullets, and the others still read.
    const guard = async (ids: readonly string[], run: () => Promise<void>) => {
      try {
        await run()
      } catch {
        for (const id of ids) put(id, { failed: true })
      }
    }
    await Promise.all([
      guard(orderLog, async () => {
        for (const j of pick(orderLog)) put(j.id, { orderLog: j.bidId ? await readOrderLog(j.bidId) : { state: 'no_bid' } })
      }),
      guard(trips, async () => {
        for (const [id, read] of await readTrips(pick(trips), role, todayYmd)) put(id, { trips: read })
      }),
      guard(permits, async () => {
        for (const [id, read] of await readPermits(pick(permits), role)) put(id, { permits: read })
      }),
    ])
    return out
  },
}
