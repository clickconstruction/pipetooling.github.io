import { describe, expect, it, vi } from 'vitest'
import {
  AUTH_GATE_SLOW_WORDS,
  DEV_RUNBOOK_AFTER_MS,
  DEV_RUNBOOK_WORDS,
  KEPT_PAGE_WORDS_LEAD,
  OFFLINE_WORDS,
  SIGNAL_TTL_MS,
  SLOW_AFTER_MS,
  SLOW_WORDS,
  STRIP_HOLD_MS,
  UNREACHABLE_AFTER_MS,
  UNREACHABLE_WORDS,
  appHealthHoldsGate,
  appHealthStripWords,
  bindAppHealthToWindow,
  createAppHealthStore,
  gateHoldsFor,
  isFreezeCode,
  isFreezeSignal,
  isWatchedRequestUrl,
  keptPageWords,
  shouldRetryRoleRead,
  wrapFetchReportingHealth,
  type AppHealthReading,
} from './appHealth'
import { plainWordsFailures } from './plainWords'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

const T0 = 1_000_000

describe('appHealth · the slow rule (4 s with nothing landing)', () => {
  it('starts fine and stays fine while nothing has waited past the bound', () => {
    const s = createAppHealthStore()
    expect(s.read(T0).state).toBe('fine')
    s.requestStarted(T0)
    expect(s.read(T0 + SLOW_AFTER_MS - 1).state).toBe('fine')
  })

  it('turns slow the moment one request has waited 4 s with nothing landing', () => {
    const s = createAppHealthStore()
    s.requestStarted(T0)
    expect(s.read(T0 + SLOW_AFTER_MS).state).toBe('slow')
  })

  it('a good day: one 4.8 s read with others landing around it never shows the strip', () => {
    const s = createAppHealthStore()
    const long = s.requestStarted(T0)
    for (let t = 500; t <= 4_500; t += 500) {
      const id = s.requestStarted(T0 + t - 200)
      s.requestLanded(id, { status: 200 }, T0 + t)
      expect(s.read(T0 + t).state).toBe('fine')
    }
    s.requestLanded(long, { status: 200 }, T0 + 4_800)
    expect(s.read(T0 + 4_800).state).toBe('fine')
  })

  it('a landing clears slow once the 3 s hold is over', () => {
    const s = createAppHealthStore()
    const id = s.requestStarted(T0)
    expect(s.read(T0 + 4_000).state).toBe('slow')
    s.requestLanded(id, { status: 200 }, T0 + 4_500)
    expect(s.read(T0 + 4_600).state).toBe('slow')
    expect(s.read(T0 + 6_999).state).toBe('slow')
    expect(s.read(T0 + 7_000).state).toBe('fine')
  })

  it('a landing while others still wait restarts the 4 s window', () => {
    const s = createAppHealthStore()
    s.requestStarted(T0)
    const quick = s.requestStarted(T0 + 3_000)
    s.requestLanded(quick, { status: 200 }, T0 + 3_500)
    expect(s.read(T0 + 4_000).state).toBe('fine')
    expect(s.read(T0 + 7_499).state).toBe('fine')
    expect(s.read(T0 + 7_500).state).toBe('slow')
  })

  it('the strip holds at least 3 s even when the trouble lasted a moment', () => {
    const s = createAppHealthStore()
    const id = s.requestStarted(T0)
    expect(s.read(T0 + 4_000).state).toBe('slow')
    s.requestLanded(id, { status: 200 }, T0 + 4_001)
    expect(s.read(T0 + 4_002).state).toBe('slow')
    expect(s.read(T0 + 4_000 + STRIP_HOLD_MS).state).toBe('fine')
  })
})

