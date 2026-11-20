/**
 * Permits, Market: Ask for (punch list #405, step three). What a one-time lookup found about a
 * builder on the call list, and a person's check of it. Three facts a name: what kind of company
 * it is, an office phone, and one person and title to ask for. Each keeps the page it was read
 * on and the day. A fact reads as looked up, not checked, until a person presses Checked. A
 * press of Wrong takes it off the row.
 *
 * The facts are `builder_lookups` and the presses `builder_lookup_checks`, both append-only: the
 * newest row per name and fact is the fact, and the newest press on it is its state. A looked-up
 * fact is apart from the office's own word. It may tag a name, and once checked it may move the
 * name in the list's order. It never takes a name off the list and never sets the builder's kind.
 * The rules and the words are here. No React, no Supabase.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { val } from '../valuesInPlace'
import { shortDay } from './permitResearch'

// ---------- the rows ----------

export type LookupFact = 'kind' | 'phone' | 'person'
/** The order the facts are drawn in. */
export const LOOKUP_FACTS: readonly LookupFact[] = ['kind', 'phone', 'person']

/** What a lookup may say a company is. `unknown` is a lookup that could not tell, kept so nothing is guessed. */
export type LookupKind = 'builder' | 'owner' | 'design_firm' | 'permit_service' | 'trade' | 'unknown'
export type SettledKind = Exclude<LookupKind, 'unknown'>
const KINDS: readonly LookupKind[] = ['builder', 'owner', 'design_firm', 'permit_service', 'trade', 'unknown']
export const isLookupKind = (v: unknown): v is LookupKind => typeof v === 'string' && (KINDS as readonly string[]).includes(v)

/** One row of `builder_lookups`. */
export type LookupRow = {
  id: string
  builder_key: string
  fact: LookupFact
  /** A kind's key, the phone as the page wrote it, or the person's name. */
  value: string
  /** The person's title, or a few words on the kind. Empty for a phone. */
  detail: string
  source_url: string
  looked_up_on: string
  looked_up_by: string | null
  looked_up_how: 'agent' | 'person'
  city: string
  created_at: string
}

export type LookupVerdict = 'checked' | 'wrong' | 'back'

/** One row of `builder_lookup_checks`. */
export type LookupCheckRow = { id: string; lookup_id: string; verdict: LookupVerdict; said_by: string | null; said_at: string }

/** Where a fact stands: nobody has said, a person said it held, or a person said it was wrong. */
export type LookupState = 'unchecked' | 'checked' | 'wrong'

/** One fact as it stands: its row, its state, and the press that gave the state. */
export type LookupStanding = { row: LookupRow; state: LookupState; said: LookupCheckRow | null }

/** Everything looked up about one name. A fact nobody found is null. */
export type BuilderLookup = { key: string; kind: LookupStanding | null; phone: LookupStanding | null; person: LookupStanding | null }

const newer = (a: string, aId: string, b: string, bId: string) => a > b || (a === b && aId > bId)

/**
 * The rows folded to one lookup per name. The newest row per name and fact is the fact, so a
 * later lookup replaces an earlier one and starts as not checked. The newest press on that row
 * is its state, and a press put back leaves it not checked.
 */
export function foldLookups(rows: readonly LookupRow[], checks: readonly LookupCheckRow[]): Map<string, BuilderLookup> {
  const said = new Map<string, LookupCheckRow>()
  for (const c of checks) {
    const held = said.get(c.lookup_id)
    if (!held || newer(c.said_at, c.id, held.said_at, held.id)) said.set(c.lookup_id, c)
  }
  const out = new Map<string, BuilderLookup>()
  for (const row of rows) {
    if (!LOOKUP_FACTS.includes(row.fact)) continue
    const lookup = out.get(row.builder_key) ?? { key: row.builder_key, kind: null, phone: null, person: null }
    out.set(row.builder_key, lookup)
    const held = lookup[row.fact]
    if (held && !newer(row.created_at, row.id, held.row.created_at, held.row.id)) continue
    lookup[row.fact] = { row, state: 'unchecked', said: null }
  }
  for (const lookup of out.values()) {
    for (const fact of LOOKUP_FACTS) {
      const standing = lookup[fact]
      const press = standing ? said.get(standing.row.id) : undefined
      if (standing && press && press.verdict !== 'back') lookup[fact] = { row: standing.row, state: press.verdict, said: press }
    }
  }
  return out
}

/** The facts a lookup holds, in the order they are drawn. */
export function lookupFacts(lookup: BuilderLookup): LookupStanding[] {
  return LOOKUP_FACTS.map((f) => lookup[f]).filter((s): s is LookupStanding => s != null)
}

