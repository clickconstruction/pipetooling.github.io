// messages-notify (v2.5317, Messages cut 4c): the people a change to a contract clause waits on hear of it.
//
// When the office sends a clause change for approval (edit_clause answered `proposed`), the app calls this with the
// proposals it just made: the approvers (a dev or a controller, gc_clause_approve_team) get a push on every device and
// an email with the change. When a controller or a dev decides one (approve_clause_proposal, decline_clause_proposal),
// the app calls it with that proposal: the editor gets an email that it went out, or the why. Their text by phone comes
// with Quo (cut 5).
//
// The caller names only the rows. The function reads them with the service role and refuses unless the caller made each
// change (or decided this one) in the last 15 minutes, so nobody can buzz the approvers with old rows or push words of
// their own: it writes the words itself (_shared/clauseNotify.ts). Everyone it reaches is our own staff, so no sent copy.
// Each person reached gets one notification_history row per channel.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { clauseDecisionNote, clauseProposalNote, notifyScope, type NotifyChange, type NotifyClause } from '../_shared/clauseNotify.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** gc_clause_approve_team(): who approves a clause change. The client's copy is GC_CLAUSE_APPROVE_TEAM. */
const APPROVER_ROLES = ['dev', 'controller']
const FRESH_MS = 15 * 60 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ProposalRow = {
  id: string
  paper_id: string
  kind: 'new' | 'edit' | 'retire'
  clause_id: string | null
  text_en: string
  text_es: string
  scope: string[]
  by_user_id: string | null
  by_name: string
  why: string
  state: 'proposed' | 'approved' | 'declined'
  created_at: string
  decided_by: string | null
  decided_by_name: string | null
  decided_at: string | null
  decline_why: string | null
  result_v: number | null
}
type ClauseRow = { id: string; paper_id: string; sequence_order: number; scope: string[]; retired_at: string | null }
type Person = { id: string; name: string | null; email: string | null }

const PROPOSAL_COLUMNS = 'id, paper_id, kind, clause_id, text_en, text_es, scope, by_user_id, by_name, why, state, created_at, decided_by, decided_by_name, decided_at, decline_why, result_v'

