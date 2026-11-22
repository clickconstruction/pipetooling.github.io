/**
 * The page's sheets as the papers read them (punch list #350): `LaborJob` rows in, `PaperSheet` rows out, with each
 * money line's day resolved the ledger's way (`paymentDay`), its method worded as the Pay view words it, and a memo
 * the office hid left blank. The papers' kernel (`_shared/subPapers.ts`) reads nothing else.
 *
 * `paperSheetsFor` picks one person's sheets by the rule every other sub screen uses (`sheetParties`, then
 * `sheetOwedTo`), so a paper is made for exactly the sheets that person's Balance due is made of.
 */
import type { PaperConfirm, PaperContext, PaperMoneyLine, PaperSheet } from '../../../supabase/functions/_shared/subPapers'
import type { LaborJob } from '../../types/laborJob'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { lineLaborCost } from '../peopleLaborJobItemLineCost'
import type { SubLaborSheetAssignee } from '../subLaborOutstanding'
import type { NeedsWorkOrderRosterPerson } from './rosterSub'
import { buildSheetPartiesLookup, sheetParties } from './sheetParties'
import { paymentDay } from './subPaymentsLedger'
import { subPayMethodWords, SUB_PAY_FROM_CREDIT } from './subPaymentWindow'
import { sheetOwedTo, TEAM_SHEET_RULE, type TeamSheetRule } from './teamSheetRule'

const cents = (n: number): number => Math.round(n * 100) / 100

/** What the register (`sub_papers`, PR 3) knows about a sheet's paper. Absent until the migration is pushed. */
export type PaperRegisterRow = { number: string; revision: number; replacesCopyOf?: string | null; confirm?: PaperConfirm | null }

export function paperSheetFrom(job: LaborJob, opts: { jobName: string; register?: PaperRegisterRow | null }): PaperSheet {
  const rate = job.labor_rate ?? 0
  const money: PaperMoneyLine[] = (job.payments ?? []).map((p) => {
    const day = paymentDay(p)
    const fromCredit = p.method === SUB_PAY_FROM_CREDIT
    return {
      id: p.id,
      amount: cents(Number(p.amount) || 0),
      ymd: day?.ymd ?? '',
      recorded: day ? day.recorded : false,
      at: p.created_at ?? '',
      how: fromCredit ? '' : subPayMethodWords(p),
      memo: p.hidden_from_sub ? '' : (p.memo ?? '').trim(),
      sendingId: p.sending_id ?? null,
      sendingNo: p.sending_no ?? null,
      fromCredit,
      creditKept: Math.max(0, cents(Number(p.credit_kept) || 0)),
      clientDirect: p.method === 'client_direct',
    }
  })
  return {
    id: job.id,
    number: opts.register?.number ?? '',
    revision: opts.register?.revision ?? 1,
    replacesCopyOf: opts.register?.replacesCopyOf ?? '',
    jobNumber: (job.job_number ?? '').trim(),
    jobName: opts.jobName.trim(),
    address: (job.address ?? '').trim(),
    // The day the work is dated, else the day the sheet was made: the ledger's rule, so the two agree on a period.
    day: (job.job_date ?? '').slice(0, 10) || (job.created_at ? calendarYmdInAppTzFromIso(job.created_at).slice(0, 10) : ''),
    // When the sheet was typed: a statement since the last one counts a sheet typed after it as new work.
    at: job.created_at ?? '',
    lines: (job.items ?? []).map((it) => ({ label: (it.fixture ?? '').trim() || 'A line', amount: cents(lineLaborCost(it, rate)) })),
    money,
    confirm: opts.register?.confirm ?? null,
  }
}

/** One person's sheets, by the rule the Pay view and People → Subs use, oldest first. `key` is `id:<people id>`. */
export function paperSheetsFor(
  key: string,
  laborJobs: readonly LaborJob[],
  assigneesByJobId: ReadonlyMap<string, readonly SubLaborSheetAssignee[]>,
  namesByJobId: Record<string, string>,
  roster: readonly NeedsWorkOrderRosterPerson[],
  opts: { rule?: TeamSheetRule; register?: ReadonlyMap<string, PaperRegisterRow> } = {},
): PaperSheet[] {
  const lookup = buildSheetPartiesLookup(roster)
  const rule = opts.rule ?? TEAM_SHEET_RULE
  return laborJobs
    .filter((job) => {
      const to = sheetOwedTo(sheetParties(job, assigneesByJobId.get(job.id), lookup), rule)
      return to.person != null && to.key === key
    })
    .map((job) => paperSheetFrom(job, { jobName: job.job_ledger_id ? (namesByJobId[job.job_ledger_id] ?? '') : '', register: opts.register?.get(job.id) ?? null }))
    .sort((a, b) => (a.day || '9999').localeCompare(b.day || '9999') || a.id.localeCompare(b.id))
}

// `paperPreparedAt` lives on the edge since v2.7569 (punch list #371): the sub's page reads it too.
export { paperPreparedAt } from '../../../supabase/functions/_shared/subPaperMarks'

export type { PaperContext }
