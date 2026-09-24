/**
 * The to-dos on disk → the punch-list board (v2.3623). The one place file IO for the board
 * lives: the Vite plugin (`todoBoardPlugin` in vite.config.ts) calls `renderTodoBoardModule`
 * to serve the app's `virtual:punch-list` module at build and in dev, and `scripts/check-todos.ts`
 * calls the same function so CI fails on a to-do the board could not render. Nothing here is
 * ever written to the repo: the board is rendered from `to-dos/` every time, which is what
 * ends the committed-generated-file conflicts the old `--fix` step caused.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  assignedNumbersInFragment,
  assignedNumbersInGitLog,
  dirForFile,
  findTodoProblems,
  isParseError,
  readTodoDoc,
  renderBoardData,
  renderBoardModule,
  versionNumber,
  type Finding,
  type TodoDoc,
  type TodoParseError,
} from '../../src/lib/todos/todoBoard'

/** Every to-do on disk: a folder with a README.md, or a top-level .md. */
export function todoPaths(root: string): string[] {
  const dir = join(root, 'to-dos')
  const out: string[] = []
  for (const entry of readdirSync(dir).sort()) {
    if (entry === 'README.md') continue
    const abs = join(dir, entry)
    if (statSync(abs).isDirectory()) {
      if (existsSync(join(abs, 'README.md'))) out.push(`to-dos/${entry}/README.md`)
    } else if (entry.endsWith('.md')) {
      out.push(`to-dos/${entry}`)
    }
  }
  return out
}

/** Repo-root paths of every file in the to-do's directory — the kernel picks the mock-ups out. */
export function siblingsOf(root: string, file: string): string[] {
  const dir = dirForFile(file)
  return readdirSync(join(root, dir))
    .filter((e) => statSync(join(root, dir, e)).isFile())
    .map((e) => `${dir}/${e}`)
}

/**
 * Versions the repo can vouch for: one fragment file each since the 2026-08-20 cutover,
 * plus everything named in the frozen pre-cutover archive — and the newest of them.
 */
export function readKnownVersions(root: string): { known: Set<string>; newest: string } {
  const known = new Set<string>()
  let newest = 'v2.0'
  for (const f of readdirSync(join(root, 'docs', 'recent-features'))) {
    const m = /^(v2\.\d+)\.md$/.exec(f)
    if (!m?.[1]) continue
    known.add(m[1])
    if (versionNumber(m[1]) > versionNumber(newest)) newest = m[1]
  }
  const archive = join(root, 'docs', 'RECENT_FEATURES.md')
  if (existsSync(archive)) {
    for (const m of readFileSync(archive, 'utf8').matchAll(/\bv2\.(\d{3,4})\b/g)) known.add(`v2.${m[1]}`)
  }
  return { known, newest }
}

/**
 * Every punch-list number the repo remembers assigning, beyond what sits in `to-dos/` today:
 * the fragments' "punch list #N" citations plus the `number:` line of every to-do git history
 * has seen, deleted ones included. Only `check:todos` reads this (the build never shells out);
 * a shallow checkout simply contributes less history, and the fragments still hold the record.
 */
export function readAssignedNumbers(root: string): number[] {
  const out = new Set<number>()
  const fragments = join(root, 'docs', 'recent-features')
  for (const f of readdirSync(fragments)) {
    if (!f.endsWith('.md')) continue
    for (const n of assignedNumbersInFragment(readFileSync(join(fragments, f), 'utf8'))) out.add(n)
  }
  try {
    const patch = execFileSync('git', ['log', '--all', '--format=', '-p', '--', 'to-dos'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    for (const n of assignedNumbersInGitLog(patch)) out.add(n)
  } catch {
    // Not a git checkout (or no git on PATH): the folder and the fragments still answer.
  }
  return [...out].sort((a, b) => a - b)
}

/** A local date: the board is a date-stamped page for people in one office, never a calculation. */
export function todayYmd(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export type TodoSources = {
  docs: TodoDoc[]
  errors: TodoParseError[]
  known: Set<string>
  newest: string
}

export function loadTodos(root: string): TodoSources {
  const docs: TodoDoc[] = []
  const errors: TodoParseError[] = []
  for (const file of todoPaths(root)) {
    const parsed = readTodoDoc(file, readFileSync(join(root, file), 'utf8'), siblingsOf(root, file))
    if (isParseError(parsed)) errors.push(parsed)
    else docs.push(parsed)
  }
  const { known, newest } = readKnownVersions(root)
  return { docs, errors, known, newest }
}

/**
 * The board module's source and every problem with the to-dos. `problems` with an error
 * severity mean the sources are broken: the build refuses them, the dev server logs them and
 * serves what parsed.
 */
export function renderTodoBoardModule(
  root: string,
  now: Date = new Date(),
  assignedNumbers?: Iterable<number>,
): { module: string; problems: Finding[]; docs: TodoDoc[] } {
  const { docs, errors, known, newest } = loadTodos(root)
  const problems = findTodoProblems({ docs, errors, knownVersions: known, assignedNumbers })
  const module = renderBoardModule(renderBoardData(docs, { date: todayYmd(now), version: newest }))
  return { module, problems, docs }
}
