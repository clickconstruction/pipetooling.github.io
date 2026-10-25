// @vitest-environment jsdom
/**
 * Render smoke for the supply houses card's *Mark paid…* door (v2.5838, punch list #175 step 3): the door
 * shows only with `markPaid` and only on an owed house, the form ticks every unpaid invoice to start, a
 * day ahead is refused, the save writes the ticked ids and the day and re-reads the card.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { buildLienSupplierJobs } from '../../lib/jobs/lienJobSuppliers'
import { LienJobSuppliersCard } from './LienJobSuppliers'

const markSupplierInvoicesPaid = vi.fn(async () => {})
vi.mock('../../lib/jobs/lienSupplierPaidIo', () => ({ markSupplierInvoicesPaid: (...a: unknown[]) => markSupplierInvoicesPaid(...(a as [])) }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const TODAY = '2026-10-25'
const byJob = buildLienSupplierJobs({
  invoices: [
    { id: 'a', supply_house_id: 'h', amount: 4_120, is_paid: false, invoice_date: '2026-07-14', paidYmd: null, on_job_account: false, invoice_number: '48812' },
    { id: 'b', supply_house_id: 'h', amount: 1_000, is_paid: false, invoice_date: '2026-08-02', paidYmd: null, on_job_account: true, invoice_number: 'B-2' },
    { id: 'c', supply_house_id: 'f', amount: 300, is_paid: true, invoice_date: '2026-07-01', paidYmd: '2026-07-20', on_job_account: false, invoice_number: 'F-1' },
  ],
  allocations: [{ invoice_id: 'a', job_id: 'j', pct: 100 }, { invoice_id: 'b', job_id: 'j', pct: 100 }, { invoice_id: 'c', job_id: 'j', pct: 100 }],
  houses: [{ id: 'h', name: 'Reece' }, { id: 'f', name: 'Ferguson' }],
})
const job = byJob.get('j')!
const base = { job, propertyKind: 'non_residential', todayYmd: TODAY, openBalance: 12_000, payerName: 'Burd & Assoc.', jobLabel: '891', isMobile: false }

describe('LienJobSuppliersCard · Mark paid… (v2.5838)', () => {
  it('shows the door only with markPaid, and only on the owed house', () => {
    renderWithProviders(<LienJobSuppliersCard {...base} />)
    expect(document.querySelector('[data-lien-supplier-paid-door]')).toBeNull()
    cleanup()
    renderWithProviders(<LienJobSuppliersCard {...base} markPaid={{ onChanged: () => {} }} />)
    const doors = [...document.querySelectorAll('[data-lien-supplier-paid-door]')].map((d) => d.getAttribute('data-lien-supplier-paid-door'))
    expect(doors).toEqual(['Reece'])
  })

  it('ticks every unpaid invoice to start, refuses a day ahead, writes the ticked ids and the day, then re-reads', async () => {
    const onChanged = vi.fn()
    renderWithProviders(<LienJobSuppliersCard {...base} markPaid={{ onChanged }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark paid…' }))
    const form = document.querySelector('[data-lien-supplier-paid-form="Reece"]')!
    expect(form).toBeTruthy()
    const boxes = [...form.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    expect(boxes.map((b) => b.checked)).toEqual([true, true])
    expect(form.textContent).toContain('#48812 · Jul 14 · $4,120')
    expect(form.textContent).toContain('#B-2 · Aug 2 · $1,000 · job account')
    const save = () => screen.getByRole('button', { name: /Mark .* paid/ }) as HTMLButtonElement
    expect(save().textContent).toBe('Mark 2 invoices paid · $5,120')
    fireEvent.change(screen.getByLabelText('Day the house was paid'), { target: { value: '2026-10-30' } })
    expect(save().disabled).toBe(true)
    expect(form.textContent).toContain('cannot be ahead of today')
    fireEvent.change(screen.getByLabelText('Day the house was paid'), { target: { value: '2026-10-22' } })
    fireEvent.click(boxes[0]!)
    expect(save().textContent).toBe('Mark 1 invoice paid · $1,000')
    fireEvent.click(save())
    await waitFor(() => expect(markSupplierInvoicesPaid).toHaveBeenCalledWith(['b'], '2026-10-22'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(document.querySelector('[data-lien-supplier-paid-form]')).toBeNull()
  })
})
