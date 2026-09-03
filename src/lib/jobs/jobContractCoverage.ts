/**
 * Job-contract coverage kernel (Contract Desk PR 1): what counts as "this job
 * has a contract"? A signed job_contracts row wins; a paper copy on file
 * counts; a customer-accepted estimate that carries the e-signature audit
 * counts; a bid whose GC signed in the bid room counts. Only the true gaps
 * read "No contract" — that is what makes "every job has a contract" a
 * finite list instead of a company-wide chase.
 *
 * Pure. Batch-fed by the Stages tab (one job_contracts query + one
 * customer-accepted estimates query), consumed by the row chip, the Pipeline
 * "No contract" filter, and (PR 4) the Needs You count.
 */
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

export type JobContractRowLike = {
  id: string
  job_id: string
  status: string
  revision: number
  recipient_email: string | null
  sent_at: string | null
  last_sent_at: string | null
  view_count: number
  signed_at: string | null
  signer_printed_name: string | null
  signer_mode: string | null
  voided_at: string | null
}

/** A customer-accepted estimates row — the rails every online signature already lands on. */
export type SignedEstimateLike = {
  id: string
  job_ledger_id: string | null
  bid_id: string | null
  doc_kind: string
  status: string
  acceptor_consented_at: string | null
  acceptor_printed_name: string | null
  estimate_number: number
  total_cents: number
}

export type JobForCoverage = { id: string; bid_id: string | null }

export type JobContractCoverage =
  | { kind: 'none' }
  | { kind: 'draft'; contractId: string }
  | {
      kind: 'sent'
      contractId: string
      revision: number
      sentAt: string
      viewCount: number
      recipientEmail: string | null
    }
  | {
      kind: 'signed'
      source: 'contract' | 'paper' | 'estimate' | 'bid_room'
      signedAt: string | null
      signerName: string | null
      contractId: string | null
      estimateNumber: number | null
      /** The estimates row behind an estimate / bid-room signature (opens the acceptance record). */
      estimateId: string | null
    }

export type JobContractCoverageOptions = {
  /** Owner decision 1 (proposed yes): an estimate accepted through the accept page counts. */
  countAcceptedEstimates?: boolean
  /** A bid-room signature on the job's bid counts. */
  countSignedBidProposals?: boolean
}

function isLive(c: JobContractRowLike): boolean {
  return c.voided_at == null && c.status !== 'voided'
}

/**
 * Per-job coverage. Precedence: signed contract → paper on file → accepted
 * estimate (e-signed) → signed bid-room proposal → sent → draft → none.
 */
export function buildJobContractCoverage(
  jobs: ReadonlyArray<JobForCoverage>,
  contracts: ReadonlyArray<JobContractRowLike>,
  estimates: ReadonlyArray<SignedEstimateLike>,
  options: JobContractCoverageOptions = {},
): Map<string, JobContractCoverage> {
  const countEstimates = options.countAcceptedEstimates ?? true
  const countBids = options.countSignedBidProposals ?? true

  const byJob = new Map<string, JobContractRowLike[]>()
  for (const c of contracts) {
    if (!isLive(c)) continue
    const list = byJob.get(c.job_id)
    if (list) list.push(c)
    else byJob.set(c.job_id, [c])
  }
  const acceptedByJob = new Map<string, SignedEstimateLike>()
  const bidProposalByBid = new Map<string, SignedEstimateLike>()
  for (const e of estimates) {
    if (e.status !== 'customer_accepted') continue
    if (!e.acceptor_consented_at) continue
    if (e.doc_kind === 'bid_proposal') {
      if (e.bid_id && !bidProposalByBid.has(e.bid_id)) bidProposalByBid.set(e.bid_id, e)
      continue
    }
    if (e.doc_kind === 'change_order') continue
    if (e.job_ledger_id && !acceptedByJob.has(e.job_ledger_id)) acceptedByJob.set(e.job_ledger_id, e)
  }

  const out = new Map<string, JobContractCoverage>()
  for (const job of jobs) {
    const rows = byJob.get(job.id) ?? []
    const signed = rows
      .filter((c) => c.status === 'signed' && c.signed_at)
      .sort((a, b) => (b.signed_at ?? '').localeCompare(a.signed_at ?? ''))[0]
    if (signed) {
      out.set(job.id, {
        kind: 'signed',
        source: signed.signer_mode === 'paper' ? 'paper' : 'contract',
        signedAt: signed.signed_at,
        signerName: signed.signer_printed_name,
        contractId: signed.id,
        estimateNumber: null,
        estimateId: null,
      })
      continue
    }
    const est = countEstimates ? acceptedByJob.get(job.id) : undefined
    if (est) {
      out.set(job.id, {
        kind: 'signed',
        source: 'estimate',
        signedAt: est.acceptor_consented_at,
        signerName: est.acceptor_printed_name,
        contractId: null,
        estimateNumber: est.estimate_number,
        estimateId: est.id,
      })
      continue
    }
    const bid = countBids && job.bid_id ? bidProposalByBid.get(job.bid_id) : undefined
    if (bid) {
      out.set(job.id, {
        kind: 'signed',
        source: 'bid_room',
        signedAt: bid.acceptor_consented_at,
        signerName: bid.acceptor_printed_name,
        contractId: null,
        estimateNumber: bid.estimate_number,
        estimateId: bid.id,
      })
      continue
    }
    const sent = rows.find((c) => c.status === 'sent')
    if (sent) {
      out.set(job.id, {
        kind: 'sent',
        contractId: sent.id,
        revision: sent.revision,
        sentAt: sent.last_sent_at ?? sent.sent_at ?? '',
        viewCount: sent.view_count,
        recipientEmail: sent.recipient_email,
      })
      continue
    }
    const draft = rows.find((c) => c.status === 'draft')
    if (draft) {
      out.set(job.id, { kind: 'draft', contractId: draft.id })
      continue
    }
    out.set(job.id, { kind: 'none' })
  }
  return out
}

