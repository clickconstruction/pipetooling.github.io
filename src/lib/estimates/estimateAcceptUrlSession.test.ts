import { afterEach, describe, expect, it } from 'vitest'
import {
  PREVIEW_EMAIL_ACCEPT_URL,
  isUsableCustomerAcceptUrl,
  normalizeCustomerAcceptUrlCandidate,
  readStoredEstimateAcceptUrl,
  storeEstimateAcceptUrl,
} from './estimateAcceptUrlSession'

const g = globalThis as unknown as { sessionStorage?: unknown }

function stubSession(store: Map<string, string>) {
  g.sessionStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v))
    },
  }
}

afterEach(() => {
  delete g.sessionStorage
})

describe('isUsableCustomerAcceptUrl', () => {
  it('accepts a real accept link with a token', () => {
    expect(isUsableCustomerAcceptUrl('https://pipetooling.com/estimate/accept?t=abc123')).toBe(true)
    expect(isUsableCustomerAcceptUrl('  https://pipetooling.com/estimate/accept?t=abc123  ')).toBe(true)
  })

  it('refuses the preview sentinel, blanks, and non-URLs', () => {
    expect(isUsableCustomerAcceptUrl(PREVIEW_EMAIL_ACCEPT_URL)).toBe(false)
    expect(isUsableCustomerAcceptUrl('')).toBe(false)
    expect(isUsableCustomerAcceptUrl('   ')).toBe(false)
    expect(isUsableCustomerAcceptUrl('not a url')).toBe(false)
  })

  it('refuses the wrong path and a missing or blank token', () => {
    expect(isUsableCustomerAcceptUrl('https://pipetooling.com/estimates?t=abc')).toBe(false)
    expect(isUsableCustomerAcceptUrl('https://pipetooling.com/estimate/accept')).toBe(false)
    expect(isUsableCustomerAcceptUrl('https://pipetooling.com/estimate/accept?t=')).toBe(false)
    expect(isUsableCustomerAcceptUrl('https://pipetooling.com/estimate/accept?t=%20')).toBe(false)
  })
})

describe('normalizeCustomerAcceptUrlCandidate', () => {
  it('returns the trimmed URL when usable, null otherwise', () => {
    expect(normalizeCustomerAcceptUrlCandidate(' https://x.com/estimate/accept?t=a ')).toBe(
      'https://x.com/estimate/accept?t=a',
    )
    expect(normalizeCustomerAcceptUrlCandidate(null)).toBeNull()
    expect(normalizeCustomerAcceptUrlCandidate(undefined)).toBeNull()
    expect(normalizeCustomerAcceptUrlCandidate('')).toBeNull()
    expect(normalizeCustomerAcceptUrlCandidate(PREVIEW_EMAIL_ACCEPT_URL)).toBeNull()
  })
})

describe('readStoredEstimateAcceptUrl / storeEstimateAcceptUrl', () => {
  it('round-trips per estimate id under the session prefix', () => {
    const store = new Map<string, string>()
    stubSession(store)
    storeEstimateAcceptUrl('est-1', 'https://x.com/estimate/accept?t=a')
    expect(store.has('estimate_accept_url:est-1')).toBe(true)
    expect(readStoredEstimateAcceptUrl('est-1')).toBe('https://x.com/estimate/accept?t=a')
    expect(readStoredEstimateAcceptUrl('est-2')).toBeNull()
  })

  it('read trims, and a blank stored value reads as null', () => {
    const store = new Map<string, string>()
    stubSession(store)
    store.set('estimate_accept_url:est-1', '  https://x.com/a  ')
    expect(readStoredEstimateAcceptUrl('est-1')).toBe('https://x.com/a')
    store.set('estimate_accept_url:est-1', '   ')
    expect(readStoredEstimateAcceptUrl('est-1')).toBeNull()
  })

  it('store without an estimate id writes nothing', () => {
    const store = new Map<string, string>()
    stubSession(store)
    storeEstimateAcceptUrl('', 'https://x.com/a')
    expect(store.size).toBe(0)
  })

  it('survives a missing or throwing sessionStorage', () => {
    delete g.sessionStorage
    expect(readStoredEstimateAcceptUrl('est-1')).toBeNull()
    expect(() => storeEstimateAcceptUrl('est-1', 'https://x.com/a')).not.toThrow()
    g.sessionStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readStoredEstimateAcceptUrl('est-1')).toBeNull()
    expect(() => storeEstimateAcceptUrl('est-1', 'https://x.com/a')).not.toThrow()
  })
})
