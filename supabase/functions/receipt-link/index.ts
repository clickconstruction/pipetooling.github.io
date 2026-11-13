import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { calendarYmdInAppTzFromIso, ymdAddDays } from '../_shared/appTimeZone.ts'
import { orderSortModeDayJobIds, type SortModeSessionRow } from '../_shared/dayJobsOrder.ts'
import { ESTIMATE_LINK_LOCKED_CODE, recordEstimateLinkMiss } from '../_shared/estimateLinkMisses.ts'
import { buildLedgerPrefixMap, formatJobLedgerShortLine, type LedgerPrefixMap } from '../_shared/gcKernels/lib/ledgerDisplayPrefixes.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import {
  RECEIPT_LINK_CAPS,
  RECEIPT_LINK_WORDS,
  buildReceiptCharge,
  mintReceiptLinkCode,
  receiptChargeDead,
  receiptHexOf,
  receiptLinkCode,
  receiptLinkExpired,
  receiptLinkExpiry,
  receiptNextPageNo,
  receiptSniff,
  receiptTicketJob,
  type ReceiptJobPick,
  type ReceiptPageCharge,
} from '../_shared/receiptLink.ts'
import { COUNTER_TICKETS_BUCKET, ticketStoragePath } from '../_shared/ticketNames.ts'

