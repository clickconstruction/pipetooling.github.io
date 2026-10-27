import { describe, expect, it } from 'vitest'
import { LEGAL_DESK_PATH, legalDeskFromSearch, legalDeskHref, legalDeskRedirect, legalDeskTabFromWord } from './legalDeskRoute'

describe('legalDeskRoute (punch list #182)', () => {
  it('the bare address is the rail; an account, a tab and the map each write their own word', () => {
    expect(LEGAL_DESK_PATH).toBe('/legal-desk')
    expect(legalDeskHref()).toBe('/legal-desk')
    expect(legalDeskHref({ account: 'cust:abc' })).toBe('/legal-desk?account=cust%3Aabc')
    expect(legalDeskHref({ account: 'cust:abc', tab: 'timeline' })).toBe('/legal-desk?account=cust%3Aabc&tab=timeline')
    expect(legalDeskHref({ account: 'cust:abc', tab: 'fees_steps' })).toBe('/legal-desk?account=cust%3Aabc&tab=firm')
    expect(legalDeskHref({ view: 'map' })).toBe('/legal-desk?view=map')
  })

  it('the default tab and the default view are never written', () => {
    expect(legalDeskHref({ account: 'gc:1', tab: 'account' })).toBe('/legal-desk?account=gc%3A1')
    expect(legalDeskHref({ account: 'gc:1', view: 'accounts' })).toBe('/legal-desk?account=gc%3A1')
    // The map keeps the account and the tab, so Accounts brings them back as they were.
    expect(legalDeskHref({ account: 'gc:1', tab: 'paper', view: 'map' })).toBe('/legal-desk?account=gc%3A1&tab=paper&view=map')
  })

  it('reads the address back, with fees as the old name of firm and an unknown word as no tab', () => {
    expect(legalDeskFromSearch(new URLSearchParams('account=cust%3Aabc&tab=firm'))).toEqual({ account: 'cust:abc', tab: 'fees_steps', view: 'accounts' })
    expect(legalDeskFromSearch(new URLSearchParams('account=cust%3Aabc&tab=fees'))).toEqual({ account: 'cust:abc', tab: 'fees_steps', view: 'accounts' })
    expect(legalDeskFromSearch(new URLSearchParams('tab=nonsense'))).toEqual({ account: null, tab: null, view: 'accounts' })
    expect(legalDeskFromSearch(new URLSearchParams('account=gc%3A1&tab=paper&view=map'))).toEqual({ account: 'gc:1', tab: 'paper', view: 'map' })
    expect(legalDeskFromSearch(new URLSearchParams(''))).toEqual({ account: null, tab: null, view: 'accounts' })
    expect(legalDeskTabFromWord('timeline')).toBe('timeline')
    expect(legalDeskTabFromWord(null)).toBeNull()
  })

  it('every link in the wild lands on the page: ?legal=1, ?legal=<key>, &legalTab=fees|timeline', () => {
    expect(legalDeskRedirect(new URLSearchParams('tab=stages&legal=1'))).toBe('/legal-desk')
    expect(legalDeskRedirect(new URLSearchParams('tab=stages&legal=true'))).toBe('/legal-desk')
    expect(legalDeskRedirect(new URLSearchParams('tab=stages&legal=cust%3Aabc'))).toBe('/legal-desk?account=cust%3Aabc')
    expect(legalDeskRedirect(new URLSearchParams('tab=stages&legal=cust%3Aabc&legalTab=fees'))).toBe('/legal-desk?account=cust%3Aabc&tab=firm')
    expect(legalDeskRedirect(new URLSearchParams('tab=stages&legal=1&legalTab=timeline'))).toBe('/legal-desk?tab=timeline')
  })

  it('leaves a Jobs address with no legal param alone', () => {
    expect(legalDeskRedirect(new URLSearchParams('tab=stages'))).toBeNull()
    expect(legalDeskRedirect(new URLSearchParams('tab=stages&legal='))).toBeNull()
    expect(legalDeskRedirect(new URLSearchParams('tab=stages&legalTab=timeline'))).toBeNull()
  })
})

describe('the Pipeline, from the desk', () => {
  it('a job opens the board at its row through the one-shot door the board already answers', async () => {
    const { PIPELINE_HREF, pipelineJobHref } = await import('./legalDeskRoute')
    expect(PIPELINE_HREF).toBe('/jobs?tab=stages')
    expect(pipelineJobHref('job/1')).toBe('/jobs?tab=stages&stagesJob=job%2F1')
  })
})
