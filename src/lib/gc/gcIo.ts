/**
 * GC mode, the real build, step 4: the one place the New project page talks to the database.
 * It loads what the window needs (the customer list, the scope book's store, every GC project
 * read back through `gcProjectFromRows`), sends the draft through `gc_create_project`, and saves
 * a line to the scope book. Nothing here decides anything: the kernels in `src/lib/gc/` do.
 */
import { supabase } from '../supabase'
import type { Json } from '../../types/database'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { extractContactInfo } from '../bids/bidContactInfo'
import { draftForRpc, type NewProjectDraft } from './newProjectDraft'
import { gcProjectFromRows, type GcProjectRows, type GcProjectView } from './projectRows'
import type { ScopeBookStore, ScopeExclusion } from './types'

/** A customer as the window's pickers list it: the name, what kind of customer, one way to reach them. */
export interface GcPickerCustomer {
  id: string
  name: string
  kind: string
  contact: string
}

/** The rows of a read, or the read's problem thrown in plain words. */
function taken<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data
}

const KIND_WORDS: Record<string, string> = {
  commercial: 'Commercial',
  residential: 'Residential',
  gc: 'General contractor',
  architect: 'Architect',
}

export async function loadGcPickerCustomers(): Promise<GcPickerCustomer[]> {
  const rows = taken(
    await supabase.from('customers').select('id, name, customer_type, contact_info').order('name'),
    'load the customer list',
  )
  return rows.map((c) => {
    const { phone, email } = extractContactInfo(c.contact_info)
    const type = (c.customer_type ?? '').trim().toLowerCase()
    return { id: c.id, name: c.name, kind: KIND_WORDS[type] ?? (type ? type[0]!.toUpperCase() + type.slice(1) : ''), contact: email || phone }
  })
}

function leavesOut(label: string | null, by: string | null): ScopeExclusion | undefined {
  return label && label.trim() !== '' ? { label, by: by ?? '' } : undefined
}

/** What the office changed in the scope book, from the four small tables. */
export async function loadScopeBookStore(): Promise<ScopeBookStore> {
  const [saved, edits, merges, sets] = await Promise.all([
    supabase.from('gc_scope_book_saved').select('*').order('saved_at'),
    supabase.from('gc_scope_book_edits').select('*').order('edited_at'),
    supabase.from('gc_scope_book_merges').select('*').order('merged_at'),
    supabase.from('gc_scope_sets').select('*').order('saved_at'),
  ])
  return {
    saved: taken(saved, 'load the scope book').map((r) => ({
      trade: r.trade,
      words: r.words,
      ...(r.spec ? { spec: r.spec } : {}),
      ...(leavesOut(r.leaves_out_label, r.leaves_out_by) ? { leavesOut: leavesOut(r.leaves_out_label, r.leaves_out_by) } : {}),
      savedOn: r.saved_at.slice(0, 10),
    })),
    edits: taken(edits, 'load the scope book').map((r) => ({
      trade: r.trade,
      words: r.words,
      to: {
        words: r.to_words,
        ...(r.clear_spec ? { spec: null } : r.to_spec ? { spec: r.to_spec } : {}),
        ...(r.clear_leaves_out ? { leavesOut: null } : leavesOut(r.to_leaves_out_label, r.to_leaves_out_by) ? { leavesOut: leavesOut(r.to_leaves_out_label, r.to_leaves_out_by) } : {}),
      },
    })),
    merges: taken(merges, 'load the scope book').map((r) => ({ trade: r.trade, from: r.from_words, into: r.into_words })),
    sets: taken(sets, 'load the scope book').map((r) => ({
      id: r.id,
      trade: r.trade,
      name: r.name,
      lines: r.lines,
      savedOn: r.saved_at.slice(0, 10),
      ...(r.from_project_id ? { fromProjectId: r.from_project_id } : {}),
    })),
  }
}

/** Every GC project's rows, read back as the kernels read them. Newest first. */
export async function loadGcProjects(): Promise<GcProjectView[]> {
  const gcRows = taken(await supabase.from('gc_projects').select('*').order('created_at', { ascending: false }), 'load the GC projects')
  if (gcRows.length === 0) return []
  const ids = gcRows.map((g) => g.project_id)
  const [projects, packages, sets] = await Promise.all([
    supabase.from('projects').select('id, name, address, customer_id, plans_link').in('id', ids),
    supabase.from('gc_trade_packages').select('*').in('project_id', ids).order('position'),
    supabase.from('gc_plan_sets').select('*').in('project_id', ids).order('rev'),
  ])
  const projectRows = taken(projects, 'load the GC projects')
  const packageRows = taken(packages, 'load the trades')
  const setRows = taken(sets, 'load the plan sets')
  const packageIds = packageRows.map((p) => p.id)
  const setIds = setRows.map((s) => s.id)
  const [items, exclusions, setItems] = await Promise.all([
    packageIds.length ? supabase.from('gc_scope_items').select('*').in('package_id', packageIds).order('position') : Promise.resolve({ data: [], error: null }),
    packageIds.length ? supabase.from('gc_scope_exclusions').select('*').in('package_id', packageIds).order('position') : Promise.resolve({ data: [], error: null }),
    setIds.length ? supabase.from('gc_plan_set_items').select('*').in('set_id', setIds).order('position') : Promise.resolve({ data: [], error: null }),
  ])
  const itemRows = taken(items, 'load the scope lines')
  const exclusionRows = taken(exclusions, 'load the exclusions')
  const setItemRows = taken(setItems, 'load the sheets')

  const out: GcProjectView[] = []
  for (const gc of gcRows) {
    const project = projectRows.find((p) => p.id === gc.project_id)
    if (!project) continue
    const mine = packageRows.filter((p) => p.project_id === gc.project_id)
    const mineIds = new Set(mine.map((p) => p.id))
    const mySets = setRows.filter((s) => s.project_id === gc.project_id)
    const mySetIds = new Set(mySets.map((s) => s.id))
    const rows: GcProjectRows = {
      project: { id: project.id, name: project.name, address: project.address, customer_id: project.customer_id, plans_link: project.plans_link },
      gc,
      packages: mine,
      scopeItems: itemRows.filter((i) => mineIds.has(i.package_id)),
      exclusions: exclusionRows.filter((x) => mineIds.has(x.package_id)),
      sets: mySets,
      setItems: setItemRows.filter((i) => mySetIds.has(i.set_id)),
    }
    out.push(gcProjectFromRows(rows))
  }
  return out
}

/** The press: the whole draft goes in as one, and the new project's id comes back. */
export async function createGcProject(draft: NewProjectDraft): Promise<string> {
  const id = taken(await supabase.rpc('gc_create_project', { draft: draftForRpc(draft) as Json }), 'make the project')
  return id
}

/** A line the office saves to the scope book by hand. */
export async function saveScopeBookLine(trade: string, words: string, spec?: string): Promise<void> {
  taken(await supabase.from('gc_scope_book_saved').insert({ trade, words, spec: spec ?? null }).select('id').single(), 'save the line to the scope book')
}
