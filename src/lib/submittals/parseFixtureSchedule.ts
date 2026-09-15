/**
 * Plumbing fixture schedule parser (Submittals 1a — specified products).
 *
 * The estimator pastes the plan's PLUMBING FIXTURE SCHEDULE (text copied out
 * of a PDF) and this turns it into one row per fixture tag: the tag ("WC-1"),
 * the specified manufacturer and model ("TOTO", "CT708UVG#01"), the plain
 * description ("WATER CLOSET, WALL HUNG, 1.28 GPF"), and the bid's count rows
 * it most likely belongs to. Later the supply house's quoted product is
 * compared to the specified make/model (see ./productStatus.ts). Pure — no IO.
 *
 * Shape of the text this expects: one schedule row per line, the tag first.
 * PDF copies wrap long rows, so a line that does not start with a tag is
 * treated as the continuation of the previous row. Header lines ("PLUMBING
 * FIXTURE SCHEDULE", "MARK DESCRIPTION MFR MODEL …"), page numbers, and
 * numbered general notes are skipped, not appended.
 *
 * Manufacturer lookup is a known-brand list, case-insensitive, longest name
 * first at the earliest position (so "ZURN-WILKINS" wins over "ZURN" and
 * "JR SMITH" over "SMITH"). The model is the digit-bearing tokens that follow
 * the manufacturer, stopping at the first plain word, a connection size
 * (`3"`, `1/2"`), a rating (`1.28`, `40 GAL`), or a separator (`/`, `&`).
 */

import { foldPlural, tokenizeWords } from '../rfq/parseVendorReply'

export type ScheduleFixture = { id?: string; fixture: string }

export type ParsedScheduleLine = {
  raw: string
  /** Normalized upper-case, hyphenated ("WC 1" → "WC-1"). */
  tag: string | null
  /** The list spelling from KNOWN_MANUFACTURERS, or null when none was found. */
  manufacturer: string | null
  model: string | null
  /** Words between the tag and the manufacturer (or the whole rest when none). */
  description: string | null
  /** Best count-row candidates, highest score first, score 0..1. */
  fixtureMatches: Array<{ fixture: string; id?: string; score: number }>
  /**
   * exact: tag found AND a fixture match >= 0.8; fuzzy: tag found and best
   * match >= 0.4 or a manufacturer found; none otherwise.
   */
  confidence: 'exact' | 'fuzzy' | 'none'
}

export type ParsedSchedule = {
  lines: ParsedScheduleLine[]
  /** Header / blank / junk lines that produced no row. */
  skipped: string[]
}

/**
 * Brands a plumbing schedule names. Add freely — matching is case-insensitive
 * and the longest name wins at any position, so "Zurn-Wilkins" beats "Zurn"
 * and "Jay R. Smith" beats "Smith". Spaces, dots and hyphens inside a name
 * are flexible ("A.O. Smith" also matches "AO SMITH" and "A. O. SMITH").
 */
export const KNOWN_MANUFACTURERS: ReadonlyArray<string> = [
  'TOTO',
  'Kohler',
  'American Standard',
  'Sloan',
  'Zurn',
  'Zurn-Wilkins',
  'Wilkins',
  'Watts',
  'Febco',
  'Apollo',
  'Rheem',
  'Bradford White',
  'A.O. Smith',
  'AO Smith',
  'State',
  'Navien',
  'Rinnai',
  'Noritz',
  'Lochinvar',
  'Josam',
  'JR Smith',
  'Jay R. Smith',
  'J.R. Smith',
  'Smith',
  'Wade',
  'Mifab',
  'Elkay',
  'Oasis',
  'Halsey Taylor',
  'Haws',
  'Woodford',
  'Liberty',
  'Zoeller',
  'Fiat',
  'Mustee',
  'T&S',
  'T & S',
  'Chicago Faucets',
  'Symmons',
  'Moen',
  'Delta',
  'Leonard',
  'Webstone',
  'Amtrol',
  'Bell & Gossett',
  'B&G',
  'Taco',
  'Grundfos',
  'Armstrong',
  'Sioux Chief',
  'Oatey',
  'Charlotte',
  'Acorn',
  'Bradley',
  'Willoughby',
  'Just',
  'Franke',
  'InSinkErator',
  'Speakman',
  'Powers',
  'Lawler',
  'Cash Acme',
  'Caleffi',
  'Honeywell',
  'Nibco',
  'Viega',
  'Uponor',
]

export type ScheduleSynonym = {
  /** Tag prefixes ("WC", "LAV") that name this family. */
  tags: string[]
  /** Description phrases (lowercase; plural-folded words) that name it. */
  phrases: string[]
  /** Count-row vocabulary, most specific first. */
  targets: string[]
}

