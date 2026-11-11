/**
 * Bids and permits (punch list #307, PR 9 and 10): how alike two names are, and why. Our names
 * for customers do not match the names a city lists on permits, so a person links them; this
 * file only suggests. It grades one of our customer names against one name on permits and says
 * the reason in words a person can check: the same name, one begins the other, one letter
 * apart, a shared telling word, initials. The common trade words (construction, builders,
 * group) count for little, and a word that only sits inside a longer, unrelated word is no
 * match at all. Nothing here ties anything: only the exact same name is ever joined without a
 * person. No React, no Supabase.
 */
import { contactParts, nameKey } from '../../../supabase/functions/_shared/permitLookup'
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

/** A name on permits as the suggestions read it. */
export type PermitName = { key: string; name: string; permits: number; lastOn: string | null; kind: string | null }

export type NameSuggestion = PermitName & {
  /** The reasons, strongest first, as chips. */
  reasons: Array<{ words: string; tone: 'green' | 'amber' | 'grey' }>
  marked: string[]
  /** How many of the name's permits sit on addresses we bid to the customer. */
  onOurSites: number
  grade: number
}

/**
 * The names on permits that may be one of our customers, strongest reason first. The strongest
 * is never the name: it is a permit on an address we bid to them (`siteCounts`, by name key).
 * Left out: the customer's own name (already joined), a name already answered either way
 * (`settled`), and a name marked as filing for others.
 */
export function suggestNames(customerName: string, names: readonly PermitName[], siteCounts: ReadonlyMap<string, number>, settled: ReadonlySet<string>): NameSuggestion[] {
  const own = nameKey(customerName)
  const out: NameSuggestion[] = []
  for (const n of names) {
    if (n.key === own || settled.has(n.key) || n.kind === 'files_for_others') continue
    const like = nameLikeness(customerName, n.name)
    if (like?.reason === 'same') continue
    const onOurSites = siteCounts.get(n.key) ?? 0
    if (!like && onOurSites === 0) continue
    const reasons: NameSuggestion['reasons'] = []
    if (onOurSites > 0) reasons.push({ words: `${onOurSites} permit${onOurSites === 1 ? '' : 's'} on addresses you bid to them`, tone: 'green' })
    if (like) reasons.push({ words: like.words, tone: like.reason === 'shared' || like.reason === 'initials' ? 'grey' : 'amber' })
    out.push({ ...n, reasons, marked: like?.marked ?? [], onOurSites, grade: (like?.grade ?? 0) + (onOurSites > 0 ? 40 + Math.min(onOurSites, 5) : 0) })
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
}): CompareRow[] {
  const people = new Map<string, number>()
  for (const p of input.permits) {
    const person = contactParts(p.contact).person
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
        value: input.onOurSites.length === 0 ? 'None seen' : input.onOurSites.slice(0, 4).map((h) => `${h.address ?? 'an address'}${h.day ? `, ${h.stage === 'applied' ? 'applied' : 'issued'} ${shortDay(h.day)}` : ''}`).join(' · '),
      },
      hit: input.onOurSites.length > 0,
    },
    {
      ours: { label: 'Where your bids with them are', value: ourZips.size === 0 ? 'No zip on their bids' : countWords(ourZips) },
      theirs: { label: 'Where this name’s permits are', value: theirZips.size === 0 ? 'No zip on its permits' : countWords(theirZips) },
      hit: sharedZip,
    },
  ]
}

// --- Every customer against every name: the worklist on Builders ---------------------------

export type LookAlike = { customerId: string; customerName: string; suggestion: NameSuggestion }

/**
 * Every name on permits that may be one of our customers, the strongest reason first: the
 * worklist behind *Looks like a customer*. A customer under several rows of one keyed name is
 * one customer. Names are found through an index of telling words, so a thousand customers
 * against a few thousand names is a few thousand comparisons, not millions. `siteCounts` and
 * `settled` are keyed by customer id.
 */
export function lookAlikePairs(
  customers: ReadonlyArray<{ id: string; name: string }>,
  names: readonly PermitName[],
  siteCounts: ReadonlyMap<string, ReadonlyMap<string, number>>,
  settled: ReadonlyMap<string, ReadonlySet<string>>,
  limit = 150,
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
  // One customer per keyed name: its rows' site counts and answers folded together.
  const groups = new Map<string, { id: string; name: string; sites: Map<string, number>; settled: Set<string> }>()
  for (const c of customers) {
    const key = nameKey(c.name)
    if (!key) continue
    const g = groups.get(key) ?? { id: c.id, name: c.name, sites: new Map<string, number>(), settled: new Set<string>() }
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
    for (const k of g.sites.keys()) {
      const i = byKey.get(k)
      if (i != null) picked.add(i)
    }
    if (picked.size === 0) continue
    const candidates = [...picked].map((i) => names[i] as PermitName)
    for (const suggestion of suggestNames(g.name, candidates, g.sites, g.settled)) out.push({ customerId: g.id, customerName: g.name, suggestion })
  }
  return out.sort((a, b) => b.suggestion.grade - a.suggestion.grade || b.suggestion.permits - a.suggestion.permits || a.customerName.localeCompare(b.customerName)).slice(0, limit)
}
