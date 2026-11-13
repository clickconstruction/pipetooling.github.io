#!/usr/bin/env node
/**
 * The Lien desk's views and papers, renamed in two steps on the owner's picks of 2026-11-13.
 * Step one (v2.7207), the three views:
 *
 *   Do now       →  To do      (the count stays: To do · 34)
 *   Deadlines    →  By date
 *   All filings  →  By paper
 *
 * The first tab is the work; the others are the same jobs sorted. Step two (v2.7219) names the
 * three papers under By paper and moves the fourth list up as a view, By job: see PAPER_RULES below.
 * The addresses keep their words (`?tab=deadlines`, `notices`, `affidavits`, `retainage`,
 * `timeline`), so old links and printed codes still open.
 *
 * What it changes: string literals, JSX text, comments, test names, the guides and the living docs.
 * What it never touches: identifiers (none holds a space, and `openDeadlines`, `lienDeadlines`,
 * `key: 'deadlines'`, `'do-now'`, `LienDeskCalendarTab` have no word edge before the name), a
 * guide's `keywords:` line (the old names stay there so a search for them still finds the guide),
 * release notes, recent-features fragments, migrations' notes, prototypes, the to-dos cards, and
 * the generated twin brief (run `node scripts/build-twin-mcp-briefs.mjs` after this).
 *
 * "Do now" and "All filings" name nothing else in the scope, so they are replaced whole.
 * "Deadlines" mostly means a last day. Only the shapes in DEADLINES below are the view: a label in
 * quotes or marks, the word before tab / view / grid / board / list / row / mark, the word after
 * on / opens / to / at, and the word in a list of the three views. A sentence about a deadline
 * (*Deadlines are per job…*) matches none of them.
 *
 * A sentence that tells the history keeps the old names: write it as *Do now until v2.7207* (or the
 * three joined by commas, "and" or " · " before "until v2.NNNN") and a second run leaves it alone.
 *
 *   node scripts/codemods/lien-desk-view-names.mjs --check   # list what would change, exit 1 if any
 *   node scripts/codemods/lien-desk-view-names.mjs           # apply
 *
 * Safe to run twice. On a rebase conflict, take main's side and run it again.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const check = process.argv.includes('--check')

const SKIP = [
  /^src\/content\/releaseNotes/, // frozen history, the folder and the two aggregators
  /^docs\/recent-features\//,
  /^docs\/RECENT_FEATURES\.md$/,
  /^docs\/migrations\//,
  /^docs\/prototypes\//,
  /^docs\/COUNSEL_MEMO/,
  /^supabase\/functions\/twin-mcp\/briefs\.ts$/, // generated from docs/twins
  /^scripts\/codemods\/lien-desk-view-names\.mjs$/,
  /^to-dos\//, // each card is its session's; the closed ones are history
]
// `:(glob)` so `**/` also matches no folder at all (src/index.css, docs/GLOSSARY.md).
const GLOBS = ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.css', 'src/**/*.md', 'docs/**/*.md', 'supabase/functions/**/*.ts', 'scripts/**/*.mjs', 'e2e/**/*.ts', '*.md']
const files = execSync(`git ls-files ${GLOBS.map((g) => `':(glob)${g}'`).join(' ')}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\n')
  .filter((f) => f && !SKIP.some((re) => re.test(f)))

const OLD = '(?:Do now|Deadlines|All filings)'
/** History, kept as written: the old names before "until v2.NNNN", and the 2026 triple with Calendar in it. */
const KEEP = [
  /Do now · Calendar · All filings/g,
  new RegExp(`${OLD}(?:(?:, | and | · )${OLD})*[*_]{0,2} until v2\\.\\d+`, 'g'),
]

/** The view's noun after its name: *the Deadlines tab*, *a Deadlines row*. */
const NOUN = '(tab|view|grid|board|list|rows?|marks?|door|work label|runway|pills?)'

