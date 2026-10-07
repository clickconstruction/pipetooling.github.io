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
import { sampleLegalPortalResponse } from '../../supabase/functions/_shared/customerSampleFixtures'
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

  it('says where each exhibit really is, and that the packet only counts the field reports (v2.4701)', async () => {
    await openSample()
    const rows = Array.from(document.querySelectorAll('tr')).map((r) => r.textContent ?? '')
    const reports = rows.find((t) => /Field reports and clock sessions/.test(t))
    expect(reports).toMatch(/counted in the printed packet · ask the office for the reports/)
    expect(rows.find((t) => /Final demand letters/.test(t) && /item/.test(t))).toMatch(/ask the office for the letter/)
    fireEvent.click(screen.getByRole('button', { name: 'Evidence' }))
    expect(document.body.textContent).toMatch(/The printed packet counts the reports and sessions\. Ask the office for the reports themselves\./)
    expect(document.body.textContent).not.toMatch(/come with the printed packet/)
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

  it('says where to file: the cap, both venue bases, the lien line (v2.4764)', async () => {
    await openSample()
    const block = document.querySelector('[data-legal-where-to-file]')!
    expect(block.textContent).toContain('is within the justice court limit')
    expect(block.textContent).toContain('Where the work was done')
    // The sample's property record carries precinct 2 (v2.4771); the payer's record is the same one.
    expect(block.textContent).toContain('Hays County · Justice Court, Precinct 2')
    expect(block.textContent).toContain('Where the defendant is')
    expect(block.textContent).toContain('A lien foreclosure goes to district court in Hays County')
    expect(block.textContent).toContain('Confirm with the clerk before filing.')
  })

  it('tells the firm who to call, on every view (v2.4755)', async () => {
    await openSample()
    const strip = document.querySelector('[data-legal-reach-strip]')!
    expect(strip.textContent).toContain('ask for Robin or Dana')
    expect(strip.textContent).toContain('Morgan Ellis')
    fireEvent.click(screen.getByRole('button', { name: 'Lien grid' }))
    expect(document.querySelector('[data-legal-reach-strip]')).not.toBeNull()
  })

  it('opens the Lien grid on Upcoming, with the matter’s own job beside the other two', async () => {
    await openSample()
    fireEvent.click(screen.getByRole('button', { name: 'Lien grid' }))
    await waitFor(() => expect(document.querySelector('[data-legal-portal-lien-grid]')).not.toBeNull())
    expect(screen.getByRole('button', { name: /^Upcoming · / }).getAttribute('aria-pressed')).toBe('true')
    // The rail (v2.4749): both GCs with their dollars, and the repipe under No GC.
    expect(screen.getByRole('navigation', { name: 'GCs' }).textContent).toMatch(/Brazos Ridge Contracting.*Hill Country Builders.*No GC/)
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

  it('lists the matters largest balance first and opens the largest (punch list #85 item 11)', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const payload = sampleLegalPortalResponse({ name: 'Acme Mechanical', cityLine: 'Kyle, TX', licenseLine: '', phone: '(512) 555-0100', email: 'office@example.com' } as never, today) as { matters: Array<Record<string, unknown>> }
    // The function sends the oldest referral first: a small matter referred long ago, then the sample. A live token, so the page fetches.
    const small = JSON.parse(JSON.stringify(payload.matters[0])) as { id: string; releasedAt: string; payer: { name: string }; jobs: Array<{ invoices: Array<{ amount: number }>; revenue: number; payments: unknown[]; payments_made: number }> }
    small.id = 'small-matter'
    small.releasedAt = '2026-01-05'
    small.payer.name = 'Hill Country Dental'
    small.jobs[0]!.invoices = [{ ...small.jobs[0]!.invoices[0]!, amount: 6_100 }]
    small.jobs[0]!.revenue = 6_100
    small.jobs[0]!.payments = []
    small.jobs[0]!.payments_made = 0
    payload.matters = [small, payload.matters[0]!]
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }))))
    render(
      <MemoryRouter initialEntries={['/legal?t=tok_live']}>
        <LegalPortal />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText(/largest balance first/)).toBeTruthy())
    const listed = [...document.querySelectorAll('button b')].map((b) => b.textContent).filter((t) => t === 'Brazos Ridge Contracting' || t === 'Hill Country Dental')
    expect(listed).toEqual(['Brazos Ridge Contracting', 'Hill Country Dental'])
    expect(document.body.textContent).toMatch(/total demand · balance \$14,400\.00/)
  })

  it('lays the page out by classes the phone query can fold, matters list before the matter (punch list #85 item 8)', async () => {
    await openSample()
    const split = document.querySelector('.legalPortalSplit') as HTMLElement
    expect(split).toBeTruthy()
    expect(split.style.gridTemplateColumns).toBe('')
    expect([...split.children].map((c) => c.className)).toEqual(['legalPortalMain', 'legalPortalList', 'legalPortalAside'])
    fireEvent.click(screen.getByRole('button', { name: 'Fees & steps' }))
    const forms = [...document.querySelectorAll('form.legalPortalForm')] as HTMLElement[]
    expect(forms).toHaveLength(4)
    for (const f of forms) expect(f.style.gridTemplateColumns).toBe('')
  })

  it('folds every matter table into cards on a narrow box: each cell names its column, the first leads, money is bold, an empty cell drops (v2.4808)', async () => {
    await openSample()
    const tables = [...document.querySelectorAll('table.legalCardTable')] as HTMLTableElement[]
    expect(tables.length).toBeGreaterThanOrEqual(3)
    for (const t of tables) {
      expect(t.closest('.legalCardWrap')).toBeTruthy()
      expect(t.getAttribute('role')).toBe('table')
      const head = [...t.querySelectorAll('thead th')].map((th) => th.textContent)
      for (const row of t.querySelectorAll('tbody > tr:not([data-card-sub])')) {
        const cells = [...row.children] as HTMLElement[]
        expect(cells.map((c) => c.getAttribute('data-label'))).toEqual(head)
        expect(cells[0]?.hasAttribute('data-card-title')).toBe(true)
        for (const c of cells) expect(c.firstElementChild?.className).toBe('legalCardVal')
      }
    }
    // Account: the ledger's Amount and Balance are the card's bold money lines.
    const ledger = tables.find((t) => t.querySelector('thead th')?.textContent === 'Date')!
    const first = ledger.querySelector('tbody > tr')!
    expect([...first.querySelectorAll('[data-card-num]')].map((c) => c.getAttribute('data-label'))).toEqual(['Amount', 'Balance'])
    // Paper: the Agreements PDF column has no name, so it spans the card, and drops when there is no PDF.
    fireEvent.click(screen.getByRole('button', { name: 'Paper' }))
    const agreements = ([...document.querySelectorAll('table.legalCardTable')] as HTMLTableElement[]).find((t) => [...t.querySelectorAll('thead th')].map((th) => th.textContent).join('|') === 'Job|Agreement|')!
    for (const row of agreements.querySelectorAll('tbody > tr')) {
      const pdf = row.children[2] as HTMLElement
      expect(pdf.getAttribute('data-label')).toBe('')
      expect(pdf.hasAttribute('data-card-drop')).toBe(!pdf.querySelector('a'))
    }
  })
})
