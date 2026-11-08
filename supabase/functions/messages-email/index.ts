import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { mailboxWithName } from '../_shared/mailboxWithName.ts'
import { buildPlainMessagesEmail, letterheadFor, MESSAGES_EMAIL_KIND, parseMessagesEmailBody } from '../_shared/messagesEmail.ts'
import { emailLinkLines, parseEmailFiles } from '../_shared/messagesEmailFiles.ts'
// The box their answer comes back to (R6), straight from the copy, not its index.
import { BOXES_SETTINGS_KEY, boxForReply, mailboxFor, NO_BOX_FALLBACK, parseBoxSettings, type Mailbox } from '../_shared/gcKernels/lib/messages/boxes.ts'
import { KIT_DOOR_WORDS, isFixtureAccount, isWalkTester, kitDoorVerdict } from '../_shared/gcKernels/lib/walk/kitDoor.ts'
import { loadWalkKit } from '../_shared/walkKit.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { placeFiles, readFiles, takeBack } from './files.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
// Through Gmail as the box (punch list #207 PR 2, v2.6702): the reader's token, the raw mail, the send, the log and the copy.
import { GMAIL_SCOPES, GmailError, gmailSend } from '../_shared/gmail.ts'
import { googleServiceToken } from '../_shared/googleToken.ts'
import { readerBoxes } from '../_shared/gcKernels/lib/emailIn/readerBoxes.ts'
import { messagesEmailMessageId, rawMailBase64Url, senderDisplayName } from '../_shared/gcKernels/lib/emailOut/rawMail.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { fileSentEmailBestEffort } from '../_shared/fileSentCopy.ts'

