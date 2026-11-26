import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error — the checks run the cache on bare Node, so it is plain JS with no types
import { parsedFileCache } from '../../scripts/lib/parsedFileCache.mjs'

/**
 * scripts/lib/parsedFileCache.mjs bounds what a check that parses `src` holds at once. These hold the
 * bound, the order files are let go in, and that the three checks which once held every file of `src`
 * (3.1 GB, 2 GB and 1.1 GB of heap at v2.8671) read through it and run at Node's default heap.
 */
const entry = (value: string, chars: number) => () => ({ value, chars })

describe('parsedFileCache', () => {
  it('loads a file once and answers the held value after that', () => {
    const cache = parsedFileCache(100)
    let loads = 0
    const load = () => {
      loads += 1
      return { value: 'tree', chars: 10 }
    }
    expect(cache.read('a', load)).toBe('tree')
    expect(cache.read('a', load)).toBe('tree')
    expect(loads).toBe(1)
    expect(cache.chars).toBe(10)
  })

  it('holds everything until it is told to let go, then drops the oldest past the bound', () => {
    const cache = parsedFileCache(25)
    cache.read('a', entry('A', 10))
    cache.read('b', entry('B', 10))
    cache.read('c', entry('C', 10))
    expect(cache.chars).toBe(30)
    cache.letGo()
    expect(cache.chars).toBe(20)
    let reloaded = false
    cache.read('a', () => {
      reloaded = true
      return { value: 'A', chars: 10 }
    })
    expect(reloaded).toBe(true)
  })

  it('keeps a file that was read again over one that was not', () => {
    const cache = parsedFileCache(25)
    cache.read('a', entry('A', 10))
    cache.read('b', entry('B', 10))
    cache.read('a', entry('never', 10))
    cache.read('c', entry('C', 10))
    cache.letGo()
    const loaded: string[] = []
    for (const key of ['a', 'c', 'b']) {
      cache.read(key, () => {
        loaded.push(key)
        return { value: key, chars: 10 }
      })
    }
    expect(loaded).toEqual(['b'])
  })

  it('holds a missing file as null without counting it', () => {
    const cache = parsedFileCache(5)
    expect(cache.read('gone', () => ({ value: null, chars: 0 }))).toBeNull()
    cache.letGo()
    expect(cache.chars).toBe(0)
  })
})

describe('the checks that parse src', () => {
  const root = join(__dirname, '..', '..')
  const scripts = ['scripts/check-nested-windows.mjs', 'scripts/codemods/font-shorthand-sweep.mjs', 'scripts/codemods/window-z-above-dock.mjs']

  it.each(scripts)('%s reads through the cache and lets go between files', (script) => {
    const text = readFileSync(join(root, script), 'utf8')
    expect(text).toContain('parsedFileCache()')
    expect(text).toMatch(/\.letGo\(\)/)
    expect(text).not.toMatch(/ts\.createProgram\(/)
  })

  it('runs them at the default heap', () => {
    const run = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts as Record<string, string>
    for (const name of ['check:nested-windows', 'check:font-shorthand', 'check:window-z']) expect(run[name]).not.toContain('max-old-space-size')
  })
})