/**
 * receipt-link (punch list #299, PR 1, v2.7101): a receipt link for a card charge. The page at `/r/<code>` opens one
 * charge, or the few a text folds together, with no sign-in, and takes a photo of the receipt. The photo is a counter
 * ticket (#295) with `source = link`, already on its charge with `match_kind = link`, so the office reads it on the
 * Team queue and the Tickets list as any ticket. This function is the only thing that writes a request, a link, or a
 * ticket made through one.
 *
 * The page, no auth (`verify_jwt = false`; the ten-letter code is the capability, as an estimate's link is):
 *   GET  ?code=<ten letters>                 → { ok, charges, closesOn } each charge's store, amount, day and whose card,
 *                                              where the office sorted it, the ticket it has, and the holder's jobs
 *                                              around that day when nobody has said the job. Never another charge, a
 *                                              job's folder, a price list or a person's last name. 404 for a code that
 *                                              opens nothing (a miss, counted; 429 `locked` past 20 in the hour), 410
 *                                              `closed` past fourteen days.
 *   GET  ?code=<code>&page=<page id>         → the bytes of one page of the ticket on one of the link's charges, for the
 *                                              page's own thumbnail. From the counter-tickets bucket, never Drive.
 *   POST { code, action: 'page', charge, pageId, data, width?, height?, originalBytes?, job?, replace? }
 *                                            → { ok, charge, kept? } `data` is the page as base64. Its first bytes must
 *                                              be a JPEG, a PNG, a WebP or a PDF. The first page makes the ticket on the
 *                                              charge; a charge that has its ticket already (taken in Tally) takes the
 *                                              page on that ticket. `replace` is Retake: the page it names goes, unless
 *                                              the sweep has filed it, and then the new shot is added and `kept` says so.
 *                                              A second try with the same `pageId` changes nothing.
 *   POST { code, action: 'job', charge, job } → { ok, charge } the job chip tapped after the upload, on a ticket made
 *                                              through a link that the office has not used, on a charge not yet sorted.
 *
 * The office, signed in (`is_office_staff`):
 *   POST { action: 'desk.mint', chargeId }   → { code, closesOn } the charge's request, made on the first ask
 *                                              (`receipt_request_ensure`), and a new code handed out once. An earlier
 *                                              code stays open until its own day.
 *
 * Rate limit: 60 calls a minute per client address and 600 across the isolate, in memory, best effort. No text is sent
 * from here; the text is PR 2.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PER_IP_PER_MINUTE = 60
const TOTAL_PER_MINUTE = 600
const WINDOW_MS = 60_000
const hits = new Map<string, number[]>()

function rateLimited(ip: string, now: number): boolean {
  let total = 0
  for (const [k, arr] of hits) {
    const kept = arr.filter((t) => now - t < WINDOW_MS)
    if (kept.length === 0) hits.delete(k)
    else {
      hits.set(k, kept)
      total += kept.length
    }
  }
  const mine = hits.get(ip) ?? []
  if (mine.length >= PER_IP_PER_MINUTE || total >= TOTAL_PER_MINUTE) return true
  mine.push(now)
  hits.set(ip, mine)
  return false
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

// deno-lint-ignore no-explicit-any
type Admin = any

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type LinkRow = { id: string; request_ids: string[]; expires_at: string; opened_at: string | null; open_count: number }
type RequestRow = { id: string; mercury_transaction_id: string; holder_user_id: string | null; holder_name: string; opened_at: string | null; answered_at: string | null; closed_at: string | null }
type ChargeRow = { id: string; amount: number | string; counterparty_name: string | null; posted_at: string | null; status: string | null; swipe: string | null }
type TicketPageRow = { id: string; page_no: number; mime: string; storage_path: string | null; drive_file_id: string | null }
type TicketRow = { id: string; source: string; taken_at: string; taken_by: string | null; job_id: string | null; no_one_job: boolean; used_at: string | null; mercury_transaction_id: string; counter_ticket_pages: TicketPageRow[] | null }
type JobRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; service_type_id: string | null }

async function sha256(value: string): Promise<string> {
  return receiptHexOf(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
}

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await query
  if (error) throw new Error(`${what}: ${error.message}`)
  return (data ?? []) as T[]
}

async function findLink(admin: Admin, code: string): Promise<LinkRow | null> {
  const { data, error } = await admin.from('receipt_links').select('id, request_ids, expires_at, opened_at, open_count').eq('code_hash', await sha256(code)).maybeSingle()
  if (error) throw new Error(`the link: ${error.message}`)
  return data as LinkRow | null
}

/** Everything the page is told about a link's charges, and what a write needs of each: read as the service role. */
async function loadCharges(admin: Admin, requestIds: readonly string[]): Promise<{ page: ReceiptPageCharge[]; byRequest: Map<string, { request: RequestRow; charge: ChargeRow; ticket: TicketRow | null; sortedJobIds: string[]; dayJobIds: string[] }> }> {
  const requests = await rows<RequestRow>(admin.from('receipt_requests').select('id, mercury_transaction_id, holder_user_id, holder_name, opened_at, answered_at, closed_at').in('id', [...requestIds]), 'the requests')
  const chargeIds = requests.map((r) => r.mercury_transaction_id)
  if (chargeIds.length === 0) return { page: [], byRequest: new Map() }
  const [charges, splits, tickets] = await Promise.all([
    rows<ChargeRow>(admin.from('mercury_transactions').select('id, amount, counterparty_name, posted_at, status, swipe:raw->>createdAt').in('id', chargeIds), 'the charges'),
    rows<{ mercury_transaction_id: string; job_id: string | null; amount: number | string }>(admin.from('mercury_transaction_job_allocations').select('mercury_transaction_id, job_id, amount').in('mercury_transaction_id', chargeIds), 'the sort'),
    rows<TicketRow>(
      admin.from('counter_tickets').select('id, source, taken_at, taken_by, job_id, no_one_job, used_at, mercury_transaction_id, counter_ticket_pages(id, page_no, mime, storage_path, drive_file_id)').in('mercury_transaction_id', chargeIds).is('removed_at', null),
      'the tickets',
    ),
  ])
  const chargeById = new Map(charges.map((c) => [c.id, c]))
  const ticketByCharge = new Map(tickets.map((t) => [t.mercury_transaction_id, t]))
  const sortedByCharge = new Map<string, string[]>()
  for (const id of chargeIds) {
    const mine = splits.filter((s) => s.mercury_transaction_id === id && s.job_id).sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
    sortedByCharge.set(id, [...new Set(mine.map((s) => s.job_id as string))])
  }

  // The holder's jobs around the day of the swipe, for a charge nobody has put on a job: Sort mode's own rule.
  const dayJobsByRequest = new Map<string, string[]>()
  for (const r of requests) {
    const c = chargeById.get(r.mercury_transaction_id)
    const anchor = c ? calendarYmdInAppTzFromIso(c.swipe ?? c.posted_at ?? '') : ''
    if (!c || !r.holder_user_id || !anchor || (sortedByCharge.get(c.id) ?? []).length > 0) continue
    const days = [ymdAddDays(anchor, -1), anchor, ymdAddDays(anchor, 1)]
    const [sessions, blocks] = await Promise.all([
      rows<SortModeSessionRow>(admin.from('clock_sessions').select('work_date, job_ledger_id').eq('user_id', r.holder_user_id).in('work_date', days).is('rejected_at', null).is('revoked_at', null).order('clocked_in_at'), 'the clock'),
      rows<{ work_date: string; job_id: string | null }>(admin.from('job_schedule_blocks').select('work_date, job_id').eq('assignee_user_id', r.holder_user_id).in('work_date', days).order('time_start', { ascending: true }), 'the schedule'),
    ])
    const scheduledByDay = new Map<string, string[]>()
    for (const b of blocks) if (b.job_id) scheduledByDay.set(b.work_date, [...(scheduledByDay.get(b.work_date) ?? []), b.job_id])
    dayJobsByRequest.set(r.id, orderSortModeDayJobIds({ anchorYmd: anchor, beforeYmd: days[0]!, afterYmd: days[2]!, sessions, scheduledByDay }))
  }

  const jobIds = new Set<string>()
  for (const ids of sortedByCharge.values()) for (const id of ids) jobIds.add(id)
  for (const ids of dayJobsByRequest.values()) for (const id of ids) jobIds.add(id)
  for (const t of tickets) if (t.job_id) jobIds.add(t.job_id)
  const jobLabels = new Map<string, string>()
  if (jobIds.size > 0) {
    const [jobs, prefixRows] = await Promise.all([
      rows<JobRow>(admin.from('jobs_ledger').select('id, hcp_number, click_number, job_name, service_type_id').in('id', [...jobIds]), 'the jobs'),
      rows<{ id: string; ledger_job_prefix: string | null; ledger_bid_prefix: string | null }>(admin.from('service_types').select('id, ledger_job_prefix, ledger_bid_prefix'), 'the job prefixes'),
    ])
    const prefixes: LedgerPrefixMap = buildLedgerPrefixMap(prefixRows)
    for (const j of jobs) jobLabels.set(j.id, formatJobLedgerShortLine(prefixes, j.service_type_id, j.hcp_number?.trim() || null, j.job_name?.trim() || null, j.click_number ?? null).trim())
  }

  const byRequest = new Map<string, { request: RequestRow; charge: ChargeRow; ticket: TicketRow | null; sortedJobIds: string[]; dayJobIds: string[] }>()
  const page: ReceiptPageCharge[] = []
  // In the link's own order, so the page lists the charges as the text named them.
  for (const id of requestIds) {
    const request = requests.find((r) => r.id === id)
    const charge = request ? chargeById.get(request.mercury_transaction_id) : undefined
    if (!request || !charge) continue
    const ticket = ticketByCharge.get(charge.id) ?? null
    const sortedJobIds = sortedByCharge.get(charge.id) ?? []
    const dayJobIds = dayJobsByRequest.get(request.id) ?? []
    byRequest.set(request.id, { request, charge, ticket, sortedJobIds, dayJobIds })
    page.push(
      buildReceiptCharge({
        requestId: request.id,
        amount: Number(charge.amount),
        counterpartyName: charge.counterparty_name,
        swipeAt: charge.swipe,
        postedAt: charge.posted_at,
        status: charge.status,
        holderName: request.holder_name,
        requestClosedAt: request.closed_at,
        sortedJobIds,
        ticket: ticket ? { id: ticket.id, source: ticket.source, taken_at: ticket.taken_at, job_id: ticket.job_id, no_one_job: ticket.no_one_job, used_at: ticket.used_at, pages: (ticket.counter_ticket_pages ?? []).map((p) => ({ id: p.id, page_no: p.page_no, mime: p.mime })) } : null,
        dayJobIds,
        jobLabels,
      }),
    )
  }
  return { page, byRequest }
}

