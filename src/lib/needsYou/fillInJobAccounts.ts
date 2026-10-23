import { JOB_ACCOUNT_OPENED_VIA, JOB_ACCOUNT_OPENED_VIA_LABELS, type JobAccountOpenedVia, type JobAccountStatus } from '../materials/jobSupplyHouseAccounts'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'
import { fillInRowKey, type FillInRowBase } from './fillIn'

/**
 * The job-account kind (v2.5776, punch list #146, PR 4): the rows behind the Needs you line
 * *N jobs bought parts at a house with no job account*, one row per (job, house) from the
 * evidence rule (`list_job_account_evidence_gaps`: a house that expects an account, a job that
 * bought there, nothing open or not needed on record). The answer is the Mark opened sheet's
 * own row on `job_supply_house_accounts`: opened (how, the house's reference, a note), asked
 * for (requested), or not needed (with the reason); opened also flags the job's invoices at
 * that house as on the account, as the house roster does. Pure; `fillInJobAccountsIo.ts`
 * reads and writes.
 */
export type JobAccountGapSource = {
  job_id: string
  supply_house_id: string
  house_name: string
  allocated_total: number | string | null
  unpaid_total: number | string | null
  invoice_count: number | string | null
  po_count: number | string | null
  last_at: string | null
  rep_name: string | null
  rep_phone: string | null
}

export type JobAccountJobLabel = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null }

export type JobAccountFillInRow = FillInRowBase & {
  kind: 'job-account'
  jobId: string
  houseId: string
  houseName: string
  /** "#650 Maple Street remodel" — the ledger number and the job's name. */
  jobLabel: string
  unpaidTotal: number
  allocatedTotal: number
  invoiceCount: number
  repName: string | null
  repPhone: string | null
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return n != null && Number.isFinite(n) ? n : 0
}

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

export function jobAccountJobLabel(job: JobAccountJobLabel | undefined, jobId: string): string {
  if (!job) return `job ${jobId.slice(0, 8)}`
  const number = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
  const name = (job.job_name ?? '').trim() || (job.job_address ?? '').trim()
  return [number ? `#${number}` : null, name || null].filter(Boolean).join(' ') || `job ${jobId.slice(0, 8)}`
}

export function jobAccountKnows(g: JobAccountGapSource): string[] {
  const out: string[] = []
  const rep = (g.rep_name ?? '').trim()
  const phone = (g.rep_phone ?? '').trim()
  if (rep || phone) out.push(`The rep for job accounts is ${rep || 'on file'}${phone ? `, ${phone}` : ''}.`)
  else out.push('No job-accounts rep is on file for the house.')
  const lastMs = g.last_at ? Date.parse(g.last_at) : Number.NaN
  if (Number.isFinite(lastMs)) out.push(`Last bought there ${formatDenverCalendarDayShort(lastMs)}.`)
  const unpaid = num(g.unpaid_total)
  if (unpaid > 0) out.push(`${usd(unpaid)} of it is still unpaid.`)
  const po = num(g.po_count)
  if (po > 0) out.push(po === 1 ? 'One PO code was minted there.' : `${po} PO codes were minted there.`)
  return out
}

/** Biggest unpaid first, then biggest bought, then by name. */
export function compareJobAccountRows(a: JobAccountFillInRow, b: JobAccountFillInRow): number {
  return b.unpaidTotal - a.unpaidTotal || b.allocatedTotal - a.allocatedTotal || a.title.localeCompare(b.title)
}

export function jobAccountFillInRows(gaps: readonly JobAccountGapSource[], jobs: readonly JobAccountJobLabel[]): JobAccountFillInRow[] {
  const jobById = new Map(jobs.map((j) => [j.id, j]))
  return gaps
    .map((g): JobAccountFillInRow => {
      const jobLabel = jobAccountJobLabel(jobById.get(g.job_id), g.job_id)
      const allocated = num(g.allocated_total)
      const invoices = num(g.invoice_count)
      const bought = allocated > 0 ? `${usd(allocated)}${invoices > 0 ? ` on ${invoices === 1 ? 'one invoice' : `${invoices} invoices`}` : ''}` : invoices > 0 ? `${invoices} invoice${invoices === 1 ? '' : 's'}` : 'PO codes only'
      return {
        key: fillInRowKey('job-account', `${g.job_id}:${g.supply_house_id}`),
        kind: 'job-account',
        severity: 'gray',
        title: `${jobLabel} · ${g.house_name} · ${bought}`,
        knows: jobAccountKnows(g),
        doorHref: '/materials?tab=job-accounts&filter=no_account',
        doorLabel: 'Open Job accounts',
        jobId: g.job_id,
        houseId: g.supply_house_id,
        houseName: g.house_name,
        jobLabel,
        unpaidTotal: num(g.unpaid_total),
        allocatedTotal: allocated,
        invoiceCount: invoices,
        repName: (g.rep_name ?? '').trim() || null,
        repPhone: (g.rep_phone ?? '').trim() || null,
      }
    })
    .sort(compareJobAccountRows)
}

