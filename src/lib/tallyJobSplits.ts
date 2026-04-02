import type { MercuryJobSplit } from '../components/MercuryTransactionAllocationsModal'
import type { Json } from '../types/database'

/** Parse job_splits JSON from tally / banking RPC shapes into MercuryJobSplit[]. */
export function parseTallyJobSplitsJson(jobSplits: Json | null | undefined): MercuryJobSplit[] {
  if (jobSplits == null || !Array.isArray(jobSplits)) return []
  const out: MercuryJobSplit[] = []
  for (const item of jobSplits) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const jobId = o.job_id
    if (typeof jobId !== 'string') continue
    const amt = o.amount
    const amount = typeof amt === 'number' ? amt : Number(amt)
    if (!Number.isFinite(amount)) continue
    const s: MercuryJobSplit = { job_id: jobId, amount }
    const n = o.note
    if (typeof n === 'string' && n.trim() !== '') s.note = n
    out.push(s)
  }
  return out
}
