/**
 * Bids and permits (punch list #307, PR 5): permit news on the Bid Board. A permit changes what
 * a person does mostly after the bid is sent, and nobody opens a sent bid to look: so the board
 * says it. For every bid not yet won or lost on a street address in a city we read, a chip on the
 * row says what the city has on the address, and a strip above the board carries what is new: a
 * general plumbing permit that lists another name, a building permit just issued, an
 * application just filed. A general plumbing permit that lists one of our own names (`ourNames.ts`)
 * reads as ours, never as another name. It marks nothing by itself. No React, no Supabase.
 */
import { shortDay, shortMoney, sqFtWords } from './permitResearch'
import { daysBetween } from './permitSkim'
import { ROBOT_BID_RE } from '../bids/bidPursuit'
import { leadPermit, permitsOnSite, plumbingListing, plumbingTypeOf, readBidAddress } from './bidSite'
import { stageChip, type Chip, type SitePermitRow } from './bidSitePanel'
import { NO_OUR_KEYS, type OurNameKeys } from './ourNames'
import { NO_PERMIT_ANSWERS, permitAnswerKey, type PermitAnswers, type PermitRef, type StandingAnswer } from './bidPermitAnswers'

/** A bid as the board's news reads it. */
export type NewsBid = {
  id: string
  bid_number: string | null
  project_name: string | null
  address: string | null
  outcome: string | null
  bid_date_sent: string | null
  last_contact?: string | null
  /** When the bid was started. A plumbing permit older than that is not an answer to the bid. Left out, the rule says nothing. */
  created_at?: string | null
  /** The bid's trade. A plumbing permit is news on a plumbing bid; left out, the trade is not checked. */
  service_type_id?: string | null
}

export type NewsKind = 'plumbing' | 'ours' | 'issued' | 'applied'
/** `markLost`: the line offers Mark lost…, a sent bid with a general plumbing permit that lists another name. The press opens the board's outcome and the news marks nothing. */
export type NewsItem = {
  bidId: string
  kind: NewsKind
  title: string
  words: string
  day: string
  markLost: boolean
  /** The city the permit is in, and the permit the line is about: what an answer names. */
  city: string
  permit: SitePermitRow
  /** The building permit beside a plumbing permit's line, when the address has one. */
  beside: SitePermitRow | null
  /** The answer that stands on this bid and permit (punch list #401). Null while the line is new. */
  answered: StandingAnswer | null
}

/** A permit someone said is not this job: off the bid, and listed so the answer can be taken back. */
export type TakenOffPermit = { bidId: string; title: string; city: string; permit: SitePermitRow; words: string; by: string; at: string }

/** What an answer names of a permit. */
export function permitRefOf(city: string, permit: Pick<SitePermitRow, 'permit_number' | 'permit_type'>): PermitRef {
  return { city, permit_number: permit.permit_number, permit_type: permit.permit_type }
}

/** A permit in a few words, for a list of answered lines: "Plumbing permit listing Lone Oak Plumbing, Aug 30". */
export function permitShortWords(permit: SitePermitRow, todayYmd: string): string {
  const day = dayOf(permit)
  const on = day ? shortDay(day, todayYmd) : null
  if (plumbingTypeOf(permit.permit_type) != null) {
    const name = permit.contact?.replace(/\s+/g, ' ').trim()
    return [name ? `Plumbing permit listing ${name}` : 'Plumbing permit', on].filter(Boolean).join(', ')
  }
  if (permit.kind === 'building') return permit.stage === 'applied' ? `Permit application${on ? ` filed ${on}` : ''}` : `Building permit${on ? ` issued ${on}` : ''}`
  return [permit.work_type ?? permit.permit_type.replace(/ Permit$/i, ''), on].filter(Boolean).join(', ')
}

/** How long an issued permit or a new application stays news. A plumbing permit under another name stays while the bid is undecided. */
export const NEWS_DAYS = 30

/**
 * A plumbing permit under another name that was there before the bid was started is not an answer
 * to the bid. For this long before, it is worth knowing while pricing and the row says so quietly.
 * Older than this it is the address's history, and it stays in the bid's This site list.
 */
export const BEFORE_BID_DAYS = 183

const KIND_ORDER: Record<NewsKind, number> = { plumbing: 0, ours: 1, issued: 2, applied: 3 }

/** The quiet chip on a bid whose address had a plumbing permit under another name before the bid was started. It is no news and offers nothing. */
export function beforeBidChip(day: string, todayYmd: string): Chip {
  return { words: `Plumbing permit here since ${shortDay(day, todayYmd)}`, tone: 'grey' }
}

