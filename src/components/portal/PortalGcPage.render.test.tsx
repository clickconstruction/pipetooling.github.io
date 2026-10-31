// @vitest-environment jsdom
/**
 * Messages cut 8b-i: the customer's page (shape B) for a GC job, from customer-portal's answer through the real payload
 * parser. Home's Your move, This week and Your people; Money's win, its cards and the folds; Schedule's What moved;
 * Papers with the existing forms under Waiting on you; the office's words laid over; a paper opened on the page sends
 * one quiet request; and a job without its page block reads as before. Made-up customer and job. The office's preview
 * (Messages cut 8d) sends nothing and tells no paper open, offers the Spanish, and tags each card with its source. The
 * Messages tab (cut 8e) reads their thread and writes to it as a line from their page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PortalGcJobs } from './PortalGcJobs'
import { PortalGcPage } from './PortalGcPage'
import { parsePortalPayload, type PortalPayload } from '../../lib/portal/portalPayload'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const PAGE = {
  contract: 412000,
  contractSignedOn: '2026-09-19',
  architect: 'Marsh & Vale Architects',
  payDays: 30,
  changes: [
    { id: 'co-1', number: 1, description: 'Exam 2 cabinets', descriptionEs: null, price: 6300, days: 0, state: 'signed', signedOn: '2026-09-28' },
    { id: '00000000-0000-0000-0000-0000000000c2', number: 2, description: 'A sink in exam 3', descriptionEs: null, price: 2150, days: 0, state: 'open', signedOn: null },
  ],
  payApps: [
    { id: '00000000-0000-0000-0000-0000000000a1', number: 1, final: false, periodTo: '2026-09-30', sentOn: '2026-10-01', due: 63000, certifiedOn: null, invoiceId: 'inv-1', customerLine: 'Slab and plumbing', customerLineEs: null },
  ],
  week: { on: '2026-10-02', line: 'Permits are in. The slab pour is set for the week of Oct 12.', lineEs: null, photosUrl: 'https://photos.example/week' },
  people: [{ role: 'super', name: 'Wendi' }],
  moves: [{ activity: 'Parking lot pour', madeOn: '2026-10-01', from: '2026-10-05', to: '2026-10-12', reason: 'weather' }],
  switches: { photos: true, forecast: false, spanish: false },
}
const JOB = {
  projectId: 'p-clinic',
  name: 'Clinic on Main',
  changeOrders: [{ id: '00000000-0000-0000-0000-0000000000c2', number: 2, description: 'A sink in exam 3', price: 2150, days: 0, sentOn: '2026-09-30' }],
  canAccept: false,
  accepted: null,
  page: PAGE,
}
const payloadOf = (raw: Record<string, unknown> = {}): PortalPayload =>
  parsePortalPayload({
    customerName: 'Clinic Owner',
    company: { name: 'Click Construction', phone: '(210) 555-0100', email: 'office@example.com' },
    bills: [{ invoiceId: 'inv-1', jobLabel: 'Clinic', amount: 63000, payUrl: 'https://pay.example/inv-1', payments: [], totalPaid: 0 }],
    gcJobs: [JOB],
    ...raw,
  })!
const usd = (n: number) => `$${n.toLocaleString('en-US')}`
const TOKEN = 'tok-1234567890abcdef'
const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const show = (payload = payloadOf()) => render(<PortalGcJobs token={TOKEN} jobs={payload.gcJobs} formatUsd={usd} payload={payload} />)

describe("the customer's page, shape B", () => {
  it('opens on Home: the change order waiting, this week with its photos, and who to call', () => {
    show()
    expect(screen.getByTestId('portal-gc-page').textContent).toContain('Clinic on Main')
    expect(screen.getByTestId('portal-gc-move').textContent).toContain('Change order 2 waits on your answer')
    expect(screen.getByTestId('portal-gc-move').textContent).toContain('A sink in exam 3 · +$2,150 · adds no days')
    expect(screen.getByTestId('portal-gc-week').textContent).toContain('Permits are in.')
    expect(screen.getByRole('link', { name: 'See this week’s photos' }).getAttribute('href')).toBe('https://photos.example/week')
    expect(screen.getByTestId('portal-gc-people').textContent).toContain('Click Construction office(210) 555-0100')
    expect(screen.getByTestId('portal-gc-people').textContent).toContain('Wendi on site')
    expect(screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('tel:')).map((a) => a.textContent)).toEqual(['(210) 555-0100'])
    expect(screen.queryByText('Español')).toBeNull()
  })

  it('reads Money: the win first, the open application with its architect, and the statement folded to two lines', () => {
    show()
    fireEvent.click(screen.getByTestId('portal-gc-tab-money'))
    expect(screen.getByTestId('portal-gc-money-header').textContent).toContain('Getting started')
    expect(screen.getByTestId('portal-gc-money-header').textContent).toContain('$0 of $418,300 so far')
    expect(screen.getByTestId('portal-gc-payapp-1').textContent).toContain('With your architect, Marsh & Vale Architects, for the certificate since Thu Oct 1.')
    expect(screen.getByTestId('portal-gc-money-changes').textContent).toContain('Change order 2 · A sink in exam 3+$2,150')
    expect(screen.getByTestId('portal-gc-statement').textContent).not.toContain('Balance to finish')
    fireEvent.click(screen.getByRole('button', { name: /The statement/ }))
    expect(screen.getByTestId('portal-gc-statement').textContent).toContain('Balance to finish$418,300')
  })

  it('tells the office when the customer reads a pay application', async () => {
    show()
    fireEvent.click(screen.getByTestId('portal-gc-tab-money'))
    fireEvent.click(screen.getByRole('link', { name: 'Read the application' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const url = String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]![0])
    expect(url).toContain('/functions/v1/customer-portal?token=tok-1234567890abcdef&paper=pay_app:00000000-0000-0000-0000-0000000000a1')
  })

  it('reads Schedule’s What moved by its reason, and Papers with the change order under Waiting on you', async () => {
    show()
    fireEvent.click(screen.getByTestId('portal-gc-tab-schedule'))
    expect(screen.getByTestId('portal-gc-moved').textContent).toContain('Parking lot pourweatherOct 5 to Oct 12')
    fireEvent.click(screen.getByTestId('portal-gc-tab-papers'))
    expect(screen.getByTestId('portal-gc-signed').textContent).toContain('Our contract')
    expect(screen.getByTestId('portal-gc-signed').textContent).toContain('Change order 1 · Exam 2 cabinets')
    expect(screen.getByTestId('portal-gc-waiting').textContent).toContain('Change order 2')
    fireEvent.click(screen.getByRole('button', { name: 'Sign it' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]![0])).toContain('paper=change_order:00000000-0000-0000-0000-0000000000c2')
  })

  it("lays the office's words over the page", () => {
    show(payloadOf({ pageWords: [{ key: 'roleSuper', en: 'your superintendent', es: 'su superintendente' }] }))
    expect(screen.getByTestId('portal-gc-people').textContent).toContain('Wendi your superintendent')
  })

  it('reads a job without its page block as before', () => {
    const payload = payloadOf({ gcJobs: [{ ...JOB, page: undefined }] })
    render(<PortalGcJobs token={TOKEN} jobs={payload.gcJobs} formatUsd={usd} payload={payload} />)
    expect(screen.queryByTestId('portal-gc-page')).toBeNull()
    expect(screen.getByTestId('portal-gc-co-2')).toBeTruthy()
  })
})

describe('the Money tab as one bar (punch list #217, outside-2, a prototype)', () => {
  afterEach(() => window.history.replaceState({}, '', '/'))

  it('draws today’s head with no flag, and the bar on ?shape=1', () => {
    window.history.replaceState({}, '', '/portal?t=tok-1234567890abcdef&shape=1')
    show()
    fireEvent.click(screen.getByTestId('portal-gc-tab-money'))
    expect(screen.queryByTestId('portal-gc-money-header')).toBeNull()
    const bar = screen.getByTestId('portal-gc-money-bar')
    expect(bar.textContent).toContain('Nothing paid yet')
    expect(bar.textContent).toContain('Your contract, $418,300')
    expect(bar.textContent).toContain('with your architect $63,000')
    expect(bar.textContent).toContain('Balance to finish$418,300')
    expect([...bar.querySelectorAll('[data-money-part]')].map((e) => e.getAttribute('data-money-part'))).toEqual(['architect', 'rest'])
  })

  it('keeps a real visitor on today’s head with ?sbs=1, and draws today over the bar on a sample page, with the three-months-in frame', () => {
    window.history.replaceState({}, '', '/portal?t=tok-1234567890abcdef&sbs=1')
    show()
    fireEvent.click(screen.getByTestId('portal-gc-tab-money'))
    expect(screen.getByTestId('portal-gc-money-header')).toBeTruthy()
    expect(screen.queryByTestId('prototype-side-by-side')).toBeNull()
    cleanup()
    window.history.replaceState({}, '', '/portal?t=sample-owner&sbs=1')
    const payload = payloadOf()
    render(<PortalGcJobs token="sample-owner" jobs={payload.gcJobs} formatUsd={usd} payload={payload} />)
    fireEvent.click(screen.getByTestId('portal-gc-tab-money'))
    const frames = screen.getAllByTestId('prototype-side-by-side')
    expect(frames).toHaveLength(2)
    expect(frames[0]!.querySelector('[data-side="today"]')?.textContent).toContain('Getting started')
    expect(frames[0]!.querySelector('[data-side="shape"]')?.textContent).toContain('Nothing paid yet')
    expect(screen.getByTestId('portal-gc-money-header-later').textContent).toContain('34% built')
    expect(frames[1]!.querySelector('[data-side="shape"]')?.textContent).toContain('34% paid')
    expect(frames[1]!.querySelector('[data-side="shape"]')?.textContent).toContain('is our guess from the schedule')
  })
})

describe("the office's preview (Messages cut 8d)", () => {
  const preview = (office: { sources: boolean; onSource: (fix: string) => void }) => {
    const payload = payloadOf()
    const job = payload.gcJobs[0]!
    return render(<PortalGcPage token={TOKEN} job={job} page={job.page!} payload={payload} formatUsd={usd} office={office} />)
  }

  it('sends nothing and tells no paper open, and says so on a press', async () => {
    preview({ sources: false, onSource: vi.fn() })
    fireEvent.click(screen.getByTestId('portal-gc-tab-papers'))
    fireEvent.click(screen.getByRole('button', { name: 'Sign it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, sign it' }))
    expect(await screen.findByText('This is the office’s preview. Nothing was sent.')).toBeTruthy()
    fireEvent.click(screen.getByTestId('portal-gc-tab-money'))
    fireEvent.click(screen.getByRole('link', { name: 'Read the application' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('offers Español so the office can read the Spanish before it is on', () => {
    preview({ sources: false, onSource: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(screen.getByTestId('portal-gc-move').textContent).toContain('La orden de cambio 2 espera su respuesta')
  })

  it('tags each card with the page that feeds it, and a tag goes there', () => {
    const onSource = vi.fn()
    preview({ sources: true, onSource })
    expect(screen.getByRole('button', { name: 'From Settings → Customer page · change ›' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'From the daily log · change ›' }))
    expect(onSource).toHaveBeenCalledWith('log')
    fireEvent.click(screen.getByTestId('portal-gc-tab-money'))
    fireEvent.click(screen.getByRole('button', { name: 'From the pay application · change ›' }))
    expect(onSource).toHaveBeenLastCalledWith('payApp')
  })

  it('draws no tag on the customer’s own page', () => {
    show()
    expect(document.querySelector('[data-source-tag]')).toBeNull()
  })
})

describe('the Messages tab (Messages cut 8e)', () => {
  const THREAD = [
    { id: 'm1', at: '2026-10-07T15:05:00Z', dir: 'out', door: 'text', who: 'Wendi', subject: null, body: 'The framing inspection passed this morning.' },
    { id: 'm2', at: '2026-10-08T21:30:00Z', dir: 'in', door: 'portal', who: null, subject: null, body: 'Can we look at the coffee bar on Friday?' },
  ]

  it('reads their thread, and lands their line in it from this job’s page', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, line: { id: 'm9', at: '2026-10-09T14:00:00Z', dir: 'in', door: 'portal', who: null, subject: null, body: 'Friday at 10 works.' } }) })
    show(payloadOf({ thread: THREAD }))
    fireEvent.click(screen.getByRole('tab', { name: 'Messages' }))
    const list = screen.getByRole('list', { name: 'Messages' })
    expect(list.textContent).toContain('The framing inspection passed this morning.Wendi · Wed Oct 7 · by text')
    expect(list.textContent).toContain('Can we look at the coffee bar on Friday?You · Thu Oct 8 · here')
    expect(screen.getByTestId('portal-gc-messages').textContent).toContain('For something urgent on site, call Wendi.')
    fireEvent.change(screen.getByRole('textbox', { name: 'Write to us…' }), { target: { value: 'Friday at 10 works.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(screen.getByRole('list', { name: 'Messages' }).textContent).toContain('Friday at 10 works.You · Fri Oct 9 · here'))
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, { body: string }]
    expect(url).toContain('/functions/v1/submit-portal-request')
    expect(JSON.parse(init.body)).toEqual({ token: TOKEN, kind: 'portal_message', projectId: 'p-clinic', text: 'Friday at 10 works.' })
  })

  it('draws no Messages tab from an older function', () => {
    show()
    expect(screen.queryByRole('tab', { name: 'Messages' })).toBeNull()
  })

  it('sends nothing from the office’s preview', async () => {
    const payload = payloadOf({ thread: THREAD })
    const job = payload.gcJobs[0]!
    render(<PortalGcPage token={TOKEN} job={job} page={job.page!} payload={payload} formatUsd={usd} office={{ sources: false, onSource: vi.fn() }} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Messages' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Write to us…' }), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect((await screen.findByRole('alert')).textContent).toBe('This is the office’s preview. Nothing was sent.')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
