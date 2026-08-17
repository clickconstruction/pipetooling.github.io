/**
 * Link-jobs sweep — matching kernel (Customer Hub follow-up, 2026-08-17).
 *
 * Proposes a customer for every jobs_ledger row with no customer_id, tiered
 * by confidence, and GROUPS jobs by the name string they carry so the user
 * makes one decision per name, not per job (the HCP import left ~500 of
 * these; job names in that era were usually the customer's name).
 *
 * Tiers:
 *  - 'customer_name': the row's customer_name exactly equals one customer
 *    (normalized) — strongest signal, pre-checked in the modal.
 *  - 'job_name': no customer_name, but the job name exactly equals one
 *    customer — the HCP-era pattern, pre-checked.
 *  - 'prefix': the job name starts with exactly one customer's name (≥ 6
 *    normalized chars, e.g. "Mary Evans (to be paid by DRF)") — proposed but
 *    unchecked; the user confirms.
 *  - 'none': no proposal — the user picks (aliases like "Dudley Mason" →
 *    "RMC- Dudley Mason") or skips.
 *
 * Pure; normalization shared with customerSimilarity so the two dedupe
 * surfaces agree on what "the same name" means.
 */
import { normalizeCustomerName } from '../customerSimilarity'

export type UnlinkedJobInput = {
  id: string
  customer_name: string | null
  job_name: string | null
  hcp_number: string | null
  click_number: string | null
  /** Job owner — groups split by it so an ownership move is one clear decision. */
  master_user_id?: string | null
}

export type LinkCustomerInput = { id: string; name: string | null; master_user_id?: string | null }

export type LinkConfidence = 'customer_name' | 'job_name' | 'prefix' | 'none'

export type ProposedLinkGroup = {
  /** The name string the jobs carry (display form, first occurrence). */
  displayName: string
  jobIds: string[]
  /** Up to a few ledger numbers for display. */
  sampleLabels: string[]
  proposedCustomerId: string | null
  confidence: LinkConfidence
  /** The jobs' owner (groups never mix owners). */
  jobMasterUserId: string | null
}

const MIN_PREFIX_NORM_LEN = 6

export function proposeJobCustomerLinks(
  jobs: UnlinkedJobInput[],
  customers: LinkCustomerInput[],
): ProposedLinkGroup[] {
  const byNorm = new Map<string, string[]>()
  for (const c of customers) {
    const k = normalizeCustomerName(c.name)
    if (!k) continue
    const list = byNorm.get(k)
    if (list) list.push(c.id)
    else byNorm.set(k, [c.id])
  }
  const normKeys = Array.from(byNorm.keys())

  type Bucket = {
    displayName: string
    jobIds: string[]
    sampleLabels: string[]
    proposedCustomerId: string | null
    confidence: LinkConfidence
    jobMasterUserId: string | null
  }
  const buckets = new Map<string, Bucket>()

  for (const job of jobs) {
    const rawCustomerName = (job.customer_name ?? '').trim()
    const rawJobName = (job.job_name ?? '').trim()
    const display = rawCustomerName || rawJobName
    const normKey = normalizeCustomerName(display)
    if (!normKey) continue

    let proposed: string | null = null
    let confidence: LinkConfidence = 'none'
    if (rawCustomerName) {
      const hits = byNorm.get(normalizeCustomerName(rawCustomerName))
      if (hits?.length === 1) {
        proposed = hits[0]!
        confidence = 'customer_name'
      }
    } else if (rawJobName) {
      const exact = byNorm.get(normalizeCustomerName(rawJobName))
      if (exact?.length === 1) {
        proposed = exact[0]!
        confidence = 'job_name'
      } else if (!exact) {
        const jn = normalizeCustomerName(rawJobName)
        const prefixHits = normKeys.filter((k) => k.length >= MIN_PREFIX_NORM_LEN && jn.startsWith(k))
        if (prefixHits.length === 1 && byNorm.get(prefixHits[0]!)!.length === 1) {
          proposed = byNorm.get(prefixHits[0]!)![0]!
          confidence = 'prefix'
        }
      }
    }

    const jobMaster = job.master_user_id ?? null
    const bucketKey = `${normKey}|${proposed ?? ''}|${confidence}|${jobMaster ?? ''}`
    const label = (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || ''
    const existing = buckets.get(bucketKey)
    if (existing) {
      existing.jobIds.push(job.id)
      if (label && existing.sampleLabels.length < 4) existing.sampleLabels.push(label)
    } else {
      buckets.set(bucketKey, {
        displayName: display,
        jobIds: [job.id],
        sampleLabels: label ? [label] : [],
        proposedCustomerId: proposed,
        confidence,
        jobMasterUserId: jobMaster,
      })
    }
  }

  const order: Record<LinkConfidence, number> = { customer_name: 0, job_name: 1, prefix: 2, none: 3 }
  return Array.from(buckets.values()).sort(
    (a, b) =>
      order[a.confidence] - order[b.confidence] ||
      b.jobIds.length - a.jobIds.length ||
      a.displayName.localeCompare(b.displayName),
  )
}
