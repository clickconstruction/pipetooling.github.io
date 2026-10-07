/**
 * GC mode design spike: too many trades in one place, the Gantt's G-83 (mock-up
 * `to-dos/gc-mode/mockups/G-83.md`). A bar's place is a plain word the office keeps on it: Roof,
 * Inside, Site, Level 2. Where one can be made, a guess comes from the bar's name, its trade or its
 * stage. A guess is shown as a guess and counts for nothing until the office keeps it, so a job with
 * no place kept is flagged nowhere.
 *
 * With places kept, a day with TRADES_IN_ONE_PLACE trades or more in one place is too many. It is
 * counted by the day, by the plan's own dates as G-84 counts people, from today on, and flagged by
 * the week: on the chart's lane, before a move saves, on the morning list and on the call list. The
 * people said beside it are G-84's numbers (`crewNumbers`), never a second rule.
 *
 * Its own file, out of the barrel: the reducer, the Schedule tab, the morning list and the call list read it.
 */
import type { GcProject, GcState, TradePackage } from './gcTypes'
import { addDays } from './gcBuilding'
import { mondayOf, scheduleItems } from './gcBuildingSchedule'
import { ASSUMED_CREW, crewNumbers, type CountFrom } from './gcPeopleOnSite'
import { crewCountsNow, crewWeeks } from './gcCrewCounts'
import { partnerById } from './gcLookups'
import { shortDate, weekdayDate } from './gcWords'
import { pWeekday, type PortalLang } from './gcPortalI18n'
import type { MorningList } from './gcMorningList'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { PlaceRow } from '../gc/schedule/places'
import { TRADES_IN_ONE_PLACE, keptPlaces, takesPlace } from '../gc/schedule/places'
export type { CrowdingChange, PlaceChange, PlaceFrom, PlaceGuess, PlaceRow } from '../gc/schedule/places'
export { PLACE_MAX, PLACE_RULE, TRADES_IN_ONE_PLACE, cleanPlace, crowdingAfterMove, keptPlaces, placeChanges, placeGuess, placeProblem, placeRows, placesLogWords, takesPlace, withPlaces } from '../gc/schedule/places'

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
// ---------------------------------------------------------------------------------------------
// Too many in one place
// ---------------------------------------------------------------------------------------------

