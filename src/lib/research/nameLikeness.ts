/**
 * Bids and permits (punch list #307, PR 9 and 10): how alike two names are, and why. Our names
 * for customers do not match the names a city lists on permits, so a person links them; this
 * file only suggests. It grades one of our customer names against one name on permits and says
 * the reason in words a person can check: the same name, one begins the other, one letter
 * apart, a shared telling word, initials. The common trade words (construction, builders,
 * group) count for little, and a word that only sits inside a longer, unrelated word is no
 * match at all. A phone or a web domain the two share is a reason of its own, graded beside one
 * name beginning the other (v2.8303). Nothing here ties anything: only the exact same name is
 * ever joined without a person. No React, no Supabase.
 */
import { contactDomainOf, contactParts, nameKey, phoneDigitsOf, phoneWords } from '../../../supabase/functions/_shared/permitLookup'
import { shortDay } from './permitResearch'

/** Words a company name carries by law or by habit, which tell nothing. */
const LEGAL = new Set(['llc', 'inc', 'co', 'corp', 'ltd', 'llp', 'pllc', 'lp', 'company', 'incorporated', 'corporation', 'limited', 'the', 'of', 'and', 'dba'])
/** Words half the trade shares. They count toward a name beginning another, and for little else. */
const TRADE = new Set([
  'construction', 'constructors', 'contracting', 'contractors', 'contractor', 'builders', 'builder', 'building', 'general', 'commercial', 'group',
  'services', 'service', 'development', 'developers', 'enterprises', 'industries', 'associates', 'design', 'build', 'homes', 'properties',
  'management', 'solutions', 'partners', 'texas', 'tx', 'usa', 'san', 'antonio', 'austin', 'south', 'central',
])

export type NameWords = { all: string[]; telling: string[] }

/** A name as its words: every word that is not legal filler, and the telling ones among them. */
export function nameWords(name: string | null | undefined): NameWords {
  const all = ((name ?? '').toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) ?? []).filter((w) => !LEGAL.has(w))
  return { all, telling: all.filter((w) => !TRADE.has(w)) }
}

/** Two words one letter apart: one changed, one added, or two swapped. Only for words long enough to mean it. */
export function oneLetterApart(a: string, b: string): boolean {
  if (a === b || Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false
  if (a.length === b.length) {
    const diff = [...a].map((c, i) => (c === b[i] ? -1 : i)).filter((i) => i >= 0)
    if (diff.length === 1) return true
    return diff.length === 2 && diff[1] === (diff[0] as number) + 1 && a[diff[0] as number] === b[diff[1] as number] && a[diff[1] as number] === b[diff[0] as number]
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a]
  let i = 0
  while (i < short.length && long[i] === short[i]) i += 1
  return long.slice(i + 1) === short.slice(i)
}

export type LikenessReason = 'same' | 'begins' | 'near' | 'shared' | 'initials'

export type Likeness = {
  /** Higher is more alike. The same name is 100 and is never offered: it is already joined. */
  grade: number
  reason: LikenessReason
  /** The reason as a person reads it. */
  words: string
  /** The words of the name on permits to mark, in its own spelling, lower-case. */
  marked: string[]
}

const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1)

