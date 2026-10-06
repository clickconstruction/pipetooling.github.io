import { describe, expect, it } from 'vitest'
import type { LienWaiverFormType } from '../jobsDocuments/lienWaiverRelease'
import { conditionalFormOf, lienReleaseBillStatusWord, lienReleaseOpening, lienReleaseSelectableInvoices } from './lienReleaseOpening'

const bill = (id: string, status: string, sequence_order: number) => ({ id, status, sequence_order })

describe('lienReleaseSelectableInvoices (#87 I)', () => {
  it('keeps billed, ready-to-bill and paid lines in bill order, and drops drafts and voided ones', () => {
    const lines = [bill('b3', 'paid', 2), bill('b1', 'billed', 0), bill('b0', 'draft', 3), bill('b2', 'ready_to_bill', 1), bill('bv', 'voided', 4)]
    expect(lienReleaseSelectableInvoices(lines).map((l) => l.id)).toEqual(['b1', 'b2', 'b3'])
  })

  it('reads no bills as none', () => {
    expect(lienReleaseSelectableInvoices(null)).toEqual([])
    expect(lienReleaseSelectableInvoices(undefined)).toEqual([])
  })
})

describe('lienReleaseBillStatusWord', () => {
  it('names a paid, billed and ready-to-bill line', () => {
    expect(lienReleaseBillStatusWord('paid')).toBe('Paid')
    expect(lienReleaseBillStatusWord('billed')).toBe('Billed')
    expect(lienReleaseBillStatusWord('ready_to_bill')).toBe('Ready to bill')
  })
})

describe('conditionalFormOf', () => {
  it('keeps a final a final', () => {
    expect(conditionalFormOf('unconditional_final')).toBe('conditional_final')
    expect(conditionalFormOf('unconditional_progress')).toBe('conditional_progress')
  })
})

describe('lienReleaseOpening (#87 I)', () => {
  const picks: Record<string, LienWaiverFormType> = { paid1: 'unconditional_progress', paidLast: 'unconditional_final', billed1: 'conditional_progress' }
  const formForBill = (id: string) => picks[id] ?? 'conditional_progress'

  it("opens Add the unconditional's paid bill on that bill and its own unconditional form, and asks (v2.4582)", () => {
    const selectable = lienReleaseSelectableInvoices([bill('paid1', 'paid', 0), bill('billed1', 'billed', 1)])
    expect(lienReleaseOpening({ selectable, invoiceId: 'paid1', formForBill })).toEqual({
      invoiceIds: ['paid1'],
      formType: 'unconditional_progress',
      askUnconditional: { preset: false, fallback: 'conditional_progress' },
    })
  })

  it('opens a paid last bill on the final form', () => {
    const selectable = lienReleaseSelectableInvoices([bill('billed0', 'billed', 0), bill('paidLast', 'paid', 1)])
    expect(lienReleaseOpening({ selectable, invoiceId: 'paidLast', formForBill })).toMatchObject({ invoiceIds: ['paidLast'], formType: 'unconditional_final', askUnconditional: { preset: false, fallback: 'conditional_final' } })
  })

  it('opens a billed bill on its own conditional form, asking nothing, as before', () => {
    const selectable = lienReleaseSelectableInvoices([bill('billed1', 'billed', 0)])
    expect(lienReleaseOpening({ selectable, invoiceId: 'billed1', formForBill })).toEqual({ invoiceIds: ['billed1'], formType: 'conditional_progress', askUnconditional: null })
  })

  it("keeps the opener's form over the bill's pick, and asks as a preset", () => {
    const selectable = lienReleaseSelectableInvoices([bill('paid1', 'paid', 0)])
    expect(lienReleaseOpening({ selectable, invoiceId: 'paid1', initialFormType: 'unconditional_final', formForBill })).toEqual({
      invoiceIds: ['paid1'],
      formType: 'unconditional_final',
      askUnconditional: { preset: true, fallback: 'conditional_final' },
    })
  })

  it('with no bill named, selects the billed lines and never a paid one', () => {
    const selectable = lienReleaseSelectableInvoices([bill('paid1', 'paid', 0), bill('billed1', 'billed', 1), bill('billed2', 'billed', 2)])
    expect(lienReleaseOpening({ selectable, formForBill }).invoiceIds).toEqual(['billed1', 'billed2'])
  })

  it('with no billed line, falls back to the ready-to-bill lines, still never a paid one', () => {
    const selectable = lienReleaseSelectableInvoices([bill('paid1', 'paid', 0), bill('ready1', 'ready_to_bill', 1)])
    expect(lienReleaseOpening({ selectable, formForBill }).invoiceIds).toEqual(['ready1'])
  })

  it('with only paid lines and no bill named, selects nothing, as before #87', () => {
    const selectable = lienReleaseSelectableInvoices([bill('paid1', 'paid', 0), bill('paid2', 'paid', 1)])
    expect(lienReleaseOpening({ selectable, formForBill })).toEqual({ invoiceIds: [], formType: 'conditional_progress', askUnconditional: null })
  })

  it('treats a named bill the window cannot cover like no bill named', () => {
    const selectable = lienReleaseSelectableInvoices([bill('draft1', 'draft', 0), bill('billed1', 'billed', 1)])
    expect(lienReleaseOpening({ selectable, invoiceId: 'draft1', formForBill }).invoiceIds).toEqual(['billed1'])
  })
})