/**
 * Tag prefix / description phrase → the words a count row uses for the same
 * family. WH is deliberately in two entries (water heater and wall hydrant);
 * the description phrase decides between them, and a bare tag scores lower
 * than a phrase hit.
 */
export const SCHEDULE_TAG_SYNONYMS: ReadonlyArray<ScheduleSynonym> = [
  { tags: ['WC'], phrases: ['water closet', 'toilet'], targets: ['toilet', 'water closet', 'wc'] },
  { tags: ['LAV', 'L'], phrases: ['lavatory', 'lav'], targets: ['lavatory', 'lav', 'sink'] },
  { tags: ['DWH', 'WH', 'EWH', 'GWH', 'TWH'], phrases: ['water heater', 'heater'], targets: ['water heater', 'heater', 'wh'] },
  { tags: ['SH', 'SHR'], phrases: ['shower'], targets: ['shower'] },
  { tags: ['TUB', 'BT'], phrases: ['bathtub', 'tub'], targets: ['tub', 'shower/tub combo', 'bathtub'] },
  { tags: ['UR', 'U'], phrases: ['urinal'], targets: ['urinal'] },
  { tags: ['FD'], phrases: ['floor drain'], targets: ['floor drain', 'fd'] },
  { tags: ['RD', 'ORD'], phrases: ['roof drain'], targets: ['roof drain', 'rd'] },
  { tags: ['HB', 'WH', 'WHY'], phrases: ['hose bibb', 'hose bib', 'wall hydrant', 'hydrant'], targets: ['hose bibb', 'hose bib', 'hydrant', 'hb'] },
  { tags: ['EWC', 'DF', 'EDF'], phrases: ['water cooler', 'drinking fountain', 'bottle filler'], targets: ['water cooler', 'drinking fountain', 'ewc'] },
  { tags: ['MB', 'MS', 'SS'], phrases: ['mop basin', 'mop sink', 'service sink'], targets: ['mop basin', 'mop sink', 'service sink', 'mop'] },
  { tags: ['KS'], phrases: ['kitchen sink'], targets: ['kitchen sink'] },
  { tags: ['S', 'SK'], phrases: ['sink'], targets: ['sink'] },
  { tags: ['FCO', 'CO', 'WCO', 'GCO'], phrases: ['cleanout', 'clean out'], targets: ['cleanout', 'clean out', 'co', 'fco', 'wco', 'gco'] },
  { tags: ['RPZ', 'BFP', 'DCV', 'DCVA', 'RP', 'BF'], phrases: ['backflow', 'reduced pressure', 'double check'], targets: ['backflow', 'rpz', 'bfp'] },
  { tags: ['PRV'], phrases: ['pressure reducing', 'pressure regulating'], targets: ['pressure reducing valve', 'prv'] },
  { tags: ['ET', 'EXT'], phrases: ['expansion tank'], targets: ['expansion tank', 'et'] },
  { tags: ['ESP', 'SP', 'SE', 'EJ'], phrases: ['sump pump', 'sewage ejector', 'ejector', 'sump'], targets: ['sump pump', 'sewage ejector', 'ejector', 'sump'] },
  { tags: ['HWCP', 'CP', 'RCP'], phrases: ['circulating pump', 'recirc', 'recirculating'], targets: ['circulating pump', 'recirc', 'recirculating pump'] },
  { tags: ['FS'], phrases: ['floor sink'], targets: ['floor sink', 'fs'] },
  { tags: ['OSD', 'DN', 'ORD'], phrases: ['overflow', 'downspout nozzle', 'downspout'], targets: ['overflow', 'downspout nozzle', 'downspout'] },
  { tags: ['TD'], phrases: ['trench drain'], targets: ['trench drain'] },
  { tags: ['GI', 'GT'], phrases: ['grease interceptor', 'grease trap'], targets: ['grease interceptor', 'grease trap', 'interceptor'] },
  { tags: ['WM', 'WB', 'WMB'], phrases: ['washing machine', 'washer box', 'laundry box'], targets: ['washing machine box', 'washer box', 'washing machine'] },
  { tags: ['IM', 'IMB'], phrases: ['ice maker', 'icemaker'], targets: ['ice maker box', 'ice maker'] },
]

