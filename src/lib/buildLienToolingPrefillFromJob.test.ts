import { describe, expect, it, vi } from 'vitest'
import {
  buildLienToolingPrefillState,
  invoiceOpenRemainingOnJobForPrefill,
  splitJobAddressForPrefill,
} from './buildLienToolingPrefillFromJob'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { Database } from '../types/database'

type Inv = Database['public']['Tables']['jobs_ledger_invoices']['Row']

function makeInvoice(overrides: Partial<Inv> & Pick<Inv, 'id' | 'job_id'>): Inv {
  return {
    id: overrides.id,
    job_id: overrides.job_id,
    amount: overrides.amount ?? 1000,
    status: overrides.status ?? 'billed',
    billed_at: overrides.billed_at ?? '2026-01-15T12:00:00Z',
    created_at: overrides.created_at ?? '2026-01-10T12:00:00Z',
    estimated_bill_date: overrides.estimated_bill_date ?? '2026-02-01',
    external_send_channel: overrides.external_send_channel ?? null,
    external_send_note: overrides.external_send_note ?? null,
    hosted_invoice_url: overrides.hosted_invoice_url ?? null,
    sent_to_customer_at: overrides.sent_to_customer_at ?? null,
    sequence_order: overrides.sequence_order ?? 1,
    stripe_invoice_id: overrides.stripe_invoice_id ?? null,
    stripe_invoice_memo: overrides.stripe_invoice_memo ?? null,
    stripe_invoice_footer: overrides.stripe_invoice_footer ?? null,
    stripe_invoice_status: overrides.stripe_invoice_status ?? null,
    is_primary_rtb_bundle: overrides.is_primary_rtb_bundle ?? false,
  }
}

describe('splitJobAddressForPrefill', () => {
  it('parses trailing City, ST ZIP', () => {
    const r = splitJobAddressForPrefill('123 Main St, Austin, TX 78701')
    expect(r).toEqual({
      street: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    })
  })

  it('parses one-line Street City ST ZIP without commas', () => {
    const r = splitJobAddressForPrefill('123 Main St San Antonio TX 78201')
    expect(r).toEqual({
      street: '123 Main St',
      city: 'San Antonio',
      state: 'TX',
      zip: '78201',
    })
  })

  it('does not treat Blanco Rd as the city Blanco', () => {
    const r = splitJobAddressForPrefill('100 Blanco Rd San Antonio TX 78201')
    expect(r).toEqual({
      street: '100 Blanco Rd',
      city: 'San Antonio',
      state: 'TX',
      zip: '78201',
    })
  })

  it('parses ZIP+4 on trailing state', () => {
    const r = splitJobAddressForPrefill('9 Elm St, Dallas, TX 75201-1234')
    expect(r).toEqual({
      street: '9 Elm St',
      city: 'Dallas',
      state: 'TX',
      zip: '75201-1234',
    })
  })

  it('uses last comma segment as city when strict triple-comma parse fails but trailing ST ZIP matches', () => {
    const r = splitJobAddressForPrefill('400 River Rd, Boerne TX 78006')
    expect(r).toEqual({
      street: '400 River Rd',
      city: 'Boerne',
      state: 'TX',
      zip: '78006',
    })
  })
})

describe('invoiceOpenRemainingOnJobForPrefill', () => {
  it('subtracts payments linked to invoice', () => {
    const inv = makeInvoice({ id: 'inv-1', job_id: 'job-1', amount: 500 })
    const job = {
      id: 'job-1',
      payments: [
        { id: 'p1', job_id: 'job-1', invoice_id: 'inv-1', amount: 200, sequence_order: 1 },
      ],
    } as unknown as JobWithDetails
    expect(invoiceOpenRemainingOnJobForPrefill(inv, job)).toBe(300)
  })
})

describe('buildLienToolingPrefillState demand-letter', () => {
  it('maps job and billed invoice to demand letter keys', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'))

    const inv = makeInvoice({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 1000,
      billed_at: '2026-01-20T00:00:00Z',
    })
    const job = {
      id: 'job-1',
      hcp_number: '501',
      job_name: 'Replace WH',
      job_address: '9 Elm St, Dallas, TX 75201',
      customer_name: 'Buyer LLC',
      customer_email: 'buyer@example.com',
      customer_phone: '555-0100',
      revenue: 5000,
      payments_made: 0,
      last_work_date: '2026-01-18',
      last_bill_date: '2026-01-25',
      invoices: [inv],
      payments: [],
      fixtures: [],
      materials: [],
      team_members: [],
    } as unknown as JobWithDetails

    const state = buildLienToolingPrefillState('demand-letter', {
      job,
      invoice: inv,
      issuer: {
        companyName: 'Pipe Co',
        addressText: '1 Office Row\nHouston, TX 77002',
        phone: '555-0200',
        email: 'office@example.com',
        tagline: '',
        licenseLine: '',
      },
      senderNameFallback: 'Pat Master',
      senderEmailFallback: 'pat@example.com',
    })

    expect(state['invoice-number']).toBe('HCP-501')
    expect(state['client-name']).toBe('Buyer LLC')
    expect(state['invoice-total']).toBe('1000.00')
    expect(state['outstanding-balance']).toBe('1000.00')
    expect(state['business-name']).toBe('Pipe Co')
    expect(state['sender-name']).toBe('Pat Master')
    expect(state['include-late-fees']).toBe(false)

    vi.useRealTimers()
  })
})
