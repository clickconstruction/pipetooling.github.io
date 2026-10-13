#!/usr/bin/env node
/**
 * The kernels the portals' reads run on the edge (the schedule's PR 14b, `to-dos/gc-mode/mockups/schedule-pr14b.md` on
 * branch spike/gc-mode, calls 1 and 2; decision 10). An edge function cannot import `src/lib` as it stands: its imports
 * carry no `.ts`, and the edge runtime stops at the first. So this copies what the reads need into
 * `supabase/functions/_shared/gcKernels/`:
 *
 * - from the entries below, every file their value imports reach, in `src`'s own layout, so each relative import stays
 *   the same with `.ts` added;
 * - an import of types alone becomes `import type`, which Deno erases at run time but `deno check` reads. A file of types
 *   whose own imports are types alone is copied too. One that imports nothing (the database's types, the schedule's)
 *   is pointed at in `src` with its `.ts`, so `deno check` resolves it as it stands and the copy never holds the
 *   generated database file. A file the copy only takes types from that runs code of its own is refused: move the
 *   types to a types file;
 * - a package import, a dynamic or side-effect import, a browser global (`document`, `localStorage`, `import.meta`)
 *   or an import it cannot find is refused, by file.
 *
 *   npm run gen:edge-kernels            writes the copy, and takes off a file no longer in it
 *   npm run gen:edge-kernels -- --check says what differs, and exits 1 (the test does the same in CI)
 *
 * `src/lib/gc/edgeKernels.test.ts` regenerates the copy and fails on any difference, and checks `IMPORTERS` against the
 * functions whose bundles reach the copy. Plain JS with no dependencies, like `lib/edgeBundle.mjs`.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Where the copy goes, from the repo's root. */
export const OUT_DIR = 'supabase/functions/_shared/gcKernels'

/** The functions that import the copy: the test checks this against their bundles, and `check:edge-drift` names each to redeploy. */
export const IMPORTERS = ['customer-portal', 'drive-link', 'gc-trade-portal', 'gmail-sync', 'messages-notify', 'photo-save', 'quo-send', 'quo-webhook']