function bytesOfBase64(data: string): Uint8Array | null {
  try {
    const b64 = data.includes(',') && data.startsWith('data:') ? data.slice(data.indexOf(',') + 1) : data
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function whole(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 2_000_000_000) : 0
}

// ---------------------------------------------------------------------------------------------------------------------
// The office.

async function deskCaller(req: Request, supabaseUrl: string): Promise<{ userId: string } | null> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth) return null
  const mine = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: u } = await mine.auth.getUser()
  const userId = u?.user?.id
  if (!userId) return null
  const { data: ok } = await mine.rpc('is_office_staff')
  return ok === true ? { userId } : null
}

async function deskMint(req: Request, admin: Admin, supabaseUrl: string, body: Record<string, unknown>): Promise<Response> {
  const caller = await deskCaller(req, supabaseUrl)
  if (!caller) return json({ error: RECEIPT_LINK_WORDS.deskOnly }, 403)
  const archived = await refuseArchivedCaller(admin, caller.userId, corsHeaders)
  if (archived) return archived
  // A training account and a twin write nothing: the fences hold them on a table, and this write is the service role's.
  const { data: me } = await admin.from('users').select('read_only, role').eq('id', caller.userId).maybeSingle()
  if ((me as { read_only?: boolean | null } | null)?.read_only) return json({ error: 'This is a training account, so no link was made.' }, 403)

  const chargeId = typeof body.chargeId === 'string' ? body.chargeId : ''
  if (!UUID_RE.test(chargeId)) return json({ error: 'Pick a charge first.' }, 400)
  const { data: requestRaw, error: ensureErr } = await admin.rpc('receipt_request_ensure', { p_transaction_id: chargeId, p_made_by: caller.userId })
  if (ensureErr) {
    const known = ensureErr.code === 'P0002' || ensureErr.code === '22023'
    if (!known) throw new Error(`the request: ${ensureErr.message}`)
    return json({ error: ensureErr.message }, 400)
  }
  // A function that returns one row answers an object; a list is read the same way, should the gateway ever send one.
  const request = (Array.isArray(requestRaw) ? requestRaw[0] : requestRaw) as { id: string; closed_at: string | null } | null
  if (!request?.id) throw new Error('the request came back empty')

  const { data: charge } = await admin.from('mercury_transactions').select('status').eq('id', chargeId).maybeSingle()
  if (request.closed_at || receiptChargeDead((charge as { status: string | null } | null)?.status)) return json({ error: RECEIPT_LINK_WORDS.dead }, 409)

  const nowIso = new Date().toISOString()
  const expiresAt = receiptLinkExpiry(nowIso)
  // A code the table already holds (one chance in 10^14) is minted again.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = mintReceiptLinkCode((n) => crypto.getRandomValues(new Uint8Array(n)))
    const { error } = await admin.from('receipt_links').insert({ code_hash: await sha256(code), request_ids: [request.id], made_for: 'office', made_by: caller.userId, made_at: nowIso, expires_at: expiresAt })
    if (error?.code === '23505') continue
    if (error) throw new Error(`the link: ${error.message}`)
    await admin.from('receipt_requests').update({ closes_at: expiresAt, updated_at: nowIso }).eq('id', request.id)
    console.log(JSON.stringify({ event: 'receipt_link_mint', for: 'office', request: request.id }))
    return json({ ok: true, code, closesOn: calendarYmdInAppTzFromIso(expiresAt) })
  }
  throw new Error('no free code after three tries')
}

