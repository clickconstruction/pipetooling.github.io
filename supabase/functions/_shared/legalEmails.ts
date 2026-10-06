/**
 * The collections law firm's emails and the two plain pages behind their links, as one set of
 * builders for the senders and the browser (v2.3512 — What customers see PR 6).
 * `legal-notify-dispatch` (now, digest, the confirm / unsubscribe pages) and
 * `submit-legal-portal` (the confirm email) call these; `src/lib/legalEmails.ts` re-exports
 * them so Settings → What customers see renders the same emails over the sample. Pure: the
 * wording is the senders' own, moved here verbatim; the company name is passed in.
 */
import { todayYmdInAppTz } from './appTimeZone.ts'

export function legalEsc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export type LegalEmail = { subject: string; text: string; html: string }

/**
 * A matter's stage in the firm's words (punch list #85, item 3): the portal's chip, the digest
 * email and the firm's print packet read this one map. The office keeps its own labels
 * (`legalStageLabel` in `src/lib/legal/legalMatters.ts`, *With the firm · new*) for the desk.
 */
export function legalFirmStageWords(stage: string | null | undefined): string {
  switch (stage) {
    case 'referred': return 'referred'
    case 'demand': return 'demand sent'
    case 'suit': return 'suit filed'
    case 'judgment': return 'judgment entered'
    case 'settled': return 'settled'
    case 'post_judgment': return 'judgment being collected'
    case 'payment_plan': return 'payment plan'
    case 'uncollectible': return 'written off as uncollectible'
    case 'dismissed': return 'dismissed'
    case 'pulled': return 'referral withdrawn'
    case 'written_down': return 'written down by the office'
    default: return 'under review by the office'
  }
}

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

export type LegalNowTrigger = 'referred' | 'answer' | 'pulled'

/** `legal-notify-dispatch` → one email per event for recipients on "now". */
export function buildLegalNowEmail(i: {
  companyName: string
  firmName: string
  trigger: LegalNowTrigger
  payer: string
  handling?: string | null
  note?: string | null
  /** The office's answer, on an `answer` event. */
  body?: string | null
  portalUrl: string
  unsubscribeUrl: string
}): LegalEmail {
  const payer = i.payer || 'an account'
  const subject = i.trigger === 'referred' ? `New account referred: ${payer}` : i.trigger === 'answer' ? `${i.companyName} answered on ${payer}` : `Referral withdrawn: ${payer}`
  const line =
    i.trigger === 'referred'
      ? `${legalEsc(i.companyName)} has referred <b>${legalEsc(payer)}</b> to ${legalEsc(i.firmName)}${i.handling ? ` — handling: ${legalEsc(i.handling)}` : ''}.${i.note ? `<br><i>“${legalEsc(i.note)}”</i>` : ''}`
      : i.trigger === 'answer'
        ? `The office answered your question on <b>${legalEsc(payer)}</b>:<br><i>${legalEsc(i.body)}</i>`
        : `${legalEsc(i.companyName)} has withdrawn the referral of <b>${legalEsc(payer)}</b>. It no longer shows on the portal.`
  const html = legalWrapHtml(i.companyName, `<p>${line}</p>${PORTAL_BUTTON(i.portalUrl)}`, i.unsubscribeUrl)
  return { subject, text: `${subject}\n\n${i.portalUrl}`, html }
}

/** `releasedAt` and `createdAt` are instants (`legal_matters.released_at`, `legal_notification_queue.created_at`); the digest prints their day in the company's zone. */
export type LegalDigestMatter = { payerName: string; stage: string; handlingName?: string | null; releasedAt?: string | null }
export type LegalDigestEvent = { createdAt: string; trigger: LegalNowTrigger; payer: string; body?: string | null }

/** `legal-notify-dispatch` → the once-a-day digest for recipients on "digest". */
export function buildLegalDigestEmail(i: { companyName: string; recipientName: string; matters: LegalDigestMatter[]; events: LegalDigestEvent[]; portalUrl: string; unsubscribeUrl: string }): LegalEmail {
  const matterLines = i.matters.length
    ? i.matters.map((m) => `<li><b>${legalEsc(m.payerName)}</b> — ${legalEsc(legalFirmStageWords(m.stage))}${m.handlingName ? ` · handling ${legalEsc(m.handlingName)}` : ''}${m.releasedAt ? ` · since ${legalEsc(todayYmdInAppTz(new Date(m.releasedAt)))}` : ''}</li>`).join('')
    : '<li>No open matters.</li>'
  const eventLines = i.events.length
    ? i.events.map((e) => `<li>${legalEsc(todayYmdInAppTz(new Date(e.createdAt)))} · ${e.trigger === 'referred' ? 'New account referred' : e.trigger === 'answer' ? 'Office answered' : 'Referral withdrawn'}: <b>${legalEsc(e.payer)}</b>${e.trigger === 'answer' && e.body ? ` — ${legalEsc(e.body)}` : ''}</li>`).join('')
    : '<li>Nothing new since your last digest.</li>'
  const subject = `Weekly digest — ${i.matters.length} open matter${i.matters.length === 1 ? '' : 's'} at ${i.companyName}`
  const html = legalWrapHtml(i.companyName, `<p>Your weekly digest, ${legalEsc(i.recipientName)}.</p><h3 style="font-size:14px;margin:12px 0 4px">Open matters</h3><ul>${matterLines}</ul><h3 style="font-size:14px;margin:12px 0 4px">Since your last digest</h3><ul>${eventLines}</ul>${PORTAL_BUTTON(i.portalUrl)}`, i.unsubscribeUrl)
  return { subject, text: `${subject}\n\n${i.portalUrl}`, html }
}

/** The plain page frame the confirm / unsubscribe links land on. */
export function legalPageHtml(companyName: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${legalEsc(companyName)}</title><style>body{font:16px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;color:#16283c;background:#f6f3ec;margin:0;padding:40px 20px}main{max-width:520px;margin:0 auto;background:#fdfcf9;border:1px solid #ddd6c8;border-radius:8px;padding:24px}h1{font-size:20px;margin:0 0 8px}p{margin:8px 0;color:#5a6b7e}</style></head><body><main>${body}</main></body></html>`
}

export function legalConfirmedPageBody(companyName: string, name: string, email: string): string {
  return `<h1>You're confirmed, ${legalEsc(name)}.</h1><p>${legalEsc(email)} will now get the firm's emails from ${legalEsc(companyName)} — one email per event or a weekly digest, whichever the portal says. Every email carries a link to stop them.</p>`
}

export function legalUnsubscribedPageBody(companyName: string, name: string): string {
  return `<h1>Done, ${legalEsc(name)}.</h1><p>No more emails to you from ${legalEsc(companyName)}'s legal portal. The portal itself still works; turn emails back on from its Notifications page.</p>`
}
