/**
 * GC mode design spike: the Spanish voice (round five; mock-up `to-dos/gc-mode/mockups/spanish-voice.md`).
 *
 * `SPANISH_TERMS` is one word for each thing a trade reads about in its portal, with the words the
 * voice review retired and the words kept out (what a writer might reach for, which no string
 * uses). `spanishPieces` gathers every Spanish string a trade can read, the way
 * `to-dos/gc-mode/portal-spanish-list.ts` prints them in `PORTAL_SPANISH.md`; the list script and
 * `gcSpanishVoice.test.ts` both read it, so a string the list shows is a string the pin scans.
 *
 * Out of the barrel. It reads source files only through the `read` it is given (the list script
 * and the test pass `readFileSync`), so nothing here imports Node.
 */
import { EXCLUSION_ES, PORTAL_KEYS, portalString } from './gcPortalI18n'
import { BUILDING_WORD_KEYS, buildingWord } from './gcBuildingWords'
import { bidTabResult, followUpDraft, followUpPeople, gcReducer, initialGcState } from './gcModel'
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { SpanishTerm } from '../gc/spanishVoice'
export { SPANISH_TERMS, TU_MARKERS, offWords, saysWord, spanishPlain } from '../gc/spanishVoice'

// ---------------------------------------------------------------------------------------------
// Every Spanish string a trade can read, gathered as PORTAL_SPANISH.md prints it
// ---------------------------------------------------------------------------------------------

export interface SpanishRow {
  en: string
  es: string
}

export interface SpanishGroup {
  name: string
  rows: SpanishRow[]
}

export interface SpanishPieces {
  portal: SpanishGroup[]
  exclusions: SpanishRow[]
  calendar: SpanishRow[]
  disciplines: SpanishRow[]
  building: SpanishGroup[]
  tabLines: SpanishRow[]
  tabWords: SpanishRow[]
  paperSend: SpanishRow[]
  followUps: SpanishRow[]
  notary: SpanishRow[]
}

/** Reads a file of the repo by its path from the root. */
export type ReadSource = (repoPath: string) => string

