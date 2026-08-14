import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { compareJobsByCreatedAtDesc } from '../assignJobPickerOrder'
import { sortJobPickerRowsFinishedLast } from '../scheduleDispatchHub'
import { findJobsByNumber } from './stagesJobNumberJump'
import { stripTrailingZip } from '../displayAddress'
import { denverCalendarDaysBetweenInstantAndNow, formatDenverCalendarDayShort } from '../../utils/dateUtils'
import type { ScheduleDispatchAssignJobPickerRow } from '../../components/schedule/ScheduleDispatchAssignJobPickerModal'

/**
 * Sub Labor job picker (v2.1616): the New Sub Labor modal picks a real job
 * with the standard search instead of hand-typing Job # + Address. Storage is
 * unchanged (people_labor_jobs.job_number/address text — every rollup matches
 * job_number to the HCP), so these helpers only translate a picked job into
 * the fields the form already saves.
 */

export type SubLaborPickerJobSlice = {
  id: string
  hcp_number: string | null
  click_number?: string | null
  job_name: string | null
  customer_name: string | null
  job_address: string | null
}

/** `J925 · Keith Stadtmueller` — trigger/display identity for a picked job. */
export function subLaborJobDisplayLabel(job: SubLaborPickerJobSlice): string {
  const num = effectiveJobLedgerNumber(job.hcp_number, job.click_number ?? null)
  const name = (job.job_name ?? '').trim() || (job.customer_name ?? '').trim() || 'Job'
  return `${num ? `J${num}` : '—'} · ${name}`
}

/** Search text: number, name, customer, and address all match substrings. */
export function subLaborJobSearchLabel(job: SubLaborPickerJobSlice): string {
  const parts = [
    subLaborJobDisplayLabel(job),
    (job.customer_name ?? '').trim(),
    (job.job_address ?? '').trim(),
  ].filter(Boolean)
  return parts.join(' · ')
}

/** SearchableSelect options, newest job number first (matches the Stages sort feel). */
export function subLaborJobPickerOptions(
  jobs: readonly SubLaborPickerJobSlice[]
): Array<{ value: string; label: string }> {
  return [...jobs]
    .sort((a, b) => {
      const na = effectiveJobLedgerNumber(a.hcp_number, a.click_number ?? null)
      const nb = effectiveJobLedgerNumber(b.hcp_number, b.click_number ?? null)
      return nb.localeCompare(na, undefined, { numeric: true })
    })
    .map((j) => ({ value: j.id, label: subLaborJobSearchLabel(j) }))
}

/**
 * Resolve a seeded job number (deep links, Billing "Add Labor" prefill) to a
 * job — matches the effective number, raw HCP, or raw Click #, trimmed and
 * case-insensitive, like every other sub-labor HCP match.
 */
export function resolveSubLaborJobByNumber<T extends SubLaborPickerJobSlice>(
  jobs: readonly T[],
  jobNumber: string | null | undefined
): T | null {
  const q = (jobNumber ?? '').trim().toLowerCase()
  if (!q) return null
  for (const j of jobs) {
    const eff = effectiveJobLedgerNumber(j.hcp_number, j.click_number ?? null).trim().toLowerCase()
    const hcp = (j.hcp_number ?? '').trim().toLowerCase()
    const click = (j.click_number ?? '').trim().toLowerCase()
    if (q === eff || (hcp && q === hcp) || (click && q === click)) return j
  }
  return null
}

/** The job_number text the form stores for a picked job (schema caps at 10 chars). */
export function subLaborJobNumberForStorage(job: SubLaborPickerJobSlice): string {
  return effectiveJobLedgerNumber(job.hcp_number, job.click_number ?? null).trim().slice(0, 10)
}

export type SubLaborAssignPickerJobSlice = SubLaborPickerJobSlice & {
  created_at?: string | null
  status?: string | null
  serviceType?: { name: string } | null
}

/** Picker subline, hub-style: "Nd Mon D | address" (either part optional). */
export function subLaborPickerSubline(j: Pick<SubLaborAssignPickerJobSlice, 'created_at' | 'job_address'>): string | undefined {
  const dt = (j.created_at ?? '').trim()
  let dateLabel = ''
  if (dt) {
    const d = new Date(dt)
    if (!Number.isNaN(d.getTime())) {
      dateLabel = `${denverCalendarDaysBetweenInstantAndNow(d.getTime())}d ${formatDenverCalendarDayShort(d.getTime())}`
    }
  }
  const address = stripTrailingZip(j.job_address)
  const parts = [dateLabel, address].filter(Boolean)
  return parts.length > 0 ? parts.join(' | ') : undefined
}

/**
 * Rows for the app-standard job picker (ScheduleDispatchAssignJobPickerModal,
 * v2.1618): trade pill + stage chip + date/address subline, newest first with
 * finished jobs (billed/paid) under their divider. `numberDigits` non-empty
 * switches to number-only matching (the picker's # chip mode).
 */
export function subLaborAssignPickerRows(
  jobs: readonly SubLaborAssignPickerJobSlice[],
  search: string,
  numberDigits: string,
): ScheduleDispatchAssignJobPickerRow[] {
  const digits = numberDigits.replace(/\D/g, '')
  let list: SubLaborAssignPickerJobSlice[]
  if (digits !== '') {
    list = findJobsByNumber([...jobs], digits)
  } else {
    const q = search.trim().toLowerCase()
    list = [...jobs]
    if (q) {
      list = list.filter((j) => {
        const num = effectiveJobLedgerNumber(j.hcp_number, j.click_number ?? null).toLowerCase()
        return (
          num.includes(q) ||
          (j.job_name ?? '').toLowerCase().includes(q) ||
          (j.customer_name ?? '').toLowerCase().includes(q) ||
          (j.job_address ?? '').toLowerCase().includes(q) ||
          subLaborJobDisplayLabel(j).toLowerCase().includes(q)
        )
      })
    }
    list.sort(compareJobsByCreatedAtDesc)
  }
  return sortJobPickerRowsFinishedLast(
    list.map((j) => ({
      id: j.id,
      displayTitle: subLaborJobDisplayLabel(j),
      serviceTypeName: j.serviceType?.name ?? null,
      subline: subLaborPickerSubline(j),
      status: j.status ?? null,
      evidence: null,
    })),
  )
}
