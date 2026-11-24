/**
 * Addresses already on file (punch list #439, piece 1). The job form's address box asked Google alone, so one
 * place was typed two ways and its jobs stopped matching. This kernel says which addresses the company already
 * has, which of them match what a person is typing, and which one a typed address is one slip away from.
 *
 * One rule decides *the same address* everywhere: `normalizeAddressKey` (`developments/notInIt.ts`), the cleaned
 * form the Development page already matches by. Nothing here reads a map point: an address written differently
 * at the same spot is the site match's question (piece 2).
 *
 * Pure: no React, no supabase. The read is `hooks/useAddressesOnFile.ts`.
 */
import { pluralNoun } from '../batchWords'
import { normalizeAddressKey } from '../developments/notInIt'
import { val } from '../valuesInPlace'

/** A job or a bid as the list reads it. `id` is unique within its kind. */
export type AddressRow = { kind: 'job' | 'bid'; id: string; address: string | null; developmentId: string | null; /** `J1340` or `B214`, for a list that names what is at an address. */ label?: string | null }

/** One address the company already has, under its cleaned key. */
export type AddressOnFile = {
  /** The cleaned form: two addresses with the same key are the same address. */
  key: string
  /** The address as most of its jobs and bids write it. A tie goes to the one read first. */
  address: string
  /** Every way it is written, the first one read first. The map keeps a point for each. */
  spellings: string[]
  /** What is here, by its label (`J1340`, `B214`), in the order read. */
  labels: string[]
  jobs: number
  bids: number
  /** The development, when every job and bid here that has one has the same one. */
  developmentName: string | null
}

/** A row of the dropdown: an address on file, and how much of its start the person typed. */
export type OnFileMatch = AddressOnFile & { matchEnd: number }

/** Typed characters before the list looks. Google's own list waits for five. */
export const ADDRESS_ON_FILE_MIN_CHARS = 3
/** Rows the dropdown shows above Google's. */
export const ADDRESS_ON_FILE_MAX_ROWS = 3

/**
 * Every address on file, one entry a cleaned key. `except` leaves one job or bid out, so a job being edited is
 * not counted at its own address. A blank address is no address.
 */
export function addressesOnFile(
  rows: ReadonlyArray<AddressRow>,
  developmentNames: ReadonlyMap<string, string>,
  except?: { kind: 'job' | 'bid'; id: string } | null,
): AddressOnFile[] {
  type Bucket = { key: string; spellings: Map<string, number>; order: string[]; jobs: number; bids: number; developments: Set<string>; labels: string[] }
  const buckets = new Map<string, Bucket>()
  for (const row of rows) {
    if (except && row.kind === except.kind && row.id === except.id) continue
    const address = (row.address ?? '').trim().replace(/\s+/g, ' ')
    const key = normalizeAddressKey(address)
    if (!key) continue
    let b = buckets.get(key)
    if (!b) {
      b = { key, spellings: new Map(), order: [], jobs: 0, bids: 0, developments: new Set(), labels: [] }
      buckets.set(key, b)
    }
    if (!b.spellings.has(address)) b.order.push(address)
    b.spellings.set(address, (b.spellings.get(address) ?? 0) + 1)
    if (row.kind === 'job') b.jobs += 1
    else b.bids += 1
    if (row.developmentId) b.developments.add(row.developmentId)
    if (row.label) b.labels.push(row.label)
  }
  const out: AddressOnFile[] = []
  for (const b of buckets.values()) {
    let address = b.order[0] ?? ''
    for (const spelling of b.order) if ((b.spellings.get(spelling) ?? 0) > (b.spellings.get(address) ?? 0)) address = spelling
    const only = b.developments.size === 1 ? [...b.developments][0] : undefined
    out.push({ key: b.key, address, spellings: [...b.order], labels: b.labels, jobs: b.jobs, bids: b.bids, developmentName: (only && developmentNames.get(only)) || null })
  }
  return out
}

const used = (a: AddressOnFile): number => a.jobs + a.bids

/** The typed words as the key would have them, the last one left as typed since it may be half a word. */
function typedWords(typed: string): string[] {
  const flat = typed
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!flat) return []
  const words = flat.split(' ')
  const last = words.pop() ?? ''
  const head = normalizeAddressKey(words.join(' '))
  return [...(head ? head.split(' ') : []), last]
}

/** Where in an address's words the typed words begin: 0 at its start, -1 when they are not there. */
function foundAt(entryWords: readonly string[], words: readonly string[]): number {
  const last = words.length - 1
  for (let at = 0; at + words.length <= entryWords.length; at++) {
    let hit = true
    for (let i = 0; i < words.length && hit; i++) {
      const have = entryWords[at + i] ?? ''
      const want = words[i] ?? ''
      // The last typed word may be the start of a word, or a short form the key spells out (`tr` for `trail`).
      hit = i === last ? have.startsWith(want) || have === normalizeAddressKey(want) : have === want
    }
    if (hit) return at
  }
  return -1
}

/**
 * The addresses on file that match what is being typed, for the dropdown. An address that begins the way the
 * person typed comes first, then the one with the most jobs and bids. Nothing until three characters are typed.
 */
