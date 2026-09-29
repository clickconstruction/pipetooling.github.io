// A job's card charges as the cost timeline's input rows (Job window and Job Summary) —
// the parts cost's rule (v2.2692: no Internal Transfers, a charge already on a supply-house
// invoice counted once, under the invoice), each at its signed cost so a refund comes off,
// fuel flagged for the ⛽ stream (punch list #52). So the timeline ends on the parts figure.
// Pure.

import { jobCardLineStatus, type JobMercuryAllocLine } from '../../../supabase/functions/_shared/jobMaterialsCostLines'
import { cardChargeCostUsd, type CardChargeExclusions } from './cardChargeAllocationFilter'
import type { JobChargeEventsInput } from '../jobChargesTimeline'
import type { JobSummaryMercuryAllocationRow } from '../../types/jobSummary'

type CardEventRow = JobChargeEventsInput['mercury'][number]

/** The Job window: the materials snapshot's card lines. */
export function cardEventRowsFromSnapshotLines(
  lines: readonly JobMercuryAllocLine[],
  args: { exclusions: CardChargeExclusions | undefined; fuelTxIds: ReadonlySet<string> | undefined; toYmd: (raw: string | null) => string | null },
): CardEventRow[] {
  return lines
    .filter((m) => jobCardLineStatus(m, args.exclusions) === 'counts')
    .map((m) => ({
      dateKey: args.toYmd(m.postedAt),
      amount: cardChargeCostUsd(m.allocationAmount),
      counterpartyName: m.counterpartyName,
      attributionDisplayName: null,
      fuel: m.mercuryTransactionId != null && args.fuelTxIds?.has(m.mercuryTransactionId) === true,
    }))
}

/** Job Summary: the per-job read's rows (Internal Transfers already dropped there). */
export function cardEventRowsFromJobSummaryRows(
  rows: readonly JobSummaryMercuryAllocationRow[],
  toYmd: (raw: string | null | undefined) => string | null,
): CardEventRow[] {
  return rows
    .filter((m) => !m.linkedToSupplyInvoice)
    .map((m) => ({
      dateKey: toYmd(m.mercury_transactions?.posted_at),
      amount: cardChargeCostUsd(m.amount),
      counterpartyName: m.mercury_transactions?.counterparty_name ?? null,
      attributionDisplayName: m.attributionDisplayName,
      fuel: m.isFuel === true,
    }))
}
