import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PUBLIC_PAGE_CHECKING_WORDS,
  PUBLIC_PAGE_LOADING_WORDS,
  PUBLIC_PAGE_LOST_WORDS,
  PUBLIC_PAGE_OFFLINE_WORDS,
  PUBLIC_PAGE_PROBE_PATH,
  PUBLIC_PAGE_PROBE_TIMEOUT_MS,
  PUBLIC_PAGE_SLOW_WORDS,
  PUBLIC_PAGE_STILL_OFFLINE_WORDS,
  PUBLIC_PAGE_TRY_AGAIN,
  probeAnswered,
  probeForSignal,
  publicPageLostView,
  publicPageProbeUrl,
  publicPageTryAgainAct,
} from './publicPageLoad'
import { plainWordsFailures } from './plainWords'

describe('publicPageLostView', () => {
  it('online, the page says it did not load and the press reloads', () => {
    expect(publicPageLostView(true, false)).toEqual({ words: PUBLIC_PAGE_LOST_WORDS, reload: true, checking: false })
  })
  it('a browser that cannot say counts as online', () => {
    expect(publicPageLostView(undefined, false).reload).toBe(true)
  })
  it('offline, it says so and the press does not reload', () => {
    expect(publicPageLostView(false, false)).toEqual({ words: PUBLIC_PAGE_OFFLINE_WORDS, reload: false, checking: false })
  })
  it('a press while offline is answered in words', () => {
    expect(publicPageLostView(false, true)).toEqual({ words: PUBLIC_PAGE_STILL_OFFLINE_WORDS, reload: false, checking: false })
  })
  it('while the page asks the network it says so, and the press is dead', () => {
    expect(publicPageLostView(false, true, true)).toEqual({ words: PUBLIC_PAGE_CHECKING_WORDS, reload: false, checking: true })
  })
  it('online, an ask that is still out changes nothing: the press reloads', () => {
    expect(publicPageLostView(true, true, true)).toEqual({ words: PUBLIC_PAGE_LOST_WORDS, reload: true, checking: false })
  })
})

describe('publicPageTryAgainAct: what a press on Try again does', () => {
  it('online, it reloads, whatever was pressed before', () => {
    expect(publicPageTryAgainAct(true, false)).toBe('reload')
    expect(publicPageTryAgainAct(true, true)).toBe('reload')
  })
  it('a browser that cannot say counts as online', () => {
    expect(publicPageTryAgainAct(undefined, false)).toBe('reload')
  })
  it('offline, the first press answers in words', () => {
    expect(publicPageTryAgainAct(false, false)).toBe('answer')
  })
  it('offline, the second press asks the network: it never reloads on the browser’s word or the count alone', () => {
    expect(publicPageTryAgainAct(false, true)).toBe('ask')
  })
})

describe('the ask a second press sends', () => {
  const answer = (ok: boolean, type: string | null) => ({ ok, headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? type : null) } })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads a file the site really serves', () => {
    expect(PUBLIC_PAGE_PROBE_PATH).toBe('/favicon.svg')
    const file = join(__dirname, '..', '..', 'public', 'favicon.svg')
    expect(existsSync(file), 'public/favicon.svg is what a second Try again asks for. Without it the ask always fails and the press never reloads.').toBe(true)
    expect(readFileSync(file, 'utf8')).toContain('<svg')
  })
  it('carries the time, so no cache between here and the server has the answer', () => {
    expect(publicPageProbeUrl(1700000000000)).toBe('/favicon.svg?signal=1700000000000')
  })
  it('the service worker is not told to ignore the key: it would then answer the ask from the phone, with no network', () => {
    const sw = readFileSync(join(__dirname, '..', 'sw.ts'), 'utf8')
    // The icon is precached. The precache matches an address exactly, so the key keeps the ask out of it.
    expect(sw).toContain('precacheAndRoute(self.__WB_MANIFEST)')
    expect(
      sw,
      'src/sw.ts sets ignoreURLParametersMatching. If it matches "signal", the precache answers a second Try again while the phone is offline, ' +
        'and the page reloads into the browser’s error page. Keep "signal" out of it, or give the ask in publicPageLoad.ts another address.',
    ).not.toContain('ignoreURLParametersMatching')
  })
  it('counts the site’s own icon as an answer', () => {
    expect(probeAnswered(answer(true, 'image/svg+xml'))).toBe(true)
    expect(probeAnswered(answer(true, 'Image/SVG+XML; charset=utf-8'))).toBe(true)
  })
  it('does not count a sign-in wall’s page, a refusal or an answer with no type', () => {
    expect(probeAnswered(answer(true, 'text/html; charset=utf-8'))).toBe(false)
    expect(probeAnswered(answer(false, 'image/svg+xml'))).toBe(false)
    expect(probeAnswered(answer(true, null))).toBe(false)
  })
  it('asks once, past every cache and with no cookie, and says yes when the server answers', async () => {
    const fetcher = vi.fn(async () => answer(true, 'image/svg+xml'))
    await expect(probeForSignal(fetcher, 42)).resolves.toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, { cache: string; credentials: string; signal: AbortSignal }]
    expect(url).toBe('/favicon.svg?signal=42')
    expect(init.cache).toBe('no-store')
    expect(init.credentials).toBe('omit')
    expect(init.signal.aborted).toBe(false)
  })
  it('says no when there is no network, and never throws', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(probeForSignal(fetcher, 42)).resolves.toBe(false)
  })
  it('says no when a sign-in wall answers', async () => {
    await expect(probeForSignal(async () => answer(true, 'text/html'), 42)).resolves.toBe(false)
  })
  it('gives up on a request that hangs, and says no', async () => {
    vi.useFakeTimers()
    let stopped = false
    const hangs = (_url: string, init: { signal: AbortSignal }) =>
      new Promise<never>((_, reject) => {
        init.signal.addEventListener('abort', () => {
          stopped = true
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    const asked = probeForSignal(hangs, 42)
    await vi.advanceTimersByTimeAsync(PUBLIC_PAGE_PROBE_TIMEOUT_MS - 1)
    expect(stopped).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(asked).resolves.toBe(false)
    expect(stopped).toBe(true)
  })
})

describe('a public page’s words while it loads', () => {
  it.each([PUBLIC_PAGE_SLOW_WORDS, PUBLIC_PAGE_LOST_WORDS, PUBLIC_PAGE_OFFLINE_WORDS, PUBLIC_PAGE_STILL_OFFLINE_WORDS, PUBLIC_PAGE_CHECKING_WORDS])('%s is plain words', (words) => {
    expect(plainWordsFailures(words)).toEqual([])
  })
  it('names no part of the staff app', () => {
    for (const words of [PUBLIC_PAGE_LOADING_WORDS, PUBLIC_PAGE_SLOW_WORDS, PUBLIC_PAGE_LOST_WORDS, PUBLIC_PAGE_OFFLINE_WORDS, PUBLIC_PAGE_STILL_OFFLINE_WORDS, PUBLIC_PAGE_CHECKING_WORDS, PUBLIC_PAGE_TRY_AGAIN]) {
      expect(words).not.toMatch(/\bapp\b|update|cache/i)
    }
  })
})
