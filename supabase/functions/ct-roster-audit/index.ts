import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callCtManageUser } from '../_shared/ctBridge.ts'
import { diffCtRoster, type CtRosterRow, type PtRosterRow } from '../_shared/ctRosterDiff.ts'
import { renderCtRosterAuditEmail } from '../_shared/ctRosterAuditEmail.ts'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'

// CT↔PT weekly roster drift audit (v2.2438; CT bridge Phase 3). Cron-invoked Mondays:
// pulls the PT roster (service role) and the CT roster (manage-user `roster` over the
// bridge), diffs them with the pure _shared/ctRosterDiff kernel, and emails every dev.
// The email ALWAYS sends — an all-clear Monday note is the heartbeat; a missing email
// means the audit itself broke. Drift is caught here, not prevented (locked decision).
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET,
// CT_MANAGE_USER_URL, CT_MANAGE_USER_SECRET.

const FROM = EMAIL_FROM

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// The email itself is `_shared/ctRosterAuditEmail.ts` (v2.4182) — What the team sees renders it on sample data.

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405)
  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    if (!cronSecret || headerSecret !== cronSecret) return jsonResponse({ error: 'Forbidden' }, 403)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!serviceRoleKey) return jsonResponse({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, 500)
    if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: ptRows, error: ptErr } = await admin
      .from('users')
      .select('id, email, name, archived_at, is_digital_twin, counttooling_user_id')
    if (ptErr || !ptRows) return jsonResponse({ error: `PT roster read failed: ${ptErr?.message}` }, 500)

    const { status, json } = await callCtManageUser({ verb: 'roster' })
    if (status !== 200 || !Array.isArray(json.roster)) {
      return jsonResponse({ error: `CT roster pull failed: ${status} ${String(json.error ?? '')}` }, 502)
    }

    const diff = diffCtRoster(ptRows as PtRosterRow[], json.roster as CtRosterRow[])
    const { subject, html } = renderCtRosterAuditEmail(diff, ptRows.length, (json.roster as CtRosterRow[]).length)

    const { data: devs, error: devErr } = await admin
      .from('users')
      .select('email')
      .eq('role', 'dev')
      .is('archived_at', null)
    if (devErr || !devs?.length) return jsonResponse({ error: `No dev recipients: ${devErr?.message ?? 'none found'}` }, 500)

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: devs.map((d) => d.email), subject, html }),
    })
    if (!resendResponse.ok) {
      const errText = await resendResponse.text()
      return jsonResponse({ error: `Resend failed: ${resendResponse.status} ${errText}` }, 502)
    }
    const sent = (await resendResponse.json().catch(() => ({}))) as { id?: string }
    await logEmailSendBestEffort({
      resendEmailId: sent.id ?? null,
      to: devs.map((d) => d.email),
      from: FROM,
      subject,
      emailType: 'ct_roster_audit',
    })
    console.log(`ct-roster-audit: sent (${subject}) to ${devs.length} dev(s); clean=${diff.clean}`)
    return jsonResponse({ success: true, clean: diff.clean, subject, recipients: devs.length }, 200)
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
})
