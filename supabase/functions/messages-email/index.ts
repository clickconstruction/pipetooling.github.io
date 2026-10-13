import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { mailboxWithName } from '../_shared/mailboxWithName.ts'
import { buildMessagesEmail, letterheadFor, MESSAGES_EMAIL_KIND, parseMessagesEmailBody } from '../_shared/messagesEmail.ts'
import { emailLinkLines, parseEmailFiles } from '../_shared/messagesEmailFiles.ts'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { placeFiles, readFiles, takeBack } from './files.ts'

/**
 * messages-email — Messages, cut 3: an email from the reply box's send window, to one person at one of their
 * addresses. The caller is someone in the office (`gc_office_team()`, asked as them), a real account (never a sample
 * or a digital twin), and never a training account. The body is `parseMessagesEmailBody`'s (`_shared/messagesEmail.ts`):
 * the contact, the address (one of their `contact_channels`), the job it is tied to, and the words the app put
 * together with `compose.emailDraft`.
 *
 * In order: the line is written in `messages` as the service role (channel email, direction out, the job and the
 * address), so the email has an id before it goes; the email goes through Resend's existing send under our letterhead
 * (`buildMessagesEmail`), from the company's name on `EMAIL_FROM`'s address, its replies to the sender; its sent copy
 * is filed with the line as its source, so the thread's overlay of sent copies skips it. If Resend refuses it, the line
 * is taken back out and the refusal is said. The answer is the line's id, which a later press can name (cut 2's
 * *this message gets it done*).
 *
 * Its files (cut 7e, `files.ts`; the rules are `_shared/messagesEmailFiles.ts`): each the app asked to send is checked
 * and, when it goes as the file, read before the line is written, and a file from this computer is put into the job's
 * Team only first. Once the line has its id, each link is made (their portal at its page, or our link to the Drive
 * file), each file that goes as the file is copied under `out/` and attached, and every file is written on the line as
 * it went. The links go under the words. If the email does not go, the links and the copies are taken back too.
 *
 * verify_jwt is off in config.toml, as for quo-send: the caller's session is checked here.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const refuse = (error: string, words: string, status: number) => json({ ok: false, error, words }, status)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return refuse('badRequest', 'Send the email with POST.', 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey || !resendKey) return refuse('failed', 'Email is not set up yet.', 503)
    const admin = createClient(supabaseUrl, serviceRoleKey)
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })

    const { data: u } = await caller.auth.getUser()
    if (!u?.user) return refuse('signIn', 'Sign in to send an email.', 401)
    const { data: who } = await admin.from('users').select('id, name, email, read_only').match(REAL_ACCOUNT).eq('id', u.user.id).maybeSingle()
    if (!who || who.read_only) return refuse('readOnly', 'This account cannot send emails.', 403)
    const { data: office, error: officeError } = await caller.rpc('gc_office_team')
    if (officeError || office !== true) return refuse('officeOnly', 'Only the office sends from here.', 403)

    const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const input = parseMessagesEmailBody(raw)
    if (!input) return refuse('badRequest', 'The email is missing its person, address, subject or words.', 400)
    const asks = parseEmailFiles(raw?.files)
    if (!asks) return refuse('badRequest', 'One of the files is not one this email can take. Take it off and add it again.', 400)

    const { data: channel } = await admin.from('contact_channels').select('id, contact_id, kind, value').eq('id', input.channelId).maybeSingle()
    if (!channel || channel.contact_id !== input.contactId || channel.kind !== 'email') {
      return refuse('notFound', 'That address is not one of theirs.', 404)
    }
    const to = String(channel.value ?? '').trim()
    if (!to.includes('@')) return refuse('notFound', 'That address cannot take an email.', 422)
    const { data: contact } = await admin
      .from('contacts')
      .select('id, kind, name, customer_id, customer_contact_person_id, gc_company_id, gc_company_person_id')
      .eq('id', input.contactId)
      .maybeSingle()
    if (!contact) return refuse('notFound', 'That person is not in Messages.', 404)

    // The sent copy files under what the job is: a bid by its id, a Pipeline job by its id, a GC project by its billing job.
    const tie = input.tie
    let jobIds: string[] = []
    if (tie?.column === 'jobs_ledger_id') jobIds = [tie.jobId]
    if (tie?.column === 'project_id') {
      const { data: project } = await admin.from('gc_projects').select('billing_job_id').eq('project_id', tie.jobId).maybeSingle()
      if (project?.billing_job_id) jobIds = [String(project.billing_job_id)]
    }

    // The files, checked and read before anything is written: a send that cannot carry them stops here.
    const job = tie ? ({ [tie.column]: tie.jobId } as { bid_id: string } | { project_id: string } | { jobs_ledger_id: string }) : null
    const read = await readFiles(admin, asks, job)
    if (!read.ok) return refuse(read.error, read.words, read.status)

    const { data: line, error: lineError } = await admin
      .from('messages')
      .insert({
        contact_id: input.contactId,
        channel_id: channel.id,
        channel: 'email',
        direction: 'out',
        who_user_id: who.id,
        subject: input.subject,
        body: input.body,
        ...(tie ? { [tie.column]: tie.jobId } : {}),
      })
      .select('id')
      .single()
    if (lineError || !line) {
      console.error('[messages-email] line', lineError?.message)
      return refuse('failed', 'The email did not go: the thread could not keep it. Try again.', 500)
    }

    const origin = Deno.env.get('APP_ORIGIN')?.trim() || 'https://clicktooling.com'
    const placing = await placeFiles(read.ctx, read.files, {
      lineId: line.id,
      madeBy: who.id,
      origin,
      recipient: {
        kind: String(contact.kind ?? ''),
        customerId: contact.customer_id ?? null,
        customerPersonId: contact.customer_contact_person_id ?? null,
        companyId: contact.gc_company_id ?? null,
        companyPersonId: contact.gc_company_person_id ?? null,
      },
    })
    if (!placing.ok) {
      await takeBack(admin, placing.placed)
      await admin.from('messages').delete().eq('id', line.id)
      return refuse(placing.error, placing.words, placing.status)
    }
    const placed = placing.placed

    const letterhead = letterheadFor(tie?.column ?? null)
    const built = buildMessagesEmail(input, letterhead, emailLinkLines(placed.links))
    const replyTo = typeof who.email === 'string' && who.email.includes('@') ? who.email : undefined
    // The sent copy (docs/SENT_COPIES.md): its source is the line, so the thread's overlay of sent copies skips it.
    const filed = {
      title: built.subject,
      recipientName: (contact.name ?? '').trim() || to,
      customerId: contact.customer_id ?? undefined,
      bidId: tie?.column === 'bid_id' ? tie.jobId : undefined,
      jobIds,
      source: { table: 'messages', id: line.id },
      sentBy: who.id,
    }
    const sent = await sendEmailViaResend(to, built.subject, built.text, built.html, resendKey, {
      from: mailboxWithName(letterhead, EMAIL_FROM),
      replyTo,
      ...(placed.attachments.length ? { attachments: placed.attachments } : {}),
      emailType: MESSAGES_EMAIL_KIND,
      file: { kind: 'messages_email', ...filed },
    }).catch((e: unknown) => ({ success: false as const, error: e instanceof Error ? e.message : String(e) }))

    if (!sent.success) {
      // Nothing went, so nothing stays in the thread: the line, its files' rows, our links and the copies.
      await takeBack(admin, placed)
      await admin.from('messages').delete().eq('id', line.id)
      return refuse('resend', `The email did not go. ${sent.error ? `Resend answered: ${sent.error}` : 'Try again.'}`, 502)
    }
    return json({ ok: true, messageId: line.id })
  } catch (e) {
    console.error('[messages-email]', e instanceof Error ? e.message : String(e))
    return refuse('failed', 'The email did not go. Try again.', 500)
  }
})
