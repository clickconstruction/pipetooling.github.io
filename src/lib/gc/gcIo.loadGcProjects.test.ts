/**
 * `loadGcProjects` (gcIo.ts) read through its own mapping, against a fake Supabase that answers each table's rows:
 * a question carries who asked from its portal and the companies its answer was emailed to (P3-b), so the questions
 * window's answered card says "Sent to …" on real data (v2.4959). The window's render test builds rows by hand and
 * could not see the loader drop them.
 */
import { describe, expect, it, vi } from 'vitest'

const TABLES: Record<string, unknown[]> = {
  gc_projects: [
    { project_id: 'p1', stage: 'bidding', bid_due: '2026-10-24', sq_ft: null, size_note: '', customer_role: 'owner', property_owner_customer_id: null, architect_customer_id: 'a1', project_manager_user_id: null, general_conditions: 0, contingency_pct: 0, fee_pct: 0, drive_folder_url: '', lost_on: null, created_at: '2026-10-08T00:00:00Z' },
  ],
  projects: [{ id: 'p1', name: 'GC test bidding project, delete me', address: '100 Test St', customer_id: 'c-owner', plans_link: null }],
  gc_trade_packages: [{ id: 'conc', project_id: 'p1', trade: 'Concrete', position: 0, budget: 50000, ours: false, own_bid_id: null }],
  gc_plan_sets: [],
  gc_plan_questions: [
    { id: 'q1', project_id: 'p1', package_id: 'conc', asked_by_name: 'GC test trade company, delete me', text: 'Is the site concrete 4,000 psi?', sheets: [], asked_on: '2026-10-08', sent_to_architect_on: null, answered_on: '2026-10-08', answer: 'Yes.', in_set_id: null, company_id: 'co-1', answer_sent_to: ['co-1', 'co-2'] },
    { id: 'q2', project_id: 'p1', package_id: 'conc', asked_by_name: '', text: 'Which mix?', sheets: null, asked_on: '2026-10-07', sent_to_architect_on: null, answered_on: null, answer: null, in_set_id: null },
  ],
  gc_scope_items: [],
  gc_scope_exclusions: [],
  gc_plan_set_items: [],
}

/** A query builder that ignores its filters and answers the table's rows: enough for the loader's own mapping. */
function table(name: string) {
  const result = { data: TABLES[name] ?? [], error: null }
  const builder: Record<string, unknown> = {}
  for (const verb of ['select', 'in', 'order', 'eq']) builder[verb] = () => builder
  builder.then = (resolve: (r: typeof result) => unknown) => Promise.resolve(result).then(resolve)
  return builder
}

vi.mock('../supabase', () => ({ supabase: { from: (name: string) => table(name) } }))

describe('loadGcProjects', () => {
  it('carries who asked from its portal and who has the answer by email into the questions window', async () => {
    const { loadGcProjects } = await import('./gcIo')
    const [project] = await loadGcProjects()
    const byId = Object.fromEntries((project?.questions ?? []).map((q) => [q.id, q]))
    expect(byId.q1).toMatchObject({ companyId: 'co-1', answerSentTo: ['co-1', 'co-2'], answer: 'Yes.' })
    expect(byId.q2).toMatchObject({ companyId: null, answerSentTo: [], answer: '', sheets: [] })
  })
})
