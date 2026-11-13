import { describe, expect, it } from 'vitest'

import { POST_LOGIN_REDIRECT_KEY } from './iosPwa'
import { lienDeskHref } from './lien/lienDeskRoute'
import { lienWindowHref } from './jobs/stagesDeepLinks'
import {
  MAGIC_LINK_DEFAULT_LANDING,
  RETURN_ADDRESS_MAX,
  applyGateMemory,
  forgetStoredReturnAddress,
  gateMemory,
  magicLinkLandingPath,
  readStoredReturnAddress,
  returnAddressFromSignInSearch,
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

describe('storage', () => {
  it('keeps, reads and forgets under the one key the other doors already write', () => {
    const store = fakeStore()
    applyGateMemory(store, { act: 'keep', address: LIEN_DESK })
    expect(store.data[POST_LOGIN_REDIRECT_KEY]).toBe(LIEN_DESK)
    expect(readStoredReturnAddress(store)).toBe(LIEN_DESK)
    // A read does not spend it: a render that reads twice sees the same address both times.
    expect(readStoredReturnAddress(store)).toBe(LIEN_DESK)
    forgetStoredReturnAddress(store)
    expect(readStoredReturnAddress(store)).toBeNull()
  })

  it('forget clears an older address and leave touches nothing', () => {
    const store = fakeStore({ [POST_LOGIN_REDIRECT_KEY]: '/task' })
    applyGateMemory(store, { act: 'leave' })
    expect(store.data[POST_LOGIN_REDIRECT_KEY]).toBe('/task')
    applyGateMemory(store, { act: 'forget' })
    expect(POST_LOGIN_REDIRECT_KEY in store.data).toBe(false)
  })

  it('is quiet when there is no storage or storage refuses', () => {
    expect(readStoredReturnAddress(null)).toBeNull()
    expect(() => applyGateMemory(null, { act: 'keep', address: '/jobs' })).not.toThrow()
    expect(() => forgetStoredReturnAddress(null)).not.toThrow()
    expect(readStoredReturnAddress(refusingStore)).toBeNull()
    expect(() => applyGateMemory(refusingStore, { act: 'keep', address: '/jobs' })).not.toThrow()
    expect(() => applyGateMemory(refusingStore, { act: 'forget' })).not.toThrow()
  })
})