/**
 * messages-email — Messages, cut 3: an email from the reply box's send window, to one person at one of their
 * addresses. The caller is someone in the office (`gc_office_team()`, asked as them), a real account (never a sample
 * or a digital twin), and never a training account, but for the walk kit's tester (punch list #142 PR 5, `kitDoor.ts`):
 * a training account let through only at the kit's own address on the kit's contact, with no files. The body is `parseMessagesEmailBody`'s (`_shared/messagesEmail.ts`):
 * the contact, the address (one of their `contact_channels`), the job it is tied to, and the words the app put
 * together with `compose.emailDraft`.
 *
 * In order: the line is written in `messages` as the service role (channel email, direction out, the job and the
 * address), so the email has an id before it goes; the email is a plain email (`buildPlainMessagesEmail`, v2.6038, punch
 * list #207 PR 1: the words as typed with the greeting the box pre-typed, the signature from the sender's account,
 * nothing of ours after it; no letterhead bar, no card, no footer). Since v2.6702 (punch list #207 PR 2, the owner's
 * calls 5 and 6 of 2026-11-08) it goes **through Gmail as the box** their answer comes back to (R6, v2.5496: the box
 * they last wrote to, else their kind's, Settings' address in `messages_boxes_v1`) whenever that box is one the bids@
 * reader reads (`readerBoxes`: bids@ by the secret or Settings, the team box by Settings), under the reader's own token
 * (`GOOGLE_SERVICE_ACCOUNT_JSON`, `gmail.modify`), as the raw mail `rawMail.ts` builds with the display name *Wendi
 * Doll · Click Construction* and the files attached: so the mail sits in that box's Sent, the From reads a person and
 * the company instead of team@noreply, and no Reply-To is needed. The line keeps the mail's own Message-ID
 * (`rfc_message_id`), its Gmail id and its conversation, so the box's own read of its Sent, or a copy it gets back,
 * writes no second line (v2.5504's fence, `email_write_line`'s `ON CONFLICT (gmail_id)`). The function writes the
 * `email_send_log` row and files the sent copy itself, as Resend's helper did. When no reader box answers the thread,
 * when the Google secret is missing, or when Google refuses the token or the send, the email goes through **Resend as
 * before**, from the company's name on `EMAIL_FROM`'s address with the box as its Reply-To (the sender's own address
 * with no box), and the refusal is logged; the line carries the box either way. Its sent copy is filed with the line
 * as its source, so the thread's overlay of sent copies skips it. If nothing sends, the line is taken back out and the
 * refusal is said. The answer is the line's id, which a later press can name (cut 2's *this message gets it done*).
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
    const archivedRefusal = await refuseArchivedCaller(admin, u?.user?.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal
    if (!u?.user) return refuse('signIn', 'Sign in to send an email.', 401)
    const { data: who } = await admin
      .from('users')
      .select('id, name, email, read_only, is_sample, is_digital_twin, is_walk_tester')
      .eq('id', u.user.id)
      .maybeSingle()
    if (!who || isFixtureAccount(who)) return refuse('readOnly', 'This account cannot send emails.', 403)
    const tester = isWalkTester(who)
    if (!tester && who.read_only) return refuse('readOnly', 'This account cannot send emails.', 403)
    const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null
    // The walk tester's only way past training mode: the kit exists, the target is its address, and no file goes.
    if (tester) {
      const ask = parseMessagesEmailBody(raw)
      const verdict = kitDoorVerdict(who, await loadWalkKit(admin), ask ? { kind: 'channel', contactId: ask.contactId, channelId: ask.channelId } : null)
      if (!verdict.ok) return refuse(verdict.refused, verdict.words, 403)
      if (Array.isArray(raw?.files) && raw.files.length > 0) return refuse('walkTesterOnly', 'The walk tester sends no files.', 403)
    }
    const { data: office, error: officeError } = await caller.rpc('gc_office_team')
    if (officeError || office !== true) return refuse('officeOnly', 'Only the office sends from here.', 403)

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

    // The box their answer comes back to (R6): the one they last wrote to, else their kind's (boxForReply), at Settings'
    // address alone, as the reply box names it (replyCompany). With none, the answer goes to the sender as before.
    const [{ data: boxesRow }, { data: lastIn }] = await Promise.all([
      admin.from('app_settings').select('value_text').eq('key', BOXES_SETTINGS_KEY).maybeSingle(),
      admin
        .from('messages')
        .select('mailbox')
        .eq('contact_id', input.contactId)
        .eq('direction', 'in')
        .not('mailbox', 'is', null)
        .order('at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    const wroteTo: Mailbox | null = lastIn?.mailbox === 'team' || lastIn?.mailbox === 'bids' ? lastIn.mailbox : null
    const kind = String(contact.kind ?? '')
    const boxAddress = mailboxFor(kind, parseBoxSettings(boxesRow?.value_text), NO_BOX_FALLBACK, wroteTo)
    const box = boxForReply(wroteTo, { kind })

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
        ...(boxAddress ? { mailbox: box } : {}),
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

    // The company's name on the From alone since v2.6038; the signature's company line is the app's, built with the words.
    const letterhead = letterheadFor(tie?.column ?? null)
    const built = buildPlainMessagesEmail(input, emailLinkLines(placed.links))
    const replyTo = boxAddress || (typeof who.email === 'string' && who.email.includes('@') ? who.email : undefined)
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

    // Through Gmail as the box (v2.6702): when the box their answer comes back to is one the reader reads, the mail goes
    // from that box under the reader's token, named for the person and the company, and sits in the box's Sent. The line
    // keeps the mail's Message-ID and Gmail ids first, so the box's read of its own Sent lands nothing twice.
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const asBox = boxAddress && saJson ? readerBoxes(parseBoxSettings(boxesRow?.value_text), Deno.env.get('GMAIL_IMPERSONATE_USER')).find((b) => b.address.trim().toLowerCase() === boxAddress.trim().toLowerCase()) ?? null : null
    if (asBox && saJson) {
      const from = mailboxWithName(senderDisplayName(String(who.name ?? ''), letterhead), asBox.address)
      const messageId = messagesEmailMessageId(line.id, asBox.address)
      const raw = rawMailBase64Url({ from, to, subject: built.subject, text: built.text, html: built.html, messageId, at: new Date().toISOString(), files: placed.attachments })
      try {
        const token = await googleServiceToken(saJson, GMAIL_SCOPES, asBox.address)
        const went = await gmailSend(token, raw)
        const kept = await admin.from('messages').update({ rfc_message_id: messageId, gmail_id: went.id, gmail_thread_id: went.threadId ?? null }).eq('id', line.id)
        if (kept.error) console.warn('[messages-email] the sent mail’s ids were not kept on the line', line.id, kept.error.message)
        await logEmailSendBestEffort({ resendEmailId: null, to: [to], from, subject: built.subject, emailType: MESSAGES_EMAIL_KIND })
        await fileSentEmailBestEffort({ kind: 'messages_email', ...filed }, { to: [to], from, subject: built.subject, html: built.html, attachments: placed.attachments, resendEmailId: null })
        return json({ ok: true, messageId: line.id, sentAs: asBox.address })
      } catch (e) {
        // Google said no (a token Google will not mint, a send it refused): Resend takes the email as before, logged.
        const why = e instanceof GmailError ? `Gmail ${e.status}: ${e.message}` : e instanceof Error ? e.message : String(e)
        console.warn('[messages-email] Gmail as the box did not take it; Resend sends it', asBox.mailbox, why.slice(0, 300))
      }
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
