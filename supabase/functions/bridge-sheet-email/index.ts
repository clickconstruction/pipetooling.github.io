import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'

/**
 * bridge-sheet-email (v2.5224): mails the Bridge's Monday sheet to the person
 * who pressed **Email me this sheet** — and to nobody else. The page builds
 * the sheet from its own kernels and sends the finished subject, text and
 * HTML; this function checks the caller is a dev with a real account and
 * sends it to that account's own address through Resend.
 *
 * Body: { subject, html, text }. Never a recipient: the recipient is the caller.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const EMAIL_TYPE = 'bridge_monday_sheet'
const MAX_HTML_BYTES = 400_000
const MAX_SUBJECT = 200

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!supabaseUrl || !anonKey || !serviceRole) return jsonResponse({ error: 'Supabase service env not configured' }, 500)
    if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const jwtClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: authErr,
    } = await jwtClient.auth.getUser(token)
    if (authErr || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceRole)
    const { data: me, error: meErr } = await admin.from('users').select('id, role, email, archived_at, is_sample, is_digital_twin').eq('id', user.id).maybeSingle()
    const row = me as { role?: string; email?: string | null; archived_at?: string | null; is_sample?: boolean; is_digital_twin?: boolean } | null
    if (meErr || !row) return jsonResponse({ error: 'Unauthorized' }, 401)
    if (row.role !== 'dev' || row.archived_at || row.is_sample || row.is_digital_twin) return jsonResponse({ error: 'Forbidden — the Bridge is dev only' }, 403)
    const email = (row.email ?? user.email ?? '').trim()
    if (!email) return jsonResponse({ error: 'Your account has no email address' }, 400)

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      body = {}
    }
    const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, MAX_SUBJECT) : ''
    const html = typeof body.html === 'string' ? body.html : ''
    const text = typeof body.text === 'string' ? body.text : ''
    if (!subject || !html) return jsonResponse({ error: 'subject and html are required' }, 400)
    if (new TextEncoder().encode(html).length > MAX_HTML_BYTES) return jsonResponse({ error: 'The sheet is too large to mail' }, 413)

    const res = await sendEmailViaResend(email, subject, text || subject, html, resendApiKey, { emailType: EMAIL_TYPE })
    if (!res.success) return jsonResponse({ error: res.error || 'Send failed' }, 500)
    return jsonResponse({ ok: true, to: email })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
