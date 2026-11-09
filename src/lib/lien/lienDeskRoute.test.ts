import { describe, expect, it } from 'vitest'
import { LIEN_DESK_PATH, lienDeskFromSearch, lienDeskHref, lienDeskKindFromWord, lienDeskRedirect } from './lienDeskRoute'

describe('lienDeskRoute (punch list #182, the Lien desk)', () => {
  it('the bare address is Do now; a view, a notice and a pile each write their own word', () => {
    expect(LIEN_DESK_PATH).toBe('/lien-desk')
    expect(lienDeskHref()).toBe('/lien-desk')
    expect(lienDeskHref({ kind: 'calendar' })).toBe('/lien-desk?tab=deadlines')
    expect(lienDeskHref({ kind: 'notice' })).toBe('/lien-desk?tab=notices')
    expect(lienDeskHref({ kind: 'affidavit' })).toBe('/lien-desk?tab=affidavits')
    expect(lienDeskHref({ kind: 'retainage' })).toBe('/lien-desk?tab=retainage')
    expect(lienDeskHref({ kind: 'timeline' })).toBe('/lien-desk?tab=timeline')
    expect(lienDeskHref({ kind: 'notice', job: 'job/1', pile: 'sent' })).toBe('/lien-desk?tab=notices&job=job%2F1&pile=sent')
    expect(lienDeskHref({ records: { jobId: 'j7' } })).toBe('/lien-desk?records=j7')
    expect(lienDeskHref({ records: { jobId: null } })).toBe('/lien-desk?records=1')
  })

  it('the default view is never written', () => {
    expect(lienDeskHref({ kind: 'next' })).toBe('/lien-desk')
    expect(lienDeskHref({ kind: null, job: null, pile: null })).toBe('/lien-desk')
  })

  it('reads the address back; a job or a pile with no tab lands on Notices; an unknown word is no tab', () => {
    expect(lienDeskFromSearch(new URLSearchParams(''))).toEqual({ kind: null, job: null, pile: null, records: null })
    expect(lienDeskFromSearch(new URLSearchParams('tab=deadlines'))).toEqual({ kind: 'calendar', job: null, pile: null, records: null })
    expect(lienDeskFromSearch(new URLSearchParams('tab=notices&job=j1&pile=missed'))).toEqual({ kind: 'notice', job: 'j1', pile: 'missed', records: null })
    expect(lienDeskFromSearch(new URLSearchParams('job=j1'))).toEqual({ kind: 'notice', job: 'j1', pile: null, records: null })
    expect(lienDeskFromSearch(new URLSearchParams('pile=ready'))).toEqual({ kind: 'notice', job: null, pile: 'ready', records: null })
    expect(lienDeskFromSearch(new URLSearchParams('tab=nonsense&pile=nonsense'))).toEqual({ kind: null, job: null, pile: null, records: null })
    expect(lienDeskFromSearch(new URLSearchParams('records=j7'))).toEqual({ kind: null, job: null, pile: null, records: { jobId: 'j7' } })
    expect(lienDeskFromSearch(new URLSearchParams('records=1')).records).toEqual({ jobId: null })
    expect(lienDeskKindFromWord('timeline')).toBe('timeline')
    expect(lienDeskKindFromWord('now')).toBe('next')
    expect(lienDeskKindFromWord(null)).toBeNull()
  })

  it('every link in the wild lands on the page: ?liendesk=1 with &kind=, &liendeskJob=, &liendeskPile=, and ?ownerrecords=', () => {
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendesk=1'))).toBe('/lien-desk')
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendesk=true'))).toBe('/lien-desk')
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendesk=1&kind=notice'))).toBe('/lien-desk?tab=notices')
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendesk=1&kind=affidavit'))).toBe('/lien-desk?tab=affidavits')
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendesk=1&kind=retainage'))).toBe('/lien-desk?tab=retainage')
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendesk=1&kind=timeline'))).toBe('/lien-desk?tab=timeline')
    // A job or a pile with no kind lands on Notices, as the Pipeline's door did.
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendesk=1&liendeskJob=j273'))).toBe('/lien-desk?tab=notices&job=j273')
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendesk=1&liendeskPile=missed'))).toBe('/lien-desk?tab=notices&pile=missed')
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendesk=1&liendeskJob=j273&kind=notice&liendeskPile=sent'))).toBe('/lien-desk?tab=notices&job=j273&pile=sent')
    // An unknown kind or pile is dropped.
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendesk=1&kind=whatever'))).toBe('/lien-desk')
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendesk=1&liendeskPile=nonsense'))).toBe('/lien-desk')
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&ownerrecords=j9'))).toBe('/lien-desk?records=j9')
  })

  it('leaves a Jobs address with neither door alone', () => {
    expect(lienDeskRedirect(new URLSearchParams('tab=stages'))).toBeNull()
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendesk='))).toBeNull()
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendesk=0'))).toBeNull()
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&liendeskJob=j273&kind=affidavit'))).toBeNull()
    expect(lienDeskRedirect(new URLSearchParams('tab=stages&lienwindow=j273'))).toBeNull()
  })
})
