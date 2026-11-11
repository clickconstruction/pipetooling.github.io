/**
 * Bids and permits (punch list #307, PR 2 and 3): the words of the two panels in a bid's window.
 * **This site**: the permits we can see on the bid's address, each as one row, with the city's
 * declared value and area beside the bid's own. **What we can see about a GC**: the jobs we
 * priced for them, each with what the city shows on its address. Neither needs a name to match;
 * both stand on `bidSite.ts`. Every line says what we can see, never what a builder did.
 * No React, no Supabase.
 */
import { shortDay, shortMoney, sqFtWords } from './permitResearch'
import { ROBOT_BID_RE } from '../bids/bidPursuit'
import { leadPermit, looksLikeThisJob, permitsOnSite, plumbingListing, plumbingTypeOf, readBidAddress, seenOutOfWords, type BidSite, type BidSitePermit, type PlumbingType } from './bidSite'

/** A permit as `bid_site_permits` returns it. */
export type SitePermitRow = BidSitePermit & {
  permit_number: string
  work_type: string | null
  declared_value: number | null
  area_sf: number | null
  builder_key: string | null
}

/**
 * The order `bid_site_permits` answers in: newest first by the day issued, else applied for, a
 * permit with no day last, then the number, the type and the id. The id makes it one order, so a
 * read cut into pages by id comes back the same way every time.
 */