export function onFileMatches(list: ReadonlyArray<AddressOnFile>, typed: string, max: number = ADDRESS_ON_FILE_MAX_ROWS): OnFileMatch[] {
  const trimmed = typed.trim()
  if (trimmed.replace(/\s/g, '').length < ADDRESS_ON_FILE_MIN_CHARS) return []
  const words = typedWords(trimmed)
  if (words.length === 0) return []
  const lower = trimmed.toLowerCase()
  const hits: { entry: AddressOnFile; at: number }[] = []
  for (const entry of list) {
    const at = foundAt(entry.key.split(' '), words)
    if (at >= 0) hits.push({ entry, at })
  }
  hits.sort((a, b) => Number(a.at > 0) - Number(b.at > 0) || used(b.entry) - used(a.entry) || a.entry.address.localeCompare(b.entry.address))
  return hits.slice(0, Math.max(0, max)).map(({ entry }) => ({ ...entry, matchEnd: entry.address.toLowerCase().startsWith(lower) ? trimmed.length : 0 }))
}

/** The entry an address is on file as, by its cleaned key. Null for an address the company does not have. */
export function onFileEntry(list: ReadonlyArray<AddressOnFile>, address: string): AddressOnFile | null {
  const key = normalizeAddressKey(address)
  if (!key) return null
  return list.find((a) => a.key === key) ?? null
}

/** `25 jobs`, `1 job and 2 bids`, `1 bid`: how many things are at an address, for a row and for a sentence. */
export function onFileCountWords(entry: Pick<AddressOnFile, 'jobs' | 'bids'>): string {
  const jobs = entry.jobs > 0 ? `${entry.jobs} ${pluralNoun('job', entry.jobs)}` : ''
  const bids = entry.bids > 0 ? `${entry.bids} ${pluralNoun('bid', entry.bids)}` : ''
  return jobs && bids ? `${jobs} and ${bids}` : jobs || bids
}

/** The line under the box once the address is one on file. Its values are marked for `ValueSentence`. */
export function onFileSentence(entry: AddressOnFile): string {
  const many = used(entry) !== 1
  const where = entry.developmentName ? `, in the development ${val('development', entry.developmentName)}` : ''
  return `On file. ${val('count', onFileCountWords(entry))} ${many ? 'are' : 'is'} at this address${where}.`
}

/** Edits to turn one word into another, counting a swap of two neighbours as one. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let best = Math.min((d[i - 1]?.[j] ?? 0) + 1, (d[i]?.[j - 1] ?? 0) + 1, (d[i - 1]?.[j - 1] ?? 0) + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, (d[i - 2]?.[j - 2] ?? 0) + 1)
      const row = d[i]
      if (row) row[j] = best
    }
  }
  return d[rows - 1]?.[cols - 1] ?? 0
}

/** A typed address beside the one on file it is one slip from, each as words with the differing ones marked. */
export type CloseOnFile = {
  entry: AddressOnFile
  typed: { text: string; differs: boolean }[]
  onFile: { text: string; differs: boolean }[]
}

const houseAndRest = (key: string): { house: string; rest: string } | null => {
  const m = /^(\d+[a-z]?)\s+(.+)$/.exec(key)
  return m ? { house: m[1] ?? '', rest: m[2] ?? '' } : null
}

/** The words of an address as written, each marked when its cleaned form is not among the other side's. */
export function markedWords(address: string, other: string): { text: string; differs: boolean }[] {
  const theirs = new Set(normalizeAddressKey(other).split(' ').filter(Boolean))
  return address
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => {
      const cleaned = normalizeAddressKey(text)
      return { text, differs: cleaned !== '' && !cleaned.split(' ').every((w) => theirs.has(w)) }
    })
}

/**
 * The address on file a typed one is a slip away from, or null. It asks only about a typed address that is not
 * on file itself, with the same house number as one that is, and a street that differs by a letter or two or by
 * a space (`FM1117` for `FM 1117`). A unit or a building number is a different word, not a slip, so
 * `Building 16` never offers `Building 20`. With several, the one with the most jobs and bids wins.
 */
export function closeOnFile(list: ReadonlyArray<AddressOnFile>, typed: string): CloseOnFile | null {
  const key = normalizeAddressKey(typed)
  if (!key || list.some((a) => a.key === key)) return null
  const mine = houseAndRest(key)
  if (!mine) return null
  const mineJoined = mine.rest.replace(/\s/g, '')
  let best: { entry: AddressOnFile; distance: number } | null = null
  for (const entry of list) {
    const theirs = houseAndRest(entry.key)
    if (!theirs || theirs.house !== mine.house) continue
    const theirsJoined = theirs.rest.replace(/\s/g, '')
    let distance: number
    if (mineJoined === theirsJoined) distance = 0
    else {
      const longer = Math.max(mine.rest.length, theirs.rest.length)
      if (longer < 6) continue
      distance = editDistance(mine.rest, theirs.rest)
      if (distance > 2 || distance * 4 > longer) continue
      // A slip changes letters. A different number in the street is a different place.
      const digits = (s: string) => s.replace(/\D/g, '')
      if (digits(mine.rest) !== digits(theirs.rest)) continue
    }
    if (!best || distance < best.distance || (distance === best.distance && used(entry) > used(best.entry))) best = { entry, distance }
  }
  if (!best) return null
  return { entry: best.entry, typed: markedWords(typed, best.entry.address), onFile: markedWords(best.entry.address, typed) }
}

/** The words of the nudge under the box. */
export const CLOSE_ON_FILE_WORDS = {
  title: 'This looks like an address already on file.',
  typed: 'You typed',
  onFile: 'On file',
  use: 'Use the one on file',
  keep: 'Keep mine',
} as const

/** What keeping the typed address means, in one line. */
export function closeOnFileFoot(entry: AddressOnFile): string {
  return `Keeping yours makes a new place. This job will not match the ${onFileCountWords(entry)} on file. You can still save.`
}
