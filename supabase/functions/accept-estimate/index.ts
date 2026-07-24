import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { clientIpFromRequest, insertEstimateCustomerEvent } from '../_shared/logEstimateCustomerEvent.ts'

const SIGNATURE_BUCKET = 'estimate-acceptor-signatures'
const MAX_SIGNATURE_BYTES = 524288 // 512 KiB (matches bucket file_size_limit)

const PNG_MAGIC = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

async function sha256HexFromString(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type EstimateFetchRow = {
  id: string
  status: string
  public_token_expires_at: string | null
  valid_until: string | null
  accept_notify_user_ids: string[] | null
  master_user_id: string
  estimate_number: number
  title: string
}

function escapeHtmlLite(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Org-wide "always notify" recipients for estimate acceptance. Same shape and
 * dev-write RLS as the paid-job-email recipients setting; the client editor is
 * `src/components/estimates/EstimateAcceptedNotifySettingsModal.tsx` and the
 * parse/union kernel is `src/lib/estimateAcceptedNotify.ts` — keep in sync.
 */
const ESTIMATE_ACCEPTED_NOTIFY_SETTING_KEY = 'estimate_accepted_notify_recipients_v1'

async function loadOrgWideAcceptNotifyIds(admin: ReturnType<typeof createClient>): Promise<string[]> {
  const { data: setting, error } = await admin
    .from('app_settings')
    .select('value_text')
    .eq('key', ESTIMATE_ACCEPTED_NOTIFY_SETTING_KEY)
    .maybeSingle()
  if (error) {
    console.error('accept-estimate: load org-wide notify setting', error)
    return []
  }
  try {
    const parsed = JSON.parse(setting?.value_text ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
  } catch {
    return []
  }
}

/** Best-effort staff emails; failures logged only (customer acceptance already persisted). */
async function notifyStaffEstimateAccepted(params: {
  admin: ReturnType<typeof createClient>
  masterUserId: string
  candidateIds: string[] | null | undefined
  estimateNumber: number
  title: string
  acceptorPrintedName: string
}): Promise<void> {
  // Union: this estimate's own picks first, then the org-wide always-notify
  // list. The eligibility RPC below still filters whatever comes out.
  const perEstimate = (params.candidateIds ?? []).filter((x) => typeof x === 'string' && x.trim().length > 0)
  const orgWide = await loadOrgWideAcceptNotifyIds(params.admin)
  const ids = [...new Set([...perEstimate, ...orgWide].map((x) => x.trim()))]
  if (ids.length === 0) return

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.warn('accept-estimate: RESEND_API_KEY not set; skipping staff notify')
    return
  }

  const origin = (Deno.env.get('ESTIMATE_PUBLIC_ORIGIN') ?? 'https://pipetooling.github.io').replace(/\/$/, '')

  const { data: eligible, error: rpcErr } = await params.admin.rpc('estimate_accept_notify_filter_eligible_user_ids', {
    p_master_user_id: params.masterUserId,
    p_candidate_ids: ids,
  })
  if (rpcErr) {
    console.error('accept-estimate: estimate_accept_notify_filter_eligible_user_ids', rpcErr)
    return
  }
  const eligibleArr = Array.isArray(eligible) ? (eligible as string[]) : []
  if (eligibleArr.length === 0) return

  const { data: userRows, error: usersErr } = await params.admin
    .from('users')
    .select('id, email, name')
    .in('id', eligibleArr)
  if (usersErr) {
    console.error('accept-estimate: notify users select', usersErr)
    return
  }

  const quote = Number(params.estimateNumber)
  const acceptor = params.acceptorPrintedName.trim()
  const titleTrim = params.title.trim()
  const subject = `Quote #${quote} accepted — ${acceptor}`
  const appLink = `${origin}/estimates/${quote}`
  const textPlain =
    `${acceptor} accepted estimate #${quote}${titleTrim ? `: ${titleTrim}` : ''}.\n\n` + `Open in PipeTooling: ${appLink}\n`
  const htmlBody =
    `<p><strong>${escapeHtmlLite(acceptor)}</strong> accepted <strong>Quote #${quote}</strong>` +
    `${titleTrim ? `: ${escapeHtmlLite(titleTrim)}` : ''}.</p>` +
    `<p><a href="${appLink}">Open estimate in PipeTooling</a></p>`

  for (const u of userRows ?? []) {
    const em = typeof u.email === 'string' ? u.email.trim() : ''
    if (!em) continue
    const r = await sendEmailViaResend(em, subject, textPlain, htmlBody, resendApiKey)
    if (!r.success) {
      console.error('accept-estimate: staff notify Resend', { to: em, error: r.error })
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = (await req.json()) as {
      token?: string
      printedName?: string
      signaturePngBase64?: string
      agreedTerms?: boolean
    }
    const raw = body.token?.trim()
    const printedName = body.printedName?.trim() ?? ''
    const sigRaw = typeof body.signaturePngBase64 === 'string' ? body.signaturePngBase64 : ''
    const hasSig = sigRaw.trim().length > 0

    if (!raw) {
      return new Response(JSON.stringify({ error: 'token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!printedName) {
      return new Response(JSON.stringify({ error: 'printedName is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (body.agreedTerms !== true) {
      return new Response(JSON.stringify({ error: 'You must agree to the terms' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const tokenHash = await sha256HexFromString(raw)

    const { data: rowRaw, error: fetchErr } = await admin
      .from('estimates')
      .select(
        'id, status, public_token_expires_at, valid_until, accept_notify_user_ids, master_user_id, estimate_number, title',
      )
      .eq('public_token_hash', tokenHash)
      .maybeSingle()

    const row = rowRaw as EstimateFetchRow | null

    if (fetchErr || !row) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (row.status === 'customer_accepted') {
      // Same HTTP contract as before (200 + alreadyAccepted), but record audit: repeat POST
      // commonly happens during QA and previously skipped insertEstimateCustomerEvent entirely.
      await insertEstimateCustomerEvent(admin, {
        estimateId: row.id,
        eventType: 'public_accept_submitted',
        source: 'accept-estimate',
        req,
        metadata: { repeat_after_accepted: true },
      })
      return new Response(JSON.stringify({ ok: true, alreadyAccepted: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (row.status !== 'sent') {
      return new Response(JSON.stringify({ error: 'Not available' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const exp = row.public_token_expires_at ? Date.parse(String(row.public_token_expires_at)) : NaN
    if (!Number.isNaN(exp) && exp < Date.now()) {
      return new Response(JSON.stringify({ error: 'Link expired', code: 'expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (row.valid_until) {
      const vu = new Date(String(row.valid_until) + 'T23:59:59.999Z').getTime()
      if (vu < Date.now()) {
        return new Response(JSON.stringify({ error: 'Estimate expired', code: 'expired' }), {
          status: 410,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    let storagePath: string | null = null
    if (hasSig) {
      const bytes = decodeBase64PngBytes(sigRaw)
      if (!bytes || bytes.length === 0 || bytes.length > MAX_SIGNATURE_BYTES || !isPng(bytes)) {
        return new Response(JSON.stringify({ error: 'Invalid or oversized signature image' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      storagePath = `${row.id}/${crypto.randomUUID()}.png`
      const { error: upErr } = await admin.storage.from(SIGNATURE_BUCKET).upload(storagePath, bytes, {
        contentType: 'image/png',
        upsert: false,
      })
      if (upErr) {
        console.error(upErr)
        return new Response(JSON.stringify({ error: 'Could not store signature' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const ua = req.headers.get('user-agent') ?? null
    const ipRaw = clientIpFromRequest(req)
    const nowIso = new Date().toISOString()

    const baseUpdate = {
      status: 'customer_accepted' as const,
      acceptor_consented_at: nowIso,
      acceptor_ip: ipRaw,
      acceptor_user_agent: ua,
    }

    const updatePayload = hasSig
      ? {
          ...baseUpdate,
          acceptor_printed_name: printedName,
          acceptor_signature_storage_path: storagePath,
        }
      : {
          ...baseUpdate,
          acceptor_printed_name: printedName,
          acceptor_signature_storage_path: null,
        }

    const { data: updatedRows, error: updErr } = await admin
      .from('estimates')
      .update(updatePayload)
      .eq('id', row.id)
      .eq('status', 'sent')
      .select('id, acceptor_signature_storage_path')

    if (updErr) {
      console.error(updErr)
      if (storagePath) {
        await admin.storage.from(SIGNATURE_BUCKET).remove([storagePath])
      }
      return new Response(JSON.stringify({ error: 'Could not save acceptance' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const updated = updatedRows?.[0] ?? null
    if (!updated) {
      if (storagePath) {
        await admin.storage.from(SIGNATURE_BUCKET).remove([storagePath])
      }
      return new Response(
        JSON.stringify({ error: 'Estimate was already accepted or is no longer available to accept' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (hasSig && !updated.acceptor_signature_storage_path?.trim()) {
      if (storagePath) {
        await admin.storage.from(SIGNATURE_BUCKET).remove([storagePath])
      }
      console.error('accept-estimate: signature upload succeeded but DB path missing after update', {
        estimateId: row.id,
      })
      return new Response(JSON.stringify({ error: 'Could not save signature on estimate' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // sent -> customer_accepted audit: DB trigger estimates_audit_customer_accepted_trigger (same txn as UPDATE).

    try {
      await notifyStaffEstimateAccepted({
        admin,
        masterUserId: row.master_user_id,
        candidateIds: row.accept_notify_user_ids,
        estimateNumber: row.estimate_number,
        title: row.title ?? '',
        acceptorPrintedName: printedName,
      })
    } catch (notifyErr) {
      console.error('accept-estimate: notify staff failed (non-fatal)', notifyErr)
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
