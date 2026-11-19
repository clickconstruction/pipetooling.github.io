// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SubPortal from './SubPortal'
import { installDomShims } from '../test/renderSmokeMocks'
import { SUB_PORTAL_DEMO_PAYLOAD } from '../lib/subPortal/subPortalDemoFixture'
import { sampleSubPortalPage } from '../../supabase/functions/_shared/customerSampleSub'
import { JOB_PAPERS_RETURN_KEY } from '../lib/jobs/jobPapers'

/**
 * Wiring smoke for the sub portal page (sub-portal train): the edge-fn fetch
 * is stubbed with the demo fixture; asserts every statement section renders
 * from a parsed payload — head figures, job cards, offer, ledger, paperwork.
 * The page needs a router location carrying ?t=, so it renders in its own
 * MemoryRouter (it uses none of the app contexts renderWithProviders adds).
 */

const TOKEN = 'a'.repeat(32)

function renderPortal(query = '') {
  installDomShims()
  return render(
    <MemoryRouter initialEntries={[`/sub?t=${TOKEN}${query}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/sub" element={<SubPortal />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => SUB_PORTAL_DEMO_PAYLOAD,
    })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SubPortal render smoke', () => {
  it('renders the full statement from a fetched payload', async () => {
    renderPortal()
    await waitFor(() => expect(screen.getByText('Work & pay statement')).toBeTruthy())

    // Head: sub name + owed figure + split pay note
    expect(screen.getByText('Danny Vasquez')).toBeTruthy()
    // The owed figure appears in the head AND the recap's double-rule total.
    expect(screen.getAllByText('$4,180.00').length).toBeGreaterThanOrEqual(2)

    // Job cards with line items and pay-when
    expect(screen.getAllByText(/J-1482/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/14 × Top out fixtures/)).toBeTruthy()
    expect(screen.getByText(/Payable after Sep 9, 2026/)).toBeTruthy()
    // Stage rail (v2.2767): the working sheet offers the sub's one button; the
    // walk-through sheet (moved from the portal Sep 1) reads its dated sentence.
    // v2.2931: the done button became the percent control; 100 ✓ + Send to office is the done path.
    expect(screen.getByText('How far along is your part?')).toBeTruthy()
    expect(screen.getByText('100% ✓')).toBeTruthy()
    expect(screen.getByText(/You told us the work's done Sep 1, 2026/)).toBeTruthy()

    // Offer with sign-to-accept
    expect(screen.getByText('Rough-in · 407 E 6th St')).toBeTruthy()
    expect(screen.getByText(/Sign to accept this work/)).toBeTruthy()

    // Ledger + recap + minus-amount legend
    expect(screen.getByText('Restock: cracked lav (supply house)')).toBeTruthy()
    expect(screen.getByText('Balance owed to you')).toBeTruthy()
    expect(screen.getByText(/minus amount is a deduction/)).toBeTruthy()

    // Paperwork states
    expect(screen.getByText('Master Subcontract Agreement')).toBeTruthy()
    expect(screen.getByText(/Expires Nov 30, 2026/)).toBeTruthy()
    expect(screen.getByText('Sign now')).toBeTruthy()

    // Short address card
    expect(screen.getAllByText(/dv-mechanical/).length).toBeGreaterThanOrEqual(1)
  })

  it('scrolls to and halos the card the office asked to be shown (?focus=)', async () => {
    installDomShims()
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    renderPortal('&focus=sheet%3Ademo-s1')
    await waitFor(() => expect(screen.getByText('Work & pay statement')).toBeTruthy())
    const target = document.getElementById('sp-focus-sheet-demo-s1')
    expect(target).toBeTruthy()
    // The working sheet's sentence + button live inside the haloed block.
    expect(target!.textContent).toContain('How far along is your part?')
    await waitFor(() => expect(target!.className).toBe('sp-focus'))
    expect(scroll).toHaveBeenCalledTimes(1)
    // The other cards stay plain.
    expect(document.getElementById('sp-focus-sheet-demo-s2')!.className).toBe('')
    expect(document.getElementById('sp-focus-offer-demo-o1')!.className).toBe('')
    scroll.mockRestore()
  })

  it('a dead link (the function answers 404) reads the function’s own sentence, in the language picked, with no Try again (v2.5965)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({ error: 'This link is no longer active. Please contact our office for a new one.' }),
      })),
    )
    renderPortal()
    await waitFor(() => expect(screen.getByText('This link is no longer active. Please contact our office for a new one.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(screen.getByText('Este enlace ya no está activo. Comuníquese con nuestra oficina para pedir uno nuevo.')).toBeTruthy()
  })

  it('a lost signal reads No connection with Try again, in the language picked; Try again opens the statement (v2.5965)', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockResolvedValue({ ok: true, status: 200, json: async () => SUB_PORTAL_DEMO_PAYLOAD })
    vi.stubGlobal('fetch', fetchMock)
    renderPortal()
    await waitFor(() => expect(screen.getByText('No connection')).toBeTruthy())
    expect(screen.getByText('Check your signal and try again.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(screen.getByText('Sin conexión')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText('Sin conexión')).toBeNull())
  })

  it('an offer that expired reads the function’s own sentence, in English and then in the sub’s Spanish (v2.5965)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).includes('submit-sub-portal')
          ? { ok: false, status: 409, json: async () => ({ error: 'This offer has expired — call the office if you still want it.' }) }
          : { ok: true, status: 200, json: async () => SUB_PORTAL_DEMO_PAYLOAD },
      ),
    )
    renderPortal()
    await waitFor(() => expect(screen.getByText('Work & pay statement')).toBeTruthy())
    fireEvent.click(screen.getAllByRole('button', { name: 'Pass' })[0]!)
    fireEvent.change(screen.getByText(/Tell us why/).parentElement!.querySelector('textarea')!, { target: { value: 'Booked that week.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('This offer has expired — call the office if you still want it.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(screen.getByText('Esta oferta ya venció. Llame a la oficina si todavía la quiere.')).toBeTruthy()
  })

  it('a refused answer reads We couldn’t open this page with Try again (v2.5965)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'Internal error' }) })))
    renderPortal()
    await waitFor(() => expect(screen.getByText("We couldn't open this page")).toBeTruthy())
    expect(screen.getByText('Please try again later.')).toBeTruthy()
    expect(screen.queryByText('Internal error')).toBeNull()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('Today and Statements: the switch opens the sub’s papers, and Today stays the paper Print prints (v2.7597)', async () => {
    renderPortal()
    await waitFor(() => expect(screen.getByText('Work & pay statement')).toBeTruthy())
    expect(screen.queryByTestId('sub-portal-statements')).toBeNull()
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Statements' }))
    expect(screen.getByRole('heading', { name: 'Your statements' })).toBeTruthy()
    expect(screen.getByTestId('statements-still-open').textContent).toBe('$1,500.00')
    // Today leaves the screen by a class a print rule undoes, and stays mounted with what a sub typed on it.
    const today = screen.getByText('Work & pay statement').closest('.sp-today-off')
    expect(today).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Today' })[0]!)
    expect(screen.queryByTestId('sub-portal-statements')).toBeNull()
    expect(screen.getByText('Work & pay statement').closest('.sp-today-off')).toBeNull()
  })

  it('a link can open on Statements, and a page with no papers has no switch (v2.7597)', async () => {
    renderPortal('&view=statements')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Your statements' })).toBeTruthy())
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ...SUB_PORTAL_DEMO_PAYLOAD, papers: null }) })))
    renderPortal('&view=statements')
    await waitFor(() => expect(screen.getAllByText('Work & pay statement').length).toBe(2))
    expect(screen.getAllByRole('heading', { name: 'Your statements' })).toHaveLength(1)
    // The first page's own switch is the only one: the second page, with no papers, draws none.
    expect(screen.getAllByRole('button', { name: 'Statements' })).toHaveLength(1)
  })
})

/**
 * Papers before a job opens, step 6: the reply as the function sends it for a sub who owes job J2391 two papers. The
 * job's sheet, offer and booking come held back (no address, no scope, marked with the job), and `job_papers` lists
 * the job. The second sheet, J-1477, is an open job and reads as it always did. Made-up names only.
 */
const CEDAR = 'job-cedar'
const [demoSheet, openSheet] = SUB_PORTAL_DEMO_PAYLOAD.sheets
const [demoOffer] = SUB_PORTAL_DEMO_PAYLOAD.offers
const [demoBooking, ...otherBookings] = SUB_PORTAL_DEMO_PAYLOAD.days.bookings
const NDA = { id: '00000000-0000-4000-8000-000000002391', paper_name: 'Ridgeway Builders NDA', is_form: true, status: 'none', signed_at: null }
const SITE = { id: '00000000-0000-4000-8000-000000002392', paper_name: 'Site rules and photo policy', is_form: false, status: 'none', signed_at: null }
const SHUT_PAYLOAD = {
  ...SUB_PORTAL_DEMO_PAYLOAD,
  sheets: [{ ...demoSheet!, jobNumber: 'J2391', address: null, items: [], plansUrl: null, agreement: null, payHoldReason: null, papersFirstJobId: CEDAR }, openSheet!],
  offers: [{ ...demoOffer!, title: 'Work order', lines: [], startsLabel: null, exclusions: [], references: [], acknowledgements: [], specialProvisions: null, papersFirstJobId: CEDAR }],
  days: { ...SUB_PORTAL_DEMO_PAYLOAD.days, bookings: [{ ...demoBooking!, label: '#J2391', jobNumber: 'J2391', address: null, papersFirstJobId: CEDAR }, ...otherBookings] },
  job_papers: [{ job_id: CEDAR, job_number: 'J2391', papers: [NDA, SITE] }],
}

describe('SubPortal: papers before a job opens (step 6)', () => {
  const assign = vi.fn()
  const realLocation = window.location
  beforeEach(() => {
    assign.mockClear()
    window.sessionStorage.clear()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, assign, pathname: '/sub', search: `?t=${TOKEN}` } })
  })
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
  })

  function stub(submit: { ok: boolean; status: number; body: Record<string, unknown> }, payload: Record<string, unknown> = SHUT_PAYLOAD) {
    const posts: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!String(url).includes('submit-sub-portal')) return { ok: true, status: 200, json: async () => payload }
        posts.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
        return { ok: submit.ok, status: submit.status, json: async () => submit.body }
      }),
    )
    return posts
  }

  it('draws one card in place of the job’s rows: its number, its papers and Read and sign, with the money still there', async () => {
    stub({ ok: true, status: 200, body: { ok: true, signPath: '/contract/accept?t=fresh' } })
    renderPortal()
    await waitFor(() => expect(screen.getByText('Work on J2391')).toBeTruthy())
    expect(screen.getByText('This job has 2 papers to sign before you can see where it is and what the work is.')).toBeTruthy()
    expect(screen.getByText('Ridgeway Builders NDA')).toBeTruthy()
    expect(screen.getByText('Site rules and photo policy')).toBeTruthy()
    expect(screen.getAllByText('Not signed yet')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Read and sign: Ridgeway Builders NDA' })).toBeTruthy()
    // The job's sheet and offer are one line each inside the card: the number, why the address is not there, the money.
    const card = document.querySelector('[data-sub-job-papers="owed"]')!
    expect(card.querySelector('[data-sub-job-papers-sheet="demo-s1"]')!.textContent).toContain('J2391 · Papers to sign first')
    expect(card.querySelector('[data-sub-job-papers-sheet="demo-s1"]')!.textContent).toContain('Agreed $3,120.00 · Paid $1,500.00 · Open $1,620.00')
    expect(card.querySelector('[data-sub-job-papers-offer="demo-o1"]')!.textContent).toContain('New work for you · Papers to sign first')
    // Nothing of the job's place or work is drawn: no sheet card, no offer card, no sign-to-accept.
    expect(screen.queryByText(/1208 Brazos St/)).toBeNull()
    expect(screen.queryByText(/14 × Top out fixtures/)).toBeNull()
    expect(screen.queryByText('Rough-in · 407 E 6th St')).toBeNull()
    expect(screen.queryByText(/Sign to accept this work/)).toBeNull()
    // The New work section has no offer left to draw, so its heading is gone: the words live in the card's line alone.
    expect(screen.queryByRole('heading', { name: 'New work for you' })).toBeNull()
    expect(document.getElementById('sp-focus-sheet-demo-s1')).toBeNull()
    // The open job beside it reads as it always did, and the owed figure still counts the held-back sheet.
    expect(document.getElementById('sp-focus-sheet-demo-s2')).toBeTruthy()
    expect(screen.getAllByText(/894 Lamar Blvd/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('$4,180.00').length).toBeGreaterThanOrEqual(2)
  })

  it('Read and sign asks for the sub’s own copy, remembers the way back to this page and leaves for the signing page', async () => {
    const posts = stub({ ok: true, status: 200, body: { ok: true, signPath: '/contract/accept?t=fresh' } })
    renderPortal()
    fireEvent.click(await screen.findByRole('button', { name: 'Read and sign: Ridgeway Builders NDA' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/contract/accept?t=fresh'))
    expect(posts).toEqual([{ token: TOKEN, kind: 'sign_job_paper', required_paper_id: NDA.id }])
    expect(JSON.parse(window.sessionStorage.getItem(JOB_PAPERS_RETURN_KEY) ?? '{}')).toEqual({ jobId: CEDAR, path: `/sub?t=${TOKEN}` })
  })

  it('a refused press reads the function’s own sentence with the call to the office, in the language picked, and goes nowhere', async () => {
    stub({ ok: false, status: 404, body: { error: 'That paper is not on your page.' } })
    renderPortal()
    fireEvent.click(await screen.findByRole('button', { name: 'Read and sign: Ridgeway Builders NDA' }))
    expect(await screen.findByText('That paper is not on your page. Please call the office.')).toBeTruthy()
    expect(assign).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(JOB_PAPERS_RETURN_KEY)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(screen.getByText('Ese documento no está en su página. Llame a la oficina.')).toBeTruthy()
    expect(screen.getByText('Trabajo en J2391')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Leer y firmar: Ridgeway Builders NDA' })).toBeTruthy()
  })

  it('after one paper is signed the card says what is left and offers the next one', async () => {
    stub({ ok: true, status: 200, body: { ok: true, signPath: '/contract/accept?t=fresh' } }, { ...SHUT_PAYLOAD, job_papers: [{ job_id: CEDAR, job_number: 'J2391', papers: [{ ...NDA, status: 'signed', signed_at: '2026-09-02' }, SITE] }] })
    renderPortal()
    await waitFor(() => expect(screen.getByText('This job has 2 papers to sign before you can see where it is and what the work is. 1 paper is left.')).toBeTruthy())
    expect(screen.getByText('Signed today')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Read and sign: Site rules and photo policy' })).toBeTruthy()
  })

  it('a job whose papers could not be read is held shut, says so and offers no press', async () => {
    stub({ ok: true, status: 200, body: { ok: true } }, { ...SHUT_PAYLOAD, job_papers: [{ job_id: CEDAR, job_number: 'J2391', papers: [], unread: true }] })
    renderPortal()
    await waitFor(() => expect(screen.getByText('We could not check this job’s papers just now. Reload the page, or call the office.')).toBeTruthy())
    expect(document.querySelector('[data-sub-job-papers="unread"]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Read and sign/ })).toBeNull()
    expect(screen.queryByText(/1208 Brazos St/)).toBeNull()
  })

  it('a held-back day keeps its dates and its number, and says why the address is not there', async () => {
    stub({ ok: true, status: 200, body: { ok: true } })
    renderPortal()
    await waitFor(() => expect(screen.getByText('Work on J2391')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '2026-09-09' }))
    const sheet = screen.getByTestId('sub-day-sheet')
    expect(sheet.textContent).toContain('#J2391')
    expect(sheet.textContent).toContain('Papers to sign first')
    expect(sheet.textContent).not.toContain('Brazos')
    expect(sheet.querySelector('a[href*="maps"]')).toBeNull()
  })

  it('a page with no waiting job is the page as it was: no card', async () => {
    stub({ ok: true, status: 200, body: { ok: true } }, { ...SUB_PORTAL_DEMO_PAYLOAD, job_papers: [] })
    renderPortal()
    await waitFor(() => expect(screen.getByText('Work & pay statement')).toBeTruthy())
    expect(document.querySelector('[data-sub-job-papers]')).toBeNull()
    expect(screen.getByText('Rough-in · 407 E 6th St')).toBeTruthy()
    expect(screen.getByText(/14 × Top out fixtures/)).toBeTruthy()
  })
})

describe('SubPortal: the customer paid (punch list #388, step 2)', () => {
  // The demo's second sheet, moved to Waiting on customer. Every name, day and amount is the fixture's own.
  const paid = (over: Record<string, unknown>) => ({
    ...SUB_PORTAL_DEMO_PAYLOAD,
    sheets: SUB_PORTAL_DEMO_PAYLOAD.sheets.map((s) => (s.id === 'demo-s2' ? { ...s, stage: 'customer_pay', stageChangedOn: '2026-08-28', stageSource: 'office', payableAfter: null, payHoldReason: null, ...over } : s)),
  })
  const open = async (payload: unknown) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload })))
    renderPortal()
    await waitFor(() => expect(screen.getByText('Work & pay statement')).toBeTruthy())
  }

  it('a sheet waiting on the customer reads Draw requested, as it did, when the function sends no day', async () => {
    await open(paid({}))
    expect(screen.getByText('Draw requested')).toBeTruthy()
    expect(screen.getByText(/their payment is the last thing between you and this money/)).toBeTruthy()
    expect(screen.queryByTestId('sub-portal-customer-paid')).toBeNull()
  })

  it('says the customer paid, with the day and no amount, and that their payment is next', async () => {
    await open(paid({ customerPaidOn: '2026-09-01' }))
    expect(screen.getByText('Customer paid Sep 1, 2026')).toBeTruthy()
    expect(screen.getByTestId('sub-portal-customer-paid').textContent).toBe('The customer paid on Sep 1, 2026. Your payment is next. We will give it a pay run day.')
    expect(screen.queryByText('Draw requested')).toBeNull()
    expect(screen.queryByText(/their payment is the last thing between you and this money/)).toBeNull()
    expect(screen.queryByTestId('sub-portal-customer-paid-hold')).toBeNull()
  })

  it('reads the same in Spanish', async () => {
    await open(paid({ customerPaidOn: '2026-09-01' }))
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(screen.getByText('El cliente pagó el 1 sep 2026')).toBeTruthy()
    expect(screen.getByTestId('sub-portal-customer-paid').textContent).toBe('El cliente pagó el 1 sep 2026. Su pago es el siguiente. Le pondremos su fecha de pago.')
  })

  it('puts a hold’s reason right under the sentence, and promises no pay run day', async () => {
    await open(paid({ customerPaidOn: '2026-09-01', payHoldReason: 'Your insurance certificate ran out on Aug 30. Send us the new one and this moves.' }))
    expect(screen.getByTestId('sub-portal-customer-paid').textContent).toBe('The customer paid on Sep 1, 2026. Your payment is next.')
    expect(screen.getByTestId('sub-portal-customer-paid-hold').textContent).toBe('On hold: Your insurance certificate ran out on Aug 30. Send us the new one and this moves.')
    // The reason is said once, under the sentence.
    expect(screen.getAllByText(/Your insurance certificate ran out on Aug 30/)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(screen.getByTestId('sub-portal-customer-paid-hold').textContent).toBe('En espera: Your insurance certificate ran out on Aug 30. Send us the new one and this moves.')
  })

  it('a queued sheet says Queued, as it did, whatever day the customer paid', async () => {
    await open(paid({ customerPaidOn: '2026-09-01', payableAfter: '2026-09-11' }))
    expect(screen.queryByTestId('sub-portal-customer-paid')).toBeNull()
    expect(screen.queryByText(/Customer paid/)).toBeNull()
    expect(screen.getAllByText(/Queued for the pay run/).length).toBeGreaterThanOrEqual(1)
  })

  it('a day on a sheet that is not waiting on the customer changes nothing', async () => {
    await open({ ...SUB_PORTAL_DEMO_PAYLOAD, sheets: SUB_PORTAL_DEMO_PAYLOAD.sheets.map((s) => (s.id === 'demo-s2' ? { ...s, customerPaidOn: '2026-09-01' } : s)) })
    expect(screen.queryByTestId('sub-portal-customer-paid')).toBeNull()
    expect(screen.getByText(/You told us the work's done Sep 1, 2026/)).toBeTruthy()
  })

  // Step 3, the usual pay time: one line under the waiting sentence.
  it('says nothing of a usual pay time when the function sends none', async () => {
    await open(paid({}))
    expect(screen.queryByTestId('sub-portal-usual-pay')).toBeNull()
  })

  it('adds one line under the waiting sentence, in weeks, with no name and no days', async () => {
    await open(paid({ usualPayWeeks: { lo: 4, hi: 6 } }))
    expect(screen.getByText(/their payment is the last thing between you and this money/)).toBeTruthy()
    const line = screen.getByTestId('sub-portal-usual-pay')
    expect(line.textContent).toBe('This customer usually pays 4 to 6 weeks after we ask.')
    expect(screen.getByText('Draw requested')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(screen.getByTestId('sub-portal-usual-pay').textContent).toBe('Este cliente suele pagar de 4 a 6 semanas después de que se lo pedimos.')
  })

  it('reads one figure, and within a week, in both languages', async () => {
    await open(paid({ usualPayWeeks: { lo: 4, hi: 4 } }))
    expect(screen.getByTestId('sub-portal-usual-pay').textContent).toBe('This customer usually pays about 4 weeks after we ask.')
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(screen.getByTestId('sub-portal-usual-pay').textContent).toBe('Este cliente suele pagar unas 4 semanas después de que se lo pedimos.')
    cleanup()
    await open(paid({ usualPayWeeks: { lo: 0, hi: 1 } }))
    expect(screen.getByTestId('sub-portal-usual-pay').textContent).toBe('This customer usually pays within a week after we ask.')
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(screen.getByTestId('sub-portal-usual-pay').textContent).toBe('Este cliente suele pagar en menos de una semana después de que se lo pedimos.')
  })

  it('the line goes away once the customer paid, and once the sheet is queued', async () => {
    await open(paid({ usualPayWeeks: { lo: 4, hi: 6 }, customerPaidOn: '2026-09-01' }))
    expect(screen.getByTestId('sub-portal-customer-paid')).toBeTruthy()
    expect(screen.queryByTestId('sub-portal-usual-pay')).toBeNull()
    cleanup()
    await open(paid({ usualPayWeeks: { lo: 4, hi: 6 }, payableAfter: '2026-09-11' }))
    expect(screen.queryByTestId('sub-portal-usual-pay')).toBeNull()
  })

  it('a figure on a sheet that is not waiting on the customer changes nothing', async () => {
    await open({ ...SUB_PORTAL_DEMO_PAYLOAD, sheets: SUB_PORTAL_DEMO_PAYLOAD.sheets.map((s) => (s.id === 'demo-s2' ? { ...s, usualPayWeeks: { lo: 4, hi: 6 } } : s)) })
    expect(screen.queryByTestId('sub-portal-usual-pay')).toBeNull()
  })
})

// The office's sample (Settings → What customers see → Sub portal): the function's own sample answer, drawn by the page.
describe('SubPortal: the office’s sample shows the two lines of punch list #388', () => {
  const COMPANY = { name: 'Sample Plumbing', cityLine: 'Kyle, TX', licenseLine: 'M-00000', phone: '(512) 555-0100', email: 'office@example.com' }

  it('one sheet says how long this customer usually takes, one says the customer paid, one stays queued', async () => {
    const payload = sampleSubPortalPage(COMPANY, '2026-11-19', { day: 'friday', nextRun: '2026-11-20', explainer: null })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload })))
    renderPortal()
    await waitFor(() => expect(screen.getByText('Work & pay statement')).toBeTruthy())
    expect(screen.getAllByTestId('sub-portal-usual-pay').map((el) => el.textContent)).toEqual(['This customer usually pays 4 to 6 weeks after we ask.'])
    expect(screen.getByText('Customer paid Nov 18, 2026')).toBeTruthy()
    expect(screen.getAllByTestId('sub-portal-customer-paid').map((el) => el.textContent)).toEqual(['The customer paid on Nov 18, 2026. Your payment is next. We will give it a pay run day.'])
    expect(screen.getAllByText(/Queued for the pay run/).length).toBeGreaterThanOrEqual(1)
    // The day and never the amount: the paid sheet's own money is its agreed price, and no payment of the customer's is drawn.
    expect(screen.getAllByText('Draw requested')).toHaveLength(1)
  })
})
