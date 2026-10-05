/**
 * GC mode — design spike: send a paper from the company window (the owner, 2026-10-04: "make this
 * page actionable where a user could request that agreement and by clicking on something it brings
 * them into where they would send off that document"; mock-up `to-dos/gc-mode/send-a-paper-mockup.html`).
 * Each paper a trade owes us has one next step (send it to sign, remind them, ask for it), and each
 * send is an email in their language with a day it is due, which Follow up chases after.
 */
import type { GcProject, GcState, PaperKind, PaperSend, Partner, PromiseKind, TradePackage } from './gcTypes'
import type { PortalMessage } from './gcPortal'
import { daysUntil, shortDate, weekdayDate } from './gcWords'
import { pt, pWeekday, type PortalLang } from './gcPortalI18n'
import { GC_COMPANY } from './gcFixture'

/** Insurance gets its next step this many days before it runs out (the same 30 days as the renewal ask). */
const INSURANCE_ASK_WITHIN_DAYS = 30

export interface PaperStep {
  paper: PaperKind
  /** The Documents row it belongs to. */
  docKey: string
  /** first: it was never sent or asked for. reminder: it was, and is still not here. */
  mode: 'first' | 'reminder'
  /** The row's button: "Send to sign", "Remind them", "Ask for it", "Ask for the waiver". */
  verb: string
  /** The send's heading: "Remind them to sign the master agreement". */
  title: string
  /** The send button: "Send to sign", "Send the reminder", "Send the ask". */
  sendLabel: string
  /** "Sign by" or "Send by". */
  dayWord: string
  /** What came before, in a sentence: "First sent Sep 30, 2 days ago. This is the first reminder." */
  history: string
  promiseKind: PromiseKind
  /** The promise's words: "the signed master agreement". */
  what: string
  projectId?: string
  packageId?: string
  /** A lien waiver's draws owed, by number. */
  draws?: number[]
}

