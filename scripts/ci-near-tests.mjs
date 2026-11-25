#!/usr/bin/env node
/**
 * ci.yml's "Which tests are near the change" step, on a pull request's own run:
 *
 *   node scripts/ci-near-tests.mjs <list file> < compare.json
 *
 * reads the compare API's JSON on stdin, writes the picked test files to <list file> one a line, and writes
 *   mode=near|all   list=<list file>
 * to $GITHUB_OUTPUT (stdout when unset). The rule is scripts/lib/nearTests.mjs: the tests whose imports reach a
 * changed file, and every test whose imports reach a module that reads files. Anything it cannot tell (the
 * compare unreadable, a list at the cap, a change to what every test runs on, a graph that did not build, a
 * test file the graph never saw) is `mode=all`, and the step after it runs the whole suite.
 *
 * The graph is Vite's own: each test file is transformed as vitest would transform it and its imports are
 * resolved by the same plugins, so an alias, an `import.meta.glob` and a `?raw` import are followed exactly as
 * the test run follows them. `vitest related` walks the same graph and would be one line, but it throws on
 * this repo: it re-reads a `?raw` import without its query and tries to parse the Markdown as a module
 * (vitest 2.1.9, docs/twins/kickoffs/*.md). Here a file that does not transform is a leaf.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { filesOfCompare } from './lib/docsOnlyChange.mjs'
import { nearOutputs, nearTests, nearWords, readsDisk, wholeSuiteReason } from './lib/nearTests.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/')

function finish(plan, words) {
  const lines = nearOutputs(plan)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n')
  else console.log(lines.join('\n'))
  console.log(words)
}

/**
 * Every test file, each file's own imports that are files of the repo, and the files that import something
 * that reads the disk. Layer by layer, so a file is transformed once however many tests import it.
 */
async function importGraph() {
  const { createVitest } = await import('vitest/node')
  const ctx = await createVitest('test', { watch: false, run: true })
  try {
    const specs = await ctx.globTestSpecs()
    if (specs.length === 0) throw new Error('vitest found no test file')
    const project = specs[0].project.workspaceProject
    const importsOf = new Map()
    const readerModules = []
    let unread = 0
    const load = async (file) => {
      let transformed = project.server.moduleGraph.getModuleById(file)?.ssrTransformResult
      if (!transformed) {
        try {
          transformed = await project.vitenode.transformRequest(file)
        } catch {
          unread += 1 // not a module (a `?raw` import's Markdown): it imports nothing
        }
      }
      const specifiers = [...(transformed?.deps ?? []), ...(transformed?.dynamicDeps ?? [])]
      if (specifiers.some((s) => readsDisk(s, builtinModules))) readerModules.push(rel(file))
      const deps = []
      for (const specifier of specifiers) {
        const resolved = await project.server.pluginContainer.resolveId(specifier, file, { ssr: true })
        const fsPath = resolved && !resolved.external && resolved.id.split('?')[0]
        if (fsPath && !fsPath.includes('node_modules') && existsSync(fsPath)) deps.push(fsPath)
      }
      return deps
    }
    const tests = specs.map((s) => s.moduleId)
    let layer = Array.from(new Set(tests))
    const seen = new Set(layer)
    while (layer.length) {
      const next = []
      const loaded = await Promise.all(layer.map(async (file) => [file, await load(file)]))
      for (const [file, deps] of loaded) {
        importsOf.set(rel(file), deps.map(rel))
        for (const dep of deps) {
          if (!seen.has(dep)) {
            seen.add(dep)
            next.push(dep)
          }
        }
      }
      layer = next
    }
    return { tests: tests.map(rel), importsOf, readerModules, unread }
  } finally {
    await ctx.close()
  }
}

async function main() {
  const listFile = process.argv[2]
  if (!listFile) {
    console.error('usage: node scripts/ci-near-tests.mjs <list file> < compare.json')
    return 2
  }
  let body = null
  try {
    const raw = readFileSync(0, 'utf8')
    body = raw.trim() ? JSON.parse(raw) : null
  } catch {
    body = null
  }
  const changed = filesOfCompare(body)
  const whole = body ? wholeSuiteReason(changed) : 'the compare did not read, so the whole suite runs'
  if (whole) {
    finish({ mode: 'all' }, `whole suite: ${whole}`)
    return 0
  }

  const started = Date.now()
  let graph
  try {
    graph = await importGraph()
  } catch (e) {
    finish({ mode: 'all' }, `whole suite: the import graph did not build (${e instanceof Error ? e.message : String(e)})`)
    return 0
  }
  const pick = nearTests({ ...graph, changed })
  // A test file the PR changes or adds that the graph never listed would be skipped without a word: run everything.
  const lost = changed.filter((f) => /^src\/.*(\.test\.ts|\.render\.test\.tsx)$/.test(f) && existsSync(path.join(ROOT, f)) && !pick.selected.includes(f))
  if (lost.length || pick.readers.length === 0) {
    finish({ mode: 'all' }, `whole suite: ${lost.length ? `the graph did not list ${lost[0]}` : 'the graph found no test that reads files, and there are hundreds'}`)
    return 0
  }
  writeFileSync(listFile, pick.selected.join('\n') + '\n')
  const seconds = ((Date.now() - started) / 1000).toFixed(0)
  finish(
    { mode: 'near', list: listFile },
    `near the change: ${nearWords({ total: graph.tests.length, near: pick.near.length, readers: pick.readers.length, selected: pick.selected.length })}. ` +
      `${graph.importsOf.size} files read in ${seconds} s (${graph.unread} not modules), ${graph.readerModules.length} of them read files.`,
  )
  if (pick.near.length) console.log(`near the change:\n${pick.near.slice(0, 60).map((t) => `  ${t}`).join('\n')}${pick.near.length > 60 ? `\n  and ${pick.near.length - 60} more` : ''}`)
  return 0
}

main().then(
  (code) => process.exit(code),
  (e) => {
    // Never a red step for the picker's own fault: the whole suite is the answer to anything it cannot tell.
    console.error(e && e.stack ? e.stack : String(e))
    finish({ mode: 'all' }, 'whole suite: the picker itself failed')
    process.exit(0)
  },
)
