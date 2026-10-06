/**
 * The collections law firm's emails and the two plain pages behind their links, as one set of
 * builders for the senders and the browser (v2.3512 — What customers see PR 6).
 * `legal-notify-dispatch` (now, digest, the confirm / unsubscribe pages) and
 * `submit-legal-portal` (the confirm email) call these; `src/lib/legalEmails.ts` re-exports
 * them so Settings → What customers see renders the same emails over the sample. Pure: the
 * wording is the senders' own, moved here verbatim; the company name is passed in.
 */
import { todayYmdInAppTz } from './appTimeZone.ts'
import { LEGAL_STAGE_LIST } from './legalStages.ts'

type LegalStageKey = (typeof LEGAL_STAGE_LIST)[number]

export function legalEsc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export type LegalEmail = { subject: string; text: string; html: string }

/**
 * A matter's stage in the firm's words (punch list #85, item 3): the portal's chip, the digest
 * email and the firm's print packet read this one map. The office keeps its own labels
 * (`legalStageLabel` in `src/lib/legal/legalMatters.ts`, *With the firm · new*) for the desk.
 */
/** The one string for a pulled-back matter, in the email's subject, the digest's events and the stage word. */
export const LEGAL_REFERRAL_WITHDRAWN = 'Referral withdrawn'

/** Keyed to `LEGAL_STAGE_LIST` (#85 item 16): a stage added there and not worded here fails the typecheck. */
export const LEGAL_FIRM_STAGE_WORDS: Record<LegalStageKey, string> = {
  review: 'under review by the office',
  referred: 'referred',
  demand: 'demand sent',
  suit: 'suit filed',
  judgment: 'judgment entered',
  post_judgment: 'after judgment',
  payment_plan: 'payment plan',
  settled: 'settled',
  uncollectible: 'uncollectible',
  dismissed: 'dismissed',
  written_down: 'written down by the office',
  pulled: LEGAL_REFERRAL_WITHDRAWN.toLowerCase(),
}

export function legalFirmStageWords(stage: string | null | undefined): string {
  return (LEGAL_FIRM_STAGE_WORDS as Record<string, string>)[stage ?? ''] ?? LEGAL_FIRM_STAGE_WORDS.review
}

/** The two choices of a person's email rule, as the portal's Notifications control reads them; the welcome email names them in the same words. */
export const FIRM_EMAIL_MODE_WORDS = { now: 'Each event', digest: 'Weekly digest' } as const

/** The frame every firm email sits in: the company line on top, the stop-these link at the foot. */
export function legalWrapHtml(companyName: string, bodyHtml: string, unsubscribeUrl: string): string {
  return `<div style="font:15px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;color:#16283c;max-width:600px"><div style="border-bottom:2px solid #b0662f;padding-bottom:8px;margin-bottom:14px"><b>${legalEsc(companyName)}</b><br><span style="color:#5a6b7e;font-size:13px">Collections referred to counsel</span></div>${bodyHtml}<p style="color:#8a97a6;font-size:12px;margin-top:22px">You get this because you are on the firm's email list on ${legalEsc(companyName)}'s legal portal.${unsubscribeUrl ? ` <a href="${unsubscribeUrl}" style="color:#8a97a6">Stop these emails to you</a>.` : ' To stop them, reply to this email.'}</p></div>`
}

const PORTAL_BUTTON = (portalUrl: string) => `<p><a href="${portalUrl}" style="display:inline-block;background:#b0662f;color:#fff;padding:8px 14px;border-radius:5px;text-decoration:none">Open the portal</a></p>`

/** `submit-legal-portal` → the one email a new recipient must answer before anything else is sent. */
export function buildLegalConfirmEmail(i: { companyName: string; email: string; confirmUrl: string }): LegalEmail {
  const subject = `Confirm your email for ${i.companyName}'s legal portal`
  const html = `<div style="font:15px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;color:#16283c;max-width:600px"><p>Someone at your firm added <b>${legalEsc(i.email)}</b> to hear from ${legalEsc(i.companyName)} about accounts referred to counsel.</p><p><a href="${i.confirmUrl}" style="display:inline-block;background:#b0662f;color:#fff;padding:8px 14px;border-radius:5px;text-decoration:none">Yes, email me</a></p><p style="color:#8a97a6;font-size:12px">Nothing else is sent to this address unless you click. If this wasn't you, ignore this email.</p></div>`
  return { subject, text: `${subject}\n\n${i.confirmUrl}`, html }
}

/**
 * The events that reach the firm (`legal_notification_queue.trigger`). Since #85 item 17 every office event
 * emails the firm, not three: an ask, a note, a payment applied, and — digest only — a fee or cost the office
 * saw (a paralegal entering six costs should not get six emails back).
 */
