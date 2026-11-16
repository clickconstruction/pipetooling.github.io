import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'

// Email sub papers to a sub, PDFs attached (punch list #350, PR 5): a Work statement, a Payment
// record, a Statement of account, or several in one message. NOT DEPLOYED: written in the design
// spike of 2026-11-15 and waiting on Taunya's go.
//
// The caller is signed in and must be one of the office roles who see sub pay (dev, master,
// assistant, controller). The recipient is the roster's own email for that person, read here and
// never trusted from the body, so a paper about one sub cannot be mailed to another address. The
// PDFs arrive from the client, drawn by the same kernel the screen previews
// (_shared/subPapers.ts + _shared/subPapersPdf.ts). Each paper is kept as a sent copy on the sub
// and on its jobs (sent_documents), under its own kind.
//
// A texted link is not built: `by: 'text'` is refused with the reason, never sent as an email.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OFFICE_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])
const PAPER_KINDS = new Set(['sub_work_statement', 'sub_payment_record', 'sub_statement_of_account'])
const MAX_PAPERS = 12
const MAX_PDF_BASE64_CHARS = 3_000_000
const MAX_TOTAL_BASE64_CHARS = 9_000_000

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

type PaperIn = { kind?: string; number?: string; title?: string; file_name?: string; job_ids?: unknown; pdf_base64?: string }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    const token = (authHeader ?? '').replace(/^Bearer\s+/i, '')
    if (!authHeader || !token) return jsonResponse({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)
    const archived = await refuseArchivedCaller(admin, user.id, corsHeaders)
    if (archived) return archived

    const { data: me } = await admin.from('users').select('role, name, read_only').eq('id', user.id).maybeSingle()
    if (!me || !OFFICE_ROLES.has(String(me.role))) return jsonResponse({ error: 'Only the office roles who see sub pay can send a sub paper.' }, 403)
    if (me.read_only === true) return jsonResponse({ error: 'This account is in training mode and cannot send.' }, 403)

    const body = (await req.json()) as { person_id?: string; by?: string; subject?: string; message?: string; papers?: PaperIn[] }
    const personId = typeof body.person_id === 'string' ? body.person_id.trim() : ''
    if (!personId) return jsonResponse({ error: 'person_id required' }, 400)
    if (body.by === 'text') return jsonResponse({ error: 'Texting a link to a paper is not built yet. Send by email, or copy the link.' }, 400)
    if (body.by !== 'email') return jsonResponse({ error: 'by must be email' }, 400)

    const papers = Array.isArray(body.papers) ? body.papers : []
    if (papers.length === 0 || papers.length > MAX_PAPERS) return jsonResponse({ error: `Send between 1 and ${MAX_PAPERS} papers at a time.` }, 400)
    let total = 0
    for (const p of papers) {
      const b64 = typeof p.pdf_base64 === 'string' ? p.pdf_base64 : ''
      if (!PAPER_KINDS.has(String(p.kind))) return jsonResponse({ error: `Unknown paper kind ${String(p.kind)}.` }, 400)
      if (!b64 || b64.length > MAX_PDF_BASE64_CHARS) return jsonResponse({ error: `${p.file_name ?? 'A paper'} is missing or too large to attach.` }, 400)
      total += b64.length
    }
    if (total > MAX_TOTAL_BASE64_CHARS) return jsonResponse({ error: 'These papers are too large for one email. Send fewer at a time.' }, 400)

    // The recipient is the roster's own address for this person, read under the caller's policies.
    const { data: person, error: personErr } = await userClient.from('people').select('id, name, email, archived_at').eq('id', personId).maybeSingle()
    if (personErr || !person) return jsonResponse({ error: 'That person is not on the roster, or you cannot read them.' }, 403)
    const to = typeof person.email === 'string' ? person.email.trim() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return jsonResponse({ error: `${person.name} has no email on the roster. Add one on People → Subs, then send.` }, 400)

    const subject = (typeof body.subject === 'string' && body.subject.trim()) || 'Papers from our office'
    const text = (typeof body.message === 'string' && body.message.trim()) || 'Your papers are attached as PDFs.'
    const html = `<p>${escapeHtml(text)}</p><p style="color:#6b7280;font-size:13px">${papers.map((p) => escapeHtml(String(p.file_name ?? 'paper.pdf'))).join('<br>')}</p>`
    const jobIds = [...new Set(papers.flatMap((p) => (Array.isArray(p.job_ids) ? p.job_ids : [])).filter((id): id is string => typeof id === 'string' && id.length > 0))]

    const result = await sendEmailViaResend(to, subject, text, html, resendApiKey, {
      from: EMAIL_FROM,
      attachments: papers.map((p) => ({ filename: String(p.file_name ?? 'paper.pdf'), content: String(p.pdf_base64) })),
      emailType: 'sub_paper',
      // One filing for the message: its attachments are kept with it. The lead paper names the kind.
      file: { kind: String(papers[0]!.kind), title: String(papers[0]!.title ?? subject), recipientName: person.name, personId, jobIds, sentBy: user.id },
    })
    if (!result.success) return jsonResponse({ error: `The email did not go: ${result.error ?? 'no reason was given'}` }, 502)

    return jsonResponse({ ok: true, to, papers: papers.length, resend_email_id: result.resendEmailId ?? null })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
