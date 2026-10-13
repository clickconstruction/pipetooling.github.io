import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DocsmitClient, DocsmitError } from '../_shared/docsmitClient.ts'
import { loadDocsmitConfig } from '../_shared/mailConfig.ts'
import { appendEvent, mailCassAddress, mailCassVerdict, mailClientMsgId, mailMessageTitle, mailPartyFromPiece, mailPieceUpdateFromParty, mailPrepareProblems, type MailPiecePrepareInput, type MailPieceRow } from '../_shared/mailSend.ts'
import { PIECE_COLUMNS, loadOpenPieces, loadPiecesByIds, refreshPieces, writeTrackingToFilings, type MailDb } from '../_shared/mailDocsmitRefresh.ts'

/**
 * mail-send-docsmit (the Docsmit train, PR 3 — docs/DOCSMIT_LIEN_RUN_PLAN.md): the office's door to
 * Docsmit, one `action` per call. Office-only: Bearer JWT, then the caller's role from `users`
 * (dev · master_technician · assistant · controller, not read-only). The token Docsmit gives is
 * never returned; the secrets never leave this function.
 *
 *   { action: "ping" }                       → the account's name and credit balance, and which Docsmit (tracksmit | prod)
 *   { action: "prepare", piece, pdf_path, pdf_bucket?, job_number? }
 *       the address through CASS (422 with the correction when it will not mail), the mail_pieces row as prepared,
 *       the message made, the PDF (already in the bucket) uploaded, the price checked → { piece_id, price, correction, credit_balance }
 *   { action: "send", piece_ids[] }          → one at a time, in order; 201 marks the piece sent and reads /parties once;
 *       402 stops: { ok: false, sent[], shortfall, stopped_at } so the run can say credit is short and nothing more went
 *   { action: "refresh", piece_ids?[] }      → /parties for each (or every open Docsmit piece), the fold, the filing's sends[]
 *
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DOCSMIT_EMAIL, DOCSMIT_PASSWORD_SHA512,
 * DOCSMIT_SOFTWARE_ID, DOCSMIT_BASE_URL (Tracksmit when unset). app_settings docsmit_paused = 'true' refuses
 * everything but ping with 409. Gateway verify_jwt = false; the function checks the bearer itself.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OFFICE_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])
const MAX_SEND = 40

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function str(v: unknown, max = 300): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

async function readPdf(supabaseUrl: string, serviceKey: string, bucket: string, path: string): Promise<Uint8Array | null> {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  if (!res.ok) return null
  return new Uint8Array(await res.arrayBuffer())
}

async function isPaused(admin: MailDb): Promise<boolean> {
  const { data } = await admin.from('app_settings').select('value_text').eq('key', 'docsmit_paused').maybeSingle()
  return String((data as { value_text?: unknown } | null)?.value_text ?? '').trim().toLowerCase() === 'true'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown> = {}
  try { body = (await req.json()) as Record<string, unknown> } catch { body = {} }
  const action = str(body.action, 20)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ error: 'Server misconfigured' }, 500)

    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return jsonResponse({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser(jwt)
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) as unknown as MailDb
    const { data: roleRow } = await admin.from('users').select('role, read_only').eq('id', user.id).maybeSingle()
    const role = String((roleRow as { role?: string } | null)?.role ?? '')
    if (!OFFICE_ROLES.has(role) || (roleRow as { read_only?: boolean } | null)?.read_only) return jsonResponse({ error: 'Not authorized' }, 403)

    // Vault first (set from Settings → Developer, PR 9), then the function's own environment.
    const { config: cfg } = await loadDocsmitConfig(admin as unknown as Parameters<typeof loadDocsmitConfig>[0], (k) => Deno.env.get(k))
    if (!cfg) return jsonResponse({ error: 'Docsmit is not set up: DOCSMIT_EMAIL, DOCSMIT_PASSWORD_SHA512 and DOCSMIT_SOFTWARE_ID are missing.' }, 500)
    const client = new DocsmitClient(cfg)
    const nowIso = new Date().toISOString()
    const store = { supabaseUrl, serviceKey }

    if (action === 'ping') {
      const info = await client.accountInfo()
      return jsonResponse({ ok: true, env: client.env(), account: { name: info.name, credit_balance: info.creditBalance } })
    }

    if (await isPaused(admin)) return jsonResponse({ error: 'Docsmit is paused in Developer settings. The run opens on paper.' }, 409)

    if (action === 'prepare') {
      const p = (body.piece ?? {}) as Partial<MailPiecePrepareInput>
      const piece: MailPiecePrepareInput = {
        kind: str(p.kind, 40),
        source_ids: Array.isArray(p.source_ids) ? p.source_ids.filter((x): x is string => typeof x === 'string') : [],
        job_id: str(p.job_id, 40) || null,
        recipient: str(p.recipient, 60),
        short_code: str(p.short_code, 16) || null,
        name: str(p.name, 120),
        organization: str(p.organization, 120),
        address1: str(p.address1, 120),
        address2: str(p.address2, 120),
        city: str(p.city, 80),
        // Never cut to two letters: 'Texas' must fail the check, not pass as 'TE'.
        state: str(p.state, 20).toUpperCase(),
        postal_code: str(p.postal_code, 10),
        send_type: str(p.send_type, 60) || 'Certified, Electronic Return Receipt',
        envelope: p.envelope === 'Flat' ? 'Flat' : p.envelope === '#10' ? '#10' : null,
        sheets: Number(p.sheets) || 0,
      }
      const problems = mailPrepareProblems(piece)
      if (problems.length > 0) return jsonResponse({ error: `The envelope needs ${problems.join(', ')}.` }, 400)
      const pdfPath = str(body.pdf_path, 300)
      const pdfBucket = str(body.pdf_bucket, 80) || 'lien-release-documents'
      if (!pdfPath) return jsonResponse({ error: 'The envelope needs its PDF in the bucket first (pdf_path).' }, 400)
      const pdf = await readPdf(supabaseUrl, serviceKey, pdfBucket, pdfPath)
      if (!pdf || pdf.byteLength === 0) return jsonResponse({ error: `The PDF is not in the bucket: ${pdfBucket}/${pdfPath}` }, 400)

      const verdict = mailCassVerdict(await client.multiCass([mailCassAddress(piece)]))
      if (!verdict.mailable) return jsonResponse({ error: 'Docsmit says this address will not mail.', correction: verdict.correction, non_mailable: true }, 422)

      const { data: inserted, error: insErr } = await admin.from('mail_pieces').insert({
        ...piece,
        provider: 'docsmit',
        status: 'prepared',
        pdf_bucket: pdfBucket,
        pdf_path: pdfPath,
        created_by: user.id,
        events: [{ at: nowIso, kind: 'prepared', by: user.id, correction: verdict.correction, env: client.env() }],
      }).select(PIECE_COLUMNS).single()
      if (insErr || !inserted) return jsonResponse({ error: `Could not keep the piece: ${insErr?.message ?? 'no row'}` }, 500)
      const row = inserted as MailPieceRow

      try {
        const clientMsgId = mailClientMsgId(row.kind, row.id)
        const messageId = await client.newMessage({ title: mailMessageTitle(row, str(body.job_number, 20) || null), clientMsgID: clientMsgId, physicalParties: [mailPartyFromPiece(row)] })
        await client.upload(messageId, pdf, `${row.id}.pdf`)
        const priced = await client.priceCheck(messageId)
        const events = appendEvent(row.events, { at: nowIso, kind: 'message_made', provider_message_id: messageId, price: priced.price })
        const { error: upErr } = await admin.from('mail_pieces').update({ provider_message_id: messageId, client_msg_id: clientMsgId, price: priced.price, events }).eq('id', row.id)
        if (upErr) throw new Error(`mail_pieces ${row.id}: ${upErr.message}`)
        const info = await client.accountInfo().catch(() => ({ creditBalance: null }))
        return jsonResponse({ ok: true, piece_id: row.id, provider_message_id: messageId, price: priced.price, correction: verdict.correction, credit_balance: info.creditBalance, env: client.env() })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        await admin.from('mail_pieces').update({ status: 'failed', problem: message, events: appendEvent(row.events, { at: nowIso, kind: 'prepare_failed', error: message }) }).eq('id', row.id)
        return jsonResponse({ error: message, piece_id: row.id }, e instanceof DocsmitError ? 502 : 500)
      }
    }

    if (action === 'send') {
      const ids = (Array.isArray(body.piece_ids) ? body.piece_ids : []).filter((x): x is string => typeof x === 'string').slice(0, MAX_SEND)
      if (ids.length === 0) return jsonResponse({ error: 'Nothing to send: piece_ids is empty.' }, 400)
      const pieces = await loadPiecesByIds(admin, ids)
      const sent: string[] = []
      const skipped: Array<{ id: string; why: string }> = []
      for (const piece of pieces) {
        if (piece.status !== 'prepared' || !piece.provider_message_id) {
          skipped.push({ id: piece.id, why: piece.status === 'prepared' ? 'no message at Docsmit' : `already ${piece.status}` })
          continue
        }
        let answer: Awaited<ReturnType<DocsmitClient['send']>>
        try {
          answer = await client.send(piece.provider_message_id)
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          await admin.from('mail_pieces').update({ status: 'failed', problem: message, events: appendEvent(piece.events, { at: nowIso, kind: 'send_failed', error: message }) }).eq('id', piece.id)
          return jsonResponse({ ok: false, sent, skipped, stopped_at: piece.id, error: `Docsmit refused ${piece.id}: ${message}. Nothing more was sent.` }, 502)
        }
        if (!answer.sent) {
          const short = answer.shortfall ?? 0
          await admin.from('mail_pieces').update({ events: appendEvent(piece.events, { at: nowIso, kind: 'send_short', shortfall: short }) }).eq('id', piece.id)
          return jsonResponse({ ok: false, sent, skipped, stopped_at: piece.id, shortfall: short, error: `Docsmit credit is short by $${short.toFixed(2)}, nothing more was sent.` }, 402)
        }
        let next: MailPieceRow = { ...piece, status: 'sent', events: appendEvent(piece.events, { at: nowIso, kind: 'sent', env: client.env() }) }
        const patch: Record<string, unknown> = { status: 'sent', events: next.events }
        try {
          const party = (await client.parties(piece.provider_message_id))[0]
          if (party) {
            const u = mailPieceUpdateFromParty(next, party, nowIso)
            next = { ...next, ...u.patch, events: appendEvent(next.events, { ...u.event, party }) }
            Object.assign(patch, u.patch, { events: next.events })
          }
        } catch { /* the poll reads it next hour */ }
        const { error: upErr } = await admin.from('mail_pieces').update(patch).eq('id', piece.id)
        if (upErr) return jsonResponse({ ok: false, sent, skipped, stopped_at: piece.id, error: `Sent, but could not write the piece: ${upErr.message}` }, 500)
        await writeTrackingToFilings(admin, next).catch(() => [])
        sent.push(piece.id)
      }
      return jsonResponse({ ok: true, sent, skipped })
    }

    if (action === 'refresh') {
      const ids = (Array.isArray(body.piece_ids) ? body.piece_ids : []).filter((x): x is string => typeof x === 'string')
      const pieces = ids.length > 0 ? await loadPiecesByIds(admin, ids) : await loadOpenPieces(admin, 'docsmit')
      const result = await refreshPieces(admin, client, pieces, nowIso, store)
      return jsonResponse({ ok: result.errors.length === 0, read: pieces.length, updated: result.updated, errors: result.errors, results: result.results })
    }

    return jsonResponse({ error: `Unknown action: ${action || '(none)'}` }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('mail-send-docsmit', message)
    return jsonResponse({ error: message }, e instanceof DocsmitError ? 502 : 500)
  }
})
