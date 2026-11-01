import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { daysBetweenYmd, formatYmdMonthDay } from './billedExpectedPay'
import { demandDate, demandMoney, lienLineBlockedReason } from '../jobsDocuments/demandLetter'
import { countedLabel } from '../batchWords'
import type { LetterTwoStatus } from './lienLetterTwo'
import { lienOfferSentence, type LienPayOffer } from './lienPayOffer'

/**
 * The courtesy notice (punch list #231, PR 1): the plain reminder a supply house sends before it
 * liens — we already sent you the notice, nothing has come, the lien goes on by this day unless
 * it is paid, here is where to pay, here is who to call. Between the sent § 53.056 notice and the
 * affidavit the desk offered only letter two, counsel's certified second packet, and on
 * 2026-11-01 fifteen sent notices sat at day 18 with none pressed. This is the light step: one
 * press from day 7, an email and a text built from the sent notice's own facts, never certified
 * mail, never a statutory form. The owner took every recommendation the same day.
 *
 * Pure: where the courtesy stands on a sent notice (`courtesyStatus`), who gets it and by which
 * channel (`courtesyPlan`), the words (`courtesyEmailText`, `courtesyTextBody`), and the record
 * the sent item keeps (`fields.courtesy`, `parseCourtesyRecords`). Nothing here reads or writes;
 * PR 2 presses it.
 *
 * What it may not do: name a lien day the law would not allow. Texas Finance Code § 392.301(a)(8)
 * forbids threatening an action not permitted, and the company collects its own debts under that
 * chapter, so the lien's day comes from the live affidavit step through the demand letter's own
 * gate (`lienLineBlockedReason`: a homestead, no approved work month, the window closed) and the
 * message is held, with the reason, rather than sent without it. The words keep counsel's never-say
 * list: no interest or fees, no theft of service, no joint check, no "the law makes you pay us", no
 * default, nothing about the GC's other jobs.
 */

/** From this day after the packet the desk offers the press. Letter two keeps its day 10. */
export const COURTESY_FROM_DAY = 7
/** A second press waits this long after the last send. */
export const COURTESY_AGAIN_DAYS = 7
/** Inside this many days of the affidavit's day the affidavit is the next press, not a reminder. */
export const COURTESY_AFFIDAVIT_MARGIN_DAYS = 7
export const COURTESY_BUTTON = 'Send a courtesy notice'
/** The key on the sent item's `fields`. */
export const COURTESY_FIELDS_KEY = 'courtesy'

export type CourtesyWho = 'original_contractor' | 'owner'
export type CourtesyChannel = 'email' | 'text'

const WHO_WORDS: Record<CourtesyWho, string> = { original_contractor: 'the GC', owner: 'the owner' }

/** One recipient's one channel, as the record keeps it: where it went, and whether it went. */
export type CourtesySent = {
  who: CourtesyWho
  name: string
  channel: CourtesyChannel
  address: string
  ok: boolean
  /** The email's id or the text's line id; null when it did not go. */
  id: string | null
  /** Why it did not go; '' when it went. */
  reason: string
}

/** One press, as `fields.courtesy[]` keeps it. */
export type CourtesyRecord = {
  /** ISO — when it was pressed. */
  at: string
  /** Who pressed. */
  by: string
  /** 'YYYY-MM-DD' — the lien's day the message named. */
  lienDay: string
  /** The amount the message named. */
  claim: number
  to: CourtesySent[]
}

