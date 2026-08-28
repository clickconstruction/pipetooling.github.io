/**
 * Sign or decline a bid-room proposal (Signable Bids Phase 2, v2.2470). The signature-time
 * freeze: signing mints the room's CURRENT revision onto the estimate rails — an `estimates`
 * row born customer_accepted (doc_kind 'bid_proposal', bid_id) with the chosen option frozen
 * and the signature record attached — then runs the per-GC outcome kernel: this packet Won,
 * other sent unanswered packets auto-Lost (the staff-kernel rule), conservative bids.outcome
 * roll-up. Declining marks the packet Lost with the GC's own loss category → Why we lost.
 *
 * Race guard (owner decision): only the latest published revision can be signed — a signature
 * against an older one returns 409 stale_revision and the page refreshes.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseSharedBidRoomPayload } from '../_shared/bidRoomPayload.ts'
import { isRoomDeclineCategory, planRoomOutcome, type OutcomeVersionRow } from '../_shared/bidRoomOutcome.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'

const SIGNATURE_BUCKET = 'estimate-acceptor-signatures'
const MAX_SIGNATURE_BYTES = 524288

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0]?.trim() ?? null : null
}
function isPng(bytes: Uint8Array): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return bytes.length > 8 && sig.every((b, i) => bytes[i] === b)
}
function decodeBase64PngBytes(raw: string): Uint8Array | null {
  const trimmed = raw.trim()
  const m = /^data:image\/png;base64,(.+)$/i.exec(trimmed)
  let b64: string | null = null
  if (m?.[1]) b64 = m[1]
  else if (!trimmed.startsWith('data:')) b64 = trimmed
  if (b64 == null || b64 === '') return null
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}
const fmtUsd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const body = (await req.json()) as {
      token?: string
      revision_id?: string
      action?: 'sign' | 'decline'
      optionKey?: string
      printedName?: string
      agreedTerms?: boolean
      signaturePngBase64?: string
      category?: string
      note?: string
    }
    const token = body.token?.trim()
    if (!token) return json({ error: 'token is required' }, 400)
    const action = body.action === 'decline' ? 'decline' : body.action === 'sign' ? 'sign' : null
    if (!action) return json({ error: 'action is required' }, 400)

    const { data: room } = await admin
      .from('bid_proposal_rooms')
      .select('id, bid_id, customer_id, recipient_email, closed_at, master_user_id, created_by')
      .eq('public_token', token)
      .maybeSingle()
    if (!room) return json({ error: 'Not found' }, 404)
    if (room.closed_at) return json({ error: 'This proposal has been withdrawn.', code: 'closed' }, 410)

    const { data: latest } = await admin
      .from('bid_proposal_room_revisions')
      .select('id, rev_number, payload, published_at')
      .eq('room_id', room.id)
      .order('rev_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    const payload = latest ? parseSharedBidRoomPayload(latest.payload) : null
    if (!latest || !payload) return json({ error: 'Nothing published yet.' }, 400)

    // Only the currently-published revision can ever be signed or declined.
    if ((body.revision_id ?? '') !== latest.id) {
      return json({ error: 'The proposal was revised since you loaded this page — it has been refreshed.', code: 'stale_revision' }, 409)
    }

    // One outcome per room: a second sign/decline is refused politely.
    const { data: prior } = await admin
      .from('bid_proposal_room_events')
      .select('event_type')
      .eq('room_id', room.id)
      .in('event_type', ['signed', 'declined'])
      .limit(1)
    if ((prior ?? []).length > 0) return json({ error: 'This proposal already has a response on file.', code: 'already_answered' }, 409)

    const { data: bid } = await admin
      .from('bids')
      .select('id, customer_id, project_name, outcome, bid_date_sent')
      .eq('id', room.bid_id)
      .maybeSingle()
    if (!bid) return json({ error: 'Not found' }, 404)

    const [{ data: versionRows }, { data: sendRows }] = await Promise.all([
      admin.from('bid_versions').select('id, customer_id, outcome').eq('bid_id', bid.id),
      admin.from('bid_version_sends').select('bid_version_id, sent_on').eq('bid_id', bid.id),
    ])
    const latestSend = new Map<string, string>()
    for (const r of (sendRows ?? []) as Array<{ bid_version_id: string; sent_on: string }>) {
      const prev = latestSend.get(r.bid_version_id)
      if (!prev || r.sent_on > prev) latestSend.set(r.bid_version_id, r.sent_on)
    }
    const versions: OutcomeVersionRow[] = ((versionRows ?? []) as Array<{ id: string; customer_id: string | null; outcome: string | null }>).map(
      (r) => ({ id: r.id, customer_id: r.customer_id, outcome: r.outcome, sent_on: latestSend.get(r.id) ?? null }),
    )
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const ua = req.headers.get('user-agent')
    const ip = clientIp(req)

    if (action === 'decline') {
      const category = isRoomDeclineCategory(body.category) ? body.category : null
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : ''
      if (!category && !note) return json({ error: 'Pick a reason or tell us in a sentence.' }, 400)
      const plan = planRoomOutcome({ outcome: 'lost', roomCustomerId: room.customer_id, versions, bidOutcome: bid.outcome })
      if (plan.packetVersionIds.length > 0) {
        await admin
          .from('bid_versions')
          .update({ outcome: 'lost', outcome_at: today, ...(category ? { loss_category: category } : {}), ...(note ? { outcome_note: note } : {}) })
          .in('id', plan.packetVersionIds)
      }
      if (plan.bidOutcomeSet === 'lost') await admin.from('bids').update({ outcome: 'lost' }).eq('id', bid.id)
      await admin.from('bid_proposal_room_events').insert({
        room_id: room.id,
        event_type: 'declined',
        metadata: { category, note, rev_number: latest.rev_number },
        client_ip: ip,
        user_agent: ua,
      })
      await notifyStaff(admin, room, bid.project_name ?? '', `declined the proposal${category ? ` — ${category.replace('_', ' ')}` : ''}${note ? `: “${note}”` : ''}`)
      return json({ ok: true })
    }

    // --- sign ---
    const printedName = body.printedName?.trim() ?? ''
    if (!printedName) return json({ error: 'printedName is required' }, 400)
    if (body.agreedTerms !== true) return json({ error: 'You must agree to the terms' }, 400)
    const chosen = payload.options.find((o) => o.key === (body.optionKey ?? '').trim())
    if (!chosen) return json({ error: 'Please choose an option first.', code: 'option_required' }, 400)

    let storagePath: string | null = null
    const sigRaw = typeof body.signaturePngBase64 === 'string' ? body.signaturePngBase64 : ''
    const estimateId = crypto.randomUUID()
    if (sigRaw.trim()) {
      const bytes = decodeBase64PngBytes(sigRaw)
      if (!bytes || bytes.length === 0 || bytes.length > MAX_SIGNATURE_BYTES || !isPng(bytes)) {
        return json({ error: 'Invalid or oversized signature image' }, 400)
      }
      storagePath = `${estimateId}/${crypto.randomUUID()}.png`
      const { error: upErr } = await admin.storage.from(SIGNATURE_BUCKET).upload(storagePath, bytes, { contentType: 'image/png', upsert: false })
      if (upErr) {
        console.error(upErr)
        return json({ error: 'Could not store signature' }, 500)
      }
    }

    // The freeze: the signed revision becomes the permanent record on the estimate rails.
    // One summary line per option (the letter never prices per line — fixture lists live in
    // the revision payload and the room page); the chosen option fills the legacy fields.
    const optionLine = (o: { name: string; total_cents: number }, isChosen: boolean) => ({
      line_item: o.name.trim() || 'Option',
      description: isChosen ? `Signed proposal — ${payload.project_name || 'project'}` : 'Offered option (not chosen)',
      quantity: 1,
      unit_price_cents: o.total_cents,
      amount_cents: o.total_cents,
    })
    const nowIso = new Date().toISOString()
    const termsText = [
      payload.inclusions.trim() ? `Inclusions:\n${payload.inclusions.trim()}` : '',
      payload.exclusions.trim() ? `Exclusions:\n${payload.exclusions.trim()}` : '',
      payload.terms.trim(),
    ]
      .filter(Boolean)
      .join('\n\n')
    const { data: inserted, error: insErr } = await admin
      .from('estimates')
      .insert({
        id: estimateId,
        master_user_id: room.master_user_id,
        created_by: room.created_by,
        doc_kind: 'bid_proposal',
        bid_id: bid.id,
        customer_id: room.customer_id ?? bid.customer_id,
        customer_email: room.recipient_email,
        title: `Proposal — ${payload.project_name || 'project'}`,
        for_address: payload.project_address || null,
        status: 'customer_accepted',
        sent_at: latest.published_at,
        terms_snapshot: termsText,
        line_items_snapshot: [optionLine(chosen, true)],
        total_cents: chosen.total_cents,
        options_snapshot: payload.options.map((o) => ({
          key: o.key,
          name: o.name,
          description: o.is_base ? 'Proposed' : 'Alternate',
          recommended: o.is_base,
          line_items: [optionLine(o, o.key === chosen.key)],
        })),
        accepted_option_key: chosen.key,
        acceptor_printed_name: printedName,
        acceptor_consented_at: nowIso,
        acceptor_ip: ip,
        acceptor_user_agent: ua,
        acceptor_signature_storage_path: storagePath,
      })
      .select('estimate_number')
      .single()
    if (insErr) {
      console.error(insErr)
      if (storagePath) await admin.storage.from(SIGNATURE_BUCKET).remove([storagePath])
      return json({ error: 'Could not record the signature' }, 500)
    }

    const plan = planRoomOutcome({ outcome: 'won', roomCustomerId: room.customer_id, versions, bidOutcome: bid.outcome })
    if (plan.packetVersionIds.length > 0) {
      await admin.from('bid_versions').update({ outcome: 'won', outcome_at: today, loss_category: null }).in('id', plan.packetVersionIds)
    }
    if (plan.autoLostVersionIds.length > 0) {
      await admin.from('bid_versions').update({ outcome: 'lost', outcome_at: today }).in('id', plan.autoLostVersionIds)
    }
    if (plan.bidOutcomeSet === 'won') await admin.from('bids').update({ outcome: 'won' }).eq('id', bid.id)

    await admin.from('bid_proposal_room_events').insert({
      room_id: room.id,
      event_type: 'signed',
      metadata: {
        option_key: chosen.key,
        option_name: chosen.name,
        total_cents: chosen.total_cents,
        rev_number: latest.rev_number,
        estimate_id: estimateId,
        estimate_number: (inserted as { estimate_number: number } | null)?.estimate_number ?? null,
        printed_name: printedName,
      },
      client_ip: ip,
      user_agent: ua,
    })
    await notifyStaff(
      admin,
      room,
      bid.project_name ?? '',
      `signed “${chosen.name.trim() || 'the proposal'}” — ${fmtUsd(chosen.total_cents)}. Packet marked Won.`,
    )
    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})

async function notifyStaff(
  admin: ReturnType<typeof createClient>,
  room: { master_user_id: string; created_by: string | null },
  projectName: string,
  what: string,
): Promise<void> {
  try {
    const key = Deno.env.get('RESEND_API_KEY')
    if (!key) return
    const ids = [...new Set([room.master_user_id, room.created_by].filter((x): x is string => !!x))]
    const { data: users } = await admin.from('users').select('email').in('id', ids)
    const origin = Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com'
    const subject = `Bid room — ${projectName || 'proposal'}`
    const text = `${projectName || 'A proposal'}: the GC ${what}\n\nOpen PipeTooling: ${origin}/bids\n`
    for (const u of (users ?? []) as Array<{ email: string | null }>) {
      const em = (u.email ?? '').trim()
      if (em) await sendEmailViaResend(em, subject, text, text.replace(/\n/g, '<br>'), key)
    }
  } catch (e) {
    console.error('sign-bid-room notify (non-fatal)', e)
  }
}
