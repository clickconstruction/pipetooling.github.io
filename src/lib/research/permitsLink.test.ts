import { describe, expect, it } from 'vitest'
import { lookAlikesHref, permitsLinkCleared, permitsLinkForView, permitsLinkWithLooks, readPermitsLink } from './permitsLink'

const params = (search: string) => new URLSearchParams(search)

describe('lookAlikesHref', () => {
  it('opens Builders with the chip on, in the city named', () => {
    expect(lookAlikesHref('San Antonio')).toBe('/prospects?tab=permits&view=builders&looks=1&city=San+Antonio')
    expect(readPermitsLink(params(lookAlikesHref('San Antonio').split('?')[1] ?? ''))).toEqual({ builders: true, looks: true, city: 'San Antonio' })
  })

  it('names no city when none is given, or one the pull does not read', () => {
    expect(lookAlikesHref(null)).toBe('/prospects?tab=permits&view=builders&looks=1')
    expect(lookAlikesHref('Kyle')).toBe('/prospects?tab=permits&view=builders&looks=1')
  })
})

describe('readPermitsLink', () => {
  it('opens on Skim with no chip when the address asks for nothing', () => {
    expect(readPermitsLink(params('tab=permits'))).toEqual({ builders: false, looks: false, city: null })
  })

  it('reads Builders, the chip and the city', () => {
    expect(readPermitsLink(params('tab=permits&view=builders'))).toEqual({ builders: true, looks: false, city: null })
    expect(readPermitsLink(params('tab=permits&view=builders&looks=1&city=austin'))).toEqual({ builders: true, looks: true, city: 'Austin' })
  })

  it('reads no chip off Builders, and no city the pull does not read', () => {
    expect(readPermitsLink(params('tab=permits&looks=1')).looks).toBe(false)
    expect(readPermitsLink(params('tab=permits&view=ledger&looks=1'))).toEqual({ builders: false, looks: false, city: null })
    expect(readPermitsLink(params('tab=permits&view=builders&city=Kyle')).city).toBeNull()
  })
})

describe('permitsLinkForView', () => {
  it('keeps Builders and its chip on the address, and drops the city once the tab has taken it', () => {
    expect(permitsLinkForView(params('tab=permits&view=builders&looks=1&city=Austin'), true).toString()).toBe('tab=permits&view=builders&looks=1')
    expect(permitsLinkForView(params('tab=permits'), true).toString()).toBe('tab=permits&view=builders')
  })

  it('drops Builders and the chip on any other view, and leaves the rest of the address alone', () => {
    expect(permitsLinkForView(params('tab=permits&view=builders&looks=1&kind=sub'), false).toString()).toBe('tab=permits&kind=sub')
    expect(permitsLinkForView(params('tab=permits'), false).toString()).toBe('tab=permits')
  })
})

describe('permitsLinkWithLooks', () => {
  it('turns the chip on and off on the address', () => {
    expect(permitsLinkWithLooks(params('tab=permits&view=builders'), true).toString()).toBe('tab=permits&view=builders&looks=1')
    expect(permitsLinkWithLooks(params('tab=permits&view=builders&looks=1'), false).toString()).toBe('tab=permits&view=builders')
  })
})

describe('permitsLinkCleared', () => {
  it('leaves nothing of the Permits tab’s own on the address', () => {
    expect(permitsLinkCleared(params('tab=follow-up&view=builders&looks=1&city=Austin&kind=sub')).toString()).toBe('tab=follow-up&kind=sub')
  })
})
