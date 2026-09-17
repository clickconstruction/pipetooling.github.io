#!/usr/bin/env vite-node
/**
 * To-do views: check them, or render them.
 *
 * `npm run check:todo-drift`           verify; exit 1 when a view is stale (CI).
 * `npm run check:todo-drift -- --fix`  re-render both views from the to-dos' front matter.
 *
 * Same shape as `scripts/theme-tokenize.mjs`: one script, a checking mode for CI and a
 * fixing mode for a person. The rules and all the rendering live in the tested kernel
 * `src/lib/todos/todoBoard.ts`; this file only reads and writes files.
 *
 * Each to-do owns its triage fields in front matter. `to-dos/README.md`'s index block and
 * `to-dos/punch-list.html`'s ITEMS array are both rendered from it, so the only kind of
 * drift left is "the file on disk is not what the sources render to" — which --fix ends.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  readTodoDoc,
  isParseError,
  dirForFile,
  PUNCH_LIST_ARTIFACT_URL,
  renderViews,
  findDrift,
  versionNumber,
  openItemCount,
  GROUP_LABELS,
  GROUP_ORDER,
  type TodoDoc,
  type TodoParseError,
  type Finding,
} from '../src/lib/todos/todoBoard'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TODOS_DIR = join(ROOT, 'to-dos')
const INDEX_FILE = join(TODOS_DIR, 'README.md')
const BOARD_FILE = join(TODOS_DIR, 'punch-list.html')
const FRAGMENTS_DIR = join(ROOT, 'docs', 'recent-features')
const ARCHIVE_FILE = join(ROOT, 'docs', 'RECENT_FEATURES.md')

const FIX = process.argv.includes('--fix')

/** Every to-do on disk: a folder with a README.md, or a top-level .md. */
function todoPaths(): string[] {
  const out: string[] = []
  for (const entry of readdirSync(TODOS_DIR).sort()) {
    if (entry === 'README.md' || entry === 'punch-list.html') continue
    const abs = join(TODOS_DIR, entry)
    if (statSync(abs).isDirectory()) {
      if (existsSync(join(abs, 'README.md'))) out.push(`to-dos/${entry}/README.md`)
    } else if (entry.endsWith('.md')) {
      out.push(`to-dos/${entry}`)
    }
  }
  return out
}

/** Repo-root paths of every file in the to-do's directory — the kernel picks the mock-ups out. */
function siblingsOf(file: string): string[] {
  const dir = dirForFile(file)
  return readdirSync(join(ROOT, dir))
    .filter((e) => statSync(join(ROOT, dir, e)).isFile())
    .map((e) => `${dir}/${e}`)
}

/**
 * Versions the repo can vouch for: one fragment file each since the 2026-08-20 cutover,
 * plus everything named in the frozen pre-cutover archive.
 */
function readKnownVersions(): { known: Set<string>; newest: string } {
  const known = new Set<string>()
  let newest = 'v2.0'
  for (const f of readdirSync(FRAGMENTS_DIR)) {
    const m = /^(v2\.\d+)\.md$/.exec(f)
    if (!m?.[1]) continue
    known.add(m[1])
    if (versionNumber(m[1]) > versionNumber(newest)) newest = m[1]
  }
  if (existsSync(ARCHIVE_FILE)) {
    for (const m of readFileSync(ARCHIVE_FILE, 'utf8').matchAll(/\bv2\.(\d{3,4})\b/g)) known.add(`v2.${m[1]}`)
  }
  return { known, newest }
}

function todayYmd(): string {
  // The board is a date-stamped page for people in one office; a local date is what they
  // expect to read, and it never feeds a calculation.
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function report(findings: readonly Finding[]): void {
  for (const f of findings.filter((x) => x.severity === 'error')) console.error(`  ERROR  ${f.message}`)
  for (const f of findings.filter((x) => x.severity === 'warn')) console.warn(`  warn   ${f.message}`)
}

function summarise(docs: readonly TodoDoc[]): string {
  const counts = GROUP_ORDER.filter((g) => docs.some((d) => d.meta.group === g)).map(
    (g) => `${docs.filter((d) => d.meta.group === g).length} ${GROUP_LABELS[g].toLowerCase()}`,
  )
  return `${openItemCount(docs)} open item(s): ${counts.join(', ')}`
}

function main(): void {
  const docs: TodoDoc[] = []
  const errors: TodoParseError[] = []
  for (const file of todoPaths()) {
    const parsed = readTodoDoc(file, readFileSync(join(ROOT, file), 'utf8'), siblingsOf(file))
    if (isParseError(parsed)) errors.push(parsed)
    else docs.push(parsed)
  }

  const readme = readFileSync(INDEX_FILE, 'utf8')
  const board = readFileSync(BOARD_FILE, 'utf8')
  const { known, newest } = readKnownVersions()

  // A stale stamp must not make every unrelated PR red, so the checking mode compares
  // against the stamp already on disk and only --fix moves it forward.
  const stampVersion = FIX ? newest : (/at <b>(v2\.\d+)<\/b>/.exec(board)?.[1] ?? newest)
  const stampDate = FIX ? todayYmd() : (/main <b>([\d-]+)<\/b>/.exec(board)?.[1] ?? todayYmd())

  let rendered: { readme: string; board: string }
  try {
    rendered = renderViews({ docs, readme, board, today: stampDate, newestVersion: stampVersion })
  } catch (e) {
    console.error(`to-do views could not be rendered: ${(e as Error).message}`)
    process.exit(1)
  }

  const findings = findDrift({ docs, errors, readme, board, rendered, knownVersions: known })
  const blocking = findings.filter((f) => f.severity === 'error')

  if (FIX) {
    const unfixable = blocking.filter((f) => !f.fixable)
    if (unfixable.length > 0) {
      // Rendering from broken sources would bake the breakage into both views.
      console.error(`${unfixable.length} problem(s) must be fixed in the to-do files first:`)
      report(unfixable)
      process.exit(1)
    }
    let wrote = 0
    if (rendered.readme !== readme) {
      writeFileSync(INDEX_FILE, rendered.readme)
      console.log('  · rewrote to-dos/README.md (generated index)')
      wrote++
    }
    if (rendered.board !== board) {
      writeFileSync(BOARD_FILE, rendered.board)
      console.log(`  · rewrote to-dos/punch-list.html (ITEMS + stamp ${stampDate} at ${stampVersion})`)
      console.log(`    the published board is a copy — republish it from this file once the PR merges:`)
      console.log(`    ${PUNCH_LIST_ARTIFACT_URL} (with every mock-up beside it; see to-dos/README.md → The punch list)`)
      wrote++
    }
    console.log(wrote === 0 ? 'Both views already match the to-dos.' : `Rendered ${summarise(docs)}.`)
    return
  }

  if (findings.length === 0) {
    console.log(`to-do drift check OK: ${docs.length} to-do(s) render both views. ${summarise(docs)}.`)
    return
  }

  console.error('to-do drift check found:')
  report(findings)
  if (blocking.length > 0) {
    const fixable = blocking.filter((f) => f.fixable).length
    console.error(
      `\n${blocking.length} error(s)` +
        (fixable > 0 ? `, ${fixable} of them fixable — run: npm run check:todo-drift -- --fix` : '') +
        '.\nEach to-do owns its front matter; the index and the punch list are rendered from it.',
    )
    process.exit(1)
  }
  console.log(`\nNo errors, ${findings.length} warning(s) — not blocking.`)
}

main()