const RULES = [
  // ── Do now → To do ──
  [/\bDo now\b/g, 'To do'],
  // ── All filings → By paper ──
  [/\bAll filings\b/g, 'By paper'],
  // ── Deadlines → By date, the view only ──
  [/\bthe Deadlines calendar\b/g, 'the By date view'],
  [new RegExp(`\\bDeadlines ${NOUN}\\b`, 'g'), 'By date $1'],
  [/\bDeadlines (or|and) Timeline\b/g, 'By date $1 Timeline'],
  // A label: in quotes, in a tag, in a guide's button token, in bold or italics, in brackets.
  [/(['"`>|*(])Deadlines(?=['"`<}*)])/g, '$1By date'],
  [/\bDeadlines ›/g, 'By date ›'],
  // In a list of the three views.
  [/\b(To do(?:,| ·| and| and on)) Deadlines\b/g, '$1 By date'],
  [/\bDeadlines((?:,| ·| and) By paper)\b/g, 'By date$1'],
  [/\bBy paper and on Deadlines\b/g, 'By paper and on By date'],
  // After the word that points at a view. Never *on Deadlines are…*: that one is a last day.
  [/\b(desk['’]s) Deadlines\b/g, '$1 By date view'],
  [/\b(on|On|opens|open|Open|to|at|off) Deadlines\b(?! (?:are|is|were|was|fall|falls|come|comes)\b)/g, '$1 By date'],
]

/**
 * The second row, renamed with the fourth view (v2.7219, the owner's pick of 2026-11-13):
 *
 *   Notices     →  Monthly notices     (under By paper)
 *   Affidavits  →  Lien affidavits     (under By paper)
 *   Retainage   →  Retainage notices   (under By paper)
 *   Timeline    →  By job              (a view of its own, beside By paper)
 *
 * All four are everyday words, so these rules run only in the files listed here, each read first,
 * and only on the tab's name: the word before "tab", the word in bold in a lien guide, and
 * *on Notices* / *on Affidavits* in a door. *The Notices list*, *the Affidavits pane*, the rails
 * on To do, the lien month's zones and the Legal desk's own Timeline tab keep their words.
 */
const PAPER_FILES = new Set([
  'src/components/jobs/LienDesk.tsx',
  'src/components/jobs/LienDesk.render.test.tsx',
  'src/components/jobs/LienDeskAffidavitPane.tsx',
  'src/components/jobs/LienDeskAffidavitPane.render.test.tsx',
  'src/components/jobs/LienDeskCalendarTab.tsx',
  'src/components/jobs/LienDeskRetainagePane.tsx',
  'src/content/help/answer-an-owner-who-calls-about-a-lien-letter.md',
  'src/content/help/file-a-lien-and-never-miss-its-deadlines.md',
  'src/content/help/read-the-pipeline-money-view.md',
  'src/content/help/see-what-is-due-on-the-lien-calendar.md',
  'src/content/help/see-which-supply-houses-are-owed-on-a-lien-job.md',
  'src/content/help/send-lien-notices-from-the-lien-desk.md',
  'src/content/help/share-your-attorney-their-portal.md',
  'docs/LIEN_DESK_ARCHITECTURE.md',
])
/** The lien month's second zone is named Notices too, and stays. */
const PAPER_KEEP = [/- \*\*Notices\*\*, days 6 to 9/g]
const PAPER_RULES = [
  [/\bNotices tab\b/g, 'Monthly notices tab'],
  [/\bAffidavits tab\b/g, 'Lien affidavits tab'],
  [/\bRetainage tab\b/g, 'Retainage notices tab'],
  [/\bTimeline tab\b/g, 'By job tab'],
  [/\*\*Notices\*\*/g, '**Monthly notices**'],
  [/\*\*Affidavits\*\*/g, '**Lien affidavits**'],
  [/\*\*Retainage\*\*/g, '**Retainage notices**'],
  [/\*\*Timeline\*\*/g, '**By job**'],
  [/\bon Notices\b(?! (?:list|pane|and|week)\b)/g, 'on Monthly notices'],
  [/\bon Affidavits\b(?! (?:list|pane|and)\b)/g, 'on Lien affidavits'],
]

/**
 * The sentences the rules leave reading oddly (*on By date*, *To do stops asking*), each rewritten
 * in plain words, and the guides' search words. Per file: the words as the rules leave them, then
 * the words wanted. Applied after the rules; one already rewritten is left alone, and one that is
 * no longer there is named so a person looks.
 */
const HELP = 'src/content/help/'
const DESK_GUIDE = `${HELP}send-lien-notices-from-the-lien-desk.md`
const SENTENCES = [
  [DESK_GUIDE, 'keywords: lien desk, lien notice,', 'keywords: lien desk, to do, by date, by paper, do now, deadlines, all filings, lien notice,'],
  [DESK_GUIDE, '## Start on To do', '## Start on the To do tab'],
  [DESK_GUIDE, 'points you at the Deadlines.', 'points you at the **By date** tab.'],
  [DESK_GUIDE, 'The top of the desk has three tabs.\n', 'The top of the desk has three tabs. **To do** is the work. The other two show the same jobs sorted two ways.\n'],
  [DESK_GUIDE, '- **By date** shows when each deadline falls.', '- **By date** sorts the jobs by when each deadline falls.'],
  [DESK_GUIDE, '- **By paper** holds every paper by its state.', '- **By paper** sorts them by the kind of paper. Each paper shows its state.'],
  [DESK_GUIDE, 'By paper reopens on the tab you last used there. This guide names those four tabs often. Each one sits under By paper.', '**By paper** reopens on the tab you last used there. This guide names those four tabs often. Each one sits under **By paper**.'],
  [DESK_GUIDE, '## Look ahead on the Deadlines', '## Look ahead by date'],
  [DESK_GUIDE, 'The **By date** tab is beside To do.', 'The **By date** tab is beside **To do**.'],
  [DESK_GUIDE, 'It is on every By date and Timeline row.', 'It is on every row of the **By date** tab and of the Timeline tab.'],
  [DESK_GUIDE, 'The Deadlines is shown step by step in', 'The **By date** tab is shown step by step in'],
  [DESK_GUIDE, 'A door from the Dashboard or from To do can open', 'A door from the Dashboard or from the **To do** tab can open'],
  [DESK_GUIDE, 'On **By date**, the date where a row', 'On the **By date** tab, the date where a row'],
  [DESK_GUIDE, 'is a red row on To do.', 'is a red row on the **To do** tab.'],
  [DESK_GUIDE, 'and To do stops asking.', 'and the **To do** tab stops asking.'],
  [DESK_GUIDE, 'On To do the same press sits', 'On the **To do** tab the same press sits'],
  [`${HELP}see-what-is-due-on-the-lien-calendar.md`, 'keywords: lien calendar, lien desk,', 'keywords: lien calendar, by date, deadlines, lien desk,'],
  [`${HELP}see-what-is-due-on-the-lien-calendar.md`, '## Open By date', '## Open the By date tab'],
  [`${HELP}see-what-is-due-on-the-lien-calendar.md`, 'tab, beside To do.', 'tab, beside **To do**.'],
  [`${HELP}read-the-reminders-ladder-on-the-lien-desk.md`, 'lien desk, do now, courtesy notice', 'lien desk, to do, do now, courtesy notice'],
  [`${HELP}read-the-reminders-ladder-on-the-lien-desk.md`, "The Lien desk's To do draws", "The Lien desk's To do tab draws"],
  [`${HELP}understand-how-liens-work-and-which-lien-tool-to-use.md`, 'Lien desk, Do now, liens on job', 'Lien desk, To do, By date, By paper, Do now, liens on job'],
  [`${HELP}read-the-pipeline-money-view.md`, 'That row opens the desk on **To do**.', 'That row opens the desk on its **To do** tab.'],
  [`${HELP}send-a-courtesy-notice-before-a-lien.md`, 'Open the Lien desk and go to **To do**.', 'Open the Lien desk and go to the **To do** tab.'],
  // The sentences that tell the names' history, and a comment whose name is split over two lines.
  ['docs/LIEN_DESK_ARCHITECTURE.md', "*To do · By date · By paper* (named *Do now · Calendar · All filings* until v2.4630, when the owner renamed them and dropped By paper's count; only To do carries one)", "*To do · By date · By paper* (the owner's names since v2.7207, picked 2026-11-13: the first is the work, the other two the same jobs sorted two ways; named *Do now · Deadlines · All filings* until v2.7207 and *Do now · Calendar · All filings* until v2.4630, when the owner renamed them and dropped the third view's count; only To do carries one; the code's words `next`, `calendar` and `paper` and the address's `?tab=deadlines` are unchanged)"],
  ['docs/LIEN_DESK_ARCHITECTURE.md', '**Calendar** (every billed job on its lien clock, tab extracted;', '**By date** (`kind` `calendar`: every billed job on its lien clock, tab extracted;'],
  ['docs/GLOSSARY.md', 'Since v2.4583 it opens on **To do**: one list', 'Since v2.4583 it opens on **To do** (Do now until v2.7207): one list'],
  ['docs/GLOSSARY.md', 'Since v2.4588 its top row is three views, **Do now · Calendar · All filings**; Notices,', "Since v2.4588 its top row is three views, **To do · By date · By paper** (the owner's names since **v2.7207**: the first is the work, the other two the same jobs sorted two ways; **Do now · Calendar · All filings** at first, and Do now, Deadlines and All filings until v2.7207; the addresses keep `?tab=deadlines`); Notices,"],
  ['docs/GLOSSARY.md', "### Lien calendar (Lien desk)\nThe Lien desk's first tab (v2.4101 the shell,", "### Lien calendar (Lien desk)\nThe Lien desk's **By date** view (Deadlines until v2.7207; v2.4101 the shell,"],
  ['docs/twins/APP_DIRECTORY.md', 'one desk: **To do** (every lien paper', 'one desk, three views (Do now, Deadlines and All filings until v2.7207): **To do** (every lien paper'],
  ['src/components/jobs/LienDesk.tsx', '(named Next up, Calendar, All paper until v2.4630; only To do carries a count)', "(named Next up, Calendar, All paper until v2.4630 and Do now, Deadlines, All filings until v2.7207, the owner's pick: the first is the work, the other two the same jobs sorted two ways; only To do carries a count)"],
  ['src/components/jobs/LienDesk.tsx', '// To do (punch list #82; Next up until v2.4630):', '// To do (punch list #82; Next up until v2.4630, Do now until v2.7207):'],
  ['src/components/jobs/LienDesk.tsx', '// By paper (punch list #82, PR 5; All paper until v2.4630):', '// By paper (punch list #82, PR 5; All paper until v2.4630, All filings until v2.7207):'],
  [
    'src/lib/lien/lienDeskRoute.ts',
    ' * to paste. `?tab=` is the view by a plain word — `deadlines` for the By date grid, and under All\n * filings `notices`, `affidavits`, `retainage` or `timeline`; To do is the default and never written.\n',
    ' * to paste. `?tab=` is the view by a plain word — `deadlines` for the By date grid (Deadlines until\n * v2.7207; the word stays, so old links and printed codes still open), and under By paper `notices`,\n * `affidavits`, `retainage` or `timeline`; To do is the default and never written.\n',
  ],
  // ── v2.7219: the second row's names and By job. Each starts from the words the rules above leave. ──
  [DESK_GUIDE, 'keywords: lien desk, to do, by date, by paper, do now,', 'keywords: lien desk, to do, by date, by paper, by job, monthly notices, lien affidavits, retainage notices, timeline, do now,'],
  [DESK_GUIDE, '## The three views', '## The four views'],
  [DESK_GUIDE, 'The top of the desk has three tabs. **To do** is the work. The other two show the same jobs sorted two ways.', 'The top of the desk has four tabs. **To do** is the work. The other three show the same jobs sorted three ways.'],
  [DESK_GUIDE, 'They are **Monthly notices**, **Lien affidavits**, **Retainage notices** and **By job**.', 'They are **Monthly notices**, **Lien affidavits** and **Retainage notices**.\n- **By job** lists every job with its whole path. The job with the nearest date comes first.'],
  [DESK_GUIDE, 'This guide names those four tabs often.', 'This guide names those three tabs often.'],
  [DESK_GUIDE, 'and of the By job tab. On the Notices, Affidavits and Retainage tabs it is at', 'and of the **By job** tab. On the three tabs under **By paper** it is at'],
  [DESK_GUIDE, 'The three tabs sit under it, each as tall as a thumb.', 'The four tabs sit under it, each as tall as a thumb.'],
  [`${HELP}file-a-lien-and-never-miss-its-deadlines.md`, '{{button:outline|Open the Timeline}}', '{{button:outline|Open By job}}'],
  [`${HELP}see-which-supply-houses-are-owed-on-a-lien-job.md`, 'It also shows on the Notices, Affidavits and Retainage lists.', 'It also shows on the three lists under By paper.'],
  [`${HELP}understand-how-liens-work-and-which-lien-tool-to-use.md`, 'Lien desk, To do, By date, By paper, Do now, liens on job', 'Lien desk, To do, By date, By paper, By job, Do now, liens on job'],
  [`${HELP}understand-how-liens-work-and-which-lien-tool-to-use.md`, '**By paper → Retainage**.', '**By paper → Retainage notices**.'],
  [`${HELP}understand-how-liens-work-and-which-lien-tool-to-use.md`, "under the desk's Affidavits switch", "on the desk's **Lien affidavits** tab"],
  [`${HELP}understand-how-liens-work-and-which-lien-tool-to-use.md`, "The desk's other two views are *By date* and *By paper*.", "The desk's other three views are *By date*, *By paper* and *By job*."],
  [`${HELP}texas-lien-rules-the-app-follows.md`, 'Draft it on the Lien desk under Notices.', 'Draft it on the Lien desk, on the **Monthly notices** tab.'],
  ['src/lib/dashboardNeedsYou.ts', 'The Lien desk’s Timeline lists each job with its date.', 'The Lien desk’s By job tab lists each job with its date.'],
  ['src/lib/dashboardNeedsYou.ts', "actionLabel: 'Open the Timeline'", "actionLabel: 'Open By job'"],
  ['src/lib/dashboardNeedsYou.test.ts', "toBe('Open the Timeline')", "toBe('Open By job')"],
  ['src/lib/jobs/lienDeskLegend.ts', ' * Seven parts in the order', ' * Eight parts in the order'],
  [
    'src/lib/jobs/lienDeskLegend.ts',
    "note: 'Every paper by its state, under Notices, Affidavits, Retainage and Timeline.' },\n",
    "note: 'Every paper by its state, under Monthly notices, Lien affidavits and Retainage notices.' },\n    { key: 'by-job', label: 'By job', note: 'Every job with its whole path, the nearest date first.' },\n",
  ],
  ['src/lib/customerJourneys.ts', "Lien desk → By paper → Retainage'", "Lien desk → By paper → Retainage notices'"],
  ['src/lib/lien/lienDeskRoute.ts', 'To do, By date, and the four lists under By paper. */', 'To do, By date, the three papers under By paper, and By job (`timeline`; a fourth list under By paper until v2.7219). */'],
  ['docs/GLOSSARY.md', '; Notices, Affidavits, Retainage and Timeline are a second row under By paper.', '; Monthly notices, Lien affidavits and Retainage notices are a second row under By paper, and since **v2.7219** By job is a fourth view beside it (the row read Notices, Affidavits, Retainage and Timeline until then; `?tab=timeline` still opens it).'],
  ['docs/GLOSSARY.md', '**The Timeline tab** (v2.3768): the fourth switch', '**By job** (the Timeline tab under By paper until v2.7219; v2.3768): the fourth view'],
  ['docs/GLOSSARY.md', '→ the Timeline tab (`/lien-desk?tab=timeline`)', '→ By job (`/lien-desk?tab=timeline`)'],
  ['docs/twins/APP_DIRECTORY.md', 'one desk, three views (Do now, Deadlines and All filings until v2.7207)', 'one desk, four views (Do now, Deadlines and All filings until v2.7207)'],
  ['docs/twins/APP_DIRECTORY.md', "on the shared axis) and **By paper** (Notices · Affidavits · Retainage · Timeline),", "on the shared axis), **By paper** (Monthly notices · Lien affidavits · Retainage notices) and **By job** (every job's whole path; the Timeline tab under By paper until v2.7219),"],
  ['docs/PROJECT_DOCUMENTATION.md', '`LienDeskPage.tsx` — the ⏱ Lien desk as a page at `/lien-desk` (punch list #182, v2.6777;', '`LienDeskPage.tsx` — the ⏱ Lien desk as a page at `/lien-desk`, four views since v2.7219, **To do · By date · By paper · By job**, with **Monthly notices · Lien affidavits · Retainage notices** under By paper (punch list #182, v2.6777;'],
  ['docs/LIEN_DESK_ARCHITECTURE.md', 'then the three views at the full width', 'then the four views at the full width'],
  ['docs/LIEN_DESK_ARCHITECTURE.md', 'the last with its own row of paper kinds)', 'the third with its own row of the three papers, *Monthly notices · Lien affidavits · Retainage notices*; since v2.7219 a fourth view, *By job*, is the list that was *Timeline* in that row, when the row read *Notices · Affidavits · Retainage · Timeline*)'],
  ['docs/LIEN_DESK_ARCHITECTURE.md', '("Kind of paper": Notices · Affidavits · Retainage · Timeline). `kind` keeps its six values', '("Kind of paper": Notices · Affidavits · Retainage · Timeline; since v2.7219 the three papers alone, and the timeline is the fourth view, By job, so `paperShown` and `lastPaperKind` no longer hold `timeline`). `kind` keeps its six values'],
  // A comment whose *the Deadlines* is the view, with none of the rules' shapes around it.
  ['src/hooks/useLienWatchNudge.ts', 'the rule the desk and the Deadlines count by', 'the rule the desk and its By date view count by'],
]

/** One pass of the line rules over a text. */
function ruled(f, text) {
  const md = f.endsWith('.md')
  const papers = PAPER_FILES.has(f)
  return text
    .split('\n')
    .map((line) => {
      if (md && /^keywords:/.test(line)) return line
      const kept = []
      let l = line
      for (const re of [...KEEP, ...(papers ? PAPER_KEEP : [])]) l = l.replace(re, (m) => `\u0000${kept.push(m) - 1}\u0000`)
      for (const [re, rep] of RULES) l = l.replace(re, rep)
      if (papers) for (const [re, rep] of PAPER_RULES) l = l.replace(re, rep)
      // eslint-disable-next-line no-control-regex
      return l.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[+i])
    })
    .join('\n')
}
/** The rules and the file's sentences, again until nothing moves: a sentence's new words may be a later sentence's old ones. */
function settle(f, text, sentences) {
  let t = text
  for (let pass = 0; pass < 8; pass++) {
    const before = t
    t = ruled(f, t)
    for (const [, from, to] of sentences) if (!t.includes(to) && t.includes(from)) t = t.replace(from, to)
    if (t === before) break
  }
  return t
}

let total = 0
const lost = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const sentences = SENTENCES.filter(([file]) => file === f)
  if (!/Do now|Deadlines|All filings/.test(src) && sentences.length === 0 && !PAPER_FILES.has(f)) continue
  const out = settle(f, src, sentences)
  // A sentence is lost when its new words are not in the file: neither whole, nor as they settle, nor
  // by their opening (a later sentence may have rewritten the end of them).
  for (const [, from, to] of sentences) {
    const settled = settle(f, to, sentences)
    if (![to, settled, to.slice(0, 30), settled.slice(0, 30)].some((w) => out.includes(w))) lost.push(`${f} · ${from.split('\n')[0]}`)
  }
  if (out === src) continue
  const before = new Set(src.split('\n'))
  const changed = out.split('\n').filter((l) => !before.has(l))
  total += changed.length
  console.log(`${check ? 'would change' : 'changed'} ${changed.length} line${changed.length === 1 ? '' : 's'} · ${f}`)
  if (!check) writeFileSync(f, out)
}
console.log(`${check ? 'would change' : 'changed'} ${total} line${total === 1 ? '' : 's'} in all`)
for (const l of lost) console.log(`sentence not found, read it by hand · ${l}`)
if (check && total > 0) process.exit(1)