describe('appHealth · the freeze codes', () => {
  it.each(['57014', '57P03', '53300', '53000', '08006', '08P01', 'PGRST000', 'PGRST001', 'PGRST002', 'PGRST003'])('%s is a freeze code', (code) => {
    expect(isFreezeCode(code)).toBe(true)
  })

  it.each(['PGRST116', '23505', '42501', '22P02', '', ' ', 'PGRST004'])('%j is not a freeze code', (code) => {
    expect(isFreezeCode(code)).toBe(false)
  })

  it('a freeze signal is a freeze code or one of the five HTTP statuses', () => {
    expect(isFreezeSignal({ status: 500, code: '57014' })).toBe(true)
    expect(isFreezeSignal({ status: 503 })).toBe(true)
    expect(isFreezeSignal({ status: 502 })).toBe(true)
    expect(isFreezeSignal({ status: 504 })).toBe(true)
    expect(isFreezeSignal({ status: 522 })).toBe(true)
    expect(isFreezeSignal({ status: 524 })).toBe(true)
    expect(isFreezeSignal({ status: 500 })).toBe(false)
    expect(isFreezeSignal({ status: 404, code: 'PGRST116' })).toBe(false)
    expect(isFreezeSignal({ status: 401 })).toBe(false)
  })

  it('a statement timeout turns the strip on at once, whatever is in flight', () => {
    const s = createAppHealthStore()
    const id = s.requestStarted(T0)
    s.requestLanded(id, { status: 500, code: '57014' }, T0 + 1_000)
    expect(s.read(T0 + 1_000).state).toBe('slow')
  })

  it('a 404 or a 401 is a landing, not a freeze', () => {
    const s = createAppHealthStore()
    const a = s.requestStarted(T0)
    s.requestLanded(a, { status: 404, code: 'PGRST116' }, T0 + 100)
    const b = s.requestStarted(T0 + 100)
    s.requestLanded(b, { status: 401 }, T0 + 200)
    expect(s.read(T0 + 200).state).toBe('fine')
  })

  it('a freeze code keeps its word for 30 s with nothing landing, and a landing clears it', () => {
    const s = createAppHealthStore()
    const id = s.requestStarted(T0)
    s.requestLanded(id, { status: 503 }, T0 + 1_000)
    expect(s.read(T0 + 1_000).state).toBe('slow')
    expect(s.read(T0 + 1_000 + SIGNAL_TTL_MS - 1).state).toBe('slow')
    expect(s.read(T0 + 1_000 + SIGNAL_TTL_MS).state).toBe('fine')
    const again = s.requestStarted(T0 + 40_000)
    s.requestLanded(again, { status: 500, code: '57014' }, T0 + 41_000)
    expect(s.read(T0 + 41_000).state).toBe('slow')
    const good = s.requestStarted(T0 + 42_000)
    s.requestLanded(good, { status: 200 }, T0 + 42_100)
    expect(s.read(T0 + 44_000 + STRIP_HOLD_MS).state).toBe('fine')
  })
})

describe('appHealth · unreachable', () => {
  it('a fetch-layer failure with nothing ever landed is unreachable at once', () => {
    const s = createAppHealthStore()
    const id = s.requestStarted(T0)
    s.requestFailed(id, new TypeError('Failed to fetch'), T0 + 50)
    expect(s.read(T0 + 50).state).toBe('unreachable')
  })

  it('a stray failure a second after a landing waits: unreachable only once nothing lands for 4 s', () => {
    const s = createAppHealthStore()
    const good = s.requestStarted(T0)
    s.requestLanded(good, { status: 200 }, T0 + 100)
    const bad = s.requestStarted(T0 + 500)
    s.requestFailed(bad, new TypeError('Load failed'), T0 + 1_100)
    expect(s.read(T0 + 1_100).state).toBe('fine')
    expect(s.read(T0 + 4_099).state).toBe('fine')
    expect(s.read(T0 + 4_100).state).toBe('unreachable')
  })

  it('a landing after the failure clears unreachable', () => {
    const s = createAppHealthStore()
    const bad = s.requestStarted(T0)
    s.requestFailed(bad, new TypeError('Failed to fetch'), T0 + 50)
    expect(s.read(T0 + 50).state).toBe('unreachable')
    const good = s.requestStarted(T0 + 2_000)
    s.requestLanded(good, { status: 200 }, T0 + 2_200)
    expect(s.read(T0 + 2_200).state).toBe('unreachable')
    expect(s.read(T0 + 50 + STRIP_HOLD_MS).state).toBe('fine')
  })

  it('20 s waiting with no answer of any kind is unreachable', () => {
    const s = createAppHealthStore()
    s.requestStarted(T0)
    expect(s.read(T0 + UNREACHABLE_AFTER_MS - 1).state).toBe('slow')
    expect(s.read(T0 + UNREACHABLE_AFTER_MS).state).toBe('unreachable')
  })

  it('statement timeouts are answers: a pileup stays slow, never unreachable', () => {
    const s = createAppHealthStore()
    s.requestStarted(T0)
    const a = s.requestStarted(T0)
    s.requestLanded(a, { status: 500, code: '57014' }, T0 + 8_000)
    const b = s.requestStarted(T0 + 8_000)
    s.requestLanded(b, { status: 500, code: '57014' }, T0 + 16_000)
    expect(s.read(T0 + 20_000).state).toBe('slow')
    expect(s.read(T0 + 30_000).state).toBe('slow')
  })

  it('an abort is nobody is fault: no mark, and the request leaves the wait', () => {
    const s = createAppHealthStore()
    const id = s.requestStarted(T0)
    const abort = Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })
    s.requestFailed(id, abort, T0 + 100)
    expect(s.inFlightCount()).toBe(0)
    expect(s.read(T0 + 100).state).toBe('fine')
    expect(s.read(T0 + 10_000).state).toBe('fine')
  })
})

