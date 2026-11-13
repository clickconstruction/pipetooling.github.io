import { describe, expect, it } from 'vitest'

import { POST_LOGIN_REDIRECT_KEY } from './iosPwa'
import { helpGuideAppPath } from './helpShareCard'
import { lienDeskHref } from './lien/lienDeskRoute'
import { lienWindowHref } from './jobs/stagesDeepLinks'
import { boxPagePath } from './materials/boxPage'
import {
  MAGIC_LINK_DEFAULT_LANDING,
  POST_LOGIN_REDIRECT_AT_KEY,
  RETURN_ADDRESS_KEEP_MS,
  RETURN_ADDRESS_MAX,
  applyGateMemory,
  forgetStoredReturnAddress,
  gateMemory,
  keepReturnAddress,
  magicLinkLandingPath,
  readStoredReturnAddress,
  returnAddressFromSignInSearch,
  returnAddressIsFresh,
  returnAddressOf,
  safeReturnAddress,
  signInHrefCarrying,
  signedInDestination,
  waitingReturnAddress,
  type ReturnAddressStore,
} from './signInReturnAddress'

const JOB = '26c58929-183d-4d92-99f0-6c891f104bcd'
/** The two addresses a lien help sheet's Scan to record code draws (v2.6994). */
const LIEN_WINDOW = lienWindowHref(JOB, 'affidavit')
const LIEN_DESK = lienDeskHref({ kind: 'affidavit' })

function fakeStore(initial: Record<string, string> = {}): ReturnAddressStore & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v
    },
    removeItem: (k) => {
      delete data[k]
    },
  }
}

const refusingStore: ReturnAddressStore = {
  getItem: () => {
    throw new Error('storage refused')
  },
  setItem: () => {
    throw new Error('storage refused')
  },
  removeItem: () => {
    throw new Error('storage refused')
  },
}

describe('safeReturnAddress', () => {
  it('keeps a path on this site whole, with its query', () => {
    expect(safeReturnAddress(LIEN_WINDOW)).toBe(`/jobs?tab=stages&lienwindow=${JOB}&lientab=affidavit`)
    expect(safeReturnAddress(LIEN_DESK)).toBe('/lien-desk?tab=affidavits')
    expect(safeReturnAddress('/task')).toBe('/task')
    expect(safeReturnAddress('/b/4f2a9c18')).toBe('/b/4f2a9c18')
    expect(safeReturnAddress('/files/messages/att-1')).toBe('/files/messages/att-1')
  })

  it('keeps a heading anchor and drops any other hash', () => {
    expect(safeReturnAddress('/help/file-a-lien-and-never-miss-its-deadlines#the-month-rule')).toBe(
      '/help/file-a-lien-and-never-miss-its-deadlines#the-month-rule',
    )
    expect(safeReturnAddress('/dashboard#access_token=abc&refresh_token=def&type=magiclink')).toBe('/dashboard')
    expect(safeReturnAddress('/jobs?tab=stages#error=access_denied&error_code=otp_expired')).toBe('/jobs?tab=stages')
  })

  it('refuses another site in every spelling', () => {
    for (const raw of [
      'https://evil.example/jobs',
      'http://evil.example',
      '//evil.example/jobs',
      '///evil.example',
      '/\\evil.example',
      '/\\/evil.example',
      '\\\\evil.example',
      '/..//evil.example',
      '/.//evil.example',
      '/jobs/../..//evil.example',
      '/\t/evil.example',
      '/\n/evil.example',
      '/jobs\\..\\evil',
      'javascript:alert(1)',
      'data:text/html,hi',
      'evil.example/jobs',
      'jobs?tab=stages',
      ' /jobs',
    ]) {
      expect(safeReturnAddress(raw), raw).toBeNull()
    }
  })

  it('never returns an address that starts with two slashes', () => {
    for (const raw of ['/a/..//b', '/..//..//b', '/%2e%2e//b']) {
      const kept = safeReturnAddress(raw)
      if (kept !== null) expect(kept.startsWith('//'), raw).toBe(false)
    }
  })

  it('refuses what is not an address at all', () => {
    for (const raw of [null, undefined, '', 0, {}, [], true]) expect(safeReturnAddress(raw)).toBeNull()
    expect(safeReturnAddress(`/${'a'.repeat(RETURN_ADDRESS_MAX)}`)).toBeNull()
    expect(safeReturnAddress(`/${'a'.repeat(RETURN_ADDRESS_MAX - 1)}`)).not.toBeNull()
  })

  it('reads the root and the sign-in page as no place asked for', () => {
    for (const raw of ['/', '/?x=1', '/sign-in', '/sign-in/', '/sign-in?next=%2Fjobs', '/sign-in#top']) {
      expect(safeReturnAddress(raw), raw).toBeNull()
    }
    expect(safeReturnAddress('/sign-in-help')).toBe('/sign-in-help')
  })

  it('keeps an encoded slash as part of a path, not as a second slash', () => {
    expect(safeReturnAddress('/%2F/evil.example')).toBe('/%2F/evil.example')
  })
})