/** The chip on a bid whose address carries a general plumbing permit that lists one of our names. */
export const OURS_BOARD_CHIP: Chip = { words: 'Plumbing permit · ours', tone: 'green' }
const dayOf = (p: { issued_on: string | null; submitted_on: string | null }): string => p.issued_on ?? p.submitted_on ?? ''

function agoWords(days: number | null): string | null {
  if (days == null || days < 0) return null
  if (days === 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/**
 * The chip on each undecided bid's row and the news above the board. `permitsByCity` is
 * `bid_site_permits`' answer per city. A robot's copy of a bid and a decided bid get neither.
 * `ourKeys` are the names that are us on a plumbing permit; with none, every line reads as before.
 *
 * Three rules keep a line off a bid it is not true of (punch list #401). A permit on another suite
 * is not on the bid's site (`permitsOnSite`). A plumbing permit is read on a plumbing bid only:
 * `plumbingServiceTypeId` is the Plumbing type, and null leaves the trade unchecked. A plumbing
 * permit under another name from before the bid was started is no news: a quiet chip for
 * `BEFORE_BID_DAYS`, nothing after.
 *
 * `answers` are what people said of a permit on a bid (`foldPermitAnswers`). A permit that is not
 * this job is off the bid before anything is read, so the chip and the news are the ones the
 * address would have without it, and it is listed under `takenOff`. A line on a permit that is
 * this job carries the answer (`answered`), which is how a list tells a new line from one that stands.
 */
export function bidPermitNews(
  bids: readonly NewsBid[],
  permitsByCity: ReadonlyMap<string, readonly SitePermitRow[]>,
  readCities: readonly string[],
  todayYmd: string,
  ourKeys: OurNameKeys = NO_OUR_KEYS,
  plumbingServiceTypeId: string | null = null,
  answers: PermitAnswers = NO_PERMIT_ANSWERS,
): { chips: Map<string, Chip>; news: NewsItem[]; takenOff: TakenOffPermit[] } {
  const chips = new Map<string, Chip>()
  const news: NewsItem[] = []
  const takenOff: TakenOffPermit[] = []
  for (const bid of bids) {
    if (bid.outcome != null || ROBOT_BID_RE.test(bid.project_name ?? '')) continue
    const site = readBidAddress(bid.address, readCities)
    if (site.kind !== 'site') continue
    const title = [bid.bid_number?.trim() || null, bid.project_name ?? 'A bid'].filter(Boolean).join(' · ')
    const answerOn = (p: SitePermitRow): StandingAnswer | null => answers.get(permitAnswerKey(bid.id, permitRefOf(site.city, p))) ?? null
    const onSite: SitePermitRow[] = []
    for (const p of permitsOnSite(site, permitsByCity.get(site.city) ?? [])) {
      const said = answerOn(p)
      if (said?.answer === 'not_this_job') takenOff.push({ bidId: bid.id, title, city: site.city, permit: p, words: permitShortWords(p, todayYmd), by: said.by, at: said.at })
      else onSite.push(p)
    }
    if (onSite.length === 0) continue
    /** What every line of this bid carries: the city, the permit it is about, and the answer that stands on it. */
    const about = (permit: SitePermitRow, beside: SitePermitRow | null) => ({ city: site.city, permit, beside, answered: answerOn(permit) })
    const lead = leadPermit(bid.project_name, onSite)
    const building = lead && lead.kind === 'building' ? lead : null
    // A plumbing permit says nothing about who has the electrical work.
    const plumbingBid = plumbingServiceTypeId == null || bid.service_type_id == null || bid.service_type_id === plumbingServiceTypeId
    const general = plumbingBid ? ([...onSite].sort((a, b) => dayOf(b).localeCompare(dayOf(a))).find((p) => plumbingTypeOf(p.permit_type) === 'general') ?? null) : null
    const listing = general ? plumbingListing(general, building, ourKeys) : null
    const sent = bid.bid_date_sent != null

    // Our own permit: its own chip, news while it is new, and never the line that says another name. The bid stays undecided.
    // An older one may be an earlier job on a shared address, so the chip stays and the building permit's news still shows.
    const ours = general != null && listing != null && listing.ours
    if (general && listing && ours) {
      chips.set(bid.id, OURS_BOARD_CHIP)
      const day = dayOf(general)
      const age = daysBetween(day || null, todayYmd)
      if (age != null && age >= 0 && age <= NEWS_DAYS) {
        news.push({
          bidId: bid.id,
          kind: 'ours',
          title,
          day,
          markLost: false,
          ...about(general, building),
          words: `A general plumbing permit that lists us ${general.stage === 'applied' ? 'was applied for' : 'was issued'} on this address ${shortDay(day, todayYmd)}, as ${listing.name}. ${sent ? 'The bid is not yet won or lost.' : 'The bid is not sent yet.'}`,
        })
        continue
      }
    }
    /** The quiet chip of a plumbing permit that was there before the bid. A building permit that is news takes the row's chip instead. */
    let quiet: Chip | null = null
    if (general && listing && !ours && !listing.same && listing.name != null) {
      const day = dayOf(general)
      // How many days before the bid was started the permit is dated. Null when either day is missing: the rule says nothing.
      const before = day && bid.created_at ? daysBetween(day, bid.created_at.slice(0, 10)) : null
      if (before == null || before <= 0) {
        chips.set(bid.id, { words: 'Plumbing permit · another name', tone: 'red' })
        news.push({
          bidId: bid.id,
          kind: 'plumbing',
          title,
          day,
          markLost: sent,
          ...about(general, building),
          words: `A general plumbing permit ${general.stage === 'applied' ? 'was applied for' : 'was issued'} on this address${day ? ` ${shortDay(day)}` : ''}. It lists ${listing.name}. ${sent ? 'The bid is not yet won or lost.' : 'The bid is not sent yet.'}`,
        })
        continue
      }
      if (before <= BEFORE_BID_DAYS) quiet = beforeBidChip(day, todayYmd)
    }
    if (!building) {
      if (quiet) chips.set(bid.id, quiet)
      continue
    }
    const day = dayOf(building)
    const age = daysBetween(day || null, todayYmd)
    const fresh = age != null && age >= 0 && age <= NEWS_DAYS
    if (quiet && !fresh) chips.set(bid.id, quiet)
    else if (!ours) chips.set(bid.id, stageChip(building))
    if (!fresh) continue
    if (building.stage === 'issued') {
      const contact = sent ? agoWords(daysBetween(bid.last_contact ? bid.last_contact.slice(0, 10) : null, todayYmd)) : null
      news.push({ bidId: bid.id, kind: 'issued', title, day, markLost: false, ...about(building, null), words: `The building permit on this address was issued ${shortDay(day)}.${contact ? ` Last contact ${contact}.` : sent ? '' : ' The bid is not sent yet.'}` })
    } else {
      const facts = [shortMoney(building.declared_value) ? `${shortMoney(building.declared_value)} declared` : null, sqFtWords(building.area_sf)].filter(Boolean).join(', ')
      news.push({ bidId: bid.id, kind: 'applied', title, day, markLost: false, ...about(building, null), words: `A permit application was filed on this address ${shortDay(day)}${facts ? `: ${facts}` : ''}.` })
    }
  }
  news.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.day.localeCompare(a.day) || a.title.localeCompare(b.title))
  takenOff.sort((a, b) => b.at.localeCompare(a.at) || a.title.localeCompare(b.title))
  return { chips, news, takenOff }
}

/** "Permit news on your bids". The count sits beside it. */
export const NEWS_TITLE = 'Permit news on your bids'

/** The strip's second, quiet list: the lines on bids that are not the reader's. */
export const OTHERS_NEWS_TITLE = 'Permit news on other people’s bids'

/**
 * The news for one reader (punch list #401): the lines on their own bids, and everyone else's
 * apart. `isMine` is the board's own answer (you estimate it, you manage it, or it was marked for
 * you). The order within each list is the kernel's.
 */
export function newsForReader(news: readonly NewsItem[], isMine: (bidId: string) => boolean): { mine: NewsItem[]; others: NewsItem[] } {
  const mine: NewsItem[] = []
  const others: NewsItem[] = []
  for (const n of news) (isMine(n.bidId) ? mine : others).push(n)
  return { mine, others }
}

/** The second press on a plumbing line of a sent bid. */
export const MARK_LOST_LABEL = 'Mark lost…'

/** One reader's side of the permit news: what is new, what was answered and still stands, and what was taken off a bid. */
export type PermitInboxSide = { fresh: NewsItem[]; standing: NewsItem[]; takenOff: TakenOffPermit[] }

/**
 * The permit news as an inbox (punch list #401): the reader's own bids apart from everyone
 * else's, and on each side the lines nobody has answered apart from the ones that stand. The red
 * count on Followup is `mine.fresh.length`. The order within each list is the kernel's.
 */
export function permitInbox(result: { news: readonly NewsItem[]; takenOff: readonly TakenOffPermit[] }, isMine: (bidId: string) => boolean): { mine: PermitInboxSide; others: PermitInboxSide } {
  const mine: PermitInboxSide = { fresh: [], standing: [], takenOff: [] }
  const others: PermitInboxSide = { fresh: [], standing: [], takenOff: [] }
  for (const n of result.news) {
    const side = isMine(n.bidId) ? mine : others
    ;(n.answered ? side.standing : side.fresh).push(n)
  }
  for (const t of result.takenOff) (isMine(t.bidId) ? mine : others).takenOff.push(t)
  return { mine, others }
}
