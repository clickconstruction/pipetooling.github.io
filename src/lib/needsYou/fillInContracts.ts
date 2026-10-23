import { buildJobContractCoverage, type JobContractRowLike, type SignedEstimateLike } from '../jobs/jobContractCoverage'
import { summarizeContractNudge, type ContractNudgeJob } from '../jobs/jobContractNudge'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'
import { fillInRowKey, type FillInRowBase } from './fillIn'

/**
 * The contract kind (v2.5777, punch list #145, PR 5): the rows behind the Needs you line
 * *N contracts have been out for signature a week*, one row per sent agreement the nudge's own
 * rule counts as stale (`summarizeContractNudge`: sent, unsigned, `CONTRACT_STALE_DAYS` or
 * more). The answers are the Contract window's own doors: resend the signing email, text the
 * link, or file it signed on paper. A resend or a text records nothing on the row, as the
 * window's doors do, so the trail says the agreement stays on the list until it is signed.
 * Pure; `fillInContractsIo.ts` reads and writes.
 */
export type ContractJobSource = ContractNudgeJob & {
  hcp_number?: string | null
  click_number?: string | null
  job_name?: string | null
  customer_name?: string | null
  job_address?: string | null
}

export type ContractRowSource = JobContractRowLike & {
  recipient_phone?: string | null
  recipient_name?: string | null
  public_token?: string | null
  public_token_expires_at?: string | null
  co_signer_name?: string | null
}

export type ContractFillInRow = FillInRowBase & {
  kind: 'contract'
  contractId: string
  jobId: string
  jobLabel: string
  customerName: string | null
  jobAddress: string | null
  revenue: number | null
  sentAt: string
  daysOut: number
  recipientEmail: string | null
  recipientName: string | null
  recipientPhone: string | null
  viewCount: number
  framesWaiting: string
  /** The row as read, for the paper filing and the link doors. */
  contract: ContractRowSource
}

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`
const day = (iso: string): string => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? formatDenverCalendarDayShort(ms) : iso.slice(0, 10)
}

export function contractJobLabel(job: Pick<ContractJobSource, 'id' | 'hcp_number' | 'click_number' | 'job_name' | 'job_address'>): string {
  const number = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
  const name = (job.job_name ?? '').trim() || (job.job_address ?? '').trim()
  return [number ? `#${number}` : null, name || null].filter(Boolean).join(' ') || `job ${job.id.slice(0, 8)}`
}

export function contractKnows(r: Pick<ContractFillInRow, 'customerName' | 'recipientEmail' | 'recipientPhone' | 'viewCount' | 'framesWaiting'>): string[] {
  const out: string[] = []
  if (r.customerName) out.push(`The customer is ${r.customerName}.`)
  out.push(r.recipientEmail ? `Sent to ${r.recipientEmail} with the signing link.` : 'Sent with no email on file.')
  out.push(r.viewCount > 0 ? `Opened ${r.viewCount === 1 ? 'once' : `${r.viewCount} times`}, never signed.` : 'Never opened.')
  out.push(r.recipientPhone ? `A mobile is on file: ${r.recipientPhone}.` : 'No mobile on file.')
  if (r.framesWaiting) out.push(`${r.framesWaiting}.`)
  return out
}

/** Longest out first. */
export function compareContractRows(a: ContractFillInRow, b: ContractFillInRow): number {
  return b.daysOut - a.daysOut || (b.revenue ?? 0) - (a.revenue ?? 0) || a.title.localeCompare(b.title)
}

export function contractFillInRows(input: { jobs: readonly ContractJobSource[]; contracts: readonly ContractRowSource[]; estimates: readonly SignedEstimateLike[]; now: Date; floorCents: number }): ContractFillInRow[] {
  const summary = summarizeContractNudge(input.jobs, input.contracts, input.estimates, input.now, { floorCents: input.floorCents })
  const stale = new Set(summary.stale.jobIds)
  const coverage = buildJobContractCoverage(input.jobs, input.contracts, input.estimates)
  const contractById = new Map(input.contracts.map((c) => [c.id, c]))
  const jobById = new Map(input.jobs.map((j) => [j.id, j]))
  const rows: ContractFillInRow[] = []
  for (const jobId of stale) {
    const cov = coverage.get(jobId)
    const job = jobById.get(jobId)
    if (!job || !cov || cov.kind !== 'sent') continue
    const contract = contractById.get(cov.contractId)
    if (!contract) continue
    const daysOut = Math.max(0, Math.floor((input.now.getTime() - Date.parse(cov.sentAt)) / 86_400_000))
    const revenue = job.revenue != null && Number.isFinite(Number(job.revenue)) ? Number(job.revenue) : null
    const jobLabel = contractJobLabel(job)
    const base = {
      customerName: (job.customer_name ?? '').trim() || null,
      recipientEmail: (contract.recipient_email ?? '').trim() || null,
      recipientPhone: (contract.recipient_phone ?? '').trim() || null,
      viewCount: contract.view_count ?? 0,
      framesWaiting: cov.framesWaiting ?? '',
    }
    rows.push({
      key: fillInRowKey('contract', contract.id),
      kind: 'contract',
      severity: 'amber',
      title: [jobLabel, `sent ${day(cov.sentAt)}`, revenue != null ? usd(revenue) : null, `${daysOut} days unsigned`].filter(Boolean).join(' · '),
      knows: contractKnows(base),
      doorHref: `/jobs?tab=stages&edit=${encodeURIComponent(jobId)}&editFocus=contract`,
      doorLabel: 'Open the contract',
      contractId: contract.id,
      jobId,
      jobLabel,
      jobAddress: (job.job_address ?? '').trim() || null,
      revenue,
      sentAt: cov.sentAt,
      daysOut,
      recipientName: (contract.recipient_name ?? '').trim() || null,
      ...base,
      contract,
    })
  }
  return rows.sort(compareContractRows)
}

