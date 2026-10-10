import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { publicViewDecision } from '../_shared/publicViewCounting.ts'
import { tradePortalSlice, type TradePortalRows } from '../_shared/gcTradePortalSlice.ts'
import { sampleStateFromToken } from '../_shared/customerSample.ts'
import { gcTradePortalSample, gcTradePortalSampleSchedules } from '../_shared/gcTradePortalSample.ts'
import { resolveTradeLink, type TradeLinkRow } from '../_shared/gcTradeLink.ts'
import { portalScheduleJobs, portalSchedulesFromRows, type TradeScheduleRows } from '../_shared/gcTradePortalSchedule.ts'

/**
 * GC mode, the trade partner portal's read (P1b-ii, to-dos/gc-mode/PORTAL_REAL_BUILD.md): resolves a
 * company's portal link and returns only that company's slice. No sign-in: the link is the key, as
 * on the sub portal (sub-portal/index.ts is the template). Every query is held to the link's
 * company, and `tradePortalSlice` copies only the fields a trade may read, so our price to the
 * customer, our budgets and fee and another company never leave here.
 *
 *   GET ?t=<token>[&preview=1]   → { today, slice } | { error: key }
 *
 * Errors are keys the page translates (linkOff, badRequest, failed), so a Spanish portal reads
 * them in Spanish. The sample token (`sample`) returns the made-up company for What customers see
 * (`_shared/gcTradePortalSample.ts`) and counts no visit.
 *
 * Since the schedule's PR 14b, `schedules` beside the slice: the company's chart on each job being built with a trade
 * awarded to it (G-110), worked out here from every bar on the job with the generated copy of the kernels
 * (`_shared/gcTradePortalSchedule.ts`, `_shared/gcKernels/`), so only the answer leaves: its own bars and those right
 * before and after them by name, never a dollar, a note or a contact. A chart that fails to read leaves the slice whole.
 *
 *   GET ?t=<token>  → { today, slice, schedules: { [projectId]: PortalSchedule } }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type R = Record<string, unknown>
const rowsOf = (r: { data: unknown }): R[] => (r.data ?? []) as R[]
const ids = (rows: R[], f = 'id'): string[] => [...new Set(rows.map((r) => String(r[f] ?? '')).filter(Boolean))]

/** Every row the slice may draw from, each query held to the company or to what its invites reach. */
async function readRows(admin: SupabaseClient, companyId: string): Promise<TradePortalRows | null> {
  const company = (await admin.from('gc_companies').select('*').eq('id', companyId).maybeSingle()).data as R | null
  if (!company) return null
  const [people, invites, contacts, promises, messages, setSends, sows, backCharges, changeRequests, papers, vettingForms] = await Promise.all([
    admin.from('gc_company_people').select('*').eq('company_id', companyId).is('removed_at', null).then(rowsOf),
    admin.from('gc_invites').select('id, package_id, company_id, status, invited_on, seen_rev, declined_why, declined_on').eq('company_id', companyId).then(rowsOf),
    admin.from('gc_company_contacts').select('id, company_id, invite_id, contacted_on, how, note, promised_by').eq('company_id', companyId).not('invite_id', 'is', null).then(rowsOf),
    admin.from('gc_trade_promises').select('*').eq('company_id', companyId).then(rowsOf),
    admin.from('gc_trade_messages').select('*').eq('company_id', companyId).order('sent_at', { ascending: false }).limit(200).then(rowsOf),
    admin.from('gc_plan_set_sends').select('set_id, company_id, touched').eq('company_id', companyId).then(rowsOf),
    // Its own work (P4b-i): its statements of work, the charges to it and the changes it asked for.
    admin.from('gc_sows').select('id, package_id, invite_id, company_id, status, price, retainage_pct, based_on_rev, sent_on, signed_on, excluded, accepted_on').eq('company_id', companyId).then(rowsOf),
    admin.from('gc_back_charges').select('*').eq('company_id', companyId).order('sent_on').then(rowsOf),
    admin.from('gc_trade_change_requests').select('*').eq('company_id', companyId).order('asked_on').then(rowsOf),
    // Its own papers (B6-b-ii), where each stands: for its master agreement first.
    admin.from('person_contract_documents').select('id, company_id, doc_type, status, sent_at, signed_at, expires_at').eq('company_id', companyId).then(rowsOf),
    // Its vetting form (P5b-1): the day it sent it, never its answers.
    admin.from('gc_company_vetting_forms').select('company_id, sent_on').eq('company_id', companyId).then(rowsOf),
  ])
  const vettingForm = vettingForms[0] ?? null
  // The lines of its own statements of work (P2c-ii), for the sign screen and its report; the draws on them and the
  // change orders sent to it (P5c-1).
  const sowIds = ids(sows)
  const [sowLines, draws, changeSends] = sowIds.length
    ? await Promise.all([
        admin.from('gc_sow_lines').select('id, sow_id, position, label, amount, scope_item_id').in('sow_id', sowIds).order('position').then(rowsOf),
        admin.from('gc_draws').select('*').in('sow_id', sowIds).order('seq').then(rowsOf),
        admin.from('gc_change_order_trade_sends').select('change_order_id, sow_id, sent_on, signed_on, sow_line_id').in('sow_id', sowIds).then(rowsOf),
      ])
    : [[], [], []]
  // The change orders its requests became and those sent to it, as their part only: number, status, the days sent and
  // answered, and the cost. The description passes only on one sent to it (`tradePortalSlice`).
  const orderIds = [...new Set([...ids(changeRequests, 'change_order_id'), ...ids(changeSends, 'change_order_id')])]
  const lineIds = ids(sowLines)
  const drawIds = ids(draws)
  const [changeOrders, drawLines, lineReports] = await Promise.all([
    orderIds.length ? admin.from('gc_change_orders').select('id, number, status, sent_on, answered_on, cost, package_id, reason, description').in('id', orderIds).then(rowsOf) : [],
    drawIds.length ? admin.from('gc_draw_lines').select('draw_id, sow_line_id, to_pct, stored, we_see').in('draw_id', drawIds).then(rowsOf) : [],
    lineIds.length ? admin.from('gc_sow_line_reports').select('sow_line_id, pct, reported_on, seq').in('sow_line_id', lineIds).then(rowsOf) : [],
  ])
  const work = { sows, sowLines, backCharges, changeRequests, changeOrders, draws, drawLines, lineReports, changeSends }
  const inviteIds = ids(invites)
  const packageIds = ids(invites, 'package_id')
  const [quotes, packages] = await Promise.all([
    inviteIds.length ? admin.from('gc_quotes').select('*').in('invite_id', inviteIds).order('created_at', { ascending: false }).then(rowsOf) : [],
    packageIds.length ? admin.from('gc_trade_packages').select('id, project_id, trade, position, awarded_invite_id').in('id', packageIds).then(rowsOf) : [],
  ])
  const projectIds = ids(packages, 'project_id')
  if (projectIds.length === 0) {
    return { company, people, invites, quotes, contacts, promises, projects: [], packages, scopeItems: [], exclusions: [], sets: [], setItems: [], questions: [], messages, setSends, papers, vettingForm, ...work }
  }
  // The job's work (P5c-1) on the trades awarded to it: Building's rows carry no company, so they are read by its trades.
  const awarded = packages.filter((k) => inviteIds.includes(String(k.awarded_invite_id ?? ''))).map((k) => String(k.id))
  const jobRead = readJobWork(admin, awarded)
  const [projectRows, gcRows, scopeItems, exclusions, sets, questions, supers] = await Promise.all([
    admin.from('projects').select('id, name, address').in('id', projectIds).then(rowsOf),
    admin.from('gc_projects').select('project_id, stage, bid_due, size_note, lost_on, lost_why, closed_on, project_manager_user_id').in('project_id', projectIds).then(rowsOf),
    admin.from('gc_scope_items').select('*').in('package_id', packageIds).then(rowsOf),
    admin.from('gc_scope_exclusions').select('*').in('package_id', packageIds).then(rowsOf),
    admin.from('gc_plan_sets').select('id, project_id, rev, label, kind, issued_on, note, drive_url').in('project_id', projectIds).then(rowsOf),
    admin.from('gc_plan_questions').select('id, project_id, package_id, company_id, text, sheets, asked_on, answered_on, answer, answer_sent_to, in_set_id').in('project_id', projectIds).then(rowsOf),
    admin.from('project_superintendents').select('project_id, superintendent_id').in('project_id', projectIds).then(rowsOf),
  ])
  const job = await jobRead
  const setIds = ids(sets)
  const setItems = setIds.length ? await admin.from('gc_plan_set_items').select('*').in('set_id', setIds).then(rowsOf) : []
  const userIds = [...ids(gcRows, 'project_manager_user_id'), ...ids(supers, 'superintendent_id')]
  const users = userIds.length ? await admin.from('users').select('id, name, phone, email').in('id', userIds).then(rowsOf) : []
  const userById = new Map(users.map((u) => [String(u.id), u]))
  const contact = (role: string, id: unknown) => {
    const u = userById.get(String(id ?? ''))
    return u ? { role, name: u.name, phone: u.phone ?? '', email: u.email ?? '' } : null
  }
  const projects = projectRows.map((project) => {
    const gc = gcRows.find((g) => g.project_id === project.id) ?? { project_id: project.id }
    const team = [
      ...supers.filter((s) => s.project_id === project.id).map((s) => contact('superintendent', s.superintendent_id)),
      contact('projectManager', gc.project_manager_user_id),
    ].filter((t): t is NonNullable<typeof t> => t !== null)
    return { project, gc, team }
  })
  return { company, people, invites, quotes, contacts, promises, projects, packages, scopeItems, exclusions, sets, setItems, questions, messages, setSends, papers, vettingForm, ...work, ...job }
}

