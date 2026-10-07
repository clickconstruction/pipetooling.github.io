// @vitest-environment jsdom
/**
 * Render smokes for the Customer timeline (punch list #97): the bar's tiles and words, the
 * cards on both sides, the Show filter, focus from a job chip, the Profile switch and Close,
 * a part that could not be read, and a load that fails.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderSettled, settle } from '../../test/renderSmokeMocks'
import { emptyCustomerTimelineInput, type CustomerTimelineInput } from '../../lib/customers/customerTimeline'
import type { CustomerTimelineLoad } from '../../lib/customers/fetchCustomerTimeline'

const fetchTimeline = vi.fn<(id: string) => Promise<CustomerTimelineLoad>>()
vi.mock('../../lib/customers/fetchCustomerTimeline', async (orig) => ({
  ...(await orig<typeof import('../../lib/customers/fetchCustomerTimeline')>()),
  fetchCustomerTimeline: (id: string) => fetchTimeline(id),
}))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const openJobDetail = vi.fn()
vi.mock('../../contexts/JobDetailModalContext', () => ({ useJobDetailModal: () => ({ openJobDetail }) }))
vi.mock('../jobs/JobHoursStoryModal', () => ({
  default: ({ jobId, onClose }: { jobId: string; onClose: () => void }) => (
    <div data-testid="hours-story">
      {jobId}
      <button type="button" onClick={onClose}>
        Close the hours story
      </button>
    </div>
  ),
}))

import CustomerTimelineView from './CustomerTimelineView'

const at = (ymd: string) => `${ymd}T15:00:00Z`

function input(): CustomerTimelineInput {
  const i = emptyCustomerTimelineInput({ id: 'c1', name: 'Ridgeway Builders', createdAt: at('2024-11-12'), dateMet: null })
  const job = (id: string, hcp: string, name: string, status: string, revenue: number, created: string) => ({
    id,
    hcpNumber: hcp,
    clickNumber: null,
    jobName: name,
    jobAddress: '12 Bluff Springs Rd, Austin, TX',
    status,
    revenue,
    paymentsMade: null,
    createdAt: at(created),
    customerId: 'c1',
    customerName: 'Ridgeway Builders',
    gcCustomerId: null,
    collectionsAt: null,
    collectionsNote: null,
    uncollectibleAt: null,
    uncollectibleReason: null,
  })
  i.jobs = [job('j901', '901', 'Bluff Springs clinic', 'billed', 53250, '2026-03-02'), job('j944', '944', 'Clinic add-on', 'working', 4200, '2026-09-08')]
  i.statusEvents = [
    { jobId: 'j901', fromStatus: 'waiting', toStatus: 'working', changedAt: at('2026-03-16') },
    { jobId: 'j901', fromStatus: 'working', toStatus: 'billed', changedAt: at('2026-07-20') },
  ]
  i.invoices = [
    { id: 'a', jobId: 'j901', status: 'paid', amount: 22000, billedAt: at('2026-05-05'), sentToCustomerAt: null, channel: 'stripe' },
    { id: 'b', jobId: 'j901', status: 'billed', amount: 31250, billedAt: at('2026-07-20'), sentToCustomerAt: null, channel: 'stripe' },
  ]
  i.payments = [{ id: 'p', jobId: 'j901', invoiceId: 'a', amount: 22000, paidOn: '2026-06-01', paymentType: 'check', referenceNumber: '4471', depositPostedAt: at('2026-06-03'), depositFrom: 'Ridgeway Builders' }]
  i.clockSessions = [
    { id: 's1', jobId: 'j944', userName: 'Ana Ruiz', workDate: '2026-10-05', clockedInAt: '2026-10-05T13:00:00Z', clockedOutAt: '2026-10-05T20:00:00Z', notes: 'Set the regulator.' },
  ]
  i.supplyTickets = [{ id: 't', jobId: 'j944', invoiceDate: '2026-09-30', amount: 610, supplyHouse: 'Ferguson', invoiceNumber: 'F-4' }]
  return i
}
const loadOf = (over: Partial<CustomerTimelineLoad> = {}): CustomerTimelineLoad => ({ input: input(), missing: [], capped: [], jobCapHit: false, ...over })

beforeAll(() => {
  installDomShims()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-07T17:00:00Z'))
})
afterAll(() => {
  vi.useRealTimers()
})
afterEach(() => {
  cleanup()
  fetchTimeline.mockReset()
  openJobDetail.mockReset()
})

const kinds = () => [...document.querySelectorAll('[data-card-kind]')].map((c) => c.getAttribute('data-card-kind'))
const render = (onShowProfile = vi.fn(), onClose = vi.fn()) =>
  renderSettled(<CustomerTimelineView customerId="c1" onClose={onClose} onShowProfile={onShowProfile} />, { loaded: () => screen.findByText('Owes us') })

describe('CustomerTimelineView', () => {
  it('draws the bar and the story: what they owe, the unpaid work, and the cards on both sides', async () => {
    fetchTimeline.mockResolvedValue(loadOf())
    await render()
    expect(fetchTimeline).toHaveBeenCalledWith('c1')
    expect(screen.getByRole('heading', { name: 'Ridgeway Builders' })).toBeTruthy()
    const tile = (key: string) => document.querySelector(`[data-tile="${key}"]`)?.textContent
    expect(tile('owed')).toContain('$31,250')
    expect(tile('owed')).toContain('1 bill on 1 job · oldest 79 days')
    expect(tile('unbilled')).toContain('$4,200')
    expect(tile('hours')).toContain('7h 00m')
    expect(tile('materials')).toContain('$610')
    expect(screen.getByText('2 jobs · 2 open')).toBeTruthy()
    expect(screen.getByText('Check #4471')).toBeTruthy()
    expect(screen.getByText('27 days after the bill · deposited Jun 3 · from Ridgeway Builders')).toBeTruthy()
    expect(kinds()).toEqual(expect.arrayContaining(['payment', 'bill', 'start', 'hours', 'material']))
    expect(screen.getByRole('button', { name: /901 · Bluff Springs clinic \$31,250/ })).toBeTruthy()
  })

  it('shows only the money, or only the field, and opens a job from its name on a card', async () => {
    fetchTimeline.mockResolvedValue(loadOf())
    await render()
    fireEvent.click(screen.getByRole('button', { name: 'Money' }))
    expect(kinds()).not.toContain('hours')
    expect(kinds()).toContain('payment')
    fireEvent.click(screen.getByRole('button', { name: 'Field' }))
    expect(new Set(kinds())).toEqual(new Set(['hours', 'material']))
    // The job's name on a card opens the job; the chip of the same name in the bar focuses it.
    fireEvent.click(document.querySelector('[data-card-kind="hours"] button') as HTMLElement)
    expect(openJobDetail).toHaveBeenCalledWith({ jobId: 'j944' })
  })

  it('dims every other job when a job chip is pressed, and the chip lifts it', async () => {
    fetchTimeline.mockResolvedValue(loadOf())
    await render()
    const chip = screen.getByRole('button', { name: /944 · Clinic add-on/, pressed: false })
    fireEvent.click(chip)
    const payment = document.querySelector('[data-card-kind="payment"]') as HTMLElement
    const hours = document.querySelector('[data-card-kind="hours"]') as HTMLElement
    expect(payment.style.opacity).toBe('0.3')
    expect(hours.style.opacity).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: /944 · Clinic add-on/, pressed: true }))
    expect((document.querySelector('[data-card-kind="payment"]') as HTMLElement).style.opacity).toBe('1')
  })

  it('opens the job’s hours story from a crew card', async () => {
    fetchTimeline.mockResolvedValue(loadOf())
    await render()
    fireEvent.click(screen.getByRole('button', { name: 'show the days ›' }))
    expect(screen.getByTestId('hours-story').textContent).toContain('j944')
    fireEvent.click(screen.getByRole('button', { name: 'Close the hours story' }))
    expect(screen.queryByTestId('hours-story')).toBeNull()
  })

  it('copies a link that opens this timeline', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    fetchTimeline.mockResolvedValue(loadOf())
    await render()
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await settle()
    expect(writeText).toHaveBeenCalledWith('https://clicktooling.com/jobs?tab=stages&customerTimeline=c1')
    expect(await screen.findByText('Link copied. It opens this timeline on the Pipeline.')).toBeTruthy()
  })

  it('switches to the Profile and closes', async () => {
    const onShowProfile = vi.fn()
    const onClose = vi.fn()
    fetchTimeline.mockResolvedValue(loadOf())
    await render(onShowProfile, onClose)
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    expect(onShowProfile).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('says what it could not read, and says so when the load fails', async () => {
    fetchTimeline.mockResolvedValue(loadOf({ missing: ['notes'] }))
    await render()
    expect(screen.getByText('Could not read notes.')).toBeTruthy()
    cleanup()
    fetchTimeline.mockRejectedValue(new Error('Customer not found'))
    await renderSettled(<CustomerTimelineView customerId="c1" onClose={vi.fn()} onShowProfile={vi.fn()} />, { loaded: () => screen.findByText(/Customer not found|Could not load the timeline/) })
    expect(screen.queryByText('Owes us')).toBeNull()
  })
})