const fresh = (at: string | null) => at != null && Date.now() - Date.parse(at) <= FRESH_MS
const changeOf = (r: ProposalRow): NotifyChange => ({ kind: r.kind, clauseId: r.clause_id, en: r.text_en, es: r.text_es, scope: notifyScope(r.scope ?? []), by: r.by_name, why: r.why ?? '' })
const clauseOf = (r: ClauseRow): NotifyClause => ({ id: r.id, order: r.sequence_order, scope: notifyScope(r.scope ?? []), retiredAt: r.retired_at })

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function emailHtml(text: string, link: string): string {
  const paras = text.split(/\n\n/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
  return `${paras.join('')}<p><a href="${link}">Open Contracts and clauses</a></p>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!authHeader || !token) return json({ error: 'Unauthorized' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = (await req.json().catch(() => ({}))) as { proposal_ids?: unknown; decided?: unknown }
    const admin = createClient(supabaseUrl, serviceRoleKey)
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const appOrigin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')

    const email = async (to: Person, subject: string, text: string, url: string, emailType: string): Promise<boolean> => {
      const address = (to.email ?? '').trim()
      if (!resendApiKey || !address) return false
      const link = `${appOrigin}${url}`
      // Our own staff: no sent copy (docs/SENT_COPIES.md).
      const mail = await sendEmailViaResend(address, subject, `${text}\n\n${link}`, emailHtml(text, link), resendApiKey, { emailType })
      if (!mail.success) console.error('messages-notify email error', mail.error)
      return mail.success
    }
    const logged = async (to: Person, templateType: string, title: string, preview: string, channel: 'push' | 'email') => {
      await admin.from('notification_history').insert({ recipient_user_id: to.id, template_type: templateType, title, body_preview: preview.substring(0, 200), channel })
    }

    // ---------- a change sent for approval: the approvers ----------
    if (Array.isArray(body.proposal_ids)) {
      const named = body.proposal_ids as unknown[]
      if (named.some((x) => typeof x !== 'string' || !UUID.test(x))) return json({ error: 'Name the changes by id' }, 400)
      const ids = [...new Set(named as string[])]
      if (ids.length === 0 || ids.length > 50) return json({ error: 'Name between 1 and 50 changes' }, 400)
      const { data: rowsData } = await admin.from('contract_clause_proposals').select(PROPOSAL_COLUMNS).in('id', ids)
      const rows = (rowsData ?? []) as ProposalRow[]
      if (rows.length !== ids.length || rows.some((r) => r.by_user_id !== user.id)) return json({ error: 'Not your change' }, 403)
      const waiting = rows.filter((r) => r.state === 'proposed' && fresh(r.created_at))
      if (waiting.length === 0) return json({ success: true, push_sent: 0, email_sent: 0, approvers: [], message: 'Nothing waits' })

      const paperIds = [...new Set(waiting.map((r) => r.paper_id))]
      const [{ data: papers }, { data: clauses }, { data: people }] = await Promise.all([
        admin.from('contract_template_documents').select('id, document_name').in('id', paperIds),
        admin.from('contract_clauses').select('id, paper_id, sequence_order, scope, retired_at').in('paper_id', paperIds),
        admin.from('users').select('id, name, email, role, archived_at').match(REAL_ACCOUNT).in('role', APPROVER_ROLES).is('archived_at', null),
      ])
      const approvers = ((people ?? []) as Array<Person & { role: string }>).filter((u) => u.id !== user.id)
      if (approvers.length === 0) return json({ success: true, push_sent: 0, email_sent: 0, approvers: [], message: 'No approver to tell' })
      const notes = paperIds.map((pid) =>
        clauseProposalNote({
          paperId: pid,
          documentName: ((papers ?? []) as Array<{ id: string; document_name: string }>).find((p) => p.id === pid)?.document_name ?? 'paper',
          clauses: ((clauses ?? []) as ClauseRow[]).filter((c) => c.paper_id === pid).map(clauseOf),
          changes: waiting.filter((r) => r.paper_id === pid).map(changeOf),
        }),
      )

      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
      const canPush = Boolean(vapidPublicKey && vapidPrivateKey)
      if (canPush) webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey!, vapidPrivateKey!)

      let pushSent = 0
      let emailSent = 0
      const reached: string[] = []
      for (const approver of approvers) {
        let reachedThisOne = false
        const { data: subscriptions } = canPush ? await admin.from('push_subscriptions').select('endpoint, p256dh_key, auth_key').eq('user_id', approver.id) : { data: [] }
        for (const note of notes) {
          let pushed = 0
          const payload = JSON.stringify({ title: note.title, body: note.body, url: note.url, tag: note.tag })
          for (const sub of subscriptions ?? []) {
            try {
              await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } }, payload, { TTL: 86400 })
              pushed++
            } catch (pushErr) {
              console.error('messages-notify push error', String(sub.endpoint ?? '').substring(0, 50), pushErr)
            }
          }
          if (pushed > 0) await logged(approver, 'clause_proposal', note.title, note.body, 'push')
          const mailed = await email(approver, note.subject, note.emailText, note.url, 'clause_proposal')
          if (mailed) await logged(approver, 'clause_proposal', note.title, note.body, 'email')
          pushSent += pushed
          emailSent += mailed ? 1 : 0
          reachedThisOne = reachedThisOne || pushed > 0 || mailed
        }
        if (reachedThisOne) reached.push((approver.name ?? '').trim())
      }
      return json({ success: true, push_sent: pushSent, email_sent: emailSent, approvers: reached.filter(Boolean).sort((a, b) => a.localeCompare(b)) })
    }

    // ---------- a change decided: the editor ----------
    if (typeof body.decided === 'string') {
      if (!UUID.test(body.decided)) return json({ error: 'Name the change by id' }, 400)
      const { data: rowData } = await admin.from('contract_clause_proposals').select(PROPOSAL_COLUMNS).eq('id', body.decided).maybeSingle()
      const row = rowData as ProposalRow | null
      if (!row || row.decided_by !== user.id || (row.state !== 'approved' && row.state !== 'declined')) return json({ error: 'Not your decision' }, 403)
      if (!fresh(row.decided_at)) return json({ success: true, email_sent: false, message: 'Decided a while ago' })
      if (!row.by_user_id || row.by_user_id === user.id) return json({ success: true, email_sent: false, message: 'Their own change' })
      const [{ data: editor }, { data: paper }, { data: clauses }, { data: decider }] = await Promise.all([
        admin.from('users').select('id, name, email, archived_at').match(REAL_ACCOUNT).eq('id', row.by_user_id).maybeSingle(),
        admin.from('contract_template_documents').select('id, document_name').eq('id', row.paper_id).maybeSingle(),
        admin.from('contract_clauses').select('id, paper_id, sequence_order, scope, retired_at').eq('paper_id', row.paper_id),
        admin.from('users').select('name').eq('id', user.id).maybeSingle(),
      ])
      if (!editor || editor.archived_at) return json({ success: true, email_sent: false, message: 'No one to tell' })
      const note = clauseDecisionNote({
        paperId: row.paper_id,
        documentName: (paper as { document_name?: string } | null)?.document_name ?? 'paper',
        clauses: ((clauses ?? []) as ClauseRow[]).map(clauseOf),
        change: changeOf(row),
        decider: (row.decided_by_name ?? '').trim() || ((decider as { name?: string | null } | null)?.name ?? '').trim() || 'A controller',
        state: row.state,
        declineWhy: row.decline_why,
        resultV: row.result_v,
      })
      const mailed = await email(editor as Person, note.subject, note.emailText, note.url, 'clause_decision')
      if (mailed) await logged(editor as Person, 'clause_decision', note.subject, note.emailText, 'email')
      return json({ success: true, email_sent: mailed, editor_name: ((editor as Person).name ?? '').trim() || null })
    }

    return json({ error: 'Send proposal_ids or decided' }, 400)
  } catch (error) {
    console.error('Error in messages-notify:', error)
    return json({ error: (error as Error)?.message || 'Internal server error' }, 500)
  }
})
