/**
 * GC mode, the real build, step 4: the one place the New project page talks to the database.
 * It loads what the window needs (the customer list, the scope book's store, every GC project
 * read back through `gcProjectFromRows`), sends the draft through `gc_create_project`, and saves
 * a line to the scope book. Nothing here decides anything: the kernels in `src/lib/gc/` do.
 */
import { supabase } from '../supabase'
import type { Database, Json } from '../../types/database'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { extractContactInfo } from '../bids/bidContactInfo'
import { draftForRpc, type NewProjectDraft } from './newProjectDraft'
import { issueDraftForRpc, type IssuePlanSetDraft } from './planSetDraft'
import type { BoardRows } from './boardRows'
import { gcProjectFromRows, type GcProjectRows, type GcProjectView } from './projectRows'
import type { ScopeBookEdit, ScopeBookStore, ScopeExclusion } from './types'
import { scopeWordKey } from './scopeBook'

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
  const [projects, packages, sets, questions] = await Promise.all([
    supabase.from('projects').select('id, name, address, customer_id, plans_link').in('id', ids),
    supabase.from('gc_trade_packages').select('*').in('project_id', ids).order('position'),
    supabase.from('gc_plan_sets').select('*').in('project_id', ids).order('rev'),
    supabase.from('gc_plan_questions').select('*').in('project_id', ids).order('asked_on'),
  ])
  const projectRows = taken(projects, 'load the GC projects')
  const packageRows = taken(packages, 'load the trades')
  const setRows = taken(sets, 'load the plan sets')
  const questionRows = taken(questions, 'load the questions about the plans')
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
      questions: questionRows
        .filter((q) => q.project_id === gc.project_id)
        .map((q) => ({
          id: q.id,
          package_id: q.package_id,
          // The column lands with 20261007150000; a types file from before it reads it as absent.
          asked_by_name: (q as { asked_by_name?: string | null }).asked_by_name ?? '',
          text: q.text,
          sheets: q.sheets ?? [],
          asked_on: q.asked_on,
          sent_to_architect_on: q.sent_to_architect_on,
          answered_on: q.answered_on,
          answer: q.answer ?? '',
          in_set_id: q.in_set_id,
        })),
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

/** Someone on our team who can check a set: the office roles, by name. */
export interface GcTeamMember {
  id: string
  name: string
  role: string
}

const TEAM_ROLES: Database['public']['Tables']['users']['Row']['role'][] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'superintendent']

export async function loadGcTeam(): Promise<GcTeamMember[]> {
  const rows = taken(await supabase.from('users').select('id, name, role').in('role', TEAM_ROLES).order('name'), 'load our team')
  return rows.map((r) => ({ id: r.id, name: r.name ?? '', role: r.role ?? '' })).filter((r) => r.name !== '')
}

/** The press: a new set of plans on a project, in one write. The new set's id comes back. */
export async function issuePlanSet(draft: IssuePlanSetDraft): Promise<string> {
  const id = taken(await supabase.rpc('gc_issue_plan_set', { set_in: issueDraftForRpc(draft) as Json }), 'put the set on the project')
  return id
}

// --- Questions about the plans (step 8) ---

/** The office records a question a company asked by phone or email. The new question's id comes back. */
export async function recordQuestion(q: { projectId: string; packageId: string | null; askedByName: string; text: string; sheets: string[] }): Promise<string> {
  const id = taken(await supabase.rpc('gc_record_question', { q: q as unknown as Json }), 'record the question')
  return id
}

/** The architect's answer on a question not answered yet. */
export async function answerQuestion(questionId: string, answer: string): Promise<void> {
  taken(await supabase.rpc('gc_answer_question', { q: { questionId, answer } as Json }), 'record the answer')
}

/** The question goes to the architect by email through gc-plan-question-email; the send is recorded on it. */
export async function sendQuestionToArchitect(questionId: string): Promise<{ to: string }> {
  const r = (await supabase.functions.invoke('gc-plan-question-email', { body: { question_id: questionId } })) as FnResult
  const problem = await fnProblem(r, 'The question was not sent.')
  if (problem) throw new Error(problem)
  return { to: (r.data as { to: string }).to }
}

