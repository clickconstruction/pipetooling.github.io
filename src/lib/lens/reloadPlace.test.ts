import { describe, expect, it } from 'vitest'
import { RELOAD_MARK, placeWithoutReloadMark, sealedReloadTarget } from './reloadPlace'

const ORIGIN = 'https://app.example.com'

describe('a sealed frame’s hard reload keeps its page (punch list #426)', () => {
  it('asks for its own page, marked, where the app asks for the root', () => {
    expect(sealedReloadTarget({ origin: ORIGIN, pathname: '/dashboard', search: '', hash: '' }, 1700)).toBe(`${ORIGIN}/dashboard?${RELOAD_MARK}=1700`)
  })

  it('keeps the page’s own query and its hash', () => {
    expect(sealedReloadTarget({ origin: ORIGIN, pathname: '/bids', search: '?tab=bid-board&bidId=b1', hash: '#notes' }, 5)).toBe(`${ORIGIN}/bids?tab=bid-board&bidId=b1&${RELOAD_MARK}=5#notes`)
  })

  it('a second reload replaces the mark and never stacks two', () => {
    const once = new URL(sealedReloadTarget({ origin: ORIGIN, pathname: '/jobs', search: '?tab=stages', hash: '' }, 1))
    const twice = sealedReloadTarget({ origin: ORIGIN, pathname: once.pathname, search: once.search, hash: once.hash }, 2)
    expect(twice).toBe(`${ORIGIN}/jobs?tab=stages&${RELOAD_MARK}=2`)
  })

  it('the seal reads the page back without the mark', () => {
    expect(placeWithoutReloadMark({ pathname: '/dashboard', search: `?${RELOAD_MARK}=1700`, hash: '' })).toBe('/dashboard')
    expect(placeWithoutReloadMark({ pathname: '/bids', search: `?tab=bid-board&${RELOAD_MARK}=5`, hash: '#notes' })).toBe('/bids?tab=bid-board#notes')
  })

  it('an address with no mark is left alone', () => {
    expect(placeWithoutReloadMark({ pathname: '/dashboard', search: '', hash: '' })).toBeNull()
    expect(placeWithoutReloadMark({ pathname: '/bids', search: '?tab=bid-board', hash: '' })).toBeNull()
  })

  it('there and back gives the page the frame was on', () => {
    const from = { pathname: '/help', search: '?g=keep-up-with-your-bids-on-the-dashboard', hash: '' }
    const to = new URL(sealedReloadTarget({ origin: ORIGIN, ...from }, 9))
    expect(placeWithoutReloadMark({ pathname: to.pathname, search: to.search, hash: to.hash })).toBe('/help?g=keep-up-with-your-bids-on-the-dashboard')
  })
})
