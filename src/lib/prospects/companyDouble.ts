/**
 * One lookup for every double (v2.5579, punch list #113 spot 4). New Prospect used to check two
 * homes with two rules and two sentences: a sub against the bench, a lead against the customers. It
 * never looked at the deck itself, so the same sub typed twice made two cards and the strip counted
 * both. Now one rule checks the four places a company can already live, in the order a caller
 * would want to hear: this lane, another lane, the bench, the customers. It answers one sentence of
 * one shape, `<Company> is already <where>. <One fact>.`, and names the door the page draws.
 */
import { benchDouble } from './subsLane'
import { PROSPECT_KIND_WORDS, type ProspectKind } from './prospectKinds'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/** A prospect as the lookup reads it: every lane's rows, landed or not. */
export type ProspectDoubleRow = {
  id: string
  name: string
  phone: string | null
  kind: ProspectKind
  /** `prospects.prospect_fit_status`: null, converted, cant_reach or not_a_fit. */
  status: string | null
  last_contact: string | null
  created_at: string | null
  updated_at: string | null
}

export type BenchDoubleRow = { id: string; name: string; phone: string | null; trades?: readonly string[]; vetted?: boolean }
export type CustomerDoubleRow = { id: string; name: string; phone: string | null; since?: string | null }

export type DoubleHomes = {
  /** The lane New Prospect is on. */
  kind: ProspectKind
  prospects: readonly ProspectDoubleRow[]
  bench: readonly BenchDoubleRow[]
  customers: readonly CustomerDoubleRow[]
}

export type CompanyDouble =
  | { where: 'lane' | 'other_lane'; id: string; name: string; kind: ProspectKind; line: string; door: 'open_prospect' }
  | { where: 'bench'; id: string; name: string; line: string; door: 'open_bench' }
  | { where: 'customer'; id: string; name: string; line: string; door: 'customer' }

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(iso: string | null, nowMs: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((nowMs - t) / DAY_MS))
}

function agoWords(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

function monthWords(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: APP_CALENDAR_TZ })
}

/** The one fact about a prospect row: where it landed, or when it was last called. */
export function prospectFact(row: ProspectDoubleRow, nowMs: number): string {
  const words = PROSPECT_KIND_WORDS[row.kind]
  if (row.status === 'converted') {
    const when = monthWords(row.updated_at)
    return when ? `${words.lastPress} in ${when}` : words.lastPress
  }
  if (row.status === 'cant_reach') {
    const d = daysAgo(row.last_contact, nowMs)
    return d == null ? "Can't reach" : `Can't reach, last tried ${agoWords(d)}`
  }
  if (row.status === 'not_a_fit') return 'Not a fit'
  const called = daysAgo(row.last_contact, nowMs)
  if (called != null) return `Called ${agoWords(called)}`
  const added = daysAgo(row.created_at, nowMs)
  return added == null ? 'Never called' : `Never called, added ${agoWords(added)}`
}

function benchFact(row: BenchDoubleRow): string {
  const trades = (row.trades ?? []).filter(Boolean)
  const parts = [trades.join(', '), row.vetted == null ? '' : row.vetted ? 'vetted' : 'new'].filter(Boolean)
  return parts.join(', ')
}

function customerFact(row: CustomerDoubleRow): string {
  if (!row.since) return ''
  const d = new Date(row.since)
  return Number.isFinite(d.getTime()) ? `With us since ${d.getFullYear()}` : ''
}

function sentence(name: string, where: string, fact: string): string {
  const f = fact.trim()
  return `${name} is already ${where}.${f ? ` ${f}.` : ''}`
}

/**
 * The first home that already holds this company, by the same name (case-blind) or the same phone
 * (seven digits or more): this lane, then another lane, then the bench, then the customers. Null
 * when the company is new everywhere. `nowMs` is the clock, so the words can be tested.
 */
export function companyDouble(name: string, phone: string | null | undefined, homes: DoubleHomes, nowMs: number = Date.now()): CompanyDouble | null {
  const n = name.trim()
  if (!n && (phone ?? '').replace(/\D/g, '').length < 7) return null
  const here = benchDouble(name, phone, homes.prospects.filter((p) => p.kind === homes.kind))
  if (here) return { where: 'lane', id: here.id, name: here.name, kind: here.kind, door: 'open_prospect', line: sentence(here.name, `on ${PROSPECT_KIND_WORDS[here.kind].tab}`, prospectFact(here, nowMs)) }
  const elsewhere = benchDouble(name, phone, homes.prospects.filter((p) => p.kind !== homes.kind))
  if (elsewhere) return { where: 'other_lane', id: elsewhere.id, name: elsewhere.name, kind: elsewhere.kind, door: 'open_prospect', line: sentence(elsewhere.name, `on ${PROSPECT_KIND_WORDS[elsewhere.kind].tab}`, prospectFact(elsewhere, nowMs)) }
  const bench = benchDouble(name, phone, homes.bench)
  if (bench) return { where: 'bench', id: bench.id, name: bench.name, door: 'open_bench', line: sentence(bench.name, 'on the bench', benchFact(bench)) }
  const customer = benchDouble(name, phone, homes.customers)
  if (customer) return { where: 'customer', id: customer.id, name: customer.name, door: 'customer', line: sentence(customer.name, 'a customer', customerFact(customer)) }
  return null
}

/** The lane a prospect double opens on: the kind's URL key, or none for the customer deck. */
export function doubleLaneParams(twin: Extract<CompanyDouble, { door: 'open_prospect' }>): { kind: string | null; prospect_id: string } {
  return { kind: twin.kind === 'customer' ? null : twin.kind === 'gc_lead' ? 'gc-leads' : 'subs', prospect_id: twin.id }
}
