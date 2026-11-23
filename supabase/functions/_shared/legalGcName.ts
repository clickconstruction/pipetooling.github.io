/**
 * A matter job's GC by name (punch list #85, a review residual). `legal-portal`
 * read customers for the matters' payers alone and looked each job's GC up
 * among them. A job whose GC is another customer found no row, and the packet
 * read the word *GC* where the name belongs (`payerForJob`,
 * `src/lib/legal/legalPacket.ts`). The function now reads the other GCs' names
 * apart, the name and nothing else, and this picks the name from either list.
 *
 * No imports, so the function and its test read one rule.
 */

type Row = Record<string, unknown>

function idOf(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

/** The jobs' GCs whose rows the payers' list does not hold: the ids to read, each once. */
export function gcIdsToRead(jobs: ReadonlyArray<Row>, payers: ReadonlyArray<Row>): string[] {
  const held = new Set(payers.map((c) => idOf(c.id)).filter((id): id is string => id != null))
  return [...new Set(jobs.map((j) => idOf(j.gc_customer_id)).filter((id): id is string => id != null && !held.has(id)))]
}

/**
 * The job's GC as the packet reads it: `{ id, name }`, the name from the payers' rows, else from the GCs read
 * apart, else null (a GC the read did not find, or one with no name). Null when the job has no GC.
 */
export function gcCustomerFor(job: Row, payers: ReadonlyArray<Row>, otherGcs: ReadonlyArray<Row>): { id: string; name: string | null } | null {
  const id = idOf(job.gc_customer_id)
  if (!id) return null
  const row = payers.find((c) => c.id === id) ?? otherGcs.find((c) => c.id === id)
  const name = typeof row?.name === 'string' ? row.name.trim() : ''
  return { id, name: name || null }
}