/** key -> the `// group` comment above it in the source object. */
function groupsOf(read: ReadSource, file: string): Map<string, string> {
  const out = new Map<string, string>()
  let group = ''
  for (const line of read(file).split('\n')) {
    const c = /^ {2}\/\/ (.+)$/.exec(line)
    if (c?.[1]) group = c[1].trim()
    const k = /^ {2}(\w+): \{/.exec(line)
    if (k?.[1]) out.set(k[1], group)
  }
  return out
}

function bySection(read: ReadSource, file: string, keys: readonly string[], get: (k: string) => SpanishRow): SpanishGroup[] {
  const g = groupsOf(read, file)
  const order: SpanishGroup[] = []
  const byName = new Map<string, SpanishGroup>()
  for (const k of keys) {
    const name = g.get(k) ?? 'Other'
    let group = byName.get(name)
    if (!group) {
      group = { name, rows: [] }
      byName.set(name, group)
      order.push(group)
    }
    group.rows.push(get(k))
  }
  return order
}

// The bid tab's line, read the way the portal reads it: every case, from the made-up data.
function bidTabLines(): SpanishRow[] {
  const s0 = initialGcState()
  const boerne = s0.projects.find((p) => p.id === 'boerne')!
  const helotes = s0.projects.find((p) => p.id === 'helotes')!
  const elec = helotes.packages.find((k) => k.awardedInviteId !== null)!
  const winner = elec.invites.find((i) => i.id === elec.awardedInviteId)!.partnerId
  const loser = elec.invites.find((i) => i.id !== elec.awardedInviteId)?.partnerId ?? 'nobody'
  const sent = gcReducer(s0, { type: 'markBidSent', projectId: 'boerne' }).projects.find((p) => p.id === 'boerne')!
  const lostPrice = gcReducer(s0, { type: 'markLost', projectId: 'boerne', why: 'price', wonBy: null, note: '' }).projects.find((p) => p.id === 'boerne')!
  const lostDied = gcReducer(s0, { type: 'markLost', projectId: 'boerne', why: 'project_died', wonBy: null, note: '' }).projects.find((p) => p.id === 'boerne')!
  const notAwarded = { ...elec, awardedInviteId: null }
  const pkg0 = boerne.packages[0]!
  const both = (f: (lang: 'en' | 'es') => string) => ({ en: f('en'), es: f('es') })
  return [
    both((l) => bidTabResult(boerne, pkg0, 'x', l)),
    both((l) => bidTabResult(sent, pkg0, 'x', l)),
    both((l) => bidTabResult(helotes, notAwarded, 'x', l)),
    both((l) => bidTabResult(helotes, elec, winner, l)),
    both((l) => bidTabResult(helotes, elec, loser, l)),
    both((l) => bidTabResult(lostPrice, pkg0, 'x', l)),
    both((l) => bidTabResult(lostDied, pkg0, 'x', l)),
  ]
}

const TAB_WORDS: SpanishRow[] = [
  { en: 'Rank', es: 'Lugar' },
  { en: 'Company', es: 'Empresa' },
  { en: 'Quote', es: 'Cotización' },
  { en: 'Over the low', es: 'Arriba de la más baja' },
  { en: 'low', es: 'la más baja' },
  { en: '(you)', es: '(usted)' },
  { en: 'awarded', es: 'adjudicada' },
  { en: 'Another company', es: 'Otra empresa' },
]

const CALENDAR: SpanishRow[] = [
  { en: 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec', es: 'ene feb mar abr may jun jul ago sep oct nov dic' },
  { en: 'Sun Mon Tue Wed Thu Fri Sat', es: 'dom lun mar mié jue vie sáb' },
  { en: 'Oct 8 · Thu Oct 8', es: '8 oct · jue 8 oct' },
]

const DISCIPLINES: SpanishRow[] = [
  ['General', 'General'], ['Civil', 'Civil'], ['Architectural', 'Arquitectónico'], ['Interiors', 'Interiores'],
  ['Structural', 'Estructural'], ['Mechanical', 'Mecánico'], ['Electrical', 'Eléctrico'], ['Plumbing', 'Plomería'],
  ['Fire protection', 'Protección contra incendios'], ['Landscape', 'Paisaje'], ['Technology', 'Tecnología'], ['Other', 'Otras'],
].map(([en, es]) => ({ en: en!, es: es! }))

// The notary block (Owner Billing lane, GcPayAppNotary.tsx): its lines are written inline, a blank as {blank(...)}.
function notaryLines(read: ReadSource): SpanishRow[] {
  const src = read('src/components/gc/GcPayAppNotary.tsx')
  const open = "lang === 'es' ? ("
  const es = src.slice(src.indexOf(open) + open.length, src.indexOf(') : ('))
  const en = src.slice(src.indexOf(') : (') + 5, src.lastIndexOf(')}'))
  const lines = (part: string) =>
    part
      .replace(/\{blank\('[^']*'\)\}/g, '___')
      .split('</div>')
      .map((x) => x.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').replace(/^[\s(:?)]+/, '').trim())
      .filter((x) => x.length > 2)
  const a = lines(en)
  const b = lines(es)
  return a.map((x, i) => ({ en: x, es: b[i] ?? '' }))
}

// The papers the office sends from a company window (Board lane, gcPaperSend.ts): its { en, es } pairs, read from the source.
function pairsIn(read: ReadSource, file: string): SpanishRow[] {
  const src = read(file)
  const out: SpanishRow[] = []
  for (const m of src.matchAll(/en: '((?:[^'\\]|\\.)*)',\s*es: '((?:[^'\\]|\\.)*)'/g)) out.push({ en: m[1]!.replace(/\\'/g, "'"), es: m[2]!.replace(/\\'/g, "'") })
  return out
}

// The Follow up sheet's drafts (Building lane, gcFollowUpSheet.ts), drawn for the made-up companies in each language.
function followUpSamples(): SpanishRow[] {
  const base = initialGcState()
  const asLang = (lang: 'en' | 'es') => ({ ...base, partners: base.partners.map((p) => ({ ...p, lang })) })
  const out: SpanishRow[] = []
  const seen = new Set<string>()
  const choices = [
    { from: 'me', via: 'text', length: 'nudge' },
    { from: 'company', via: 'email', length: 'note' },
  ] as const
  const enPeople = followUpPeople(asLang('en'))
  const esPeople = followUpPeople(asLang('es'))
  for (const person of enPeople) {
    const twin = esPeople.find((x) => x.partner.id === person.partner.id)
    if (!twin) continue
    for (const c of choices) {
      const en = followUpDraft(person, person.items, c, 'Dana Whitaker')
      const es = followUpDraft(twin, twin.items, c, 'Dana Whitaker')
      const key = en.body
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ en: `${en.subject} · ${en.body}`.replace(/\n+/g, ' / '), es: `${es.subject} · ${es.body}`.replace(/\n+/g, ' / ') })
    }
    if (out.length >= 12) break
  }
  return out
}

/** Every Spanish string a trade can read, in the pieces PORTAL_SPANISH.md prints them in. */
export function spanishPieces(read: ReadSource): SpanishPieces {
  return {
    // The word table lives on main since the Portal lane's P0 (src/lib/gc/portalI18n.ts); its section comments still group the list.
    portal: bySection(read, 'src/lib/gc/portalI18n.ts', PORTAL_KEYS, (k) => portalString(k as never)),
    exclusions: Object.entries(EXCLUSION_ES).map(([en, es]) => ({ en, es })),
    calendar: CALENDAR,
    disciplines: DISCIPLINES,
    // Building's words live on main since its U2 (src/lib/gc/buildingWords.ts).
    building: bySection(read, 'src/lib/gc/buildingWords.ts', BUILDING_WORD_KEYS, (k) => buildingWord(k as never)),
    tabLines: bidTabLines(),
    tabWords: TAB_WORDS,
    // The first sends' lines moved to main with the Board's B2-i (src/lib/gc/paperSend.ts); the rest are still the spike's.
    paperSend: [...pairsIn(read, 'src/lib/gc/paperSend.ts'), ...pairsIn(read, 'src/lib/gcMode/gcPaperSend.ts')],
    followUps: followUpSamples(),
    notary: notaryLines(read),
  }
}

/** The same strings in one list, for the scan. */
export function spanishCorpus(read: ReadSource): SpanishRow[] {
  const p = spanishPieces(read)
  return [
    ...p.portal.flatMap((g) => g.rows),
    ...p.exclusions,
    ...p.calendar,
    ...p.disciplines,
    ...p.building.flatMap((g) => g.rows),
    ...p.tabLines,
    ...p.tabWords,
    ...p.paperSend,
    ...p.followUps,
    ...p.notary,
  ]
}
