import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type ResendListedEmail = {
  id?: string
  to?: string[] | string
  from?: string
  subject?: string
  created_at?: string
  last_event?: string
}

function toEmailArray(to: string[] | string | undefined): string[] {
  if (Array.isArray(to)) return to.filter((t): t is string => typeof t === 'string')
  if (typeof to === 'string' && to.trim()) return [to]
  return []
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey?.trim()) return jsonResponse({ error: 'Server misconfigured: RESEND_API_KEY' }, 500)
    if (!serviceKey) return jsonResponse({ error: 'Server misconfigured: service role' }, 500)

    // Dev-only: this list is org-wide and includes customer-facing subjects/recipients.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Missing authorization' }, 401)
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const userClient = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser(token)
    if (authErr || !user) return jsonResponse({ error: 'Invalid session' }, 401)
    const { data: userRow, error: roleErr } = await userClient.from('users').select('role').eq('id', user.id).maybeSingle()
    if (roleErr || (userRow as { role?: string } | null)?.role !== 'dev') {
      return jsonResponse({ error: 'Forbidden — dev only' }, 403)
    }

    const listRes = await fetch('https://api.resend.com/emails', {
      headers: { Authorization: `Bearer ${resendApiKey}`, Accept: 'application/json' },
    })
    if (!listRes.ok) {
      const text = await listRes.text().catch(() => '')
      return jsonResponse({ error: `Resend list failed (${listRes.status})`, detail: text.slice(0, 300) }, 502)
    }
    const listBody = (await listRes.json()) as { data?: ResendListedEmail[] } | ResendListedEmail[]
    const emails: ResendListedEmail[] = Array.isArray(listBody) ? listBody : (listBody.data ?? [])

    const rows = emails
      .filter((e) => typeof e.id === 'string' && e.id)
      .map((e) => ({
        resend_email_id: e.id as string,
        sent_at: e.created_at ?? null,
        from_email: e.from ?? null,
        to_emails: toEmailArray(e.to),
        subject: e.subject ?? null,
        last_event: e.last_event ?? null,
        source: 'sync',
      }))

    if (rows.length === 0) return jsonResponse({ ok: true, synced: 0 })

    const admin = createClient(supabaseUrl, serviceKey)
    // Upsert on the Resend id; webhook rows win on freshness via updated_at, but a
    // sync never downgrades a row's last_event to null.
    let synced = 0
    for (const row of rows) {
      const { data: existing } = await admin
        .from('email_send_log')
        .select('id, last_event')
        .eq('resend_email_id', row.resend_email_id)
        .maybeSingle()
      if (existing) {
        const patch: Record<string, unknown> = {
          sent_at: row.sent_at,
          from_email: row.from_email,
          to_emails: row.to_emails,
          subject: row.subject,
        }
        if (row.last_event) patch.last_event = row.last_event
        const { error } = await admin.from('email_send_log').update(patch).eq('id', (existing as { id: string }).id)
        if (!error) synced++
      } else {
        const { error } = await admin.from('email_send_log').insert(row)
        if (!error) synced++
      }
    }

    return jsonResponse({ ok: true, synced, listed: rows.length })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
