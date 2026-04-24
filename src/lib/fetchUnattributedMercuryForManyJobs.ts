import type { MercuryJobAllocationWithAttributionRow } from './fetchMercuryJobAllocationsWithAttributionForJob'
import { fetchMercuryJobAllocationsWithAttributionForJob } from './fetchMercuryJobAllocationsWithAttributionForJob'
import { dedupeUnattributedRows } from './dedupeUnattributedMercuryRows'

export type UnattributedMercuryLineForJob = {
  jobId: string
  jobLabel: string
  mercury_transaction_id: string
  lineAmount: number
  sample: MercuryJobAllocationWithAttributionRow
}

const DEFAULT_CONCURRENCY = 5

/**
 * Loads unattributed Mercury allocation lines for many jobs (Parts tab scope),
 * with bounded concurrency. Optional cache avoids refetch when Parts already loaded that job.
 */
export async function fetchUnattributedMercuryLinesForManyJobs(options: {
  jobIds: string[]
  jobLabelById: Record<string, string>
  /** If present and has jobId, use these rows instead of network. */
  cacheByJobId?: Map<string, MercuryJobAllocationWithAttributionRow[]>
  operationLabel: string
  concurrency?: number
}): Promise<UnattributedMercuryLineForJob[]> {
  const { jobIds, jobLabelById, cacheByJobId, operationLabel, concurrency = DEFAULT_CONCURRENCY } = options
  const out: UnattributedMercuryLineForJob[] = []
  const lim = Math.max(1, concurrency)

  for (let i = 0; i < jobIds.length; i += lim) {
    const chunk = jobIds.slice(i, i + lim)
    const chunkResults = await Promise.all(
      chunk.map(async (jobId) => {
        const cached = cacheByJobId?.get(jobId)
        const rows =
          cached ??
          (await fetchMercuryJobAllocationsWithAttributionForJob(
            jobId,
            `${operationLabel} job ${jobId.slice(0, 8)}`,
          ))
        const unattributed = rows.filter((r) => r.attributionDisplayName == null)
        const lines = dedupeUnattributedRows(unattributed)
        const jobLabel = jobLabelById[jobId] ?? '—'
        return lines.map((line) => ({
          jobId,
          jobLabel,
          mercury_transaction_id: line.mercury_transaction_id,
          lineAmount: line.lineAmount,
          sample: line.sample,
        }))
      }),
    )
    for (const block of chunkResults) out.push(...block)
  }

  out.sort((a, b) => {
    const jl = a.jobLabel.localeCompare(b.jobLabel)
    if (jl !== 0) return jl
    const ap = a.sample.mercury_transactions?.posted_at ?? ''
    const bp = b.sample.mercury_transactions?.posted_at ?? ''
    const pd = ap.localeCompare(bp)
    if (pd !== 0) return pd
    return a.mercury_transaction_id.localeCompare(b.mercury_transaction_id)
  })
  return out
}
