import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — tested here.
import { WAIVER_EMAIL_CARD_BLURB, waiverEmailFromName, waiverEmailRecipientCustomerId, withWaiverAccountCard } from '../../../supabase/functions/_shared/lienWaiverEmailCard'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { GC_COMPANY } from '../gc/company'

describe('who the waiver email is from', () => {
  it('GC mode\'s billing job sends as our GC entity; every other job, a sub job that bills a GC included, as the company', () => {
    expect(waiverEmailFromName(true)).toBe(GC_COMPANY.name)
    expect(waiverEmailFromName(false)).toBe(PORTAL_COMPANY.name)
  })
})

describe('the waiver email’s account card (v2.4304)', () => {
  const base = { jobCustomerId: 'owner-1', jobCustomerEmail: 'owner@home.test', gcCustomerId: 'gc-1', gcBillingEmail: 'AP@Loberg.test' }

  it('the card points at the portal of whoever the email goes to', () => {
    expect(waiverEmailRecipientCustomerId({ ...base, recipientEmail: 'ap@loberg.test' })).toBe('gc-1')
    expect(waiverEmailRecipientCustomerId({ ...base, recipientEmail: 'owner@home.test' })).toBe('owner-1')
    expect(waiverEmailRecipientCustomerId({ ...base, recipientEmail: 'someone@else.test' })).toBeNull()
    expect(waiverEmailRecipientCustomerId({ ...base, gcCustomerId: null, recipientEmail: 'ap@loberg.test' })).toBeNull()
  })

  it('with a portal the email ends with the bill emails’ card and the address in the text; without one it is unchanged', () => {
    const bodies = { html: '<p>Attached is the signed lien waiver.</p>', text: 'Attached is the signed lien waiver.' }
    const out = withWaiverAccountCard(bodies, 'https://my.clickplumbing.com/loberg', 'cid:portal-qr')
    expect(out.html.startsWith(bodies.html)).toBe(true)
    expect(out.html).toContain('Your account, any time')
    expect(out.html).toContain('my.clickplumbing.com/loberg')
    expect(out.html).toContain('cid:portal-qr')
    expect(out.html).toContain(WAIVER_EMAIL_CARD_BLURB)
    expect(out.text).toBe(`${bodies.text}\n\nYour account, any time: https://my.clickplumbing.com/loberg\n${WAIVER_EMAIL_CARD_BLURB}`)
    expect(withWaiverAccountCard(bodies, null, null)).toBe(bodies)
    expect(withWaiverAccountCard(bodies, '  ', null)).toBe(bodies)
  })
})