/** Words that look like a tag prefix at the head of a line but never are. */
const NOT_TAG_PREFIXES = new Set([
  'PAGE', 'SHEET', 'SHT', 'REV', 'NO', 'NOTE', 'NOTES', 'ITEM', 'REF', 'QTY', 'DWG', 'DET', 'SEC',
  'PART', 'PHASE', 'LEVEL', 'FLOOR', 'ROOM', 'BLDG', 'UNIT', 'SIZE', 'GRADE', 'CLASS', 'TYPE',
  'ASTM', 'ASME', 'ANSI', 'NSF', 'UL', 'CSA', 'IAPMO', 'ADA', 'MODEL', 'STEP', 'OF', 'THE', 'AT',
])

const TAG_HEAD = /^([A-Za-z]{1,5})\s*[-–—]?\s*(\d{1,3}[A-Za-z]?)(?![A-Za-z0-9]|\.\d|\/\d)/
const TAG_MORE = /^\s*(?:,|&|\/|\+|\band\b)\s*(?:([A-Za-z]{1,5})\s*[-–—]?\s*)?(\d{1,3}[A-Za-z]?)(?![A-Za-z0-9]|\.\d|\/\d)/i

/** "WC 1" / "wc-1" / "WC1" → "WC-1"; null when it is not a tag. */
export function normalizeTag(raw: string): string | null {
  const m = raw.trim().toUpperCase().match(/^([A-Z]{1,5})\s*[-–—]?\s*(\d{1,3}[A-Z]?)$/)
  if (!m) return null
  const prefix = m[1] ?? ''
  if (NOT_TAG_PREFIXES.has(prefix)) return null
  return `${prefix}-${m[2] ?? ''}`
}

const JUNK_LINE = [
  /\bschedule\b/i,
  /^(?:mark|tag|symbol|item|fixture)\b.*\b(?:description|desc|manufacturer|mfr|mfg|model|remarks)\b/i,
  /^(?:mark|tag|symbol|description|manufacturer|mfr|model|remarks|cw|hw|waste|vent|size|connections?)\s*$/i,
  /^(?:page|sheet|sht)\b/i,
  /^\d+(?:\s*(?:of|\/)\s*\d+)?$/,
  /^\d+[.)]\s/,
  /^(?:general\s+)?notes?\b/i,
  /^[\W_]*$/,
]