describe('returnAddressOf', () => {
  it('joins a location into one address', () => {
    expect(returnAddressOf({ pathname: '/lien-desk', search: '?tab=affidavits', hash: '' })).toBe(LIEN_DESK)
    expect(returnAddressOf({ pathname: '/jobs', search: `?tab=stages&lienwindow=${JOB}&lientab=affidavit` })).toBe(LIEN_WINDOW)
    expect(returnAddressOf({ pathname: '/help/bill-a-customer-and-get-paid', search: null, hash: '#send-it' })).toBe(
      '/help/bill-a-customer-and-get-paid#send-it',
    )
    expect(returnAddressOf({ pathname: '/' })).toBeNull()
  })
})

describe('gateMemory', () => {
  it('keeps the address of a visitor who arrived signed out', () => {
    expect(gateMemory({ pathname: '/lien-desk', search: '?tab=affidavits' }, false)).toEqual({ act: 'keep', address: LIEN_DESK })
  })

  it('forgets an older address when a signed-out visitor asks for the root', () => {
    expect(gateMemory({ pathname: '/', search: '' }, false)).toEqual({ act: 'forget' })
  })

  it('leaves the stored address alone when the person was signed in on this visit', () => {
    expect(gateMemory({ pathname: '/jobs', search: '?tab=stages' }, true)).toEqual({ act: 'leave' })
    expect(gateMemory({ pathname: '/' }, true)).toEqual({ act: 'leave' })
  })
})

describe('the emailed link', () => {
  it('lands where it always has when no address is waiting', () => {
    expect(magicLinkLandingPath(null)).toBe(MAGIC_LINK_DEFAULT_LANDING)
    expect(magicLinkLandingPath(undefined)).toBe('/dashboard')
    expect(magicLinkLandingPath('https://evil.example')).toBe('/dashboard')
    expect(magicLinkLandingPath('/')).toBe('/dashboard')
  })

  it('carries a waiting address to the sign-in page and back out whole', () => {
    for (const address of [LIEN_WINDOW, LIEN_DESK, '/help/file-a-lien-and-never-miss-its-deadlines#the-month-rule', '/jobs?q=a%26b&tab=stages']) {
      const landing = magicLinkLandingPath(address)
      expect(landing.startsWith('/sign-in?next=')).toBe(true)
      // One query key, nothing spilled: the address's own `&` and `#` ride inside the value.
      const url = new URL(landing, 'https://clicktooling.com')
      expect([...url.searchParams.keys()]).toEqual(['next'])
      expect(url.hash).toBe('')
      expect(returnAddressFromSignInSearch(url.search)).toBe(address)
    }
  })

  it('gives the password sign-in the same carrying address to reload onto, and none when nothing waits', () => {
    expect(signInHrefCarrying(LIEN_WINDOW)).toBe(magicLinkLandingPath(LIEN_WINDOW))
    expect(returnAddressFromSignInSearch(new URL(signInHrefCarrying(LIEN_WINDOW)!, 'https://clicktooling.com').search)).toBe(LIEN_WINDOW)
    expect(signInHrefCarrying(null)).toBeNull()
    expect(signInHrefCarrying('/')).toBeNull()
    expect(signInHrefCarrying('//evil.example')).toBeNull()
  })

  it('holds a link someone else wrote to the same rule', () => {
    expect(returnAddressFromSignInSearch('?next=https%3A%2F%2Fevil.example')).toBeNull()
    expect(returnAddressFromSignInSearch('?next=%2F%2Fevil.example')).toBeNull()
    expect(returnAddressFromSignInSearch('?next=%2F%5Cevil.example')).toBeNull()
    expect(returnAddressFromSignInSearch('?other=1')).toBeNull()
    expect(returnAddressFromSignInSearch('')).toBeNull()
    expect(returnAddressFromSignInSearch(null)).toBeNull()
  })
})

