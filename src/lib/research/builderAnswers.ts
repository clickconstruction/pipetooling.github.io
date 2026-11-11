/**
 * Bids and permits (punch list #307, PR 6's leftovers): the answers on names, read from the
 * builder's side. The bid's window asks whether a name on a permit works for the bid's GC and
 * keeps the answer in `builder_customer_answers`. This file turns those same answers around for
 * Prospects → Permits → Builders: which customers a name is tied to, whose word it is, and our
 * bids with those customers, so the **Our bids** column counts a tied customer's bids beside the
 * same-name hint `research_builders` already counts. It folds nothing itself: every customer's
 * answers go through `foldNameAnswers`, one customer at a time, and a question comes from
 * `nameStanding`. A customer under several rows of one keyed name is one customer, as the bid's
 * window reads it. No React, no Supabase.
 */
import { contactParts, nameKey } from '../../../supabase/functions/_shared/permitLookup'
import { isRobotBidName } from '../bids/bidPursuit'
import { foldNameAnswers, nameGrade, nameStanding, wordOfWords, type NameAnswerRow, type NameState } from './nameAnswers'
import { builderName, type BuilderRow } from './permitBuilders'
import type { LookAlike } from './nameLikeness'

export type CustomerName = { id: string; name: string }

/** One customer as the answers see it: every customer row of one keyed name. */
export type CustomerGroup = { key: string; ids: string[]; name: string }

/** A customer nobody can name here: an answer points at a row the list does not hold. */
const UNNAMED = 'a customer'

/** Our customers, one per keyed name, in their first order. A name with nothing to key stands alone. */
export function customerGroups(customers: readonly CustomerName[]): CustomerGroup[] {
  const byKey = new Map<string, CustomerGroup>()
  for (const c of customers) {
    const key = nameKey(c.name) ?? `id:${c.id}`
    const g = byKey.get(key)
    if (!g) byKey.set(key, { key, ids: [c.id], name: c.name.trim() })
    else if (!g.ids.includes(c.id)) g.ids.push(c.id)
  }
  return [...byKey.values()]
}

/** Every answer on a name, turned to face the names. */
export type AnswerBook = {
  /** Every customer, one per keyed name. */
  groups: CustomerGroup[]
  /** A customer row to its customer. */
  groupOf: Map<string, CustomerGroup>
  /** A customer's key to what is known about each name for it. Only customers some answer names. */
  states: Map<string, Map<string, NameState>>
  /** A name's key to the customers every one of its permits is tied to, the newest tie first. */
  tied: Map<string, CustomerGroup[]>
  /** `customer key|name key` to the customer row the answer that stands was written on. */
  rowOf: Map<string, string>
}

const pairKey = (customerKey: string, builderKey: string): string => `${customerKey}|${builderKey}`

/**
 * The answers as Builders reads them. `customers` is every customer by name; a customer an answer
 * names that the list does not hold (an archived one the read left out) stands alone, unnamed.
 */
export function answerBook(rows: readonly NameAnswerRow[], customers: readonly CustomerName[]): AnswerBook {
  const groups = customerGroups(customers)
  const groupOf = new Map<string, CustomerGroup>()
  for (const g of groups) for (const id of g.ids) groupOf.set(id, g)
  for (const r of rows) {
    if (groupOf.has(r.customer_id)) continue
    const g: CustomerGroup = { key: `id:${r.customer_id}`, ids: [r.customer_id], name: UNNAMED }
    groups.push(g)
    groupOf.set(r.customer_id, g)
  }
  const named = new Map<string, CustomerGroup>()
  for (const r of rows) {
    const g = groupOf.get(r.customer_id)
    if (g) named.set(g.key, g)
  }
  const states = new Map<string, Map<string, NameState>>()
  const tied = new Map<string, CustomerGroup[]>()
  for (const g of named.values()) {
    const folded = foldNameAnswers(rows, g.ids)
    states.set(g.key, folded)
    for (const s of folded.values()) if (s.all) tied.set(s.key, [...(tied.get(s.key) ?? []), g])
  }
  for (const [key, list] of tied) {
    tied.set(key, [...list].sort((a, b) => (states.get(b.key)?.get(key)?.at ?? '').localeCompare(states.get(a.key)?.get(key)?.at ?? '') || a.name.localeCompare(b.name)))
  }
  // The row a standing answer sits on, so a take-back lands on the same one. Oldest first, as the fold reads them.
  const rowOf = new Map<string, string>()
  for (const r of [...rows].sort((a, b) => a.answered_at.localeCompare(b.answered_at))) {
    const g = groupOf.get(r.customer_id)
    if (g && (r.answer === 'works_for' || r.answer === 'someone_else')) rowOf.set(pairKey(g.key, r.builder_key), r.customer_id)
  }
  return { groups, groupOf, states, tied, rowOf }
}