function listWords(words: readonly string[]): string {
  const shown = words.map(cap)
  if (shown.length <= 1) return shown[0] ?? ''
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`
}

/**
 * How alike one of our names and a name on permits are, or null when they are not. A telling
 * word must be shared whole, or one letter apart; every telling word of the shorter name must be
 * met, and at least half of the longer one's, so one word in a long unrelated name is no match.
 */
export function nameLikeness(ours: string | null | undefined, theirs: string | null | undefined): Likeness | null {
  const a = nameWords(ours)
  const b = nameWords(theirs)
  if (a.all.length === 0 || b.all.length === 0) return null
  const ka = nameKey(ours)
  const kb = nameKey(theirs)
  if (ka && kb && ka === kb) return { grade: 100, reason: 'same', words: 'The same name', marked: b.all }

  // One name begins the other, word for word: a branch, or a longer legal name.
  const [short, long] = a.all.length <= b.all.length ? [a, b] : [b, a]
  if (short.telling.length > 0 && short.all.length < long.all.length && short.all.every((w, i) => w === long.all[i])) {
    return { grade: 90, reason: 'begins', words: 'One name begins the other', marked: short.all }
  }

  if (a.telling.length > 0 && b.telling.length > 0) {
    const [few, many] = a.telling.length <= b.telling.length ? [a.telling, b.telling] : [b.telling, a.telling]
    const exact = few.filter((w) => many.includes(w))
    const near = few.filter((w) => !many.includes(w) && many.some((m) => oneLetterApart(w, m)))
    const met = exact.length + near.length
    // A lone shared word has to be a real word, not a number or two letters.
    const worthIt = met > 1 || [...exact, ...near].some((w) => w.length >= 4 && !/^\d+$/.test(w))
    if (met === few.length && met * 2 >= many.length && worthIt) {
      const markedIn = (list: readonly string[]) => list.filter((w) => exact.includes(w) || near.some((n) => n === w || oneLetterApart(n, w)))
      const marked = markedIn(b.telling)
      if (near.length > 0) return { grade: met === many.length ? 75 : 62, reason: 'near', words: 'One letter apart', marked }
      return { grade: met === many.length ? 70 : 60, reason: 'shared', words: `Shares the word${exact.length === 1 ? '' : 's'} ${listWords(exact)}`, marked }
    }
  }

  // Initials: "DSI" and "Diamondback Solutions International".
  for (const [letters, spelled] of [[a, b], [b, a]] as const) {
    if (letters.all.length !== 1 || spelled.all.length < 3) continue
    const word = letters.all[0] as string
    if (word.length >= 3 && word === spelled.all.map((w) => w[0]).join('')) return { grade: 55, reason: 'initials', words: 'Initials match', marked: letters === b ? b.all : spelled === b ? b.all : [] }
  }
  return null
}

/** A name cut into the parts to mark and the parts between, for the screen. */
export function markName(name: string, marked: readonly string[]): Array<{ text: string; hit: boolean }> {
  const want = new Set(marked)
  const out: Array<{ text: string; hit: boolean }> = []
  const re = /[A-Za-z0-9’']+/g
  let at = 0
  for (let m = re.exec(name); m; m = re.exec(name)) {
    const hit = want.has(m[0].toLowerCase().replace(/[’']/g, ''))
    if (m.index > at) out.push({ text: name.slice(at, m.index), hit: false })
    out.push({ text: m[0], hit })
    at = m.index + m[0].length
  }
  if (at < name.length) out.push({ text: name.slice(at), hit: false })
  // Neighbours of one kind read as one run.
  return out.reduce<Array<{ text: string; hit: boolean }>>((acc, part) => {
    const last = acc[acc.length - 1]
    if (last && (last.hit === part.hit || (/^\s+$/.test(part.text) && last.hit))) {
      last.text += part.text
      return acc
    }
    acc.push({ ...part })
    return acc
  }, [])
}

/**
 * A name on permits as the suggestions read it. `permits` counts its commercial permits, as
 * Builders does. `allPermits` is every permit under the name, set only for a name Builders does
 * not carry and a shared phone or web domain brought in.
 */
export type PermitName = { key: string; name: string; permits: number; lastOn: string | null; kind: string | null; allPermits?: number }

/** The line under a name: what the city lists it on, in the words that are true of how it was found. */
export function listedLineWords(n: PermitName, onOurSites: number): string {
  const last = n.lastOn ? ` · last ${shortDay(n.lastOn)}` : ''
  if (n.permits > 0) return `Listed on ${n.permits} commercial permit${n.permits === 1 ? '' : 's'} we can see${last}`
  if (onOurSites > 0) return 'Listed on a permit on an address you bid to them'
  const all = n.allPermits ?? 0
  return all > 0 ? `Listed on ${all} permit${all === 1 ? '' : 's'} we can see${last}` : 'Listed on a permit we can see'
}

// --- A phone or a web domain the two share -------------------------------------------------

/** One thing a customer and a name on permits both hold: a phone as ten digits, or a web domain. */
export type ContactMatch = { reason: 'phone' | 'domain'; value: string }

/** One row of `permit_name_contact_matches`: a customer, a name key, and what the two share. */
export type ContactMatchRow = { customer_id: string; builder_key: string; reason: string; value: string }

/**
 * The grade a shared phone or web domain carries: #307's *Likely*, the grade of one name
 * beginning the other. Each further thing shared adds a point, so two outrank one.
 */
export const CONTACT_MATCH_GRADE = 90

/** The match as a person reads it: "The same phone, (512) 555-0101", "The same web domain, example.com". */
export function contactMatchWords(match: ContactMatch): string {
  return match.reason === 'phone' ? `The same phone, ${phoneWords(match.value)}` : `The same web domain, ${match.value}`
}

/**
 * The read's rows by customer, then by name key: what each pair shares, a phone before a domain,
 * each value once. A row with a reason this client does not know is left out.
 */
export function contactMatchesByCustomer(rows: readonly ContactMatchRow[]): Map<string, Map<string, ContactMatch[]>> {
  const out = new Map<string, Map<string, ContactMatch[]>>()
  for (const r of rows) {
    if ((r.reason !== 'phone' && r.reason !== 'domain') || !r.value || !r.builder_key || !r.customer_id) continue
    const byKey = out.get(r.customer_id) ?? new Map<string, ContactMatch[]>()
    const held = byKey.get(r.builder_key) ?? []
    if (!held.some((m) => m.reason === r.reason && m.value === r.value)) held.push({ reason: r.reason, value: r.value })
    byKey.set(r.builder_key, held.sort(contactMatchOrder))
    out.set(r.customer_id, byKey)
  }
  return out
}

const contactMatchOrder = (a: ContactMatch, b: ContactMatch): number => (a.reason === b.reason ? a.value.localeCompare(b.value) : a.reason === 'phone' ? -1 : 1)

/** Several customer rows' matches as one customer's: one GC under two rows of one name. */
export function foldContactMatches(byCustomer: ReadonlyMap<string, ReadonlyMap<string, readonly ContactMatch[]>>, customerIds: readonly string[]): Map<string, ContactMatch[]> {
  const out = new Map<string, ContactMatch[]>()
  for (const id of customerIds) {
    for (const [key, matches] of byCustomer.get(id) ?? []) {
      const held = out.get(key) ?? []
      for (const m of matches) if (!held.some((h) => h.reason === m.reason && h.value === m.value)) held.push(m)
      out.set(key, held.sort(contactMatchOrder))
    }
  }
  return out
}

const NO_CONTACT_MATCHES: ReadonlyMap<string, readonly ContactMatch[]> = new Map()

export type NameSuggestion = PermitName & {
  /** The reasons, strongest first, as chips. */
  reasons: Array<{ words: string; tone: 'green' | 'amber' | 'grey' }>
  marked: string[]
  /** How many of the name's permits sit on addresses we bid to the customer. */
  onOurSites: number
  /** The phones and web domains the name shares with the customer. */
  shared: ContactMatch[]
  grade: number
}

/**
 * The names on permits that may be one of our customers, strongest reason first. The strongest
 * is never the name: it is a permit on an address we bid to them (`siteCounts`, by name key),
 * then a phone or a web domain the two share (`shared`, by name key). A name is offered on
 * either alone, however unlike the two names read.
 * Left out: the customer's own name (already joined), a name already answered either way
 * (`settled`), and a name marked as filing for others.
 */
export function suggestNames(
  customerName: string,
  names: readonly PermitName[],
  siteCounts: ReadonlyMap<string, number>,
  settled: ReadonlySet<string>,
  shared: ReadonlyMap<string, readonly ContactMatch[]> = NO_CONTACT_MATCHES,
): NameSuggestion[] {
  const own = nameKey(customerName)
  const out: NameSuggestion[] = []
  for (const n of names) {
    if (n.key === own || settled.has(n.key) || n.kind === 'files_for_others') continue
    const like = nameLikeness(customerName, n.name)
    if (like?.reason === 'same') continue
    const onOurSites = siteCounts.get(n.key) ?? 0
    const both = [...(shared.get(n.key) ?? [])]
    if (!like && onOurSites === 0 && both.length === 0) continue
    const reasons: NameSuggestion['reasons'] = []
    if (onOurSites > 0) reasons.push({ words: `${onOurSites} permit${onOurSites === 1 ? '' : 's'} on addresses you bid to them`, tone: 'green' })
    for (const m of both) reasons.push({ words: contactMatchWords(m), tone: 'green' })
    if (like) reasons.push({ words: like.words, tone: like.reason === 'shared' || like.reason === 'initials' ? 'grey' : 'amber' })
    const grade = (like?.grade ?? 0) + (onOurSites > 0 ? 40 + Math.min(onOurSites, 5) : 0) + (both.length > 0 ? CONTACT_MATCH_GRADE + (both.length - 1) : 0)
    out.push({ ...n, reasons, marked: like?.marked ?? [], onOurSites, shared: both, grade })
  }
  return out.sort((x, y) => y.grade - x.grade || y.permits - x.permits || x.name.localeCompare(y.name))
}

/** The names a search finds: every word typed must begin a word of the name. Empty for a blank search. */
export function searchNames(query: string, names: readonly PermitName[], limit = 12): PermitName[] {
  const words = (query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(Boolean)
  if (words.length === 0) return []
  return names
    .filter((n) => {
      const have = n.name.toLowerCase().match(/[a-z0-9]+/g) ?? []
      return words.every((w) => have.some((h) => h.startsWith(w)))
    })
    .sort((x, y) => y.permits - x.permits || x.name.localeCompare(y.name))
    .slice(0, limit)
}

/** The press that ties a name: a company is the same company, a person works for them. */
export function tiePressWords(nameIsCompany: boolean): string {
  return nameIsCompany ? 'Same company' : 'Works for them'
}

// --- What two records share: Compare, and the site evidence --------------------------------


/** A permit that sits on an address we bid to a customer, with the name key the city lists on it. */
export type SitePermitHit = { builderKey: string | null; address: string | null; day: string | null; stage: string }

/** How many permits each name has on addresses we bid to a customer. */
export function siteCountsByName(hits: readonly SitePermitHit[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const h of hits) if (h.builderKey) out.set(h.builderKey, (out.get(h.builderKey) ?? 0) + 1)
  return out
}

export type CompareCell = { label: string; value: string }
export type CompareRow = { ours: CompareCell; theirs: CompareCell; hit: boolean }

function countWords(counts: ReadonlyMap<string, number>, max = 4): string {
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const shown = sorted.slice(0, max).map(([k, n]) => `${k} (${n})`)
  return sorted.length > max ? `${shown.join(' · ')} and ${sorted.length - max} more` : shown.join(' · ')
}

/** Lines in their first order, a line that repeats said once with its count: "8006 City Base Landing, issued Sep 8 (2)". */
function countedLines(lines: readonly string[], max: number): string {
  const counts = new Map<string, number>()
  for (const l of lines) counts.set(l, (counts.get(l) ?? 0) + 1)
  const said = [...counts].map(([l, n]) => (n > 1 ? `${l} (${n})` : l))
  return said.length > max ? `${said.slice(0, max).join(' · ')} and ${said.length - max} more` : said.join(' · ')
}

/** Two names that read the same once case, spaces and marks are set aside. */
const sameWords = (a: string, b: string): boolean => a.toLowerCase().replace(/[^a-z0-9]/g, '') === b.toLowerCase().replace(/[^a-z0-9]/g, '')

const zipOfLine = (line: string | null | undefined): string | null => (line ?? '').match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1] ?? null

/**
 * Ours beside the city's, row by row, with what the two truly share marked. A shared word in
 * the name is not a row: the name is the weakest evidence, and it is already marked above.
 */
export function compareRows(input: {
  customerName: string
  /** The addresses of the bids we priced for the customer, as typed. */
  bidAddresses: ReadonlyArray<string | null>
  /** The streets of those that are sites in a city we read. */
  siteStreets: readonly string[]
  name: string
  permits: ReadonlyArray<{ address: string | null; zip: string | null; contact: string | null }>
  /** The name's permits that sit on those sites. */
  onOurSites: readonly SitePermitHit[]
  /** The phones and web domains each side holds, and which of them the read says the two share. Left out, no such row is drawn. */
  contacts?: CompareContacts
}): CompareRow[] {
  const people = new Map<string, number>()
  for (const p of input.permits) {
    const person = contactParts(p.contact).person
    // The name's own person is not somebody it is "with".
    if (person && sameWords(person, input.name)) continue
    if (person) people.set(person, (people.get(person) ?? 0) + 1)
  }
  const ourZips = new Map<string, number>()
  for (const a of input.bidAddresses) {
    const z = zipOfLine(a)
    if (z) ourZips.set(z, (ourZips.get(z) ?? 0) + 1)
  }
  const theirZips = new Map<string, number>()
  for (const p of input.permits) if (p.zip) theirZips.set(p.zip, (theirZips.get(p.zip) ?? 0) + 1)
  const sharedZip = [...ourZips.keys()].some((z) => theirZips.has(z))
  const streets = [...new Set(input.siteStreets)]
  const contactRows = input.contacts ? compareContactRows(input.contacts) : []
  return [
    {
      ours: { label: 'Name', value: input.customerName },
      theirs: { label: 'Name, as the city lists it', value: people.size > 0 ? `${input.name} · with ${countWords(people, 3)}` : input.name },
      hit: false,
    },
    {
      ours: { label: 'Addresses you bid to them', value: streets.length === 0 ? 'None in a city whose permits are read' : streets.length > 4 ? `${streets.slice(0, 4).join(' · ')} and ${streets.length - 4} more` : streets.join(' · ') },
      theirs: {
        label: 'This name’s permits on those addresses',
        value: input.onOurSites.length === 0 ? 'None seen' : countedLines(input.onOurSites.map((h) => `${h.address ?? 'an address'}${h.day ? `, ${h.stage === 'applied' ? 'applied' : 'issued'} ${shortDay(h.day)}` : ''}`), 4),
      },
      hit: input.onOurSites.length > 0,
    },
    {
      ours: { label: 'Where your bids with them are', value: ourZips.size === 0 ? 'No zip on their bids' : countWords(ourZips) },
      theirs: { label: 'Where this name’s permits are', value: theirZips.size === 0 ? 'No zip on its permits' : countWords(theirZips) },
      hit: sharedZip,
    },
    ...contactRows,
  ]
}

/** What each side holds to be reached by, for Compare. `shared` is the read's word on what the two share. */
export type CompareContacts = {
  /** Phones we hold for the customer, as ten digits. */
  ourPhones: readonly string[]
  /** Web domains we hold for the customer, off its emails. */
  ourDomains: readonly string[]
  /** Phones the city lists with the name, as ten digits. */
  theirPhones: readonly string[]
  /** Web domains found for the name. */
  theirDomains: readonly string[]
  shared: readonly ContactMatch[]
}

/** A customer row and its people, as Compare reads what we hold to reach them by. */
export type OurContactRows = {
  customers: ReadonlyArray<{ contact_info: unknown; billing_email: string | null }>
  persons: ReadonlyArray<{ phone: string | null; email: string | null }>
}

/** A name on permits, as Compare reads what the city and a lookup list to reach it by. */
export type TheirContactRows = {
  /** The phone on each of the name's permits, where the feed gives one. */
  permitPhones: ReadonlyArray<string | null | undefined>
  /** A company lookup's facts: its `phone` and its `website`. */
  lookups: ReadonlyArray<unknown>
}

const fieldOf = (obj: unknown, key: string): unknown => (obj != null && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : null)
const kept = (values: ReadonlyArray<string | null>): string[] => [...new Set(values.filter((v): v is string => v != null))]

/**
 * What each side holds, by the database's own two rules (`phoneDigitsOf`, `contactDomainOf`): a
 * number that is no phone is dropped, and so is a mail service's domain. `shared` is the read's
 * word on which of them the two share.
 */
export function compareContactsOf(ours: OurContactRows, theirs: TheirContactRows, shared: readonly ContactMatch[]): CompareContacts {
  return {
    ourPhones: kept([...ours.customers.map((c) => phoneDigitsOf(fieldOf(c.contact_info, 'phone'))), ...ours.persons.map((p) => phoneDigitsOf(p.phone))]),
    ourDomains: kept([
      ...ours.customers.flatMap((c) => [contactDomainOf(fieldOf(c.contact_info, 'email')), contactDomainOf(c.billing_email)]),
      ...ours.persons.map((p) => contactDomainOf(p.email)),
    ]),
    theirPhones: kept([...theirs.permitPhones.map((v) => phoneDigitsOf(v)), ...theirs.lookups.map((f) => phoneDigitsOf(fieldOf(f, 'phone')))]),
    theirDomains: kept(theirs.lookups.map((f) => contactDomainOf(fieldOf(f, 'website')))),
    shared,
  }
}

/** A side's values with the shared ones first, each once, cut at four with a count of the rest. */
function sideWords(values: readonly string[], shared: readonly string[], say: (v: string) => string, none: string): string {
  const all = [...new Set([...shared, ...values])]
  if (all.length === 0) return none
  const shown = all.slice(0, 4).map(say)
  return all.length > 4 ? `${shown.join(' · ')} and ${all.length - 4} more` : shown.join(' · ')
}

/**
 * The phones row and the web domains row, each only when one side holds something. A row is
 * marked when the read says the two share a value. A value the read ties (it may come from the
 * contacts spine or a lookup) is shown on both sides even when the lists handed in lack it.
 */
function compareContactRows(c: CompareContacts): CompareRow[] {
  const sharedPhones = c.shared.filter((m) => m.reason === 'phone').map((m) => m.value)
  const sharedDomains = c.shared.filter((m) => m.reason === 'domain').map((m) => m.value)
  const rows: CompareRow[] = []
  if (c.ourPhones.length > 0 || c.theirPhones.length > 0 || sharedPhones.length > 0) {
    rows.push({
      ours: { label: 'Phones we hold for them', value: sideWords(c.ourPhones, sharedPhones, phoneWords, 'None on file') },
      theirs: { label: 'Phones listed with this name', value: sideWords(c.theirPhones, sharedPhones, phoneWords, 'None listed') },
      hit: sharedPhones.length > 0,
    })
  }
  if (c.ourDomains.length > 0 || c.theirDomains.length > 0 || sharedDomains.length > 0) {
    rows.push({
      ours: { label: 'Web domains we hold for them', value: sideWords(c.ourDomains, sharedDomains, (d) => d, 'None on file') },
      theirs: { label: 'Web domains found for this name', value: sideWords(c.theirDomains, sharedDomains, (d) => d, 'None found') },
      hit: sharedDomains.length > 0,
    })
  }
  return rows
}

// --- Every customer against every name: the worklist on Builders ---------------------------

export type LookAlike = { customerId: string; customerName: string; suggestion: NameSuggestion }

/**
 * Every name on permits that may be one of our customers, the strongest reason first: the
 * worklist behind *Looks like a customer*. A customer under several rows of one keyed name is
 * one customer. Names are found through an index of telling words, so a thousand customers
 * against a few thousand names is a few thousand comparisons, not millions. `siteCounts`,
 * `settled` and `shared` are keyed by customer id. A name that shares a phone or a web domain
 * with a customer is compared with it whatever the two names read.
 */
export function lookAlikePairs(
  customers: ReadonlyArray<{ id: string; name: string }>,
  names: readonly PermitName[],
  siteCounts: ReadonlyMap<string, ReadonlyMap<string, number>>,
  settled: ReadonlyMap<string, ReadonlySet<string>>,
  limit = 150,
  shared: ReadonlyMap<string, ReadonlyMap<string, readonly ContactMatch[]>> = new Map(),
): LookAlike[] {
  // The index: a telling word, and its first two letters for a word one letter apart.
  const byWord = new Map<string, number[]>()
  const byStart = new Map<string, number[]>()
  const byKey = new Map<string, number>()
  names.forEach((n, i) => {
    byKey.set(n.key, i)
    for (const w of new Set(nameWords(n.name).telling)) {
      byWord.set(w, [...(byWord.get(w) ?? []), i])
      if (w.length >= 5) byStart.set(w.slice(0, 2), [...(byStart.get(w.slice(0, 2)) ?? []), i])
    }
  })
  // One customer per keyed name: its rows' site counts, answers and shared phones folded together.
  const groups = new Map<string, { id: string; ids: string[]; name: string; sites: Map<string, number>; settled: Set<string> }>()
  for (const c of customers) {
    const key = nameKey(c.name)
    if (!key) continue
    const g = groups.get(key) ?? { id: c.id, ids: [], name: c.name, sites: new Map<string, number>(), settled: new Set<string>() }
    g.ids.push(c.id)
    for (const [k, n] of siteCounts.get(c.id) ?? []) g.sites.set(k, (g.sites.get(k) ?? 0) + n)
    for (const k of settled.get(c.id) ?? []) g.settled.add(k)
    groups.set(key, g)
  }
  const out: LookAlike[] = []
  for (const g of groups.values()) {
    const picked = new Set<number>()
    for (const w of new Set(nameWords(g.name).telling)) {
      for (const i of byWord.get(w) ?? []) picked.add(i)
      if (w.length >= 5) for (const i of byStart.get(w.slice(0, 2)) ?? []) picked.add(i)
    }
    const both = foldContactMatches(shared, g.ids)
    for (const k of [...g.sites.keys(), ...both.keys()]) {
      const i = byKey.get(k)
      if (i != null) picked.add(i)
    }
    if (picked.size === 0) continue
    const candidates = [...picked].map((i) => names[i] as PermitName)
    for (const suggestion of suggestNames(g.name, candidates, g.sites, g.settled, both)) out.push({ customerId: g.id, customerName: g.name, suggestion })
  }
  return out.sort((a, b) => b.suggestion.grade - a.suggestion.grade || b.suggestion.permits - a.suggestion.permits || a.customerName.localeCompare(b.customerName)).slice(0, limit)
}