/**
 * The job's work on the trades awarded to the company (P5c-1): Building's submittals with their holds and rounds, the
 * RFIs on those trades with their holds, and its punch items not taken off. The slice holds them again and copies only
 * what a trade may read.
 */
async function readJobWork(admin: SupabaseClient, awarded: string[]): Promise<Pick<TradePortalRows, 'submittals' | 'submittalHolds' | 'submittalRounds' | 'rfis' | 'rfiHolds' | 'punch'>> {
  if (awarded.length === 0) return { submittals: [], submittalHolds: [], submittalRounds: [], rfis: [], rfiHolds: [], punch: [] }
  const [submittals, rfis, punch] = await Promise.all([
    admin.from('gc_submittals').select('*').in('package_id', awarded).then(rowsOf),
    admin.from('gc_rfis').select('*').in('package_id', awarded).then(rowsOf),
    admin.from('gc_punch_items').select('*').in('package_id', awarded).is('removed_at', null).then(rowsOf),
  ])
  const submittalIds = ids(submittals)
  const rfiIds = ids(rfis)
  const [submittalHolds, submittalRounds, rfiHolds] = await Promise.all([
    submittalIds.length ? admin.from('gc_submittal_holds').select('submittal_id, scope_item_id').in('submittal_id', submittalIds).then(rowsOf) : [],
    submittalIds.length ? admin.from('gc_submittal_rounds').select('*').in('submittal_id', submittalIds).then(rowsOf) : [],
    rfiIds.length ? admin.from('gc_rfi_holds').select('rfi_id, scope_item_id').in('rfi_id', rfiIds).then(rowsOf) : [],
  ])
  return { submittals, submittalHolds, submittalRounds, rfis, rfiHolds, punch }
}

