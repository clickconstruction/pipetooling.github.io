import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { COMPANY_EMAIL_FROM } from '../_shared/emailFrom.ts'
import { fileSentEmailBestEffort } from '../_shared/fileSentCopy.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'

// Email sub papers to a sub, PDFs attached (punch list #350, the plan's PR 5): a Work statement, a Payment
// record, a Statement of account, or several in one message. Deployed only on Taunya's go that names it; until
// the press lands in the papers window nothing in the app calls it.
//
// The caller is signed in and must be one of the office roles who see sub pay (dev, master, assistant,
// controller), not in training and not archived. The recipient is the roster's own email for that person, read
// here under the caller's policies and never taken from the body, so a paper about one sub cannot be mailed to
// another address. The PDFs arrive from the client, drawn by the same kernel the screen previews
// (_shared/subPapers.ts + _shared/subPapersPdf.ts). Each paper is kept as a sent copy of its own, under its own
// kind, on the sub and on its jobs (sent_documents), with the message it went in.
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** A name a mail client shows: no path, no control characters, and always a .pdf. */
const fileName = (raw: unknown): string => {
  const base = String(raw ?? '').replace(/[\\/\u0000-\u001f]/g, ' ').trim().slice(0, 120) || 'paper.pdf'
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`
}

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
    if (!UUID.test(personId)) return jsonResponse({ error: 'person_id required' }, 400)
    if (body.by === 'text') return jsonResponse({ error: 'Texting a link to a paper is not built yet. Send by email, or copy the link.' }, 400)
    if (body.by !== 'email') return jsonResponse({ error: 'by must be email' }, 400)

    const papers = Array.isArray(body.papers) ? body.papers : []
    if (papers.length === 0 || papers.length > MAX_PAPERS) return jsonResponse({ error: `Send between 1 and ${MAX_PAPERS} papers at a time.` }, 400)
    let total = 0
    for (const p of papers) {
      const b64 = typeof p.pdf_base64 === 'string' ? p.pdf_base64 : ''
      if (!PAPER_KINDS.has(String(p.kind))) return jsonResponse({ error: `Unknown paper kind ${String(p.kind)}.` }, 400)
      if (!b64 || b64.length > MAX_PDF_BASE64_CHARS) return jsonResponse({ error: `${fileName(p.file_name)} is missing or too large to attach.` }, 400)
      total += b64.length
    }
    if (total > MAX_TOTAL_BASE64_CHARS) return jsonResponse({ error: 'These papers are too large for one email. Send fewer at a time.' }, 400)

    // The recipient is the roster's own address for this person, read under the caller's policies.
    const { data: person, error: personErr } = await userClient.from('people').select('id, name, email').eq('id', personId).maybeSingle()
    if (personErr || !person) return jsonResponse({ error: 'That person is not on the roster, or you cannot read them.' }, 403)
    const to = typeof person.email === 'string' ? person.email.trim() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return jsonResponse({ error: `${person.name} has no email on the roster. Add one on People → Subs, then send.` }, 400)

    const subject = ((typeof body.subject === 'string' && body.subject.trim()) || 'Papers from our office').slice(0, 200)
    const text = ((typeof body.message === 'string' && body.message.trim()) || 'Your papers are attached as PDFs.').slice(0, 4000)
    const attachments = papers.map((p) => ({ filename: fileName(p.file_name), content: String(p.pdf_base64) }))
    const html = `<p>${escapeHtml(text)}</p><p style="color:#6b7280;font-size:13px">${attachments.map((a) => escapeHtml(a.filename)).join('<br>')}</p>`

    const result = await sendEmailViaResend(to, subject, text, html, resendApiKey, { from: COMPANY_EMAIL_FROM, attachments, emailType: 'sub_paper' })
    if (!result.success) return jsonResponse({ error: `The email did not go: ${result.error ?? 'no reason was given'}` }, 502)

    // One sent copy per paper, under its own kind: the message it went in, and that paper's PDF. Best effort.
    for (let i = 0; i < papers.length; i++) {
      const p = papers[i]!
      const jobIds = (Array.isArray(p.job_ids) ? p.job_ids : []).filter((id): id is string => typeof id === 'string' && UUID.test(id))
      await fileSentEmailBestEffort(
        { kind: String(p.kind), title: (typeof p.title === 'string' && p.title.trim()) || subject, recipientName: person.name, personId, jobIds, sentBy: user.id },
        { to: [to], from: COMPANY_EMAIL_FROM, subject, html, attachments: [attachments[i]!], resendEmailId: result.resendEmailId ?? null },
      )
    }

    return jsonResponse({ ok: true, to, papers: papers.length, resend_email_id: result.resendEmailId ?? null })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
