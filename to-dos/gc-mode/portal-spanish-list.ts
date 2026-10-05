/**
 * GC mode design spike (Portal lane): redraws the word tables of PORTAL_SPANISH.md, every Spanish
 * string a trade can read, from the files that ship. Everything from the "### The portal" heading
 * down is rewritten, and the count in "N in all" is updated; the words above it are kept.
 *
 * Run it from the repo root after changing any portal words, then commit PORTAL_SPANISH.md:
 *   VITE_SUPABASE_URL=http://x VITE_SUPABASE_ANON_KEY=x npx vite-node to-dos/gc-mode/portal-spanish-list.ts
 * (The dummy Supabase values let the app's modules load; nothing is called.)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXCLUSION_ES, PORTAL_KEYS, portalString } from '../../src/lib/gcMode/gcPortalI18n'
import { BUILDING_WORD_KEYS, buildingWord } from '../../src/lib/gcMode/gcBuildingWords'
import { bidTabResult, followUpDraft, followUpPeople, gcReducer, initialGcState } from '../../src/lib/gcMode/gcModel'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DOC = resolve(ROOT, 'to-dos/gc-mode/PORTAL_SPANISH.md')
const MARK = '### The portal (the Portal lane'

/** key -> the `// group` comment above it in the source object. */
function groups(file: string): Map<string, string> {
  const out = new Map<string, string>()
  let group = ''
  for (const line of readFileSync(resolve(ROOT, file), 'utf8').split('\n')) {
    const c = /^ {2}\/\/ (.+)$/.exec(line)
    if (c?.[1]) group = c[1].trim()
    const k = /^ {2}(\w+): \{/.exec(line)
    if (k?.[1]) out.set(k[1], group)
  }
  return out
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const vars = new Set<string>()

function table(rows: { en: string; es: string }[]): string {
  for (const r of rows) for (const m of r.es.matchAll(/\{(\w+)\}/g)) if (m[1]) vars.add(m[1])
  return ['| English | Español |', '|---|---|', ...rows.map((r) => `| ${cell(r.en)} | ${cell(r.es)} |`)].join('\n')
}

function bySection(file: string, keys: readonly string[], get: (k: string) => { en: string; es: string }): string {
  const g = groups(file)
  const order: string[] = []
  const rows = new Map<string, { en: string; es: string }[]>()
  for (const k of keys) {
    const name = g.get(k) ?? 'Other'
    if (!rows.has(name)) {
      rows.set(name, [])
      order.push(name)
    }
    rows.get(name)?.push(get(k))
  }
  return order.map((name) => `#### ${name}\n\n${table(rows.get(name) ?? [])}`).join('\n\n')
}

// The bid tab's line, read the way the portal reads it: every case, from the made-up data.
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
const tabLines = [
  both((l) => bidTabResult(boerne, pkg0, 'x', l)),
  both((l) => bidTabResult(sent, pkg0, 'x', l)),
  both((l) => bidTabResult(helotes, notAwarded, 'x', l)),
  both((l) => bidTabResult(helotes, elec, winner, l)),
  both((l) => bidTabResult(helotes, elec, loser, l)),
  both((l) => bidTabResult(lostPrice, pkg0, 'x', l)),
  both((l) => bidTabResult(lostDied, pkg0, 'x', l)),
]
const tabWords = [
  { en: 'Rank', es: 'Lugar' },
  { en: 'Company', es: 'Empresa' },
  { en: 'Quote', es: 'Cotización' },
  { en: 'Over the low', es: 'Arriba de la más baja' },
  { en: 'low', es: 'la más baja' },
  { en: '(you)', es: '(usted)' },
  { en: 'awarded', es: 'adjudicada' },
  { en: 'Another company', es: 'Otra empresa' },
]

const portal = bySection('src/lib/gcMode/gcPortalI18n.ts', PORTAL_KEYS, (k) => portalString(k as never))
const building = bySection('src/lib/gcMode/gcBuildingWords.ts', BUILDING_WORD_KEYS, (k) => buildingWord(k as never))
const total = PORTAL_KEYS.length + BUILDING_WORD_KEYS.length + tabLines.length + tabWords.length + 4 + Object.keys(EXCLUSION_ES).length

const calendar = [
  { en: 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec', es: 'ene feb mar abr may jun jul ago sep oct nov dic' },
  { en: 'Sun Mon Tue Wed Thu Fri Sat', es: 'dom lun mar mié jue vie sáb' },
  { en: 'Oct 8 · Thu Oct 8', es: '8 oct · jue 8 oct' },
]
const disciplines = [
  ['General', 'General'], ['Civil', 'Civil'], ['Architectural', 'Arquitectónico'], ['Interiors', 'Interiores'],
  ['Structural', 'Estructural'], ['Mechanical', 'Mecánico'], ['Electrical', 'Eléctrico'], ['Plumbing', 'Plomería'],
  ['Fire protection', 'Protección contra incendios'], ['Landscape', 'Paisaje'], ['Technology', 'Tecnología'], ['Other', 'Otras'],
].map(([en, es]) => ({ en: en!, es: es! }))

// The notary block (Owner Billing lane, GcPayAppNotary.tsx): its lines are written inline, a blank as {blank(...)}.
function notaryLines(): { en: string; es: string }[] {
  const src = readFileSync(resolve(ROOT, 'src/components/gc/GcPayAppNotary.tsx'), 'utf8')
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
const notary = notaryLines()

// The papers the office sends from a company window (Board lane, gcPaperSend.ts): its { en, es } pairs, read from the source.
function pairsIn(file: string): { en: string; es: string }[] {
  const src = readFileSync(resolve(ROOT, file), 'utf8')
  const out: { en: string; es: string }[] = []
  for (const m of src.matchAll(/en: '((?:[^'\\]|\\.)*)',\s*es: '((?:[^'\\]|\\.)*)'/g)) out.push({ en: m[1]!.replace(/\\'/g, "'"), es: m[2]!.replace(/\\'/g, "'") })
  return out
}
const paperSend = pairsIn('src/lib/gcMode/gcPaperSend.ts')

// The Follow up sheet's drafts (Building lane, gcFollowUpSheet.ts), drawn for the made-up companies in each language.
function followUpSamples(): { en: string; es: string }[] {
  const base = initialGcState()
  const asLang = (lang: 'en' | 'es') => ({ ...base, partners: base.partners.map((p) => ({ ...p, lang })) })
  const out: { en: string; es: string }[] = []
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
const followUps = followUpSamples()

const body = [
  `### The portal (the Portal lane's words, \`gcPortalI18n.ts\`)`,
  portal,
  `#### The usual exclusions, by name`,
  table(Object.entries(EXCLUSION_ES).map(([en, es]) => ({ en, es }))),
  `#### Dates and the plans' disciplines`,
  table(calendar),
  table(disciplines),
  `### The pay application, closeout and punch list (the Building lane's words, \`gcBuildingWords.ts\`)`,
  building,
  `### The bid tab (the Board lane's words, \`bidTabResult\` in \`gcBids.ts\` and the table in \`GcBidTabs.tsx\`)`,
  `#### The line above the table, in each case`,
  table(tabLines),
  `#### The table`,
  table(tabWords),
  `### The papers the office sends from a company window (the Board lane's words, \`gcPaperSend.ts\`)`,
  table(paperSend),
  `### Follow up drafts to a company (the Building lane's, \`gcFollowUpSheet.ts\`, drawn for the made-up companies)`,
  `Each row is one whole message, subject first, then the body, with \`/\` for a new line. They are drawn from the code with real names and dates filled in.`,
  table(followUps),
  `### The notary block on a pay application (the Owner Billing lane's words, \`GcPayAppNotary.tsx\`)`,
  table(notary),
].join('\n\n')

const count = total + paperSend.length + followUps.length
const doc = readFileSync(DOC, 'utf8')
const at = doc.indexOf(MARK)
if (at < 0) throw new Error(`PORTAL_SPANISH.md has no "${MARK}" heading to redraw from`)
const kept = doc.slice(0, at).replace(/shows, \d+ in all/, `shows, ${count} in all`)
writeFileSync(DOC, `${kept}${body}\n`)
console.log(`PORTAL_SPANISH.md: ${count} strings. Blanks in the Spanish: ${[...vars].sort().map((v) => `{${v}}`).join(', ')}`)
