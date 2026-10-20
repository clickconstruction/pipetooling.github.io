/**
 * The boards' one read (Messages cut 4, wave 2): `flow_rows_kind`, a definer for the office team over the doors an
 * assistant cannot open (the Portal's, the money's), so a client select per table would read short. Days and marks
 * only, never an amount. `boardRead.ts` turns its answer into the boards' companies.
 */
import { withSupabaseRetry } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import { pageOpensByCustomer, parseFlowRowsKind, type FlowRowsKindAnswer } from './boardRead'
import type { FlowKind } from './facts'
import { readFlowDef } from './flowPersonIo'
import { SEED_FLOWS } from './seed'
import type { FlowDef } from './state'

/**
 * Every contact of a kind with the rows its flow reads. With a project, only the people on that job, and with no kind
 * everyone on it (the job's Papers window). The definer refuses neither ('kindOrJob').
 */
export async function loadFlowRowsKind(kind: FlowKind | null, projectId: string | null = null): Promise<FlowRowsKindAnswer> {
  const data = await withSupabaseRetry<unknown>(() => supabase.rpc('flow_rows_kind' as never, { p_kind: kind, p_project: projectId } as never) as never, 'flow rows')
  return parseFlowRowsKind(data)
}

/** Each customer's last outside open of their page (`customer_portal_views`, helper 8's, office team only), for By company's Portal column. */
export async function loadCustomerPageOpens(customerIds: readonly string[]): Promise<Record<string, string>> {
  if (!customerIds.length) return {}
  const data = await withSupabaseRetry<unknown>(() => supabase.rpc('customer_portal_views' as never, { p_customer_ids: [...customerIds] } as never) as never, 'customer page opens')
  return pageOpensByCustomer(data)
}

const flowDefs = new Map<FlowKind, FlowDef>()

/**
 * The office's flow for a kind, kept per kind once read. The read is the person panel's (`flowPersonIo`'s
 * `readFlowDef`), so there is one copy. Its seed answer (`SEED_FLOWS`, for none kept yet or a failed read) is never
 * kept, so the next call reads again. Settings → Flows' Save calls `clearFlowDefCache` so every board reads the edit.
 */
export async function loadFlowDef(kind: FlowKind): Promise<FlowDef> {
  const kept = flowDefs.get(kind)
  if (kept) return kept
  const flow = await readFlowDef(kind)
  if (flow !== SEED_FLOWS[kind]) flowDefs.set(kind, flow)
  return flow
}

/** Forget a kind's flow, or every kind's, so the next read takes the office's latest edit. */
export function clearFlowDefCache(kind?: FlowKind): void {
  if (kind) flowDefs.delete(kind)
  else flowDefs.clear()
}
