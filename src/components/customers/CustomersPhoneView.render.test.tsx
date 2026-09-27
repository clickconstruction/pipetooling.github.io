// @vitest-environment jsdom
/**
 * Render smokes for Customers on a phone (v2.3886): Recent before anything is
 * typed, the lenses, the A–Z pages, a search with Call and Email on the row
 * and an archived match marked, and money kept from a role that cannot see it.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { CustomersPhoneView } from './CustomersPhoneView'
import type { PhoneCustomer } from '../../lib/customers/customerPhoneSearch'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../contexts/JobDetailModalContext', () => ({ useJobDetailModal: () => ({ openJobDetail: vi.fn() }) }))

beforeAll(installDomShims)
afterEach(cleanup)

const c = (over: Partial<PhoneCustomer>): PhoneCustomer => ({ id: over.name ?? 'x', name: 'X', address: '', phone: '', email: '', archived: false, masterName: '', masterEmail: '', lastActivityIso: '', openBalance: 0, openJobs: 0, jobs: 0, ...over })
const few = [
  c({ name: 'Alder Homes', address: '12 Lenox Ct', phone: '(210) 555-0142', email: 'a@alder.example', lastActivityIso: '2026-09-20', openBalance: 1240, openJobs: 1 }),
  c({ name: 'Lenox Builders', lastActivityIso: '2026-09-26', jobs: 6 }),
  c({ name: 'Old Lenox Co', archived: true, lastActivityIso: '2024-02-01' }),
  c({ name: 'Quiet Customer' }),
]
const base = { detailsLoading: false, moneyHidden: false, todayYmd: '2026-09-27', onAddCustomer: () => {} }
const names = () => [...document.querySelectorAll('[data-phone-customer] strong')].map((n) => n.textContent)

describe('CustomersPhoneView', () => {
  it('opens on Recent — recently active, never archived — with the search first', async () => {
    renderWithProviders(<CustomersPhoneView {...base} customers={few} />)
    await settle()
    expect(screen.getByRole('searchbox', { name: 'Search customers and jobs' })).toBeTruthy()
    expect(names()).toEqual(['Lenox Builders', 'Alder Homes'])
    expect(screen.getByRole('button', { name: 'Owes 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Everyone A–Z · 3' })).toBeTruthy()
  })

  it('a search lists matches with Call and Email, marks an archived one, and hides the lenses', async () => {
    renderWithProviders(<CustomersPhoneView {...base} customers={few} />)
    await settle()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'lenox' } })
    await settle()
    expect(names()).toEqual(['Lenox Builders', 'Alder Homes', 'Old Lenox Co'])
    expect(document.querySelector('[data-phone-customers-count]')?.textContent).toBe('3 customers')
    expect(screen.getByRole('link', { name: 'Call Alder Homes' }).getAttribute('href')).toMatch(/^tel:/)
    expect(screen.getByRole('link', { name: 'Email Alder Homes' }).getAttribute('href')).toBe('mailto:a@alder.example')
    expect(document.querySelector('[data-phone-customer="Old Lenox Co"]')?.textContent).toContain('Archived')
    expect(document.querySelector('[data-phone-customers-lens]')).toBeNull()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz' } })
    await settle()
    expect(screen.getByText(/Nobody matches/)).toBeTruthy()
  })

  it('Owes lists who owes; a role that cannot see money gets no Owes chip and no dollars', async () => {
    const { unmount } = renderWithProviders(<CustomersPhoneView {...base} customers={few} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Owes 1' }))
    expect(names()).toEqual(['Alder Homes'])
    expect(document.querySelector('[data-phone-customer="Alder Homes"]')?.textContent).toContain('owes $1,240')
    unmount()
    renderWithProviders(<CustomersPhoneView {...base} moneyHidden customers={few} />)
    await settle()
    expect(screen.queryByRole('button', { name: /^Owes/ })).toBeNull()
    expect(document.body.textContent).not.toContain('$1,240')
  })

  it('Everyone A–Z draws fifty at a time', async () => {
    const many = Array.from({ length: 120 }, (_, i) => c({ name: `Customer ${String(i).padStart(3, '0')}` }))
    renderWithProviders(<CustomersPhoneView {...base} customers={many} />)
    await settle()
    expect(screen.getByText(/Nobody has been active yet/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Everyone A–Z · 120' }))
    expect(names()).toHaveLength(50)
    fireEvent.click(screen.getByRole('button', { name: 'Show 50 more · 50 of 120' }))
    expect(names()).toHaveLength(100)
    fireEvent.click(screen.getByRole('button', { name: 'Show 20 more · 100 of 120' }))
    expect(names()).toHaveLength(120)
    expect(document.querySelector('[data-phone-customers-more]')).toBeNull()
  })
})