/** The facts that show a value: not marked wrong, and not a kind that could not be told. */
function shownFacts(lookup: BuilderLookup): LookupStanding[] {
  return lookupFacts(lookup).filter((s) => s.state !== 'wrong' && !(s.row.fact === 'kind' && s.row.value === 'unknown'))
}

// ---------- the kind ----------

/** The kind a lookup settled on, and whether a person checked it. Null when none was found, when it could not be told, and when it was marked wrong. */
export function lookedUpKind(lookup: BuilderLookup | null | undefined): { kind: SettledKind; checked: boolean } | null {
  const s = lookup?.kind
  if (!s || s.state === 'wrong' || !isLookupKind(s.row.value) || s.row.value === 'unknown') return null
  return { kind: s.row.value, checked: s.state === 'checked' }
}

export const LOOKUP_KIND_WORDS: Record<SettledKind, string> = { builder: 'A builder', owner: 'An owner', design_firm: 'A design firm', permit_service: 'A permit service', trade: 'A trade' }

/** A tag a lookup puts on a name. `outline` is a fact nobody checked: it is drawn as an outline, not a fill. */
export type LookupTag = { words: string; tone: 'grey'; outline: boolean }

/** The tag for a looked-up kind: "Looked up: a design firm" until a person checks it, then "A design firm, checked". */
export function lookupTag(lookup: BuilderLookup | null | undefined): LookupTag | null {
  const k = lookedUpKind(lookup)
  if (!k) return null
  const words = LOOKUP_KIND_WORDS[k.kind]
  return k.checked ? { words: `${words}, checked`, tone: 'grey', outline: false } : { words: `Looked up: ${words.charAt(0).toLowerCase()}${words.slice(1)}`, tone: 'grey', outline: true }
}

/**
 * What a looked-up kind does to the list's order. Nothing until a person checks it: a trial of
 * twenty lookups got two kinds wrong. Then a builder leads with the names that say they build,
 * and a design firm, a permit service or a trade waits behind the other companies. An owner
 * stays where its name put it. Nothing where the office has said a kind: its word orders.
 */
export function lookupOrder(lookup: BuilderLookup | null | undefined, officeSaidKind: boolean): 'leads' | 'waits' | null {
  if (officeSaidKind) return null
  const k = lookedUpKind(lookup)
  if (!k || !k.checked) return null
  if (k.kind === 'builder') return 'leads'
  return k.kind === 'owner' ? null : 'waits'
}

// ---------- the words ----------

export const LOOKUP_FACT_LABELS: Record<LookupFact, string> = { kind: 'What it is', phone: 'Office', person: 'Ask for' }
/** A fact named in a few words, for a press's name and a toast. */
export const LOOKUP_FACT_NAMES: Record<LookupFact, string> = { kind: 'the kind of company', phone: 'the office phone', person: 'the person to ask for' }

/** A fact's value as the row prints it: the kind's words, the phone, or the person's name. */
export function lookupValueWords(row: Pick<LookupRow, 'fact' | 'value'>): string {
  if (row.fact !== 'kind') return row.value.trim()
  return isLookupKind(row.value) && row.value !== 'unknown' ? LOOKUP_KIND_WORDS[row.value] : row.value.trim()
}

/** The page a fact came from, short enough for a row: the site and its path, or the listing's own name. */
export function sourceWords(url: string): string {
  let at: URL
  try {
    at = new URL(url)
  } catch {
    return url.trim()
  }
  const host = at.hostname.replace(/^www\./, '')
  if (/(^|\.)google\.[a-z.]+$/.test(host) && at.pathname.startsWith('/maps')) return 'its Google Maps listing'
  if (host === 'maps.app.goo.gl' || host === 'goo.gl') return 'its Google Maps listing'
  const path = at.pathname.replace(/\/+$/, '')
  const whole = `${host}${path}`
  return whole.length > 44 ? `${whole.slice(0, 43)}…` : whole
}

/** A phone as a link to call: ten digits, or eleven with the country's 1. Null for anything else, and an extension is left off. */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/\s*(x|ext\.?)\s*\d+\s*$/i, '').replace(/\D/g, '')
  if (digits.length === 10) return `tel:+1${digits}`
  return digits.length === 11 && digits.startsWith('1') ? `tel:+${digits}` : null
}

/** Who a press or a lookup was by: "you", the person's name, or "someone" for an account that is gone. */
function whoWords(userId: string | null, me: string, nameOf: (userId: string) => string | null): string {
  if (userId == null) return 'someone'
  return userId === me ? 'you' : (nameOf(userId) ?? 'someone')
}

const saidDay = (c: Pick<LookupCheckRow, 'said_at'>) => calendarYmdInAppTzFromIso(c.said_at) || c.said_at.slice(0, 10)

