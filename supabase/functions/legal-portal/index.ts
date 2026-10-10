import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
// Item 7 (#85): a thrown error is logged; the firm reads one plain sentence.
import { unexpectedErrorBody } from '../_shared/legalPortalErrors.ts'
import { publicViewDecision, userBearerToken } from '../_shared/publicViewCounting.ts'
import { JOB_CONTRACT_BUCKET } from '../_shared/jobContract.ts'
// Item 9 (#85): a promise is measured against what was billed when it was made, as the desk's RPC does.
import { billedAtPromise } from '../_shared/legalPromiseBilled.ts'
import { sampleStateFromToken } from '../_shared/customerSample.ts'
import { sampleLegalPortalResponse } from '../_shared/customerSampleFixtures.ts'
// Item 24 (#85): the payer's contact log reaches the firm only about the matter's jobs or the account.
import { contactGoesWithShare, contactScopeNumbers } from '../_shared/legalContactScope.ts'
import { LIEN_BOOK_COUNSEL_SELECT, shapeLienBookForCounsel } from '../_shared/legalLienBookShape.ts'
import { LEGAL_PORTAL_STAGES } from '../_shared/legalStages.ts'
// Item 23 (#85): the matter's rows name their columns and are cut to them once more before they leave.
import { MATTER_COUNSEL_SELECT, MATTER_ENTRY_PENDING_COLUMNS, shapeMatterForCounsel } from '../_shared/legalMatterShape.ts'
import { LEGAL_MATTER_DOCUMENTS_BUCKET, legalPortalDocumentFromRow } from '../_shared/legalMatterDocuments.ts'
import { legalNarrativeFromRow } from '../_shared/legalNarrative.ts'
// v2.4756: the key is short on purpose, so wrong keys are counted by caller and a guesser is refused.
import { askGuessGate, GUESS_LOCKED_MSG } from '../_shared/legalPortalGuessGate.ts'
import { clientIpFromEdgeRequest } from '../_shared/clientIpFromEdgeRequest.ts'
import { LEGAL_OFFICE_CONTACT_ROLES, officeContactsFromUsers } from '../_shared/legalOfficeContacts.ts'
import { shapeLegalFirmIntake } from '../_shared/legalFirmIntake.ts'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'

/**
 * Legal portal payload (Legal portal train, PR 3): resolves the collections law
 * firm's capability token by its sha256 in legal_portal_links (item 22: the raw
 * column answers only until the hash-only migration empties it; revoked → 404),
 * or, for the office, the firm by id on a signed-in session (`?firm=<id>&preview=1`,
 * `legal_office_can_read()`), and returns every matter the office marked attorney-ready
 * (legal_matters.stage in the with-firm set — since #85 item 16 also a firm end
 * such as settled until the office closes it, `_shared/legalStages.ts`) with the raw records the packet
 * kernel (src/lib/legal/legalPacket.ts) assembles on the page — jobs, invoices,
 * payments, the customer, each job's own property record and owner override
 * (since #85 item 6, no owner email), agreements (signed PDFs as
 * short-lived signed URLs), demand letters, lien filings and (since v2.3797)
 * the § 53.056 notice desk items shaped down to the three sent-notice facts —
 * the owner's call, letter two, the GC's written okay — promises, collection
 * calls, contact history, field evidence, the matter's own entries (with
 * `acknowledged_at` since #85 item 17: the office's "seen", and a withdrawn ask) — plus the
 * firm and Click's particulars for filing — and, since v2.3789, the Lien desk's
 * Timeline book raw (`lienBook`) for counsel's grid.
 *
 * HELD ENTRIES NEVER LEAVE. The office's "to counsel" decisions are applied here,
 * under the service role, with the same rule the desk uses — since #85 item 29
 * every entry goes unless the matter's held_overrides says true for its key, and
 * the matter's heldCount says how many were held (the office's reasons stay home).
 * Timeline keys: contact:<id> · promise:<id> · call:<id> · note:<job id>.
 *
 * No auth for the firm: the link is the capability. Same shape as customer-portal /
 * sub-portal. The office's preview by firm id is the one signed-in door.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Item 22 (#85): the payload is one firm's private record. No cache holds it, and no page it links to learns where it came from.
const privateHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

const LINK_INACTIVE_MSG = 'This link is no longer active. Please contact the office for a new one.'
/** How long a signed PDF link opens (item 22). The page reloads its payload before this runs out. */
const SIGNED_PDF_SECONDS = 15 * 60

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * The office's preview by firm (item 22): once the token is hash-only at rest the office no longer holds the
 * firm's key, so its Preview asks by firm id, signed in. The caller's own session must pass
 * `legal_office_can_read()` (the four office roles that read every legal table already). Null otherwise.
 */
