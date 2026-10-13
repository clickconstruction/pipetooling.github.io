// @vitest-environment jsdom
/**
 * Messages cut 8b-i: the customer's page (shape B) for a GC job, from customer-portal's answer through the real payload
 * parser. Home's Your move, This week and Your people; Money's win, its cards and the folds; Schedule's What moved;
 * Papers with the existing forms under Waiting on you; the office's words laid over; a paper opened on the page sends
 * one quiet request; and a job without its page block reads as before. Made-up customer and job.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PortalGcJobs } from './PortalGcJobs'
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
