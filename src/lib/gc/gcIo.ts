/**
 * GC mode, the real build, step 4: the one place the New project page talks to the database.
 * It loads what the window needs (the customer list, the scope book's store, every GC project
 * read back through `gcProjectFromRows`), sends the draft through `gc_create_project`, and saves
 * a line to the scope book. Nothing here decides anything: the kernels in `src/lib/gc/` do.
 */
import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import { jobNumberLabel } from '../jobs/jobSummaryCycle'
import type { Database, Json } from '../../types/database'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { extractContactInfo } from '../bids/bidContactInfo'
import { draftForRpc, type NewProjectDraft } from './newProjectDraft'
import { issueDraftForRpc, type IssuePlanSetDraft } from './planSetDraft'
import { inviteAsks, type AskOutcome, type NewAsk } from './askEmail'
import type { BoardRows } from './boardRows'
import type { TradeEmailAnswer } from './tradeEmail'
import type { ChangeOrderDraft, ChangeOrderRow, ChangeRequestDraft, ChangeRequestRow } from './changeOrderRows'
import { gcProjectFromRows, questionRowOf, type GcProjectRows, type GcProjectView } from './projectRows'
import type { DeclineReason, GcLostWhy, OwnerRetainageStep, ScopeBookEdit, ScopeBookStore, ScopeExclusion, TradeChangeRequest } from './types'
import { scopeWordKey } from './scopeBook'
import type { OwnerBillingRows } from './ownerBillingRows'
import { gcCustomerEmailCopyKinds } from '../../../supabase/functions/_shared/gcCustomerEmails'
import type { BillingRows, ContractLineRow, OwnerTermsRow, PayAppSend } from './billCustomer'
import { parsePaySpeedsRpc } from '../jobs/billedExpectedPay'
import { paymentRefusalWords } from './moneyIn'
import { changeAskEmail, changeAskEmailKey, gcTradeEmailRefusal, tradeMailLang, type ChangeAskEmailStage } from './tradeEmail'
import type { MoneyMondayRequestRow } from './moneyMondayEmail'
import { sendGcTradeEmail } from './tradeEmailIo'
import {
  setEmailKey,
  setEmailWords,
  setSendRows,
  type SetEmailCompany,
  type SetEmailInvite,
  type SetEmailRecipient,
  type SetEmailResult,
} from './setEmail'

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
      questions: questionRows.filter((q) => q.project_id === gc.project_id).map(questionRowOf),
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

// --- The set email (step 7) ---

/**
 * Who was asked on the project's trades, and each company's name and language: the Board's
 * `gc_invites` and `gc_companies` (B1). Their policies are dev only until door 2, so for anyone
 * else this reads nobody and no email goes out.
 */
export async function loadSetEmailParties(packageIds: string[]): Promise<{ invites: SetEmailInvite[]; companies: SetEmailCompany[] }> {
  if (packageIds.length === 0) return { invites: [], companies: [] }
  const invites = taken(await supabase.from('gc_invites').select('id, package_id, company_id, status').in('package_id', packageIds), 'load who was asked') ?? []
  const ids = [...new Set(invites.map((i) => i.company_id))]
  const companies = ids.length > 0 ? (taken(await supabase.from('gc_companies').select('id, name, lang').in('id', ids), 'load the companies') ?? []) : []
  return {
    invites: invites.map((i) => ({ id: i.id, packageId: i.package_id, companyId: i.company_id, status: i.status as SetEmailInvite['status'] })),
    companies: companies.map((c) => ({ id: c.id, name: c.name, lang: c.lang === 'es' ? 'es' : 'en' })),
  }
}

/**
 * Email a set to each company, all at once, through the Portal lane's `gc-trade-email` (kind
 * `plans`, one company a call, the same key for every company so a retry sends nothing twice),
 * then record each one that went in `gc_plan_set_sends`. A company with no email on file is
 * skipped, and a failed send is reported, never thrown: the set is already on the project.
 */