describe('waitingReturnAddress / signedInDestination', () => {
  it("takes the link's address first, then the stored one", () => {
    expect(waitingReturnAddress({ search: '?next=%2Flien-desk%3Ftab%3Daffidavits', stored: '/task' })).toBe(LIEN_DESK)
    expect(waitingReturnAddress({ search: '', stored: '/task' })).toBe('/task')
    expect(waitingReturnAddress({ search: '?next=https%3A%2F%2Fevil.example', stored: '/task' })).toBe('/task')
    expect(waitingReturnAddress({})).toBeNull()
  })

  it("falls back to the role's landing for anything that is not a path on this site", () => {
    expect(signedInDestination({ stored: LIEN_WINDOW, landing: '/dashboard' })).toBe(LIEN_WINDOW)
    expect(signedInDestination({ stored: '//evil.example', landing: '/dashboard' })).toBe('/dashboard')
    expect(signedInDestination({ search: '?next=https%3A%2F%2Fevil.example', stored: 'https://evil.example', landing: '/bridge' })).toBe('/bridge')
    expect(signedInDestination({ landing: '/bridge' })).toBe('/bridge')
  })
})

const NOW = Date.UTC(2026, 10, 13, 18, 0, 0)

describe('storage', () => {
  it('keeps, reads and forgets under the one key, with the time beside it', () => {
    const store = fakeStore()
    applyGateMemory(store, { act: 'keep', address: LIEN_DESK }, NOW)
    expect(store.data[POST_LOGIN_REDIRECT_KEY]).toBe(LIEN_DESK)
    expect(store.data[POST_LOGIN_REDIRECT_AT_KEY]).toBe(String(NOW))
    expect(readStoredReturnAddress(store, NOW)).toBe(LIEN_DESK)
    // A read does not spend it: a render that reads twice sees the same address both times.
    expect(readStoredReturnAddress(store, NOW)).toBe(LIEN_DESK)
    forgetStoredReturnAddress(store)
    expect(readStoredReturnAddress(store, NOW)).toBeNull()
    expect(store.data).toEqual({})
  })

  it('forget clears an older address and leave touches nothing', () => {
    const store = fakeStore({ [POST_LOGIN_REDIRECT_KEY]: '/task', [POST_LOGIN_REDIRECT_AT_KEY]: String(NOW) })
    applyGateMemory(store, { act: 'leave' }, NOW)
    expect(store.data[POST_LOGIN_REDIRECT_KEY]).toBe('/task')
    applyGateMemory(store, { act: 'forget' }, NOW)
    expect(store.data).toEqual({})
  })

  it('is quiet when there is no storage or storage refuses', () => {
    expect(readStoredReturnAddress(null)).toBeNull()
    expect(() => applyGateMemory(null, { act: 'keep', address: '/jobs' })).not.toThrow()
    expect(() => keepReturnAddress(null, '/jobs')).not.toThrow()
    expect(() => forgetStoredReturnAddress(null)).not.toThrow()
    expect(readStoredReturnAddress(refusingStore)).toBeNull()
    expect(() => applyGateMemory(refusingStore, { act: 'keep', address: '/jobs' })).not.toThrow()
    expect(() => keepReturnAddress(refusingStore, '/jobs')).not.toThrow()
    expect(() => applyGateMemory(refusingStore, { act: 'forget' })).not.toThrow()
  })
})