export const LEGAL_NOW_TRIGGERS = ['referred', 'answer', 'pulled', 'ask', 'note', 'applied', 'fee_seen'] as const
export type LegalNowTrigger = (typeof LEGAL_NOW_TRIGGERS)[number]

/** A queue row's trigger, or null for one this build does not know (it is skipped, never mislabeled). */
export function legalNowTriggerOf(raw: unknown): LegalNowTrigger | null {
  return typeof raw === 'string' && (LEGAL_NOW_TRIGGERS as readonly string[]).includes(raw) ? (raw as LegalNowTrigger) : null
}

/** False for the events that ride the digest only (`fee_seen`). */
export function legalTriggerSendsNow(t: LegalNowTrigger): boolean {
  return t !== 'fee_seen'
}

function money(n: unknown): string {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
}

/** `legal-notify-dispatch` → one email per event for recipients on "now". */
export function buildLegalNowEmail(i: {
  companyName: string
  firmName: string
  trigger: LegalNowTrigger
  payer: string
  handling?: string | null
  note?: string | null
  /** The office's words: its answer, its ask, its note, or the applied payment's line. */
  body?: string | null
  /** The firm's question an `answer` answers (#85 item 17). */
  question?: string | null
  /** An `ask`'s flavor: a sign-off on one job, or a question (#85 item 17). */
  flavor?: string | null
  jobLabel?: string | null
  /** The amount on an `applied` or `fee_seen` event. */
  amount?: number | null
  /** The office's reason, on a `pulled` event (#85 item 16). */
  reason?: string | null
  portalUrl: string
  unsubscribeUrl: string
}): LegalEmail {
  const payer = i.payer || 'an account'
  const p = `<b>${legalEsc(payer)}</b>`
  const said = i.body ? `<br><i>${legalEsc(i.body)}</i>` : ''
  let subject: string
  let line: string
  switch (i.trigger) {
    case 'referred':
      subject = `New account referred: ${payer}`
      line = `${legalEsc(i.companyName)} has referred ${p} to ${legalEsc(i.firmName)}${i.handling ? ` — handling: ${legalEsc(i.handling)}` : ''}.${i.note ? `<br><i>“${legalEsc(i.note)}”</i>` : ''}`
      break
    case 'answer':
      subject = `${i.companyName} answered on ${payer}`
      line = i.question ? `The office answered your question on ${p}.<br>You asked: <i>${legalEsc(i.question)}</i><br>The office: <i>${legalEsc(i.body)}</i>` : `The office answered your question on ${p}:${said}`
      break
    case 'ask':
      subject = i.flavor === 'signoff' ? `${i.companyName} asks your sign-off on ${payer}` : `${i.companyName} asks you about ${payer}`
      line = `The office asks on ${p}${i.flavor === 'signoff' ? ` for your sign-off${i.jobLabel ? ` on job ${legalEsc(i.jobLabel)}` : ''}` : ''}:${said}<br>Answer it on the matter's Fees &amp; steps tab.`
      break
    case 'note':
      subject = `A note from ${i.companyName} on ${payer}`
      line = `The office added a note on ${p}:${said}`
      break
    case 'applied':
      subject = `Payment applied on ${payer}`
      line = `The office applied ${i.amount != null ? `<b>${money(i.amount)}</b>` : 'the payment'} you received on ${p} to the job, and recorded your share.`
      break
    case 'fee_seen':
      subject = `${i.companyName} saw your fee on ${payer}`
      line = `The office saw ${i.amount != null ? `<b>${money(i.amount)}</b>` : 'your fee'} on ${p}.${said}`
      break
    default:
      subject = `${LEGAL_REFERRAL_WITHDRAWN}: ${payer}`
      line = `${legalEsc(i.companyName)} has withdrawn the referral of ${p}.${i.reason ? `<br>Why: <i>${legalEsc(i.reason)}</i>` : ''}<br>Your fees and costs and the conversation stay readable on the portal; the account's records do not.`
  }
  const html = legalWrapHtml(i.companyName, `<p>${line}</p>${PORTAL_BUTTON(i.portalUrl)}`, i.unsubscribeUrl)
  return { subject, text: `${subject}\n\n${i.portalUrl}`, html }
}

/** `releasedAt` and `createdAt` are instants (`legal_matters.released_at`, `legal_notification_queue.created_at`); the digest prints their day in the company's zone. */
export type LegalDigestMatter = { payerName: string; stage: string; handlingName?: string | null; releasedAt?: string | null }
export type LegalDigestEvent = { createdAt: string; trigger: LegalNowTrigger; payer: string; body?: string | null; reason?: string | null; amount?: number | null }

