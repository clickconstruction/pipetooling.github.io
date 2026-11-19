/**
 * Permit news on Followup (punch list #401, PR 3): the words of one card in the Permit news
 * lens. A card reads top to bottom in the order an estimator thinks: what kind of news it is,
 * which bid, what the city shows, and why it looks like that bid. The app does the comparing and
 * says what matched and what the records do not say. Under it stands one question with its
 * answers, and each answer is one press. Every line says what we can see, never what a builder
 * did. No React, no Supabase.
 */
import { builderKeyOf } from '../../../supabase/functions/_shared/permitLookup'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { looksLikeThisJob, permitUnitsOf, readBidAddress } from './bidSite'
import type { NewsItem } from './bidPermitNews'
import type { PermitAnswer, StandingAnswer } from './bidPermitAnswers'
import { shortDay, shortMoney, sqFtWords } from './permitResearch'
import { daysBetween } from './permitSkim'

/** A bid as a card reads it. `gcName` is the GC the bid went to, when it has one. */
export type CardBid = {
  bid_number: string | null
  project_name: string | null
  address: string | null
  bid_date_sent: string | null
  created_at?: string | null
  last_contact?: string | null
  bid_value?: number | null
  gcName: string | null
}

/** The presses under a card. `lost` opens the bid's own outcome; the others are an answer on the permit. */
export type CardAnswer = 'lost' | 'waiting' | 'got_it' | 'not_ours'

export const CARD_ANSWER_LABEL: Record<CardAnswer, string> = { lost: 'We lost it…', waiting: 'Still waiting', got_it: 'Got it', not_ours: 'Not our job' }

/** What a press writes down. A loss is the bid's own outcome and writes no answer here. */
export const CARD_ANSWER_SAVES: Record<Exclude<CardAnswer, 'lost'>, PermitAnswer> = { waiting: 'this_job', got_it: 'this_job', not_ours: 'not_this_job' }

/** One reason under a card: `ok` is a match the records show, and not `ok` is a thing they do not say. */
export type CardReason = { ok: boolean; words: string }

export type CardTone = 'red' | 'green' | 'amber'

export type PermitNewsCard = {
  tone: CardTone
  /** What kind of news it is, the tag that leads the card. */
  kind: string
  /** The bid is not sent yet: a second tag, and no card of it offers a loss. */
  notSent: boolean
  bidNumber: string | null
  bidName: string
  /** The GC, the value, the day sent and the last contact, as far as the bid has them. */
  bidMeta: string
  /** What the city shows, the one large sentence. */
  head: string
  /** The work in the city's own words, when its project line says anything. */
  cityQuote: string | null
  /** The permit's number, and what a building permit declares. */
  cityFacts: string
  reasons: CardReason[]
  question: string
  answers: CardAnswer[]
  /** An issued building permit on a sent bid is a reason to call: the card points at the Call queue. */
  callDoor: boolean
}

const KIND: Record<NewsItem['kind'], { tone: CardTone; kind: string }> = {
  plumbing: { tone: 'red', kind: 'Another name on the plumbing permit' },
  ours: { tone: 'green', kind: 'Our plumbing permit' },
  issued: { tone: 'green', kind: 'Building permit issued' },
  applied: { tone: 'amber', kind: 'Application filed' },
}

const clean = (s: string | null | undefined): string | null => s?.replace(/\s+/g, ' ').trim() || null
const daysWords = (n: number): string => (n === 1 ? '1 day' : `${n} days`)