/** A trade in a crowded place. */
export interface CrowdedTrade {
  packageId: string
  partnerId: string | null
  /** "Pecan Valley Electric", or "our own crew" inside a sentence. */
  company: string
  trade: string
  /** G-84's number for the week, and where it came from. */
  count: number
  from: CountFrom
  /** Its first bar in the place on the crowded days: what the call list opens. */
  lineId: string
}
/** One place flagged in one week. */
export interface CrowdedWeek {
  place: string
  /** Monday. */
  weekOf: string
  /** The first and the last crowded day that week, from today on. */
  from: string
  to: string
  /** The most trades in the place on one day. */
  most: number
  /** Every crowded day that week has the most: "3 trades at once". Not: "up to 4 trades at once". */
  even: boolean
  /** Every trade in the place on its crowded days, in the job's trade order. */
  trades: CrowdedTrade[]
  /** People a day on the busiest crowded day, by G-84's numbers. */
  people: number
  /** "Inside has 3 trades at once, Mon Oct 5 to Fri Oct 9." */
  words: string
  /** The lane's hover card, in G-84's look: one company a line under Who. */
  rows: { label: string; lines: string[] }[]
}
function companyOf(state: GcState, pkg: TradePackage): { company: string; partnerId: string | null } {
  if (pkg.selfPerform) return { company: 'our own crew', partnerId: null }
  const partnerId = pkg.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId ?? null
  return { company: (partnerId ? partnerById(state, partnerId)?.company : undefined) ?? pkg.trade, partnerId }
}
/** "Mon Oct 5 to Fri Oct 9", or one day: "Fri Oct 2". */
function spanWords(from: string, to: string): string {
  return from === to ? weekdayDate(from) : `${weekdayDate(from)} to ${weekdayDate(to)}`
}
/** "3 trades", or "up to 4 trades" when the days it covers do not all have that many. */
function tradesWords(most: number, even: boolean): string {
  return `${even ? '' : 'up to '}${most} trades`
}
function andList(words: string[], and = 'and'): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} ${and} ${words[words.length - 1]}`
}
/** Each place's crowded days from today on: the trades there that day, each with its first bar there. */
function crowdedDays(state: GcState, project: GcProject): Map<string, { day: string; trades: Map<string, string> }[]> {
  const out = new Map<string, { day: string; trades: Map<string, string> }[]>()
  const places = keptPlaces(project)
  if (places.size === 0) return out
  // A trade is in a place on a day by the plan's own dates, as G-84 counts people: a late bar does not fill every week ahead.
  const items = scheduleItems(state, project).filter((it) => it.pkg && takesPlace(it.activity) && it.actual < 100 && places.has(it.activity.lineId))
  const last = items.reduce((m, it) => (it.activity.finish > m ? it.activity.finish : m), '')
  for (let day = state.today; day <= last; day = addDays(day, 1)) {
    const here = new Map<string, Map<string, string>>()
    for (const it of items) {
      const a = it.activity
      const place = places.get(a.lineId)
      if (!place || !it.pkg || a.start > day || day > a.finish) continue
      const trades = here.get(place) ?? new Map<string, string>()
      if (!trades.has(it.pkg.id)) trades.set(it.pkg.id, a.lineId)
      here.set(place, trades)
    }
    for (const [place, trades] of here) {
      if (trades.size < TRADES_IN_ONE_PLACE) continue
      out.set(place, [...(out.get(place) ?? []), { day, trades }])
    }
  }
  return out
}
/** Every place and week with too many trades, by week, then by its first crowded day. Empty with no place kept. */
export function crowdedWeeks(state: GcState, project: GcProject): CrowdedWeek[] {
  const byPlace = crowdedDays(state, project)
  if (byPlace.size === 0) return []
  const numberOf = crewNumbers(state, project, crewCountsNow(project))
  const order = new Map(project.packages.map((k, i) => [k.id, i]))
  const out: CrowdedWeek[] = []
  for (const [place, days] of byPlace) {
    const weeks = new Map<string, typeof days>()
    for (const d of days) weeks.set(mondayOf(d.day), [...(weeks.get(mondayOf(d.day)) ?? []), d])
    for (const [weekOf, wd] of weeks) {
      const first = new Map<string, string>()
      for (const d of wd) for (const [id, lineId] of d.trades) if (!first.has(id)) first.set(id, lineId)
      const ids = [...first.keys()].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
      const trades = ids.flatMap((id): CrowdedTrade[] => {
        const pkg = project.packages.find((k) => k.id === id)
        if (!pkg) return []
        const n = numberOf(id, weekOf)
        return [{ packageId: id, ...companyOf(state, pkg), trade: pkg.trade, count: n.count, from: n.from, lineId: first.get(id) ?? '' }]
      })
      const count = new Map(trades.map((t) => [t.packageId, t.count]))
      const most = Math.max(...wd.map((d) => d.trades.size))
      const even = wd.every((d) => d.trades.size === most)
      const people = Math.max(...wd.map((d) => [...d.trades.keys()].reduce((n, id) => n + (count.get(id) ?? 0), 0)))
      const from = wd[0]?.day ?? weekOf
      const to = wd[wd.length - 1]?.day ?? weekOf
      const words = from === to ? `${place} has ${most} trades at once on ${weekdayDate(from)}.` : `${place} has ${tradesWords(most, even)} at once, ${spanWords(from, to)}.`
      const rows = [
        { label: 'Where', lines: [place] },
        { label: 'When', lines: [`${spanWords(from, to)}, ${tradesWords(most, even)} at once.`] },
        { label: 'Who', lines: trades.map((t) => `${cap(t.company)} ${t.count}${t.from === 'told' ? ', its own count' : t.from === 'assumed' ? ', assumed' : ''}`) },
        { label: 'People', lines: [`About ${people} a day.`, `A trade's own count for the week comes first, then the daily log's last count, then ${ASSUMED_CREW}.`] },
        { label: 'Rule', lines: [`${TRADES_IN_ONE_PLACE} trades or more in one place on the same day is too many.`] },
      ]
      out.push({ place, weekOf, from, to, most, even, trades, people, words, rows })
    }
  }
  return out.sort((a, b) => a.weekOf.localeCompare(b.weekOf) || a.from.localeCompare(b.from) || a.place.localeCompare(b.place))
}
/** The places with a flagged week, in the order they first come: the chart's lane has a row for each. */
export function crowdedPlaces(weeks: CrowdedWeek[]): string[] {
  return [...new Set(weeks.map((w) => w.place))]
}
/** Flagged weeks of one place run together, back to back: the lane labels each run once, and the card says it. */
export interface CrowdedSpell {
  place: string
  from: string
  to: string
  most: number
}
export function crowdedSpells(weeks: CrowdedWeek[]): CrowdedSpell[] {
  const out: CrowdedSpell[] = []
  for (const place of crowdedPlaces(weeks)) {
    let run: CrowdedSpell | null = null
    for (const w of weeks.filter((x) => x.place === place)) {
      if (run && addDays(run.to, 1) === w.from) {
        run.to = w.to
        run.most = Math.max(run.most, w.most)
      } else {
        if (run) out.push(run)
        run = { place, from: w.from, to: w.to, most: w.most }
      }
    }
    if (run) out.push(run)
  }
  return out.sort((a, b) => a.from.localeCompare(b.from) || a.place.localeCompare(b.place))
}
/** The card's lines: how many bars have a place or a guess, then each run of too many. */
export function placesSummary(rows: PlaceRow[], weeks: CrowdedWeek[]): { words: string; crowded: boolean }[] {
  const kept = rows.filter((r) => r.kept).length
  const guessed = rows.filter((r) => !r.kept && r.guess).length
  const none = rows.length - kept - guessed
  const bars = (n: number) => `${n} ${n === 1 ? 'bar' : 'bars'}`
  const has = (n: number) => (n === 1 ? 'has' : 'have')
  const out: { words: string; crowded: boolean }[] = []
  if (rows.length === 0) out.push({ words: 'Every bar is done.', crowded: false })
  else if (kept === 0)
    out.push({
      words: guessed > 0 ? `${bars(guessed)} not done ${has(guessed)} a guessed place${none > 0 ? `, and ${none} ${has(none)} none` : ''}.` : `${bars(none)} not done ${has(none)} no place yet.`,
      crowded: false,
    })
  else {
    out.push({ words: `${bars(kept)} ${has(kept)} a place.`, crowded: false })
    if (guessed > 0) out.push({ words: `${guessed} more ${has(guessed)} a guess.`, crowded: false })
    if (none > 0) out.push({ words: `${none} ${has(none)} none.`, crowded: false })
  }
  for (const s of crowdedSpells(weeks)) out.push({ words: s.from === s.to ? `${s.place} has too many on ${weekdayDate(s.from)}.` : `${s.place} has too many from ${weekdayDate(s.from)} to ${weekdayDate(s.to)}.`, crowded: true })
  return out
}
/** The morning list's lines (G-118): each place with too many trades on the list's day, from its own companies and their bars not held. */
export function morningCrowding(project: GcProject, list: MorningList, today: string): string[] {
  const places = keptPlaces(project)
  if (places.size === 0) return []
  const here = new Map<string, string[]>()
  for (const c of list.expected) {
    const seen = new Set<string>()
    for (const b of c.bars) {
      const place = places.get(b.lineId)
      if (b.held || !place || seen.has(place)) continue
      seen.add(place)
      here.set(place, [...(here.get(place) ?? []), c.pkg.selfPerform ? 'our own crew' : c.company])
    }
  }
  const when = list.day === today ? 'today' : `on ${weekdayDate(list.day)}`
  return [...here].filter(([, names]) => names.length >= TRADES_IN_ONE_PLACE).map(([place, names]) => `${place} has ${names.length} trades at once ${when}. They are ${andList(names)}.`)
}
/** A line on the call list (G-115): a hired company in a crowded week of the look-ahead that has not said how many people it will have (G-142). */
export interface CrowdedCall {
  partnerId: string
  packageId: string
  trade: string
  place: string
  from: string
  to: string
  lineId: string
  text: string
  tone: 'amber' | 'grey'
  /** The Follow up sheet's words for a message, in the company's language. */
  words: Record<PortalLang, { about: string; detail: string; ask: string }>
}
export function crowdedCalls(state: GcState, project: GcProject): CrowdedCall[] {
  if (project.stage !== 'building') return []
  // The weeks a trade can give its count for: this week and the next two (G-142).
  const asks = new Set(crewWeeks(state.today))
  const weeks = crowdedWeeks(state, project).filter((w) => asks.has(w.weekOf))
  if (weeks.length === 0) return []
  const said = new Set(crewCountsNow(project).map((c) => `${c.packageId}|${c.weekOf}`))
  const nextWeek = addDays(mondayOf(state.today), 7)
  const out: CrowdedCall[] = []
  for (const place of crowdedPlaces(weeks)) {
    const inPlace = weeks.filter((w) => w.place === place)
    const ids = [...new Set(inPlace.flatMap((w) => w.trades.map((t) => t.packageId)))]
    for (const id of ids) {
      const mine = inPlace.filter((w) => w.trades.some((t) => t.packageId === id))
      const me = mine[0]?.trades.find((t) => t.packageId === id)
      const firstWeek = mine[0]
      const lastWeek = mine[mine.length - 1]
      if (!me || !me.partnerId || !firstWeek || !lastWeek) continue
      const unsaid = mine.filter((w) => !said.has(`${id}|${w.weekOf}`))
      const firstUnsaid = unsaid[0]
      if (!firstUnsaid) continue
      const from = firstWeek.from
      const to = lastWeek.to
      const most = Math.max(...mine.map((w) => w.most))
      const evenAll = mine.every((w) => w.even && w.most === most)
      const many = tradesWords(most, evenAll)
      const others = [...new Map(mine.flatMap((w) => w.trades.filter((t) => t.packageId !== id)).map((t) => [t.packageId, t])).values()]
      const be = others.length === 1 ? 'is' : 'are'
      const notSaid = unsaid.length === mine.length ? 'They have not said how many people a day.' : `They have not said how many people a day the week of ${shortDate(firstUnsaid.weekOf)}.`
      const at = from === to ? `on ${weekdayDate(from)}` : `from ${weekdayDate(from)} to ${weekdayDate(to)}`
      const atEs = from === to ? `el ${pWeekday('es', from)}` : `del ${pWeekday('es', from)} al ${pWeekday('es', to)}`
      const othersEs = andList(others.map((t) => (t.partnerId ? t.company : 'nuestra propia cuadrilla')), 'y')
      out.push({
        partnerId: me.partnerId,
        packageId: id,
        trade: me.trade,
        place,
        from,
        to,
        lineId: me.lineId,
        text: `${place} has ${many} at once, ${spanWords(from, to)}. With them ${be} ${andList(others.map((t) => t.company))}. ${notSaid}`,
        tone: firstUnsaid.weekOf <= nextWeek ? 'amber' : 'grey',
        words: {
          en: {
            about: `how many people you will have on ${project.name} from ${shortDate(from)}`,
            detail: `${place} has ${many} at once ${at}. With you ${be} ${andList(others.map((t) => t.company))}`,
            ask: 'How many people a day will you have there? You can tell us in your portal.',
          },
          es: {
            about: `cuántas personas tendrá en ${project.name} desde el ${pWeekday('es', from)}`,
            detail: `${place} tiene ${evenAll ? '' : 'hasta '}${most} oficios al mismo tiempo ${atEs}. Con ustedes ${others.length === 1 ? 'está' : 'están'} ${othersEs}`,
            ask: '¿Cuántas personas al día tendrá ahí? Nos puede avisar en su portal.',
          },
        },
      })
    }
  }
  return out
}
