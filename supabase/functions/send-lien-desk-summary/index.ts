import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { LIEN_STATUS_NOTE_MAX, lienStatusEmailHtml, lienStatusEmailText, lienStatusSubject, parseLienStatusPayload } from '../_shared/lienDeskStatus.ts'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'

/**
 * Email where the liens stand (v2.4311): the Lien desk's Share → Email a teammate….
 *
 * Body: `{ mode: 'send' | 'test', payload, recipient_user_ids?, subject?, note? }`. The payload
 * is the desk's numbers (`_shared/lienDeskStatus.ts`), never HTML: this function parses it,
 * renders the email with the same renderer the browser previewed, and sends it from
 * EMAIL_FROM ("ClickTooling") with the sender as Reply to. `test` sends one copy to the
 * sender with [TEST] on the subject.
 *
 * Auth: user JWT verified in-handler (config.toml sets verify_jwt = false). The sender must be
 * dev / master_technician / assistant / controller, not archived, not a training account; each
 * recipient must be one of those roles with an email (at most five). Every send writes its
 * email_send_log row as `lien_desk_summary` through sendEmailViaResend.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DESK_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])
const MAX_RECIPIENTS = 5

type UserRow = { id: string; name: string | null; email: string | null; role: string | null; archived_at: string | null; read_only?: boolean | null }

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function hasEmail(u: Pick<UserRow, 'email'>): boolean {
  return typeof u.email === 'string' && u.email.includes('@')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!supabaseUrl || !anonKey || !serviceRole) return jsonResponse({ error: 'Supabase env not configured' }, 500)
    if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return jsonResponse({ error: 'Unauthorized' }, 401)
    const jwtClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: authError,
    } = await jwtClient.auth.getUser(token)
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceRole)
    const { data: meRow } = await admin.from('users').select('id, name, email, role, archived_at, read_only').eq('id', user.id).match(REAL_ACCOUNT).maybeSingle()
    const me = meRow as UserRow | null
    if (!me || me.archived_at || !DESK_ROLES.has(String(me.role))) return jsonResponse({ error: 'Only the people who use the Lien desk can send this.' }, 403)
    if (me.read_only) return jsonResponse({ error: 'A training account cannot send email.' }, 403)

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }
    const mode = body.mode === 'test' ? 'test' : body.mode === 'send' ? 'send' : null
    if (!mode) return jsonResponse({ error: "mode must be 'send' or 'test'" }, 400)
    const payload = parseLienStatusPayload(body.payload)
    if (!payload) return jsonResponse({ error: 'The lien status could not be read. Close Share and open it again.' }, 400)
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, LIEN_STATUS_NOTE_MAX) : ''
    const typed = typeof body.subject === 'string' ? body.subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 200) : ''
    const subject = typed || lienStatusSubject(payload)
    const senderName = (me.name ?? '').trim() || 'Someone on the Lien desk'
    const replyTo = hasEmail(me) ? (me.email as string).trim() : undefined
    const appUrl = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')

    const sendTo = async (to: UserRow, subjectLine: string) => {
      const options = { appUrl, senderName, note, readerIsLeader: to.role === 'master_technician' }
      return sendEmailViaResend((to.email as string).trim(), subjectLine, lienStatusEmailText(payload, options), lienStatusEmailHtml(payload, options), resendApiKey, {
        replyTo,
        emailType: 'lien_desk_summary',
      })
    }

    if (mode === 'test') {
      if (!replyTo) return jsonResponse({ error: 'Your account has no email on file.' }, 400)
      const res = await sendTo(me, `[TEST] ${subject}`)
      if (!res.success) return jsonResponse({ error: res.error ?? 'The email did not send.' }, 502)
      return jsonResponse({ sent_to: [senderName] })
    }

    const ids = Array.isArray(body.recipient_user_ids) ? [...new Set(body.recipient_user_ids.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()))] : []
    if (ids.length === 0) return jsonResponse({ error: 'Pick someone to send it to.' }, 400)
    if (ids.length > MAX_RECIPIENTS) return jsonResponse({ error: `One email goes to ${MAX_RECIPIENTS} people at most.` }, 400)
    const { data: rows, error: rowsErr } = await admin.from('users').select('id, name, email, role, archived_at').in('id', ids).match(REAL_ACCOUNT)
    if (rowsErr) return jsonResponse({ error: rowsErr.message }, 500)
    const byId = new Map(((rows ?? []) as UserRow[]).map((r) => [r.id, r]))
    const recipients: UserRow[] = []
    for (const id of ids) {
      const r = byId.get(id)
      if (!r || r.archived_at || !DESK_ROLES.has(String(r.role)) || !hasEmail(r)) {
        return jsonResponse({ error: `${(r?.name ?? '').trim() || 'One of the people picked'} cannot get this email. It goes only to people who use the Lien desk.` }, 400)
      }
      recipients.push(r)
    }

    const sentTo: string[] = []
    const failed: Array<{ name: string; error: string }> = []
    for (const r of recipients) {
      const res = await sendTo(r, subject)
      const name = (r.name ?? '').trim() || (r.email ?? '')
      if (res.success) sentTo.push(name)
      else failed.push({ name, error: res.error ?? 'did not send' })
    }
    if (sentTo.length === 0) return jsonResponse({ error: failed[0]?.error ?? 'The email did not send.', failed }, 502)
    return jsonResponse({ sent_to: sentTo, failed })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
