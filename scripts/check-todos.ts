#!/usr/bin/env vite-node
/**
 * `npm run check:todos` — every to-do parses, cites shipped versions only, and the board
 * renders from them. Exit 1 on an error (CI). Nothing is written: since v2.3623 the punch
 * list is rendered at build time from `to-dos/` (`todoBoardPlugin` in vite.config.ts), so
 * there is no generated file to keep in step and no `--fix`.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GROUP_LABELS, GROUP_ORDER, openItemCount, type Finding, type TodoDoc } from '../src/lib/todos/todoBoard'
import { renderTodoBoardModule } from './todos/readTodos'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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
  let rendered: ReturnType<typeof renderTodoBoardModule>
  try {
    rendered = renderTodoBoardModule(ROOT)
  } catch (e) {
    console.error(`the punch list could not be rendered: ${(e as Error).message}`)
    process.exit(1)
  }
  const { problems, docs } = rendered
  if (problems.length === 0) {
    console.log(`to-dos OK: ${docs.length} to-do(s) render the punch list. ${summarise(docs)}.`)
    return
  }
  console.error('to-do check found:')
  report(problems)
  const blocking = problems.filter((f) => f.severity === 'error')
  if (blocking.length > 0) {
    console.error(`\n${blocking.length} error(s). Each to-do owns its front matter; the punch list is rendered from it at build time.`)
    process.exit(1)
  }
  console.log(`\nNo errors, ${problems.length} warning(s) — not blocking.`)
}

main()