function ago(iso: string, today: string): string {
  const days = -daysUntil(iso, today)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

/** Every send of one paper to one company, oldest first. */
export function paperSendsFor(state: GcState, partnerId: string, paper: PaperKind, packageId?: string): PaperSend[] {
  return (state.paperSends ?? []).filter((s) => s.partnerId === partnerId && s.paper === paper && (s.packageId ?? null) === (packageId ?? null))
}

function findPackage(state: GcState, packageId: string): { project: GcProject; pkg: TradePackage } | null {
  for (const project of state.projects) {
    const pkg = project.packages.find((k) => k.id === packageId)
    if (pkg) return { project, pkg }
  }
  return null
}

/** "First sent Sep 30, 2 days ago. This is the first reminder." */
function historyWords(firstOn: string | null, reminders: PaperSend[], today: string, asked: boolean): string {
  if (!firstOn) return ''
  const head = `${asked ? 'Asked' : 'First sent'} ${shortDate(firstOn)}, ${ago(firstOn, today)}.`
  const last = reminders[reminders.length - 1]
  if (!last) return `${head} This is the first reminder.`
  return `${head} Reminded ${reminders.length === 1 ? 'once' : `${reminders.length} times`}, last ${shortDate(last.on)}.`
}

/**
 * The next step on one of a trade's papers, by its Documents key ('msa', 'insurance', 'w9',
 * 'sow-<package>', 'waivers-<package>'). Null when there is nothing to send: it is signed or current.
 */
export function paperStep(state: GcState, partner: Partner, docKey: string): PaperStep | null {
  const today = state.today
  if (docKey === 'msa') {
    if (partner.msa === 'signed') return null
    const reminders = paperSendsFor(state, partner.id, 'msa').filter((s) => !s.first)
    const base = { paper: 'msa' as const, docKey, dayWord: 'Sign by', promiseKind: 'msa' as const, what: 'the signed master agreement' }
    if (partner.msa === 'none') {
      return { ...base, mode: 'first', verb: 'Send to sign', title: 'Send the master agreement to sign', sendLabel: 'Send to sign', history: 'Not sent yet. They sign it once, and it covers every job they do for us.' }
    }
    return { ...base, mode: 'reminder', verb: 'Remind them', title: 'Remind them to sign the master agreement', sendLabel: 'Send the reminder', history: historyWords(partner.msaSentOn ?? null, reminders, today, false) }
  }
  if (docKey === 'insurance' || docKey === 'w9') {
    const paper: 'insurance' | 'w9' = docKey
    const needed = paper === 'w9' ? !partner.w9 : !partner.coiExpires || daysUntil(partner.coiExpires, today) <= INSURANCE_ASK_WITHIN_DAYS
    if (!needed) return null
    const sends = paperSendsFor(state, partner.id, paper)
    // An open promise from the office counts as asked, even from before sends were kept.
    const promise = (state.tradePromises ?? []).find((p) => !p.keptOn && p.partnerId === partner.id && p.kind === paper && !p.projectId)
    const firstOn = sends[0]?.on ?? promise?.madeOn ?? null
    const what = paper === 'w9' ? 'a signed W-9' : partner.coiExpires ? 'the renewed insurance certificate' : 'an insurance certificate'
    const base = { paper, docKey, dayWord: 'Send by', promiseKind: paper as PromiseKind, what }
    const thing = paper === 'w9' ? 'their W-9' : partner.coiExpires ? 'the renewed insurance certificate' : 'their insurance certificate'
    if (!firstOn) return { ...base, mode: 'first', verb: 'Ask for it', title: `Ask for ${thing}`, sendLabel: 'Send the ask', history: 'Not asked yet.' }
    return { ...base, mode: 'reminder', verb: 'Remind them', title: `Remind them to send ${thing}`, sendLabel: 'Send the reminder', history: historyWords(firstOn, sends.slice(sends[0] ? 1 : 0), today, true) }
  }
  if (docKey.startsWith('sow-')) {
    const found = findPackage(state, docKey.slice(4))
    const sow = found?.pkg.sow
    if (!found || !sow || sow.status === 'signed') return null
    const ids = { projectId: found.project.id, packageId: found.pkg.id }
    const base = { paper: 'sow' as const, docKey, dayWord: 'Sign by', promiseKind: 'sow' as const, what: 'the signed statement of work', ...ids }
    const reminders = paperSendsFor(state, partner.id, 'sow', found.pkg.id).filter((s) => !s.first)
    if (sow.status === 'draft') {
      return { ...base, mode: 'first', verb: 'Send to sign', title: `Send the ${found.pkg.trade.toLowerCase()} statement of work to sign`, sendLabel: 'Send to sign', history: `Drafted for ${found.project.name}. Not sent yet.` }
    }
    return { ...base, mode: 'reminder', verb: 'Remind them', title: 'Remind them to sign the statement of work', sendLabel: 'Send the reminder', history: historyWords(sow.sentOn ?? null, reminders, today, false) }
  }
  if (docKey.startsWith('waivers-')) {
    const found = findPackage(state, docKey.slice(8))
    const owed = (found?.pkg.sow?.draws ?? []).filter((d) => d.status === 'paid' && d.waiver === 'conditional')
    if (!found || owed.length === 0) return null
    const draws = owed.map((d) => d.number)
    const list = draws.join(' and ')
    const ids = { projectId: found.project.id, packageId: found.pkg.id, draws }
    const sends = paperSendsFor(state, partner.id, 'waiver', found.pkg.id)
    const base = { paper: 'waiver' as const, docKey, dayWord: 'Sign by', promiseKind: 'closeout' as const, what: `the unconditional lien waiver on draw ${list}`, ...ids }
    if (sends.length === 0) return { ...base, mode: 'first', verb: 'Ask for the waiver', title: `Ask for the unconditional waiver on draw ${list}`, sendLabel: 'Send the ask', history: `Draw ${list} is paid. The unconditional waiver has not come.` }
    return { ...base, mode: 'reminder', verb: 'Remind them', title: `Remind them to sign the waiver on draw ${list}`, sendLabel: 'Send the reminder', history: historyWords(sends[0]?.on ?? null, sends.slice(1), today, true) }
  }
  return null
}

/** The days to pick from: in 3 days, a week, two weeks. A week is the one picked first. */
export function paperDayChoices(today: string): { on: string; label: string }[] {
  const add = (n: number) => {
    const d = new Date(`${today}T12:00:00`)
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }
  return [
    { on: add(3), label: weekdayDate(add(3)) },
    { on: add(7), label: `${weekdayDate(add(7))} · a week` },
    { on: add(14), label: weekdayDate(add(14)) },
  ]
}

/** The row's line once something went: "Reminded today · sign by Fri Oct 9." Null before any send. */
export function paperSentWords(state: GcState, partnerId: string, paper: PaperKind, packageId?: string): string | null {
  const sends = paperSendsFor(state, partnerId, paper, packageId)
  const last = sends[sends.length - 1]
  if (!last) return null
  const did = last.first ? 'Sent' : paper === 'insurance' || paper === 'w9' || paper === 'waiver' ? (sends.length > 1 ? 'Reminded' : 'Asked') : 'Reminded'
  const day = paper === 'insurance' || paper === 'w9' ? 'send by' : 'sign by'
  return `${did} ${ago(last.on, state.today)} · ${day} ${weekdayDate(last.by)}.`
}

/** Activity's line for a send: "We reminded them to sign the master agreement, by Fri Oct 9." */
export function paperSendActivity(state: GcState, send: PaperSend): string {
  const by = weekdayDate(send.by)
  const reminder = paperSendsFor(state, send.partnerId, send.paper, send.packageId).findIndex((s) => s.id === send.id) > 0 || (!send.first && (send.paper === 'msa' || send.paper === 'sow'))
  const words: Record<PaperKind, string> = {
    msa: send.first ? `We sent the master agreement to sign, by ${by}.` : `We reminded them to sign the master agreement, by ${by}.`,
    sow: send.first ? `We sent the statement of work to sign, by ${by}.` : `We reminded them to sign the statement of work, by ${by}.`,
    insurance: reminder ? `We reminded them to send their insurance certificate, by ${by}.` : `We asked for their insurance certificate, by ${by}.`,
    w9: reminder ? `We reminded them to send their W-9, by ${by}.` : `We asked for their W-9, by ${by}.`,
    waiver: `${reminder ? 'We reminded them about' : 'We asked for'} the unconditional waiver on draw ${(send.draws ?? []).join(' and ')}, by ${by}.`,
  }
  return words[send.paper] + (send.note ? ` "${send.note}"` : '')
}

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

/** The reducer's log line for a send. */
export function paperSendLog(partner: Partner, step: PaperStep, by: string): string {
  const day = weekdayDate(by)
  if (step.mode === 'first' && (step.paper === 'msa' || step.paper === 'sow')) return `Sent ${partner.company} the ${step.paper === 'msa' ? 'master agreement' : 'statement of work'} to sign by ${day}.`
  if (step.mode === 'first') return `Asked ${partner.company} for ${step.what} by ${day}.`
  if (step.paper === 'msa') return `Reminded ${partner.company} to sign the master agreement by ${day}.`
  if (step.paper === 'sow') return `Reminded ${partner.company} to sign the statement of work by ${day}.`
  return `Reminded ${partner.company} about ${step.what}, due ${day}.`
}
