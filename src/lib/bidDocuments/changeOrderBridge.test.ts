import { describe, expect, it } from 'vitest'
import {
  BRIDGED_NET_CHANGE_LINE_LABEL,
  buildBridgedChangeOrderDraft,
  formatSignedDollars,
  parseCostImpact,
  sanitizeSignedMoneyTyping,
  signedMoneyToCents,
} from './changeOrderBridge'

describe('parseCostImpact — prefill for the confirm sheet, never a guess', () => {
  it('one dollar amount is the answer', () => {
    expect(parseCostImpact('Add $2,840.00 for the condensate reroute')).toBe(284000)
    expect(parseCostImpact('$450')).toBe(45000)
    expect(parseCostImpact('2,450.00')).toBe(245000)
  })

  it('a "net"/"total" line wins over the breakdown lines', () => {
    const text = ['Labor $1,200.00', 'Materials $1,640.00', 'Credit — delete stub-out −$390.00', 'Net change to contract: $2,450.00'].join('\n')
    expect(parseCostImpact(text)).toBe(245000)
  })

  it('credits and minus signs go negative; parentheses too', () => {
    expect(parseCostImpact('Credit for deleted fixtures $390.00')).toBe(-39000)
    expect(parseCostImpact('-$390.00')).toBe(-39000)
    expect(parseCostImpact('−$390.00')).toBe(-39000)
    expect(parseCostImpact('($390.00)')).toBe(-39000)
    expect(parseCostImpact('Net decrease: $1,000.00')).toBe(-100000)
  })

  it('several amounts with no net line is ambiguous → null (the sheet asks)', () => {
    expect(parseCostImpact('Labor $1,200\nMaterials $1,640')).toBeNull()
  })

  it('no money at all → null; bare counts are not money', () => {
    expect(parseCostImpact('')).toBeNull()
    expect(parseCostImpact('No change to contract sum')).toBeNull()
    expect(parseCostImpact('Adds 2 days and 3 fixtures')).toBeNull()
  })
})

describe('signed money typing', () => {
  it('keeps digits, one dot, and a leading minus only', () => {
    expect(sanitizeSignedMoneyTyping('-$2,450.00')).toBe('-2450.00')
    expect(sanitizeSignedMoneyTyping('12.3.4')).toBe('12.34')
    expect(sanitizeSignedMoneyTyping('12-3')).toBe('123')
    expect(sanitizeSignedMoneyTyping('−390')).toBe('-390')
  })

  it('blank is $0 (schedule-only change orders), text is null', () => {
    expect(signedMoneyToCents('')).toBe(0)
    expect(signedMoneyToCents('-')).toBe(0)
    expect(signedMoneyToCents('2450')).toBe(245000)
    expect(signedMoneyToCents('-390.5')).toBe(-39050)
  })

  it('formats with a sign and cents', () => {
    expect(formatSignedDollars(245000)).toBe('$2,450.00')
    expect(formatSignedDollars(-39000)).toBe('−$390.00')
    expect(formatSignedDollars(0)).toBe('$0.00')
  })
})

describe('buildBridgedChangeOrderDraft — the money lands where the CO editor reads it', () => {
  const form = {
    detailedDescriptionOfChange: ' Reroute condensate ',
    reasonForChange: 'Field condition',
    impactOnSchedule: '+2 days',
    impactOnCost: 'Labor $1,200\nMaterials $1,250\nNet $2,450.00',
    responseRequestDate: '2026-09-12',
    submittedTo: 'Knight Contracting',
  }

  it('a non-zero net change becomes total_cents plus one real line', () => {
    const d = buildBridgedChangeOrderDraft({ form, netChangeCents: 245000 })
    expect(d.total_cents).toBe(245000)
    expect(d.line_items_snapshot).toEqual([
      { line_item: BRIDGED_NET_CHANGE_LINE_LABEL, description: form.impactOnCost, quantity: 1, unit_price_cents: 245000, amount_cents: 245000 },
    ])
    expect(d.internal_notes).toBe(`Created from Bids → Change Order.\nCost impact (from the Bids form): ${form.impactOnCost}\nBid submitted to: Knight Contracting`)
    expect(d.change_order_fields).toEqual({
      description_of_change: 'Reroute condensate',
      reason_for_change: 'Field condition',
      impact_on_schedule: '+2 days',
      response_requested_by: '2026-09-12',
    })
  })

  it('a credit is a negative line', () => {
    const d = buildBridgedChangeOrderDraft({ form: { ...form, impactOnCost: 'Credit $390' }, netChangeCents: -39000 })
    expect(d.total_cents).toBe(-39000)
    expect(d.line_items_snapshot[0]?.amount_cents).toBe(-39000)
  })

  it('$0 keeps the lines empty (schedule-only) and still carries the note', () => {
    const d = buildBridgedChangeOrderDraft({ form: { ...form, impactOnCost: '', submittedTo: '' }, netChangeCents: 0 })
    expect(d.total_cents).toBe(0)
    expect(d.line_items_snapshot).toEqual([])
    expect(d.internal_notes).toBe('Created from Bids → Change Order.')
  })
})
