/**
 * The GC's view of a job's stages (v2.2933). Pure — tested from
 * src/lib/subs/gcStages.test.ts; the customer-portal function feeds it.
 *
 * Only what the office OFFERED shows, and only when the job shares stage
 * dates. A bundle (several windows, one bundle_id) is one entry with one
 * window. Never money, never paperwork, never a phone number — the GC sees
 * who, when, and how far along.
 */

export type GcStageWindowRow = { id: string; job_id: string; fixture_id: string; window_start: string | null; window_end: string | null; offered_to_gc: boolean; bundle_id: string | null }
export type GcStageFixtureRow = { id: string; name: string | null; sequence_order: number | null }
export type GcStageOrderRow = { id: string; stage_window_id: string | null; status: string; display_name: string; picked_start: string | null; picked_end: string | null; labor_job_id: string | null }
export type GcStageSheetRow = { id: string; stage: string | null; progress_pct: number | null }

export type GcStageState = 'window' | 'offered' | 'scheduled' | 'working' | 'inspection' | 'passed'

export type GcStageEntry = {
  /** The window id, or the bundle id for a bundle. */
  id: string
  bundle: boolean
  /** "Rough-in" or "Top-out + Trim & final". */
  name: string
  window: { start: string; end: string } | null
  /** The sub's first name only — never a phone. */
  who: string | null
  when: { start: string; end: string } | null
  pct: number | null
  state: GcStateForEntry
}
export type GcStateForEntry = GcStageState

const firstName = (s: string | null | undefined) => ((s ?? '').trim().split(/\s+/)[0] ?? '') || null

function stateOf(order: GcStageOrderRow | null, sheet: GcStageSheetRow | null, hasWindow: boolean): GcStageState {
  if (!order) return hasWindow ? 'window' : 'window'
  if (order.status === 'offered') return 'offered'
  const st = (sheet?.stage ?? 'working').trim()
  if (st === 'customer_pay') return 'passed'
  if (st === 'walkthrough') return 'inspection'
  if (sheet && sheet.progress_pct != null && sheet.progress_pct > 0) return 'working'
  return order.picked_start ? 'scheduled' : 'offered'
}

export function buildGcStageEntries(input: { windows: GcStageWindowRow[]; fixtures: GcStageFixtureRow[]; orders: GcStageOrderRow[]; sheets: GcStageSheetRow[] }): GcStageEntry[] {
  const fx = new Map(input.fixtures.map((f) => [f.id, f]))
  const orderByWindow = new Map<string, GcStageOrderRow>()
  for (const o of input.orders) {
    if (!o.stage_window_id || !['offered', 'accepted', 'approved', 'settled'].includes(o.status)) continue
    const prev = orderByWindow.get(o.stage_window_id)
    // a signed order beats an open offer
    if (!prev || (prev.status === 'offered' && o.status !== 'offered')) orderByWindow.set(o.stage_window_id, o)
  }
  const sheetById = new Map(input.sheets.map((s) => [s.id, s]))
  const offered = input.windows.filter((w) => w.offered_to_gc)
  const groups = new Map<string, GcStageWindowRow[]>()
  for (const w of offered) {
    const key = w.bundle_id ?? `w:${w.id}`
    groups.set(key, [...(groups.get(key) ?? []), w])
  }
  const entries: GcStageEntry[] = []
  for (const [key, ws] of groups) {
    ws.sort((a, b) => (fx.get(a.fixture_id)?.sequence_order ?? 0) - (fx.get(b.fixture_id)?.sequence_order ?? 0))
    const names = ws.map((w) => (fx.get(w.fixture_id)?.name ?? '').trim() || 'Stage')
    const first = ws[0]!
    const window = first.window_start && first.window_end ? { start: first.window_start, end: first.window_end } : null
    // the order on any window of the bundle (they share one)
    const order = ws.map((w) => orderByWindow.get(w.id) ?? null).find((o) => o) ?? null
    const sheet = order?.labor_job_id ? sheetById.get(order.labor_job_id) ?? null : null
    const when = order?.picked_start ? { start: order.picked_start, end: order.picked_end ?? order.picked_start } : null
    const state = stateOf(order, sheet, !!window)
    entries.push({
      id: ws.length > 1 ? key : first.id,
      bundle: ws.length > 1,
      name: names.join(' + '),
      window,
      who: order && order.status !== 'offered' ? firstName(order.display_name) : null,
      when: order && order.status !== 'offered' ? when : null,
      pct: sheet?.progress_pct ?? null,
      state,
    })
  }
  return entries.sort((a, b) => (a.window?.start ?? '9999').localeCompare(b.window?.start ?? '9999') || a.name.localeCompare(b.name))
}

/** The line the GC reads under a stage. */
export function gcStageLine(e: GcStageEntry): string {
  const span = (s: { start: string; end: string }) => (s.start === s.end ? s.start : `${s.start} – ${s.end}`)
  switch (e.state) {
    case 'passed':
      return `${e.who ? `${e.who} · ` : ''}passed inspection`
    case 'inspection':
      return `${e.who ? `${e.who} · ` : ''}done · inspection next`
    case 'working':
      return `${e.who ? `${e.who} · ` : ''}${e.when ? `${span(e.when)} · ` : ''}${e.pct ?? 0}% along`
    case 'scheduled':
      return `${e.who ? `${e.who} · ` : ''}${e.when ? span(e.when) : 'scheduled'}`
    case 'offered':
      return e.window ? `offered to a sub · between ${span(e.window)}` : 'offered to a sub'
    default:
      return e.window ? `planned between ${span(e.window)}` : 'planned'
  }
}
