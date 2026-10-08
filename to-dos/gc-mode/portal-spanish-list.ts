/**
 * GC mode design spike (Portal lane): redraws the word tables of PORTAL_SPANISH.md, every Spanish
 * string a trade can read, from the files that ship. Everything from the "### The portal" heading
 * down is rewritten, and the count in "N in all" is updated; the words above it are kept.
 *
 * The strings come from `spanishPieces` in `src/lib/gcMode/gcSpanishVoice.ts` (the Spanish voice,
 * round five), the same gathering `gcSpanishVoice.test.ts` scans, so every string listed here is a
 * string the pin reads. The last table, One word for each thing, is drawn from `SPANISH_TERMS`.
 *
 * Run it from the repo root after changing any portal words, then commit PORTAL_SPANISH.md:
 *   VITE_SUPABASE_URL=http://x VITE_SUPABASE_ANON_KEY=x npx vite-node to-dos/gc-mode/portal-spanish-list.ts
 * (The dummy Supabase values let the app's modules load; nothing is called.)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXCLUSION_ES, PORTAL_KEYS } from '../../src/lib/gcMode/gcPortalI18n'
import { BUILDING_WORD_KEYS } from '../../src/lib/gcMode/gcBuildingWords'
import { SPANISH_TERMS, spanishPieces, type SpanishGroup } from '../../src/lib/gcMode/gcSpanishVoice'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DOC = resolve(ROOT, 'to-dos/gc-mode/PORTAL_SPANISH.md')
const MARK = '### The portal (the Portal lane'

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const vars = new Set<string>()

function table(rows: { en: string; es: string }[]): string {
  for (const r of rows) for (const m of r.es.matchAll(/\{(\w+)\}/g)) if (m[1]) vars.add(m[1])
  return ['| English | Español |', '|---|---|', ...rows.map((r) => `| ${cell(r.en)} | ${cell(r.es)} |`)].join('\n')
}

const bySection = (groups: SpanishGroup[]) => groups.map((g) => `#### ${g.name}\n\n${table(g.rows)}`).join('\n\n')

const p = spanishPieces((file) => readFileSync(resolve(ROOT, file), 'utf8'))
const total = PORTAL_KEYS.length + BUILDING_WORD_KEYS.length + p.tabLines.length + p.tabWords.length + 4 + Object.keys(EXCLUSION_ES).length

// One word for each thing (the Spanish voice, round five): the words a test pins, drawn from the code.
const words = (list: string[]) => list.map((w) => `*${w}*`).join(', ')
const terms = [
  '| Thing | The one word | Retired 2026-10-06 | Kept out |',
  '|---|---|---|---|',
  ...SPANISH_TERMS.map(
    (t) => `| ${t.en} | **${t.es}**${t.note ? ` (${cell(t.note)})` : ''}${t.notYet ? ' (kept for when it comes)' : ''} | ${words(t.retired)} | ${words(t.keptOut)} |`,
  ),
].join('\n')

const body = [
  `### The portal (the Portal lane's words, \`src/lib/gc/portalI18n.ts\`)`,
  bySection(p.portal),
  `#### The usual exclusions, by name`,
  table(p.exclusions),
  `#### Dates and the plans' disciplines`,
  table(p.calendar),
  table(p.disciplines),
  `### The pay application, closeout and punch list (the Building lane's words, \`gcBuildingWords.ts\`)`,
  bySection(p.building),
  `### The bid tab (the Board lane's words, \`bidTabResult\` in \`gcBids.ts\` and the table in \`GcBidTabs.tsx\`)`,
  `#### The line above the table, in each case`,
  table(p.tabLines),
  `#### The table`,
  table(p.tabWords),
  `### The papers the office sends from a company window (the Board lane's words, \`gcPaperSend.ts\`)`,
  table(p.paperSend),
  `### Follow up drafts to a company (the Building lane's, \`gcFollowUpSheet.ts\`, drawn for the made-up companies)`,
  `Each row is one whole message, subject first, then the body, with \`/\` for a new line. They are drawn from the code with real names and dates filled in.`,
  table(p.followUps),
  `### The notary block on a pay application (the Owner Billing lane's words, \`GcPayAppNotary.tsx\`)`,
  table(p.notary),
  `### One word for each thing (\`SPANISH_TERMS\` in \`gcSpanishVoice.ts\`, pinned by its test)`,
  `A company reads one word for each of these, everywhere in the portal. \`gcSpanishVoice.test.ts\` scans every string above for the retired words, the words kept out and the *tú* forms, as whole words, ignoring case and accents. To change a word, change it here in the code and in the strings, then redraw this page.`,
  terms,
].join('\n\n')

const count = total + p.paperSend.length + p.followUps.length
const doc = readFileSync(DOC, 'utf8')
const at = doc.indexOf(MARK)
if (at < 0) throw new Error(`PORTAL_SPANISH.md has no "${MARK}" heading to redraw from`)
const kept = doc.slice(0, at).replace(/shows, \d+ in all/, `shows, ${count} in all`)
writeFileSync(DOC, `${kept}${body}\n`)
console.log(`PORTAL_SPANISH.md: ${count} strings. Blanks in the Spanish: ${[...vars].sort().map((v) => `{${v}}`).join(', ')}`)
