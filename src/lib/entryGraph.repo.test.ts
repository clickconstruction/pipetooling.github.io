import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_ENTRY, eagerGraph, ENTRY_SOURCE_BUDGET_BYTES, ON_DEMAND_PAGES, ON_DEMAND_WINDOWS, resolveSpecifier, whyEager, type ReadSource } from './entryGraph'
import { onDemandImports } from './lazyRouteBoundaries'

/**
 * The repo's own entry, held to its budget (the main chunk's split, 2026-11-20). PR CI never runs the
 * build, so this is where a PR learns it has put a window back in the main chunk, or grown what every
 * visit loads, before a deploy fails on the precache cap for everyone.
 */
const root = process.cwd()
const cache = new Map<string, string | null>()
const read: ReadSource = (file) => {
  if (cache.has(file)) return cache.get(file)!
  let text: string | null = null
  try {
    const full = join(root, file)
    if (statSync(full).isFile()) text = readFileSync(full, 'utf8')
  } catch {
    text = null
  }
  cache.set(file, text)
  return text
}

const graph = eagerGraph(APP_ENTRY, read)
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)

describe('the app entry’s eager imports', () => {
  it('finds the app from the entry', () => {
    expect(graph.files.has('src/App.tsx')).toBe(true)
    expect(graph.files.size).toBeGreaterThan(200)
  })

  it.each(ON_DEMAND_WINDOWS)('%s loads on demand, never with the entry', (window) => {
    expect(read(window), `${window} is listed in ON_DEMAND_WINDOWS and is not in the repo`).not.toBeNull()
    const chain = whyEager(graph, window)
    expect(
      chain,
      chain.length
        ? `${window} is back in the main chunk through:\n  ${chain.join('\n  <- ')}\nA file on that chain imports its neighbour for its code. Import the type only (\`import type\`), or load the window with lazyWindow.`
        : '',
    ).toEqual([])
  })

  it.each(ON_DEMAND_PAGES)('%s loads when its link is opened, never with the entry', (page) => {
    expect(read(page), `${page} is listed in ON_DEMAND_PAGES and is not in the repo`).not.toBeNull()
    const chain = whyEager(graph, page)
    expect(
      chain,
      chain.length
        ? `${page} is back in the main chunk through:\n  ${chain.join('\n  <- ')}\nA file on that chain imports its neighbour for its code. In App.tsx hold the page with lazyWindow inside PublicPage; elsewhere import the type only (\`import type\`).`
        : '',
    ).toEqual([])
  })

  // What `App.tsx` itself says it loads on demand, read from its source, so no list has to be kept in step.
  const APP = 'src/App.tsx'
  const onDemand = onDemandImports(read(APP) ?? '').map((page) => ({ ...page, file: resolveSpecifier(APP, page.specifier, read) }))

  it('reads the pages App.tsx loads on demand', () => {
    // A parser that found nothing would pass the two checks below with nothing checked.
    expect(onDemand.length).toBeGreaterThan(60)
    const unread = onDemand.filter((page) => page.file == null).map((page) => `${page.name} (${page.specifier})`)
    expect(unread, `No file in the repo for: ${unread.join(', ')}`).toEqual([])
  })

  it('keeps every page App.tsx loads on demand out of the entry', () => {
    const back = onDemand
      .filter((page) => page.file != null && whyEager(graph, page.file).length > 0)
      .map((page) => `${page.name} is in the main chunk through:\n  ${whyEager(graph, page.file!).join('\n  <- ')}`)
    expect(
      back,
      `${back.join('\n')}\nApp.tsx loads each of these on demand, and a file the entry reaches also imports it for its code, so the build puts it in the main chunk and the on-demand load saves nothing. Import the type only (\`import type\`) in the file that names it.`,
    ).toEqual([])
  })

  it('lists in ON_DEMAND_PAGES exactly the pages App.tsx holds through lazyWindow', () => {
    const held = onDemand.filter((page) => page.how === 'lazyWindow').map((page) => page.file ?? page.specifier)
    expect(
      [...held].sort(),
      'ON_DEMAND_PAGES in src/lib/entryGraph.ts and the lazyWindow pages in src/App.tsx name different files. A page that opens with no sign-in is in both.',
    ).toEqual([...ON_DEMAND_PAGES].sort())
  })

  it('stays inside the budget for what every visit loads', () => {
    const heaviest = [...graph.files]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([file, bytes]) => `  ${(bytes / 1024).toFixed(0).padStart(5)} kB  ${file}`)
      .join('\n')
    expect(
      graph.bytes,
      `The entry reaches ${mb(graph.bytes)} MB of source through static imports, over the budget of ${mb(ENTRY_SOURCE_BUDGET_BYTES)} MB (ENTRY_SOURCE_BUDGET_BYTES in src/lib/entryGraph.ts).\n` +
        `All of it is built into the main chunk, and a main chunk over the precache cap in vite.config.ts fails every deploy.\n` +
        `Load a window on demand (lazyWindow, then add it to ON_DEMAND_WINDOWS), or import a type with \`import type\`.\nThe largest files in it:\n${heaviest}`,
    ).toBeLessThanOrEqual(ENTRY_SOURCE_BUDGET_BYTES)
  })
})
