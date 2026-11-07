#!/usr/bin/env vite-node
/**
 * `npm run shortlist` — the punch list's Shortlist as markdown (v2.6618): the open rows by group,
 * smallest first, read from each to-do's own `size` words by `sizeBucket`, the same list the top of
 * /punch-list draws. For a chat that asks "the punch list shortlist": paste what this prints. Reads
 * `to-dos/` the way the board does and writes nothing. Exit 1 when a to-do does not parse.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderShortlistMarkdown, shortlistFrom } from '../src/lib/todos/punchListShortlist'
import { renderBoardData } from '../src/lib/todos/todoBoard'
import { loadTodos, todayYmd } from './todos/readTodos'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function main(): void {
  const { docs, errors, newest } = loadTodos(ROOT)
  if (errors.length > 0) {
    for (const e of errors) console.error(`  ERROR  ${e.file}: ${e.problem}`)
    console.error(`\n${errors.length} to-do(s) do not parse; fix them (npm run check:todos says how) and run again.`)
    process.exit(1)
  }
  const data = renderBoardData(docs, { date: todayYmd(), version: newest })
  process.stdout.write(renderShortlistMarkdown(shortlistFrom(data.items), data.validated))
}

main()