export async function sendSetEmails(input: {
  setId: string
  projectId: string
  set: { label: string; project: string; note: string; sheets: string[]; quoteDueOn?: string | null }
  recipients: SetEmailRecipient[]
}): Promise<SetEmailResult[]> {
  const setRow = taken(await supabase.from('gc_plan_sets').select('rev').eq('id', input.setId).single(), 'read the set') as { rev: number }
  const key = setEmailKey(input.projectId, setRow.rev)
  const results = await Promise.all(
    input.recipients.map(async (r): Promise<SetEmailResult> => {
      const lang = tradeMailLang(r.lang)
      const words = setEmailWords(lang, input.set, r)
      const answer = await sendGcTradeEmail({ companyId: r.companyId, kind: 'plans', key, projectId: input.projectId, lang, subject: words.subject, lines: words.lines })
      if (!answer.ok) {
        // Nobody at the company has an email for it: skipped, as the sender's own refusal says (call them).
        if (answer.key === 'noEmail') return { companyId: r.companyId, outcome: 'no email' }
        return { companyId: r.companyId, outcome: 'failed', error: gcTradeEmailRefusal(answer.key) }
      }
      return { companyId: r.companyId, outcome: 'sent', messageId: answer.messageId, emailSendLogId: answer.emailSendLogId, to: answer.to, already: answer.already }
    }),
  )
  const rows = setSendRows(input.setId, input.recipients, results)
  if (rows.length > 0) taken(await supabase.from('gc_plan_set_sends').upsert(rows, { onConflict: 'set_id,company_id' }).select('id'), 'record who got the set')
  return results
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

/**
 * The companies an answer was emailed to (P3-b): added to the question's `answer_sent_to`, each once, so their
 * portals show it. The office team writes the row under its policy, as it marks a question sent.
 */
export async function addAnswerSentTo(questionId: string, companyIds: string[]): Promise<void> {
  if (companyIds.length === 0) return
  const row = taken(await supabase.from('gc_plan_questions').select('answer_sent_to').eq('id', questionId).single(), 'read who has the answer') as { answer_sent_to: string[] | null } | null
  const next = [...new Set([...(row?.answer_sent_to ?? []), ...companyIds])]
  taken(await supabase.from('gc_plan_questions').update({ answer_sent_to: next }).eq('id', questionId).select('id').single(), 'record who has the answer')
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

export interface FnResult {
  data: unknown
  error: { message?: string; context?: { json?: () => Promise<unknown> } } | null
}

/** The function's own words for what went wrong, or the transport's. */
export async function fnProblem(r: FnResult, fallback: string): Promise<string | null> {
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
 * The five reads on no job's ids (the companies, the promises, the companies' papers, the papers sent and the call log)
 * page past PostgREST's 1,000-row cap (B2b-ii-b, as the Takeoff parts catalog taught in v2.2755), each in a stable order.
 */
export async function loadGcBoardRows(projects: GcProjectView[], today: string, { money = false }: { money?: boolean } = {}): Promise<BoardRows> {
  const ids = projects.map((p) => p.id)
  const packageIds = projects.flatMap((p) => p.trades.map((t) => t.id))
  const named = [...new Set(projects.flatMap((p) => [p.customerId, p.architectId]).filter((id): id is string => Boolean(id)))]
  const none = Promise.resolve({ data: [], error: null })
  const [dates, customers, companies, invites, promises, sows, papers, paperSends] = await Promise.all([
    ids.length
      ? supabase.from('gc_projects').select('project_id, our_bid_sent_on, permit_on, start_date, owner_contract_sent_on, owner_contract_signed_on, started_on, started_anyway_by, started_anyway_reason, started_anyway_missing, lost_why, won_by, closed_on').in('project_id', ids)
      : none,
    named.length ? supabase.from('customers').select('id, name, contact_info').in('id', named) : none,
    fetchAllRows(
      (from, to) =>
        supabase
          .from('gc_companies')
          .select('id, name, trades, contact_name, phone, email, address, max_miles, license, lang, vetting_status, vetting_limit, vetting_decided_on, vetting_decided_by, vetting_note, contact_gets')
          .order('name')
          .order('id')
          .range(from, to),
      'load the trade partners',
    ),
    packageIds.length ? supabase.from('gc_invites').select('*').in('package_id', packageIds) : none,
    fetchAllRows((from, to) => supabase.from('gc_trade_promises').select('*').order('created_at').order('id').range(from, to), 'load the promises'),
    // The statements of work (B6-a): a dev's and, since O9, the money team's to read, so anyone else reads none.
    packageIds.length
      ? supabase
          .from('gc_sows')
          .select('id, package_id, status, price, retainage_pct, based_on_rev, their_sov, excluded, sent_on, signed_on, accepted_on')
          .in('package_id', packageIds)
      : none,
    // The companies' own papers (B6-b-ii), as their states only (`gc_company_paper_states`, v2.5179): a company's agreement,
    // W-9 and certificate rows, the eight columns `companyPapers` reads, for the whole office team. The table's own policies
    // read for the pay roles only, so an estimator's board showed every paper missing (call R). Paged in the function's order.
    fetchAllRows((from, to) => supabase.rpc('gc_company_paper_states', {}).range(from, to), 'load the trade partners’ papers'),
    // Every send of a paper (B6-b-i): dev only while the Board is built, so anyone else reads none.
    fetchAllRows(
      (from, to) =>
        supabase
          .from('gc_paper_sends')
          .select('id, company_id, paper, project_id, package_id, sent_on, due_on, note, first, draws, created_at')
          .order('sent_on')
          .order('created_at')
          .order('id')
          .range(from, to),
      'load the papers we sent',
    ),
  ])
  const dateRows = taken(dates, 'load the board’s dates')
  const inviteRows = taken(invites, 'load the asks')
  const promiseRows = promises
  const companyRows = companies
  const sowRows = taken(sows, 'load the statements of work')
  const inviteIds = inviteRows.map((i) => i.id)
  const promiseIds = promiseRows.map((p) => p.id)
  const deciders = [
    ...new Set(
      [...companyRows.map((c) => c.vetting_decided_by), ...projects.flatMap((p) => p.trades.map((t) => t.awardedBy)), ...dateRows.map((d) => d.started_anyway_by)].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ]
  const waiting = companyRows.filter((c) => c.vetting_status === 'new').map((c) => c.id)
  const sowIds = sowRows.map((s) => s.id)
  // Our own trades' Trades mode bids (B6-c-ii, call C): each one's number, under bids' own policies.
  const ownBidIds = [...new Set(projects.flatMap((p) => p.trades.filter((t) => t.ours && t.ownBidId).map((t) => t.ownBidId as string)))]
  const [quotes, contacts, moves, users, forms, people, moneyRows, tabs, tabViews, sowLines, ownBids, contractSends] = await Promise.all([
    inviteIds.length ? supabase.from('gc_quotes').select('*').in('invite_id', inviteIds) : none,
    fetchAllRows((from, to) => supabase.from('gc_company_contacts').select('*').order('created_at').order('id').range(from, to), 'load the call log'),
    promiseIds.length ? supabase.from('gc_trade_promise_moves').select('*').in('promise_id', promiseIds) : none,
    deciders.length ? supabase.from('users').select('id, name').in('id', deciders) : none,
    // The forms of the companies still waiting on our decision, for the queue on Trade partners.
    waiting.length ? supabase.from('gc_company_vetting_forms').select('*').in('company_id', waiting) : none,
    // Who else each company named, for the company window's Who gets our emails (B3-c).
    companyRows.length ? supabase.from('gc_company_people').select('id, company_id, name, email, role, gets').is('removed_at', null).order('created_at') : none,
    // Our number's inputs, for the money team only (B5-c).
    money && ids.length ? supabase.from('gc_project_money').select('project_id, general_conditions, contingency_pct, fee_pct, general_conditions_job_id').in('project_id', ids) : none,
    // The bid tabs shared, and who opened each (B5-d).
    packageIds.length ? supabase.from('gc_bid_tabs').select('package_id, shared_on, show_names').in('package_id', packageIds) : none,
    packageIds.length ? supabase.from('gc_bid_tab_views').select('package_id, company_id, seen_on').in('package_id', packageIds) : none,
    // Each statement of work's lines (B6-a).
    sowIds.length ? supabase.from('gc_sow_lines').select('id, sow_id, position, label, amount, scope_item_id, change_order_id').in('sow_id', sowIds) : none,
    ownBidIds.length ? supabase.from('bids').select('id, bid_value, bid_number').in('id', ownBidIds) : none,
    // Our contract's sends to the customer (B6-d-i): a dev's until award's door, then the money team's, so read for them.
    money && ids.length
      ? supabase
          .from('gc_owner_contract_sends')
          .select('id, project_id, customer_id, first, sent_on, sign_by, note, worth, file_path, file_name, file_sha256, signed_on, signer_printed_name, created_at')
          .in('project_id', ids)
          .order('created_at')
      : none,
  ])
  // Which of our contract's sends were emailed (B6-d-iii-b): each email's sent copy, under the sent copies' own policy.
  const contractSendRows = taken(contractSends, 'load our contract’s sends')
  const contractEmails = contractSendRows.length
    ? taken(
        await supabase.from('sent_documents').select('source_id, sent_at, recipient_name').eq('source_table', 'gc_owner_contract_sends').in('source_id', contractSendRows.map((s) => s.id)),
        'load our contract’s emails',
      ).map((e) => ({ source_id: e.source_id, sent_on: calendarYmdInAppTzFromIso(e.sent_at), recipient_name: e.recipient_name }))
    : []
  return {
    today,
    projects,
    boardDates: Object.fromEntries(dateRows.map((d) => [d.project_id, d])),
    customers: taken(customers, 'load the customers'),
    companies: companyRows,
    invites: inviteRows as BoardRows['invites'],
    quotes: taken(quotes, 'load the quotes') as BoardRows['quotes'],
    contacts,
    promises: promiseRows,
    promiseMoves: taken(moves, 'load the promises’ earlier days'),
    userNames: Object.fromEntries(taken(users, 'load our team').map((u) => [u.id, u.name ?? ''])),
    vettingForms: taken(forms, 'load the vetting forms'),
    people: taken(people, 'load the people each company named'),
    money: taken(moneyRows, 'load our number'),
    moneyShown: money,
    bidTabs: taken(tabs, 'load the bid tabs'),
    bidTabViews: taken(tabViews, 'load who opened the bid tabs'),
    sows: sowRows as BoardRows['sows'],
    sowLines: taken(sowLines, 'load the statements of work’s lines') as BoardRows['sowLines'],
    ownBids: taken(ownBids, 'load our own trades’ bids'),
    papers,
    paperSends,
    ownerContractSends: contractSendRows,
    ownerContractEmails: contractEmails,
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
  const interestRows = taken(interestBills, 'load the interest bills')
  const interestIds = interestRows.map((b) => b.id)
  const [lines, reminders, emails, interestEmails, notices] = await Promise.all([
    appIds.length ? supabase.from('gc_owner_pay_app_lines').select('*').in('pay_app_id', appIds).order('position') : Promise.resolve({ data: [], error: null }),
    appIds.length ? supabase.from('gc_owner_pay_reminders').select('*').in('pay_app_id', appIds).order('created_at') : Promise.resolve({ data: [], error: null }),
    // Our emails about each pay application, from their sent copies (O4b: the copies are the record of what went): the
    // application's own and the certified bill's, each by its kind, so a print filed against it is never read as one.
    appIds.length
      ? supabase
          .from('sent_documents')
          .select('source_id, kind, recipient_name, sent_at')
          .eq('source_table', 'gc_owner_pay_apps')
          .in('kind', gcCustomerEmailCopyKinds('gc_owner_pay_apps'))
          .eq('how', 'email')
          .in('source_id', appIds)
          .order('sent_at')
      : Promise.resolve({ data: [], error: null }),
    // And about each interest bill (O6b-2), the same way.
    interestIds.length
      ? supabase
          .from('sent_documents')
          .select('source_id, recipient_name, sent_at')
          .eq('source_table', 'gc_owner_interest_bills')
          .in('kind', gcCustomerEmailCopyKinds('gc_owner_interest_bills'))
          .eq('how', 'email')
          .in('source_id', interestIds)
          .order('sent_at')
      : Promise.resolve({ data: [], error: null }),
    // The architect's reminders and the customer's notice the app sent (O10, O12), so a sent bill says when.
    appIds.length
      ? supabase.from('gc_office_notices').select('pay_app_id, kind, created_at, due_on').in('kind', ['certify_reminder', 'pay_soon']).in('pay_app_id', appIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  const lineRows = taken(lines, 'load the pay application lines')
  const reminderRows = taken(reminders, 'load the reminders to pay')
  const emailRows = (taken(emails, 'load the emails about the pay applications') ?? []) as { source_id: string | null; kind: string; recipient_name: string | null; sent_at: string }[]
  const noticeRows = (taken(notices, 'load the architect’s reminders') ?? []) as { pay_app_id: string | null; kind: string; created_at: string; due_on: string | null }[]
  for (const app of appRows) {
    const rows = out.get(app.project_id)
    if (!rows) continue
    rows.payApps.push(app)
    rows.lines.push(...lineRows.filter((l) => l.pay_app_id === app.id))
    rows.reminders.push(...reminderRows.filter((r) => r.pay_app_id === app.id))
    const sentAbout = emailRows.filter((e) => e.source_id === app.id).map((e) => ({ source_id: app.id, kind: e.kind, recipient_name: e.recipient_name, sent_at: e.sent_at }))
    if (sentAbout.length > 0) rows.emails = [...(rows.emails ?? []), ...sentAbout]
    const reminded = noticeRows.filter((n) => n.pay_app_id === app.id)
    if (reminded.length > 0) rows.notices = [...(rows.notices ?? []), ...reminded]
  }
  const interestEmailRows = (taken(interestEmails, 'load the emails about the interest bills') ?? []) as { source_id: string | null; recipient_name: string | null; sent_at: string }[]
  for (const bill of interestRows) {
    const rows = out.get(bill.project_id)
    if (!rows) continue
    rows.interestBills.push(bill)
    const sentAbout = interestEmailRows.filter((e) => e.source_id === bill.id).map((e) => ({ source_id: bill.id, recipient_name: e.recipient_name, sent_at: e.sent_at }))
    if (sentAbout.length > 0) rows.interestEmails = [...(rows.interestEmails ?? []), ...sentAbout]
  }
  for (const acceptance of taken(acceptances, 'load the acceptances')) {
    const rows = out.get(acceptance.project_id)
    if (rows) rows.acceptance = acceptance
  }
  await loadGcBillingJobMoney(out)
  return out
}

/**
 * Money in on each project's billing job (O5c), from the Pipeline's own records: its bills, every payment on it,
 * the customer's live promises (`list_job_payment_promises`, the Pipeline's reader) and our waivers. Read, never
 * copied: a payment made anywhere in the app shows here.
 */
async function loadGcBillingJobMoney(out: Map<string, OwnerBillingRows>): Promise<void> {
  const projectIds = [...out.keys()]
  const jobsOf = taken(await supabase.from('gc_projects').select('project_id, billing_job_id').in('project_id', projectIds), 'load the billing jobs')
  const jobByProject = new Map(jobsOf.filter((r) => r.billing_job_id !== null).map((r) => [r.project_id, r.billing_job_id as string]))
  const jobIds = [...new Set(jobByProject.values())]
  if (jobIds.length === 0) return
  const [bills, payments, promises, waivers] = await Promise.all([
    supabase.from('jobs_ledger_invoices').select('id, job_id, amount, status, hosted_invoice_url').in('job_id', jobIds),
    supabase.from('jobs_ledger_payments').select('job_id, invoice_id, amount, paid_on').in('job_id', jobIds),
    supabase.rpc('list_job_payment_promises'),
    supabase.from('job_lien_releases').select('job_id, form_type, invoice_ids').in('job_id', jobIds),
  ])
  const billRows = taken(bills, 'load the bills on the billing job')
  const paymentRows = taken(payments, 'load the payments on the billing job')
  const promiseRows = (taken(promises, 'load the promises to pay') ?? []) as { jobId?: string; promisedYmd?: string; createdAt?: string; source?: string; note?: string | null }[]
  const waiverRows = taken(waivers, 'load our waivers on the billing job')
  // The bills the customer turned to card (O8b), so every figure reads them at their base (O8c).
  const billIds = billRows.map((b) => b.id)
  const cardRows = billIds.length
    ? taken(await supabase.from('gc_owner_card_bills').select('invoice_id, status, base, fee, chosen_on, undone_on').in('invoice_id', billIds), 'load the bills on card')
    : []
  for (const [projectId, jobId] of jobByProject) {
    const rows = out.get(projectId)
    if (!rows) continue
    rows.money = {
      bills: billRows.filter((b) => b.job_id === jobId).map((b) => ({ id: b.id, amount: Number(b.amount), status: b.status ?? '', payUrl: b.hosted_invoice_url ?? null })),
      payments: paymentRows.filter((p) => p.job_id === jobId).map((p) => ({ invoice_id: p.invoice_id, amount: Number(p.amount), paid_on: p.paid_on })),
      promises: promiseRows
        .filter((p) => p.jobId === jobId && p.promisedYmd && p.createdAt)
        .map((p) => ({ promisedYmd: p.promisedYmd ?? '', createdAt: p.createdAt ?? '', source: p.source ?? 'office', note: p.note ?? null })),
      waivers: waiverRows.filter((w) => w.job_id === jobId).map((w) => ({ form_type: w.form_type, invoice_ids: w.invoice_ids ?? [] })),
      cards: cardRows
        .filter((c) => billRows.some((b) => b.id === c.invoice_id && b.job_id === jobId))
        .map((c) => ({ invoice_id: c.invoice_id, status: c.status, base: Number(c.base), fee: Number(c.fee), chosen_on: c.chosen_on, undone_on: c.undone_on })),
    }
  }
}

/**
 * Back to a check bill (O8c): `gc-card-bill`'s undo door voids the bill's Stripe invoice (refused once Stripe shows a
 * payment), then runs `gc_card_bill_undo` as the caller, which puts the bill back to its base and takes the fee off.
 * The function's own words come back as they are.
 */
export async function takeBillOffCard(invoiceId: string): Promise<void> {
  const r = (await supabase.functions.invoke('gc-card-bill', { body: { undo: invoiceId } })) as FnResult
  const data = r.data as { ok?: boolean; words?: string } | null
  if (data?.ok) return
  const body = data ?? ((await r.error?.context?.json?.().catch(() => null)) as { words?: string } | null)
  throw new Error((body?.words ?? '').trim() || r.error?.message || 'The bill did not go back to a check bill.')
}

/** A payment on a GC bill (O5c): the Pipeline's own `mark_invoice_paid`, on the app's day. No amount: the rest of it. */
export async function recordGcPayment(invoiceId: string, amount: number | null, paidOn: string): Promise<void> {
  const answer = taken(
    await supabase.rpc('mark_invoice_paid', { p_invoice_id: invoiceId, p_paid_on: paidOn, ...(amount !== null ? { p_amount: amount } : {}) }),
    'record the payment',
  ) as { error?: string } | null
  // It answers a refusal rather than raising one.
  if (answer?.error) throw new Error(paymentRefusalWords(answer.error))
}

/** The customer's word on when they will pay (O5c): the Pipeline's own `add_job_payment_promise` on the billing job. */
export async function recordGcPromise(jobId: string, date: string, note: string, channel: string | null): Promise<void> {
  taken(
    await supabase.rpc('add_job_payment_promise', { p_job_id: jobId, p_date: date, ...(note.trim() ? { p_note: note.trim() } : {}), ...(channel ? { p_channel: channel } : {}) }),
    'record when they said they will pay',
  )
}

/**
 * Everything our money screens read beside the board, for these projects (Owner Billing's O6a): the terms
 * with the customer, the price as signed, our bills as they went (O5a), the property owners' names, and each
 * customer's usual days to pay from the app's own pay speeds.
 */
export async function loadGcBillingRows(projectIds: string[]): Promise<BillingRows> {
  if (projectIds.length === 0) return { terms: [], contract: [], billing: new Map(), names: {}, payDays: {} }
  const [terms, contract, billing, speeds] = await Promise.all([
    supabase
      .from('gc_projects')
      .select(
        'project_id, owner_retainage_pct, owner_retainage_step_at_pct, owner_retainage_step_to_pct, owner_retainage_step_way, owner_pay_days, owner_late_interest_pct_per_month, owner_late_finish_per_day, billing_job_id, property_owner_customer_id',
      )
      .in('project_id', projectIds),
    supabase.from('gc_owner_contract_lines').select('project_id, line, package_id, worth').in('project_id', projectIds),
    loadGcOwnerBillingRows(projectIds),
    supabase.rpc('get_billed_customer_pay_speeds'),
  ])
  const termRows: OwnerTermsRow[] = taken(terms, 'load the terms with the customers')
  const owners = [...new Set(termRows.map((t) => t.property_owner_customer_id).filter((id): id is string => id !== null))]
  const names: Record<string, string> = {}
  if (owners.length > 0) {
    const named: { id: string; name: string }[] = taken(await supabase.from('customers').select('id, name').in('id', owners), "load the property owners' names")
    for (const c of named) names[c.id] = c.name
  }
  const payDays: Record<string, number> = {}
  for (const [id, stat] of Object.entries(parsePaySpeedsRpc(taken(speeds, 'load how fast customers pay'))?.customers ?? {})) payDays[id] = Math.round(stat.medianDays)
  const contractRows: ContractLineRow[] = taken(contract, 'load the prices as signed')
  return { terms: termRows, contract: contractRows, billing, names, payDays }
}

// ---------------------------------------------------------------------------------------------
// Owner Billing's O4a: Bill the customer (migration gc_owner_pay_app_send). Sending and the certificate are
// the database's own functions; the retainage is a plain update of the project's columns.
// ---------------------------------------------------------------------------------------------

/** Send the pay application: its record and lines go, and the first one opens the billing job. Its id comes back. */
export async function sendOwnerPayApp(projectId: string, app: PayAppSend): Promise<string> {
  return taken(await supabase.rpc('gc_send_owner_pay_app', { p_project_id: projectId, p_app: app as unknown as Json }), 'send the pay application')
}

/** The architect's certificate: the bill on the billing job is made for what they certified. */
export async function recordCertificate(payAppId: string, amount: number, on: string, note: string): Promise<void> {
  taken(await supabase.rpc('gc_record_certificate', { p_pay_app_id: payAppId, p_amount: amount, p_on: on, p_note: note }), 'record the certificate')
}

/**
 * Bill the interest (O6b-2): what has built up and is not billed, as the job's next interest bill with its bill on the
 * billing job. Returns the interest bill's id, which gc-customer-email sends.
 */
export async function sendOwnerInterestBill(projectId: string, amount: number): Promise<string> {
  return taken(await supabase.rpc('gc_send_owner_interest_bill', { p_project_id: projectId, p_amount: amount }), 'bill the interest')
}

/**
 * The customer accepted the work (O7a), recorded by our office: the day, who walked it, and a note. Refused until
 * every line is billed, and once an acceptance is on file.
 */
export async function recordAcceptance(projectId: string, on: string, byName: string, note: string): Promise<void> {
  taken(await supabase.rpc('gc_record_acceptance', { p_project_id: projectId, p_on: on, p_by_name: byName, p_how: 'office', p_note: note }), 'record the acceptance')
}

/** The contract's late fee a day past substantial completion, or null for none (O6b-3). The money team's to change. */
export async function setOwnerLateFinish(projectId: string, perDay: number | null): Promise<void> {
  taken(
    await supabase.from('gc_projects').update({ owner_late_finish_per_day: perDay }).eq('project_id', projectId).select('project_id').single(),
    'save the late fee',
  )
}

/** Interest on the job's late bills, a percent a month, or null for none (O6b-1). The money team's to change. */
export async function setOwnerLateInterest(projectId: string, pctPerMonth: number | null): Promise<void> {
  taken(
    await supabase.from('gc_projects').update({ owner_late_interest_pct_per_month: pctPerMonth }).eq('project_id', projectId).select('project_id').single(),
    'save the interest',
  )
}

/** The contract's days to pay after the certificate (O5d), or null when it does not say. The money team's to change. */
export async function setOwnerPayDays(projectId: string, days: number | null): Promise<void> {
  taken(await supabase.from('gc_projects').update({ owner_pay_days: days }).eq('project_id', projectId).select('project_id').single(), 'save the days to pay')
}

/**
 * Our reminder to pay a late bill (O5b): filed with the pay-by day, the office's line and the email as the window
 * drafted it, with one note on the chase list. Returns the reminder's id, which gc-customer-email sends.
 */
export async function remindCustomerToPay(payAppId: string, on: string, payBy: string, note: string, subject: string, lines: string[]): Promise<string> {
  return taken(
    await supabase.rpc('gc_remind_customer_to_pay', { p_pay_app_id: payAppId, p_on: on, p_pay_by: payBy, p_note: note, p_subject: subject, p_lines: lines }),
    'file the reminder',
  )
}

/** Our conditional waiver, minted on the billing job, linked to the pay application it went with. Once only. */
export async function linkPayAppWaiver(payAppId: string, releaseId: string): Promise<void> {
  taken(await supabase.from('gc_owner_pay_apps').update({ conditional_waiver_id: releaseId }).eq('id', payAppId).select('id').single(), 'link the waiver')
}

/** The job's retainage and its step (null: held at one percent to the end). */
export async function setOwnerRetainage(projectId: string, pct: number, step: OwnerRetainageStep | null): Promise<void> {
  taken(
    await supabase
      .from('gc_projects')
      .update({
        owner_retainage_pct: pct,
        owner_retainage_step_at_pct: step?.atPct ?? null,
        owner_retainage_step_to_pct: step?.toPct ?? null,
        owner_retainage_step_way: step?.way ?? null,
      })
      .eq('project_id', projectId)
      .select('project_id')
      .single(),
    'save the retainage',
  )
}

// ---------------------------------------------------------------------------------------------
// Owner Billing's O7b: the Monday money email (migration gc_money_monday_email). Its requests are plain rows under
// the money team's policies, one weekly chain per weekday and recipient; gc-money-monday-email sends each one when
// it falls due, and draws Preview and the test.
// ---------------------------------------------------------------------------------------------

/** The pending sends the caller may see: the ones they asked for, the ones to them, and every one for a dev. */
export async function listMoneyMondayRequests(): Promise<MoneyMondayRequestRow[]> {
  return (
    taken(
      await supabase
        .from('gc_money_monday_email_requests')
        .select('id, requested_by, recipient_user_id, send_at, repeat_weekly')
        .is('sent_at', null)
        .order('send_at', { ascending: true }),
      'load the Monday emails',
    ) ?? []
  )
}

/** A change to the weekly chains: the new ones first, then the stopped ones, so a failed insert leaves the old ones going. */
export async function applyMoneyMondayPlan(plan: { inserts: Omit<MoneyMondayRequestRow, 'id'>[]; cancelIds: string[] }): Promise<void> {
  if (plan.inserts.length > 0) {
    taken(await supabase.from('gc_money_monday_email_requests').insert(plan.inserts).select('id'), 'save the Monday email')
  }
  if (plan.cancelIds.length > 0) {
    taken(await supabase.from('gc_money_monday_email_requests').delete().in('id', plan.cancelIds).is('sent_at', null).select('id'), 'stop the Monday email')
  }
}

/** The email as it would go now, for the signed-in member of the money team: its subject and its page. */
export async function previewMoneyMonday(): Promise<{ subject: string; html: string }> {
  const r = (await supabase.functions.invoke('gc-money-monday-email', { body: { mode: 'preview' } })) as FnResult
  const problem = await fnProblem(r, 'The email did not load.')
  if (problem) throw new Error(problem)
  const data = r.data as { subject?: string; html?: string } | null
  if (!data?.html) throw new Error('The email did not load.')
  return { subject: data.subject ?? '', html: data.html }
}

/** A copy marked [TEST] to the signed-in member only. */
export async function sendMoneyMondayTest(): Promise<void> {
  const r = (await supabase.functions.invoke('gc-money-monday-email', { body: { mode: 'test_send' } })) as FnResult
  const problem = await fnProblem(r, 'The test did not go.')
  if (problem) throw new Error(problem)
}

// ---------------------------------------------------------------------------------------------
// Owner Billing's O10: the office's notices (migration gc_office_notices). gc-office-notices sends them on its own each
// morning while the switch is on; the money team sees today's as they would go, and a copy of each marked [TEST].
// ---------------------------------------------------------------------------------------------

/** One notice as Preview shows it: its kind, its job, who hears it and where, and its words. */
export interface OfficeNoticePreview {
  kind: string
  project: string
  number: number
  to: string | null
  email: string
  subject: string
  text: string
}

/**
 * Today's notices as they would go, as if on since `since` (O10c), else the switch's day, else today. `notices`:
 * the office's (default) or the customer's notice before a bill is due (O12).
 */
export async function previewOfficeNotices(since?: string, notices: 'office' | 'customer' = 'office'): Promise<{ since: string; notices: OfficeNoticePreview[] }> {
  const body = { mode: 'preview', ...(since ? { since } : {}), ...(notices === 'customer' ? { notices } : {}) }
  const r = (await supabase.functions.invoke('gc-office-notices', { body })) as FnResult
  const problem = await fnProblem(r, 'The notices did not load.')
  if (problem) throw new Error(problem)
  const data = r.data as { since?: string; notices?: OfficeNoticePreview[] } | null
  return { since: data?.since ?? '', notices: data?.notices ?? [] }
}

/** Each of today's notices marked [TEST], to the signed-in member only, as if on since `since` as Preview. How many went. */
export async function sendOfficeNoticesTest(since?: string, notices: 'office' | 'customer' = 'office'): Promise<number> {
  const body = { mode: 'test_send', ...(since ? { since } : {}), ...(notices === 'customer' ? { notices } : {}) }
  const r = (await supabase.functions.invoke('gc-office-notices', { body })) as FnResult
  const problem = await fnProblem(r, 'The test did not go.')
  if (problem) throw new Error(problem)
  return Number((r.data as { sent?: number } | null)?.sent ?? 0)
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

/**
 * One line on an ask's story (the Board's B4-b): a call, a text or an email, with the day they promised the quote by. With
 * no ask (`inviteId` null, B2b-iv), a line of the company's own, logged on its window's Activity.
 */
export async function logGcAskContact(line: { companyId: string; inviteId: string | null; on: string; byName: string; how: 'call' | 'text' | 'email'; note: string; promisedBy: string | null }): Promise<void> {
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

/**
 * Ask companies to quote a trade (the Board's B4-a): `gc_invite_companies` records each ask, skipping a
 * company already asked. With `send` (a dev, `canSendGcTradeEmail`), each new ask's invitation goes out through
 * `gc-trade-email` and the ask reads *Invitation emailed.* or the refusal's words; without it each ask carries
 * a note that a dev sends the email (`inviteAsks`, askEmail.ts).
 */
export async function askGcCompanies(
  packageId: string,
  companyIds: string[],
  byName: string,
  on: string,
  send: ((ask: NewAsk) => Promise<TradeEmailAnswer>) | null = null,
): Promise<AskOutcome[]> {
  const made = taken(await supabase.rpc('gc_invite_companies', { p_package_id: packageId, p_company_ids: companyIds }), 'ask the companies') ?? []
  if (made.length === 0) return []
  const rows = taken(await supabase.from('gc_invites').select('id, company_id').in('id', made), 'read the new asks')
  const { outcomes, lines } = await inviteAsks(
    rows.map((r) => ({ inviteId: r.id, companyId: r.company_id })),
    send,
  )
  if (lines.length > 0) {
    taken(
      await supabase
        .from('gc_company_contacts')
        .insert(lines.map((l) => ({ company_id: l.companyId, invite_id: l.inviteId, contacted_on: on, by_name: byName, how: l.how, note: l.note })))
        .select('id'),
      'note what each ask came to',
    )
  }
  return outcomes
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

/**
 * Award a trade to one ask's quote (the Board's B6-a-ii, on B6-a's `gc_award`): the database re-checks the gate in
 * `canAward`'s words, writes the award and drafts the statement of work. Its id. The estimator is who decided; unset,
 * the one pressing.
 */
export async function awardGcTrade(inviteId: string, estimatorId: string | null): Promise<string> {
  return taken(await supabase.rpc('gc_award', { p_invite_id: inviteId, ...(estimatorId ? { p_estimator: estimatorId } : {}) }), 'award the trade')
}

/**
 * Send a trade's drafted statement of work to its portal to sign (B6-a-ii): draft to sent with the company's day, a
 * plain update under the dev policy, found by its trade (one a trade). Its id, for the email's key.
 */
export async function sendGcSow(packageId: string, today: string): Promise<string> {
  const rows = taken(
    await supabase.from('gc_sows').update({ status: 'sent', sent_on: today }).eq('package_id', packageId).eq('status', 'draft').select('id'),
    'send the statement of work',
  )
  const id = rows[0]?.id
  if (!id) throw new Error('That statement of work is not a draft any more. Read the board again.')
  return id
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

/** Our emails about these change orders, from their sent copies (O4b-2): who each went to and when, oldest first. */
export async function loadGcChangeOrderEmails(changeOrderIds: string[]): Promise<{ source_id: string; recipient_name: string | null; sent_at: string }[]> {
  if (changeOrderIds.length === 0) return []
  const rows = taken(
    await supabase
      .from('sent_documents')
      .select('source_id, recipient_name, sent_at')
      .eq('source_table', 'gc_change_orders')
      .in('kind', gcCustomerEmailCopyKinds('gc_change_orders'))
      .eq('how', 'email')
      .in('source_id', changeOrderIds)
      .order('sent_at'),
    'load the emails about the change orders',
  )
  return rows.flatMap((r) => (r.source_id ? [{ source_id: r.source_id, recipient_name: r.recipient_name, sent_at: r.sent_at }] : []))
}

/**
 * Ask for the days (G-141, the schedule's PR 16b-ii): a time extension drafted as a change order for the days the moves
 * put on the finish, with the moves it covers. The money team's (the change orders' policy). Nothing goes to the
 * customer. Returns the change order's id.
 */
export async function draftTimeExtension(projectId: string, ask: { days: number; moves: { id: string }[]; reason: string; description: string }): Promise<string> {
  return taken(
    await supabase.rpc('gc_draft_time_extension', { p_project_id: projectId, p_days: ask.days, p_move_ids: ask.moves.map((m) => m.id), p_reason: ask.reason, p_description: ask.description }),
    'draft the time extension',
  )
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

// ---------------------------------------------------------------------------------------------
// Owner Billing's O3b: a trade's ask for a change, answered by the office (migration 20261010014000). The asks are the
// Portal's P4a (gc_trade_change_requests), whose policy gives rows to a dev only until the trade wave; the two presses
// refuse anyone but the money team, then anyone but a dev, in words.
// ---------------------------------------------------------------------------------------------

/** The trades' asks for a change on these projects, as their rows hold them. */
export async function loadGcChangeRequests(projectIds: string[]): Promise<ChangeRequestRow[]> {
  if (projectIds.length === 0) return []
  return taken(await supabase.from('gc_trade_change_requests').select('*').in('project_id', projectIds).order('asked_on'), 'load the trades’ asks for a change')
}

/** The emails about these asks that went to their company (`<request id>:<stage>`), with the day each went. */
export async function loadGcChangeRequestEmails(requestIds: string[]): Promise<{ key: string; on: string }[]> {
  if (requestIds.length === 0) return []
  const stages: ChangeAskEmailStage[] = ['down', 'sent', 'no']
  const keys = requestIds.flatMap((id) => stages.map((stage) => changeAskEmailKey(id, stage)))
  const rows = taken(await supabase.from('gc_trade_messages').select('msg_key, sent_on').eq('kind', 'changeAsk').in('msg_key', keys), 'load the emails about the asks')
  return rows.map((r) => ({ key: r.msg_key, on: r.sent_on }))
}

/**
 * Make a trade's ask a draft change order on its own trade and reason, at the words, cost, price and days the office
 * confirmed. Returns the change order's id.
 */
export async function draftChangeOrderFromRequest(requestId: string, draft: ChangeRequestDraft): Promise<string> {
  return taken(await supabase.rpc('gc_draft_change_order_from_request', { p_request_id: requestId, p_draft: draft as unknown as Json }), 'make the change order')
}

/** Turn a trade's ask down, with why, in words the company reads. */
export async function turnDownChangeRequest(requestId: string, note: string): Promise<void> {
  taken(await supabase.rpc('gc_turn_down_change_request', { p_request_id: requestId, p_note: note }), 'turn the ask down')
}

/**
 * Tell the company where its ask stands (P4b-iii's `changeAskEmail`, kind `changeAsk`), in its language, once a stage by
 * `<request id>:<stage>`: `down` with the turn-down, `sent` when its change order went to the customer, `no` when the
 * customer declined it. Null when the ask is not at that stage. A refusal comes back in the answer, never thrown.
 */
export async function emailChangeAsk(a: {
  projectId: string
  project: string
  trade: string
  request: TradeChangeRequest
  stage: ChangeAskEmailStage
  changeOrder?: { number: number; cost: number } | null
}): Promise<TradeEmailAnswer | null> {
  const { data } = await supabase.from('gc_companies').select('lang').eq('id', a.request.partnerId).maybeSingle()
  const lang = tradeMailLang(data?.lang)
  const mail = changeAskEmail(a.stage, { project: a.project, trade: a.trade, request: a.request, changeOrder: a.changeOrder ?? null }, lang)
  if (!mail) return null
  return sendGcTradeEmail({
    companyId: a.request.partnerId,
    kind: 'changeAsk',
    key: changeAskEmailKey(a.request.id, a.stage),
    projectId: a.projectId,
    lang,
    subject: mail.subject,
    lines: mail.lines,
  })
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

/**
 * The Pipeline job our general conditions are spent on (Owner Billing's O11b), or none. The money team's, through our
 * number's own policy; a project with no row yet gets one, its three inputs at zero, as no row reads.
 */
export async function setGcGeneralConditionsJob(projectId: string, jobId: string | null): Promise<void> {
  taken(
    await supabase
      .from('gc_project_money')
      .upsert({ project_id: projectId, general_conditions_job_id: jobId, updated_at: new Date().toISOString() }, { onConflict: 'project_id' })
      .select('project_id')
      .single(),
    'name the Pipeline job',
  )
}

/** A Pipeline job to name, by its number, name or address: the Pipeline's own search, billing-only jobs left out. */
export interface PipelineJobHit {
  id: string
  label: string
  name: string
  address: string
}

export async function searchPipelineJobs(text: string): Promise<PipelineJobHit[]> {
  const rows = taken(await supabase.rpc('search_jobs_ledger', { search_text: text.trim(), include_billing_only: false }), 'look up the Pipeline jobs') ?? []
  return rows.map((r) => ({ id: r.id, label: jobNumberLabel(r), name: r.job_name ?? '', address: r.job_address ?? '' }))
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

// ---------------------------------------------------------------------------------------------
// The Board's B6-c-ii: Get started. Start and Start anyway go through gc_start_project (B6-c-i, a dev's until award's
// door); our contract through Owner Billing's gc_sign_owner_contract; the permit and the start date are plain writes
// under gc_projects' office door. Each write to gc_projects reads the projects again on the page (the plan's rule).
// ---------------------------------------------------------------------------------------------

/** Start the job (B6-c-i). Start anyway sends why and what was still missing, as the window listed it. The company's day. */
export async function startGcProject(projectId: string, anyway?: { reason: string; missing: string[] }): Promise<string> {
  return taken(
    await supabase.rpc('gc_start_project', { p_project_id: projectId, ...(anyway ? { p_anyway: { reason: anyway.reason, missing: anyway.missing } } : {}) }),
    'start the job',
  )
}

/** Our contract with the customer signed on paper (Mark it signed) or not (Undo), with its price by line when it is first signed. */
export async function signGcOwnerContract(projectId: string, signedOn: string | null, worth: Record<string, number> | null): Promise<void> {
  taken(
    // A null day is Undo; the generated type reads every argument as required, so the null is cast through.
    await supabase.rpc('gc_sign_owner_contract', { p_project_id: projectId, p_signed_on: signedOn as string, ...(worth ? { p_worth: worth as Json } : {}) }),
    signedOn ? 'mark the contract signed' : 'undo the contract signed',
  )
}

/** The permit in hand (Mark it done) or not (Undo), and the day work starts: plain writes on the office's gc_projects. */
export async function setGcProjectStartItem(projectId: string, patch: { permit_on?: string | null; start_date?: string | null }): Promise<void> {
  taken(await supabase.from('gc_projects').update(patch).eq('project_id', projectId).select('project_id'), 'save the project')
}

/** The companies already told the job started (gc_trade_messages under `<project id>:start`), so a second press names only who it missed. */
export async function loadGcStartTold(projectId: string): Promise<string[]> {
  const rows = taken(await supabase.from('gc_trade_messages').select('company_id').eq('msg_key', `${projectId}:start`), 'load who was told the job started')
  return [...new Set(rows.map((r) => r.company_id))]
}

/**
 * Share a trade's bid tab with the companies that quoted (the Board's B5-d), or change whether they see
 * each other's names. The day it was first shared stays: an upsert sets only the names.
 */
export async function shareGcBidTab(packageId: string, showNames: boolean): Promise<void> {
  taken(await supabase.from('gc_bid_tabs').upsert({ package_id: packageId, show_names: showNames }, { onConflict: 'package_id' }).select('package_id').single(), 'share the bid tab')
}