function agoWords(days: number | null): string | null {
  if (days == null || days < 0) return null
  if (days === 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}

function suiteReason(bid: CardBid, item: NewsItem, readCities: readonly string[]): CardReason {
  const site = readBidAddress(bid.address, readCities)
  const ours = site.kind === 'site' ? (site.units ?? null) : null
  const theirs = permitUnitsOf(item.permit)
  if (ours && theirs) {
    const shared = theirs.find((u) => ours.includes(u)) ?? theirs[0] ?? ''
    return { ok: true, words: `Suite ${shared.toUpperCase()}, the bid’s own suite` }
  }
  if (!ours && !theirs) return { ok: false, words: 'Neither the permit nor the bid names a suite' }
  if (ours) return { ok: false, words: 'The permit names no suite' }
  return { ok: false, words: `The permit names suite ${(theirs?.[0] ?? '').toUpperCase()} and the bid names none` }
}

function timingReason(bid: CardBid, item: NewsItem): CardReason | null {
  if (!item.day) return null
  const verb = item.kind === 'applied' ? 'Filed' : item.permit.stage === 'applied' ? 'Applied for' : 'Issued'
  if (bid.bid_date_sent) {
    const after = daysBetween(bid.bid_date_sent, item.day)
    if (after == null) return null
    if (after > 0) return { ok: true, words: `${verb} ${daysWords(after)} after you sent the bid` }
    return after === 0 ? { ok: true, words: `${verb} the day you sent the bid` } : { ok: false, words: `${verb} ${daysWords(-after)} before you sent the bid` }
  }
  const started = bid.created_at ? bid.created_at.slice(0, 10) : null
  const after = started ? daysBetween(started, item.day) : null
  if (after == null) return null
  if (after > 0) return { ok: true, words: `${verb} ${daysWords(after)} after the bid was started` }
  return after === 0 ? { ok: true, words: `${verb} the day the bid was started` } : { ok: false, words: `${verb} ${daysWords(-after)} before the bid was started` }
}

/** The words of one card. `readCities` are the cities whose permits are pulled; `todayYmd` is today in the app's time. */
export function permitNewsCard(item: NewsItem, bid: CardBid, readCities: readonly string[], todayYmd: string): PermitNewsCard {
  const { permit } = item
  const sent = bid.bid_date_sent != null
  const day = item.day ? shortDay(item.day, todayYmd) : null
  const name = clean(permit.contact)
  const did = permit.stage === 'applied' ? 'applied for' : 'issued'

  let head: string
  if (item.kind === 'plumbing') head = `The city lists ${name ?? 'another name'} on a plumbing permit here${day ? `, ${did} ${day}` : ''}.`
  else if (item.kind === 'ours') head = `A plumbing permit here lists us${name ? `, as ${name}` : ''}${day ? `. It was ${did} ${day}` : ''}.`
  else if (item.kind === 'issued') head = `The building permit here was issued${day ? ` ${day}` : ''}.`
  else head = `A permit application was filed here${day ? ` ${day}` : ''}.`

  // San Antonio's project line is a building and a unit number, which says nothing about the work.
  const quote = clean(permit.project_name)
  const cityQuote = quote && !/^Building No:/i.test(quote) ? quote : null
  const money = shortMoney(permit.declared_value)
  const cityFacts = [`Permit ${permit.permit_number}`, money ? `${money} declared` : null, sqFtWords(permit.area_sf)].filter(Boolean).join(' · ')

  const reasons: CardReason[] = [suiteReason(bid, item, readCities)]
  const timing = timingReason(bid, item)
  if (timing) reasons.push(timing)
  // The building permit on the address: the one beside a plumber's permit, or the line's own.
  const building = item.beside ?? (permit.kind === 'building' ? permit : null)
  const listed = clean(building?.contact)
  const gcKey = builderKeyOf(bid.gcName)
  if (listed && gcKey != null && builderKeyOf(listed) === gcKey) reasons.push({ ok: true, words: `The ${item.beside ? 'building permit' : 'permit'} lists ${listed}, your GC` })
  if (looksLikeThisJob(bid.project_name, permit.project_name) || looksLikeThisJob(bid.project_name, item.beside?.project_name)) reasons.push({ ok: true, words: 'The city’s project line looks like this job' })
  // What matched reads first, then what the records do not say.
  reasons.sort((a, b) => Number(b.ok) - Number(a.ok))

  let question: string
  let answers: CardAnswer[]
  if (item.kind === 'plumbing' && item.markLost) [question, answers] = ['Did we lose this bid?', ['lost', 'waiting', 'not_ours']]
  else if (item.kind === 'plumbing') [question, answers] = ['Worth knowing before you send.', ['got_it', 'not_ours']]
  else if (item.kind === 'ours') [question, answers] = ['This permit is ours.', ['got_it', 'not_ours']]
  else if (item.kind === 'issued') [question, answers] = ['The job is moving.', ['got_it', 'not_ours']]
  else [question, answers] = ['Plans are with the city.', ['got_it', 'not_ours']]

  const value = shortMoney(bid.bid_value ?? null)
  const contact = sent ? agoWords(daysBetween(bid.last_contact ? bid.last_contact.slice(0, 10) : null, todayYmd)) : null
  const bidMeta = [clean(bid.gcName), value, sent ? `sent ${shortDay(bid.bid_date_sent, todayYmd)}` : null, contact ? `last contact ${contact}` : null].filter(Boolean).join(' · ')

  return {
    ...KIND[item.kind],
    notSent: !sent,
    bidNumber: clean(bid.bid_number),
    bidName: clean(bid.project_name) ?? 'A bid',
    bidMeta,
    head,
    cityQuote,
    cityFacts,
    reasons,
    question,
    answers,
    callDoor: item.kind === 'issued' && sent,
  }
}

/** The one line an answered card folds to, said to the person who pressed. */
export function receiptWords(answer: Exclude<CardAnswer, 'lost'>): string {
  if (answer === 'not_ours') return 'You said it is not our job. It is off the bid for everyone.'
  return answer === 'waiting' ? 'You said still waiting. The permit stays on the bid as a chip.' : 'Got it. The permit stays on the bid as a chip.'
}

/** Who answered and when, for the list of answered lines: "Marcus said it is this job, Nov 12". `who` is a name, or "You". */
export function answeredWords(standing: StandingAnswer, who: string, todayYmd: string): string {
  const day = shortDay(calendarYmdInAppTzFromIso(standing.at), todayYmd)
  return `${who} said it is ${standing.answer === 'this_job' ? 'this job' : 'not this job'}, ${day}`
}
