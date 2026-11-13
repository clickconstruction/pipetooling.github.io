/**
 * The punch list's history, read from git for the burndown on /punch-list: every commit on main that
 * changed `to-dos/` is replayed into the board as it stood, and `historyFromStates` turns the boards
 * into the changes the page draws. The Vite plugin (`todoHistoryPlugin` in vite.config.ts) serves the
 * result as `virtual:punch-list-history`; nothing is written to the repo.
 *
 * Three git calls, however long the history: one log with each commit's changed paths, one batch read
 * of the to-do files it names (each parsed once, by its blob id), and one question about the clone.
 * A commit's time is its committer time, which for a merge-queue squash is when the queue built it.
 *
 * The history starts at the first commit where every to-do parses (2026-09-22: before it the cards
 * had no stage or size in their front matter). After that a to-do that does not parse is left out of
 * its commit's board, as the dev server leaves it off the page.
 *
 * A build with no git, or a clone cut off at one commit, gets an empty or a short history and says so
 * (`shallow`); it never fails the build. `deploy.yml` checks the whole history out for this.
 */
import { execFileSync } from 'node:child_process'
import { cardsFromDocs, historyFromStates, packHistory, EMPTY_HISTORY, type HistoryCard, type HistoryState, type PunchListHistory } from '../../src/lib/todos/punchListHistory'
import { isParseError, readTodoDoc } from '../../src/lib/todos/todoBoard'

const MAX = 1024 * 1024 * 1024

/** A to-do's file: a top-level `.md` other than the README, or a folder's `README.md`. */
export function isTodoDocPath(path: string): boolean {
  if (!path.startsWith('to-dos/')) return false
  const parts = path.slice('to-dos/'.length).split('/')
  if (parts.length === 1) return parts[0]!.endsWith('.md') && parts[0] !== 'README.md'
  return parts.length === 2 && parts[1] === 'README.md'
}

export interface TodoCommit {
  sha: string
  /** Committer time, epoch seconds. */
  t: number
  /** The to-do files the commit set (path → blob id) or removed (path → null). */
  changes: Array<[path: string, blob: string | null]>
}

/** `git log --raw` output, cut into commits: a `\0<sha> <time>` line, then one `:… <status>\t<path>` line a changed file. */
export function parseRawLog(text: string): TodoCommit[] {
  const out: TodoCommit[] = []
  for (const chunk of text.split('\0')) {
    const lines = chunk.split('\n')
    const head = /^([0-9a-f]{40,64}) (\d+)$/.exec(lines[0] ?? '')
    if (!head) continue
    const commit: TodoCommit = { sha: head[1]!, t: Number(head[2]), changes: [] }
    for (const line of lines.slice(1)) {
      const m = /^:\d+ \d+ [0-9a-f]+ ([0-9a-f]+) ([ADMT])\t(.+)$/.exec(line)
      if (!m || !isTodoDocPath(m[3]!)) continue
      commit.changes.push([m[3]!, m[2] === 'D' ? null : m[1]!])
    }
    out.push(commit)
  }
  return out
}

/** `git cat-file --batch` output: `<id> blob <size>\n<bytes>\n` an object, in the order asked. */
export function parseBatch(buf: Buffer): Map<string, string> {
  const out = new Map<string, string>()
  let at = 0
  while (at < buf.length) {
    const nl = buf.indexOf(0x0a, at)
    if (nl < 0) break
    const [id, kind, size] = buf.toString('utf8', at, nl).split(' ')
    at = nl + 1
    if (kind !== 'blob' || !id) continue
    const n = Number(size)
    out.set(id, buf.toString('utf8', at, at + n))
    at += n + 1
  }
  return out
}

/** The boards, oldest first, from the commits and a way to read a blob's text. Pure, so the test replays a made-up log. */
export function statesFromCommits(commits: readonly TodoCommit[], textOf: (blob: string) => string | undefined): HistoryState[] {
  const parsed = new Map<string, HistoryCard | 'pointer' | 'unreadable'>()
  const cardOf = (path: string, blob: string): HistoryCard | 'pointer' | 'unreadable' => {
    let hit = parsed.get(blob)
    if (hit === undefined) {
      const text = textOf(blob)
      const doc = text === undefined ? null : readTodoDoc(path, text, [])
      if (!doc || isParseError(doc)) hit = 'unreadable'
      else hit = cardsFromDocs([doc])[0] ?? 'pointer'
      parsed.set(blob, hit)
    }
    return hit
  }
  const files = new Map<string, string>()
  const states: HistoryState[] = []
  let started = false
  for (const c of commits) {
    for (const [path, blob] of c.changes) {
      if (blob === null) files.delete(path)
      else files.set(path, blob)
    }
    const cards: HistoryCard[] = []
    let unreadable = 0
    for (const [path, blob] of files) {
      const card = cardOf(path, blob)
      if (card === 'unreadable') unreadable += 1
      else if (card !== 'pointer') cards.push(card)
    }
    if (!started && (unreadable > 0 || cards.length === 0)) continue
    started = true
    states.push({ t: c.t, cards })
  }
  return states
}

/** The whole read. Empty when git or the history is missing; never throws. */
export function readTodoHistory(root: string): PunchListHistory {
  try {
    const git = (args: string[], input?: string): Buffer =>
      execFileSync('git', args, { cwd: root, maxBuffer: MAX, stdio: ['pipe', 'pipe', 'ignore'], input })
    const log = git(['log', '--first-parent', '--diff-merges=first-parent', '--root', '--raw', '--no-abbrev', '--no-renames', '--reverse', '--format=%x00%H %ct', 'HEAD', '--', 'to-dos']).toString('utf8')
    const commits = parseRawLog(log)
    if (commits.length === 0) return EMPTY_HISTORY
    const blobs = [...new Set(commits.flatMap((c) => c.changes.map(([, blob]) => blob).filter((b): b is string => b !== null)))]
    const texts = new Map<string, string>()
    for (let i = 0; i < blobs.length; i += 400) {
      const slice = blobs.slice(i, i + 400)
      for (const [id, text] of parseBatch(git(['cat-file', '--batch'], slice.join('\n') + '\n'))) texts.set(id, text)
    }
    const events = historyFromStates(statesFromCommits(commits, (blob) => texts.get(blob)))
    const shallow = git(['rev-parse', '--is-shallow-repository']).toString('utf8').trim() === 'true'
    return { shallow, events }
  } catch {
    return EMPTY_HISTORY
  }
}

/** The module `virtual:punch-list-history` serves. */
export function renderTodoHistoryModule(root: string): string {
  return `// virtual:punch-list-history — rendered from git by scripts/todos/readTodoHistory.ts; never committed.\nexport default ${JSON.stringify(packHistory(readTodoHistory(root)))}\n`
}