async function officePreviewFirm(req: Request, firmId: string): Promise<string | null> {
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const jwt = userBearerToken(req.headers.get('Authorization'), anonKey)
  if (!jwt || !anonKey) return null
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${jwt}` } } })
  const { data, error } = await asUser.rpc('legal_office_can_read')
  return !error && data === true ? firmId : null
}

const OFFICE_PREVIEW_MSG = 'Sign in to the office app to preview the firm’s portal.'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, ...privateHeaders, 'Content-Type': 'application/json' } })
}

/**
 * A `date` column's day (`paid_on`). An instant's day is `todayYmdInAppTz(new Date(iso))`, never its
 * first ten characters (the UTC date): the page dates the timeline the way the desk does, in
 * APP_CALENDAR_TZ (src/lib/legal/legalPacket.ts).
 */
function ymd(iso: unknown): string | null {
  const s = typeof iso === 'string' ? iso : ''
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

type Row = Record<string, unknown>

/**
 * The Lien desk's Timeline book, raw (punch list #41, PR 2): the two desk RPCs
 * over the book's 400-day window (they let the service role through since
 * migration 20260924030000), the live desk items, the jobs, their GCs and
 * standing rules, the property records and owner overrides, and the affidavit
 * and release filings — exactly what `useLienTimelineBook` reads for the
 * office. The page folds them with `assembleLienBookInput` + `buildLienTimelineBook`,
 * so counsel's grid on the portal is the office's book, live. Covers every
 * billed job with money open and a lien month (owner call, 2026-09-24 and again
 * 2026-10-05: the whole book, not only referred matters — dates and dollars,
 * nothing anyone said). Since v2.4616 the selects name their columns and
 * `shapeLienBookForCounsel` cuts every row again before it is sent: no desk
 * item `fields`, hold reason or spoken word, no filing note, sends or link, no
 * owner email, no address note. Null on any failure so the portal still opens.
 */
const LIEN_BOOK_WINDOW_DAYS = 400
// deno-lint-ignore no-explicit-any
async function readLienBook(admin: any): Promise<Record<string, unknown> | null> {
  try {
    const [monthsRes, affRes] = await Promise.all([
      admin.rpc('list_lien_notice_months', { p_within_days: LIEN_BOOK_WINDOW_DAYS }),
      admin.rpc('list_lien_affidavit_windows', { p_within_days: LIEN_BOOK_WINDOW_DAYS }),
    ])
    if (monthsRes.error) throw monthsRes.error
    const rows = (monthsRes.data ?? []) as Row[]
    const affidavitRows = (affRes.error ? [] : (affRes.data ?? [])) as Row[]
    const jobIds = [...new Set([...rows.map((r) => r.job_id as string), ...affidavitRows.map((r) => r.job_id as string)])]
    if (jobIds.length === 0) return { rows, affidavitRows, items: [], filings: [], jobs: [], gcs: [], addresses: [], owners: [] }
    const [jobsRes, itemsRes, filingsRes, ownersRes] = await Promise.all([
      // The same columns as the app's LIEN_BOOK_JOB_COLUMNS (src/lib/jobs/lienTimelineBookAssemble.ts, v2.5124); the firm's
      // book never carries customer_name, so it is cut below before the book is shaped.
      admin.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address, gc_customer_id, customer_address_id, revenue, payments_made, last_work_date, lien_payment_bond, lien_contract_ended_on, customer_name').in('id', jobIds),
      admin.from('job_lien_desk_items').select(LIEN_BOOK_COUNSEL_SELECT.deskItems).in('job_id', jobIds).is('voided_at', null).order('created_at', { ascending: false }),
      admin.from('job_lien_filings').select(LIEN_BOOK_COUNSEL_SELECT.filings).in('job_id', jobIds).in('kind', ['affidavit', 'release_of_record']).is('voided_at', null),
      admin.from('job_property_owners').select(LIEN_BOOK_COUNSEL_SELECT.owners).in('job_id', jobIds),
    ])
    const jobs = ((jobsRes.data ?? []) as Row[]).map(({ customer_name: _customerName, ...job }) => job)
    const gcIds = [...new Set(jobs.map((j) => j.gc_customer_id as string | null).filter((v): v is string => Boolean(v)))]
    const addressIds = [...new Set(jobs.map((j) => j.customer_address_id as string | null).filter((v): v is string => Boolean(v)))]
    const [gcRes, addrRes] = await Promise.all([
      gcIds.length ? admin.from('customers').select(LIEN_BOOK_COUNSEL_SELECT.gcs).in('id', gcIds) : Promise.resolve({ data: [] }),
      addressIds.length ? admin.from('customer_addresses').select(LIEN_BOOK_COUNSEL_SELECT.addresses).in('id', addressIds) : Promise.resolve({ data: [] }),
    ])
    return shapeLienBookForCounsel({
      rows,
      affidavitRows,
      items: itemsRes.data ?? [],
      filings: filingsRes.data ?? [],
      jobs,
      gcs: gcRes.data ?? [],
      addresses: addrRes.data ?? [],
      owners: ownersRes.data ?? [],
    })
  } catch (e) {
    console.error('legal-portal: lien book unreadable', e)
    return null
  }
}

/** Which of a pulled-back matter's entries the firm still reads: its fees and costs and the questions and answers, from before the pull-back, never voided. */
function pulledEntryTravels(e: Row, pulledAt: string | null): boolean {
  if (!['fee', 'cost', 'question', 'answer'].includes(e.kind as string)) return false
  if ((e as { voided_at?: string | null }).voided_at) return false
  if (pulledAt && typeof e.created_at === 'string' && e.created_at > pulledAt) return false
  return true
}

// Item 23's entry columns (without the void stamps, `MATTER_ENTRY_PENDING_COLUMNS`), so both reads stay shaped.
const ENTRY_COLS = MATTER_COUNSEL_SELECT.entries

/**
 * The matters' entries, with the undo stamps (#85 item 18, migration 20261006160000) — and, until that migration
 * is pushed, without them, so the portal never opens empty because a column is not there yet.
 */
// deno-lint-ignore no-explicit-any
async function readMatterEntries(admin: any, matterIds: string[]): Promise<{ data: unknown[] | null }> {
  const withVoid = await admin.from('legal_matter_entries').select(`${ENTRY_COLS}, ${MATTER_ENTRY_PENDING_COLUMNS.join(', ')}`).in('matter_id', matterIds).order('created_at')
  if (!withVoid.error) return withVoid
  return admin.from('legal_matter_entries').select(ENTRY_COLS).in('matter_id', matterIds).order('created_at')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { ...corsHeaders, ...privateHeaders } })
  try {
    const url = new URL(req.url)
    const rawToken = url.searchParams.get('token')?.trim()
    // What customers see (v2.3512): the sample token answers with the sample firm's empty portal — no link lookup, no view row, never a real matter.
    if (sampleStateFromToken(rawToken)) return jsonResponse(sampleLegalPortalResponse(PORTAL_COMPANY, todayYmdInAppTz()))
    // The office's preview by firm id (item 22): `?firm=<id>&preview=1`, a signed-in office session, no key.
    const firmParam = (url.searchParams.get('firm') ?? '').trim()
    const officeFirmId = !rawToken && /^[0-9a-f-]{36}$/i.test(firmParam) ? await officePreviewFirm(req, firmParam) : null
    if (!rawToken && firmParam && !officeFirmId) return jsonResponse({ error: OFFICE_PREVIEW_MSG }, 401)
    // A key is 5 to 128 characters: since v2.4756 the short address (`snell-law-f6a`, 13) is the key; the older keys are 64 and up to 60.
    if (!officeFirmId && (!rawToken || rawToken.length < 5 || rawToken.length > 128)) return jsonResponse({ error: 'Missing token' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

    // The guess gate (v2.4756): a caller with ten wrong keys in the hour is refused before any lookup; a right key is never refused.
    const ip = officeFirmId ? null : clientIpFromEdgeRequest(req)
    if (!officeFirmId && (await askGuessGate(admin, ip, false)).locked) return jsonResponse({ error: GUESS_LOCKED_MSG }, 429)

    // The hash first (item 22): the raw column is on its way out; it stays as the fallback for a link minted before the hash existed.
    let link: { firm_id: string; revoked_at: string | null } | null = officeFirmId ? { firm_id: officeFirmId, revoked_at: null } : null
    if (!link && rawToken) link = (await admin.from('legal_portal_links').select('firm_id, revoked_at').eq('token_hash', await sha256Hex(rawToken)).maybeSingle()).data as { firm_id: string; revoked_at: string | null } | null
    if (!link && rawToken) link = (await admin.from('legal_portal_links').select('firm_id, revoked_at').eq('token', rawToken).maybeSingle()).data as { firm_id: string; revoked_at: string | null } | null
    if (!link || link.revoked_at) {
      if (!officeFirmId) await askGuessGate(admin, ip, true)
      return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)
    }

    const { data: firm } = await admin.from('legal_firms').select('id, name, handling_name, email, phone, contingency_pct, filing_cost, active, paused_at').eq('id', link.firm_id).maybeSingle()
    if (!firm || !(firm as Row).active) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)
    // The firm's answers to Start here (v2.4821): read apart, so the payload never fails before the migration
    // lands; until then `intake` stays out of the answer and the portal hides the step.
    const intakeRead = await admin.from('legal_firms').select('intake, intake_sent_at, intake_sent_by').eq('id', link.firm_id).maybeSingle()
    const intakeRow = intakeRead.error ? null : ((intakeRead.data ?? null) as Row | null)
    const intakePart = intakeRead.error ? {} : { intake: { answers: shapeLegalFirmIntake(intakeRow?.intake), sentAt: (intakeRow?.intake_sent_at as string | null | undefined) ?? null, sentBy: String(intakeRow?.intake_sent_by ?? '') } }

    // The short domain's probe (v2.4750): a my.clickplumbing.com address that is no customer's is tried here by the
    // customer page before it falls through to the sub portal. Answers that the key opens, nothing more: no payload,
    // no view row (the page's own load counts the visit).
    if (url.searchParams.get('probe') === '1') return jsonResponse({ ok: true, firmName: String((firm as Row).name ?? '') })

    // View counting — fire-and-forget; office previews and staff sessions do not count, and neither does the
    // page's own quiet ten-minute reload (`refresh=1`, item 22): it is the same visit, not a new one.
    const isRefresh = url.searchParams.get('refresh') === '1'
    const viewDecision = await publicViewDecision(req, admin, Deno.env.get('SUPABASE_ANON_KEY'))
    if (!isRefresh) void admin
      .from('public_page_views')
      .insert({ surface: 'legal_portal', entity_id: link.firm_id, via: 'token', viewer: viewDecision.viewer, viewer_user_id: viewDecision.staffUserId })
      .then(
        ({ error }: { error: unknown }) => {
          if (error && viewDecision.count) void admin.from('public_page_views').insert({ surface: 'legal_portal', entity_id: link!.firm_id, via: 'token' }).then(() => {}, () => {})
        },
        () => {},
      )

    const todayYmd = todayYmdInAppTz()
    const { data: particularsRow } = await admin.from('app_settings').select('value_text').eq('key', 'legal_particulars_v1').maybeSingle()
    let particulars: Record<string, string> = {}
    try {
      const parsed = JSON.parse(((particularsRow as Row | null)?.value_text as string) ?? '{}')
      if (parsed && typeof parsed === 'object') particulars = parsed as Record<string, string>
    } catch {
      particulars = {}
    }

    // The firm's people and their email rules (PR 5) — the portal's Notifications page.
    // v2.4662: `*` so the read never waits on the migration that adds send_failed_since; only the mapped fields leave
    // (no token hash, no salt). `failingSince` is the company-zone day emails to the person began failing.
    const { data: recRows } = await admin.from('legal_firm_recipients').select('*').eq('firm_id', link.firm_id).is('removed_at', null).order('created_at')
    const recipients = ((recRows ?? []) as Row[]).map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, mode: r.mode, scope: r.scope, digestWeekday: r.digest_weekday, digestTime: r.digest_time, confirmed: r.confirmed_at != null, paused: r.paused_at != null, addedViaPortal: Boolean(r.added_via_portal), failingSince: typeof r.send_failed_since === 'string' ? todayYmdInAppTz(new Date(r.send_failed_since)) : null }))
    const firmPaused = (firm as Row).paused_at != null

    // Item 20's floor columns ride the named list once its migration (20261006140000) is pushed; until then the
    // read without them answers, and every matter reads no floor (item 23 names the columns, so '*' is gone).
    const readMatters = (cols: string) => admin.from('legal_matters').select(cols).eq('firm_id', link.firm_id).in('stage', LEGAL_PORTAL_STAGES).is('closed_at', null).order('released_at')
    let matterRes = await readMatters(`${MATTER_COUNSEL_SELECT.matters}, settlement_floor_amount, settlement_floor_pct`)
    if (matterRes.error) matterRes = await readMatters(MATTER_COUNSEL_SELECT.matters)
    const matterRows = matterRes.data
    const matters = (matterRows ?? []) as Row[]
    // #85 item 16: a matter the office pulled back stays readable, slim — the reason, the firm's own fees and
    // steps, the conversation. None of the customer's records: counsel no longer has the matter. A column the
    // migration has not added yet reads as no pulled matters.
    const { data: pulledRows } = await admin.from('legal_matters').select('id, payer_name, pulled_at, pulled_reason').eq('firm_id', link.firm_id).eq('stage', 'review').not('pulled_at', 'is', null).order('pulled_at', { ascending: false }).limit(50)
    const pulled = (pulledRows ?? []) as Row[]
    const { data: pulledEntryRows } = pulled.length
      ? await readMatterEntries(admin, pulled.map((p) => p.id as string))
      : { data: [] }
    const pulledMatters = pulled.map((p) => ({
      id: p.id,
      payerName: p.payer_name,
      pulledAt: p.pulled_at ? todayYmdInAppTz(new Date(p.pulled_at as string)) : null,
      reason: (p.pulled_reason as string | null) ?? '',
      // Slim (#85 item 16 review): only the firm's own fee and cost rows and the conversation, dated before the
      // pull-back, and never a voided row. The office's steps, notes and anything after the pull-back stay home.
      entries: ((pulledEntryRows ?? []) as Row[]).filter((e) => e.matter_id === p.id && pulledEntryTravels(e, p.pulled_at as string | null)),
    })).map((pm) => ({ ...pm, entries: (shapeMatterForCounsel({ jobs: [], entries: pm.entries }).entries as Row[]) }))
    // Who the firm calls (v2.4755): the office line with the assistants to ask for, and the controller's own number.
    const { data: officeRows } = await admin.from('users').select('name, phone, role').match(REAL_ACCOUNT).is('archived_at', null).in('role', [...LEGAL_OFFICE_CONTACT_ROLES]).order('name')
    const officeContacts = officeContactsFromUsers(((officeRows ?? []) as Array<{ name: string | null; phone: string | null; role: string }>), PORTAL_COMPANY.phone)
    if (matters.length === 0) {
      return jsonResponse({ company: PORTAL_COMPANY, preparedOn: todayYmd, firm, particulars, officeContacts, ...intakePart, recipients, firmPaused, matters: [], pulledMatters, lienBook: await readLienBook(admin) })
    }
    const matterIds = matters.map((m) => m.id as string)
    const { data: linkRows } = await admin.from('legal_matter_jobs').select('matter_id, job_id').in('matter_id', matterIds)
    const jobIdsByMatter = new Map<string, string[]>()
    for (const l of (linkRows ?? []) as Row[]) jobIdsByMatter.set(l.matter_id as string, [...(jobIdsByMatter.get(l.matter_id as string) ?? []), l.job_id as string])
    const allJobIds = [...new Set([...jobIdsByMatter.values()].flat())]
    const customerIds = [...new Set(matters.map((m) => m.customer_id as string | null).filter((x): x is string => Boolean(x)))]

    const [jobsRes, invRes, payRes, custRes, personsRes, addrRes, contractsRes, estRes, demandRes, filingRes, deskItemRes, promRes, touchRes, contactRes, reportRes, tplRes, sessRes, noteRes, entryRes] = await Promise.all([
      allJobIds.length ? admin.from('jobs_ledger').select(MATTER_COUNSEL_SELECT.jobs).in('id', allJobIds) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('jobs_ledger_invoices').select(MATTER_COUNSEL_SELECT.invoices).in('job_id', allJobIds) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('jobs_ledger_payments').select(MATTER_COUNSEL_SELECT.payments).in('job_id', allJobIds) : Promise.resolve({ data: [] }),
      customerIds.length ? admin.from('customers').select(MATTER_COUNSEL_SELECT.customers).in('id', customerIds) : Promise.resolve({ data: [] }),
      customerIds.length ? admin.from('customer_contact_persons').select(MATTER_COUNSEL_SELECT.contactPersons).in('customer_id', customerIds) : Promise.resolve({ data: [] }),
      customerIds.length ? admin.from('customer_addresses').select(MATTER_COUNSEL_SELECT.addresses).in('customer_id', customerIds).order('sequence_order') : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('job_contracts').select(MATTER_COUNSEL_SELECT.contracts).in('job_id', allJobIds).is('voided_at', null) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('estimates').select(MATTER_COUNSEL_SELECT.estimates).in('job_ledger_id', allJobIds).eq('status', 'customer_accepted').not('acceptor_consented_at', 'is', null) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('job_demand_letters').select(MATTER_COUNSEL_SELECT.demandLetters).in('job_id', allJobIds) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('job_lien_filings').select(MATTER_COUNSEL_SELECT.filings).in('job_id', allJobIds) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('job_lien_desk_items').select('id, job_id, kind, status, sent_at, sent_filing_id, fields, created_at, voided_at').in('job_id', allJobIds).eq('kind', 'notice_53_056').is('voided_at', null) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('job_payment_promises').select('id, job_id, customer_id, promised_date, said_by, heard_by, channel, source, note, created_at, voided_at').in('job_id', allJobIds).is('voided_at', null) : Promise.resolve({ data: [] }),
      customerIds.length ? admin.from('job_payment_chase_touches').select('id, customer_id, job_id, outcome, note, promised_date, snooze_days, resolved_at, created_at, created_by').in('customer_id', customerIds) : Promise.resolve({ data: [] }),
      customerIds.length ? admin.from('customer_contacts').select('id, customer_id, contact_date, contact_method, details, created_by').in('customer_id', customerIds).order('contact_date') : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('reports').select('id, job_ledger_id, created_at, created_by_user_id, template_id, reported_at_lat').in('job_ledger_id', allJobIds) : Promise.resolve({ data: [] }),
      admin.from('report_templates').select('id, name'),
      allJobIds.length ? admin.from('clock_sessions').select('job_ledger_id, work_date, clocked_in_at, clocked_out_at, clock_in_lat, approved_at, rejected_at, revoked_at').in('job_ledger_id', allJobIds).order('work_date').limit(2000) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('jobs_ledger_thread_notes').select('job_id, created_at').in('job_id', allJobIds).order('created_at', { ascending: false }).limit(2000) : Promise.resolve({ data: [] }),
      readMatterEntries(admin, matterIds),
    ])

    const jobs = (jobsRes.data ?? []) as Row[]
    const invoices = (invRes.data ?? []) as Row[]
    const payments = (payRes.data ?? []) as Row[]
    const customers = (custRes.data ?? []) as Row[]
    const persons = (personsRes.data ?? []) as Row[]
    const addresses = (addrRes.data ?? []) as Row[]
    const contracts = (contractsRes.data ?? []) as Row[]
    const estimates = (estRes.data ?? []) as Row[]
    const demands = (demandRes.data ?? []) as Row[]
    const filings = (filingRes.data ?? []) as Row[]
    // The notice desk items shaped down to the sent-notice facts (#41 PR 1b): the owner's call, letter two, the GC's okay.
    // The rest of the office's draft (the cover letter, a skip's reason, the leader's spoken word) never leaves.
    const deskItems = ((deskItemRes.data ?? []) as Row[]).map((it) => {
      const f = (it.fields && typeof it.fields === 'object' ? it.fields : {}) as Row
      return { id: it.id, job_id: it.job_id, kind: it.kind, status: it.status, sent_at: it.sent_at ?? null, sent_filing_id: it.sent_filing_id ?? null, created_at: it.created_at, voided_at: it.voided_at ?? null, fields: { letterTwo: f.letterTwo ?? null, gcAuthorizedDirectPay: f.gcAuthorizedDirectPay ?? null, ownerCall: f.ownerCall ?? null } }
    })
    const promises = (promRes.data ?? []) as Row[]
    const touches = (touchRes.data ?? []) as Row[]
    const contacts = (contactRes.data ?? []) as Row[]
    const reports = (reportRes.data ?? []) as Row[]
    const templates = new Map(((tplRes.data ?? []) as Row[]).map((t) => [t.id as string, (t.name as string) ?? '']))
    const sessions = (sessRes.data ?? []) as Row[]
    const notes = (noteRes.data ?? []) as Row[]
    const entries = (entryRes.data ?? []) as Row[]

    // The payer's jobs (item 24): their numbers tell a contact log entry about an unreferred job from one about the
    // matter or the account. The log has no job column; an entry names a job by its number.
    const { data: payerJobRows } = customerIds.length
      ? await admin.from('jobs_ledger').select('id, hcp_number, click_number, customer_id, gc_customer_id').or(`customer_id.in.(${customerIds.join(',')}),gc_customer_id.in.(${customerIds.join(',')})`).limit(5000)
      : { data: [] }
    const payerJobs = (payerJobRows ?? []) as Row[]

    // Property per job (#85 item 6): the record each job names, whichever customer holds it (on a GC-paid
    // job the payer's addresses are the GC's offices), and the job's owner override, shaped without the
    // owner's email. The packet kernel resolves one property per job and runs each job's lien clock from it.
    const jobAddressIds = [...new Set(jobs.map((j) => j.customer_address_id as string | null).filter((v): v is string => Boolean(v)))]
    const [jobAddrRes, ownerRes] = await Promise.all([
      jobAddressIds.length ? admin.from('customer_addresses').select(MATTER_COUNSEL_SELECT.jobAddresses).in('id', jobAddressIds) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('job_property_owners').select(MATTER_COUNSEL_SELECT.jobOwners).in('job_id', allJobIds) : Promise.resolve({ data: [] }),
    ])
    const jobAddressRows = (jobAddrRes.data ?? []) as Row[]
    const ownerRows = (ownerRes.data ?? []) as Row[]

    // Documents from the office (v2.4810): the live ones. Until the migration is pushed the table is missing and
    // the list is empty, so the portal still opens. Held ones only count; the rest get a 15-minute link.
    const { data: docRows, error: docErr } = await admin.from('legal_matter_documents').select('id, matter_id, title, shows, storage_path, mime, size_bytes, added_by, added_at, held_reason').in('matter_id', matterIds).is('voided_at', null).order('added_at')
    const documentRows = docErr ? [] : ((docRows ?? []) as Row[])
    const documentHeld = (d: Row) => String(d.held_reason ?? '').trim().length > 0
    const documentUrls = new Map<string, string>()
    await Promise.all(documentRows.filter((d) => !documentHeld(d)).map(async (d) => {
      const { data: signed } = await admin.storage.from(LEGAL_MATTER_DOCUMENTS_BUCKET).createSignedUrl(d.storage_path as string, SIGNED_PDF_SECONDS)
      if (signed?.signedUrl) documentUrls.set(d.id as string, signed.signedUrl)
    }))
    // The narrative for the firm (v2.4812), in its own read: until the migration is pushed the columns are
    // missing, and the matters read above must not fail with them.
    const { data: narrRows, error: narrErr } = await admin.from('legal_matters').select('id, narrative_md, narrative_updated_at, narrative_updated_by').in('id', matterIds)
    const narrativeRows = new Map((narrErr ? [] : ((narrRows ?? []) as Row[])).map((r) => [r.id as string, r] as const))

    // Names for the office people the packet mentions (who flagged, who logged, who heard).
    const userIds = new Set<string>()
    for (const j of jobs) if (j.collections_by) userIds.add(j.collections_by as string)
    for (const c of contacts) if (c.created_by) userIds.add(c.created_by as string)
    for (const t of touches) if (t.created_by) userIds.add(t.created_by as string)
    for (const p of promises) if (p.heard_by) userIds.add(p.heard_by as string)
    for (const r of reports) if (r.created_by_user_id) userIds.add(r.created_by_user_id as string)
    for (const d of documentRows) if (d.added_by) userIds.add(d.added_by as string)
    for (const r of narrativeRows.values()) if (r.narrative_updated_by) userIds.add(r.narrative_updated_by as string)
    const { data: userRows } = userIds.size ? await admin.from('users').select('id, name').in('id', [...userIds]) : { data: [] }
    const userName = new Map(((userRows ?? []) as Row[]).map((u) => [u.id as string, (u.name as string | null) ?? null]))

    // Signed contract PDFs as short-lived signed URLs: fifteen minutes (item 22), so a link copied out of the page,
    // or the page of a firm whose link was just turned off, stops opening soon. The page mints fresh ones on reload.
    const contractUrls = new Map<string, string>()
    for (const c of contracts) {
      const path = (c.signed_pdf_path as string | null) ?? (c.paper_upload_path as string | null)
      if (!path) continue
      const { data: signed } = await admin.storage.from(JOB_CONTRACT_BUCKET).createSignedUrl(path, SIGNED_PDF_SECONDS)
      if (signed?.signedUrl) contractUrls.set(c.id as string, signed.signedUrl)
    }

    const jobsById = new Map(jobs.map((j) => [j.id as string, j] as const))
    const out = matters.map((m) => {
      const jobIds = jobIdsByMatter.get(m.id as string) ?? []
      const mJobs = jobIds.map((id) => jobsById.get(id)).filter((j): j is Row => Boolean(j))
      const jobIdSet = new Set(jobIds)
      const customerId = (m.customer_id as string | null) ?? null
      const heldOverrides = (m.held_overrides && typeof m.held_overrides === 'object' ? (m.held_overrides as Record<string, unknown>) : {}) as Record<string, unknown>
      // #85 item 29 (owner, 2026-10-05): everything goes to counsel unless the office held it back —
      // `true` holds, nothing else does (an old `false` is the default now). The same rule as the desk's
      // kernel (src/lib/legal/legalPacket.ts). The reasons (`_reasons`) never leave; the count does.
      let heldCount = 0
      const goes = (key: string): boolean => {
        if (heldOverrides[key] === true) {
          heldCount++
          return false
        }
        return true
      }
      // Every entry that arrives is marked shared, so a page still on the old pre-bill rule shows it too.
      const sharedOverrides: Record<string, boolean> = {}
      const share = (key: string): boolean => {
        if (!goes(key)) return false
        sharedOverrides[key] = false
        return true
      }

      const mInvoices = invoices.filter((i) => jobIdSet.has(i.job_id as string))
      const mPayments = payments.filter((p) => jobIdSet.has(p.job_id as string))
      const jobsWithDetails = mJobs.map((j) => ({
        ...j,
        invoices: mInvoices.filter((i) => i.job_id === j.id),
        payments: mPayments.filter((p) => p.job_id === j.id),
        gcCustomer: j.gc_customer_id ? { id: j.gc_customer_id, name: customers.find((c) => c.id === j.gc_customer_id)?.name ?? null } : null,
        collections_by_name: userName.get(j.collections_by as string) ?? null,
      }))
      const contactNumbers = contactScopeNumbers(mJobs, payerJobs.filter((j) => customerId != null && (j.customer_id === customerId || j.gc_customer_id === customerId)))
      const mContacts = contacts
        .filter((c) => customerId && c.customer_id === customerId)
        .filter((c) => contactGoesWithShare(c.details as string | null, contactNumbers, heldOverrides[`contact:${c.id as string}`]))
        .map((c) => ({ id: c.id as string, ymd: c.contact_date ? todayYmdInAppTz(new Date(c.contact_date as string)) : todayYmd, method: (c.contact_method as string | null) ?? null, by: userName.get(c.created_by as string) ?? null, text: ((c.details as string | null) ?? '').trim() }))
        .filter((c) => share(`contact:${c.id}`))
      const mPromises = promises
        .filter((p) => jobIdSet.has(p.job_id as string))
        .map((p) => ({ id: p.id as string, jobId: p.job_id as string, customerId: (p.customer_id as string | null) ?? null, promisedYmd: p.promised_date as string, saidBy: (p.said_by as string | null) ?? null, heardByName: userName.get(p.heard_by as string) ?? null, channel: (p.channel as string | null) ?? null, source: p.source === 'customer' ? 'customer' : 'office', note: (p.note as string | null) ?? null, createdAt: p.created_at as string }))
        .filter((p) => share(`promise:${p.id}`))
      const mTouches = touches
        .filter((t) => t.job_id ? jobIdSet.has(t.job_id as string) : customerId != null && t.customer_id === customerId)
        .map((t) => ({ id: t.id as string, customerId: t.customer_id as string, jobId: (t.job_id as string | null) ?? null, outcome: t.outcome as string, note: (t.note as string | null) ?? null, promisedYmd: (t.promised_date as string | null) ?? null, snoozeDays: (t.snooze_days as number | null) ?? null, resolvedAt: (t.resolved_at as string | null) ?? null, createdAt: t.created_at as string, createdByName: userName.get(t.created_by as string) ?? 'the office' }))
        .filter((t) => share(`call:${t.id}`))
      // The collections note rides on the job; a held note is blanked, the job stays.
      for (const j of jobsWithDetails) {
        if (j.collections_note && !share(`note:${j.id}`)) (j as Row).collections_note = null
      }
      // Promise records: the outcome inputs (billed at the promise, dated payments) — the page classifies.
      const promiseRecords = mPromises.map((p) => ({
        id: p.id,
        jobId: p.jobId,
        customerId: p.customerId,
        promisedYmd: p.promisedYmd,
        createdAt: p.createdAt,
        source: p.source,
        billedTotal: billedAtPromise(mInvoices, p.jobId, p.createdAt),
        payments: mPayments.filter((x) => x.job_id === p.jobId && x.paid_on).map((x) => ({ paidOn: ymd(x.paid_on) as string, amount: Number(x.amount ?? 0) })).sort((a, b) => a.paidOn.localeCompare(b.paidOn)),
      }))
      const customer = customers.find((c) => c.id === customerId) ?? null
      return shapeMatterForCounsel({
        id: m.id,
        stage: m.stage,
        payer: { key: m.payer_key, name: m.payer_name, customerId },
        handling: m.handling_name,
        noteToFirm: m.note_to_firm,
        releasedAt: m.released_at ? todayYmdInAppTz(new Date(m.released_at as string)) : null,
        feesToStatement: Boolean(m.fees_to_statement),
        heldCount,
        documents: documentRows.filter((d) => d.matter_id === m.id && !documentHeld(d)).map((d) => legalPortalDocumentFromRow(d as { id: string; title: string; shows: string; mime: string | null; size_bytes: number | null; added_at: string | null }, (d.added_by ? userName.get(d.added_by as string) : null) ?? '', documentUrls.get(d.id as string) ?? '', (iso) => todayYmdInAppTz(new Date(iso)))),
        heldDocumentCount: documentRows.filter((d) => d.matter_id === m.id && documentHeld(d)).length,
        narrative: (() => {
          const r = narrativeRows.get(m.id as string)
          return r ? legalNarrativeFromRow(r as { narrative_md?: string | null; narrative_updated_at?: string | null }, (r.narrative_updated_by ? userName.get(r.narrative_updated_by as string) : null) ?? '', (iso) => todayYmdInAppTz(new Date(iso))) : null
        })(),
        // #85 item 20: the office's settlement floor (dollars or a percent of the balance); both null = none.
        settlementFloor: { amount: m.settlement_floor_amount ?? null, pct: m.settlement_floor_pct ?? null },
        sharedOverrides,
        jobs: jobsWithDetails,
        customer,
        contacts: persons.filter((p) => customerId && p.customer_id === customerId).map((p) => ({ name: p.name, email: p.email ?? null, phone: p.phone ?? null, note: p.note ?? null })),
        contactEntries: mContacts,
        addresses: addresses.filter((a) => customerId && a.customer_id === customerId),
        jobAddresses: jobAddressRows.filter((a) => mJobs.some((j) => j.customer_address_id === a.id)),
        jobOwners: ownerRows.filter((o) => jobIdSet.has(o.job_id as string)),
        contracts: contracts.filter((c) => jobIdSet.has(c.job_id as string)).map((c) => ({ ...c, signedPdfUrl: contractUrls.get(c.id as string) ?? null, signed_pdf_path: undefined, paper_upload_path: undefined })),
        signedEstimates: estimates.filter((e) => jobIdSet.has(e.job_ledger_id as string)),
        demandLetters: demands.filter((d) => jobIdSet.has(d.job_id as string)),
        lienFilings: filings.filter((f) => jobIdSet.has(f.job_id as string)),
        lienDeskItems: deskItems.filter((it) => jobIdSet.has(it.job_id as string)),
        promises: mPromises,
        promiseRecords,
        chaseTouches: mTouches,
        reports: reports.filter((r) => jobIdSet.has(r.job_ledger_id as string)).map((r) => ({ jobId: r.job_ledger_id as string, createdAt: (r.created_at as string) ?? todayYmd, authorName: userName.get(r.created_by_user_id as string) ?? '', templateName: templates.get(r.template_id as string) ?? '', hasGps: r.reported_at_lat != null })),
        clockSessions: sessions.filter((s) => jobIdSet.has(s.job_ledger_id as string)).map((s) => ({ jobId: s.job_ledger_id as string, workDate: s.work_date as string, clockedInAt: s.clocked_in_at as string, clockedOutAt: (s.clocked_out_at as string | null) ?? null, hasGps: s.clock_in_lat != null, approved: s.approved_at != null, disqualified: s.rejected_at != null || s.revoked_at != null })),
        // Job notes travel as a count per job (item 23): the packet draws how many, never a body or an author.
        threadNotes: notes.filter((n) => jobIdSet.has(n.job_id as string)).map((n) => ({ jobId: n.job_id as string, body: '', createdAt: n.created_at as string, authorName: null })),
        entries: entries.filter((e) => e.matter_id === m.id),
      })
    })

    return jsonResponse({ company: PORTAL_COMPANY, preparedOn: todayYmd, firm, particulars, officeContacts, ...intakePart, recipients, firmPaused, matters: out, pulledMatters, lienBook: await readLienBook(admin) })
  } catch (e) {
    return jsonResponse(unexpectedErrorBody('legal-portal', e), 500)
  }
})