const YMD = /^\d{4}-\d{2}-\d{2}$/
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** The records on a sent item's `fields.courtesy`, newest last; anything malformed is dropped. */
export function parseCourtesyRecords(raw: unknown): CourtesyRecord[] {
  if (!Array.isArray(raw)) return []
  const out: CourtesyRecord[] = []
  for (const r of raw as Array<Record<string, unknown> | null>) {
    if (!r || typeof r !== 'object' || typeof r.at !== 'string' || !r.at) continue
    const to = Array.isArray(r.to)
      ? (r.to as Array<Record<string, unknown> | null>)
          .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === 'object')
          .filter((t) => (t.who === 'original_contractor' || t.who === 'owner') && (t.channel === 'email' || t.channel === 'text'))
          .map((t) => ({ who: t.who as CourtesyWho, name: str(t.name), channel: t.channel as CourtesyChannel, address: str(t.address), ok: t.ok === true, id: typeof t.id === 'string' ? t.id : null, reason: str(t.reason) }))
      : []
    out.push({ at: r.at, by: str(r.by), lienDay: YMD.test(str(r.lienDay)) ? str(r.lienDay) : '', claim: typeof r.claim === 'number' && Number.isFinite(r.claim) ? r.claim : 0, to })
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

/** The sent item's `fields` with one more record, for the write. */
export function withCourtesyRecord(fields: Record<string, unknown> | null | undefined, record: CourtesyRecord): Record<string, unknown> {
  const prior = parseCourtesyRecords(fields?.[COURTESY_FIELDS_KEY])
  return { ...(fields ?? {}), [COURTESY_FIELDS_KEY]: [...prior, record] }
}

export type CourtesyState = 'none' | 'waiting' | 'due' | 'held' | 'sent' | 'closed'

export type CourtesyStatus = {
  state: CourtesyState
  /** Letter two's day: whole days since the packet; null with nothing out. */
  day: number | null
  /** One wording for the row and the footer. */
  words: string
  /** Why it is held or closed; '' otherwise. */
  reason: string
  /** The newest send, ISO; null when none. */
  lastSentAt: string | null
  /** 'YYYY-MM-DD' — the lien's day the message would name; null when none can be named. */
  lienDay: string | null
  records: CourtesyRecord[]
}

export type CourtesyAffidavitFacts = {
  /** The § 53.052 day as the desk's affidavit entry carries it; null or '' when it has none. */
  deadline: string | null | undefined
  filedAt: string | null | undefined
  homestead: boolean
  hasWorkMonth: boolean
}

export type CourtesyStatusInput = {
  /** Letter two's clock on the job — the first packet, its day and what closed it. */
  letterTwo: LetterTwoStatus | null | undefined
  records: ReadonlyArray<CourtesyRecord>
  /** The job's open balance, as letter two reads it. */
  openBalance: number
  todayYmd: string
  affidavit: CourtesyAffidavitFacts | null
  /** A line back from either recipient after the last send (a Messages reply), ISO; null when none. */
  repliedAt?: string | null
  formatDay?: (ymd: string) => string
}

export const COURTESY_NONE: CourtesyStatus = { state: 'none', day: null, words: '', reason: '', lastSentAt: null, lienDay: null, records: [] }

function sentChannelsWords(r: CourtesyRecord): string {
  const went = r.to.filter((t) => t.ok)
  const emails = went.some((t) => t.channel === 'email')
  const texts = went.some((t) => t.channel === 'text')
  if (emails && texts) return 'by email and text'
  if (emails) return 'by email'
  if (texts) return 'by text'
  return 'nothing went'
}

/**
 * Where the courtesy notice stands on one sent notice. Read in this order: nothing out; closed by
 * a payment, the GC's written okay, the owner's call, the filed affidavit or a reply; held by the
 * affidavit's gate or its nearness; sent inside the last week; waiting before day 7; due.
 */
export function courtesyStatus(input: CourtesyStatusInput): CourtesyStatus {
  const fmt = input.formatDay ?? ((d) => formatYmdMonthDay(d))
  const lt = input.letterTwo
  if (!lt || lt.state === 'none' || !lt.firstSentAt) return COURTESY_NONE
  const records = [...input.records].sort((a, b) => a.at.localeCompare(b.at))
  const last = records[records.length - 1] ?? null
  const lastSentAt = last?.at ?? null
  const deadline = (input.affidavit?.deadline ?? '').trim()
  const lienDay = YMD.test(deadline) ? deadline : null
  const base = { day: lt.day, lastSentAt, lienDay, records }
  const closed = (reason: string): CourtesyStatus => ({ ...base, state: 'closed', words: reason, reason })
  const held = (reason: string): CourtesyStatus => ({ ...base, state: 'held', words: `Courtesy held · ${reason}`, reason })

  if (input.openBalance <= 0.005 || lt.state === 'paid') return closed('paid')
  if (lt.gcAuthorized) return closed(`the GC authorized direct pay ${fmt(calendarYmdInAppTzFromIso(lt.gcAuthorized.at))}`)
  if (lt.state === 'owner_called') return closed(lt.words || 'the owner called')
  if (input.affidavit?.filedAt) return closed(`the affidavit is filed · served next`)
  if (input.repliedAt && last && input.repliedAt > last.at) return closed(`they answered ${fmt(calendarYmdInAppTzFromIso(input.repliedAt))}`)

  const blocked = lienLineBlockedReason({ lienFilingDeadline: lienDay ?? '', todayYmd: input.todayYmd, homestead: input.affidavit?.homestead ?? false, hasWorkMonth: input.affidavit?.hasWorkMonth ?? Boolean(lienDay) })
  if (blocked) return held(blocked)
  const left = lienDay ? daysBetweenYmd(input.todayYmd, lienDay) : null
  if (left != null && left < COURTESY_AFFIDAVIT_MARGIN_DAYS) return held(`the affidavit is due ${fmt(lienDay!)} · file it instead`)

  const day = lt.day ?? 0
  if (last) {
    const since = daysBetweenYmd(calendarYmdInAppTzFromIso(last.at), input.todayYmd) ?? 0
    const sentWords = `courtesy sent ${fmt(calendarYmdInAppTzFromIso(last.at))} ${sentChannelsWords(last)}`
    if (since < COURTESY_AGAIN_DAYS) return { ...base, state: 'sent', words: sentWords, reason: '' }
    return { ...base, state: 'due', words: `day ${day} · ${sentWords} · nothing since`, reason: '' }
  }
  if (day < COURTESY_FROM_DAY) return { ...base, state: 'waiting', words: `day ${day} · courtesy from day ${COURTESY_FROM_DAY}`, reason: '' }
  return { ...base, state: 'due', words: `day ${day} · nothing since the packet`, reason: '' }
}

/** The states the office acts on: the Do now row and the amber footer. */
export function courtesyIsDue(s: Pick<CourtesyStatus, 'state'>): boolean {
  return s.state === 'due'
}

/** The footer's sentence under a sent notice, beside letter two's. */
export function courtesyFooterSentence(s: CourtesyStatus, amountWords: string, formatDay: (ymd: string) => string = formatYmdMonthDay): string {
  switch (s.state) {
    case 'none':
      return ''
    case 'closed':
      return `Courtesy notice: ${s.reason}.`
    case 'held':
      return `Courtesy notice held: ${s.reason}. A reminder may not name a lien that cannot go on.`
    case 'sent':
      return `${s.words[0]!.toUpperCase()}${s.words.slice(1)}. Another may go in ${COURTESY_AGAIN_DAYS} days if nothing comes; letter two is counsel's certified second letter from day 10.`
    case 'waiting':
      return `A courtesy notice may go from day ${COURTESY_FROM_DAY}: the notice stands, the lien goes on by ${s.lienDay ? formatDay(s.lienDay) : 'its day'} unless ${amountWords} is paid, the pay link, your number.`
    case 'due':
      return `Nothing has come since the packet. A courtesy notice goes by email and text in a minute: the notice stands, the lien goes on by ${s.lienDay ? formatDay(s.lienDay) : 'its day'} unless ${amountWords} is paid, the pay link, your number. Letter two is counsel's certified second letter, from day 10.`
  }
}

// ---------------------------------------------------------------------------
// Who gets it
// ---------------------------------------------------------------------------

export type CourtesyRecipientInput = {
  who: CourtesyWho
  name: string
  /** '' when none is on file. */
  email: string
  /** '' when none is on file. */
  phone: string
  /** The number may be texted: a Messages channel holds it and Send texts is on. '' when it may; else why not. */
  textHold: string
}

export type CourtesyChannelPlan = { address: string; goes: boolean; reason: string }

export type CourtesyRecipientPlan = { who: CourtesyWho; name: string; email: CourtesyChannelPlan; text: CourtesyChannelPlan }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Each recipient's two channels: which go, and why one does not. */
export function courtesyPlan(recipients: ReadonlyArray<CourtesyRecipientInput>): CourtesyRecipientPlan[] {
  return recipients.map((r) => {
    const email = r.email.trim()
    const phone = r.phone.trim()
    const noun = r.who === 'owner' ? 'the property record' : 'the job'
    return {
      who: r.who,
      name: r.name.trim(),
      email: email ? (EMAIL.test(email) ? { address: email, goes: true, reason: '' } : { address: email, goes: false, reason: 'not an email address' }) : { address: '', goes: false, reason: `no email on ${noun}` },
      text: phone ? (r.textHold ? { address: phone, goes: false, reason: r.textHold } : { address: phone, goes: true, reason: '' }) : { address: '', goes: false, reason: `no number on ${noun}` },
    }
  })
}

export type CourtesyCounts = { emails: number; texts: number }

export function courtesyCounts(plans: ReadonlyArray<CourtesyRecipientPlan>): CourtesyCounts {
  return { emails: plans.filter((p) => p.email.goes).length, texts: plans.filter((p) => p.text.goes).length }
}

/** The send button: *Send 3 messages*, dead at zero (*Send messages*). */
export function courtesySendButton(plans: ReadonlyArray<CourtesyRecipientPlan>): { label: string; dead: boolean; detail: string } {
  const c = courtesyCounts(plans)
  const n = c.emails + c.texts
  const parts = [c.emails ? `${c.emails} ${c.emails === 1 ? 'email' : 'emails'}` : '', c.texts ? `${c.texts} ${c.texts === 1 ? 'text' : 'texts'}` : ''].filter(Boolean)
  return { label: countedLabel('Send', n, ['message', 'messages']), dead: n === 0, detail: n === 0 ? 'Nothing can go: no email and no number that may be texted.' : parts.join(' · ') }
}

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

export type CourtesyPayLink = { address: string; amount: number }

export type CourtesyFacts = {
  jobNumber: string
  jobName: string
  propertyAddress: string
  /** The county the affidavit files in; '' leaves it out. */
  county: string
  gcName: string
  claimantName: string
  /** The amount the message names: the notice's claim, or what the enclosed bills still owe. */
  claim: number
  /** "August 2026", "August and September 2026". */
  monthsWords: string
  /** 'YYYY-MM-DD' — the day the packet went. */
  noticeSentOn: string
  /** 'YYYY-MM-DD' — the affidavit's day. */
  lienDay: string
  /** The pay page's addresses, one per bill with money open; empty when no bill has a page. */
  payLinks: ReadonlyArray<CourtesyPayLink>
  contactPerson: string
  phone: string
  /** The pay offer live on the notice, repeated here (the owner's pick 6); null when none. */
  offer?: LienPayOffer | null
}

/** "Dana," from "Dana Ortiz"; a company keeps its whole name. The one line the office may change. */
export function courtesyGreeting(name: string): string {
  const n = name.trim()
  if (!n) return 'Hello,'
  const first = n.split(/\s+/)[0]!
  const company = /\b(inc|llc|ltd|co|corp|group|builders|construction|contracting|homes|partners|company)\b\.?$/i.test(n) || n.split(/\s+/).length > 3
  return `${company ? n : first},`
}

function money(n: number): string {
  return demandMoney(String(Math.round(n * 100) / 100))
}

/** The pay line: one link, several, or none. Never a joint check. */
export function courtesyPayLine(f: Pick<CourtesyFacts, 'payLinks' | 'claimantName'>): string {
  const us = f.claimantName.trim() || 'us'
  const links = f.payLinks.filter((l) => l.address.trim())
  const check = `Or a check or wire payable only to ${us}. We cannot deposit a joint check.`
  if (links.length === 0) return `Pay by check or wire payable only to ${us}. We cannot deposit a joint check.`
  if (links.length === 1) return `Pay it here: ${links[0]!.address.trim()} (card or bank transfer; the page shows the bill and says so once it is paid). ${check}`
  return `Pay here, one page per bill: ${links.map((l) => `${l.address.trim()} (${money(l.amount)})`).join(', ')}. Each page takes card or bank transfer and says so once it is paid. ${check}`
}

export function courtesySubject(f: Pick<CourtesyFacts, 'jobName' | 'claim' | 'lienDay'>): string {
  return `Before we file: ${f.jobName.trim()}, ${money(f.claim)} — paid by ${formatYmdMonthDay(f.lienDay)}, no lien`
}

/** The owner's subject names the notice, not the money they do not owe. */
export function courtesyOwnerSubject(f: Pick<CourtesyFacts, 'noticeSentOn' | 'propertyAddress'>): string {
  return `A reminder on the notice we mailed ${formatYmdMonthDay(f.noticeSentOn)} · ${f.propertyAddress.trim()}`
}

/**
 * The email as the GC or the owner reads it. The first line names the notice and says it stands.
 * The lien's day is the affidavit's. The three ways to end it are the cover letter's, shortened.
 * The owner's copy keeps the pay page's owner rule word for word and says nothing here is billed
 * to them.
 */
export function courtesyEmailText(f: CourtesyFacts, who: CourtesyWho, greeting: string): string {
  const gc = f.gcName.trim() || 'the contractor'
  const us = f.claimantName.trim() || 'us'
  const amount = money(f.claim)
  const where = f.propertyAddress.trim()
  const job = `${f.jobNumber.trim()}${f.jobName.trim() ? `, ${f.jobName.trim()}` : ''}`
  const sent = demandDate(f.noticeSentOn)
  const lien = demandDate(f.lienDay)
  const county = f.county.trim() ? ` in ${f.county.trim()} County` : ''
  const sign = `${f.contactPerson.trim()}${f.phone.trim() ? ` · ${f.phone.trim()}` : ''}\n${us} · Job ${f.jobNumber.trim()}`
  const offer = f.offer ? `\n\n${lienOfferSentence(f.offer)}` : ''
  if (who === 'owner') {
    return [
      `To the owner of ${where},`,
      `On ${sent} we mailed you the notice of claim under Tex. Prop. Code § 53.056 on ${job}: ${gc} has not paid us ${amount} for work in ${f.monthsWords}. That notice stands. This is a reminder, not a new notice. You did not hire us, and nothing here is billed to you.`,
      `Nothing has come in since. Unless the ${amount} is paid, we will file the lien affidavit${county} by ${lien}. We would rather pick up a check than put an affidavit on your property.`,
      `Please pay us only if ${gc} has told you in writing that you may pay us directly. Otherwise hold ${amount} back from your next payment to ${gc}, as the cover letter asked, and call us so we know it is held. We cannot deposit a joint check.${offer}`,
      `If something is wrong, or a payment is already on its way, reply to this email or call and tell us.`,
      sign,
    ].join('\n\n')
  }
  return [
    greeting.trim() || courtesyGreeting(f.gcName),
    `On ${sent} we mailed you and the owner of ${where} the Notice of Claim for Unpaid Labor or Materials (Tex. Prop. Code § 53.056) on job ${job}: ${amount} for work in ${f.monthsWords}. That notice stands. This is a reminder, not a new notice.`,
    `Nothing has come in since. Unless the ${amount} is paid, we will file the lien affidavit${county} by ${lien}. A recorded affidavit is harder to take off than the notice, and we would rather pick up a check.`,
    `${courtesyPayLine(f)}${offer}`,
    `If something on the bill is wrong, or a payment is already on its way, reply to this email or call and tell us.`,
    sign,
  ].join('\n\n')
}

/** The text: short, the same facts, the first pay link. `quo-send` adds the opt-out line itself. */
export function courtesyTextBody(f: CourtesyFacts, who: CourtesyWho): string {
  const us = f.claimantName.trim() || 'us'
  const amount = money(f.claim)
  const link = f.payLinks.find((l) => l.address.trim())?.address.trim() ?? ''
  const call = `Questions: ${f.contactPerson.trim()}${f.phone.trim() ? ` ${f.phone.trim()}` : ''}.`
  if (who === 'owner') {
    return `${us}: on ${formatYmdMonthDay(f.noticeSentOn)} we mailed you the notice of claim on ${f.propertyAddress.trim()} (job ${f.jobNumber.trim()}), ${amount} owed by ${f.gcName.trim() || 'your contractor'}. Nothing has come. Unless it is paid, the lien affidavit is filed by ${formatYmdMonthDay(f.lienDay)}. Pay us only with ${f.gcName.trim() || 'the contractor'}'s written okay; otherwise hold it back and call. ${call} This is a reminder, not a new notice.`
  }
  return `${us}: on ${formatYmdMonthDay(f.noticeSentOn)} we mailed you and the owner the notice of claim on ${f.jobName.trim()} (job ${f.jobNumber.trim()}), ${amount} for ${f.monthsWords}. Nothing has come. Unless it is paid, the lien affidavit is filed by ${formatYmdMonthDay(f.lienDay)}.${link ? ` Pay here: ${link}` : ` Pay by check or wire payable only to ${us}.`} ${call} This is a reminder, not a new notice.`
}

// ---------------------------------------------------------------------------
// The record, in words
// ---------------------------------------------------------------------------

/** "sent Nov 2 by Grace · email to the GC and the owner, text to the GC · named Nov 16". */
export function courtesyRecordWords(r: CourtesyRecord, formatDay: (ymd: string) => string = formatYmdMonthDay): string {
  const went = r.to.filter((t) => t.ok)
  const byChannel = (c: CourtesyChannel) => {
    const whos = [...new Set(went.filter((t) => t.channel === c).map((t) => WHO_WORDS[t.who]))]
    return whos.length ? `${c} to ${whos.join(' and ')}` : ''
  }
  const channels = [byChannel('email'), byChannel('text')].filter(Boolean).join(', ')
  const failed = r.to.filter((t) => !t.ok)
  const failedWords = failed.length ? ` · not sent: ${failed.map((t) => `${t.channel} to ${WHO_WORDS[t.who]} (${t.reason || 'no reason given'})`).join('; ')}` : ''
  return `sent ${formatDay(calendarYmdInAppTzFromIso(r.at))}${r.by ? ` by ${r.by}` : ''} · ${channels || 'nothing went'}${r.lienDay ? ` · named ${formatDay(r.lienDay)}` : ''}${failedWords}`
}

/** The toast after a press: what went and what was held, in `batchOutcomeWords`' spirit. */
export function courtesyOutcomeWords(to: ReadonlyArray<CourtesySent>): string {
  const went = to.filter((t) => t.ok)
  const failed = to.filter((t) => !t.ok)
  const n = went.length
  const head = n === 0 ? 'Nothing went.' : `${n} ${n === 1 ? 'message' : 'messages'} went: ${went.map((t) => `${t.channel} to ${WHO_WORDS[t.who]}`).join(', ')}.`
  const tail = failed.length ? ` Not sent: ${failed.map((t) => `${t.channel} to ${WHO_WORDS[t.who]} — ${t.reason || 'no reason given'}`).join('; ')}.` : ''
  return `${head}${tail}`
}
