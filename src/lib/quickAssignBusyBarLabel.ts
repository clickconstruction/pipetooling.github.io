import { effectiveJobLedgerNumber } from './ledgerDisplayPrefixes'
import { splitJobAddressForPrefill } from './txLocalityAddressSplit'

export type QuickAssignBusyBarInput = {
  hcpNumber: string | null
  clickNumber: string | null
  /** The job's customer, as `jobs_ledger.customer_name` — "Megan Connell", "DRF Harwood Repairs". */
  customerName: string
  jobAddress: string
}

/**
 * The town in a job address. The prefill splitter wants "City, ST ZIP"; many
 * stored addresses end "…, Harwood, TX" with no zip, so those fall back to the
 * segment before a trailing two-letter state.
 */
export function quickAssignBusyBarTown(jobAddress: string): string {
  const city = splitJobAddressForPrefill(jobAddress).city
  if (city) return city
  const parts = jobAddress.split(',').map((s) => s.trim()).filter(Boolean)
  const last = parts[parts.length - 1] ?? ''
  if (parts.length >= 3 && /^[A-Za-z]{2}(\s+[\d-]+)?$/.test(last)) return parts[parts.length - 2] ?? ''
  return ''
}

/** "DRF Harwood Repairs" → "DRF Harwood"; a one-word name stays; empty → "". */
export function firstTwoWords(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(' ')
}

/**
 * The words on a busy bar in Assign work (v2.4213): the job number, the first
 * two words of the customer's name and the job's town — "J568 · Diamondback
 * Homes · Neeses". A part the block does not have is left out rather than
 * shown as a dash; a bar too narrow for the words clips with an ellipsis.
 */
export function quickAssignBusyBarLabel(b: QuickAssignBusyBarInput): string {
  // Plain J prefix, as every schedule surface names a job (scheduleBlockTitle) — the sheet header reads "J1064".
  const n = effectiveJobLedgerNumber(b.hcpNumber, b.clickNumber)
  const num = n ? `J${n}` : ''
  const who = firstTwoWords(b.customerName)
  const town = quickAssignBusyBarTown(b.jobAddress)
  return [num, who, town].filter((s) => s.length > 0).join(' · ')
}
