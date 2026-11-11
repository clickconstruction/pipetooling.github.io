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

/** A bid as the board's news reads it. */
export type NewsBid = {
  id: string
  bid_number: string | null
  project_name: string | null
  address: string | null
  outcome: string | null
  bid_date_sent: string | null
  last_contact?: string | null
}

export type NewsKind = 'plumbing' | 'ours' | 'issued' | 'applied'
/** `markLost`: the line offers Mark lost…, a sent bid with a general plumbing permit that lists another name. The press opens the board's outcome and the news marks nothing. */
export type NewsItem = { bidId: string; kind: NewsKind; title: string; words: string; day: string; markLost: boolean }

/** How long an issued permit or a new application stays news. A plumbing permit under another name stays while the bid is undecided. */
export const NEWS_DAYS = 30

const KIND_ORDER: Record<NewsKind, number> = { plumbing: 0, ours: 1, issued: 2, applied: 3 }

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
 */
export function bidPermitNews(bids: readonly NewsBid[], permitsByCity: ReadonlyMap<string, readonly SitePermitRow[]>, readCities: readonly string[], todayYmd: string, ourKeys: OurNameKeys = NO_OUR_KEYS): { chips: Map<string, Chip>; news: NewsItem[] } {
  const chips = new Map<string, Chip>()
  const news: NewsItem[] = []
  for (const bid of bids) {
    if (bid.outcome != null || ROBOT_BID_RE.test(bid.project_name ?? '')) continue
    const site = readBidAddress(bid.address, readCities)
    if (site.kind !== 'site') continue
    const onSite = permitsOnSite(site, permitsByCity.get(site.city) ?? [])
    if (onSite.length === 0) continue
    const lead = leadPermit(bid.project_name, onSite)
    const building = lead && lead.kind === 'building' ? lead : null
    const general = [...onSite].sort((a, b) => dayOf(b).localeCompare(dayOf(a))).find((p) => plumbingTypeOf(p.permit_type) === 'general') ?? null
    const listing = general ? plumbingListing(general, building, ourKeys) : null
    const title = [bid.bid_number?.trim() || null, bid.project_name ?? 'A bid'].filter(Boolean).join(' · ')
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
          words: `A general plumbing permit that lists us ${general.stage === 'applied' ? 'was applied for' : 'was issued'} on this address ${shortDay(day, todayYmd)}, as ${listing.name}. ${sent ? 'The bid is not yet won or lost.' : 'The bid is not sent yet.'}`,
        })
        continue
      }
    }
    if (general && listing && !ours && !listing.same && listing.name != null) {
      chips.set(bid.id, { words: 'Plumbing permit · another name', tone: 'red' })
      const day = dayOf(general)
      news.push({
        bidId: bid.id,
        kind: 'plumbing',
        title,
        day,
        markLost: sent,
        words: `A general plumbing permit ${general.stage === 'applied' ? 'was applied for' : 'was issued'} on this address${day ? ` ${shortDay(day)}` : ''}. It lists ${listing.name}. ${sent ? 'The bid is not yet won or lost.' : 'The bid is not sent yet.'}`,
      })
      continue
    }
    if (!building) continue
    if (!ours) chips.set(bid.id, stageChip(building))
    const day = dayOf(building)
    const age = daysBetween(day || null, todayYmd)
    if (age == null || age < 0 || age > NEWS_DAYS) continue
    if (building.stage === 'issued') {
      const contact = sent ? agoWords(daysBetween(bid.last_contact ? bid.last_contact.slice(0, 10) : null, todayYmd)) : null
      news.push({ bidId: bid.id, kind: 'issued', title, day, markLost: false, words: `The building permit on this address was issued ${shortDay(day)}.${contact ? ` Last contact ${contact}.` : sent ? '' : ' The bid is not sent yet.'}` })
    } else {
      const facts = [shortMoney(building.declared_value) ? `${shortMoney(building.declared_value)} declared` : null, sqFtWords(building.area_sf)].filter(Boolean).join(', ')
      news.push({ bidId: bid.id, kind: 'applied', title, day, markLost: false, words: `A permit application was filed on this address ${shortDay(day)}${facts ? `: ${facts}` : ''}.` })
    }
  }
  news.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.day.localeCompare(a.day) || a.title.localeCompare(b.title))
  return { chips, news }
}

/** "Permit news on your bids". The count sits beside it. */
export const NEWS_TITLE = 'Permit news on your bids'

/** The second press on a plumbing line of a sent bid. */
export const MARK_LOST_LABEL = 'Mark lost…'
