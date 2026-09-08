/**
 * "Offer the next stage?" (v2.2933; Stage Plan PR 4): when a sub's stage
 * passes inspection (the sheet moves to Post-inspection), the job's next
 * Order stage — by line-item order — is either shown to the GC on its own
 * (the job's gc_auto_offer_next switch flips the line item's eye) or lands in
 * the dispatch inbox as a question. The choice is pure; the writes live
 * beside it.
 */
import { supabase } from '../supabase'
import type { StageKind } from '../jobs/stagePlan'

export type NextStageCandidate = {
  /** The line item (jobs_ledger_fixtures.id). */
  id: string
  name: string
  sequence: number
  kind: StageKind | null
  /** The eye: already on the GC portal. */
  shared: boolean
  /** The stage window on this line item, when one exists. */
  windowId: string | null
}

/** The first not-yet-shared Order row after the current one (by line-item order); null when none. */
export function nextStageToShare(fixtures: NextStageCandidate[], currentFixtureId: string | null): NextStageCandidate | null {
  const orders = fixtures.filter((f) => f.kind === 'order').sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name))
  const idx = currentFixtureId ? orders.findIndex((f) => f.id === currentFixtureId) : -1
  return orders.slice(idx + 1).find((f) => !f.shared) ?? null
}

export type OfferNextOutcome = { kind: 'offered' | 'asked' | 'nothing'; stageName?: string; gcName?: string | null }

type JobLite = { id: string; hcp_number: string | null; job_name: string | null; job_address: string | null; gc_shares_stage_dates: boolean; gc_auto_offer_next: boolean; gc: { name: string | null } | { name: string | null }[] | null }
const JOB_SELECT = 'id, hcp_number, job_name, job_address, gc_shares_stage_dates, gc_auto_offer_next, gc:customers!gc_customer_id(name)'

/**
 * After a sheet passes inspection: find its job and order, pick the next
 * Order stage, then show it (auto) or ask the office (dispatch line). Best-effort.
 */
export async function offerNextStageAfterPass(args: { sheetId: string; authUserId: string | undefined }): Promise<OfferNextOutcome> {
  const { data: sheet } = await supabase.from('people_labor_jobs').select('id, job_number, job_ledger_id').eq('id', args.sheetId).maybeSingle()
  const s = sheet as { job_number?: string | null; job_ledger_id?: string | null } | null
  // The sheet→job link first (v2.3065); the typed number only for a sheet with no link.
  let job: JobLite | null = null
  if (s?.job_ledger_id) {
    const { data } = await supabase.from('jobs_ledger').select(JOB_SELECT).eq('id', s.job_ledger_id).maybeSingle()
    job = (data as JobLite | null) ?? null
  } else if ((s?.job_number ?? '').trim()) {
    const { data } = await supabase.from('jobs_ledger').select(JOB_SELECT).eq('hcp_number', (s!.job_number ?? '').trim()).maybeSingle()
    job = (data as JobLite | null) ?? null
  }
  if (!job || !job.gc_shares_stage_dates) return { kind: 'nothing' }
  const gc = Array.isArray(job.gc) ? job.gc[0] ?? null : job.gc
  const gcName = (gc?.name ?? '').trim() || null
  const [{ data: fxRaw }, { data: winRaw }, { data: orderRaw }] = await Promise.all([
    supabase.from('jobs_ledger_fixtures').select('id, name, sequence_order, stage_kind, shared_with_gc').eq('job_id', job.id),
    supabase.from('job_stage_windows').select('id, fixture_id').eq('job_id', job.id),
    supabase.from('step_commitments').select('stage_window_id').eq('labor_job_id', args.sheetId).not('stage_window_id', 'is', null).limit(1).maybeSingle(),
  ])
  const windows = (winRaw ?? []) as Array<{ id: string; fixture_id: string }>
  const windowByFixture = new Map(windows.map((w) => [w.fixture_id, w.id]))
  const fixtures: NextStageCandidate[] = ((fxRaw ?? []) as Array<{ id: string; name: string | null; sequence_order: number | null; stage_kind: string | null; shared_with_gc: boolean | null }>).map((f) => ({
    id: f.id,
    name: (f.name ?? '').trim() || 'Stage',
    sequence: Number(f.sequence_order) || 0,
    kind: f.stage_kind === 'order' || f.stage_kind === 'any' ? f.stage_kind : null,
    shared: f.shared_with_gc === true,
    windowId: windowByFixture.get(f.id) ?? null,
  }))
  const currentWindowId = (orderRaw as { stage_window_id?: string | null } | null)?.stage_window_id ?? null
  const currentFixtureId = currentWindowId ? (windows.find((w) => w.id === currentWindowId)?.fixture_id ?? null) : null
  const next = nextStageToShare(fixtures, currentFixtureId)
  if (!next) return { kind: 'nothing' }
  if (job.gc_auto_offer_next) {
    const { error } = await supabase.from('jobs_ledger_fixtures').update({ shared_with_gc: true }).eq('id', next.id)
    if (error) return { kind: 'nothing' }
    // Until the portal reads the eye (PR 5), keep the window's offered flag in step.
    if (next.windowId) await supabase.from('job_stage_windows').update({ offered_to_gc: true, offered_to_gc_at: new Date().toISOString() }).eq('id', next.windowId)
    return { kind: 'offered', stageName: next.name, gcName }
  }
  if (!args.authUserId) return { kind: 'nothing' }
  const label = `#${(job.hcp_number ?? '').trim()}${job.job_name ? ` · ${job.job_name}` : ''}`
  const { data: row } = await supabase
    .from('dispatch_requests')
    .insert({
      from_user_id: args.authUserId,
      title: `${label}: a stage passed — show ${next.name} to ${gcName ?? 'the GC'}?`,
      links: [],
      job_ledger_id: job.id,
      bid_id: null,
      reference_summary: [label, job.job_address].filter(Boolean).join(' - ') || null,
      pending_action: 'offer_next_stage',
      pending_payload: { source: 'subs_tab', kind: 'offer_next_stage', jobId: job.id, fixtureId: next.id, stageWindowId: next.windowId, stageName: next.name, gcName },
    })
    .select('id')
    .single()
  if ((row as { id?: string } | null)?.id) void supabase.functions.invoke('notify-dispatch-request', { body: { dispatch_request_id: (row as { id: string }).id } })
  return { kind: 'asked', stageName: next.name, gcName }
}