// ---------------------------------------------------------------------------------------------------------------------
// The page's writes.

async function addPage(admin: Admin, link: LinkRow, body: Record<string, unknown>): Promise<Response> {
  const requestId = typeof body.charge === 'string' ? body.charge : ''
  const pageId = typeof body.pageId === 'string' ? body.pageId.toLowerCase() : ''
  if (!link.request_ids.includes(requestId)) return json({ error: RECEIPT_LINK_WORDS.notACharge }, 404)
  if (!UUID_RE.test(pageId)) return json({ error: RECEIPT_LINK_WORDS.failed }, 400)
  const bytes = typeof body.data === 'string' ? bytesOfBase64(body.data) : null
  if (!bytes || bytes.length === 0) return json({ error: RECEIPT_LINK_WORDS.notAPicture }, 400)
  if (bytes.length > RECEIPT_LINK_CAPS.pageBytes) return json({ error: RECEIPT_LINK_WORDS.tooBig }, 413)
  const mime = receiptSniff(bytes)
  if (!mime) return json({ error: RECEIPT_LINK_WORDS.notAPicture }, 415)

  const loaded = await loadCharges(admin, [requestId])
  const it = loaded.byRequest.get(requestId)
  const drawn = loaded.page[0]
  if (!it || !drawn) return json({ error: RECEIPT_LINK_WORDS.notACharge }, 404)
  if (drawn.dead) return json({ error: RECEIPT_LINK_WORDS.dead }, 409)

  const nowIso = new Date().toISOString()
  let ticket = it.ticket
  // A second try with the same page: it is there already, so nothing is written twice.
  if (ticket?.counter_ticket_pages?.some((p) => p.id === pageId)) return json({ ok: true, charge: drawn })

  if (!ticket) {
    const job = receiptTicketJob({ sortedJobIds: it.sortedJobIds, dayJobIds: it.dayJobIds, pick: (body.job ?? null) as ReceiptJobPick | null })
    const { error } = await admin.from('counter_tickets').insert({
      taken_by: it.request.holder_user_id,
      taken_by_name: it.request.holder_name,
      taken_at: nowIso,
      // The link is opened hours or a day after the swipe: its time says nothing about the purchase.
      taken_at_from: 'none',
      source: 'link',
      job_id: job.job_id,
      no_one_job: job.no_one_job,
      added_at: nowIso,
      mercury_transaction_id: it.charge.id,
      match_kind: 'link',
      matched_at: nowIso,
    })
    // 23505 is the one-ticket-a-charge index: another door wrote the ticket between the read and this write.
    if (error && error.code !== '23505') throw new Error(`the ticket: ${error.message}`)
    const again = await loadCharges(admin, [requestId])
    ticket = again.byRequest.get(requestId)?.ticket ?? null
    if (!ticket) throw new Error('the ticket did not land')
  }

  let pages = ticket.counter_ticket_pages ?? []
  let pageNo = receiptNextPageNo(pages)
  let kept = false
  // Retake: the page it names goes and the new shot takes its place, unless the sweep has filed it in Drive already.
  const replace = typeof body.replace === 'string' ? body.replace.toLowerCase() : ''
  if (replace && ticket.source === 'link') {
    const old = pages.find((p) => p.id === replace)
    if (old && !old.drive_file_id) {
      const { error: delErr } = await admin.from('counter_ticket_pages').delete().eq('id', old.id).eq('ticket_id', ticket.id).is('drive_file_id', null)
      if (delErr) throw new Error(`the old page: ${delErr.message}`)
      if (old.storage_path) await admin.storage.from(COUNTER_TICKETS_BUCKET).remove([old.storage_path])
      pages = pages.filter((p) => p.id !== old.id)
      pageNo = old.page_no
    } else if (old) {
      kept = true
    }
  }
  if (pages.length >= RECEIPT_LINK_CAPS.pages) return json({ error: RECEIPT_LINK_WORDS.full }, 409)

  const storagePath = ticketStoragePath({ uploaderId: it.request.holder_user_id ?? 'link', ticketId: ticket.id, pageId, mime })
  const { error: upErr } = await admin.storage.from(COUNTER_TICKETS_BUCKET).upload(storagePath, bytes, { contentType: mime, upsert: true })
  if (upErr) throw new Error(`the page's bytes: ${upErr.message}`)
  const { error: rowErr } = await admin.from('counter_ticket_pages').insert({
    id: pageId,
    ticket_id: ticket.id,
    page_no: pageNo,
    by_user_id: it.request.holder_user_id,
    mime,
    bytes: bytes.length,
    original_bytes: whole(body.originalBytes) || bytes.length,
    width: whole(body.width),
    height: whole(body.height),
    storage_path: storagePath,
    taken_at: nowIso,
  })
  if (rowErr && rowErr.code !== '23505') throw new Error(`the page: ${rowErr.message}`)

  await admin.from('receipt_requests').update({ answered_at: it.request.answered_at ?? nowIso, ticket_id: ticket.id, updated_at: nowIso }).eq('id', requestId)
  console.log(JSON.stringify({ event: 'receipt_link_page', request: requestId, ticket: ticket.id, page: pageNo, mime, bytes: bytes.length, door: ticket.source, retake: Boolean(replace), kept }))
  const after = await loadCharges(admin, [requestId])
  return json({ ok: true, charge: after.page[0] ?? drawn, kept })
}