/** Each entry (from `src/`) and what the copy's index exports of it. */
export const ENTRIES = {
  'lib/gc/schedule/portalSchedule.ts': { values: ['portalSchedule', 'portalScheduleX'], types: ['PortalSchedule', 'PortalScheduleBar'] },
  'lib/gc/projectRows.ts': { values: ['gcProjectFromRows'], types: ['GcProjectRows'] },
  'lib/gc/boardRows.ts': { values: ['boardStateFromRows'], types: ['BoardRows', 'CompanyRow', 'InviteRow', 'SowRow', 'SowLineRow'] },
  'lib/gc/drawRows.ts': { values: ['withDraws'], types: ['DrawTables', 'DrawTableRow', 'DrawLineRow', 'LineReportRow'] },
  'lib/gc/schedule/rows.ts': { values: ['withScheduleRows'], types: ['ScheduleRows'] },
  // The Portal's P5d-ii: the trade's side of the schedule, worked out where every bar is.
  'lib/gc/schedule/tellTrades.ts': { values: ['datesNotices'], types: ['DatesNotice'] },
  'lib/gc/schedule/lateNotices.ts': { values: ['lateDoor', 'lateTarget', 'lateWaiting', 'portalLateNotice'], types: ['LateDoor', 'LateWaiting'] },
  'lib/gc/schedule/crewCounts.ts': { values: ['portalCrewAsks'], types: ['PortalCrewWeek'] },
  'lib/gc/portal.ts': { values: ['portalLookAhead', 'portalTodos'], types: ['PortalLookAheadWeek', 'PortalTodo'] },
  // The customer's picture in their portal (the schedule's PR 15b): the picture, a bar in their words, the late
  // finish's customer words, and a change order's non-money half laid on the board.
  'lib/gc/schedule/customerSchedule.ts': { values: ['customerSchedulePicture', 'customerBarWords'], types: ['CustomerSchedulePicture', 'CustomerStage', 'CustomerStanding'] },
  'lib/gc/lateFinish.ts': { values: ['lateFinish'], types: ['LateFinish'] },
  'lib/gc/changeOrderOfficeRows.ts': { values: ['withOfficeChangeOrders', 'CHANGE_ORDER_OFFICE_COLUMNS'], types: ['ChangeOrderOfficeRow'] },
  // Messages, cut 6: the bids@ reader (gmail-sync) reads each email into a line with these.
  'lib/emailIn/gmailMessage.ts': { values: ['readGmailMessage', 'base64UrlBytes', 'parseAddress'], types: ['EmailIn', 'GmailMessage'] },
  'lib/emailIn/forwarded.ts': { values: ['readForwarded'], types: ['Forwarded'] },
  'lib/emailIn/leftOut.ts': { values: ['leftOut', 'outsideInbox'], types: ['LeftOut'] },
  'lib/emailIn/emailLine.ts': { values: ['emailLine', 'emailParty', 'emailFileRows'], types: ['EmailLine', 'EmailFileRow'] },
  'lib/emailIn/jobInSubject.ts': { values: ['jobInSubject'], types: ['SubjectJob'] },
  'lib/emailIn/subjectJobs.ts': { values: ['subjectJobs', 'subjectNumbers'], types: ['SubjectJobRows'] },
  'lib/emailIn/historyWalk.ts': { values: ['walkHistory'], types: ['HistoryWalk', 'Took'] },
  'lib/ledgerDisplayPrefixes.ts': { values: ['buildLedgerPrefixMap'], types: ['LedgerPrefixMap'] },
  // Messages, cut 10: photos saved on arrival, named and picked for the photo-save sweep and drive-link's save.
  'lib/photos/photoName.ts': { values: ['photoDriveName'], types: ['PhotoNameInput'] },
  'lib/photos/photoSave.ts': { values: ['photosToSave', 'PHOTO_SAVE_BATCH'], types: ['PhotoRow', 'PhotoSwitch'] },
  'lib/photos/photoRows.ts': { values: ['PHOTO_ROWS_SELECT', 'PHOTO_SWITCHES_SELECT', 'photoRowOf', 'photoNameInputOf', 'onSwitches'], types: ['PhotoAttachmentRow', 'PhotoLineRow'] },
  // Messages, cut 5 (v2.5261 to v2.5268 and this): the Quo link's webhook and send. The thread is here for its types,
  // so every import of the Quo kernels resolves inside the copy.
  'lib/messages/thread.ts': { values: ['callLength'], types: ['MessageChannel', 'MessageDirection', 'ThreadMessage'] },
  'lib/quo/webhook.ts': { values: ['verifySignature', 'webhookAnswer'], types: ['WebhookOutcome'] },
  'lib/quo/events.ts': {
    values: ['planQuoEvent', 'phoneWords', 'readQuoEvent', 'sentKey', 'toE164', 'unknownContact'],
    types: ['QuoLine', 'QuoPlan', 'QuoPlanContext', 'QuoReading'],
  },
  // Messages, cut 10: a text's pictures and files kept on arrival (quo-webhook through _shared/quoMedia.ts).
  'lib/quo/mediaKeep.ts': { values: ['quoMediaPlans', 'quoMediaRow', 'mediaToKeep', 'keepsCopy', 'QUO_NOT_COPIED'], types: ['QuoMediaPlan', 'QuoMediaFetch', 'QuoMediaRow'] },
  'lib/quo/send.ts': { values: ['planSend', 'refusalWords', 'sendOver', 'sentQuoId'], types: ['QuoSendInput', 'QuoSendPlan', 'SendPurpose', 'SentLine'] },
  // Residential R6 (PR 4): the box a call or text came to, the one a text goes from, and a STOP to one number.
  'lib/messages/boxes.ts': {
    values: ['BOXES_SETTINGS_KEY', 'boxForReply', 'boxOfInbound', 'boxSetting', 'parseBoxSettings', 'sendBox', 'stopScope', 'stoppedOn'],
    types: ['BoxFallback', 'BoxSettings', 'Mailbox', 'OptedOutByBox', 'StopChannel'],
  },
  'lib/quo/rows.ts': {
    values: ['MESSAGE_ROW_COLUMNS', 'contactKindOf', 'contactWords', 'defaultJob', 'jobOf', 'lineFromRow', 'parseQuoSendBody', 'quoSeatUserIds', 'quoSeats', 'rowFromLine', 'seatOf', 'seatsSource'],
    types: ['JobAt', 'MessageColumns', 'MessageRow', 'QuoSendBody'],
  },
  // Texts paused while Quo will not take one for the account's money (v2.5352).
  'lib/quo/paused.ts': { values: ['QUO_PAUSED_KEY', 'notePause', 'readQuoRefusal'], types: ['PauseChange', 'PauseStore', 'QuoRefusal'] },
  // Residential R5's push (messages-notify): who has a reply, who gets a new message, a reply after a legal line, and
  // the pushes a line makes.
  'lib/messages/hasRule.ts': { values: ['OFFICE_HOURS_KEY', 'parseOfficeHours', 'whoHasReply'], types: ['HasRule', 'OfficeHours', 'TechText'] },
  'lib/followUp/assignSeats.ts': { values: ['ASSIGN_RULE_KEY', 'parseAssignSeats', 'whoGetsIt'], types: ['AssignRuleSeats', 'AssignSeats'] },
  'lib/messages/legalRoute.ts': {
    values: ['legalLines', 'legalSendsFromDemandLetters', 'legalSendsFromFilings', 'routeReply', 'standingLegalLine'],
    types: ['LegalLine', 'LegalRoute', 'LegalSend'],
  },
  'lib/messages/notifyRule.ts': {
    values: ['OFFICE_WAIT_KEY', 'OFFICE_WAIT_MINUTES', 'PUSH_CHANNELS', 'answeredBefore', 'pushDue', 'pushSentRow', 'pushesFor'],
    types: ['NotifySettings', 'Push', 'PushSentRow', 'ReplyHas', 'ReplyLine'],
  },
  'lib/messages/notifyPlan.ts': {
    values: ['NOTIFY_LINES_MAX', 'PUSH_KINDS', 'REPLY_PUSH_ON_KEY', 'planReplyPushes', 'sweepSince'],
    types: ['NotifyPlan', 'NotifyPlanInput', 'PlanContact', 'PlanLine', 'PlanOut', 'PlanUser'],
  },
}

