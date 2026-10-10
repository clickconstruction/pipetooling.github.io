/**
 * GC mode, the real build, the Board's B2: papers sent to a trade from its company window, moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcPaperSend.ts`). The emails themselves (`paperSendMessages`) read the portal's words and move
 * with the Portal lane's P3.
 */
import type { PortalLang } from './portalI18n'
import { pWeekday } from './portalI18n'
import type { GcProject, GcState, PaperKind, PaperSend, Partner, PromiseKind, TradePackage } from './types'
import { daysUntil, shortDate, weekdayDate } from './words'

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
    // P5b-2: a certificate they sent from their portal waits for the office's look, and is still owed until it is marked
    // good; a W-9 they started in their portal, with no send of ours, says so.
    const portal =
      paper === 'insurance' && partner.coiReceived
        ? `Came in from their portal ${shortDate(partner.coiReceived.sentOn)}. It counts once you mark it good.`
        : paper === 'w9' && sends.length === 0 && partner.w9SentOn
          ? `Started in their portal ${shortDate(partner.w9SentOn)}.`
          : null
    if (!firstOn) return { ...base, mode: 'first', verb: 'Ask for it', title: `Ask for ${thing}`, sendLabel: 'Send the ask', history: portal ?? 'Not asked yet.' }
    const asked = historyWords(firstOn, sends.slice(sends[0] ? 1 : 0), today, true)
    return { ...base, mode: 'reminder', verb: 'Remind them', title: `Remind them to send ${thing}`, sendLabel: 'Send the reminder', history: portal && paper === 'insurance' ? `${asked} ${portal}` : asked }
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

const SIGN_BY: Record<'msa' | 'sow', Record<PortalLang, string>> = {
  msa: { en: 'Please sign it by {date}.', es: 'Por favor fírmelo a más tardar el {date}.' },
  sow: { en: 'Please sign it by {date}.', es: 'Por favor fírmela a más tardar el {date}.' },
}

/**
 * The first master agreement or statement of work sent from the company window carries its day
 * and the office's line in the email the portal already writes (the owner, 2026-10-04): Follow up
 * chases that day, so the trade is told it. Empty when it went out another way (Contracts).
 */
export function firstSendLines(state: GcState, partnerId: string, paper: 'msa' | 'sow', packageId: string | undefined, lang: PortalLang): string[] {
  const first = paperSendsFor(state, partnerId, paper, packageId).find((s) => s.first)
  if (!first) return []
  return [SIGN_BY[paper][lang].split('{date}').join(pWeekday(lang, first.by)), ...(first.note ? [first.note] : [])]
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