// Reads past PostgREST's 1,000 rows (the schedule's PR 14b): ids in chunks, each chunk a page at a time, in a stable order.
const IN_CHUNK = 150
const PAGE = 1000
type Page = PromiseLike<{ data: unknown; error: unknown }>
async function readAll(ids: string[], read: (chunk: string[], from: number, to: number) => Page): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await read(chunk, from, from + PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as R[]
      out.push(...rows)
      if (rows.length < PAGE) break
    }
  }
  return out
}

/**
 * The rows the company's chart reads (the schedule's PR 14b, call 4), held to its jobs being built: each job and its
 * trades, only the awarded invites and those companies' names, the awarded trades' statements of work with their
 * draws and reports for each line's percent, and the bars with what they wait on and the baselines. No other schedule
 * table, no bid, no contact and no note is read.
 */
async function readScheduleRows(admin: SupabaseClient, jobIds: string[]): Promise<TradeScheduleRows> {
  const [projects, gcRows, packages, schedules, activities, links, baselines] = await Promise.all([
    admin.from('projects').select('id, name, address, customer_id, plans_link').in('id', jobIds).then(rowsOf),
    admin.from('gc_projects').select('project_id, stage, bid_due, sq_ft, size_note, customer_role, property_owner_customer_id, architect_customer_id, project_manager_user_id, drive_folder_url, lost_on').in('project_id', jobIds).then(rowsOf),
    readAll(jobIds, (c, from, to) => admin.from('gc_trade_packages').select('id, project_id, trade, position, budget, ours, own_bid_id, job_ledger_id, carried_invite_id, carry_budget, awarded_invite_id, awarded_by, awarded_on').in('project_id', c).order('id').range(from, to)),
    admin.from('gc_schedules').select('project_id, version, template_id, template_name, template_used_on').in('project_id', jobIds).then(rowsOf),
    readAll(jobIds, (c, from, to) => admin.from('gc_schedule_activities').select('id, project_id, kind, position, package_id, start, finish, not_before, must_finish_by, actual_start, actual_finish, place, label, passed_on, who, done_on').in('project_id', c).order('id').range(from, to)),
    readAll(jobIds, (c, from, to) => admin.from('gc_schedule_links').select('project_id, from_activity_id, to_activity_id, gap, created_at').in('project_id', c).order('from_activity_id').order('to_activity_id').range(from, to)),
    admin.from('gc_schedule_baselines').select('id, project_id, name, locked_on, locked_by, why, created_at').in('project_id', jobIds).then(rowsOf),
  ])
  const packageIds = ids(packages)
  const awardedIds = ids(packages, 'awarded_invite_id')
  const [scopeItems, invites, sows, baselineDates] = await Promise.all([
    readAll(packageIds, (c, from, to) => admin.from('gc_scope_items').select('id, package_id, position, label, sheets, specs, added_in_set_id').in('package_id', c).order('id').range(from, to)),
    readAll(awardedIds, (c, from, to) => admin.from('gc_invites').select('id, package_id, company_id, status, invited_on').in('id', c).order('id').range(from, to)),
    readAll(packageIds, (c, from, to) => admin.from('gc_sows').select('id, package_id, status, price, retainage_pct, based_on_rev, their_sov, excluded, sent_on, signed_on, accepted_on').in('package_id', c).order('id').range(from, to)),
    readAll(ids(baselines), (c, from, to) => admin.from('gc_schedule_baseline_dates').select('baseline_id, activity_id, start, finish').in('baseline_id', c).order('baseline_id').order('activity_id').range(from, to)),
  ])
  const sowIds = ids(sows)
  const [companies, sowLines, draws] = await Promise.all([
    readAll(ids(invites, 'company_id'), (c, from, to) => admin.from('gc_companies').select('id, name').in('id', c).order('id').range(from, to)),
    readAll(sowIds, (c, from, to) => admin.from('gc_sow_lines').select('id, sow_id, position, label, amount, scope_item_id, change_order_id').in('sow_id', c).order('id').range(from, to)),
    readAll(sowIds, (c, from, to) => admin.from('gc_draws').select('*').in('sow_id', c).order('id').range(from, to)),
  ])
  const [drawLines, reports] = await Promise.all([
    readAll(ids(draws), (c, from, to) => admin.from('gc_draw_lines').select('*').in('draw_id', c).order('draw_id').order('sow_line_id').range(from, to)),
    readAll(ids(sowLines), (c, from, to) => admin.from('gc_sow_line_reports').select('*').in('sow_line_id', c).order('id').range(from, to)),
  ])
  const of = (rows: R[], projectId: string, f = 'project_id') => rows.filter((r) => r[f] === projectId)
  const jobs = projects.flatMap((project) => {
    const gc = gcRows.find((g) => g.project_id === project.id)
    if (!gc) return []
    const mine = of(packages, String(project.id))
    const mineIds = new Set(mine.map((k) => k.id))
    const bars = of(activities, String(project.id))
    const lines = of(baselines, String(project.id))
    const lineIds = new Set(lines.map((b) => b.id))
    return [
      {
        project: { project, gc, packages: mine, scopeItems: scopeItems.filter((i) => mineIds.has(i.package_id)), exclusions: [], sets: [], setItems: [], questions: [] },
        schedule: {
          schedule: gcScheduleOf(schedules, String(project.id)),
          activities: bars,
          links: of(links, String(project.id)),
          baselines: lines,
          baselineDates: baselineDates.filter((d) => lineIds.has(d.baseline_id)),
        },
      },
    ]
  })
  return { jobs, invites, companies, sows, sowLines, draws: { draws, drawLines, reports } } as unknown as TradeScheduleRows
}

