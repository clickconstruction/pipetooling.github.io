/**
 * Does this row name a part already in the book? (punch list #308, PR 1)
 *
 * The parts book knows a part by its name alone, and every supply house writes the name its own
 * way. Three keys find a part, in the order they are trusted:
 *
 * 1. **The house's own number** (`supply_part_codes`, from PR 2): matched, with no press.
 * 2. **The model number**: the maker's number inside the name, read with its dashes and spaces
 *    folded away, so `Z8702-9B-PC` and `Z87029BPC` are one number. Offered.
 * 3. **The words**: the same words in any order, where only a spelling or a trade abbreviation
 *    differs, and every size agrees. Offered. Closeness by letters is never used: in the real book
 *    it pairs black with galvanized, PVC with PEX and a tee with a wye, each a few letters apart.
 *
 * Pure: no I/O. The Add Part form, the Duplicates page and the price sheet reader all call it.
 */
export type BookPart = { id: string; name: string; manufacturer?: string | null }

/** How a row found its part. */
export type MatchHow = 'house_number' | 'model_number' | 'same_name' | 'words' | 'not_a_part' | 'none'

export type PartMatch<T extends BookPart = BookPart> = {
  how: MatchHow
  /** The one part this row is, when exactly one fits. Null when none fits or more than one does. */
  part: T | null
  /** Every part that fits at this level, the best first. Two or more means a person picks. */
  rivals: T[]
  /** The model number that matched, as folded, when `how` is `model_number`. */
  model: string | null
}

/** A house's own number for a part, or the mark that the number is not a part at all. */
export type HouseCode = { supplyHouseId: string; code: string; partId: string | null; notAPart?: boolean }

export type MatchRowInput = {
  supplyHouseId?: string | null
  houseCode?: string | null
  mfrNumber?: string | null
  description: string
}

