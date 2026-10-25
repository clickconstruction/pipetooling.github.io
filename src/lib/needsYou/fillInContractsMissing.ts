import { summarizeContractNudge } from '../jobs/jobContractNudge'
import type { SignedEstimateLike } from '../jobs/jobContractCoverage'
import { fillInRowKey, type FillInRowBase } from './fillIn'
import { contractJobLabel, type ContractJobSource, type ContractRowSource } from './fillInContracts'

/**
 * The contract-missing kind (v2.5844, punch list #176, change 3, PR 2): the rows behind the
 * Needs you line *N live jobs have no contract on file*, the largest figure on the owner's card
 * (84 jobs, $1.2M of work on no signed agreement when the review read it). One row per live job
 * the nudge counts as missing, the most money first. Two answers save here: the paper copy the
 * office already has, filed as signed, and *No contract needed* with the reason, the sweep's own
 * two doors. Sending one is the sweep's work and stays there, since the sweep renders the
 * agreement before anything goes out; the row's door opens the sweep. Pure;
 * `fillInContractsMissingIo.ts` reads and writes.
 */
export type ContractMissingFillInRow = FillInRowBase & {
  kind: 'contract-missing'
  jobId: string
  jobLabel: string
  customerName: string | null
  jobAddress: string | null
  revenue: number | null
  status: string | null
  customerEmail: string | null
}

export type ContractMissingJobSource = ContractJobSource & { customer_email?: string | null }

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

const STATUS_WORDS: Record<string, string> = {
  waiting: 'Waiting to start',
  working: 'Working',
  ready_to_bill: 'Ready to bill',
  billed: 'Billed',
}

export function contractMissingKnows(r: Pick<ContractMissingFillInRow, 'customerName' | 'status' | 'revenue' | 'customerEmail'>): string[] {
  const out: string[] = []
  if (r.customerName) out.push(`The customer is ${r.customerName}.`)
  const stage = r.status ? STATUS_WORDS[r.status] ?? r.status : null
  if (stage && r.revenue != null) out.push(`${stage} · ${usd(r.revenue)} of work on no signed agreement.`)
  else if (stage) out.push(`${stage}, with no signed agreement.`)
  else if (r.revenue != null) out.push(`${usd(r.revenue)} of work on no signed agreement.`)
  out.push(r.customerEmail ? `An email is on file: ${r.customerEmail}. The sweep can send the agreement there.` : 'No email on file, so the sweep cannot send it yet.')
  return out
}

/** The most money first, then the number. */
export function compareContractMissingRows(a: ContractMissingFillInRow, b: ContractMissingFillInRow): number {
  return (b.revenue ?? 0) - (a.revenue ?? 0) || a.jobLabel.localeCompare(b.jobLabel, undefined, { numeric: true })
}

export function contractMissingFillInRows(input: {
  jobs: readonly ContractMissingJobSource[]
  contracts: readonly ContractRowSource[]
  estimates: readonly SignedEstimateLike[]
  now: Date
  floorCents: number
}): ContractMissingFillInRow[] {
  const summary = summarizeContractNudge(input.jobs, input.contracts, input.estimates, input.now, { floorCents: input.floorCents })
  const jobById = new Map(input.jobs.map((j) => [j.id, j]))
  const rows: ContractMissingFillInRow[] = []
  for (const jobId of summary.missing.jobIds) {
    const job = jobById.get(jobId)
    if (!job) continue
    const revenue = job.revenue != null && Number.isFinite(Number(job.revenue)) ? Number(job.revenue) : null
    const jobLabel = contractJobLabel(job)
    const base = {
      customerName: (job.customer_name ?? '').trim() || null,
      status: job.status ?? null,
      revenue,
      customerEmail: (job.customer_email ?? '').trim() || null,
    }
    rows.push({
      key: fillInRowKey('contract-missing', jobId),
      kind: 'contract-missing',
      severity: 'amber',
      title: [jobLabel, base.customerName, revenue != null ? usd(revenue) : null, 'no contract on file'].filter(Boolean).join(' · '),
      knows: contractMissingKnows(base),
      doorHref: '/jobs?tab=stages&contractSweep=1',
      doorLabel: 'Send it from the sweep',
      jobId,
      jobLabel,
      jobAddress: (job.job_address ?? '').trim() || null,
      ...base,
    })
  }
  return rows.sort(compareContractMissingRows)
}

/** The two answers the deck saves; a send is the sweep's and goes through the door. */
export type ContractMissingChoice = 'paper' | 'not-needed'

export const CONTRACT_MISSING_CHOICES: ReadonlyArray<{ key: ContractMissingChoice; label: string; hint: string }> = [
  { key: 'paper', label: 'Signed on paper', hint: 'file the copy we have' },
  { key: 'not-needed', label: 'No contract needed', hint: 'say why' },
]

export type ContractMissingDecision = {
  choice: ContractMissingChoice | null
  signerName: string
  signedOn: string
  link: string
  file: File | null
  reason: string
}

export function emptyContractMissingDecision(row: Pick<ContractMissingFillInRow, 'customerName'>, todayYmd: string): ContractMissingDecision {
  return { choice: null, signerName: row.customerName ?? '', signedOn: todayYmd, link: '', file: null, reason: '' }
}

export const CONTRACT_MISSING_REASON_MIN = 3

export function contractMissingDecisionReady(d: ContractMissingDecision): boolean {
  if (d.choice === 'paper') return d.signerName.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(d.signedOn)
  if (d.choice === 'not-needed') return d.reason.trim().length >= CONTRACT_MISSING_REASON_MIN
  return false
}

export type ContractMissingWrites =
  | { choice: 'paper'; jobId: string; signerName: string; signedOn: string; link: string; file: File | null }
  | { choice: 'not-needed'; jobId: string; reason: string }

export function contractMissingWrites(row: ContractMissingFillInRow, d: ContractMissingDecision): ContractMissingWrites | null {
  if (!contractMissingDecisionReady(d) || !d.choice) return null
  if (d.choice === 'paper') return { choice: 'paper', jobId: row.jobId, signerName: d.signerName.trim(), signedOn: d.signedOn, link: d.link.trim(), file: d.file }
  return { choice: 'not-needed', jobId: row.jobId, reason: d.reason.trim() }
}

/** The saved line under the deck. */
export function contractMissingTrailWords(w: ContractMissingWrites): string {
  if (w.choice === 'paper') return `signed on paper by ${w.signerName} · on file as signed`
  return `no contract needed · ${w.reason}`
}