describe('appHealth · offline', () => {
  it('the browser says offline: offline, whatever else is true', () => {
    const s = createAppHealthStore({ online: false })
    expect(s.read(T0).state).toBe('offline')
    s.requestStarted(T0)
    expect(s.read(T0 + 10_000).state).toBe('offline')
  })

  it('a failure while offline leaves no unreachable mark for when the signal is back', () => {
    const s = createAppHealthStore()
    s.setOnline(false, T0)
    const id = s.requestStarted(T0)
    s.requestFailed(id, new TypeError('Failed to fetch'), T0 + 100)
    s.setOnline(true, T0 + 200)
    expect(s.read(T0 + 200 + STRIP_HOLD_MS).state).toBe('fine')
  })

  it('setOnline with no change notifies nobody', () => {
    const s = createAppHealthStore()
    const cb = vi.fn()
    s.subscribe(cb)
    s.setOnline(true, T0)
    expect(cb).not.toHaveBeenCalled()
    s.setOnline(false, T0)
    expect(cb).toHaveBeenCalledTimes(1)
  })
})

describe('appHealth · troubleSince, resumed, nextChangeAt, subscribe', () => {
  it('troubleSince is the first read that saw trouble and clears when fine settles', () => {
    const s = createAppHealthStore()
    const id = s.requestStarted(T0)
    expect(s.read(T0 + 1_000).troubleSince).toBeNull()
    expect(s.read(T0 + 4_000).troubleSince).toBe(T0 + 4_000)
    expect(s.read(T0 + 5_000).troubleSince).toBe(T0 + 4_000)
    s.requestLanded(id, { status: 200 }, T0 + 5_500)
    // the hold runs to 7 s: the strip is still up, so the trouble is still on
    expect(s.read(T0 + 5_600).troubleSince).toBe(T0 + 4_000)
    expect(s.read(T0 + 4_000 + STRIP_HOLD_MS).troubleSince).toBeNull()
  })

  it('resumed restarts the wait of everything in flight', () => {
    const s = createAppHealthStore()
    s.requestStarted(T0)
    s.resumed(T0 + 60_000)
    expect(s.read(T0 + 60_000).state).toBe('fine')
    expect(s.read(T0 + 60_000 + SLOW_AFTER_MS).state).toBe('slow')
  })

  it('nextChangeAt names the next instant the reading could change, or null when it cannot', () => {
    const s = createAppHealthStore()
    expect(s.read(T0).nextChangeAt).toBeNull()
    const id = s.requestStarted(T0)
    expect(s.read(T0).nextChangeAt).toBe(T0 + SLOW_AFTER_MS)
    expect(s.read(T0 + SLOW_AFTER_MS).nextChangeAt).toBe(T0 + SLOW_AFTER_MS + STRIP_HOLD_MS)
    expect(s.read(T0 + SLOW_AFTER_MS + STRIP_HOLD_MS).nextChangeAt).toBe(T0 + UNREACHABLE_AFTER_MS)
    s.requestLanded(id, { status: 200 }, T0 + 8_000)
    // the hold ends at 7 s, so at 8 s the strip is gone and only the landing's own window remains
    expect(s.read(T0 + 8_000)).toEqual({ state: 'fine', troubleSince: null, nextChangeAt: T0 + 8_000 + SLOW_AFTER_MS })
    expect(s.read(T0 + 13_000).nextChangeAt).toBeNull()
  })

  it('nextChangeAt is always in the future, so a reader that re-reads on it never stalls', () => {
    const s = createAppHealthStore()
    s.requestStarted(T0)
    let now = T0
    const seen: number[] = []
    for (let i = 0; i < 6; i += 1) {
      const next = s.read(now).nextChangeAt
      if (next == null) break
      expect(next).toBeGreaterThan(now)
      seen.push(next)
      now = next
    }
    // slow at 4 s, the hold's end at 7 s, unreachable at 20 s (the strip is already up, so no new hold), the dev line at 64 s
    expect(seen).toEqual([T0 + 4_000, T0 + 7_000, T0 + 20_000, T0 + 64_000])
  })

  it('every event bumps the version and tells the listeners', () => {
    const s = createAppHealthStore()
    const cb = vi.fn()
    const off = s.subscribe(cb)
    const id = s.requestStarted(T0)
    s.requestLanded(id, { status: 200 }, T0 + 1)
    expect(cb).toHaveBeenCalledTimes(2)
    expect(s.version()).toBe(2)
    off()
    s.requestStarted(T0 + 2)
    expect(cb).toHaveBeenCalledTimes(2)
    expect(s.version()).toBe(3)
  })
})

