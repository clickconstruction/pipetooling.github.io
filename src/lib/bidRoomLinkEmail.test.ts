import { describe, expect, it } from 'vitest'
import {
  buildBidRoomLinkEmail,
  companyNameForBrand,
  validityDaysFromTerms,
  type BidRoomLinkEmailInput,
} from '../../supabase/functions/_shared/bidRoomLinkEmail'

const payload: BidRoomLinkEmailInput['payload'] = {
  v: 1,
  project_name: 'ZZ Test <Studio>',
  project_address: '2530 Hunter Rd, San Marcos, TX 78666',
  gc_name: 'Knight Contracting',
  service_type_name: 'Plumbing',
  options: [
    { key: 'a', name: 'To Plans', is_base: true, total_cents: 5_634_300, fixture_rows: [] },
    { key: 'b', name: 'PEX in lieu of copper', is_base: false, total_cents: 5_634_300, fixture_rows: [] },
    { key: 'c', name: 'PEX · Standard-grade fixtures', is_base: false, total_cents: 4_170_000, fixture_rows: [] },
  ],
  inclusions: '',
  exclusions: '',
  terms: 'This estimate is subject to acceptance within thirty (30) days and is void thereafter.',
  header_brand: 'plum',
}

const base: BidRoomLinkEmailInput = {
  payload,
  link: 'https://clicktooling.com/bid-room?t=abc123',
  brandImageUrl: 'https://clicktooling.com/brand/click-plum.png',
  revNumber: 1,
  revNote: null,
  sender: { name: 'Wendi Douglas', email: 'wendi@clickplumbing.com', phone: '(512) 555-0142' },
  dateLabel: 'Sept 3, 2026',
}

describe('buildBidRoomLinkEmail (v2.2729 letterhead)', () => {
  it('subject carries trade, project, proposed amount and company', () => {
    expect(buildBidRoomLinkEmail(base).subject).toBe('Plumbing proposal — ZZ Test <Studio> — $56,343 · Click Plumbing')
  })
  it('revised sends say so, name the revision, and show the note', () => {
    const m = buildBidRoomLinkEmail({ ...base, revNumber: 2, revNote: 'per addendum 2' })
    expect(m.subject).toBe('Revised plumbing proposal — ZZ Test <Studio> — $56,343 · Click Plumbing (rev 2)')
    expect(m.html).toContain('What changed in revision 2:</strong> per addendum 2')
    expect(m.html).toContain('Review the revised proposal')
    expect(m.text).toContain('What changed in revision 2: per addendum 2')
  })
  it('options are a table with the recommendation first-class, never flex', () => {
    const { html } = buildBidRoomLinkEmail(base)
    expect(html).not.toContain('display:flex')
    expect((html.match(/<tr>/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(html).toContain('<strong>To Plans</strong>')
    expect(html).toContain('Our recommendation')
    expect((html.match(/>Alternate</g) ?? []).length).toBe(2)
    expect(html).toContain('$41,700.00')
  })
  it('the button is a table cell with bgcolor (survives dark-mode clients)', () => {
    const { html } = buildBidRoomLinkEmail(base)
    expect(html).toContain('<td bgcolor="#ea580c"')
    expect(html).toContain('color-scheme" content="light only"')
  })
  it('escapes user text in HTML but not in the plain-text version', () => {
    const m = buildBidRoomLinkEmail(base)
    expect(m.html).toContain('ZZ Test &lt;Studio&gt;')
    expect(m.text).toContain('ZZ Test <Studio>')
  })
  it('signature + reply-to come from the sender; none without one', () => {
    const m = buildBidRoomLinkEmail(base)
    expect(m.replyTo).toBe('wendi@clickplumbing.com')
    expect(m.html).toContain('Wendi Douglas')
    expect(m.html).toContain('(512) 555-0142')
    const anon = buildBidRoomLinkEmail({ ...base, sender: null })
    expect(anon.replyTo).toBeNull()
    expect(anon.html).not.toContain('Estimator,')
  })
  it('validity, address, GC and date land in the meta line and fine print', () => {
    const m = buildBidRoomLinkEmail(base)
    expect(m.html).toContain('Pricing is good for 30 days.')
    expect(m.html).toContain('2530 Hunter Rd, San Marcos, TX 78666 &middot; prepared for Knight Contracting &middot; Sept 3, 2026')
    expect(m.text).toContain('https://clicktooling.com/bid-room?t=abc123')
  })
  it('no banner and no validity when the payload has neither', () => {
    const m = buildBidRoomLinkEmail({ ...base, brandImageUrl: '', payload: { ...payload, terms: 'Net 30 on invoices.' } })
    expect(m.html).not.toContain('<img')
    expect(m.html).not.toContain('Pricing is good for')
  })
})

describe('helpers', () => {
  it('validityDaysFromTerms', () => {
    expect(validityDaysFromTerms('acceptance within thirty (30) days')).toBe(30)
    expect(validityDaysFromTerms('valid for 45 days from the date above')).toBe(45)
    expect(validityDaysFromTerms('')).toBeNull()
    expect(validityDaysFromTerms('Net 30 on invoices.')).toBeNull()
  })
  it('companyNameForBrand', () => {
    expect(companyNameForBrand('elec')).toBe('Click Electrical')
    expect(companyNameForBrand('plum')).toBe('Click Plumbing')
    expect(companyNameForBrand(null)).toBe('Click Plumbing')
  })
})