function isJunkLine(line: string): boolean {
  return JUNK_LINE.some((re) => re.test(line))
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A brand name as a pattern with flexible separators, bounded by non-alphanumerics. */
function manufacturerPattern(name: string): string {
  const parts = name.split(/[\s.-]+/).filter(Boolean).map(escapeRe)
  return `(?<![A-Za-z0-9])${parts.join('[\\s.-]*')}(?![A-Za-z0-9])`
}

const MANUFACTURER_RE = new RegExp(
  [...KNOWN_MANUFACTURERS]
    .sort((a, b) => b.length - a.length)
    .map((name) => `(${manufacturerPattern(name)})`)
    .join('|'),
  'i',
)
const MANUFACTURERS_BY_LENGTH = [...KNOWN_MANUFACTURERS].sort((a, b) => b.length - a.length)

/** Aliases ("J.R. Smith", "JR Smith"; "T&S", "T & S") share one spelling: the first in the list. */
const CANONICAL_MANUFACTURER = new Map<string, string>()
for (const name of KNOWN_MANUFACTURERS) {
  const key = name.replace(/[\s.-]+/g, '').toUpperCase()
  if (!CANONICAL_MANUFACTURER.has(key)) CANONICAL_MANUFACTURER.set(key, name)
}

type ManufacturerHit = { name: string; start: number; end: number }

function findManufacturer(text: string): ManufacturerHit | null {
  const m = MANUFACTURER_RE.exec(text)
  if (!m || m.index === undefined) return null
  // Which alternation group fired tells us the list spelling.
  for (let i = 1; i < m.length; i += 1) {
    if (m[i] !== undefined) {
      const listed = MANUFACTURERS_BY_LENGTH[i - 1] ?? m[0]
      const name = CANONICAL_MANUFACTURER.get(listed.replace(/[\s.-]+/g, '').toUpperCase()) ?? listed
      return { name, start: m.index, end: m.index + m[0].length }
    }
  }
  return null
}

const SIZE_TOKEN = /^(?:\d+(?:[-\s]\d\/\d)?|\d\/\d)(?:"|''|in|inch)$/i
const RATING_UNIT = /^(?:gal|gals|gallon|gallons|gpf|gpm|gph|psi|psig|mbh|btu|btuh|kw|w|v|vac|hp|a|amp|amps|lb|lbs|ft|in|deg|°f|f|ph|phase|hz)$/i
const RATING_TOKEN = /^\d+(?:\.\d+)?(?:gal|gpf|gpm|gph|psi|mbh|btu|btuh|kw|w|v|hp|a|amp|lb|lbs|hz)$/i
const SEPARATOR_TOKEN = /^(?:[/&+|,;:()-]+|w\/|with|and|or|per|by)$/i
const MODEL_LEAD_NOISE = /^(?:model|mdl|no|num|#|series|mfr|mfg|cat|part|p\/n)[.:#]*$/i
const TRAILING_SIZES = /(?:\s*(?<![A-Za-z0-9.])(?:\d+(?:[-\s]\d\/\d)?|\d\/\d)\s*(?:"|''|in\b|inch(?:es)?\b))+\s*$/i

function stripTokenPunctuation(tok: string): string {
  return tok.replace(/^[,;:]+|[,;:]+$/g, '')
}

function isSizeToken(tok: string): boolean {
  return SIZE_TOKEN.test(tok) || /^\d\/\d$/.test(tok)
}

/** Small decimals are ratings (1.28 GPF, 0.5 GPM), not models. */
function isSmallDecimal(tok: string): boolean {
  if (!/^\d+\.\d+$/.test(tok)) return false
  return Number(tok) <= 12
}

/**
 * The model tokens right after the manufacturer: digit-bearing tokens, joined
 * by single spaces, until a plain word, size, rating or separator. A pure
 * integer is a model only in first position ("ZURN 375", "JR SMITH 2005") —
 * later it reads as a rating ("PROPH40 T2 RH375 40 GAL" stops before 40).
 */
function readModelAfter(tokens: string[]): { model: string | null; consumed: number } {
  const out: string[] = []
  let i = 0
  while (i < tokens.length && MODEL_LEAD_NOISE.test(tokens[i] ?? '')) i += 1
  for (; i < tokens.length; i += 1) {
    const tok = stripTokenPunctuation(tokens[i] ?? '')
    if (!tok) break
    if (SEPARATOR_TOKEN.test(tok) || isSizeToken(tok) || isSmallDecimal(tok) || RATING_TOKEN.test(tok)) break
    const hasDigit = /\d/.test(tok)
    if (!hasDigit) break
    const next = stripTokenPunctuation(tokens[i + 1] ?? '')
    if (/^\d+$/.test(tok)) {
      if (out.length > 0) break
      if (next && RATING_UNIT.test(next)) break
    }
    out.push(tok)
    // A trailing comma on the token ends the model ("CT708UVG#01, ELONGATED").
    if (/[,;]$/.test(tokens[i] ?? '')) {
      i += 1
      break
    }
  }
  return { model: out.length > 0 ? out.join(' ') : null, consumed: i }
}

/** Without a manufacturer: the first token with letters AND digits, length >= 4, not a size or rating. */
function guessModel(rest: string): string | null {
  for (const rawTok of rest.split(' ')) {
    const tok = stripTokenPunctuation(rawTok)
    if (tok.length < 4) continue
    if (!/[A-Za-z]/.test(tok) || !/\d/.test(tok)) continue
    if (isSizeToken(tok) || RATING_TOKEN.test(tok) || /^\d+(?:st|nd|rd|th)$/i.test(tok)) continue
    return tok
  }
  return null
}

function cleanDescription(s: string): string | null {
  let d = s.replace(/\s+/g, ' ').trim()
  d = d.replace(TRAILING_SIZES, '')
  d = d.replace(/(?:\s*[-–—]+)+\s*$/, '')
  d = d.replace(/^[\s,;:|-]+|[\s,;:|-]+$/g, '').trim()
  return d ? d : null
}

type FixtureIndexEntry = { fixture: string; id?: string; joined: string; words: Set<string> }

function joinedWords(s: string): string {
  return ` ${tokenizeWords(s).join(' ')} `
}

function containsPhrase(joined: string, phrase: string): boolean {
  const p = phrase.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(foldPlural).join(' ')
  return p.length > 0 && joined.includes(` ${p} `)
}

const DESCRIPTION_STOPWORDS = new Set(['with', 'and', 'the', 'for', 'w', 'per', 'type', 'mount', 'mounted'])

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const w of a) if (b.has(w)) inter += 1
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

/**
 * Score one count row against a parsed line: a synonym hit (phrase 0.95, tag
 * 0.9, minus 0.02 per later target so "Lavatory" outranks "Kitchen sink" for
 * LAV) with a small word-overlap bonus, else plain Jaccard word overlap.
 */
function scoreFixture(tagPrefix: string | null, descJoined: string, descWords: Set<string>, f: FixtureIndexEntry): number {
  let best = 0
  for (const syn of SCHEDULE_TAG_SYNONYMS) {
    const phraseHit = syn.phrases.some((p) => containsPhrase(descJoined, p))
    const tagHit = tagPrefix !== null && syn.tags.includes(tagPrefix)
    if (!phraseHit && !tagHit) continue
    const base = phraseHit ? 0.95 : 0.9
    for (let i = 0; i < syn.targets.length; i += 1) {
      const target = syn.targets[i] ?? ''
      if (containsPhrase(f.joined, target)) {
        best = Math.max(best, base - 0.02 * i)
        break
      }
    }
  }
  const overlap = jaccard(descWords, f.words)
  if (best > 0) return Math.min(1, best + 0.05 * overlap)
  return overlap
}

type Record_ = { tags: string[]; rest: string; raw: string }

/** Read the tag(s) at the head of a collapsed line; null when the line has none. */
function readTags(line: string): { tags: string[]; rest: string } | null {
  const head = line.match(TAG_HEAD)
  if (!head) return null
  const prefix = (head[1] ?? '').toUpperCase()
  if (NOT_TAG_PREFIXES.has(prefix)) return null
  const tags = [`${prefix}-${(head[2] ?? '').toUpperCase()}`]
  let rest = line.slice(head[0].length)
  for (;;) {
    const more = rest.match(TAG_MORE)
    if (!more) break
    const p = more[1] ? more[1].toUpperCase() : prefix
    tags.push(`${p}-${(more[2] ?? '').toUpperCase()}`)
    rest = rest.slice(more[0].length)
  }
  return { tags, rest: rest.trim() }
}

function parseRecord(rec: Record_, fixtureIndex: FixtureIndexEntry[]): ParsedScheduleLine[] {
  const rest = rec.rest.replace(/\s+/g, ' ').trim()
  const hit = findManufacturer(rest)
  let manufacturer: string | null = null
  let model: string | null = null
  let description: string | null = null
  if (hit) {
    manufacturer = hit.name
    const after = rest.slice(hit.end).trim()
    const tokens = after ? after.split(' ') : []
    const read = readModelAfter(tokens)
    model = read.model
    const before = cleanDescription(rest.slice(0, hit.start))
    // Schedules that put MFR/MODEL before the description leave nothing in
    // front of the brand — fall back to what follows the model.
    description = before ?? cleanDescription(tokens.slice(read.consumed).join(' '))
  } else {
    description = cleanDescription(rest)
    model = guessModel(rest)
  }

  const descJoined = description ? joinedWords(description) : '  '
  const descWords = new Set(
    (description ? tokenizeWords(description) : []).filter((w) => w.length >= 2 && !DESCRIPTION_STOPWORDS.has(w)),
  )

  return rec.tags.map((tag) => {
    const prefix = tag.split('-')[0] ?? null
    const fixtureMatches = fixtureIndex
      .map((f) => ({ fixture: f.fixture, ...(f.id !== undefined ? { id: f.id } : {}), score: Number(scoreFixture(prefix, descJoined, descWords, f).toFixed(3)) }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score || a.fixture.localeCompare(b.fixture))
      .slice(0, 5)
    const best = fixtureMatches[0]?.score ?? 0
    const confidence: ParsedScheduleLine['confidence'] =
      best >= 0.8 ? 'exact' : best >= 0.4 || manufacturer !== null ? 'fuzzy' : 'none'
    return { raw: rec.raw, tag, manufacturer, model, description, fixtureMatches, confidence }
  })
}

export function parseFixtureSchedule(text: string, fixtures: ReadonlyArray<ScheduleFixture>): ParsedSchedule {
  const fixtureIndex: FixtureIndexEntry[] = fixtures.map((f) => ({
    fixture: f.fixture,
    ...(f.id !== undefined ? { id: f.id } : {}),
    joined: joinedWords(f.fixture),
    words: new Set(tokenizeWords(f.fixture)),
  }))

  const records: Record_[] = []
  const skipped: string[] = []
  let current: Record_ | null = null

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[\t ]+/g, ' ').trim()
    if (!line) {
      skipped.push('')
      continue
    }
    const head = readTags(line)
    if (head) {
      current = { tags: head.tags, rest: head.rest, raw: line }
      records.push(current)
      continue
    }
    if (isJunkLine(line) || current === null) {
      skipped.push(line)
      continue
    }
    // A wrapped row: the schedule's second line belongs to the tag above it.
    current.rest = `${current.rest} ${line}`.trim()
    current.raw = `${current.raw} ${line}`
  }

  const lines: ParsedScheduleLine[] = []
  for (const rec of records) lines.push(...parseRecord(rec, fixtureIndex))
  return { lines, skipped }
}