/** Every customer row whose bids some tie counts: the rows to read bids for. */
export function tiedCustomerIds(book: AnswerBook): string[] {
  const ids = new Set<string>()
  for (const list of book.tied.values()) for (const g of list) for (const id of g.ids) ids.add(id)
  return [...ids]
}

// ---------- our bids with a tied name ----------

/** One of our bids as the count reads it. `legacyGcName` is the old builders list's name on the bid, when it has one. */
export type CountedBid = { id: string; customerId: string; outcome: string | null; bidOn: string | null; projectName: string | null; legacyGcName: string | null }

/** The outcomes `research_builders` counts as won. */
const WON = new Set(['won', 'started_or_complete'])

export type AnsweredBids = { bids: number; won: number; lastBidOn: string | null; customers: string[] }

/**
 * Our bids with the customers a name is tied to, beyond what the same-name hint already counts.
 * Left out: a customer whose own name is the name (the hint counts every bid with it), a bid
 * whose legacy builder is the name (the hint counts it too), and a robot's copy of a bid.
 */
export function answeredBids(builderKey: string, book: AnswerBook, bids: readonly CountedBid[]): AnsweredBids {
  const out: AnsweredBids = { bids: 0, won: 0, lastBidOn: null, customers: [] }
  const seen = new Set<string>()
  for (const g of book.tied.get(builderKey) ?? []) {
    if (g.key === builderKey) continue
    const ids = new Set(g.ids)
    let counted = 0
    for (const b of bids) {
      if (!ids.has(b.customerId) || seen.has(b.id) || isRobotBidName(b.projectName) || nameKey(b.legacyGcName) === builderKey) continue
      seen.add(b.id)
      counted += 1
      out.bids += 1
      if (WON.has(b.outcome ?? '')) out.won += 1
      if (b.bidOn && b.bidOn > (out.lastBidOn ?? '')) out.lastBidOn = b.bidOn
    }
    if (counted > 0) out.customers.push(g.name)
  }
  return out
}

/**
 * Builders' rows with the answers folded in: a name someone tied to a customer counts that
 * customer's bids as ours with it. `by_word` keeps the part that came from an answer, so the
 * screen can say whose customers they are. A row no answer touches comes back as it was.
 */
