import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callCtManageUser } from '../_shared/ctBridge.ts'

// Audit loop v2 (v2.2518): one human gesture ends the whole audit. The Audits tab
// calls this to finish (or reopen) a robot bid's audit; the function does the PT
// side (status + ledger stamp) AND flips the twin's CountTooling project review
// status over the bridge ('reviewed' on finish, 'ready' on reopen) — the CT leg is
// fail-soft (`ct_bridge` in the response says what happened; the digest sweep
// catches stragglers). Staff only (estimator+), never twins: RLS enforces the same
// human-only rule on direct table writes, and this function must not be a loophole.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WRITE_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller', 'estimator'])

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405)
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Unauthorized - No authorization header' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authUser) return jsonResponse({ error: 'Unauthorized - Invalid or expired session' }, 401)

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: caller, error: callerErr } = await admin
      .from('users').select('role, email, is_digital_twin').eq('id', authUser.id).single()
    if (callerErr || !caller) return jsonResponse({ error: 'Forbidden - unknown user' }, 403)
    if (caller.is_digital_twin === true) return jsonResponse({ error: 'Forbidden - finishing an audit is the human auditor\'s act' }, 403)
    if (!WRITE_ROLES.has(String(caller.role))) return jsonResponse({ error: 'Forbidden - estimator+ only' }, 403)

    const body = (await req.json().catch(() => null)) as { audit_id?: string; action?: string } | null
    const auditId = String(body?.audit_id ?? '').trim()
    const action = String(body?.action ?? 'finish')
    if (!auditId) return jsonResponse({ error: 'audit_id required' }, 400)
    if (!['finish', 'reopen'].includes(action)) return jsonResponse({ error: "action must be 'finish' or 'reopen'" }, 400)

    const { data: audit, error: auditErr } = await admin
      .from('bid_audits').select('id, bid_id, ct_project_id, status').eq('id', auditId).maybeSingle()
    if (auditErr) return jsonResponse({ error: `audit read failed: ${auditErr.message}` }, 500)
    if (!audit) return jsonResponse({ error: 'no such audit' }, 404)

    const now = new Date().toISOString()
    const patch = action === 'finish'
      ? { status: 'done', completed_at: now, completed_by: authUser.id, updated_at: now }
      : { status: 'pending', completed_at: null, completed_by: null, updated_at: now }
    const { error: updErr } = await admin.from('bid_audits').update(patch).eq('id', auditId)
    if (updErr) return jsonResponse({ error: `audit update failed: ${updErr.message}` }, 500)

    if (action === 'finish') {
      const { count } = await admin
        .from('bid_audit_notes').select('id', { count: 'exact', head: true })
        .eq('audit_id', auditId).in('kind', ['note', 'answer'])
      await admin.from('bids_submission_entries').insert({
        bid_id: audit.bid_id,
        notes: `[audit] finished by ${caller.email ?? 'staff'} — ${count ?? 0} note(s)/answer(s) left for the robot to digest.`,
      })
    }

    // CT leg — fail-soft: the PT finish stands even when the bridge hiccups.
    let ctBridge = 'skipped: no CT project on the audit'
    if (audit.ct_project_id) {
      try {
        const { status, json } = await callCtManageUser({
          verb: 'set_twin_project_review',
          project_id: audit.ct_project_id,
          status: action === 'finish' ? 'reviewed' : 'ready',
          note: action === 'finish' ? `Audited in PipeTooling by ${caller.email ?? 'staff'}` : undefined,
        })
        ctBridge = status === 200 ? 'ok' : `failed: CT ${status} ${String(json.error ?? '')}`.trim()
      } catch (e) {
        ctBridge = `failed: ${String(e)}`
      }
    }
    console.log(`audit-finish: ${caller.email} ${action} ${auditId} ct=${ctBridge}`)
    return jsonResponse({ ok: true, status: patch.status, ct_bridge: ctBridge }, 200)
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
})