describe('a stored address is good for an hour', () => {
  it('reads until the hour is up, then reads as nothing', () => {
    const store = fakeStore()
    keepReturnAddress(store, LIEN_WINDOW, NOW)
    expect(readStoredReturnAddress(store, NOW + RETURN_ADDRESS_KEEP_MS)).toBe(LIEN_WINDOW)
    expect(readStoredReturnAddress(store, NOW + RETURN_ADDRESS_KEEP_MS + 1)).toBeNull()
    expect(RETURN_ADDRESS_KEEP_MS).toBe(60 * 60 * 1000)
  })

  it('a newer ask takes the place of an older one, with its own time', () => {
    const store = fakeStore()
    keepReturnAddress(store, LIEN_WINDOW, NOW - 2 * RETURN_ADDRESS_KEEP_MS)
    expect(readStoredReturnAddress(store, NOW)).toBeNull()
    keepReturnAddress(store, '/b/4f2a9c18', NOW)
    expect(readStoredReturnAddress(store, NOW)).toBe('/b/4f2a9c18')
  })

  it('an address stored with no time, by a build from before the time was kept, still reads', () => {
    const store = fakeStore({ [POST_LOGIN_REDIRECT_KEY]: '/task' })
    expect(readStoredReturnAddress(store, NOW)).toBe('/task')
    expect(returnAddressIsFresh(null, NOW)).toBe(true)
    expect(returnAddressIsFresh('', NOW)).toBe(true)
  })

  it('a time that is not a time, or one ahead of the clock, reads as past', () => {
    expect(returnAddressIsFresh('soon', NOW)).toBe(false)
    expect(returnAddressIsFresh(String(NOW + 60_000), NOW)).toBe(false)
    expect(returnAddressIsFresh(String(NOW), NOW)).toBe(true)
  })

  it('never keeps an address that fails the rule, and forgets what was there', () => {
    const store = fakeStore()
    keepReturnAddress(store, '/task', NOW)
    keepReturnAddress(store, '//evil.example/jobs', NOW)
    expect(store.data).toEqual({})
  })
})

/**
 * Every code the app prints or shows whose address needs a sign-in, and the two links that do (punch list #314, the
 * owner's ask of 2026-11-13). Each one must come out of the sign-in whole, by every way in. The codes that open a
 * public page (a bill's pay code, a portal, a First look, a receipt, a review room) never meet the sign-in.
 */
const SIGN_IN_DOORS: ReadonlyArray<{ door: string; address: string; kept: 'gate' | 'own page' }> = [
  { door: "a lien cover sheet's Scan to record", address: lienWindowHref(JOB, 'affidavit'), kept: 'gate' },
  { door: "a lien batch sheet's Scan to record", address: lienDeskHref({ kind: 'affidavit' }), kept: 'gate' },
  { door: "a lien notice sheet's Scan to record", address: lienWindowHref(JOB, 'notice'), kept: 'gate' },
  { door: "a lien sheet's Scan for the full guide, after its share page", address: helpGuideAppPath('file-a-lien-and-never-miss-its-deadlines'), kept: 'gate' },
  { door: "Today's mail's guide code, after its share page", address: helpGuideAppPath('send-lien-notices-from-the-lien-desk'), kept: 'gate' },
  { door: "a machine's label", address: '/m/A1B2C3D4', kept: 'gate' },
  { door: "a box label or a sticker, from its public page's Sign in press", address: boxPagePath('7D759246'), kept: 'own page' },
  { door: 'a kept file link', address: '/files/messages/att-1', kept: 'own page' },
  { door: 'the Add Task icon', address: '/task', kept: 'own page' },
]

describe('every door that needs a sign-in comes out of it whole', () => {
  for (const { door, address, kept } of SIGN_IN_DOORS) {
    it(door, () => {
      // The address is one the rule keeps as written.
      expect(safeReturnAddress(address)).toBe(address)
      const store = fakeStore()
      if (kept === 'gate') {
        // The gate, for a visitor who arrived signed out: a dead session on a phone reads the same way.
        const url = new URL(address, 'https://clicktooling.com')
        applyGateMemory(store, gateMemory({ pathname: url.pathname, search: url.search, hash: url.hash }, false), NOW)
      } else {
        keepReturnAddress(store, address, NOW)
      }
      const stored = readStoredReturnAddress(store, NOW)
      expect(stored).toBe(address)
      // The password form: the page reloads onto the sign-in page carrying the address, and leaves for it.
      const back = signInHrefCarrying(waitingReturnAddress({ search: '', stored }))
      expect(back).not.toBeNull()
      expect(signedInDestination({ search: new URL(back!, 'https://clicktooling.com').search, stored: null, landing: '/dashboard' })).toBe(address)
      // The emailed link, opened in a browser that holds nothing.
      const landing = new URL(magicLinkLandingPath(stored), 'https://clicktooling.com')
      expect(landing.pathname).toBe('/sign-in')
      expect(signedInDestination({ search: landing.search, stored: null, landing: '/dashboard' })).toBe(address)
      // The emailed link, opened in another tab of the same browser.
      expect(signedInDestination({ search: landing.search, stored, landing: '/dashboard' })).toBe(address)
    })
  }
})
