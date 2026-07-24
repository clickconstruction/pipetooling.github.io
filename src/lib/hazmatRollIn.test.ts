import { describe, expect, it } from 'vitest'
import { eligibleHazmatRollIns, hazmatRollInTotalDollars, type HazmatRollInInvoice } from './hazmatRollIn'

const inv = (over: Partial<HazmatRollInInvoice> & { id: string }): HazmatRollInInvoice => ({
  amount: 500,
  status: 'draft',
  stripe_invoice_id: null,
  sent_to_customer_at: null,
  external_send_channel: null,
  ...over,
})

describe('eligibleHazmatRollIns', () => {
  const incident = { id: 'inc1', invoice_id: 'rider1', incident_at: '2026-07-20' }

  it('the reported TJ Brace case: unsent draft rider rolls into the primary bill', () => {
    const lines = eligibleHazmatRollIns({
      billingInvoiceId: 'primary1',
      incidents: [incident],
      invoices: [inv({ id: 'primary1', amount: 1380 }), inv({ id: 'rider1', amount: 500 })],
    })
    expect(lines).toEqual([
      {
        incidentId: 'inc1',
        invoiceId: 'rider1',
        amountDollars: 500,
        amountCents: 50000,
        description: 'Biohazard remediation fee — incident 07/20/2026',
      },
    ])
    expect(hazmatRollInTotalDollars(lines)).toBe(500)
  })

  it('never rolls in when billing the rider itself', () => {
    expect(
      eligibleHazmatRollIns({
        billingInvoiceId: 'rider1',
        incidents: [incident],
        invoices: [inv({ id: 'rider1' })],
      }),
    ).toEqual([])
  })

  it('never rolls in a rider the customer already saw', () => {
    for (const sent of [
      { stripe_invoice_id: 'in_123' },
      { sent_to_customer_at: '2026-07-21T00:00:00Z' },
      { external_send_channel: 'stripe' },
      { status: 'billed' },
      { status: 'paid' },
    ] as Partial<HazmatRollInInvoice>[]) {
      expect(
        eligibleHazmatRollIns({
          billingInvoiceId: 'primary1',
          incidents: [incident],
          invoices: [inv({ id: 'rider1', ...sent })],
        }),
      ).toEqual([])
    }
  })

  it('ready_to_bill riders qualify; zero/negative amounts and unlinked incidents do not', () => {
    const lines = eligibleHazmatRollIns({
      billingInvoiceId: 'primary1',
      incidents: [
        incident,
        { id: 'inc2', invoice_id: 'rider2', incident_at: null },
        { id: 'inc3', invoice_id: null, incident_at: '2026-07-01' },
        { id: 'inc4', invoice_id: 'riderGone', incident_at: '2026-07-01' },
      ],
      invoices: [
        inv({ id: 'rider1', status: 'ready_to_bill' }),
        inv({ id: 'rider2', amount: 0 }),
      ],
    })
    expect(lines.map((l) => l.invoiceId)).toEqual(['rider1'])
    expect(lines[0]!.description).toBe('Biohazard remediation fee — incident 07/20/2026')
  })

  it('multiple riders sum and dedupe by invoice id', () => {
    const lines = eligibleHazmatRollIns({
      billingInvoiceId: 'primary1',
      incidents: [
        incident,
        { id: 'inc2', invoice_id: 'rider2', incident_at: '2026-07-22' },
        { id: 'incDup', invoice_id: 'rider1', incident_at: '2026-07-23' },
      ],
      invoices: [inv({ id: 'rider1', amount: 500 }), inv({ id: 'rider2', amount: 250.5 })],
    })
    expect(lines.map((l) => l.invoiceId)).toEqual(['rider1', 'rider2'])
    expect(lines[1]!.amountCents).toBe(25050)
    expect(hazmatRollInTotalDollars(lines)).toBe(750.5)
  })
})
