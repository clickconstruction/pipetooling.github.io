/**
 * The statement gate's reads (v2.5022): this week's certifications for one GC, and its statement now
 * outside Collections, netted by the one payment rule. send-gc-statement-email has the gate build the
 * group; gc-statement-email-dispatch hands in the group it has just built. A failed read throws: a
 * statement never goes out on a gate that could not look.
 */
import { todayYmdInAppTz } from './appTimeZone.ts'
import { gcCertWeekStartYmd, gcStatementGate, type GcStatementCertIn, type GcStatementGateResult } from './gcStatementGate.ts'
import { applyPaymentRule, attachJobTotals, payloadJobIds, type GcStatementPayload, type GcStatementPayloadGroup, type GcStatementPayloadRow } from './gcStatementPayload.ts'

// deno-lint-ignore no-explicit-any
export async function readGcStatementGate(admin: any, gcId: string, opts: { rows?: readonly GcStatementPayloadRow[]; now?: Date } = {}): Promise<GcStatementGateResult> {
  const weekStart = gcCertWeekStartYmd(todayYmdInAppTz(opts.now))
  const { data: certs, error: certErr } = await admin
    .from('gc_review_certifications')
    .select('certified_at, total, snapshot')
    .eq('gc_customer_id', gcId)
    .eq('week_start', weekStart)
  if (certErr) throw new Error(`gc_review_certifications: ${certErr.message}`)
  const rows = opts.rows ?? (await liveRows(admin, gcId))
  return gcStatementGate(
    rows.filter((r) => !r.in_collections).map((r) => ({ jobId: r.job_id, remaining: r.remaining })),
    (certs ?? []) as GcStatementCertIn[],
  )
}

/** The GC's statement now, built as the dispatcher builds it: the payload, each job's total read beside it, the rule applied. */
// deno-lint-ignore no-explicit-any
async function liveRows(admin: any, gcId: string): Promise<GcStatementPayloadRow[]> {
  const { data, error } = await admin.rpc('get_gc_statement_email_payload', { p_group_by: 'gc', p_entity_id: gcId, p_include_collections: false })
  if (error) throw new Error(`payload rpc: ${error.message}`)
  const payload = data as GcStatementPayload | null
  if (!payload || !Array.isArray(payload.groups)) throw new Error('empty payload')
  const ids = payloadJobIds(payload)
  if (ids.length > 0) {
    const { data: totals, error: totalsErr } = await admin.from('jobs_ledger').select('id, revenue').in('id', ids)
    if (totalsErr) throw new Error(`jobs_ledger totals: ${totalsErr.message}`)
    attachJobTotals(payload, Object.fromEntries(((totals ?? []) as Array<{ id: string; revenue: number | null }>).map((j) => [j.id, j.revenue])))
  }
  applyPaymentRule(payload)
  return payload.groups.find((g) => g.entity_id === gcId)?.rows ?? []
}

/**
 * The whole report's holds (v2.5022, Punchlist's addition): every GC section of a by-GC payload against
 * that GC's checks of the week, in one read. The no-GC bucket (no `entity_id`) is never held. Keyed by the GC's id; a
 * failed read throws.
 */
// deno-lint-ignore no-explicit-any
export async function readGcStatementHolds(admin: any, groups: readonly GcStatementPayloadGroup[], opts: { now?: Date } = {}): Promise<Map<string, GcStatementGateResult>> {
  const out = new Map<string, GcStatementGateResult>()
  const ids = [...new Set(groups.flatMap((g) => (g.entity_id ? [g.entity_id] : [])))]
  if (ids.length === 0) return out
  const weekStart = gcCertWeekStartYmd(todayYmdInAppTz(opts.now))
  const { data, error } = await admin
    .from('gc_review_certifications')
    .select('gc_customer_id, certified_at, total, snapshot')
    .in('gc_customer_id', ids)
    .eq('week_start', weekStart)
  if (error) throw new Error(`gc_review_certifications: ${error.message}`)
  const certsByGc = new Map<string, GcStatementCertIn[]>()
  for (const c of (data ?? []) as Array<GcStatementCertIn & { gc_customer_id: string }>) {
    certsByGc.set(c.gc_customer_id, [...(certsByGc.get(c.gc_customer_id) ?? []), c])
  }
  for (const g of groups) {
    if (!g.entity_id) continue
    const live = g.rows.filter((r) => !r.in_collections).map((r) => ({ jobId: r.job_id, remaining: r.remaining }))
    out.set(g.entity_id, gcStatementGate(live, certsByGc.get(g.entity_id) ?? []))
  }
  return out
}