/** A job's own schedule row, or null while nothing is drawn. */
function gcScheduleOf(schedules: R[], projectId: string): R | null {
  return schedules.find((s) => s.project_id === projectId) ?? null
}

/** The company's chart on each of its jobs being built. A failed read leaves the slice whole, with no chart. */
async function chartsFor(admin: SupabaseClient, companyId: string, rows: TradePortalRows, today: string): Promise<Record<string, unknown>> {
  try {
    const stages = rows.projects.map((p) => p.gc as { project_id: string; stage?: string | null })
    const jobIds = portalScheduleJobs(rows.packages as { id: string; project_id: string; awarded_invite_id?: string | null }[], ids(rows.invites), stages)
    if (jobIds.length === 0) return {}
    return portalSchedulesFromRows(await readScheduleRows(admin, jobIds), companyId, today)
  } catch (e) {
    console.error('gc-trade-portal: the chart did not read', e)
    return {}
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return jsonResponse({ error: 'badRequest' }, 405)
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('t')?.trim() ?? ''
    const today = todayYmdInAppTz()
    if (sampleStateFromToken(token)) return jsonResponse({ today, slice: gcTradePortalSample(today), schedules: gcTradePortalSampleSchedules(today), sample: true })
    if (token.length < 16 || token.length > 128) return jsonResponse({ error: 'badRequest' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    // One rule for the read and the writes (`_shared/gcTradeLink.ts`): the raw token, then its hash; off is no link.
    const link = await resolveTradeLink(token, async (column, value) => {
      const { data } = await admin.from('gc_trade_portal_links').select('company_id, revoked_at').eq(column, value).maybeSingle()
      return data as TradeLinkRow | null
    })
    if (!link) return jsonResponse({ error: 'linkOff' }, 404)

    // Who looked: outside counts; a signed-in teammate or the office's preview is stamped, never counted.
    const viewDecision = await publicViewDecision(req, admin, Deno.env.get('SUPABASE_ANON_KEY'))
    void admin
      .from('public_page_views')
      .insert({ surface: 'gc_trade_portal', entity_id: link.company_id, via: 'token', viewer: viewDecision.viewer, viewer_user_id: viewDecision.staffUserId })
      .then(() => {}, () => {})

    const rows = await readRows(admin, link.company_id)
    if (!rows) return jsonResponse({ error: 'linkOff' }, 404)
    return jsonResponse({ today, slice: tradePortalSlice(rows, link.company_id), schedules: await chartsFor(admin, link.company_id, rows, today) })
  } catch (e) {
    console.error('gc-trade-portal failed', e)
    return jsonResponse({ error: 'failed' }, 500)
  }
})
