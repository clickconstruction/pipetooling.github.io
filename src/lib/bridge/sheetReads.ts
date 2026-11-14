/**
 * The Monday sheet's reads (v2.5881): the page's loaders in the page's shape, with a client passed in, so the weekly
 * send (`bridge-weekly-sheet`) builds the sheet on Monday morning from the same reads the page makes. The Bridge
 * data must come back; every other read that fails leaves its slot null and its name in `gaps`, the way the page
 * shows a tile as not read, so one failed read never holds the mail. The bank is read by the caller (the page
 * through `loadMercuryCash`, the function through Mercury's API) and passed in.
 *
 * Since punch list #318 (PR 5) it also reads every bid and every estimate ever sent, as the page does for the Market
 * amount (`loadBidWins.ts`, `loadEstimateWins.ts`).
 *
 * It leaves out what the page leaves out. The list the owner sets on the page (`bridge_left_out_v1`, `leftOut.ts`)
 * is read first, through the page's own parser. The jobs it names join the ZZ test jobs in every read that takes
 * them, and the bids and the estimates sent take the rules themselves with the ZZ jobs alone, each as on the page.
 * No row is an empty list and nothing changes. A list that cannot be read leaves nothing out and is named in `gaps`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { loadDashboardFinancials } from '../dashboardFinancialsLoad'
import { loadBridgeData } from './loadBridgeData'
import { loadBridgeVectorInputs } from './loadBridgeVectors'
import { loadVectorDaysInputs } from './loadVectorDays'
import { loadBuildPaceInputs } from './loadBuildPace'
import { loadBillPileJobs } from './loadBillPile'
import { loadDemandInputs } from './loadDemandPace'
import { loadBidsSent } from './loadBidWins'
import { loadEstimatesSent } from './loadEstimateWins'
import { loadCollectDeskReads } from './collect/loadCollectDesk'
import { arRowInvoiceId } from './collect/collectBills'
import { vectorRangeFor } from './vectorDays'
import type { MercuryCash } from './mercuryCash'
import type { MondaySheetReads } from './sheetBuild'
import { withLeftOutJobIds, type LeftOutRule } from './leftOut'
import { loadLeftOutScope } from './leftOutIo'

export type MondaySheetReadOptions = {
  /** Cash on hand from the bank, read by the caller; null falls back to the typed figure. */
  bank: MercuryCash | null
  /** ZZ test jobs to leave out of the Bridge data, the people, the build pace, the Bill pile, the jobs the bids became and the financials; null keeps them. */
  zzTestJobIds: ReadonlySet<string> | null
  /** Whether the client may read the Payment Chase touches (a dev, or the service role). */
  canReadTouches: boolean
  /** Hears each read that failed, with its error, for a log; the sheet itself gets the plain word. */
  onProblem?: (what: string, error: unknown) => void
}

/** The mail's word for the list when it could not be read. */
export const LEFT_OUT_GAP = 'the list of what the Bridge leaves out'

/** What the bids and the estimates sent take: the ZZ test jobs alone, and the list's rules. */
type SentScope = { zzTestJobIds: ReadonlySet<string> | null; leftOut: ReadonlyArray<LeftOutRule> }

export async function loadMondaySheetReads(db: SupabaseClient<Database>, opts: MondaySheetReadOptions): Promise<MondaySheetReads> {
  const scope = await loadLeftOutScope(db)
  if (scope.error != null) opts.onProblem?.(LEFT_OUT_GAP, scope.error)
  const reads = await readMondaySheet(db, { ...opts, zzTestJobIds: withLeftOutJobIds(opts.zzTestJobIds, scope.jobIds) }, { zzTestJobIds: opts.zzTestJobIds, leftOut: scope.rules })
  if (scope.error != null) reads.gaps.unshift(LEFT_OUT_GAP)
  return { ...reads, leftOut: scope.rules }
}

/** The reads themselves. Here `opts.zzTestJobIds` is every job to leave out: the ZZ test jobs and the jobs the list names. */
async function readMondaySheet(db: SupabaseClient<Database>, opts: MondaySheetReadOptions, sent: SentScope): Promise<MondaySheetReads> {
  const gaps: string[] = []
  const soft = async <T>(what: string, read: () => Promise<T>): Promise<T | null> => {
    try {
      return await read()
    } catch (e) {
      gaps.push(what)
      opts.onProblem?.(what, e)
      return null
    }
  }
  const data = await loadBridgeData(db, { zzTestJobIds: opts.zzTestJobIds })
  const weeksRange = vectorRangeFor('weeks', data.todayYmd)
  const [fin, vectorInputs, weeksInputs, buildInputs, billJobs, demandInputs, bidsSent, estimatesSent] = await Promise.all([
    soft('the money owed and due', () => loadDashboardFinancials(db, { assistantAggregates: false, zzTestJobIds: opts.zzTestJobIds })),
    soft('the people', () => loadBridgeVectorInputs(db, data, { zzTestJobIds: opts.zzTestJobIds })),
    soft('the eight weeks', () => loadVectorDaysInputs(db, { start: weeksRange.start, end: weeksRange.end, todayYmd: data.todayYmd, officeJobLedgerId: data.officeJobLedgerId, zzTestJobIds: opts.zzTestJobIds })),
    soft('the build pace', () => loadBuildPaceInputs(db, { windowStart: data.windowStart, todayYmd: data.todayYmd, officeJobLedgerId: data.officeJobLedgerId, zzTestJobIds: opts.zzTestJobIds })),
    soft('the bill pile', () => loadBillPileJobs(db, { officeJobLedgerId: data.officeJobLedgerId, zzTestJobIds: opts.zzTestJobIds })),
    soft('the asks and the bids', () => loadDemandInputs(db, { windowStart: data.windowStart, todayYmd: data.todayYmd, zzTestJobIds: opts.zzTestJobIds })),
    soft('the bids sent', () => loadBidsSent(db, { zzTestJobIds: sent.zzTestJobIds, leftOut: sent.leftOut })),
    soft('the estimates sent', () => loadEstimatesSent(db, { leftOut: sent.leftOut, zzTestJobIds: sent.zzTestJobIds })),
  ])
  const items = fin ? [...fin.ar.items, ...fin.arCollections.items] : []
  const collectReads = fin
    ? await soft('the Collect desk', () =>
        loadCollectDeskReads(db, {
          jobIds: items.map((i) => i.jobId).filter((id): id is string => !!id),
          invoiceIds: items.map((i) => arRowInvoiceId(i.key)).filter((id): id is string => !!id),
          canReadTouches: opts.canReadTouches,
        }),
      )
    : null
  return { data, fin, bank: opts.bank, vectorInputs, weeksInputs, buildInputs, billJobs, demandInputs, collectReads, bidsSent, estimatesSent, gaps }
}