/** The three answers: the Contract window's doors for a sent agreement. */
export type ContractChoice = 'resend' | 'text' | 'paper'

export const CONTRACT_CHOICES: ReadonlyArray<{ key: ContractChoice; label: string; hint: string }> = [
  { key: 'resend', label: 'Resend the email', hint: 'the signing link again' },
  { key: 'text', label: 'Text the link', hint: 'opens your messages with it' },
  { key: 'paper', label: 'Signed on paper', hint: 'file it as signed' },
]

export type ContractDecision = {
  choice: ContractChoice | null
  /** A line added to the resend. */
  message: string
  signerName: string
  signedOn: string
  link: string
  file: File | null
}

export function emptyContractDecision(row: Pick<ContractFillInRow, 'recipientName'>, todayYmd: string): ContractDecision {
  return { choice: null, message: '', signerName: row.recipientName ?? '', signedOn: todayYmd, link: '', file: null }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Which answers the row can take: a resend needs an email, a text a mobile. */
export function contractChoiceAvailable(row: Pick<ContractFillInRow, 'recipientEmail' | 'recipientPhone'>, choice: ContractChoice): boolean {
  if (choice === 'resend') return EMAIL_RE.test(row.recipientEmail ?? '')
  if (choice === 'text') return (row.recipientPhone ?? '').replace(/[^\d]/g, '').length >= 10
  return true
}

export function contractDecisionReady(row: Pick<ContractFillInRow, 'recipientEmail' | 'recipientPhone'>, d: ContractDecision): boolean {
  if (!d.choice || !contractChoiceAvailable(row, d.choice)) return false
  if (d.choice === 'paper') return d.signerName.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(d.signedOn)
  return true
}

export type ContractWrites =
  | { choice: 'resend'; contractId: string; recipientEmail: string; recipientName: string; message: string }
  | { choice: 'text'; contractId: string; phone: string; body: (url: string) => string }
  | { choice: 'paper'; contractId: string; jobId: string; signerName: string; signedOn: string; link: string; file: File | null }

export function contractWrites(row: ContractFillInRow, d: ContractDecision): ContractWrites | null {
  if (!contractDecisionReady(row, d) || !d.choice) return null
  if (d.choice === 'resend') return { choice: 'resend', contractId: row.contractId, recipientEmail: row.recipientEmail!, recipientName: row.recipientName ?? '', message: d.message.trim() }
  if (d.choice === 'text') {
    const where = row.jobAddress || 'your project'
    return { choice: 'text', contractId: row.contractId, phone: row.recipientPhone!.replace(/[^\d+]/g, ''), body: (url) => `Here is your service agreement for ${where} — review and sign here: ${url}` }
  }
  return { choice: 'paper', contractId: row.contractId, jobId: row.jobId, signerName: d.signerName.trim(), signedOn: d.signedOn, link: d.link.trim(), file: d.file }
}

/** The saved line under the deck, after the row's title: what went out or what is on file. A resend or a text leaves the row on the list. */
export function contractTrailWords(w: ContractWrites, row: Pick<ContractFillInRow, 'recipientEmail' | 'recipientPhone'>): string {
  if (w.choice === 'resend') return `the signing link went to ${row.recipientEmail} again · still unsigned, so it stays on the Dashboard`
  if (w.choice === 'text') return `the link went out by text to ${row.recipientPhone} · still unsigned, so it stays on the Dashboard`
  return `signed on paper ${day(`${w.signedOn}T12:00:00Z`)} by ${w.signerName} · on file as signed`
}
