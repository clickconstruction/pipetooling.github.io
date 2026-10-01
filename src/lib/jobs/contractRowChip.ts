/**
 * What the Pipeline row's contract chip says (v2.4342, owner-approved canvas
 * https://claude.ai/artifact/5rRgZYuTBpSEznrEpXsvnw, board *Pass 3*). Since
 * v2.4324 the chip is the row's one contract door; this makes it tell time.
 *
 * Before billing, a job with nothing on file asks in amber only when a crew is
 * coming or working: *Contract by Sat Oct 3 · 2d* (the first booked day is the
 * deadline) or *No contract · crew on site*. With no date, or no price yet (a
 * contract needs the amount), it stays the grey *No contract*. A GC job with
 * nothing on file reads *No subcontract on file* in every unpaid stage and
 * opens Add the contract on that GC's jobs, because one builder's paper covers
 * the jobs it names. Sent, signed and Not needed keep their words. Billed and
 * Collections keep the grey *No contract*. Paid in Full draws no chip.
 *
 * Pure: the coverage comes from `buildJobContractCoverage`, the schedule from
 * the row's own feeds (`stagesUpcomingByJobId`, `stagesWorkedByJobId`).
 */
import { daysBetweenYmd } from './billedExpectedPay'
import { jobContractChipLabel, jobContractChipTitle, jobContractChipTone, type JobContractChipTone, type JobContractCoverage } from './jobContractCoverage'
import { formatStagesNextDateLabel } from '../stagesUpcomingSchedule'

/** `ask` draws amber like `sent`: the one tone that means "this needs doing". */
export type ContractRowChipTone = JobContractChipTone | 'ask'

export type ContractRowChip =
  | { show: false }
  | {
      show: true
      label: string
      title: string
      tone: ContractRowChipTone
      /** `contract`: the Contract window. `gc-paper`: Add the contract, listing the GC's jobs. */
      opens: 'contract' | 'gc-paper'
      /** The phone row's chip words, on an `ask` only (the phone chip is for asks): *contract by Sat Oct 3*. */
      phoneLabel?: string
    }

export type ContractRowChipInput = {
  coverage: JobContractCoverage | null | undefined
  /** `jobs_ledger.status`: waiting · working · ready_to_bill · billed · paid. */
  status: string | null | undefined
  revenue: number | string | null | undefined
  /** The GC's customer id when the job has a GC who is not its own customer. */
  gcCustomerId: string | null | undefined
  customerId: string | null | undefined
  gcName: string | null | undefined
  /** The next booked day from today on (`stagesUpcomingByJobId[id].ymd`); null when nothing is booked. */
  nextBookedYmd: string | null | undefined
  /** Any sign the crew has already been: an approved clock day, a clock-in or a past booked day this week, or a % done. */
  workStarted: boolean
  /** Someone clocked in on the job this week. */
  workedThisWeek: boolean
  todayYmd: string
}

const BEFORE_BILLING = new Set(['waiting', 'working', 'ready_to_bill'])

/** "today" · "1d" · "4d", the Pipeline's day words (v2.4315). */
function daysAhead(days: number): string {
  return days <= 0 ? 'today' : `${days}d`
}

/** A job billed to a GC who is not its own customer: our paper is the GC's subcontract. */
export function contractRowIsGcJob(input: Pick<ContractRowChipInput, 'gcCustomerId' | 'customerId'>): boolean {
  const gc = (input.gcCustomerId ?? '').trim()
  return gc !== '' && gc !== (input.customerId ?? '').trim()
}

export function contractRowChip(input: ContractRowChipInput): ContractRowChip {
  const status = (input.status ?? '').trim()
  if (status === 'paid') return { show: false }
  const cov = input.coverage ?? null
  const kind = cov?.kind ?? 'none'
  const kept = (opens: 'contract' | 'gc-paper' = 'contract'): ContractRowChip => ({
    show: true,
    label: jobContractChipLabel(cov),
    title: jobContractChipTitle(cov),
    tone: jobContractChipTone(cov),
    opens,
  })

  if (kind !== 'none' && kind !== 'draft') return kept()

  const gcName = (input.gcName ?? '').trim()
  if (kind === 'none' && contractRowIsGcJob(input)) {
    return {
      show: true,
      label: 'No subcontract on file',
      title: `Nothing from ${gcName || 'the GC'} is on file for this job. File their signed subcontract once and tick every job it names.`,
      tone: 'none',
      opens: 'gc-paper',
    }
  }

  if (!BEFORE_BILLING.has(status)) return kept()

  const draft = kind === 'draft'
  const revenue = Number(input.revenue ?? 0)
  if (!Number.isFinite(revenue) || revenue <= 0) {
    return {
      show: true,
      label: jobContractChipLabel(cov),
      title: `${draft ? 'A contract draft is saved but not sent.' : 'No signed agreement is on file.'} Price the job first, since a contract names the amount.`,
      tone: jobContractChipTone(cov),
      opens: 'contract',
    }
  }

  const next = (input.nextBookedYmd ?? '').trim() || null
  const sentence = draft ? 'A contract draft is saved but not sent.' : 'Nothing is signed or sent.'
  if (input.workStarted && (next != null || input.workedThisWeek)) {
    return {
      show: true,
      label: 'No contract · crew on site',
      title: `The crew is working this job. ${sentence} Send the contract or file a signed copy.`,
      tone: 'ask',
      opens: 'contract',
      phoneLabel: 'no contract · crew on site',
    }
  }
  if (next != null && !input.workStarted) {
    const days = daysBetweenYmd(input.todayYmd, next) ?? 0
    const day = formatStagesNextDateLabel(next)
    return {
      show: true,
      label: `Contract by ${day} · ${daysAhead(days)}`,
      title: `The crew is booked for ${day}. ${sentence} Get it signed before they start.`,
      tone: 'ask',
      opens: 'contract',
      phoneLabel: `contract by ${day}`,
    }
  }
  return kept()
}

/** The row fields the chip reads (a `JobWithDetails` fits). */
export type ContractRowJob = {
  status?: string | null
  revenue?: number | string | null
  gc_customer_id?: string | null
  customer_id?: string | null
  gcCustomer?: { name?: string | null } | null
  last_work_date?: string | null
  pct_complete?: number | null
}

/**
 * The chip for one job from the board's own feeds — the desktop row, the
 * phone card and the phone row all call this, so they agree.
 */
export function contractRowChipForJob(
  job: ContractRowJob,
  feeds: {
    coverage: JobContractCoverage | null | undefined
    /** `stagesUpcomingByJobId[job.id]`. */
    upcoming: { ymd: string } | null | undefined
    /** `stagesWorkedByJobId[job.id]`: this week's clock-ins and the booked days before today. */
    weekSoFar: { worked: ReadonlyArray<unknown>; bookedYmds: ReadonlyArray<string> } | null | undefined
    todayYmd: string
  },
): ContractRowChip {
  const workedThisWeek = (feeds.weekSoFar?.worked.length ?? 0) > 0
  const workStarted =
    Boolean((job.last_work_date ?? '').trim()) ||
    workedThisWeek ||
    (feeds.weekSoFar?.bookedYmds.length ?? 0) > 0 ||
    (job.pct_complete ?? 0) > 0
  return contractRowChip({
    coverage: feeds.coverage,
    status: job.status,
    revenue: job.revenue,
    gcCustomerId: job.gc_customer_id,
    customerId: job.customer_id,
    gcName: job.gcCustomer?.name ?? null,
    nextBookedYmd: feeds.upcoming?.ymd ?? null,
    workStarted,
    workedThisWeek,
    todayYmd: feeds.todayYmd,
  })
}
