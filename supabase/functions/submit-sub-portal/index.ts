import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'

/**
 * Sub portal intake (sub-portal train): everything a sub can DO from the
 * no-login portal, token-authenticated like submit-portal-request.
 *
 * kinds:
 *  - availability   → dispatch_requests row + notify fan-out (customer-portal
 *                     request precedent)
 *  - accept_offer   → sign-to-accept: validates the offered commitment,
 *                     stores the signature (row stamp = record of truth,
 *                     PNG best-effort audit copy in contract-signer-signatures
 *                     under commitments/<id>/), transitions offered→accepted,
 *                     drops a dispatch note so the office inbox hears it
 *  - decline_offer  → offered→declined with the required reason + dispatch note
 *  - sign_link      → mints a fresh /contract/accept token for one of the
 *                     sub's own unsigned documents (send-contract-for-signature
 *                     mint pattern, no email)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LINK_INACTIVE_MSG = 'This link is no longer active. Please contact our office.'
const SIGNATURE_BUCKET = 'contract-signer-signatures'
const MAX_SIGNATURE_BYTES = 524288
const MAX_PER_HOUR = 5

const PNG_MAGIC = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) return false
  }
  return true
}

function decodeBase64PngBytes(raw: string): Uint8Array | null {
  const trimmed = raw.trim()
  const m = /^data:image\/png;base64,(.+)$/i.exec(trimmed)
  let b64: string | null = null
  if (m?.[1]) {
    b64 = m[1]
  } else if (!trimmed.startsWith('data:')) {
    b64 = trimmed
  }
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

type SubLink = { id: string; person_id: string; created_by: string | null; revoked_at: string | null }

async function resolveLink(admin: SupabaseClient, token: string): Promise<SubLink | null> {
  let { data: link } = await admin
    .from('sub_portal_links')
    .select('id, person_id, created_by, revoked_at')
    .eq('token', token)
    .maybeSingle()
  if (!link) {
    const tokenHash = await sha256Hex(token)
    link = (await admin
      .from('sub_portal_links')
      .select('id, person_id, created_by, revoked_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()).data
  }
  if (!link || (link as SubLink).revoked_at) return null
  return link as SubLink
}

/** dispatch_requests.from_user_id is NOT NULL — same fallback chain as the customer intake. */
async function resolveFromUserId(admin: SupabaseClient, link: SubLink): Promise<string | null> {
  const { data: setting } = await admin
    .from('app_settings')
    .select('value_text')
    .eq('key', 'portal_requests_from_user_id')
    .maybeSingle()
  const configured = ((setting as { value_text?: string | null } | null)?.value_text ?? '').trim()
  if (/^[0-9a-f-]{36}$/.test(configured)) return configured
  if (link.created_by) return link.created_by
  const { data: dev } = await admin.from('users').select('id').eq('role', 'dev').limit(1).maybeSingle()
  return (dev as { id?: string } | null)?.id ?? null
}

