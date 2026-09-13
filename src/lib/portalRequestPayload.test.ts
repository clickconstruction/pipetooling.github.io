import { describe, expect, it } from 'vitest'
import { parsePortalRequestPayload } from './portalRequestPayload'

describe('parsePortalRequestPayload', () => {
  it('reads a visit request the intake wrote', () => {
    expect(
      parsePortalRequestPayload({
        source: 'portal',
        kind: 'visit',
        portalLinkId: 'l1',
        audience: 'customer',
        customerId: 'c1',
        customerName: 'Jane Doe',
        description: 'Water heater leaking',
        availability: 'Today after 3',
        phone: '5125550142',
        phoneSource: 'typed',
        plansLink: null,
      }),
    ).toEqual({
      kind: 'visit',
      customerId: 'c1',
      customerName: 'Jane Doe',
      description: 'Water heater leaking',
      availability: 'Today after 3',
      phone: '5125550142',
      phoneSource: 'typed',
      plansLink: null,
    })
  })

  it('reads a GC stage ask (customer_portal source) with the window as availability', () => {
    const p = parsePortalRequestPayload({
      source: 'customer_portal',
      kind: 'gc_stage_ask',
      gcName: 'Knight Contracting',
      start: '2026-09-15',
      end: '2026-09-17',
      note: 'framing slipped a week',
      phone: null,
      phoneSource: 'on_file',
    })
    expect(p?.kind).toBe('gc_stage_ask')
    expect(p?.customerName).toBe('Knight Contracting')
    expect(p?.availability).toBe('2026-09-15 → 2026-09-17')
    expect(p?.description).toBe('framing slipped a week')
    expect(p?.phone).toBeNull()
  })

  it('reads a share-bill ask (v2.3378): the kind, the built sentence, the phone on file', () => {
    const p = parsePortalRequestPayload({
      source: 'portal',
      kind: 'share_bill_ask',
      customerId: 'gc-1',
      customerName: 'Done Right Foundation',
      description: 'Done Right Foundation asks to be billed for J1017 · 4410 Cedar Hollow ($4,420.00) instead of Maria Delgado.',
      ask: 'bill_me',
      jobNumber: '1017',
      amount: 4420,
      ownerName: 'Maria Delgado',
      phone: '(210) 555-1111',
      phoneSource: 'on_file',
    })!
    expect(p.kind).toBe('share_bill_ask')
    expect(p.customerName).toBe('Done Right Foundation')
    expect(p.description).toMatch(/asks to be billed for J1017/)
    expect(p.phoneSource).toBe('on_file')
    expect(p.availability).toBeNull()
  })

  it('pre-v2.3246 rows (no customerId / phoneSource) still parse; blanks become null', () => {
    const p = parsePortalRequestPayload({ source: 'portal', kind: 'bid', customerName: 'Acme', description: 'Remodel', phone: '  ' })
    expect(p).toMatchObject({ kind: 'bid', customerId: null, customerName: 'Acme', phone: null, phoneSource: null })
  })

  it('null for non-portal payloads, junk, and missing values', () => {
    expect(parsePortalRequestPayload({ source: 'sub_portal', kind: 'availability' })).toBeNull()
    expect(parsePortalRequestPayload({ supply_houses: [] })).toBeNull()
    expect(parsePortalRequestPayload(null)).toBeNull()
    expect(parsePortalRequestPayload('portal')).toBeNull()
  })
})
