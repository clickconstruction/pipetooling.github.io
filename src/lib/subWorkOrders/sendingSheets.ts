/**
 * The page's sub sheets as the sending planner reads them (`subSending.ts`): whose each one is by the Pay view's
 * rule, what it still owes and the day it is dated. One place, so the window and the ledger agree on whose a sheet is.
 */
import type { LaborJob } from '../../types/laborJob'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { sheetLabel } from '../jobs/subPaymentMoveRemove'
import { subLaborJobBalance, type SubLaborSheetAssignee } from '../subLaborOutstanding'
import type { NeedsWorkOrderRosterPerson } from './rosterSub'
import { buildSheetPartiesLookup, sheetParties } from './sheetParties'
import type { SendingSheet } from './subSending'

export function sendingSheetsFrom(
  laborJobs: readonly LaborJob[],
  assigneesByJobId: ReadonlyMap<string, readonly SubLaborSheetAssignee[]>,
  namesByJobId: Record<string, string>,
  roster: readonly NeedsWorkOrderRosterPerson[],
): SendingSheet[] {
  const lookup = buildSheetPartiesLookup(roster)
  return laborJobs.map((job) => {
    const parties = sheetParties(job, assigneesByJobId.get(job.id), lookup)
    return {
      id: job.id,
      // A crew sheet pays through payroll: it shares a sending with nobody and holds no credit.
      key: parties.crew ? '' : parties.key,
      label: sheetLabel(job, namesByJobId),
      remaining: Math.round(subLaborJobBalance(job).balance * 100) / 100,
      day: (job.job_date ?? '').slice(0, 10) || (job.created_at ? calendarYmdInAppTzFromIso(job.created_at) : ''),
    }
  })
}
