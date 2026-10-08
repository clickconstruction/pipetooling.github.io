// @vitest-environment jsdom
/**
 * v2.3639: the firm portal draws the sample matter. Since v2.4638 the page builds the sample itself from
 * the shared fixture (no fetch), and the sample tells one story: every panel a firm opens has something
 * true to show — the Paper tab's notice with the owner's answers and the demand, the Lien grid, the
 * particulars, and the firm's own entries. The sample takes its company from `PORTAL_COMPANY`; this file
 * names it Acme Mechanical, so a line that hard-codes the brand fails here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { MemoryRouter } from 'react-router-dom'
import { sampleLegalPortalResponse } from '../../supabase/functions/_shared/customerSampleFixtures'
import LegalPortal from './LegalPortal'
import { START_SEEN_KEY } from '../lib/legal/legalPortalStart'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../supabase/functions/_shared/portalCompany', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../supabase/functions/_shared/portalCompany')>()
  return { ...orig, PORTAL_COMPANY: { ...orig.PORTAL_COMPANY, name: 'Acme Mechanical' } }
})

// The portal opens on Matters once Start here has been seen (v2.4820); the first-visit tests clear it.
beforeEach(() => window.localStorage.setItem(START_SEEN_KEY, 'yes'))

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
    // The sample opens on its Narrative (v2.4812); these read the Account tab.
    fireEvent.click(screen.getByRole('button', { name: 'Account' }))
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
    // The sample opens on its Narrative (v2.4812); these read the Account tab.
    fireEvent.click(screen.getByRole('button', { name: 'Account' }))
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
    // The sample opens on its Narrative (v2.4812); these read the Account tab.
    fireEvent.click(screen.getByRole('button', { name: 'Account' }))
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

  it('lists the documents from the office under Evidence, with the held count (v2.4810)', async () => {
    await openSample()
    fireEvent.click(screen.getByRole('button', { name: 'Evidence' }))
    const docs = document.querySelector('[data-legal-firm-documents]')!
    expect(docs.textContent).toContain('Documents from the office · 2')
    expect(docs.textContent).toContain('Billing report')
    expect(docs.textContent).toContain('The office’s itemization of both bills')
    expect(docs.textContent).toContain("on the firm's link")
    expect(docs.textContent).toContain('The office held back 1 document.')
  })

  it('opens on the Narrative: the office’s account, labelled, with its table (v2.4812)', async () => {
    await openSample()
    const n = document.querySelector('[data-legal-firm-narrative]')!
    expect(n.textContent).toContain("The office's account of this matter, written by Robin Ortega")
    expect(n.querySelector('h2')!.textContent).toBe('The parties')
    expect(n.querySelector('table')!.textContent).toContain('The final walk with the GC’s super found no punch items')
    expect(screen.getByRole('button', { name: 'Narrative' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Account' }))
    expect(document.querySelector('[data-legal-firm-narrative]')).toBeNull()
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
    fireEvent.click(screen.getByRole('button', { name: 'Account' })) // the sample opens on its Narrative (v2.4812)
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

describe('LegalPortal — Start here and the tour (v2.4820)', () => {
  async function openFirstVisit() {
    window.localStorage.removeItem(START_SEEN_KEY)
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('the sample must not fetch'))))
    render(
      <MemoryRouter initialEntries={['/legal?t=sample']}>
        <LegalPortal />
      </MemoryRouter>,
    )
    await waitFor(() => expect(document.querySelector('[data-legal-start]')).not.toBeNull())
    return document.querySelector('[data-legal-start]') as HTMLElement
  }

  it('opens on Start here on a first visit: live figures, a rail that says where you are, Matters one tap away', async () => {
    const start = await openFirstVisit()
    expect(screen.getByRole('button', { name: 'Start here' }).style.fontWeight).toBe('700')
    expect(Array.from(start.querySelectorAll('[data-start-rail]')).map((b) => b.textContent?.replace(/^[0-9✓]/, ''))).toEqual(['Acme', 'Each matter', 'How we work', 'Your answers', 'The portal'])
    expect(start.querySelector('[data-legal-start-step-words]')!.textContent).toBe('Step 1 of 5')
    expect(start.textContent).toContain('On the lien grid now: 3 jobs')
    expect(start.textContent).toContain('With your firm now: 1 matter')
    fireEvent.click(screen.getByRole('button', { name: /Next: Each matter/ }))
    expect(start.getAttribute('data-start-step')).toBe('matter')
    expect(start.textContent).toContain('Lien rights are kept.')
    fireEvent.click(start.querySelector('[data-start-rail="work"]')!)
    expect(start.querySelector('[data-legal-start-step-words]')!.textContent).toBe('Step 3 of 5')
    expect(start.textContent).toContain('Your fee is 33% contingency. Filing cost is $350.')
    expect(window.localStorage.getItem(START_SEEN_KEY)).toBe('yes')
    fireEvent.click(screen.getByRole('button', { name: 'Open Matters ›' }))
    await waitFor(() => expect(screen.getAllByText(/Brazos Ridge Contracting/).length).toBeGreaterThan(0))
    expect(document.querySelector('[data-legal-start]')).toBeNull()
  })

  it('the tour opens each part of the portal, rings it and says which stop it is', async () => {
    const start = await openFirstVisit()
    fireEvent.click(start.querySelector('[data-start-rail="portal"]')!)
    expect(start.textContent).toContain('The tour has 9 short stops.')
    fireEvent.click(screen.getByRole('button', { name: 'Start the tour ›' }))
    const strip = () => document.querySelector('[data-legal-tour-strip]') as HTMLElement
    expect(strip().querySelector('[data-legal-tour-step-words]')!.textContent).toBe('Tour · stop 1 of 9')
    await waitFor(() => expect(document.querySelector('[data-legal-tour="matters"]')!.classList.contains('legalTourRing')).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Next ›' }))
    // The Narrative tab (v2.4812) leads the matter's tabs, so it is the tour's second stop.
    expect(strip().getAttribute('data-legal-tour-strip')).toBe('narrative')
    fireEvent.click(screen.getByRole('button', { name: 'Next ›' }))
    expect(strip().getAttribute('data-legal-tour-strip')).toBe('account')
    await waitFor(() => expect(document.querySelector('[data-legal-tour="matter"]')!.classList.contains('legalTourRing')).toBe(true))
    expect(document.querySelector('[data-legal-tour="matters"]')!.classList.contains('legalTourRing')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Next ›' }))
    expect(strip().textContent).toContain("Each job's lien clock is here.")
    // Paper is open on the matter: its tab is the bold one.
    expect(screen.getByRole('button', { name: 'Paper' }).style.fontWeight).toBe('700')
    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Next ›' }))
    expect(strip().getAttribute('data-legal-tour-strip')).toBe('grid')
    await waitFor(() => expect(document.querySelector('[data-legal-portal-lien-grid]')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Next ›' }))
    expect(strip().getAttribute('data-legal-tour-strip')).toBe('notifications')
    expect(document.querySelector('.legalPortalPage--touring')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(document.querySelector('[data-legal-tour-strip]')).toBeNull()
    expect(document.querySelector('.legalPortalPage--touring')).toBeNull()
    // Esc ends it too.
    fireEvent.click(screen.getByRole('button', { name: 'Start here' }))
    fireEvent.click(document.querySelector('[data-start-rail="portal"]')!)
    fireEvent.click(screen.getByRole('button', { name: 'Start the tour ›' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('[data-legal-tour-strip]')).toBeNull()
  })

  it('opens the Texas lien rules on the portal, with no link into the signed-in app; the brand is the payload\'s, never typed', async () => {
    const start = await openFirstVisit()
    fireEvent.click(start.querySelector('[data-start-rail="work"]')!)
    fireEvent.click(screen.getByRole('button', { name: /Read the Texas lien rules Acme follows/ }))
    const sheet = await screen.findByRole('dialog', { name: 'The Texas lien rules Acme follows' }, { timeout: 4000 })
    // The guide names its rules by question since v2.4826 ("What a justice court can hear").
    expect(sheet.textContent).toMatch(/what a justice court can hear/i)
    // The sheet unwraps app links in an effect after it paints, so wait for it on a busy CI box.
    await waitFor(() => expect(sheet.querySelectorAll('a[href^="/"]').length).toBe(0))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'The Texas lien rules Acme follows' })).toBeNull())
  })

  it('step 4 asks five questions, opens a note for rule changes, and the sample saves nothing; Matters nudges until the firm answers (v2.4821)', async () => {
    const start = await openFirstVisit()
    fireEvent.click(start.querySelector('[data-start-rail="answers"]')!)
    const form = start.querySelector('[data-legal-intake-form]') as HTMLElement
    expect(form.textContent).toContain('Five questions. Your answers go to Acme.')
    expect(Array.from(form.querySelectorAll('[data-intake-question]')).map((q) => q.getAttribute('data-intake-question'))).toEqual(['needs', 'fileWhere', 'efile', 'constable', 'rules'])
    fireEvent.click(screen.getByRole('button', { name: 'Changes needed' }))
    expect(form.querySelector('[data-intake-question="rulesNote"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'It depends' }))
    expect(screen.getByRole('button', { name: 'It depends' }).getAttribute('aria-pressed')).toBe('true')
    expect(form.textContent).toContain('Nothing sent yet.')
    const send = form.querySelector('[data-legal-intake-send]') as HTMLButtonElement
    expect(send.disabled).toBe(true)
    const who = screen.getByRole('combobox', { name: 'Answered by' }) as HTMLSelectElement
    fireEvent.change(who, { target: { value: who.options[1]!.value } })
    expect(send.disabled).toBe(false)
    fireEvent.click(send)
    await waitFor(() => expect(form.textContent).toContain('Sample — nothing is saved here.'))
    fireEvent.click(screen.getByRole('button', { name: 'Open Matters ›' }))
    const nudge = await waitFor(() => document.querySelector('[data-legal-intake-nudge]') as HTMLElement)
    expect(nudge.textContent).toContain('Acme asked five quick questions.')
    fireEvent.click(screen.getByRole('button', { name: 'Answer them on Start here ›' }))
    expect(document.querySelector('[data-legal-start]')!.getAttribute('data-start-step')).toBe('answers')
  })
})
