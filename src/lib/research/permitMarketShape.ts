/**
 * Permits, Market: who holds the work and how much is being built (punch list #405, step two).
 * The first reads the plumbers a city's permits name and how tied each builder is to one. It is
 * drawn only where the permits name plumbers. The second counts a city's commercial permits by
 * month, by kind and by size. Every count is defined on the card
 * (`to-dos/permits-market-page/README.md`, How each number is counted). A sentence here marks
 * each count and amount in it with `val` (values in place), and the screen draws it with
 * `ValueSentence`. No React, no Supabase.
 */
import { nameKey } from '../../../supabase/functions/_shared/permitLookup'
import { shortMoney, type ResearchPermitRow } from './permitResearch'
import { builderNameOfPermit } from './permitBuilders'
import { marketPermitsSince, type MarketPermit } from './permitMarket'
import { valuesReliable } from './permitCallList'
import { val } from '../valuesInPlace'

// ---------- who holds the work ----------

type NamedJob = Pick<ResearchPermitRow, 'filed_on' | 'plumber' | 'builder_key' | 'builder_name' | 'contact'>

/** The building permits of twelve months whose plumbing permit names a plumber. */
function namedJobs<T extends NamedJob>(rows: readonly T[], todayYmd: string): T[] {
  const since = marketPermitsSince(todayYmd)
  return rows.filter((r) => (r.plumber ?? '').trim() !== '' && r.filed_on != null && r.filed_on >= since)
}

/** The spelling a name is written in most, the first seen on a tie. */
function mostUsed(names: ReadonlyMap<string, number>): string {
  let best = ''
  let n = 0
  for (const [name, count] of names) {
    if (count > n) {
      best = name
      n = count
    }
  }
  return best
}

export type PlumberJobs = { key: string; name: string; jobs: number }

/** The plumbers by the jobs their names are on, the most first, with the rest as one line. */
export type PlumberBoard = { jobs: number; top: PlumberJobs[]; others: { plumbers: number; jobs: number } }

/**
 * The plumbers a city's permits name, by jobs. Two spellings of one keyed name are one plumber.
 * `top` is how many are listed by name.
 */
export function plumbersByJobs(rows: readonly NamedJob[], todayYmd: string, top = 5): PlumberBoard {
  const byKey = new Map<string, { names: Map<string, number>; jobs: number }>()
  const named = namedJobs(rows, todayYmd)
  for (const r of named) {
    const plumber = (r.plumber ?? '').trim()
    const key = nameKey(plumber) ?? plumber.toLowerCase()
    const p = byKey.get(key) ?? { names: new Map<string, number>(), jobs: 0 }
    byKey.set(key, p)
    p.jobs += 1
    p.names.set(plumber, (p.names.get(plumber) ?? 0) + 1)
  }
  const all = [...byKey.entries()].map(([key, p]) => ({ key, name: mostUsed(p.names), jobs: p.jobs })).sort((a, b) => b.jobs - a.jobs || a.name.localeCompare(b.name))
  const rest = all.slice(top)
  return { jobs: named.length, top: all.slice(0, top), others: { plumbers: rest.length, jobs: rest.reduce((n, p) => n + p.jobs, 0) } }
}

/** How tied a builder is to one plumber. */
export type BuilderTie = 'uses_one' | 'leans' | 'shops'

/** A builder is judged from this many jobs with a named plumber. */
export const TIE_MIN_JOBS = 3

/** One plumber on three in four of a builder's named jobs uses one, on half leans, on fewer shops around. */
export function tieOf(topJobs: number, namedJobCount: number): BuilderTie {
  if (topJobs * 4 >= namedJobCount * 3) return 'uses_one'
  return topJobs * 2 >= namedJobCount ? 'leans' : 'shops'
}

export type BuilderTies = {
  /** Builders with three or more named jobs. */
  judged: number
  usesOne: number
  leans: number
  shops: number
  /** The builders that shop around, the most named jobs first: the open doors. */
  shoppers: Array<{ key: string; name: string; jobs: number; plumbers: number }>
}

/** Of the builders with three or more named jobs, how many use one plumber, lean to one, or shop around. */
export function builderTies(rows: readonly NamedJob[], todayYmd: string): BuilderTies {
  const byBuilder = new Map<string, { name: string; jobs: number; plumbers: Map<string, number> }>()
  for (const r of namedJobs(rows, todayYmd)) {
    if (!r.builder_key) continue
    const plumber = (r.plumber ?? '').trim()
    const b = byBuilder.get(r.builder_key) ?? { name: builderNameOfPermit(r) ?? r.builder_key, jobs: 0, plumbers: new Map<string, number>() }
    byBuilder.set(r.builder_key, b)
    b.jobs += 1
    const key = nameKey(plumber) ?? plumber.toLowerCase()
    b.plumbers.set(key, (b.plumbers.get(key) ?? 0) + 1)
  }
  const out: BuilderTies = { judged: 0, usesOne: 0, leans: 0, shops: 0, shoppers: [] }
  for (const [key, b] of byBuilder) {
    if (b.jobs < TIE_MIN_JOBS) continue
    out.judged += 1
    const tie = tieOf(Math.max(...b.plumbers.values()), b.jobs)
    if (tie === 'uses_one') out.usesOne += 1
    else if (tie === 'leans') out.leans += 1
    else {
      out.shops += 1
      out.shoppers.push({ key, name: b.name, jobs: b.jobs, plumbers: b.plumbers.size })
    }
  }
  out.shoppers.sort((a, b) => b.jobs - a.jobs || a.name.localeCompare(b.name))
  return out
}