describe('appHealth · the words', () => {
  const reading = (state: AppHealthReading['state'], troubleSince: number | null = T0): AppHealthReading => ({ state, troubleSince, nextChangeAt: null })

  it('fine has no strip', () => {
    expect(appHealthStripWords(reading('fine', null), { dev: false, now: T0 })).toBeNull()
  })

  it('slow reads the owner is own line in amber with no Retry', () => {
    expect(appHealthStripWords(reading('slow'), { dev: false, now: T0 })).toEqual({ tone: 'amber', lead: SLOW_WORDS, lines: [], retry: false })
  })

  it('unreachable reads in red with Retry', () => {
    expect(appHealthStripWords(reading('unreachable'), { dev: false, now: T0 })).toEqual({ tone: 'red', lead: UNREACHABLE_WORDS, lines: [], retry: true })
  })

  it('offline reads No signal in grey', () => {
    expect(appHealthStripWords(reading('offline'), { dev: true, now: T0 + 100_000 })).toEqual({ tone: 'grey', lead: OFFLINE_WORDS, lines: [], retry: false })
  })

  it('a dev sees the runbook line once the trouble is a minute old; nobody else does', () => {
    const at59 = { dev: true, now: T0 + DEV_RUNBOOK_AFTER_MS - 1 }
    const at60 = { dev: true, now: T0 + DEV_RUNBOOK_AFTER_MS }
    expect(appHealthStripWords(reading('slow'), at59)?.lines).toEqual([])
    expect(appHealthStripWords(reading('slow'), at60)?.lines).toEqual([DEV_RUNBOOK_WORDS])
    expect(appHealthStripWords(reading('unreachable'), at60)?.lines).toEqual([DEV_RUNBOOK_WORDS])
    expect(appHealthStripWords(reading('slow'), { dev: false, now: T0 + 500_000 })?.lines).toEqual([])
  })

  it('a kept page on screen adds The page you see was read at, right after the lead, in every state (#183 PR 2)', () => {
    const keptReadAt = Date.UTC(2026, 9, 28, 12, 52) // 7:52 AM in Chicago
    const format = { timeZone: APP_CALENDAR_TZ }
    expect(keptPageWords(keptReadAt, format)).toBe('The page you see was read at 7:52 AM.')
    expect(KEPT_PAGE_WORDS_LEAD).toBe('The page you see was read at')
    expect(appHealthStripWords(reading('slow'), { dev: false, now: T0, keptReadAt, format })?.lines).toEqual(['The page you see was read at 7:52 AM.'])
    expect(appHealthStripWords(reading('unreachable'), { dev: false, now: T0, keptReadAt, format })?.lines).toEqual(['The page you see was read at 7:52 AM.'])
    expect(appHealthStripWords(reading('offline'), { dev: false, now: T0, keptReadAt, format })?.lines).toEqual(['The page you see was read at 7:52 AM.'])
    expect(appHealthStripWords(reading('slow'), { dev: true, now: T0 + DEV_RUNBOOK_AFTER_MS, keptReadAt, format })?.lines).toEqual([
      'The page you see was read at 7:52 AM.',
      DEV_RUNBOOK_WORDS,
    ])
    expect(appHealthStripWords(reading('slow'), { dev: false, now: T0, keptReadAt: null })?.lines).toEqual([])
    expect(appHealthStripWords(reading('fine', null), { dev: false, now: T0, keptReadAt })).toBeNull()
  })

  it('every sentence is plain words', () => {
    for (const words of [SLOW_WORDS, UNREACHABLE_WORDS, OFFLINE_WORDS, DEV_RUNBOOK_WORDS, AUTH_GATE_SLOW_WORDS, keptPageWords(Date.UTC(2026, 9, 28, 12, 52))]) {
      expect(plainWordsFailures(words), words).toEqual([])
    }
  })
})