/** Types the readers name that no entry exports: from the files they live in, erased on the edge. */
const OUTSIDE_TYPES = { 'lib/gc/types.ts': ['GcProject', 'GcState'] }

// A static import or re-export, as `lib/edgeBundle.mjs` reads it: the clause may span lines but never runs into the next statement.
const STATIC_FROM = /^([ \t]*)(import|export)\b((?:(?!^[ \t]*(?:import|export)\b)[^'"`;])*?)\bfrom\s*(['"])([^'"]+)\4/gm
const SIDE_EFFECT = /^[ \t]*import\s*['"][^'"]+['"]/m
const DYNAMIC = /\bimport\s*\(/
// `import type {…} from`, but `import type from` is a default import named "type".
const TYPE_ONLY_CLAUSE = /^\s*type\s+(?!from\b)[\w{*]/
// What a pure kernel never touches on the edge.
const BROWSER = [/\bimport\.meta\b/, /\bdocument\.\w/, /\b(?:localStorage|sessionStorage)\b/, /\bnavigator\.\w/, /\bwindow\.(?:location|matchMedia|addEventListener|innerWidth|innerHeight|open)\b/]

const HEADER = (from) =>
  `// GENERATED by scripts/edge-kernels.mjs from src/${from}. Do not edit: change the file in src and run\n` +
  `// \`npm run gen:edge-kernels\`. Imported by ${IMPORTERS.join(', ')} (the schedule's PR 14b).\n`

/** The code with its comments taken out, for the browser check: a comment may say "window." freely. */
function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

/** `{ type A, type B as C }`: a named clause whose every name is a type. */
function allTypeNames(clause) {
  const m = /^\s*\{([\s\S]*)\}\s*$/.exec(clause)
  if (!m) return null
  const names = m[1]
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
  return names.length > 0 && names.every((n) => /^type\s+\S/.test(n)) ? names.map((n) => n.replace(/^type\s+/, '')) : null
}

/**
 * The copy, worked out: `files` maps each path under `OUT_DIR` to its content, `problems` says what was refused, and
 * `typeFiles` names the files held for their types alone.
 * `io` reads the repo, so a test can plant a file. Two passes: the files the entries' value imports reach, then each
 * file's imports written for where it lands.
 */
export function generateEdgeKernels(root, io = { readFile: (p) => readFileSync(p, 'utf8'), exists: existsSync }) {
  const src = join(root, 'src')
  const relOf = (abs) => posix.normalize(relative(src, abs).split('\\').join('/'))
  const problems = []
  /** A relative specifier's file in `src`, or null. */
  const find = (fromAbs, spec) => {
    const base = resolve(dirname(fromAbs), spec)
    for (const c of [base, `${base}.ts`, join(base, 'index.ts')]) if (c.endsWith('.ts') && io.exists(c)) return c
    return null
  }
  /** Each static import of a source: its parts, whether it brings types alone, and the names when written `{ type A }`. */
  const importsOf = (source) =>
    [...source.matchAll(STATIC_FROM)].map((m) => {
      const [whole, indent, kind, clause, quote, spec] = m
      const typeOnly = TYPE_ONLY_CLAUSE.test(clause)
      const typeNames = typeOnly ? null : allTypeNames(clause)
      return { whole, indent, kind, clause, quote, spec, types: typeOnly || typeNames !== null, typeNames }
    })

  // 1. What the entries' value imports reach, each file read once, then the files of types the copy reads types from.
  const sources = new Map()
  const queue = Object.keys(ENTRIES).map((e) => join(src, e))
  /** Each import of types alone from a relative file: who imports it, as written, and the file. */
  const typeImports = []
  const drain = () => {
    while (queue.length > 0) {
      const abs = queue.shift()
      const rel = relOf(abs)
      if (sources.has(rel)) continue
      const source = io.readFile(abs)
      sources.set(rel, { abs, source })
      const code = codeOnly(source)
      if (SIDE_EFFECT.test(code)) problems.push(`src/${rel}: a side-effect import`)
      if (DYNAMIC.test(code)) problems.push(`src/${rel}: a dynamic import`)
      for (const re of BROWSER) if (re.test(code)) problems.push(`src/${rel}: a browser global (${re.source})`)
      for (const imp of importsOf(source)) {
        if (!imp.spec.startsWith('./') && !imp.spec.startsWith('../')) {
          if (!imp.types) problems.push(`src/${rel}: a package import ('${imp.spec}')`)
          continue
        }
        const target = find(abs, imp.spec)
        if (!target) problems.push(`src/${rel}: cannot find '${imp.spec}'`)
        else if (!imp.types) queue.push(target)
        else typeImports.push({ rel, spec: imp.spec, target })
      }
    }
  }
  drain()
  // A file only types are taken from, once the code is known: one the copy holds already is read there; one that
  // imports nothing is pointed at in src; one whose imports are types alone is copied, and its imports read the same
  // way; one with code of its own is refused.
  const refused = new Set()
  /** The files copied for their types alone: no value import reaches them, so no bundle does. */
  const typeFiles = []
  for (let i = 0; i < typeImports.length; i += 1) {
    const { rel, spec, target } = typeImports[i]
    const targetRel = relOf(target)
    if (sources.has(targetRel)) continue
    const own = importsOf(io.readFile(target))
    if (own.length === 0) continue
    if (own.every((imp) => imp.types)) {
      typeFiles.push(targetRel)
      queue.push(target)
      drain()
      continue
    }
    const key = `${rel} ${targetRel}`
    if (refused.has(key)) continue
    refused.add(key)
    problems.push(`src/${rel}: types from '${spec}', which runs code of its own: move them to a types file`)
  }

  // 2. Each file's imports for where it lands: a value import with `.ts`; types alone as `import type`, at the copy's
  // own file when it holds one, else at the file in src with its `.ts` (one that imports nothing, step 1 says).
  const files = new Map()
  for (const rel of [...sources.keys()].sort()) {
    const { abs, source } = sources.get(rel)
    let out = source
    for (const imp of importsOf(source)) {
      if (!imp.spec.startsWith('./') && !imp.spec.startsWith('../')) continue
      const target = find(abs, imp.spec)
      if (!target) continue
      const targetRel = relOf(target)
      const dotted = (to) => (to.startsWith('.') ? to : `./${to}`)
      const to = sources.has(targetRel)
        ? dotted(posix.relative(posix.dirname(rel), targetRel))
        : dotted(posix.relative(posix.dirname(posix.join(OUT_DIR, rel)), posix.join('src', targetRel)))
      const clause = imp.typeNames ? ` type { ${imp.typeNames.join(', ')} } ` : imp.clause
      out = out.replace(imp.whole, `${imp.indent}${imp.kind}${clause}from ${imp.quote}${to}${imp.quote}`)
    }
    files.set(rel, HEADER(rel) + out)
  }
  files.set('index.ts', indexOf([...sources.keys()].sort()))
  return { files, problems, typeFiles: typeFiles.sort() }
}

/** The copy's index: what the readers import, and the files it holds. */
function indexOf(held) {
  const lines = [
    `// GENERATED by scripts/edge-kernels.mjs. Do not edit: run \`npm run gen:edge-kernels\`. Imported by ${IMPORTERS.join(', ')}.`,
    `// The kernels the portals' reads run on the edge (the schedule's PR 14b): ${held.length} files from src, in its layout.`,
    ...held.map((f) => `//   src/${f}`),
  ]
  for (const [entry, { values, types }] of Object.entries(ENTRIES)) {
    if (values.length > 0) lines.push(`export { ${values.join(', ')} } from './${entry}'`)
    if (types.length > 0) lines.push(`export type { ${types.join(', ')} } from './${entry}'`)
  }
  for (const [file, types] of Object.entries(OUTSIDE_TYPES)) {
    const to = held.includes(file) ? `./${file}` : posix.relative(OUT_DIR, posix.join('src', file))
    lines.push(`export type { ${types.join(', ')} } from '${to}'`)
  }
  return `${lines.join('\n')}\n`
}

/** What `--check` and the test say: each file added, changed or no longer in the copy. */
export function copyDifferences(root, copy, io = { readFile: (p) => readFileSync(p, 'utf8'), exists: existsSync, list: listFiles }) {
  const dir = join(root, OUT_DIR)
  const onDisk = io.exists(dir) ? io.list(dir) : []
  const out = []
  for (const [rel, content] of copy) {
    const path = join(dir, rel)
    if (!io.exists(path)) out.push(`missing ${OUT_DIR}/${rel}`)
    else if (io.readFile(path) !== content) out.push(`changed ${OUT_DIR}/${rel}`)
  }
  for (const rel of onDisk) if (!copy.has(rel)) out.push(`no longer in the copy ${OUT_DIR}/${rel}`)
  return out
}

/** Every file under a directory, as paths relative to it. */
function listFiles(dir) {
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else out.push(relative(dir, p).split('\\').join('/'))
    }
  }
  walk(dir)
  return out.sort()
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const { files, problems } = generateEdgeKernels(root)
  if (problems.length > 0) {
    console.error(`edge kernels: refused\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
  if (process.argv.includes('--check')) {
    const diffs = copyDifferences(root, files)
    if (diffs.length > 0) {
      console.error(`edge kernels: the copy differs from src. Run \`npm run gen:edge-kernels\`.\n  ${diffs.join('\n  ')}`)
      process.exit(1)
    }
    console.log(`edge kernels: the copy matches src (${files.size - 1} files).`)
  } else {
    const dir = join(root, OUT_DIR)
    for (const rel of existsSync(dir) ? listFiles(dir) : []) if (!files.has(rel)) rmSync(join(dir, rel))
    for (const [rel, content] of files) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true })
      writeFileSync(join(dir, rel), content)
    }
    console.log(`edge kernels: wrote ${files.size - 1} files and the index to ${OUT_DIR}.`)
  }
}