/** The note under the plumbers: how the builders split, and that the ones who shop around are the open doors. */
export function builderTiesWords(t: BuilderTies): string {
  if (t.judged === 0) return `No builder has ${TIE_MIN_JOBS} or more jobs with a named plumber yet, so none can be judged.`
  const builders = `Of ${val('judged', `${t.judged} builder${t.judged === 1 ? '' : 's'}`)} with ${TIE_MIN_JOBS} or more named jobs`
  const split = `${val('uses_one', String(t.usesOne))} use${t.usesOne === 1 ? 's' : ''} one plumber nearly every time, ${val('leans', String(t.leans))} lean${t.leans === 1 ? 's' : ''} to one and ${val('shops', String(t.shops))} shop${t.shops === 1 ? 's' : ''} around.`
  return `${builders}: ${split}${t.shops > 0 ? ' The ones that shop around are the open doors.' : ''}`
}

// ---------- how much is being built ----------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const dayOf = (p: Pick<MarketPermit, 'issued_on' | 'submitted_on'>): string | null => p.issued_on ?? p.submitted_on

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number) as [number, number]
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export type MonthCount = { ym: string; label: string; n: number }

/**
 * Commercial permits a month, over the whole months the records cover: from the month after the
 * window's first day, or after the day the city's records start, up to last month. This month
 * is still filling and is left out.
 */
export function permitsByMonth(permits: readonly Pick<MarketPermit, 'issued_on' | 'submitted_on'>[], todayYmd: string, recordsStartYmd: string | null): MonthCount[] {
  const since = marketPermitsSince(todayYmd)
  const from = recordsStartYmd && recordsStartYmd > since ? recordsStartYmd : since
  // A window that opens on the first of a month holds that month whole.
  const first = from.slice(8) === '01' ? from.slice(0, 7) : nextMonth(from.slice(0, 7))
  const current = todayYmd.slice(0, 7)
  const counts = new Map<string, number>()
  for (const p of permits) {
    const day = dayOf(p)
    if (day) counts.set(day.slice(0, 7), (counts.get(day.slice(0, 7)) ?? 0) + 1)
  }
  const out: MonthCount[] = []
  for (let ym = first; ym < current; ym = nextMonth(ym)) out.push({ ym, label: MONTHS[Number(ym.slice(5)) - 1] ?? ym, n: counts.get(ym) ?? 0 })
  return out
}

export type KindCount = { kind: string; n: number }

/** The permits by kind, the most first: an application is its own kind, and an issued permit is the work it names. */
export function permitsByKind(permits: readonly Pick<MarketPermit, 'stage' | 'work_type'>[]): KindCount[] {
  const counts = new Map<string, number>()
  for (const p of permits) {
    const kind = p.stage === 'applied' ? 'Applications' : (p.work_type ?? '').trim() || 'Other'
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  return [...counts.entries()].map(([kind, n]) => ({ kind, n })).sort((a, b) => b.n - a.n || a.kind.localeCompare(b.kind))
}

/** How big: of the permits that carry a value, how many are $250k or more and $1M or more, and the middle one. */
export type ValueBands = { valued: number; ge250k: number; ge1m: number; median: number }

/** Null where too few permits carry a value, or where the city's values cannot be trusted. */
export function valueBands(permits: readonly Pick<MarketPermit, 'declared_value'>[]): ValueBands | null {
  if (!valuesReliable(permits)) return null
  const values = permits.map((p) => p.declared_value).filter((v): v is number => v != null && Number.isFinite(v) && v > 0).sort((a, b) => a - b)
  const mid = (values.length - 1) / 2
  const median = ((values[Math.floor(mid)] ?? 0) + (values[Math.ceil(mid)] ?? 0)) / 2
  return { valued: values.length, ge250k: values.filter((v) => v >= 250_000).length, ge1m: values.filter((v) => v >= 1_000_000).length, median }
}

/** "Of 2,000 with a value on the permit: 1,200 are $250k or more, 800 are $1M or more. The middle one is $450k." */
export function valueBandsWords(b: ValueBands): string {
  const n = (v: number) => v.toLocaleString('en-US')
  return `Of ${val('valued', n(b.valued))} with a value on the permit: ${val('ge250k', n(b.ge250k))} are $250k or more, ${val('ge1m', n(b.ge1m))} are $1M or more. The middle one is ${val('median', shortMoney(b.median) ?? '$0')}.`
}

/** What the size line says where no band is drawn. */
export function noValueBandsWords(city: string, permits: readonly Pick<MarketPermit, 'declared_value'>[]): string {
  const valued = permits.filter((p) => p.declared_value != null && p.declared_value > 0).length
  return valued < 20 ? `${city}’s permits carry no declared value, so no size is drawn.` : `${city}’s declared values repeat one figure too often to trust, so no size is drawn.`
}
