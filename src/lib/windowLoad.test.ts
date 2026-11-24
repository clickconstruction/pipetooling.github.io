import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from './plainWords'
import {
  WINDOW_LOST_LINE_MS,
  WINDOW_LOST_TYPED_LINE_MS,
  WINDOW_NAMES,
  WINDOW_UPDATING_WORDS,
  windowLoadView,
  windowLostLine,
  windowLostTypedWords,
  windowLostWords,
} from './windowLoad'

const lostChunk = new TypeError('Failed to fetch dynamically imported module: https://x/assets/JobWindowModal-abc123.js')
// What `lazyWindow` throws when the preload handler cancelled Vite's throw: the import resolved to nothing.
const emptyLazy = new TypeError("Cannot read properties of undefined (reading 'default')")

describe('windowLoadView', () => {
  it('draws the window while nothing is caught, a reload on its way or not', () => {
    expect(windowLoadView(null, false)).toBe('window')
    expect(windowLoadView(null, true)).toBe('window')
  })
  it('a lost chunk with no reload coming: the window gives up', () => {
    expect(windowLoadView(lostChunk, false)).toBe('gave-up')
  })
  it('any error while a recovery reload is on its way: the note, since the page is leaving', () => {
    expect(windowLoadView(lostChunk, true)).toBe('updating')
    expect(windowLoadView(emptyLazy, true)).toBe('updating')
  })
  it('an ordinary crash is not this boundary’s', () => {
    expect(windowLoadView(emptyLazy, false)).toBe('broken')
    expect(windowLoadView(new Error('boom'), false)).toBe('broken')
  })
})

describe('the line a window leaves', () => {
  it('names the window and the next press', () => {
    expect(windowLostWords('The job')).toBe('The job could not open. Check your signal, then press it again.')
  })
  it.each(Object.values(WINDOW_NAMES))('%s: its line is plain words', (what) => {
    expect(plainWordsFailures(windowLostWords(what))).toEqual([])
    expect(what).toMatch(/^The [a-z]/)
  })
  it.each(Object.values(WINDOW_NAMES))('%s: its line over typed words is plain words, and says what frees it', (what) => {
    expect(plainWordsFailures(windowLostTypedWords(what))).toEqual([])
    expect(windowLostTypedWords(what)).toMatch(/Send or clear it, then press again\.$/)
  })
  it('says the typed line only when the browser says the network is there', () => {
    expect(windowLostLine('The job', false, true)).toEqual({ words: windowLostTypedWords('The job'), ms: WINDOW_LOST_TYPED_LINE_MS })
    expect(windowLostLine('The job', true, true)).toEqual({ words: windowLostWords('The job'), ms: WINDOW_LOST_LINE_MS })
    expect(windowLostLine('The job', false, false)).toEqual({ words: windowLostWords('The job'), ms: WINDOW_LOST_LINE_MS })
    expect(WINDOW_LOST_TYPED_LINE_MS).toBeGreaterThan(WINDOW_LOST_LINE_MS)
  })
  it('says nothing of the app’s own workings', () => {
    for (const what of Object.values(WINDOW_NAMES)) expect(windowLostWords(what)).not.toMatch(/chunk|cache|update|reload/i)
  })
  it('the note while the reload comes is the routes’ own', () => {
    expect(WINDOW_UPDATING_WORDS).toBe('Updating app…')
  })
})

/** Every `.ts` and `.tsx` under `dir` that is not a test. */
function sources(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sources(path))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path)
  }
  return out
}

describe('every on-demand window’s host', () => {
  const src = join(__dirname, '..')
  // `App.tsx` holds pages, each inside `PublicPage` with its own boundary; the two lib files only name the helper.
  const notHosts = new Set(['App.tsx', 'lib/lazyWindow.ts', 'lib/lazyRouteBoundaries.ts', 'lib/windowLoad.ts'])
  const hosts = sources(src)
    .map((path) => ({ file: relative(src, path), text: readFileSync(path, 'utf8') }))
    .filter(({ file, text }) => !notHosts.has(file) && /\blazyWindow\s*\(\s*\(\)\s*=>\s*import\(/.test(text))

  it('is found: the walk reads the hosts it is meant to', () => {
    expect(hosts.map((h) => h.file)).toEqual(
      expect.arrayContaining(['contexts/JobDetailModalContext.tsx', 'components/EditCustomerModal.tsx', 'components/paintedMap/PaintedMapHost.tsx']),
    )
    expect(hosts.length).toBeGreaterThanOrEqual(8)
  })

  it('puts its window in a WindowLoadBoundary, so a load that fails keeps the page behind it', () => {
    const bare = hosts.filter(({ text }) => !/<WindowLoadBoundary[\s>]/.test(text) && !/<OnDemandWindow[\s>]/.test(text)).map((h) => h.file)
    expect(
      bare,
      `${bare.join(', ')} holds a window through lazyWindow with no boundary of its own. When the window's code does not come, the routes' boundary ` +
        'replaces the whole signed-in app. Wrap the window and its <Suspense> in <WindowLoadBoundary what={…} onGaveUp={close}>, or hold it in <OnDemandWindow>.',
    ).toEqual([])
  })
})