describe('appHealth · the auth gate', () => {
  it('the watchdogs hold for slow and unreachable, never for fine or offline', () => {
    expect(gateHoldsFor('slow')).toBe(true)
    expect(gateHoldsFor('unreachable')).toBe(true)
    expect(gateHoldsFor('fine')).toBe(false)
    expect(gateHoldsFor('offline')).toBe(false)
  })

  it('appHealthHoldsGate reads the store at now', () => {
    const s = createAppHealthStore()
    s.requestStarted(T0)
    expect(appHealthHoldsGate(T0 + 1_000, s)).toBe(false)
    expect(appHealthHoldsGate(T0 + 4_000, s)).toBe(true)
  })

  it('a role read is read again on a freeze code or while the app is slow, and not on a plain refusal', () => {
    const s = createAppHealthStore()
    expect(shouldRetryRoleRead({ code: '57014' }, T0, s)).toBe(true)
    expect(shouldRetryRoleRead({ code: 'PGRST116' }, T0, s)).toBe(false)
    expect(shouldRetryRoleRead(null, T0, s)).toBe(false)
    s.requestStarted(T0)
    expect(shouldRetryRoleRead({ code: '42501' }, T0 + 4_000, s)).toBe(true)
  })

  it('a role read that never reached the server is read again, offline or not: a lost signal is not a missing role (punch list #163 live test)', () => {
    const s = createAppHealthStore({ online: false })
    // supabase-js answers a rejected fetch with an empty code, the engine's TypeError as the message and status 0.
    expect(shouldRetryRoleRead({ code: '', message: 'TypeError: Failed to fetch' }, T0, s)).toBe(true)
    expect(shouldRetryRoleRead({ code: '', message: 'TypeError: Load failed' }, T0, s)).toBe(true)
    expect(shouldRetryRoleRead({ code: '', message: 'Error: offline', status: 0 }, T0, s)).toBe(true)
    expect(shouldRetryRoleRead({ code: '', message: 'TypeError: Failed to fetch' }, T0, createAppHealthStore())).toBe(true)
    // An answer is still final, and an aborted read waits for the slow rule.
    expect(shouldRetryRoleRead({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, T0, s)).toBe(false)
    expect(shouldRetryRoleRead({ code: '', message: 'AbortError: signal is aborted without reason', status: 0 }, T0, s)).toBe(false)
  })
})

/** The code rides in the body, read off a clone after the caller has its copy: wait for that read, not for a timer (a 0 ms timer lost the race on a loaded machine). */
async function codeRead(s: ReturnType<typeof createAppHealthStore>): Promise<void> {
  for (let i = 0; i < 200 && s.inFlightCount() > 0; i += 1) await new Promise((r) => setTimeout(r, 1))
}

describe('appHealth · the fetch wrapper', () => {
  const REST = 'https://x.supabase.co/rest/v1/jobs?select=id'
  const AUTH = 'https://x.supabase.co/auth/v1/token?grant_type=refresh_token'
  const FN = 'https://x.supabase.co/functions/v1/robot'

  it('watches the database and auth, not functions or storage', () => {
    expect(isWatchedRequestUrl(REST)).toBe(true)
    expect(isWatchedRequestUrl(AUTH)).toBe(true)
    expect(isWatchedRequestUrl(FN)).toBe(false)
    expect(isWatchedRequestUrl('https://x.supabase.co/storage/v1/object/plans/a.pdf')).toBe(false)
  })

  it('reports a watched request is start and its landing', async () => {
    const s = createAppHealthStore()
    let now = T0
    const inner = vi.fn(async () => new Response('[]', { status: 200 }))
    const f = wrapFetchReportingHealth(inner, s, () => now)
    const p = f(REST)
    expect(s.inFlightCount()).toBe(1)
    now = T0 + 300
    await p
    expect(s.inFlightCount()).toBe(0)
    expect(s.read(T0 + 300).state).toBe('fine')
    expect(inner).toHaveBeenCalledWith(REST, undefined)
  })

  it('leaves an unwatched request alone', async () => {
    const s = createAppHealthStore()
    const f = wrapFetchReportingHealth(async () => new Response('{}'), s, () => T0)
    await f(FN)
    expect(s.version()).toBe(0)
  })

  it('reads the freeze code out of a 500 body', async () => {
    const s = createAppHealthStore()
    const body = JSON.stringify({ code: '57014', message: 'canceling statement due to statement timeout' })
    const f = wrapFetchReportingHealth(async () => new Response(body, { status: 500, headers: { 'content-type': 'application/json' } }), s, () => T0)
    const res = await f(REST)
    await res.json()
    await codeRead(s)
    expect(s.read(T0).state).toBe('slow')
  })

  it('a 404 with a PostgREST code is a landing', async () => {
    const s = createAppHealthStore()
    const f = wrapFetchReportingHealth(async () => new Response(JSON.stringify({ code: 'PGRST116' }), { status: 404 }), s, () => T0)
    await f(REST)
    await codeRead(s)
    expect(s.read(T0 + 10_000).state).toBe('fine')
  })

  it('a thrown fetch is a failure and still throws to the caller', async () => {
    const s = createAppHealthStore()
    const f = wrapFetchReportingHealth(async () => { throw new TypeError('Failed to fetch') }, s, () => T0)
    await expect(f(new URL(AUTH))).rejects.toThrow('Failed to fetch')
    expect(s.read(T0).state).toBe('unreachable')
  })

  it('the caller is copy of the body is untouched by the code read', async () => {
    const s = createAppHealthStore()
    const f = wrapFetchReportingHealth(async () => new Response(JSON.stringify({ code: '57014' }), { status: 500 }), s, () => T0)
    const res = await f(REST)
    expect(await res.json()).toEqual({ code: '57014' })
  })
})

describe('appHealth · the window binding', () => {
  function fakeWindow(online: boolean, visibility = 'visible') {
    const handlers = new Map<string, () => void>()
    const docHandlers = new Map<string, () => void>()
    return {
      win: {
        navigator: { onLine: online },
        document: {
          visibilityState: visibility,
          addEventListener: (t: string, cb: () => void) => void docHandlers.set(t, cb),
          removeEventListener: (t: string) => void docHandlers.delete(t),
        },
        addEventListener: (t: string, cb: () => void) => void handlers.set(t, cb),
        removeEventListener: (t: string) => void handlers.delete(t),
      },
      fire: (t: string) => handlers.get(t)?.(),
      fireDoc: (t: string) => docHandlers.get(t)?.(),
      count: () => handlers.size + docHandlers.size,
    }
  }

  it('takes the browser is word on online and follows the events', () => {
    const s = createAppHealthStore()
    const w = fakeWindow(false)
    const off = bindAppHealthToWindow(w.win, s, () => T0)
    expect(s.read(T0).state).toBe('offline')
    w.fire('online')
    expect(s.read(T0 + STRIP_HOLD_MS).state).toBe('fine')
    w.fire('offline')
    expect(s.read(T0 + 10_000).state).toBe('offline')
    expect(w.count()).toBe(4)
    off()
    expect(w.count()).toBe(0)
  })

  it('coming back to the front restarts the waits', () => {
    const s = createAppHealthStore()
    let now = T0
    const w = fakeWindow(true)
    bindAppHealthToWindow(w.win, s, () => now)
    s.requestStarted(T0)
    now = T0 + 30_000
    w.fireDoc('visibilitychange')
    expect(s.read(now).state).toBe('fine')
    w.win.document.visibilityState = 'hidden'
    now = T0 + 60_000
    w.fire('pageshow')
    expect(s.read(now).state).toBe('unreachable')
  })
})
