import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

/** The few columns of a desk job its label is built from. */
export type LienJobLabelSource = { hcp_number: string | null | undefined; click_number: string | null | undefined; job_name?: string | null }

/** The job's number alone, as the Board's chips read it (v2.7332): the id's first eight letters while the job has not loaded, a dash when it has no number. */
export function lienDeskJobNumber(j: LienJobLabelSource | undefined, jobId: string): string {
  if (!j) return jobId.slice(0, 8)
  return effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
}

/** The desk's label for a job: its number, a dot and its name, or the number alone with no name. */
export function lienDeskJobLabel(j: LienJobLabelSource | undefined, jobId: string): string {
  if (!j) return jobId.slice(0, 8)
  const number = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
  const name = (j.job_name ?? '').trim()
  return name ? `${number} · ${name}` : number
}

/**
 * A job's label on the Lien desk is "663 · Kestrin Contracting" (the ledger number, a dot, the
 * job's name), built in three places that all agree. Where the number is the door to the job
 * (v2.4535) the label is drawn in its two halves; this is the one place that splits it.
 */
export function splitLienJobLabel(label: string): { number: string; name: string } {
  const at = label.indexOf(' · ')
  if (at < 0) return { number: label.trim(), name: '' }
  return { number: label.slice(0, at).trim(), name: label.slice(at + 3).trim() }
}