async function insertDispatchNote(
  admin: SupabaseClient,
  link: SubLink,
  title: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const fromUserId = await resolveFromUserId(admin, link)
  if (!fromUserId) return
  const { data: inserted, error } = await admin
    .from('dispatch_requests')
    .insert({
      from_user_id: fromUserId,
      title,
      pending_payload: { source: 'sub_portal', subPortalLinkId: link.id, ...payload },
    })
    .select('id')
    .single()
  if (error || !inserted) {
    console.error('sub portal dispatch note failed', error)
    return
  }
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')!}/functions/v1/notify-dispatch-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispatch_request_id: (inserted as { id: string }).id }),
    })
  } catch (e) {
    console.error('notify-dispatch-request call failed', e)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return jsonResponse({ error: 'Bad request' }, 400)

    // Honeypot: real subs never fill a field their browser hides.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return jsonResponse({ ok: true })
    }

    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const kind = typeof body.kind === 'string' ? body.kind : ''
    if (!token || token.length < 16 || token.length > 128) {
      return jsonResponse({ error: 'Bad request' }, 400)
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const link = await resolveLink(admin, token)
    if (!link) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)

    const { data: person } = await admin.from('people').select('id, name').eq('id', link.person_id).maybeSingle()
    const personName = ((person as { name?: string | null } | null)?.name ?? '').trim() || 'Subcontractor'

    // ── availability ──────────────────────────────────────────────────────
    if (kind === 'availability') {
      const description = typeof body.description === 'string' ? body.description.trim() : ''
      const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : ''
      if (description.length < 5 || description.length > 2000) {
        return jsonResponse({ error: 'Tell us a little more — a sentence is plenty.' }, 400)
      }
      const hourAgo = new Date(Date.now() - 3600_000).toISOString()
      const { count: recent } = await admin
        .from('dispatch_requests')
        .select('id', { count: 'exact', head: true })
        .eq('pending_payload->>subPortalLinkId', String(link.id))
        .gte('created_at', hourAgo)
      if ((recent ?? 0) >= MAX_PER_HOUR) {
        return jsonResponse({ error: 'That is a lot at once — give us an hour, or call the office.' }, 429)
      }
      await insertDispatchNote(admin, link, `Sub availability — ${personName}: ${description.slice(0, 120)}`, {
        kind: 'availability',
        personId: link.person_id,
        personName,
        description,
        phone: phone || null,
      })
      return jsonResponse({ ok: true })
    }

    // ── sign_link: fresh signing token for one of the sub's own documents ─
    if (kind === 'sign_link') {
      const docId = typeof body.documentId === 'string' && /^[0-9a-f-]{36}$/.test(body.documentId) ? body.documentId : null
      if (!docId) return jsonResponse({ error: 'Bad request' }, 400)
      const { data: doc } = await admin
        .from('person_contract_documents')
        .select('id, status, person_id, person_name')
        .eq('id', docId)
        .maybeSingle()
      const docRow = doc as { id: string; status: string; person_id: string | null; person_name: string | null } | null
      const mine =
        docRow != null &&
        (docRow.person_id === link.person_id ||
          (docRow.person_id == null && (docRow.person_name ?? '').trim() === personName))
      if (!docRow || !mine) return jsonResponse({ error: 'Not found' }, 404)
      if (docRow.status !== 'unsent' && docRow.status !== 'sent') {
        return jsonResponse({ error: 'This document is already signed.' }, 400)
      }
      // send-contract-for-signature mint pattern (no email): a fresh token
      // replaces any prior one — the newest signing link wins.
      const rawToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')
      const tokenHash = await sha256Hex(rawToken)
      const expiresAt = new Date(Date.now() + 14 * 86400000).toISOString()
      const { error: updErr } = await admin
        .from('person_contract_documents')
        .update({
          status: 'sent',
          sent_at: docRow.status === 'unsent' ? new Date().toISOString() : undefined,
          public_token_hash: tokenHash,
          public_token_expires_at: expiresAt,
        })
        .eq('id', docRow.id)
      if (updErr) {
        console.error('sub portal sign_link mint failed', updErr)
        return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
      }
      return jsonResponse({ ok: true, signPath: `/contract/accept?t=${rawToken}` })
    }

    // ── accept_offer / decline_offer ──────────────────────────────────────
    if (kind === 'accept_offer' || kind === 'decline_offer') {
      const commitmentId =
        typeof body.commitmentId === 'string' && /^[0-9a-f-]{36}$/.test(body.commitmentId) ? body.commitmentId : null
      if (!commitmentId) return jsonResponse({ error: 'Bad request' }, 400)

      const { data: commitment } = await admin
        .from('step_commitments')
        .select('id, person_id, status, amount, offer_expires_at, offer_scope_snapshot')
        .eq('id', commitmentId)
        .maybeSingle()
      const c = commitment as
        | { id: string; person_id: string; status: string; amount: number | null; offer_expires_at: string | null }
        | null
      if (!c || c.person_id !== link.person_id) return jsonResponse({ error: 'Not found' }, 404)
      if (c.status !== 'offered') {
        return jsonResponse({ error: 'This work order is no longer open.' }, 409)
      }
      const todayYmd = todayYmdInAppTz()
      if ((c.offer_expires_at ?? '') !== '' && (c.offer_expires_at as string) < todayYmd) {
        return jsonResponse({ error: 'This offer has expired — call the office if you still want it.' }, 409)
      }

      if (kind === 'decline_offer') {
        const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
        if (!reason) return jsonResponse({ error: 'Tell us why so we can fix it — a few words is fine.' }, 400)
        const { error: updErr } = await admin
          .from('step_commitments')
          .update({ status: 'declined', declined_at: new Date().toISOString(), decline_reason: reason })
          .eq('id', c.id)
          .eq('status', 'offered')
        if (updErr) {
          console.error('sub portal decline failed', updErr)
          return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
        }
        await insertDispatchNote(admin, link, `Work order declined — ${personName}: ${reason.slice(0, 120)}`, {
          kind: 'sub_offer_declined',
          personId: link.person_id,
          personName,
          commitmentId: c.id,
          reason,
        })
        return jsonResponse({ ok: true })
      }

      // accept_offer — sign to accept.
      const printedName = typeof body.printedName === 'string' ? body.printedName.trim().slice(0, 200) : ''
      const agreed = body.agreedTerms === true
      const sigRaw = typeof body.signaturePngBase64 === 'string' ? body.signaturePngBase64 : ''
      const hasSig = sigRaw.trim().length > 0
      if (!printedName) return jsonResponse({ error: 'Please enter your full name.' }, 400)
      if (!agreed) return jsonResponse({ error: 'Please confirm that you agree.' }, 400)

      let storagePath: string | null = null
      if (hasSig) {
        const bytes = decodeBase64PngBytes(sigRaw)
        if (!bytes || bytes.length === 0 || bytes.length > MAX_SIGNATURE_BYTES || !isPng(bytes)) {
          return jsonResponse({ error: 'Invalid or oversized signature image' }, 400)
        }
        storagePath = `commitments/${c.id}/${crypto.randomUUID()}.png`
        const { error: upErr } = await admin.storage.from(SIGNATURE_BUCKET).upload(storagePath, bytes, {
          contentType: 'image/png',
          upsert: false,
        })
        if (upErr) {
          console.error('sub portal signature upload failed', upErr)
          return jsonResponse({ error: 'Could not store signature' }, 500)
        }
      }

      const ua = req.headers.get('user-agent') ?? null
      const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      const ipRaw = fwd || req.headers.get('cf-connecting-ip') || null
      const nowIso = new Date().toISOString()

      const { data: updatedRows, error: updErr } = await admin
        .from('step_commitments')
        .update({
          status: 'accepted',
          accepted_at: nowIso,
          signed_at: nowIso,
          signer_printed_name: printedName,
          signer_signature_mode: hasSig ? 'draw' : 'type',
          signer_signature_storage_path: storagePath,
          signer_consented_at: nowIso,
          signer_ip: ipRaw,
          signer_user_agent: ua,
        })
        .eq('id', c.id)
        .eq('status', 'offered')
        .select('id')
      if (updErr || !updatedRows || updatedRows.length === 0) {
        console.error('sub portal accept failed', updErr)
        if (storagePath) {
          await admin.storage.from(SIGNATURE_BUCKET).remove([storagePath])
        }
        return jsonResponse({ error: 'Could not record the signature. Please try again.' }, updErr ? 500 : 409)
      }

      await insertDispatchNote(
        admin,
        link,
        `Work order signed & accepted — ${personName} ($${Number(c.amount ?? 0).toFixed(2)})`,
        {
          kind: 'sub_offer_accepted',
          personId: link.person_id,
          personName,
          commitmentId: c.id,
          signedAt: nowIso,
        },
      )
      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: 'Bad request' }, 400)
  } catch (e) {
    console.error('submit-sub-portal error', e)
    return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