export function withAnsweredBids(rows: readonly BuilderRow[], book: AnswerBook, bids: readonly CountedBid[]): BuilderRow[] {
  if (book.tied.size === 0) return [...rows]
  return rows.map((r) => {
    const add = answeredBids(r.key, book, bids)
    if (add.bids === 0) return r
    const last = [r.last_bid_on, add.lastBidOn].filter((d): d is string => Boolean(d)).sort()
    return { ...r, bids: r.bids + add.bids, won: r.won + add.won, last_bid_on: last[last.length - 1] ?? null, by_word: { bids: add.bids, won: add.won, customers: add.customers } }
  })
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Under the count on the list: "through Ridgeway Builders". Null when no answer added a bid. */
export function throughWords(row: Pick<BuilderRow, 'by_word'>): string | null {
  const w = row.by_word
  if (!w || w.bids === 0) return null
  return w.customers.length > 2 ? `through ${w.customers.length} customers tied to it` : `through ${listNames(w.customers)}`
}

/** On the builder's sheet: how many of the count came through a tied customer. Null when none did. */
export function byWordWords(row: Pick<BuilderRow, 'by_word'>): string | null {
  const w = row.by_word
  if (!w || w.bids === 0) return null
  return `${w.bids} of them ${w.bids === 1 ? 'is' : 'are'} with ${listNames(w.customers)}, tied to this name by a person’s word.`
}

// ---------- the builder's sheet ----------

/** One customer on a builder's sheet, with how the name stands for it. */
export type SheetTie = {
  kind: 'own' | 'tied' | 'not_them'
  customerKey: string
  customer: string
  /** The customer row a take-back is written on. Null for the customer's own name: there is nothing to take back. */
  customerId: string | null
  /** The chip beside the customer: "Same company · your word, Nov 10". */
  how: string
}

/**
 * The customers a name is tied to, for its sheet: a customer of the exact same name first (joined
 * by name, with nothing to take back), then each tie with whose word it is and when, the newest
 * first, then the customers someone said it is not.
 */
export function sheetTies(row: Pick<BuilderRow, 'key' | 'name' | 'sample_contact'>, book: AnswerBook, me: string | null, nameOf: (userId: string) => string | null): SheetTie[] {
  const own: SheetTie[] = book.groups.filter((g) => g.key === row.key).map((g) => ({ kind: 'own', customerKey: g.key, customer: g.name, customerId: null, how: 'The same name' }))
  const said: Array<{ tie: SheetTie; at: string }> = []
  const isCompany = contactParts(builderName(row)).company != null
  for (const [customerKey, states] of book.states) {
    const s = states.get(row.key)
    const g = book.groups.find((x) => x.key === customerKey)
    if (!s || !g || customerKey === row.key) continue
    const word = wordOfWords(s.by, s.at, me, nameOf)
    const customerId = book.rowOf.get(pairKey(customerKey, row.key)) ?? g.ids[0] ?? null
    const tail = word ? ` · ${word}` : ''
    const how = s.all ? (isCompany ? 'Same company' : 'Works for them') : s.permitIds.length > 0 ? `Tied on ${s.permitIds.length} permit${s.permitIds.length === 1 ? '' : 's'}` : s.someoneElse ? 'Not them' : null
    if (how) said.push({ tie: { kind: s.someoneElse ? 'not_them' : 'tied', customerKey, customer: g.name, customerId, how: `${how}${tail}` }, at: s.at ?? '' })
  }
  said.sort((a, b) => Number(a.tie.kind === 'not_them') - Number(b.tie.kind === 'not_them') || b.at.localeCompare(a.at))
  return [...own, ...said.map((x) => x.tie)]
}

/** The press on a builder's sheet that finds one of our customers to tie the name to. */
export const TIE_PRESS = 'Tie to a customer'

/** A name that files for others is never tied to one GC: its sheet offers no question and no search. */
export function mayTie(kind: string | null): boolean {
  return kind !== 'files_for_others'
}

/**
 * What the sheet says when no customer is tied to the name, with the press that ties one
 * (`next` is empty for a name that files for others). Null when a customer is tied.
 */
export function notTiedWords(ties: readonly SheetTie[], kind: string | null): { main: string; next: string; tail: string } | null {
  if (ties.some((t) => t.kind !== 'not_them')) return null
  if (!mayTie(kind)) return { main: 'No customer is tied to this name. A name that files for others is never tied to one customer.', next: '', tail: '' }
  return { main: 'No customer is tied to this name. Our bids count the exact same name only.', next: TIE_PRESS, tail: 'finds one of ours.' }
}

/** One open question on a builder's sheet: a customer whose name begins this one, or is begun by it. */
export type SheetAsk = { customerKey: string; customer: string; customerId: string; lead: string; ask: string; why: string }

/** How many questions one sheet asks at most. */
export const SHEET_ASKS_MAX = 3

/**
 * The likely grade from the builder's side: every customer whose name begins this name, or is
 * begun by it, that nobody has answered and this person has not passed. `nameStanding` decides,
 * so a tie, a No, a name that files for others and a Not sure all close it as they do on a bid.
 */
export function sheetAsks(row: Pick<BuilderRow, 'key' | 'name' | 'sample_contact' | 'kind'>, book: AnswerBook, me: string | null): SheetAsk[] {
  const name = builderName(row)
  const kinds = new Map([[row.key, row.kind]])
  const none = new Map<string, NameState>()
  const out: SheetAsk[] = []
  if (!mayTie(row.kind)) return out
  for (const g of book.groups) {
    const customerId = g.ids[0]
    if (!customerId || g.name === UNNAMED || nameGrade(name, g.name) !== 'likely') continue
    const standing = nameStanding({ id: '', contact: name, builder_key: row.key }, g.name, book.states.get(g.key) ?? none, me, kinds)
    if (standing.kind !== 'ask') continue
    out.push({ customerKey: g.key, customer: g.name, customerId, lead: `Your customer is ${/\.$/.test(g.name) ? g.name : `${g.name}.`}`, ask: 'Same company?', why: 'Asked because one name begins the other. Asked once.' })
    if (out.length >= SHEET_ASKS_MAX) break
  }
  return out
}

/** The customers a search on the sheet finds: every word typed begins a word of the name. A customer already answered for this name is left out. */
export function searchCustomers(query: string, row: Pick<BuilderRow, 'key'>, book: AnswerBook, limit = 6): CustomerGroup[] {
  const words = query.toLowerCase().match(/[a-z0-9]+/g) ?? []
  if (words.length === 0) return []
  return book.groups
    .filter((g) => {
      if (g.name === UNNAMED || g.key === row.key) return false
      const s = book.states.get(g.key)?.get(row.key)
      if (s && (s.all || s.someoneElse)) return false
      const have = g.name.toLowerCase().match(/[a-z0-9]+/g) ?? []
      return words.every((w) => have.some((h) => h.startsWith(w)))
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit)
}

/** The press that ties a name from its sheet: a company is the same company, a person works for them. */
export function sheetTiePress(row: Pick<BuilderRow, 'key' | 'name' | 'sample_contact'>): string {
  return contactParts(builderName(row)).company != null ? 'Same company' : 'Works for them'
}

/**
 * The look-alike pairs still open once the answers on hand are read: a pair someone has since
 * tied or refused, from a builder's sheet, leaves the worklist and its count at once.
 */
export function openLookAlikes<T extends Pick<LookAlike, 'customerId'> & { suggestion: { key: string } }>(pairs: readonly T[], book: AnswerBook): T[] {
  return pairs.filter((p) => {
    const g = book.groupOf.get(p.customerId)
    const s = g ? book.states.get(g.key)?.get(p.suggestion.key) : undefined
    return !(s && (s.all || s.someoneElse))
  })
}
