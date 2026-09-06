/**
 * "Offer the next stage?" (v2.2933): when a sub's stage passes inspection
 * (the sheet moves to Post-inspection), the job's next stage window — by
 * line-item order — is either offered to the GC on its own (the job's
 * gc_auto_offer_next switch) or lands in the dispatch inbox as a question.
 * The choice is pure; the writes live beside it.
 */
import { supabase } from '../supabase'

export type NextStageCandidate = { id: string; fixture_id: string; offered_to_gc: boolean; sequence: number; name: string }

/** The first not-yet-offered window after the current one (by line-item order); null when none. */
export function nextStageToOffer(windows: NextStageCandidate[], currentWindowId: string | null): NextStageCandidate | null {
  const sorted = [...windows].sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name))
  const idx = currentWindowId ? sorted.findIndex((w) => w.id === currentWindowId) : -1
  return sorted.slice(idx + 1).find((w) => !w.offered_to_gc) ?? null
}

export type OfferNextOutcome = { kind: 'offered' | 'asked' | 'nothing'; stageName?: string; gcName?: string | null }

/**
 * After a sheet passes inspection: find its job and order, pick the next
 * stage, then offer it (auto) or ask the office (dispatch line). Best-effort.
 */
export async function offerNextStageAfterPass(args: { sheetId: string; authUserId: string | undefined }): Promise<OfferNextOutcome> {
  const { data: sheet } = await supabase.from('people_labor_jobs').select('id, job_number').eq('id', args.sheetId).maybeSingle()
  const jobNumber = ((sheet as { job_number?: string | null } | null)?.job_number ?? '').trim()
  if (!jobNumber) return { kind: 'nothing' }
  const { data: job } = await supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, gc_shares_stage_dates, gc_auto_offer_next, gc:customers!gc_customer_id(name)').eq('hcp_number', jobNumber).maybeSingle()
  const j = job as { id: string; hcp_number: string | null; job_name: string | null; job_address: string | null; gc_shares_stage_dates: boolean; gc_auto_offer_next: boolean; gc: { name: string | null } | { name: string | null }[] | null } | null
  if (!j || !j.gc_shares_stage_dates) return { kind: 'nothing' }
  const gc = Array.isArray(j.gc) ? j.gc[0] ?? null : j.gc
  const gcName = (gc?.name ?? '').trim() || null
  const [{ data: winRaw }, { data: orderRaw }] = await Promise.all([
    supabase.from('job_stage_windows').select('id, fixture_id, offered_to_gc, fixture:fixture_id(name, sequence_order)').eq('job_id', j.id),
    supabase.from('step_commitments').select('stage_window_id').eq('labor_job_id', args.sheetId).not('stage_window_id', 'is', null).limit(1).maybeSingle(),
  ])
  const windows: NextStageCandidate[] = ((winRaw ?? []) as Array<{ id: string; fixture_id: string; offered_to_gc: boolean; fixture: { name: string | null; sequence_order: number | null } | { name: string | null; sequence_order: number | null }[] | null }>).map((w) => {
    const f = Array.isArray(w.fixture) ? w.fixture[0] ?? null : w.fixture
    return { id: w.id, fixture_id: w.fixture_id, offered_to_gc: w.offered_to_gc, sequence: Number(f?.sequence_order) || 0, name: (f?.name ?? '').trim() || 'Stage' }
  })
  const next = nextStageToOffer(windows, (orderRaw as { stage_window_id?: string | null } | null)?.stage_window_id ?? null)
  if (!next) return { kind: 'nothing' }
  if (j.gc_auto_offer_next) {
    const { error } = await supabase.from('job_stage_windows').update({ offered_to_gc: true, offered_to_gc_at: new Date().toISOString() }).eq('id', next.id)
    if (error) return { kind: 'nothing' }
    return { kind: 'offered', stageName: next.name, gcName }
  }
  if (!args.authUserId) return { kind: 'nothing' }
  const label = `#${(j.hcp_number ?? '').trim()}${j.job_name ? ` · ${j.job_name}` : ''}`
  const { data: row } = await supabase
    .from('dispatch_requests')
    .insert({
      from_user_id: args.authUserId,
      title: `${label}: a stage passed — offer ${next.name} to ${gcName ?? 'the GC'}?`,
      links: [],
      job_ledger_id: j.id,
      bid_id: null,
      reference_summary: [label, j.job_address].filter(Boolean).join(' - ') || null,
      pending_action: 'offer_next_stage',
      pending_payload: { source: 'subs_tab', kind: 'offer_next_stage', jobId: j.id, stageWindowId: next.id, stageName: next.name, gcName },
    })
    .select('id')
    .single()
  if ((row as { id?: string } | null)?.id) void supabase.functions.invoke('notify-dispatch-request', { body: { dispatch_request_id: (row as { id: string }).id } })
  return { kind: 'asked', stageName: next.name, gcName }
}
