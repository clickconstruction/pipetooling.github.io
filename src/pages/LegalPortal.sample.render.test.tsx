// @vitest-environment jsdom
/**
 * v2.3639: the firm portal draws the sample matter. Since v2.4638 the page builds the sample itself from
 * the shared fixture (no fetch), and the sample tells one story: every panel a firm opens has something
 * true to show — the Paper tab's notice with the owner's answers and the demand, the Lien grid, the
 * particulars, and the firm's own entries. The sample takes its company from `PORTAL_COMPANY`; this file
 * names it Acme Mechanical, so a line that hard-codes the brand fails here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { MemoryRouter } from 'react-router-dom'
import LegalPortal from './LegalPortal'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../supabase/functions/_shared/portalCompany', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../supabase/functions/_shared/portalCompany')>()
  return { ...orig, PORTAL_COMPANY: { ...orig.PORTAL_COMPANY, name: 'Acme Mechanical' } }
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
  await waitFor(() => expect(screen.getAllByText(/Brazos Ridge Contracting/).length).toBeGreaterThan(0))
  return fetchSpy
}

describe('LegalPortal — the sample matter', () => {
  it('lists Brazos Ridge Contracting with its open balance, built on the page without a fetch', async () => {
    const fetchSpy = await openSample()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(document.body.textContent).toMatch(/14,400/)
    expect(document.body.textContent).toMatch(/Hays County · owner of record: Alvarado Holdings LLC/)
    expect(document.body.textContent).not.toMatch(/NaN|undefined/)
  })

  it('speaks the firm’s words, not the office’s (punch list #85 item 3)', async () => {
    await openSample()
    expect(screen.getByText('referred')).toBeTruthy()
    expect(screen.getByText('Particulars for filing')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Record of contact' }))
    expect(document.body.textContent).toMatch(/Acme Mechanical's contact record with this customer/)
    fireEvent.click(screen.getByRole('button', { name: 'Fees & steps' }))
    expect(document.body.textContent).toMatch(/Account history, oldest first/)
    expect(document.body.textContent).toMatch(/Attorney fee/)
    expect(document.body.textContent).not.toMatch(/Needs You|Their word|From Click|Click’s|What Click did|chose to share/)
    expect(document.body.textContent).toMatch(/this is what the law firm sees/)
    expect(document.body.textContent).not.toMatch(/what a customer sees/)
  })

  it('lists the facts on file for each job, never a theory or the office’s credit terms (punch list #85 item 4)', async () => {
    await openSample()
    const record = document.querySelector('[data-legal-job-record]')
    expect(record?.textContent).toMatch(/^signed agreement \d{4}-\d{2}-\d{2} by Pat Holloway, bill sent, field record with a GPS location, no dispute logged$/)
    expect(document.body.textContent).not.toMatch(/theory|Basis|sworn account|Terms with/i)
    fireEvent.click(screen.getByRole('button', { name: 'Paper' }))
    expect(document.body.textContent).toMatch(/Agreements/)
    expect(document.body.textContent).not.toMatch(/Agreements and theory|holds — bill received/)
  })

  it('fills the property record and the company’s particulars with sample values', async () => {
    await openSample()
    expect(document.body.textContent).toMatch(/Lot 4, Block B, Creekside Commerce Park/)
    expect(screen.getByText('Master Plumber M-41207 (sample)')).toBeTruthy()
    expect(screen.getByText('Robin Ortega, office manager (sample)')).toBeTruthy()
    expect(screen.getByText('Casey Lindell, owner (sample)')).toBeTruthy()
  })

  it('draws the notice with the owner’s answers and the passed demand on Paper', async () => {
    await openSample()
    fireEvent.click(screen.getByRole('button', { name: 'Paper' }))
    const band = await waitFor(() => {
      const el = document.querySelector('[data-legal-envelope-answers]')
      expect(el).not.toBeNull()
      return el
    })
    expect(band?.textContent).toMatch(/still owes Brazos Ridge Contracting \$12,000\.00 · reserved the 10% and still holds it/)
    expect(band?.textContent).toMatch(/pile A/)
    expect(document.body.textContent).toMatch(/§ 53\.056 notice/)
    expect(document.body.textContent).toMatch(/· passed/)
    expect(document.body.textContent).toMatch(/subcontractor under Brazos Ridge Contracting/)
    expect(document.body.textContent).not.toMatch(/lien is gone/)
  })

  it('opens the Lien grid on All, with the matter’s own job beside the other two', async () => {
    await openSample()
    fireEvent.click(screen.getByRole('button', { name: 'Lien grid' }))
    await waitFor(() => expect(document.querySelector('[data-legal-portal-lien-grid]')).not.toBeNull())
    expect((screen.getByRole('combobox', { name: 'Show' }) as HTMLSelectElement).value).toBe('all')
    expect(screen.getByText('1042 · Tenant finish-out — Suite 200')).toBeTruthy()
    expect(screen.getByText('1057 · Plum Creek Dental — rough-in')).toBeTruthy()
    expect(screen.getByText('1063 · Whitfield residence — repipe')).toBeTruthy()
  })

  it('shows two promises, one kept and one broken, and the firm’s question with the office’s answer', async () => {
    await openSample()
    fireEvent.click(screen.getByRole('button', { name: 'Record of contact' }))
    expect(document.body.textContent).toMatch(/Promises kept: 1 of 2, 1 broken/)
    fireEvent.click(screen.getByRole('button', { name: 'Fees & steps' }))
    expect(document.body.textContent).toMatch(/Demand letter on firm letterhead/)
    expect(document.body.textContent).toMatch(/Is the owner’s answer about the \$12,000 in writing/)
    expect(document.body.textContent).toMatch(/Call notes only, logged the same afternoon/)
  })

  it('draws no hidden honeypot box, and the function no longer reads one (v2.4622, punch list #85 item 28)', async () => {
    await openSample()
    expect(document.querySelector('input[name="website"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Notifications/ }))
    await waitFor(() => expect(document.body.textContent).toMatch(/Add a person at the firm/))
    expect(document.querySelector('input[name="website"]')).toBeNull()
    // A password manager that fills every text box would have made a real act vanish behind "Saved".
    expect(readFileSync('supabase/functions/submit-legal-portal/index.ts', 'utf8')).not.toMatch(/body\.website/)
  })
})