/** The question went to the architect some other way (by phone, in a meeting): the office marks it sent. */
export async function markQuestionSent(questionId: string, on: string): Promise<void> {
  taken(await supabase.from('gc_plan_questions').update({ sent_to_architect_on: on }).eq('id', questionId).select('id').single(), 'mark the question sent')
}

/** A line the office saves to the scope book by hand, with its section and what it leaves out. */
export async function saveScopeBookLine(trade: string, words: string, spec?: string, leavesOut?: ScopeExclusion): Promise<void> {
  taken(
    await supabase
      .from('gc_scope_book_saved')
      .insert({ trade, words, spec: spec ?? null, leaves_out_label: leavesOut?.label ?? null, leaves_out_by: leavesOut?.by ?? null })
      .select('id')
      .single(),
    'save the line to the scope book',
  )
}

/**
 * A change to a line of the book. One edit stands per line (the kernel follows the first it finds),
 * so an earlier edit of the same words goes before the new one is written.
 */
export async function editScopeBookLine(trade: string, words: string, to: ScopeBookEdit['to']): Promise<void> {
  const key = scopeWordKey(words)
  const earlier = taken(await supabase.from('gc_scope_book_edits').select('id, words').eq('trade', trade), 'change the scope book line')
  const stale = earlier.filter((e) => scopeWordKey(e.words) === key).map((e) => e.id)
  if (stale.length > 0) taken(await supabase.from('gc_scope_book_edits').delete().in('id', stale), 'change the scope book line')
  taken(
    await supabase
      .from('gc_scope_book_edits')
      .insert({
        trade,
        words,
        to_words: to.words,
        to_spec: to.spec ?? null,
        clear_spec: to.spec === null,
        to_leaves_out_label: to.leavesOut?.label ?? null,
        to_leaves_out_by: to.leavesOut?.by ?? null,
        clear_leaves_out: to.leavesOut === null,
      })
      .select('id')
      .single(),
    'change the scope book line',
  )
}

/** Two lines of one trade that say the same thing: `from` folds into `into`. */
export async function mergeScopeBookLines(trade: string, from: string, into: string): Promise<void> {
  taken(await supabase.from('gc_scope_book_merges').insert({ trade, from_words: from, into_words: into }).select('id').single(), 'fold the two lines together')
}

/** A named list of one trade's lines, saved to start another job from. */
export async function saveScopeSet(trade: string, name: string, lines: string[], fromProjectId?: string): Promise<void> {
  taken(await supabase.from('gc_scope_sets').insert({ trade, name, lines, from_project_id: fromProjectId ?? null }).select('id').single(), 'save the set')
}

// --- Google Drive, through the gc-drive-access edge function (step 5) ---

interface FnResult {
  data: unknown
  error: { message?: string; context?: { json?: () => Promise<unknown> } } | null
}

/** The function's own words for what went wrong, or the transport's. */
async function fnProblem(r: FnResult, fallback: string): Promise<string | null> {
  const data = r.data as { error?: string } | null
  if (data?.error) return data.error
  if (!r.error) return null
  const fromBody = await r.error.context?.json?.().catch(() => null)
  const words = (fromBody as { error?: string } | null)?.error
  return words || r.error.message || fallback
}

export interface DriveFolders {
  folderUrl: string
  plansUrl: string
  teamUrl: string
  /** Anyone with the link can open Plans. False with the reason Drive gave. */
  plansShared: boolean
  reason: string | null
}

/** The project's folder in the jobs Shared Drive, with Plans and Team only inside; Plans shared with anyone with the link. */
export async function makeDriveFolders(projectId: string): Promise<DriveFolders> {
  const r = (await supabase.functions.invoke('gc-drive-access', { body: { make_folders: { project_id: projectId } } })) as FnResult
  const problem = await fnProblem(r, 'The folders were not made.')
  if (problem) throw new Error(problem)
  const d = r.data as { folder_url: string; plans_url: string; team_url: string; plans_shared: boolean; reason: string | null }
  return { folderUrl: d.folder_url, plansUrl: d.plans_url, teamUrl: d.team_url, plansShared: d.plans_shared, reason: d.reason }
}

