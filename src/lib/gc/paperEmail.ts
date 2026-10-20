/**
 * GC mode, the real build, the Board's B6-b-ii: the email each send from a company's Documents tab writes, in the
 * company's language, without the greeting the sender adds. The words are the prototype's (`paperSendMessages`, spike
 * `gcPaperSend.ts`) and the portal's own (`portalI18n.ts`), with one change the lead called on 2026-10-09: the portal
 * cannot take a certificate yet, so an insurance ask says to reply to the email with it, and the office files it with
 * Record their insurance. The new words are on PORTAL_SPANISH's list for its reader.
 *
 * A master agreement or a W-9 goes to sign through `send-contract-for-signature`'s company branch, so the email's step
 * is the signing link (`actionLabel`), not the portal. Every other paper goes through `gc-trade-email`. Each send's key
 * is `<gc_paper_sends id>:<paper>`, so a reminder is its own send. Pure: the presses are `papersIo.ts`'s.
 */
import { GC_COMPANY } from './company'
import type { PaperStep } from './paperSend'
import { pt, pWeekday, type PortalLang } from './portalI18n'
import { sowEmailRequest, SOW_SIGN_SCREEN_LIVE } from './sowEmail'
import type { GcState, Partner } from './types'

const REMINDER: Record<PortalLang, string> = { en: 'Reminder: ', es: 'Recordatorio: ' }

/** The prototype's words (spike `gcPaperSend.ts`), and the insurance ask's reply line (new, 2026-10-09). */
export const PAPER_EMAIL_WORDS = {
  msaSignBy: { en: 'Please sign it by {date}.', es: 'Por favor fírmelo a más tardar el {date}.' },
  sowSignBy: { en: 'Please sign it by {date}.', es: 'Por favor fírmela a más tardar el {date}.' },
  msaStill: { en: 'Our master agreement is still waiting for your signature. Please sign it by {date}.', es: 'Nuestro contrato maestro todavía espera su firma. Por favor fírmelo a más tardar el {date}.' },
  sowStill: { en: 'Your statement of work for {trade} on {project} is still waiting for your signature. Please sign it by {date}.', es: 'Su orden de trabajo de {trade} para {project} todavía espera su firma. Por favor fírmela a más tardar el {date}.' },
  coiSubject: { en: 'Your insurance certificate for {gc}', es: 'Su certificado de seguro para {gc}' },
  coiRenew: { en: 'Please send us your renewed insurance certificate by {date}.', es: 'Por favor envíenos su certificado de seguro renovado a más tardar el {date}.' },
  coiNone: { en: 'Please send us your insurance certificate by {date}. Nothing you do for us is covered until it comes.', es: 'Por favor envíenos su certificado de seguro a más tardar el {date}. Nada de lo que haga para nosotros está cubierto hasta que llegue.' },
  coiReply: { en: 'Reply to this email with the certificate.', es: 'Responda a este correo con el certificado.' },
  // P5b-2: the portal takes a certificate now, once the email carries the company's portal link.
  coiPortal: { en: 'Send it from your portal with the link below. Or reply to this email with it.', es: 'Envíelo desde su portal con el enlace de abajo. O responda a este correo con él.' },
  w9Subject: { en: 'Your W-9 for {gc}', es: 'Su W-9 para {gc}' },
  w9Ask: { en: 'Please fill in and sign your W-9 by {date}. We need it before we can pay you.', es: 'Por favor llene y firme su W-9 a más tardar el {date}. Lo necesitamos antes de poder pagarle.' },
} as const satisfies Record<string, Record<PortalLang, string>>

function w(lang: PortalLang, key: keyof typeof PAPER_EMAIL_WORDS, vars: Record<string, string> = {}): string {
  let out: string = PAPER_EMAIL_WORDS[key][lang]
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v)
  return out
}

/**
 * A trade may send its insurance certificate from its portal (P5b-2), received until the office marks it good. True:
 * the insurance ask says so when its email carries the portal link, as `DRAW_PORTAL_LIVE` turned with its screens.
 */