/** Uppercase with everything but letters and digits removed: the form two spellings of one number share. */
export function foldCode(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Lowercase, punctuation to spaces, spaces collapsed: the form two spellings of one name share. */
export function foldName(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// A size or a rating, not a model number: 4INX3IN, 1-1/2XCL, SCH40, 60A/3P, 120/277V, 105-115F, 10KAIC.
const UNIT = '(?:IN|FT|GA|OD|ID|IPS|NPT|MIP|FIP|GPM|GPF|PSI|VAC|VDC|V|KW|W|AMP|A|PH|P|HP|HZ|F|C|LBS|LB|OZ|MM|CM|M|GAL|G|K|BTU|KAIC|AIC|DIA|MIL|AWG|CFM|"|\')'
const NUM = '\\d[\\d./-]*'
const MEASURE = new RegExp(`^(?:SCH|S)?${NUM}${UNIT}?(?:[X/-]${NUM}${UNIT}?)*(?:X(?:CL|CLOSE))?$`)
const SIZE_NUMBER = /^(\d+(?:[- ]\d+\/\d+|\/\d+|\.\d+)?)(.*)$/
// What may follow a size's number: nothing, its unit or inch marks, a close-nipple mark, or punctuation.
const SIZE_TAIL = new RegExp(`^(?:''|${UNIT}|NH)?(?:X(?:CL|CLOSE))?$`)
// A size glued to a plain word: 1PLASTIC, 2BRASS.
const SIZE_AND_WORD = /^\d{1,2}[A-Z]{5,}$/

/**
 * The model numbers in a name, folded, in the order they appear. A model number mixes letters and
 * digits and is at least five characters once folded; a size, a rating or a size glued to a word
 * is not one.
 */
export function modelNumbersIn(text: string | null | undefined): string[] {
  const out: string[] = []
  for (const raw of (text ?? '').toUpperCase().split(/[\s,;()[\]|]+/)) {
    const token = raw.replace(/^[^A-Z0-9]+|[^A-Z0-9"']+$/g, '')
    if (!token) continue
    const folded = foldCode(token)
    if (folded.length < 5 || !/[A-Z]/.test(folded) || !/\d/.test(folded)) continue
    if (MEASURE.test(token) || SIZE_AND_WORD.test(folded)) continue
    if (!out.includes(folded)) out.push(folded)
  }
  return out
}

/**
 * A model number typed with spaces where its dashes go: `AX8802XL LR PC` for `AX8802XL-LR-PC`.
 * Each model number joined with the one or two short pieces after it. These are only ever looked
 * up against the book's own model numbers, so a join that is not a real number matches nothing.
 */
export function joinedModelNumbersIn(text: string | null | undefined): string[] {
  const tokens = (text ?? '')
    .toUpperCase()
    .split(/[\s,;()[\]|]+/)
    .map((t) => t.replace(/^[^A-Z0-9]+|[^A-Z0-9"']+$/g, ''))
    .filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    if (modelNumbersIn(tokens[i]).length === 0) continue
    let joined = foldCode(tokens[i])
    for (let j = i + 1; j <= i + 2 && j < tokens.length; j++) {
      if (!/^[A-Z0-9]{1,3}$/.test(tokens[j]!)) break
      joined += tokens[j]
      if (!out.includes(joined)) out.push(joined)
    }
  }
  return out
}

/** One size as a number: 1-1/2, 1 1/2 and 11/2 are all 1.5; 3/4 is 0.75. */
function sizeValue(token: string): number | null {
  const mixed = /^(\d+)[- ](\d+)\/(\d+)$/.exec(token)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  // 11/2 and 21/2 are a mixed number typed with no dash: no pipe is eleven halves of an inch.
  const glued = /^([1-9])([13579])\/(2|4|8|16)$/.exec(token)
  if (glued && Number(glued[2]) < Number(glued[3])) return Number(glued[1]) + Number(glued[2]) / Number(glued[3])
  const frac = /^(\d+)\/(\d+)$/.exec(token)
  // 2/0 and 4/0 are wire gauges, each its own size: kept apart from every real number as a negative.
  if (frac) return Number(frac[2]) === 0 ? -Number(frac[1]) : Number(frac[1]) / Number(frac[2])
  const plain = /^\d+(?:\.\d+)?$/.exec(token)
  return plain ? Number(token) : null
}

/**
 * Every size in a name outside its model numbers, as sorted numbers. `1-1/2 X 1-1/4` is
 * [1.25, 1.5]; a model number's own digits are not sizes.
 */
export function sizesIn(text: string | null | undefined): number[] {
  const out: number[] = []
  for (const raw of (text ?? '').toUpperCase().split(/[\s,;()[\]|]+/)) {
    const token = raw.replace(/^[^A-Z0-9]+|[^A-Z0-9"']+$/g, '')
    if (!token) continue
    const folded = foldCode(token)
    const isModel = folded.length >= 5 && /[A-Z]/.test(folded) && /\d/.test(folded) && !MEASURE.test(token) && !SIZE_AND_WORD.test(folded)
    if (isModel) continue
    for (const piece of token.split(/X(?=\d)/)) {
      // A number, then nothing or a unit: 8IN and 17GA are sizes, and the 9B of a model number is not.
      const m = SIZE_NUMBER.exec(piece)
      if (!m || !(SIZE_TAIL.test(m[2]!) || /^[^A-Z0-9]/.test(m[2]!))) continue
      const v = sizeValue(m[1]!)
      if (v != null) out.push(Math.round(v * 10000) / 10000)
    }
  }
  return out.sort((a, b) => a - b)
}

/**
 * Do two names agree on their sizes? `loose` lets one name carry sizes the other leaves out (a bare
 * model number against the full description); otherwise the two lists must be the same.
 */
export function sizesAgree(a: string, b: string, loose = false): boolean {
  const sa = sizesIn(a)
  const sb = sizesIn(b)
  if (!loose) return sa.length === sb.length && sa.every((v, i) => v === sb[i])
  const [small, big] = sa.length <= sb.length ? [sa, sb] : [sb, sa]
  const left = [...big]
  for (const v of small) {
    const at = left.indexOf(v)
    if (at < 0) return false
    left.splice(at, 1)
  }
  return true
}

// One spelling for the words the trade writes two ways. Phrases first, so CHROME PLATED folds to CP.
const PHRASES: [RegExp, string][] = [
  [/\bchrome plated\b/g, 'cp'],
  [/\bstainless steel\b/g, 'ss'],
  [/\bfrost proof\b/g, 'frostproof'],
  [/\bno hub\b/g, 'nh'],
]
const SAME_WORD: Record<string, string> = {
  galvanized: 'galv', black: 'blk', steel: 'stl', white: 'wht', tee: 't', wye: 'y', elbow: 'ell', coupling: 'cplg',
  adapter: 'adpt', adaptor: 'adpt', faucet: 'fct', hanger: 'hgr', bracket: 'brkt', valve: 'vlv', vacuum: 'vac',
  nipple: 'nipp', less: 'l', chrome: 'chr', brass: 'brs', copper: 'cu', polished: 'pol', commercial: 'comm',
  elongated: 'elong', assembly: 'assy', regulator: 'reg', reducing: 'red', reducer: 'red', female: 'f', male: 'm',
}
// Words that say nothing about which part it is, and the unit words a size already carries.
const NO_WORD = new Set(['w', 'with', 'and', 'the', 'for', 'of', 'pn', 'in', 'inch', 'ft', 'ga', 'gauge', 'od', 'id', 'ips', 'x'])

/**
 * A name's words, one spelling each, sorted. Sizes and bare numbers are left out (`sizesAgree`
 * judges those); a model number stays, as a word.
 */
export function wordsOf(text: string | null | undefined): string[] {
  const models = new Set(modelNumbersIn(text))
  const out: string[] = []
  let rest = ''
  for (const raw of (text ?? '').toUpperCase().split(/[\s,;()[\]|]+/)) {
    const token = raw.replace(/^[^A-Z0-9]+|[^A-Z0-9"']+$/g, '')
    if (models.has(foldCode(token))) out.push(foldCode(token).toLowerCase())
    else rest += ` ${raw}`
  }
  let folded = foldName(rest)
  for (const [re, to] of PHRASES) folded = folded.replace(re, to)
  for (const raw of folded.split(' ')) {
    // 8in, 17ga, 20a: a size with its unit glued on is a size.
    if (!raw || /^\d+[a-z]{0,2}$/.test(raw)) continue
    const word = SAME_WORD[raw] ?? SAME_WORD[Object.keys(SAME_WORD).find((k) => oneSlipApart(k, raw)) ?? ''] ?? raw
    if (NO_WORD.has(word)) continue
    out.push(word)
  }
  return out.sort()
}

/** One typed letter apart, for words long enough that a slip is likelier than another word. */
function oneSlipApart(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length < 5 || b.length < 5 || a[0] !== b[0] || Math.abs(a.length - b.length) > 1) return false
  if (/\d/.test(a) || /\d/.test(b)) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length === long.length ? short.slice(i + 1) === long.slice(i + 1) : short.slice(i) === long.slice(i + 1)
}

/**
 * Do two names say the same words? The same list once each word has its one spelling, where a word
 * of five letters or more may be one slip apart (VACUM, VACUUM). A word more or a word less is a
 * different part: a pipe is not its tee, and a trap with a cleanout is not the one without.
 */
export function sameWords(a: string, b: string): boolean {
  const wa = wordsOf(a)
  const wb = wordsOf(b)
  if (wa.length === 0 || wa.length !== wb.length) return wa.length > 0 && wa.join('') === wb.join('')
  if (wa.every((w, i) => w === wb[i])) return true
  const left = [...wb]
  for (const w of wa) {
    const at = left.findIndex((x) => oneSlipApart(w, x))
    if (at < 0) return false
    left.splice(at, 1)
  }
  return true
}

export type BookIndex<T extends BookPart = BookPart> = {
  parts: T[]
  byId: Map<string, T>
  byModel: Map<string, T[]>
  byName: Map<string, T[]>
  /** Parts by their sizes, so the words are compared only where the sizes already agree. */
  bySizes: Map<string, T[]>
}

/** The book read once: each part under its model numbers and its folded name. */
export function indexBook<T extends BookPart>(parts: T[]): BookIndex<T> {
  const byId = new Map<string, T>()
  const byModel = new Map<string, T[]>()
  const byName = new Map<string, T[]>()
  const bySizes = new Map<string, T[]>()
  for (const p of parts) {
    byId.set(p.id, p)
    const sizes = sizesIn(p.name).join('|')
    const sized = bySizes.get(sizes)
    if (sized) sized.push(p)
    else bySizes.set(sizes, [p])
    for (const m of modelNumbersIn(p.name)) {
      const list = byModel.get(m)
      if (list) list.push(p)
      else byModel.set(m, [p])
    }
    const n = foldName(p.name)
    if (!n) continue
    const list = byName.get(n)
    if (list) list.push(p)
    else byName.set(n, [p])
  }
  return { parts, byId, byModel, byName, bySizes }
}

function houseKey(supplyHouseId: string, code: string): string {
  return `${supplyHouseId}|${foldCode(code)}`
}

/** The house numbers read once, keyed by house and folded number. */
export function indexHouseCodes(codes: HouseCode[]): Map<string, HouseCode> {
  const out = new Map<string, HouseCode>()
  for (const c of codes) if (foldCode(c.code)) out.set(houseKey(c.supplyHouseId, c.code), c)
  return out
}

const none = <T extends BookPart>(): PartMatch<T> => ({ how: 'none', part: null, rivals: [], model: null })

function unique<T extends BookPart>(list: T[]): T[] {
  const seen = new Set<string>()
  return list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
}

/**
 * The part a row names. In order: the house's own number, the model number, the same name, the
 * words. A level with two or more parts returns them as rivals and no part, for a person to pick.
 * `except` leaves one part out (the part being edited).
 */
export function matchRow<T extends BookPart>(
  row: MatchRowInput,
  book: BookIndex<T>,
  codes: Map<string, HouseCode> = new Map(),
  except?: string | null,
): PartMatch<T> {
  // 1. The house's own number.
  if (row.supplyHouseId && foldCode(row.houseCode)) {
    const hit = codes.get(houseKey(row.supplyHouseId, row.houseCode!))
    if (hit?.notAPart) return { how: 'not_a_part', part: null, rivals: [], model: null }
    const part = hit?.partId ? book.byId.get(hit.partId) : undefined
    if (part && part.id !== except) return { how: 'house_number', part, rivals: [part], model: null }
  }

  // 2. The model number, from the row's own column and from its words.
  const models = [...new Set([foldCode(row.mfrNumber), ...modelNumbersIn(row.description), ...joinedModelNumbersIn(row.description)].filter((m) => m.length >= 5))]
  for (const model of models) {
    const fits = unique((book.byModel.get(model) ?? []).filter((p) => p.id !== except && sizesAgree(row.description, p.name, true)))
    if (fits.length === 1) return { how: 'model_number', part: fits[0]!, rivals: fits, model }
    if (fits.length > 1) return { how: 'model_number', part: null, rivals: fits, model }
  }

  // 3. The same name, however it is spaced or punctuated.
  const folded = foldName(row.description)
  if (folded) {
    const same = (book.byName.get(folded) ?? []).filter((p) => p.id !== except)
    if (same.length === 1) return { how: 'same_name', part: same[0]!, rivals: same, model: null }
    if (same.length > 1) return { how: 'same_name', part: null, rivals: same, model: null }
  }

  // 4. The words, and only where every size agrees.
  if (wordsOf(row.description).length >= 2) {
    const fits = (book.bySizes.get(sizesIn(row.description).join('|')) ?? [])
      .filter((p) => p.id !== except && sameWords(row.description, p.name))
      .sort((x, y) => x.name.localeCompare(y.name))
      .slice(0, 3)
    if (fits.length === 1) return { how: 'words', part: fits[0]!, rivals: fits, model: null }
    if (fits.length > 1) return { how: 'words', part: null, rivals: fits, model: null }
  }

  return none<T>()
}

/** The warning the Add Part form shows, or null when the name is new. */
export type AlreadyInBook<T extends BookPart = BookPart> = {
  /** The line above the parts: by its model number, by its name, or reads almost the same. */
  headline: string
  how: Exclude<MatchHow, 'house_number' | 'not_a_part' | 'none'>
  parts: T[]
}

/** A typed name checked against the book. Null while the name is too short to say, or is new. */
export function alreadyInBook<T extends BookPart>(typedName: string, book: BookIndex<T>, except?: string | null): AlreadyInBook<T> | null {
  if (foldName(typedName).length < 4) return null
  const m = matchRow({ description: typedName }, book, undefined, except)
  if (m.how === 'model_number') return { how: m.how, headline: 'Already in the book, by its model number.', parts: m.rivals.slice(0, 3) }
  if (m.how === 'same_name') return { how: m.how, headline: 'Already in the book, by its name.', parts: m.rivals.slice(0, 3) }
  if (m.how === 'words') return { how: m.how, headline: 'A part in the book says the same words.', parts: m.rivals.slice(0, 3) }
  return null
}

/**
 * Parts that share a model number and agree on their sizes: the Duplicates page's group by model.
 * Each part appears in one group at most, under the first model number it shares.
 */
export function sameModelGroups<T extends BookPart>(parts: T[]): { model: string; parts: T[] }[] {
  const book = indexBook(parts)
  const taken = new Set<string>()
  const groups: { model: string; parts: T[] }[] = []
  for (const [model, list] of [...book.byModel.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const free = unique(list).filter((p) => !taken.has(p.id))
    if (free.length < 2) continue
    // Within one model number, split by size: the 3/4 and the 1/2 of one valve are two parts.
    const used = new Set<string>()
    for (const head of free) {
      if (used.has(head.id)) continue
      const group = free.filter((p) => !used.has(p.id) && sizesAgree(head.name, p.name, true))
      if (group.length < 2) continue
      for (const p of group) { used.add(p.id); taken.add(p.id) }
      groups.push({ model, parts: group.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)) })
    }
  }
  return groups
}
