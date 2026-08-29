import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callCtManageUser } from '../_shared/ctBridge.ts'
import { diffCtRoster, type CtRosterDiff, type CtRosterRow, type PtRosterRow } from '../_shared/ctRosterDiff.ts'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'

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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function section(title: string, rows: string[], hint: string): string {
  if (rows.length === 0) return ''
  return `<h3 style="margin:16px 0 4px;font-size:15px">${esc(title)} (${rows.length})</h3>
<p style="margin:0 0 6px;color:#666;font-size:12px">${esc(hint)}</p>
<ul style="margin:0;padding-left:20px;font-size:13px">${rows.map((r) => `<li>${r}</li>`).join('')}</ul>`
}

function renderEmail(diff: CtRosterDiff, ptCount: number, ctCount: number): { subject: string; html: string } {
  const issueCount =
    diff.onlyInCt.length + diff.linkedButGone.length + diff.twinFlagMismatch.length +
    diff.activeMismatch.length + diff.emailChanged.length + diff.backfillCandidates.length
  const subject = diff.clean
    ? 'CT↔PT roster audit: clean'
    : `CT↔PT roster audit: ${issueCount} item${issueCount === 1 ? '' : 's'} to look at`
  const pair = ({ pt, ct }: { pt: PtRosterRow; ct: CtRosterRow }) =>
    `${esc(pt.name || pt.email)} — PT <code>${esc(pt.email)}</code> ↔ CT <code>${esc(ct.email ?? ct.ct_user_id)}</code>`
  const html = `<div style="font-family:sans-serif;max-width:640px">
<h2 style="font-size:17px;margin:0 0 4px">CT↔PT roster audit</h2>
<p style="margin:0 0 10px;color:#444;font-size:13px">${ptCount} PipeTooling people · ${ctCount} CountTooling accounts · ${diff.clean ? 'no drift — all clear ✅' : 'drift found:'}</p>
${section('Only on CountTooling', diff.onlyInCt.map((c) => `<code>${esc(c.email ?? c.ct_user_id)}</code>${c.active ? '' : ' (banned)'}${c.is_admin ? ' — CT admin' : ''}`), 'CT accounts no PT person links to and no PT email matches. Unmanaged seats — link, archive on CT via the bridge, or leave deliberately.')}
${section('Linked but gone from CT', diff.linkedButGone.map((p) => `${esc(p.name || p.email)} — join key <code>${esc(p.counttooling_user_id ?? '')}</code>`), 'The PT join key points at a CT account that no longer exists. Clear the key or recreate the seat.')}
${section('Active mismatch', diff.activeMismatch.map(pair), 'One side is retired, the other still active — the exact offboarding hole the bridge exists to close. Usually fixed by re-running archive/restore.')}
${section('Twin flag mismatch', diff.twinFlagMismatch.map(pair), 'is_digital_twin disagrees between the apps for a linked pair.')}
${section('Email changed under a linked uuid', diff.emailChanged.map(pair), 'Same person, different emails (twin fleet domains are already normalized). Forward the change with update_email.')}
${section('Backfill candidates', diff.backfillCandidates.map(({ pt }) => `${esc(pt.name || pt.email)} — <code>${esc(pt.email)}</code>`), 'Unlinked PT people whose email exists on CT. One click of “run backfill” in Settings → Digital twins links them.')}
<p style="margin:14px 0 0;color:#999;font-size:11px">Weekly audit from the ct-roster-audit function — drift is caught, not prevented. Settings → System → Digital twins holds the bridge tools.</p>
</div>`
  return { subject, html }
}

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
    const { subject, html } = renderEmail(diff, ptRows.length, (json.roster as CtRosterRow[]).length)

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
    console.log(`ct-roster-audit: sent (${subject}) to ${devs.length} dev(s); clean=${diff.clean}`)
    return jsonResponse({ success: true, clean: diff.clean, subject, recipients: devs.length }, 200)
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
})
