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
import type { ChangeOrderDraft, ChangeOrderRow } from './changeOrderRows'
import { gcProjectFromRows, type GcProjectRows, type GcProjectView } from './projectRows'
import type { DeclineReason, GcLostWhy, ScopeBookEdit, ScopeBookStore, ScopeExclusion } from './types'
import { scopeWordKey } from './scopeBook'
import type { OwnerBillingRows } from './ownerBillingRows'

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
/**
 * `money` (B5-c): the reader is on the money team (`canSeeGcMoney`), so our number's inputs are read.
 * Anyone else skips the read: the policy would return no row, and the screens show the trades alone.
 */
export async function loadGcBoardRows(projects: GcProjectView[], today: string, { money = false }: { money?: boolean } = {}): Promise<BoardRows> {
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
      .select('id, name, trades, contact_name, phone, email, address, max_miles, license, lang, vetting_status, vetting_limit, vetting_decided_on, vetting_decided_by, vetting_note, contact_gets')
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
  const waiting = companyRows.filter((c) => c.vetting_status === 'new').map((c) => c.id)
  const [quotes, contacts, moves, users, forms, people, moneyRows] = await Promise.all([
    inviteIds.length ? supabase.from('gc_quotes').select('*').in('invite_id', inviteIds) : none,
    supabase.from('gc_company_contacts').select('*'),
    promiseIds.length ? supabase.from('gc_trade_promise_moves').select('*').in('promise_id', promiseIds) : none,
    deciders.length ? supabase.from('users').select('id, name').in('id', deciders) : none,
    // The forms of the companies still waiting on our decision, for the queue on Trade partners.
    waiting.length ? supabase.from('gc_company_vetting_forms').select('*').in('company_id', waiting) : none,
    // Who else each company named, for the company window's Who gets our emails (B3-c).
    companyRows.length ? supabase.from('gc_company_people').select('id, company_id, name, email, role, gets').is('removed_at', null).order('created_at') : none,
    // Our number's inputs, for the money team only (B5-c).
    money && ids.length ? supabase.from('gc_project_money').select('project_id, general_conditions, contingency_pct, fee_pct').in('project_id', ids) : none,
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
    vettingForms: taken(forms, 'load the vetting forms'),
    people: taken(people, 'load the people each company named'),
    money: taken(moneyRows, 'load our number'),
    moneyShown: money,
  }
}

// ---------------------------------------------------------------------------------------------
// Owner Billing's O5a: our bills to the customer, as their rows hold them, for ownerBillingFromRows.
// ---------------------------------------------------------------------------------------------

/** Each project's billing rows (pay applications and their lines, reminders, interest bills, the acceptance), by project id. */
export async function loadGcOwnerBillingRows(projectIds: string[]): Promise<Map<string, OwnerBillingRows>> {
  const out = new Map<string, OwnerBillingRows>(projectIds.map((id) => [id, { payApps: [], lines: [], reminders: [], interestBills: [], acceptance: null }]))
  if (projectIds.length === 0) return out
  const [payApps, interestBills, acceptances] = await Promise.all([
    supabase.from('gc_owner_pay_apps').select('*').in('project_id', projectIds).order('number'),
    supabase.from('gc_owner_interest_bills').select('*').in('project_id', projectIds).order('number'),
    supabase.from('gc_owner_acceptances').select('*').in('project_id', projectIds),
  ])
  const appRows = taken(payApps, 'load the pay applications')
  const appIds = appRows.map((a) => a.id)
  const [lines, reminders] = await Promise.all([
    appIds.length ? supabase.from('gc_owner_pay_app_lines').select('*').in('pay_app_id', appIds).order('position') : Promise.resolve({ data: [], error: null }),
    appIds.length ? supabase.from('gc_owner_pay_reminders').select('*').in('pay_app_id', appIds).order('created_at') : Promise.resolve({ data: [], error: null }),
  ])
  const lineRows = taken(lines, 'load the pay application lines')
  const reminderRows = taken(reminders, 'load the reminders to pay')
  for (const app of appRows) {
    const rows = out.get(app.project_id)
    if (!rows) continue
    rows.payApps.push(app)
    rows.lines.push(...lineRows.filter((l) => l.pay_app_id === app.id))
    rows.reminders.push(...reminderRows.filter((r) => r.pay_app_id === app.id))
  }
  for (const bill of taken(interestBills, 'load the interest bills')) out.get(bill.project_id)?.interestBills.push(bill)
  for (const acceptance of taken(acceptances, 'load the acceptances')) {
    const rows = out.get(acceptance.project_id)
    if (rows) rows.acceptance = acceptance
  }
  return out
}

/** What Add a company sends (the Board's B3-b): `gc_add_company`'s draft. Not `known`: the company quotes, then waits for approval. */
export interface NewCompanyDraft {
  name: string
  trades: string[]
  contactName: string
  phone: string
  email: string
  address: string
  maxMiles: number | null
  known: boolean
}

/** Add a company: the row and its main contact in one press. The new company's id comes back. */
export async function addGcCompany(draft: NewCompanyDraft): Promise<string> {
  return taken(await supabase.rpc('gc_add_company', { company: draft as unknown as Json }), 'add the company')
}

/** Approve a company new to us, up to an amount on one award or with no limit, or decline it. The signed-in user is who decided. */
export async function vetGcCompany(companyId: string, status: 'approved' | 'declined', limit: number | null, note: string): Promise<void> {
  taken(await supabase.rpc('gc_vet_company', { p_company_id: companyId, p_status: status, ...(limit === null ? {} : { p_limit: limit }), p_note: note }), 'save the decision')
}

/** Where a company's crews drive from and how far they go. Empty miles: no limit. */
export async function setGcCompanyCoverage(companyId: string, address: string, maxMiles: number | null): Promise<void> {
  taken(await supabase.from('gc_companies').update({ address, max_miles: maxMiles }).eq('id', companyId).select('id').single(), 'save the address')
}

/** One line on an ask's story (the Board's B4-b): a call, a text or an email, with the day they promised the quote by. */
export async function logGcAskContact(line: { companyId: string; inviteId: string; on: string; byName: string; how: 'call' | 'text' | 'email'; note: string; promisedBy: string | null }): Promise<void> {
  taken(
    await supabase
      .from('gc_company_contacts')
      .insert({ company_id: line.companyId, invite_id: line.inviteId, contacted_on: line.on, by_name: line.byName, how: line.how, note: line.note, promised_by: line.promisedBy })
      .select('id')
      .single(),
    'log the contact',
  )
}

/** The office takes a company's no by phone: it will not or cannot do it, with the reason kept on the ask. */
export async function declineGcAsk(inviteId: string, why: 'wont' | 'cant', reason: DeclineReason, note: string): Promise<void> {
  taken(await supabase.rpc('gc_office_decline', { p_invite_id: inviteId, p_why: why, p_reason: reason, p_note: note }), 'take them off the ask')
}

/** The line each new ask carries until the Portal's emails are in (P3): the office's own note, not a contact with the company. */
export const ASK_NOT_SENT_NOTE = 'Asked to quote. The invitation email goes out once the portal can send it.'

/**
 * Ask companies to quote a trade (the Board's B4-a): `gc_invite_companies` records each ask, skipping a
 * company already asked, then each new ask gets a note that its email waits. Nothing is emailed yet.
 */
export async function askGcCompanies(packageId: string, companyIds: string[], byName: string, on: string): Promise<void> {
  const made = taken(await supabase.rpc('gc_invite_companies', { p_package_id: packageId, p_company_ids: companyIds }), 'ask the companies') ?? []
  if (made.length === 0) return
  const asks = taken(await supabase.from('gc_invites').select('id, company_id').in('id', made), 'read the new asks')
  taken(
    await supabase
      .from('gc_company_contacts')
      .insert(asks.map((a) => ({ company_id: a.company_id, invite_id: a.id, contacted_on: on, by_name: byName, how: 'note', note: ASK_NOT_SENT_NOTE })))
      .select('id'),
    'note that the emails wait',
  )
}

/** The company's language (the Board's B3-c): its portal opens in it and our emails to it go out in it. */
export async function setGcCompanyLanguage(companyId: string, lang: 'en' | 'es'): Promise<void> {
  taken(await supabase.from('gc_companies').update({ lang }).eq('id', companyId).select('id').single(), 'save the language')
}

/**
 * Compare quotes (the Board's B5-b): the office's own numbers on an ask, never the quote itself.
 * Each write sends the whole map or list as the screen holds it, so the ask's row is the screen's.
 */
export async function setGcAskPlugs(inviteId: string, plugs: Record<string, number>): Promise<void> {
  taken(await supabase.from('gc_invites').update({ plugs }).eq('id', inviteId).select('id').single(), 'save the cost to cover it')
}

export async function setGcAskExclusionCovers(inviteId: string, covers: Record<string, number>): Promise<void> {
  taken(await supabase.from('gc_invites').update({ exclusion_covers: covers }).eq('id', inviteId).select('id').single(), 'save the cost to cover it')
}

export async function setGcAskTakenAlternates(inviteId: string, taken_alternates: string[]): Promise<void> {
  taken(await supabase.from('gc_invites').update({ taken_alternates }).eq('id', inviteId).select('id').single(), 'save the alternate')
}

/** Carry a quote (its ask), our budget, or nothing as a trade's number. */
export async function carryGcTrade(packageId: string, carry: { inviteId: string } | 'budget' | null): Promise<void> {
  const row = carry === 'budget' ? { carried_invite_id: null, carry_budget: true } : { carried_invite_id: carry?.inviteId ?? null, carry_budget: false }
  taken(await supabase.from('gc_trade_packages').update(row).eq('id', packageId).select('id').single(), 'save what we carry')
}

// ---------------------------------------------------------------------------------------------
// Owner Billing's O3-ui: change orders to the customer (migration 20261008110000). The steps and the
// words are checked in the database's own functions; these only carry the press there.
// ---------------------------------------------------------------------------------------------

/** Every change order on these projects, as their rows hold them. */
export async function loadGcChangeOrders(projectIds: string[]): Promise<ChangeOrderRow[]> {
  if (projectIds.length === 0) return []
  return taken(await supabase.from('gc_change_orders').select('*').in('project_id', projectIds).order('number'), 'load the change orders')
}

/** A new change order, as a draft, with the next number on the project. */
export async function draftChangeOrder(projectId: string, draft: ChangeOrderDraft): Promise<string> {
  return taken(await supabase.rpc('gc_draft_change_order', { p_project_id: projectId, p_draft: draft as unknown as Json }), 'draft the change order')
}

/** A draft goes to the customer for their signature on a day. */
export async function sendChangeOrder(changeOrderId: string, on: string): Promise<void> {
  taken(await supabase.rpc('gc_send_change_order', { p_id: changeOrderId, p_on: on }), 'send the change order')
}

/** The customer's answer to a sent change order, as the office records it from their signed copy. */
export async function answerChangeOrder(changeOrderId: string, signed: boolean, on: string): Promise<void> {
  taken(await supabase.rpc('gc_answer_change_order', { p_id: changeOrderId, p_signed: signed, p_on: on, p_how: 'office' }), 'record their answer')
}

/** How much of a signed change order's work is done, for the customer's bill. */
export async function setChangeOrderPct(changeOrderId: string, pct: number): Promise<void> {
  taken(await supabase.from('gc_change_orders').update({ pct_done: pct }).eq('id', changeOrderId).select('id').single(), 'set the percent done')
}

/** A draft taken off: one that went to the customer stays (the database refuses it). */
export async function deleteChangeOrderDraft(changeOrderId: string): Promise<void> {
  taken(await supabase.from('gc_change_orders').delete().eq('id', changeOrderId).select('id').single(), 'delete the draft')
}

/** Our number's three inputs on a project (the Board's B5-c), for the money team: general conditions in dollars, contingency and fee in percent. */
export async function setGcProjectMoney(projectId: string, values: { generalConditions: number; contingencyPct: number; feePct: number }): Promise<void> {
  taken(
    await supabase
      .from('gc_project_money')
      .upsert({ project_id: projectId, general_conditions: values.generalConditions, contingency_pct: values.contingencyPct, fee_pct: values.feePct, updated_at: new Date().toISOString() }, { onConflict: 'project_id' })
      .select('project_id')
      .single(),
    'save our number',
  )
}

/** The project's outcome (the Board's B5-c): each stamps the company's day in the database. */
export async function markGcBidSent(projectId: string): Promise<void> {
  taken(await supabase.rpc('gc_mark_bid_sent', { p_project_id: projectId }), 'mark our bid sent')
}

export async function markGcWon(projectId: string): Promise<void> {
  taken(await supabase.rpc('gc_mark_won', { p_project_id: projectId }), 'mark it won')
}

export async function markGcLost(projectId: string, why: GcLostWhy, wonBy: string, note: string): Promise<void> {
  taken(await supabase.rpc('gc_mark_lost', { p_project_id: projectId, p_why: why, p_won_by: wonBy, p_note: note }), 'mark it lost')
}

export async function bringGcBack(projectId: string): Promise<void> {
  taken(await supabase.rpc('gc_bring_back', { p_project_id: projectId }), 'bring it back')
}