export const COI_PORTAL_LIVE = true

/**
 * The insurance ask's last line: send it from the portal, or reply. The portal's words only when the email carries the
 * company's portal link (gc 2); `gc-trade-email` always does, minting one when the company has none, or it sends nothing.
 */
export function coiAskLine(lang: PortalLang, carriesPortalLink: boolean): string {
  return w(lang, COI_PORTAL_LIVE && carriesPortalLink ? 'coiPortal' : 'coiReply')
}

/** One send's email: through the signing link (a master agreement, a W-9) or through `gc-trade-email`. */
export type PaperEmail =
  | { how: 'sign'; subject: string; lines: string[]; actionLabel: string }
  | { how: 'email'; kind: 'coi' | 'sow'; projectId: string | null; subject: string; lines: string[] }

/** The key a send's email goes by: `<gc_paper_sends id>:<paper>`, B6-b-i's rule, so a reminder is its own send. */
export const paperSendKey = (sendId: string, paper: PaperStep['paper']): string => `${sendId}:${paper}`

/**
 * The email for one send of a paper, as the company gets it. Null when the send writes no email:
 * - a statement of work while its sign screen is not live (`SOW_SIGN_SCREEN_LIVE`);
 * - a lien waiver, which the trade cannot sign anywhere yet (it waits for the draws and the Portal's P5c).
 */
export function paperEmail(state: GcState, partner: Partner, step: PaperStep, by: string, note: string, lang: PortalLang): PaperEmail | null {
  const date = pWeekday(lang, by)
  const gc = GC_COMPANY.name
  const own = note.trim() ? [note.trim()] : []
  const again = step.mode === 'reminder'
  if (step.paper === 'msa') {
    return {
      how: 'sign',
      subject: (again ? REMINDER[lang] : '') + pt(lang, 'mMsaSubject', { gc }),
      lines: again ? [w(lang, 'msaStill', { date }), ...own, pt(lang, 'mMsaHere')] : [pt(lang, 'mMsaHere'), pt(lang, 'mMsaAfter'), w(lang, 'msaSignBy', { date }), ...own],
      actionLabel: pt(lang, 'readSign'),
    }
  }
  if (step.paper === 'w9') {
    return { how: 'sign', subject: (again ? REMINDER[lang] : '') + w(lang, 'w9Subject', { gc }), lines: [w(lang, 'w9Ask', { date }), ...own], actionLabel: pt(lang, 'readSign') }
  }
  if (step.paper === 'insurance') {
    return {
      how: 'email',
      kind: 'coi',
      projectId: null,
      subject: (again ? REMINDER[lang] : '') + w(lang, 'coiSubject', { gc }),
      // gc-trade-email carries the company's portal link on every email (it mints one when there is none).
      lines: [w(lang, partner.coiExpires ? 'coiRenew' : 'coiNone', { date }), ...own, coiAskLine(lang, true)],
    }
  }
  if (step.paper === 'sow' && step.projectId && step.packageId && SOW_SIGN_SCREEN_LIVE) {
    const project = state.projects.find((p) => p.id === step.projectId)
    const pkg = project?.packages.find((k) => k.id === step.packageId)
    if (!project || !pkg) return null
    if (again) {
      return {
        how: 'email',
        kind: 'sow',
        projectId: project.id,
        subject: REMINDER[lang] + pt(lang, 'mSowSubject', { trade: pkg.trade, project: project.name }),
        lines: [w(lang, 'sowStill', { trade: pkg.trade, project: project.name, date }), ...own, pt(lang, 'mSowOpen')],
      }
    }
    // The first send is the trade card's own email (B6-a-ii), with its day and the office's line before the step.
    const sow = sowEmailRequest(state, project.id, pkg.id, '', lang)
    if (!sow) return null
    const lines = sow.lines.filter((l): l is string => typeof l === 'string')
    return { how: 'email', kind: 'sow', projectId: project.id, subject: sow.subject, lines: [...lines.slice(0, -1), w(lang, 'sowSignBy', { date }), ...own, ...lines.slice(-1)] }
  }
  return null
}