async function setJob(admin: Admin, link: LinkRow, body: Record<string, unknown>): Promise<Response> {
  const requestId = typeof body.charge === 'string' ? body.charge : ''
  if (!link.request_ids.includes(requestId)) return json({ error: RECEIPT_LINK_WORDS.notACharge }, 404)
  const loaded = await loadCharges(admin, [requestId])
  const it = loaded.byRequest.get(requestId)
  const drawn = loaded.page[0]
  if (!it || !drawn?.ticket) return json({ error: RECEIPT_LINK_WORDS.notACharge }, 404)
  if (!drawn.ticket.canChangeJob) return json({ error: RECEIPT_LINK_WORDS.jobHeld }, 409)
  const job = receiptTicketJob({ sortedJobIds: [], dayJobIds: it.dayJobIds, pick: (body.job ?? null) as ReceiptJobPick | null })
  const { error } = await admin.from('counter_tickets').update({ job_id: job.job_id, no_one_job: job.no_one_job, also_job_ids: [], updated_at: new Date().toISOString() }).eq('id', drawn.ticket.id).eq('source', 'link').is('used_at', null)
  if (error) throw new Error(`the job: ${error.message}`)
  const after = await loadCharges(admin, [requestId])
  return json({ ok: true, charge: after.page[0] ?? drawn })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown'
    if (rateLimited(ip, Date.now())) return json({ error: 'Too many requests. Try again in a minute.' }, 429)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin: Admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const url = new URL(req.url)

    let body: Record<string, unknown> = {}
    if (req.method === 'POST') {
      const parsed: unknown = await req.json().catch(() => null)
      if (!parsed || typeof parsed !== 'object') return json({ error: RECEIPT_LINK_WORDS.failed }, 400)
      body = parsed as Record<string, unknown>
      if (body.action === 'desk.mint') return await deskMint(req, admin, supabaseUrl, body)
    }

    const code = receiptLinkCode(req.method === 'GET' ? url.searchParams.get('code') : typeof body.code === 'string' ? body.code : null)
    if (!code) return json({ error: 'not_found' }, 404)
    const link = await findLink(admin, code)
    if (!link) {
      console.log(JSON.stringify({ event: 'receipt_link_open', state: 'not_found' }))
      const miss = await recordEstimateLinkMiss(admin, req, 'receipt-link')
      if (miss.locked) return json({ error: RECEIPT_LINK_WORDS.locked, code: ESTIMATE_LINK_LOCKED_CODE }, 429)
      return json({ error: 'not_found' }, 404)
    }
    const nowIso = new Date().toISOString()
    if (receiptLinkExpired(link, nowIso)) {
      console.log(JSON.stringify({ event: 'receipt_link_open', link: link.id, state: 'closed' }))
      return json({ error: 'closed', words: RECEIPT_LINK_WORDS.closed }, 410)
    }

    if (req.method === 'POST') {
      if (body.action === 'page') return await addPage(admin, link, body)
      if (body.action === 'job') return await setJob(admin, link, body)
      return json({ error: RECEIPT_LINK_WORDS.failed }, 400)
    }

    // One page's bytes, for the page's own thumbnail: only a page of a ticket on one of this link's charges.
    const pageId = url.searchParams.get('page')
    if (pageId) {
      if (!UUID_RE.test(pageId)) return json({ error: 'not_found' }, 404)
      const { byRequest } = await loadCharges(admin, link.request_ids)
      let found: TicketPageRow | null = null
      for (const it of byRequest.values()) found = found ?? it.ticket?.counter_ticket_pages?.find((p) => p.id === pageId.toLowerCase()) ?? null
      if (!found?.storage_path) return json({ error: 'not_found' }, 404)
      const { data: blob, error: dl } = await admin.storage.from(COUNTER_TICKETS_BUCKET).download(found.storage_path)
      if (dl || !blob) return json({ error: 'not_found' }, 404)
      return new Response(blob, { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=300', 'Content-Type': found.mime, 'X-Content-Type-Options': 'nosniff' } })
    }

    const { page } = await loadCharges(admin, link.request_ids)
    if (page.length === 0) return json({ error: 'closed', words: RECEIPT_LINK_WORDS.closed }, 410)
    // The first open is stamped, on the link and on each request it opens; a `?preview=1` from the office is not.
    if (url.searchParams.get('preview') !== '1') {
      void admin.from('receipt_links').update({ opened_at: link.opened_at ?? nowIso, open_count: (link.open_count ?? 0) + 1 }).eq('id', link.id).then(() => {}, () => {})
      void admin.from('receipt_requests').update({ opened_at: nowIso }).in('id', link.request_ids).is('opened_at', null).then(() => {}, () => {})
    }
    console.log(JSON.stringify({ event: 'receipt_link_open', link: link.id, state: 'open', charges: page.length, tickets: page.filter((c) => c.ticket).length }))
    return json({ ok: true, charges: page, closesOn: calendarYmdInAppTzFromIso(link.expires_at) })
  } catch (e) {
    console.error('receipt-link failed', e)
    return json({ error: 'That did not go through. Try again, or ask the office.' }, 500)
  }
})