export function sitePermitOrder(a: SitePermitRow, b: SitePermitRow): number {
  const [dayA, dayB] = [a.issued_on ?? a.submitted_on ?? '', b.issued_on ?? b.submitted_on ?? '']
  if (dayA !== dayB) return dayA < dayB ? 1 : -1
  for (const [x, y] of [[a.permit_number, b.permit_number], [a.permit_type, b.permit_type], [a.id, b.id]] as const) {
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

export type ChipTone = 'green' | 'amber' | 'red' | 'grey' | 'blue'
export type Chip = { words: string; tone: ChipTone }

const PLUMBING_WORDS: Record<PlumbingType, string> = { general: 'Plumbing, general', gas: 'Plumbing, gas', irrigation: 'Plumbing, irrigation', sewer: 'Plumbing, sewer', other: 'Plumbing' }

const dayOf = (p: Pick<BidSitePermit, 'issued_on' | 'submitted_on'>): string | null => p.issued_on ?? p.submitted_on

/** "Applied Sep 11" or "Issued Jun 3". */
export function stageChip(p: Pick<BidSitePermit, 'stage' | 'issued_on' | 'submitted_on' | 'kind'>): Chip {
  const day = dayOf(p)
  const verb = p.stage === 'applied' ? 'Applied' : 'Issued'
  return { words: day ? `${verb} ${shortDay(day)}` : verb, tone: p.stage === 'applied' ? 'amber' : p.kind === 'building' ? 'green' : 'grey' }
}

export type SitePermitLine = { id: string; title: string; chips: Chip[]; detail: string; looksLike: boolean }

/** One permit on the address as a row: what it is, when, and what the feed says of it. */
export function sitePermitLine(p: SitePermitRow, bidProjectName: string | null | undefined): SitePermitLine {
  const plumbing = plumbingTypeOf(p.permit_type)
  const title = plumbing ? PLUMBING_WORDS[plumbing] : (p.work_type ?? p.permit_type.replace(/ Permit$/i, ''))
  const looksLike = p.kind === 'building' && looksLikeThisJob(bidProjectName, p.project_name)
  const chips: Chip[] = []
  if (looksLike) chips.push({ words: 'Looks like this job', tone: 'green' })
  chips.push(stageChip(p))
  const name = p.project_name && !/^Building No:/i.test(p.project_name) ? p.project_name : null
  const money = shortMoney(p.declared_value)
  const parts = [name, money ? `${money} declared` : null, sqFtWords(p.area_sf), p.contact ? `the city lists ${p.contact}` : null]
  if (plumbing && plumbing !== 'general') parts.push('not a general plumbing permit')
  return { id: p.id, title, chips, detail: parts.filter(Boolean).join(' · '), looksLike }
}

/** The rows of the site's list: the one that looks like this job first, then the newest. */
export function sitePermitLines(onSite: readonly SitePermitRow[], bidProjectName: string | null | undefined): SitePermitLine[] {
  return [...onSite]
    .sort((a, b) => (dayOf(b) ?? '').localeCompare(dayOf(a) ?? ''))
    .map((p) => sitePermitLine(p, bidProjectName))
    .sort((a, b) => Number(b.looksLike) - Number(a.looksLike))
}

/** "3 permits we can see on 4120 Mill Street". */
export function siteCountWords(count: number, street: string): string {
  return `${count} permit${count === 1 ? '' : 's'} we can see on ${street}`
}

export type SiteTile = { label: string; value: string; note: string | null }

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/**
 * The city's numbers beside ours: the declared value and the area on the permit the verdict
 * speaks of, and the bid's own value as a share of the declared one. A plumbing bid at a third
 * of the declared value says something is misread. Empty when the permit declares neither.
 */
export function siteTiles(onSite: readonly SitePermitRow[], bidProjectName: string | null | undefined, bidValue: number | null): SiteTile[] {
  const lead = leadPermit(bidProjectName, onSite)
  if (!lead || lead.kind !== 'building') return []
  const tiles: SiteTile[] = []
  const declared = lead.declared_value != null && lead.declared_value > 0 ? lead.declared_value : null
  if (declared != null) tiles.push({ label: 'Declared value, by the applicant', value: usd0.format(declared), note: null })
  const area = sqFtWords(lead.area_sf)
  if (area) tiles.push({ label: 'Area on the permit', value: area, note: null })
  if (tiles.length === 0) return []
  if (bidValue != null && Number.isFinite(bidValue) && bidValue > 0) {
    const share = declared != null ? (bidValue / declared) * 100 : null
    const pct = share == null ? null : share >= 10 ? `${Math.round(share)}%` : `${share.toFixed(1).replace(/\.0$/, '')}%`
    tiles.push({ label: 'Your bid', value: usd0.format(bidValue), note: pct ? `${pct} of the declared value` : null })
  }
  return tiles
}

/** A bid as the GC's panel reads it. */
export type GcBid = {
  id: string
  bid_number: string | null
  project_name: string | null
  address: string | null
  outcome: string | null
  bid_date_sent: string | null
}

export type GcJobLine = { bidId: string; title: string; chip: Chip; detail: string; current: boolean }

export type GcJobsView = {
  /** The bids that are street addresses in a city we read, the bid in hand first, then the newest. */
  lines: GcJobLine[]
  /** The cities those bids sit in, in the order the cities are read. */
  cities: string[]
  /** How many different sites those are. */
  sites: number
  sitesWithPermit: number
  sitesWithGeneralPlumbing: number
  /** "Of the 5 sites we can see, 4 have a permit. A general plumbing permit lists another name on 1." Null with no site. */
  verdict: string | null
  /** "5 of your 12 bids with them". */
  coverage: string
  /** "7 more bids with them are in Kyle, Austin and New Braunfels. No permit records are read there." Null when none. */
  elsewhere: string | null
  /** "2 more have no street address we can look up." Null when none. */
  unreadable: string | null
}

function statusWords(bid: GcBid, current: boolean): string {
  if (current) return 'This bid'
  if (bid.outcome === 'won' || bid.outcome === 'started_or_complete') return 'Won'
  if (bid.outcome === 'lost') return 'Lost'
  return bid.bid_date_sent ? `Sent ${shortDay(bid.bid_date_sent.slice(0, 10))}` : 'Unsent'
}

function listWords(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const titleCase = (town: string): string => town.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())

const siteKey = (site: Extract<BidSite, { kind: 'site' }>): string => `${site.city}|${site.canon.number}|${site.canon.words.join(' ')}`

/** The house numbers to ask a city's permits for, per city, for a set of bids. The robots' copies are left out. */
export function numbersToAsk(bids: readonly Pick<GcBid, 'address' | 'project_name'>[], readCities: readonly string[]): Map<string, string[]> {
  const out = new Map<string, Set<string>>()
  for (const b of bids) {
    if (ROBOT_BID_RE.test(b.project_name ?? '')) continue
    const site = readBidAddress(b.address, readCities)
    if (site.kind !== 'site') continue
    if (!out.has(site.city)) out.set(site.city, new Set())
    out.get(site.city)?.add(site.number)
  }
  return new Map([...out].map(([city, set]) => [city, [...set]]))
}

/**
 * The jobs we priced for one GC, each with what the city shows on its address. `permitsByCity`
 * is `bid_site_permits`' answer per city. A robot's copy of a bid is not a job we priced.
 */
export function gcJobsView(bids: readonly GcBid[], permitsByCity: ReadonlyMap<string, readonly SitePermitRow[]>, readCities: readonly string[], currentBidId: string | null): GcJobsView {
  const ours = bids.filter((b) => !ROBOT_BID_RE.test(b.project_name ?? ''))
  const lines: Array<GcJobLine & { day: string }> = []
  const inCities = new Set<string>()
  const seen = new Map<string, { permit: boolean; plumbing: boolean }>()
  const towns = new Map<string, number>()
  let elsewhereCount = 0
  let unreadableCount = 0
  for (const bid of ours) {
    const site = readBidAddress(bid.address, readCities)
    if (site.kind === 'unreadable') {
      unreadableCount += 1
      continue
    }
    if (site.kind === 'not_read') {
      elsewhereCount += 1
      if (site.town) {
        const town = titleCase(site.town)
        towns.set(town, (towns.get(town) ?? 0) + 1)
      }
      continue
    }
    inCities.add(site.city)
    const onSite = permitsOnSite(site, permitsByCity.get(site.city) ?? [])
    const general = [...onSite].sort((a, b) => (dayOf(b) ?? '').localeCompare(dayOf(a) ?? '')).find((p) => plumbingTypeOf(p.permit_type) === 'general') ?? null
    const lead = leadPermit(bid.project_name, onSite)
    const current = bid.id === currentBidId
    const generalDay = general ? dayOf(general) : null
    const listing = general ? plumbingListing(general, lead && lead.kind === 'building' ? lead : null) : null
    // Only a plumbing permit that lists someone other than the building permit's own contact names a plumber.
    const anotherName = listing != null && !listing.same && listing.name != null
    const chip: Chip = anotherName ? { words: 'Plumbing permit · another name', tone: 'red' } : lead && lead.kind === 'building' ? stageChip(lead) : onSite.length > 0 ? { words: 'No building permit seen', tone: 'grey' } : { words: 'None seen', tone: 'grey' }
    const plumbingWords = general && listing
      ? `a general plumbing permit${generalDay ? `, ${shortDay(generalDay)},` : ''} ${listing.same ? 'is under the building permit’s own name' : listing.name ? `lists ${listing.name}` : 'is on the address'}`
      : onSite.length > 0
        ? 'no general plumbing permit seen'
        : 'no permit seen on the address'
    lines.push({
      bidId: bid.id,
      title: [bid.bid_number?.trim() || null, bid.project_name ?? 'A bid'].filter(Boolean).join(' · '),
      chip,
      detail: `${statusWords(bid, current)} · ${plumbingWords}`,
      current,
      day: bid.bid_date_sent ?? '',
    })
    const key = siteKey(site)
    const was = seen.get(key) ?? { permit: false, plumbing: false }
    seen.set(key, { permit: was.permit || onSite.length > 0, plumbing: was.plumbing || anotherName })
  }
  lines.sort((a, b) => Number(b.current) - Number(a.current) || b.day.localeCompare(a.day))
  const sites = seen.size
  const sitesWithPermit = [...seen.values()].filter((s) => s.permit).length
  const sitesWithGeneralPlumbing = [...seen.values()].filter((s) => s.plumbing).length
  const plumbingSentence = sitesWithGeneralPlumbing === 0 ? 'No general plumbing permit under another name seen.' : `A general plumbing permit lists another name on ${sitesWithGeneralPlumbing}.`
  const townNames = [...towns].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t)
  const shown = townNames.slice(0, 3)
  const townWords = shown.length === 0 ? 'other towns' : townNames.length > 3 ? `${shown.join(', ')} and other towns` : listWords(shown)
  return {
    lines: lines.map(({ day: _day, ...line }) => line),
    cities: readCities.filter((c) => inCities.has(c)),
    sites,
    sitesWithPermit,
    sitesWithGeneralPlumbing,
    verdict: sites === 0 ? null : `${seenOutOfWords(sitesWithPermit, sites)} ${plumbingSentence}`,
    coverage: `${lines.length} of your ${ours.length} bid${ours.length === 1 ? '' : 's'} with them`,
    elsewhere: elsewhereCount === 0 ? null : `${elsewhereCount} more bid${elsewhereCount === 1 ? '' : 's'} with them ${elsewhereCount === 1 ? 'is' : 'are'} in ${townWords}. No permit records are read there.`,
    unreadable: unreadableCount === 0 ? null : `${unreadableCount} more ${unreadableCount === 1 ? 'has' : 'have'} no street address we can look up.`,
  }
}