const DIGEST_LABEL: Record<LegalNowTrigger, string> = {
  referred: 'New account referred',
  answer: 'Office answered',
  pulled: LEGAL_REFERRAL_WITHDRAWN,
  ask: 'The office asks',
  note: 'Note from the office',
  applied: 'Payment applied',
  fee_seen: 'Fee seen by the office',
}

/** `legal-notify-dispatch` → the once-a-day digest for recipients on "digest". */
export function buildLegalDigestEmail(i: { companyName: string; recipientName: string; matters: LegalDigestMatter[]; events: LegalDigestEvent[]; portalUrl: string; unsubscribeUrl: string }): LegalEmail {
  const matterLines = i.matters.length
    ? i.matters.map((m) => `<li><b>${legalEsc(m.payerName)}</b> — ${legalEsc(legalFirmStageWords(m.stage))}${m.handlingName ? ` · handling ${legalEsc(m.handlingName)}` : ''}${m.releasedAt ? ` · since ${legalEsc(todayYmdInAppTz(new Date(m.releasedAt)))}` : ''}</li>`).join('')
    : '<li>No open matters.</li>'
  const detail = (e: LegalDigestEvent): string => {
    if (e.trigger === 'pulled') return e.reason ? ` — ${legalEsc(e.reason)}` : ''
    const amt = (e.trigger === 'applied' || e.trigger === 'fee_seen') && e.amount != null ? ` ${money(e.amount)}` : ''
    return `${amt}${e.body && e.trigger !== 'referred' ? ` — ${legalEsc(e.body)}` : ''}`
  }
  const eventLines = i.events.length
    ? i.events.map((e) => `<li>${legalEsc(todayYmdInAppTz(new Date(e.createdAt)))} · ${DIGEST_LABEL[e.trigger] ?? 'Update'}: <b>${legalEsc(e.payer)}</b>${detail(e)}</li>`).join('')
    : '<li>Nothing new since your last digest.</li>'
  const subject = `Weekly digest — ${i.matters.length} open matter${i.matters.length === 1 ? '' : 's'} at ${i.companyName}`
  const html = legalWrapHtml(i.companyName, `<p>Your weekly digest, ${legalEsc(i.recipientName)}.</p><h3 style="font-size:14px;margin:12px 0 4px">Open matters</h3><ul>${matterLines}</ul><h3 style="font-size:14px;margin:12px 0 4px">Since your last digest</h3><ul>${eventLines}</ul>${PORTAL_BUTTON(i.portalUrl)}`, i.unsubscribeUrl)
  return { subject, text: `${subject}\n\n${i.portalUrl}`, html }
}