/** Under a fact nobody checked: the day it was read off its page. The page itself is drawn as a link before it. */
export function lookedUpDayWords(row: Pick<LookupRow, 'looked_up_on'>, todayYmd: string): string {
  return val('day', shortDay(row.looked_up_on, todayYmd))
}

/** Under a checked fact: "Checked by you, Nov 23". */
export function checkedWords(said: Pick<LookupCheckRow, 'said_by' | 'said_at'>, me: string, nameOf: (userId: string) => string | null, todayYmd: string): string {
  return `Checked by ${val('who', whoWords(said.said_by, me, nameOf))}, ${val('day', shortDay(saidDay(said), todayYmd))}`
}

/** In place of a fact marked wrong: "Marked wrong by you, Nov 23." The value itself is no longer shown. */
export function wrongWords(said: Pick<LookupCheckRow, 'said_by' | 'said_at'>, me: string, nameOf: (userId: string) => string | null, todayYmd: string): string {
  return `Marked wrong by ${val('who', whoWords(said.said_by, me, nameOf))}, ${val('day', shortDay(saidDay(said), todayYmd))}.`
}

/** In place of a kind that could not be told: nothing is guessed. */
export function kindUnknownWords(row: Pick<LookupRow, 'looked_up_on'>, todayYmd: string): string {
  return `Could not tell from a public page. Looked ${val('day', shortDay(row.looked_up_on, todayYmd))}.`
}

/** The small label beside Ask for: how much of what is shown a person has checked. */
export function lookupPill(lookup: BuilderLookup): { words: string; checked: boolean } {
  const shown = shownFacts(lookup)
  const checked = shown.filter((s) => s.state === 'checked').length
  if (checked === 0) return { words: 'Looked up, not checked', checked: false }
  return { words: checked === shown.length ? 'Checked' : `${checked} of ${shown.length} checked`, checked: true }
}

/** Under the facts: who looked and when. An agent's lookup says nobody was contacted. */
export function lookupFootWords(lookup: BuilderLookup, todayYmd: string): string {
  const rows = lookupFacts(lookup).map((s) => s.row)
  const newest = rows.reduce<LookupRow | null>((held, r) => (held == null || r.looked_up_on > held.looked_up_on ? r : held), null)
  if (!newest) return ''
  const day = val('day', shortDay(newest.looked_up_on, todayYmd))
  return rows.every((r) => r.looked_up_how === 'agent') ? `Looked up by an agent on ${day}. Nobody was called or written to.` : `Looked up on ${day}.`
}

/**
 * What the lookup did not find. A lookup searches for all three facts, so one with no row was
 * not on a public business page. Null when both the phone and the person were found.
 */
export function lookupNotFoundWords(lookup: BuilderLookup): string | null {
  const missing = [lookup.phone ? null : 'office phone', lookup.person ? null : 'person to ask for'].filter((w): w is string => w != null)
  if (missing.length === 0) return null
  return `No ${missing.join(' or ')} was found on a public business page.`
}

/** Whether a fact is still to find: none was found, one was marked wrong, or the kind could not be told. The Google press is offered then. */
export function lookupHasGap(lookup: BuilderLookup): boolean {
  return LOOKUP_FACTS.some((f) => {
    const s = lookup[f]
    return s == null || s.state === 'wrong' || (f === 'kind' && s.row.value === 'unknown')
  })
}

/** Beside the Google press on a lookup with a gap. */
export const LOOKUP_GAP_TAIL = 'opens a search for what is missing.'
/** In place of the block when the lookups could not be read: the row does not claim nobody looked. */
export const LOOKUPS_UNREAD = 'What was looked up could not be read.'
/** Under the reason when the lookups could not be read: the list still draws, and this is what that costs. */
export const LOOKUPS_UNREAD_COST = 'The list still draws. No name shows who to ask for until this read comes back.'

/** The name a fact's press carries: "Checked: the office phone of Ridgeway Builders". */
export function lookupPressName(press: 'Checked' | 'Wrong' | 'Not right' | 'Put back', fact: LookupFact, name: string): string {
  return `${press}: ${LOOKUP_FACT_NAMES[fact]} of ${name}`
}

/** The toast after a press. */
export function lookupPressedWords(verdict: LookupVerdict, fact: LookupFact, name: string): string {
  const what = LOOKUP_FACT_NAMES[fact]
  if (verdict === 'checked') return `Checked ${what} of ${name}.`
  if (verdict === 'wrong') return `Marked ${what} of ${name} wrong. It is off the row for everyone.`
  return `Put back ${what} of ${name}. It reads as not checked.`
}