export type JobContractChipTone = 'none' | 'draft' | 'sent' | 'signed'

export function jobContractChipTone(cov: JobContractCoverage | null | undefined): JobContractChipTone {
  if (!cov) return 'none'
  return cov.kind
}

/** "Michael Palmer" → "M. Palmer"; single names pass through. */
export function abbreviateSignerName(name: string | null | undefined): string | null {
  const trimmed = (name ?? '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  const parts = trimmed.split(' ')
  if (parts.length === 1) return parts[0] ?? null
  const first = parts[0] ?? ''
  const last = parts[parts.length - 1] ?? ''
  return `${first.charAt(0).toUpperCase()}. ${last}`
}

function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric' }).format(d)
}

export function daysSinceIso(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000))
}

/** The chip's one line — the shared vocabulary every surface renders. */
export function jobContractChipLabel(cov: JobContractCoverage | null | undefined, now: Date = new Date()): string {
  if (!cov || cov.kind === 'none') return 'No contract'
  if (cov.kind === 'draft') return 'Contract draft'
  if (cov.kind === 'sent') {
    const parts = ['Contract sent']
    if (cov.viewCount > 0) parts.push(`opened ${cov.viewCount}×`)
    const days = daysSinceIso(cov.sentAt, now)
    if (days != null) parts.push(days === 0 ? 'today' : `${days}d`)
    return parts.join(' · ')
  }
  const when = shortDate(cov.signedAt)
  const who = abbreviateSignerName(cov.signerName)
  switch (cov.source) {
    case 'paper':
      return `✍ On file · paper${when ? ` · ${when}` : ''}`
    case 'estimate':
      return `✍ Signed · estimate${cov.estimateNumber != null ? ` #${cov.estimateNumber}` : ''}`
    case 'bid_room':
      return '✍ Signed · bid room'
    default:
      return `✍ Signed${when ? ` ${when}` : ''}${who ? ` · ${who}` : ''}`
  }
}

/** Longer hover text for the chip. */
export function jobContractChipTitle(cov: JobContractCoverage | null | undefined): string {
  if (!cov || cov.kind === 'none') return 'No signed agreement on file for this job'
  if (cov.kind === 'draft') return 'A contract draft is saved but has not been sent'
  if (cov.kind === 'sent') {
    return `Contract rev ${cov.revision} sent${cov.recipientEmail ? ` to ${cov.recipientEmail}` : ''}${
      cov.viewCount > 0 ? ` · opened ${cov.viewCount} time${cov.viewCount === 1 ? '' : 's'}` : ' · not opened yet'
    }`
  }
  const who = (cov.signerName ?? '').trim()
  switch (cov.source) {
    case 'paper':
      return 'A signed paper contract was uploaded and recorded'
    case 'estimate':
      return `The customer accepted estimate${cov.estimateNumber != null ? ` #${cov.estimateNumber}` : ''} online${who ? ` as ${who}` : ''} — that acceptance record is the agreement`
    case 'bid_room':
      return `The GC signed the proposal in the bid room${who ? ` as ${who}` : ''}`
    default:
      return `Contract signed electronically${who ? ` by ${who}` : ''}`
  }
}

export const STAGES_CONTRACT_FILTERS = ['missing', 'sent', 'signed'] as const
export type StagesContractFilter = (typeof STAGES_CONTRACT_FILTERS)[number]

export const STAGES_CONTRACT_FILTER_LABELS: Record<StagesContractFilter, string> = {
  missing: 'No contract',
  sent: 'Contract out for signature',
  signed: 'Contract signed',
}

export function parseStagesContractFilter(raw: string | null | undefined): StagesContractFilter | '' {
  return raw === 'missing' || raw === 'sent' || raw === 'signed' ? raw : ''
}

export function contractCoverageMatchesFilter(
  cov: JobContractCoverage | null | undefined,
  filter: StagesContractFilter | '',
): boolean {
  if (!filter) return true
  const kind = cov?.kind ?? 'none'
  if (filter === 'missing') return kind === 'none' || kind === 'draft'
  if (filter === 'sent') return kind === 'sent'
  return kind === 'signed'
}

export function filterJobsByContractCoverage<T extends { id: string }>(
  jobs: T[],
  coverage: ReadonlyMap<string, JobContractCoverage>,
  filter: StagesContractFilter | '',
): T[] {
  if (!filter) return jobs
  return jobs.filter((j) => contractCoverageMatchesFilter(coverage.get(j.id), filter))
}
