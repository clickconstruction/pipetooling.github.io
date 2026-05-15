import { describe, expect, it } from 'vitest'
import { parseStripeInvoiceLinesSnapshot } from './stripeInvoicePreview'

describe('parseStripeInvoiceLinesSnapshot', () => {
  it('parses lines without source (legacy API)', () => {
    const raw = {
      currency: 'usd',
      subtotal: 100,
      total: 100,
      amount_due: 100,
      lines: [{ description: 'Item A', amount: 100 }],
    }
    const out = parseStripeInvoiceLinesSnapshot(raw)
    expect(out).not.toBeNull()
    expect(out!.lines).toHaveLength(1)
    expect(out!.lines[0]!.description).toBe('Item A')
    expect(out!.lines[0]!.source).toBeUndefined()
  })

  it('parses fixture source on lines', () => {
    const raw = {
      currency: 'usd',
      subtotal: 100,
      total: 100,
      amount_due: 100,
      lines: [
        {
          description: 'Sink — Install',
          amount: 100,
          source: { kind: 'fixture', jobs_ledger_fixture_id: ' fx-uuid ' },
        },
      ],
    }
    const out = parseStripeInvoiceLinesSnapshot(raw)
    expect(out).not.toBeNull()
    expect(out!.lines[0]!.source).toEqual({
      kind: 'fixture',
      jobs_ledger_fixture_id: 'fx-uuid',
    })
  })

  it('parses single_line source', () => {
    const raw = {
      currency: 'usd',
      subtotal: 50,
      total: 50,
      amount_due: 50,
      lines: [{ description: 'Custom', amount: 50, source: { kind: 'single_line' } }],
    }
    const out = parseStripeInvoiceLinesSnapshot(raw)
    expect(out).not.toBeNull()
    expect(out!.lines[0]!.source).toEqual({ kind: 'single_line' })
  })

  it('ignores invalid source object', () => {
    const raw = {
      currency: 'usd',
      subtotal: 10,
      total: 10,
      amount_due: 10,
      lines: [{ description: 'x', amount: 10, source: { kind: 'fixture' } }],
    }
    const out = parseStripeInvoiceLinesSnapshot(raw)
    expect(out).not.toBeNull()
    expect(out!.lines[0]!.source).toBeUndefined()
  })
})