export interface DriveAccessVerdict {
  access: 'anyone' | 'restricted' | null
  seen: boolean
  note: string | null
  checkedOn: string
}

/** Who can open a set's Drive link, recorded on the set when its project and rev are given. */
export async function checkDriveAccess(url: string, at?: { projectId: string; rev: number }): Promise<DriveAccessVerdict> {
  const r = (await supabase.functions.invoke('gc-drive-access', {
    body: { check: { url, ...(at ? { project_id: at.projectId, rev: at.rev } : {}) } },
  })) as FnResult
  const problem = await fnProblem(r, 'The link was not checked.')
  if (problem) throw new Error(problem)
  const d = r.data as { access: 'anyone' | 'restricted' | null; seen: boolean; note: string | null; checked_on: string }
  return { access: d.access, seen: d.seen, note: d.note, checkedOn: d.checked_on }
}

/**
 * The Board's read (B3): the rows behind the Project Board on top of the projects already loaded,
 * the Board's dates on each project, the customers and architects they name, and the company record
 * (B1): the companies, their asks with the quotes and the call log, and the promises. The board's
 * mapper (`boardStateFromRows`) turns them into the kernels' shapes.
 */
export async function loadGcBoardRows(projects: GcProjectView[], today: string): Promise<BoardRows> {
  const ids = projects.map((p) => p.id)
  const packageIds = projects.flatMap((p) => p.trades.map((t) => t.id))
  const named = [...new Set(projects.flatMap((p) => [p.customerId, p.architectId]).filter((id): id is string => Boolean(id)))]
  const none = Promise.resolve({ data: [], error: null })
  const [dates, customers, companies, invites, promises] = await Promise.all([
    ids.length
      ? supabase.from('gc_projects').select('project_id, our_bid_sent_on, permit_on, start_date, owner_contract_sent_on, owner_contract_signed_on, started_on, lost_why, won_by').in('project_id', ids)
      : none,
    named.length ? supabase.from('customers').select('id, name').in('id', named) : none,
    supabase
      .from('gc_companies')
      .select('id, name, trades, contact_name, phone, email, address, max_miles, license, lang, vetting_status, vetting_limit, vetting_decided_on, vetting_decided_by, vetting_note')
      .order('name'),
    packageIds.length ? supabase.from('gc_invites').select('*').in('package_id', packageIds) : none,
    supabase.from('gc_trade_promises').select('*'),
  ])
  const dateRows = taken(dates, 'load the board’s dates')
  const inviteRows = taken(invites, 'load the asks')
  const promiseRows = taken(promises, 'load the promises')
  const companyRows = taken(companies, 'load the trade partners')
  const inviteIds = inviteRows.map((i) => i.id)
  const promiseIds = promiseRows.map((p) => p.id)
  const deciders = [...new Set(companyRows.map((c) => c.vetting_decided_by).filter((id): id is string => Boolean(id)))]
  const [quotes, contacts, moves, users] = await Promise.all([
    inviteIds.length ? supabase.from('gc_quotes').select('*').in('invite_id', inviteIds) : none,
    supabase.from('gc_company_contacts').select('*'),
    promiseIds.length ? supabase.from('gc_trade_promise_moves').select('*').in('promise_id', promiseIds) : none,
    deciders.length ? supabase.from('users').select('id, name').in('id', deciders) : none,
  ])
  return {
    today,
    projects,
    boardDates: Object.fromEntries(dateRows.map((d) => [d.project_id, d])),
    customers: taken(customers, 'load the customers'),
    companies: companyRows,
    invites: inviteRows as BoardRows['invites'],
    quotes: taken(quotes, 'load the quotes') as BoardRows['quotes'],
    contacts: taken(contacts, 'load the call log'),
    promises: promiseRows,
    promiseMoves: taken(moves, 'load the promises’ earlier days'),
    userNames: Object.fromEntries(taken(users, 'load our team').map((u) => [u.id, u.name ?? ''])),
  }
}