/** The plain page frame the confirm / unsubscribe links land on. */
export function legalPageHtml(companyName: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${legalEsc(companyName)}</title><style>body{font:16px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;color:#16283c;background:#f6f3ec;margin:0;padding:40px 20px}main{max-width:520px;margin:0 auto;background:#fdfcf9;border:1px solid #ddd6c8;border-radius:8px;padding:24px}h1{font-size:20px;margin:0 0 8px}p{margin:8px 0;color:#5a6b7e}</style></head><body><main>${body}</main></body></html>`
}

/** The confirm page's words when its link no longer matches (v2.4624): the function answers them, and the page falls back to them. */
export const LEGAL_CONFIRM_EXPIRED_REASON = 'A newer confirmation email replaced it, or you were taken off the list. Ask whoever added you to press Resend the confirmation next to your name. It is on the portal’s Notifications tab.'

export function legalConfirmedPageBody(companyName: string, name: string, email: string): string {
  return `<h1>You're confirmed, ${legalEsc(name)}.</h1><p>${legalEsc(email)} will now get the firm's emails from ${legalEsc(companyName)} — one email per event or a weekly digest, whichever the portal says. Every email carries a link to stop them.</p>`
}

export function legalUnsubscribedPageBody(companyName: string, name: string): string {
  return `<h1>Done, ${legalEsc(name)}.</h1><p>No more emails to you from ${legalEsc(companyName)}'s legal portal. The portal itself still works; turn emails back on from its Notifications page.</p>`
}

/** Who pressed send on the desk: the welcome email is signed by them, and a reply reaches them. */
export type LegalWelcomeSender = { name: string; email: string; phone: string }

/**
 * `legal-send-firm-link` → the welcome email the office sends the firm from the desk's link card
 * (v2.4624, punch list #85 item 21): who we are, what the portal is, the link, what to do first
 * (add the people at the firm who should get our emails), and who to call. Sent by a person, once,
 * so it carries no stop link; it is filed under the link it carries (`sent_documents`).
 */
export function buildLegalWelcomeEmail(i: {
  companyName: string
  companyPhone?: string | null
  firmName: string
  /** The firm's handling person on file, for the greeting; the firm's name when blank. */
  greetName?: string | null
  portalUrl: string
  /** Accounts already with the firm; zero says they arrive as the office refers them. */
  matterCount: number
  /** A line the office typed on the card, printed as its own paragraph. */
  note?: string | null
  sender?: LegalWelcomeSender | null
}): LegalEmail & { replyTo: string | null } {
  const greet = (i.greetName ?? '').trim() || i.firmName
  const senderName = (i.sender?.name ?? '').trim()
  const senderEmail = (i.sender?.email ?? '').trim()
  const senderPhone = (i.sender?.phone ?? '').trim()
  const phone = (i.companyPhone ?? '').trim()
  const note = (i.note ?? '').trim()
  const n = Math.max(0, Math.floor(i.matterCount))
  const subject = `Your collections portal from ${i.companyName}`
  const intro = senderName ? `This is ${senderName} at ${i.companyName}.` : `This is the office at ${i.companyName}.`
  const why = `We send unpaid accounts to ${i.firmName} through a private web page, and this email carries your link to it.`
  const waiting = n === 0 ? 'No accounts are on it yet. Each one appears the day we refer it to you.' : n === 1 ? 'One account is waiting for you there now.' : `${n} accounts are waiting for you there now.`
  const steps = [
    'Open the portal and choose Notifications.',
    'Add each person at the firm who should hear from us. Each gets one email to confirm their address.',
    `Each person sets Emails to ${FIRM_EMAIL_MODE_WORDS.now} or ${FIRM_EMAIL_MODE_WORDS.digest}, and picks every account or only their own.`,
  ]
  const finds = [
    'Every account we refer to you, as one packet: the account, the paper, the record of contact, the field evidence, and the fees and steps.',
    `${i.companyName}’s particulars for filing.`,
    'A place to record your fees, costs and steps, a payment you receive, and a question for us.',
  ]
  const keep = 'The link needs no sign-in. Keep it inside the firm, because anyone holding it can open the portal. If it ever leaks, tell us and we will replace it.'
  const ask = phone ? `Questions: reply to this email, or call us at ${phone}.` : 'Questions: reply to this email.'
  const sig = [senderName, i.companyName, senderPhone, senderEmail].filter(Boolean)
  const footer = `You get this because ${i.companyName} sent ${i.firmName} its portal link. Nothing else is emailed to this address unless someone at the firm adds it on the portal.`

  const p = (s: string) => `<p style="margin:0 0 12px">${s}</p>`
  const html =
    `<div style="font:15px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;color:#16283c;max-width:600px">` +
    `<div style="border-bottom:2px solid #b0662f;padding-bottom:8px;margin-bottom:14px"><b>${legalEsc(i.companyName)}</b><br><span style="color:#5a6b7e;font-size:13px">Collections referred to counsel</span></div>` +
    p(`Hello ${legalEsc(greet)},`) +
    p(`${legalEsc(intro)} ${legalEsc(why)}`) +
    (note ? `<p style="margin:0 0 12px;padding:8px 12px;background:#f1ece2;border-radius:5px">${legalEsc(note).replace(/\n/g, '<br>')}</p>` : '') +
    PORTAL_BUTTON(i.portalUrl) +
    `<p style="margin:0 0 14px;font-size:12px;color:#5a6b7e;word-break:break-all">${legalEsc(i.portalUrl)}</p>` +
    p(legalEsc(waiting)) +
    `<h3 style="font-size:14px;margin:16px 0 4px">What to do first</h3><ol style="margin:0 0 12px;padding-left:20px">${steps.map((s) => `<li>${legalEsc(s)}</li>`).join('')}</ol>` +
    `<h3 style="font-size:14px;margin:16px 0 4px">What you will find there</h3><ul style="margin:0 0 12px;padding-left:20px">${finds.map((s) => `<li>${legalEsc(s)}</li>`).join('')}</ul>` +
    p(legalEsc(keep)) +
    p(legalEsc(ask)) +
    (sig.length ? `<p style="margin:16px 0 0;color:#5a6b7e">${sig.map(legalEsc).join('<br>')}</p>` : '') +
    `<p style="color:#8a97a6;font-size:12px;margin-top:22px">${legalEsc(footer)}</p>` +
    `</div>`

  const text = [
    `Hello ${greet},`,
    '',
    `${intro} ${why}`,
    ...(note ? ['', note] : []),
    '',
    `Your portal: ${i.portalUrl}`,
    '',
    waiting,
    '',
    'What to do first',
    ...steps.map((s, k) => `${k + 1}. ${s}`),
    '',
    'What you will find there',
    ...finds.map((s) => `- ${s}`),
    '',
    keep,
    '',
    ask,
    ...(sig.length ? ['', ...sig] : []),
    '',
    footer,
  ].join('\n')

  return { subject, text, html, replyTo: senderEmail || null }
}
