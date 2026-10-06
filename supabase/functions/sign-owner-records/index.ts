/**
 * sign-owner-records (punch list #86, PR 1): an owner of record signs the acknowledgment of a
 * records request on their portal. The portal link is the capability, as on customer-portal.
 * The request must be one the office offered on the portal, for this link's customer, not yet
 * signed and not yet sent. The name typed must match the roll's owner, or the second name the
 * office allowed, letter for letter (`_shared/ownerNameMatch.ts`). A drawn signature goes to the
 * private sent-documents bucket under the request's id; the consent goes to `esign_consents`
 * (`lien_owner_record_request`). The write is the request's `file`: `request` (how `portal`)
 * when none is on file, and `acknowledgment` with the name, the mode, the ink and the instant.
 * The office's four checks read it; nothing is shown to the owner until the office sends.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { clientIp, corsHeaders, decodeSignaturePng, json } from '../_shared/jobContract.ts'
import { parseEsignConsent, recordEsignConsent } from '../_shared/esignConsent.ts'
import { ownerNameLetterMatch } from '../_shared/ownerNameMatch.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'

const SENT_COPIES_BUCKET = 'sent-documents'

type Body = {
  token?: string
  requestId?: string
  printedName?: string
  mode?: 'type' | 'draw'
  signaturePngBase64?: string
  esignConsent?: unknown
}

type RequestRow = { id: string; customer_id: string | null; owner_name: string; property_address: string; file: Record<string, unknown> | null; sent_at: string | null }

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    const token = (body.token ?? '').trim()
    const requestId = (body.requestId ?? '').trim()
    const printedName = (body.printedName ?? '').trim().slice(0, 200)
    const mode = body.mode === 'draw' ? 'draw' : 'type'
    if (!token || !/^[0-9a-f-]{36}$/i.test(requestId)) return json({ error: 'Missing token' }, 400)
    if (!printedName) return json({ error: 'Please type your full name.' }, 400)
    const consent = parseEsignConsent(body.esignConsent)
    if (!consent) return json({ error: 'Please agree to sign electronically.' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })

    // The link, raw or by hash, as customer-portal reads it.
    let link = (await admin.from('customer_portal_links').select('customer_id, revoked_at').eq('token', token).maybeSingle()).data as { customer_id: string; revoked_at: string | null } | null
    if (!link) link = (await admin.from('customer_portal_links').select('customer_id, revoked_at').eq('token_hash', await sha256Hex(token)).maybeSingle()).data as typeof link
    if (!link || link.revoked_at) return json({ error: 'This link is no longer active.' }, 404)

    const { data: rowRaw } = await admin.from('lien_owner_record_requests').select('id, customer_id, owner_name, property_address, file, sent_at').eq('id', requestId).maybeSingle()
    const row = rowRaw as RequestRow | null
    if (!row || row.customer_id !== link.customer_id) return json({ error: 'That request is not on this page.' }, 404)
    const file = (row.file && typeof row.file === 'object' ? row.file : {}) as Record<string, unknown>
    const offer = file.offer as { at?: string; alsoAllowed?: string } | null | undefined
    if (!offer || typeof offer.at !== 'string') return json({ error: 'The office has not offered these records on your portal yet.' }, 409)
    if (row.sent_at) return json({ error: 'These records were already sent.' }, 409)
    const ack = file.acknowledgment as { signedOn?: string } | null | undefined
    if (ack && typeof ack.signedOn === 'string') return json({ error: 'This acknowledgment is already signed.' }, 409)

    const allowed = [row.owner_name, typeof offer.alsoAllowed === 'string' ? offer.alsoAllowed : ''].map((n) => n.trim()).filter(Boolean)
    if (!ownerNameLetterMatch(printedName, allowed)) {
      return json({ error: `Type your name as the county lists it: ${row.owner_name.trim() || 'the owner of record'}. Every letter must match.`, nameMismatch: true }, 422)
    }

    let signaturePath: string | null = null
    if (mode === 'draw') {
      const bytes = body.signaturePngBase64 ? decodeSignaturePng(body.signaturePngBase64) : null
      if (!bytes) return json({ error: 'Please draw your signature.' }, 400)
      signaturePath = `${row.id}/acknowledgment-signature-${crypto.randomUUID()}.png`
      const { error: upErr } = await admin.storage.from(SENT_COPIES_BUCKET).upload(signaturePath, bytes, { contentType: 'image/png', upsert: false })
      if (upErr) return json({ error: 'Could not keep the signature. Please try again.' }, 500)
    }

    const nowIso = new Date().toISOString()
    const todayYmd = todayYmdInAppTz(new Date())
    const ip = clientIp(req)
    const nextFile = {
      ...file,
      request: file.request && typeof file.request === 'object' ? file.request : { on: todayYmd, how: 'portal', from: printedName, link: '' },
      acknowledgment: { signedOn: todayYmd, link: '', printedName, mode, ...(signaturePath ? { signaturePath } : {}), consentedAt: nowIso },
    }
    const { error: upd } = await admin.from('lien_owner_record_requests').update({ file: nextFile, updated_at: nowIso }).eq('id', row.id)
    if (upd) {
      if (signaturePath) await admin.storage.from(SENT_COPIES_BUCKET).remove([signaturePath])
      return json({ error: 'Could not record the signature. Please try again.' }, 500)
    }
    await recordEsignConsent(admin, { recordType: 'lien_owner_record_request', recordId: row.id, consent, printedName, method: mode, consentedAt: nowIso, ip, userAgent: req.headers.get('user-agent') })
    return json({ ok: true, signedOn: todayYmd, printedName })
  } catch (e) {
    console.error('sign-owner-records error', e)
    return json({ error: 'Something went wrong. Please try again, or call our office.' }, 500)
  }
})
