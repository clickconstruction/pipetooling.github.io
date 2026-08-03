/**
 * Default ordering for the "Add job to schedule" picker: most recently created
 * job first. The shared hub jobs fetch orders by `hcp_number` DESCENDING AS
 * TEXT ("97" > "926"), which interleaves years-old jobs with this week's —
 * callers sort their picker rows with this instead. Jobs missing `created_at`
 * sink to the end; ties break on job number, numeric-aware, newest number first.
 */
export function compareJobsByCreatedAtDesc(
  a: { created_at?: string | null; hcp_number?: string | null },
  b: { created_at?: string | null; hcp_number?: string | null },
): number {
  const ta = Date.parse((a.created_at ?? '').trim())
  const tb = Date.parse((b.created_at ?? '').trim())
  const aOk = Number.isFinite(ta)
  const bOk = Number.isFinite(tb)
  if (aOk && bOk && ta !== tb) return tb - ta
  if (aOk !== bOk) return aOk ? -1 : 1
  return (b.hcp_number ?? '').trim().localeCompare((a.hcp_number ?? '').trim(), undefined, { numeric: true })
}