/** The three answers, the Mark opened sheet's two and the counter's ask. */
export type JobAccountChoice = JobAccountStatus

export const JOB_ACCOUNT_CHOICES: ReadonlyArray<{ key: JobAccountChoice; label: string; hint: string }> = [
  { key: 'open', label: 'It is on our job account there', hint: 'the invoices get flagged on the account' },
  { key: 'requested', label: 'Asked the house for one', hint: 'it shows as requested until the house opens it' },
  { key: 'not_needed', label: 'No account needed', hint: 'say why' },
]

export const JOB_ACCOUNT_VIA_OPTIONS: ReadonlyArray<{ key: JobAccountOpenedVia; label: string }> = JOB_ACCOUNT_OPENED_VIA.map((key) => ({ key, label: JOB_ACCOUNT_OPENED_VIA_LABELS[key] }))

export type JobAccountDecision = {
  choice: JobAccountChoice | null
  via: JobAccountOpenedVia
  ref: string
  note: string
}

export const EMPTY_JOB_ACCOUNT_DECISION: JobAccountDecision = { choice: null, via: 'phone', ref: '', note: '' }

/** A choice, and a reason when the answer is not needed, as the sheet requires. */
export function jobAccountDecisionReady(d: JobAccountDecision): boolean {
  if (!d.choice) return false
  if (d.choice === 'not_needed') return d.note.trim() !== ''
  return true
}

export type JobAccountWrites = {
  jobId: string
  houseId: string
  /** The sheet's upsert on (job_id, supply_house_id); the server stamps who and when. */
  row: { job_id: string; supply_house_id: string; status: JobAccountStatus; account_ref: string; opened_via: JobAccountOpenedVia | null; rep_contact_id: null; note: string }
  /** Opened: the job's unflagged invoices at the house go on the account, as the roster does. */
  flagInvoices: boolean
}

export function jobAccountWrites(row: JobAccountFillInRow, d: JobAccountDecision): JobAccountWrites | null {
  if (!jobAccountDecisionReady(d) || !d.choice) return null
  return {
    jobId: row.jobId,
    houseId: row.houseId,
    row: {
      job_id: row.jobId,
      supply_house_id: row.houseId,
      status: d.choice,
      account_ref: d.choice === 'open' ? d.ref.trim() : '',
      opened_via: d.choice === 'open' ? d.via : null,
      rep_contact_id: null,
      note: d.note.trim(),
    },
    flagInvoices: d.choice === 'open',
  }
}

/** How it was opened, in the trail's words (the sheet's labels read "By phone", "The packet", "At the counter"). */
const OPENED_HOW: Record<JobAccountOpenedVia, string> = { phone: 'by phone', packet: 'by the packet', counter: 'at the counter' }

/** The saved line under the deck, after the row's title: the answer, and where it lives now. */
export function jobAccountTrailWords(w: JobAccountWrites, flagged: number): string {
  if (w.row.status === 'open') {
    const how = `opened ${OPENED_HOW[w.row.opened_via ?? 'phone']}`
    const ref = w.row.account_ref ? ` · ref ${w.row.account_ref}` : ''
    const inv = flagged > 0 ? ` · ${flagged === 1 ? 'one invoice' : `${flagged} invoices`} flagged on it` : ''
    return `${how}${ref}${inv} · the house roster has it`
  }
  if (w.row.status === 'requested') return 'asked the house · the roster shows it as requested'
  return `not needed · ${w.row.note} · the house roster has it`
}
