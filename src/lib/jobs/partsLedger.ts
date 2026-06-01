/** Pure data-shaping kernels for the parts-ledger loader (usePartsLedgerData). */

/** Union of job_ids that carry tally parts or supply-house invoice allocations — the set we fetch invoice amounts for. */
export function collectInvoiceJobIds(
  parts: ReadonlyArray<{ job_id: string }>,
  allocations: ReadonlyArray<{ job_id: string }>,
): string[] {
  const ids = new Set<string>()
  for (const p of parts) ids.add(p.job_id)
  for (const a of allocations) ids.add(a.job_id)
  return [...ids]
}

/** Collapse RPC invoice-amount rows into a job_id → amount map, coercing nullish amounts to 0. */
export function buildInvoiceAmountMap(
  rows: ReadonlyArray<{ job_id: string; invoice_amount: number | null }>,
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const r of rows) map[r.job_id] = Number(r.invoice_amount ?? 0)
  return map
}
