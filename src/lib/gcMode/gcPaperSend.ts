/**
 * GC mode — design spike: send a paper from the company window (the owner, 2026-10-04: "make this
 * page actionable where a user could request that agreement and by clicking on something it brings
 * them into where they would send off that document"; mock-up `to-dos/gc-mode/send-a-paper-mockup.html`).
 * Each paper a trade owes us has one next step (send it to sign, remind them, ask for it), and each
 * send is an email in their language with a day it is due, which Follow up chases after.
 */
import type { GcState, Partner } from './gcTypes'
import type { PortalMessage } from './gcPortal'
import { pt, pWeekday, type PortalLang } from './gcPortalI18n'
import { GC_COMPANY } from './gcFixture'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import { paperSendsFor } from '../gc/paperSend'
export type { PaperStep } from '../gc/paperSend'
export { firstSendLines, paperDayChoices, paperSendActivity, paperSendLog, paperSendsFor, paperSentWords, paperStep } from '../gc/paperSend'

const REMINDER: Record<PortalLang, string> = { en: 'Reminder: ', es: 'Recordatorio: ' }

const W: Record<string, Record<PortalLang, string>> = {
  msaStill: { en: 'Our master agreement is still waiting for your signature. Please sign it by {date}.', es: 'Nuestro contrato maestro todavía espera su firma. Por favor fírmelo a más tardar el {date}.' },
  sowStill: { en: 'Your statement of work for {trade} on {project} is still waiting for your signature. Please sign it by {date}.', es: 'Su orden de trabajo de {trade} para {project} todavía espera su firma. Por favor fírmela a más tardar el {date}.' },
  coiSubject: { en: 'Your insurance certificate for {gc}', es: 'Su certificado de seguro para {gc}' },
  coiRenew: { en: 'Please send us your renewed insurance certificate by {date}.', es: 'Por favor envíenos su certificado de seguro renovado a más tardar el {date}.' },
  coiNone: { en: 'Please send us your insurance certificate by {date}. Nothing you do for us is covered until it comes.', es: 'Por favor envíenos su certificado de seguro a más tardar el {date}. Nada de lo que haga para nosotros está cubierto hasta que llegue.' },
  w9Subject: { en: 'Your W-9 for {gc}', es: 'Su W-9 para {gc}' },
  w9Ask: { en: 'Please fill in and sign your W-9 by {date}. We need it before we can pay you.', es: 'Por favor llene y firme su W-9 a más tardar el {date}. Lo necesitamos antes de poder pagarle.' },
  w9Open: { en: 'Open your portal to fill it in and sign it.', es: 'Abra su portal para llenarlo y firmarlo.' },
  waiverSubject: { en: 'Your lien waiver for draw {draws} on {project}', es: 'Su renuncia de gravamen del pago {draws} de {project}' },
  waiverAsk: { en: 'We paid draw {draws} on {project}. Please sign the unconditional lien waiver for it by {date}.', es: 'Pagamos el pago {draws} de {project}. Por favor firme la renuncia de gravamen incondicional a más tardar el {date}.' },
  waiverOpen: { en: 'Open your portal to sign it.', es: 'Abra su portal para firmarla.' },
}

function w(lang: PortalLang, key: string, vars: Record<string, string>): string {
  let out = W[key]?.[lang] ?? ''
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v)
  return out
}

/**
 * The emails the sends wrote, for the company's inbox (`portalMessages`). A first master agreement
 * or statement of work is the message the portal already writes from the send itself, so it has
 * none of its own here.
 */
export function paperSendMessages(state: GcState, partner: Partner, lang: PortalLang): PortalMessage[] {
  const gc = GC_COMPANY.name
  const hello = pt(lang, 'mHello', { first: partner.contact.split(' ')[0] ?? partner.contact })
  const out: PortalMessage[] = []
  for (const send of state.paperSends ?? []) {
    if (send.partnerId !== partner.id || send.first) continue
    const date = pWeekday(lang, send.by)
    const project = state.projects.find((p) => p.id === send.projectId)
    const pkg = project?.packages.find((k) => k.id === send.packageId)
    const note = send.note ? [send.note] : []
    const asked = paperSendsFor(state, send.partnerId, send.paper, send.packageId)
    const again = asked.findIndex((s) => s.id === send.id) > 0
    const base = { key: `send:${send.id}`, on: send.on, projectId: send.projectId ?? null }
    if (send.paper === 'msa') {
      out.push({ ...base, kind: 'msa', subject: REMINDER[lang] + pt(lang, 'mMsaSubject', { gc }), lines: [hello, w(lang, 'msaStill', { date }), ...note, pt(lang, 'mMsaHere'), pt(lang, 'mMsaOpen')] })
    } else if (send.paper === 'sow' && project && pkg) {
      out.push({
        ...base,
        kind: 'sow',
        subject: REMINDER[lang] + pt(lang, 'mSowSubject', { trade: pkg.trade, project: project.name }),
        lines: [hello, w(lang, 'sowStill', { trade: pkg.trade, project: project.name, date }), ...note, pt(lang, 'mSowOpen')],
      })
    } else if (send.paper === 'insurance') {
      out.push({
        ...base,
        kind: 'coi',
        subject: (again ? REMINDER[lang] : '') + w(lang, 'coiSubject', { gc }),
        lines: [hello, w(lang, partner.coiExpires ? 'coiRenew' : 'coiNone', { date }), ...note, pt(lang, 'mCoiOpen'), pt(lang, 'mCoiPromise')],
      })
    } else if (send.paper === 'w9') {
      out.push({ ...base, kind: 'nudge', subject: (again ? REMINDER[lang] : '') + w(lang, 'w9Subject', { gc }), lines: [hello, w(lang, 'w9Ask', { date }), ...note, w(lang, 'w9Open', {})] })
    } else if (send.paper === 'waiver' && project) {
      const draws = (send.draws ?? []).join(lang === 'es' ? ' y ' : ' and ')
      out.push({
        ...base,
        kind: 'nudge',
        subject: (again ? REMINDER[lang] : '') + w(lang, 'waiverSubject', { draws, project: project.name }),
        lines: [hello, w(lang, 'waiverAsk', { draws, project: project.name, date }), ...note, w(lang, 'waiverOpen', {})],
      })
    }
  }
  return out
}
