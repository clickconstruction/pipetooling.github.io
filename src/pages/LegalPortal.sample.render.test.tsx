// @vitest-environment jsdom
/**
 * v2.3639: the firm portal draws the sample matter. Since v2.4638 the page builds the sample itself from
 * the shared fixture (no fetch), and the sample tells one story: every panel a firm opens has something
 * true to show — the Paper tab's notice with the owner's answers and the demand, the Lien grid, the
 * particulars, and the firm's own entries.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LegalPortal from './LegalPortal'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function openSample() {
  const fetchSpy = vi.fn(() => Promise.reject(new Error('the sample must not fetch')))
  vi.stubGlobal('fetch', fetchSpy)
  render(
    <MemoryRouter initialEntries={['/legal?t=sample']}>
      <LegalPortal />
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.getAllByText(/Sample Contracting/).length).toBeGreaterThan(0))
  return fetchSpy
}

describe('LegalPortal — the sample matter', () => {
  it('lists Sample Contracting with its open balance, built on the page without a fetch', async () => {
    const fetchSpy = await openSample()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(document.body.textContent).toMatch(/14,400/)
    expect(document.body.textContent).toMatch(/Hays County · owner of record: Sample Holdings LLC/)
    expect(document.body.textContent).not.toMatch(/NaN|undefined/)
  })

  it('fills the property record and Click’s particulars with sample values', async () => {
    await openSample()
    expect(document.body.textContent).toMatch(/Lot 4, Block B, Sample Commerce Park/)
    expect(screen.getByText('Master Plumber M-00000 (sample)')).toBeTruthy()
    expect(screen.getByText('Robin Sample, office manager (sample)')).toBeTruthy()
    expect(screen.getByText('Casey Sample, owner (sample)')).toBeTruthy()
  })

  it('draws the notice with the owner’s answers and the passed demand on Paper', async () => {
    await openSample()
    fireEvent.click(screen.getByRole('button', { name: 'Paper' }))
    const band = await waitFor(() => {
      const el = document.querySelector('[data-legal-envelope-answers]')
      expect(el).not.toBeNull()
      return el
    })
    expect(band?.textContent).toMatch(/still owes Sample Contracting \$12,000\.00 · reserved the 10% and still holds it/)
    expect(band?.textContent).toMatch(/pile A/)
    expect(document.body.textContent).toMatch(/§ 53\.056 notice/)
    expect(document.body.textContent).toMatch(/· passed/)
    expect(document.body.textContent).toMatch(/subcontractor under Sample Contracting/)
    expect(document.body.textContent).not.toMatch(/lien is gone/)
  })

  it('opens a Lien grid with three jobs', async () => {
    await openSample()
    fireEvent.click(screen.getByRole('button', { name: 'Lien grid' }))
    await waitFor(() => expect(document.querySelector('[data-legal-portal-lien-grid]')).not.toBeNull())
    fireEvent.change(screen.getByRole('combobox', { name: 'Show' }), { target: { value: 'all' } })
    expect(screen.getByText('1042 · Tenant finish-out — Suite 200')).toBeTruthy()
    expect(screen.getByText('1057 · Sample Dental — rough-in')).toBeTruthy()
    expect(screen.getByText('1063 · Sample residence — repipe')).toBeTruthy()
  })

  it('shows two promises, one kept and one broken, and the firm’s question with the office’s answer', async () => {
    await openSample()
    fireEvent.click(screen.getByRole('button', { name: 'Their word' }))
    expect(document.body.textContent).toMatch(/keeps 1 of 2, 1 broken/)
    fireEvent.click(screen.getByRole('button', { name: 'Fees & steps' }))
    expect(document.body.textContent).toMatch(/Demand letter on firm letterhead/)
    expect(document.body.textContent).toMatch(/Is the owner’s answer about the \$12,000 in writing/)
    expect(document.body.textContent).toMatch(/Call notes only, logged the same afternoon/)
  })
})
