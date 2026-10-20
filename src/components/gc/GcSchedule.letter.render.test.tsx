// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 15a: the customer's letter on the Schedule window (G-94). On a job being
 * built, for someone who may move a bar, the card under the dates to meet sends through the window's io with the read's
 * own state and reads the schedule again. With the money read on, the letter reads the same, since it is built from the
 * read's state and never the money read's (gc 4's note 1). None shows in the what-if copy or to someone who may not move
 * a bar. The io is mocked over one job read: Fair Oaks D, with 4 late days and the fee laid over its late finish as the
 * money test lays them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcScheduleWindow } from './GcScheduleWindow'
import { loadSchedule, loadScheduleMoney } from '../../lib/gc/scheduleIo'
import { sendScheduleLetter } from '../../lib/gc/scheduleLetterIo'
import type { ScheduleMoney } from '../../lib/gc/scheduleMoney'
import { NO_DRAWS } from '../../lib/gc/drawRows'
import type { OwnerTermsRow } from '../../lib/gc/billCustomer'
import { customerScheduleLetter } from '../../lib/gc/schedule/customerScheduleSend'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { whatIfCopy } from '../../lib/gc/schedule/whatIf'
import type { GcProject, GcState } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

vi.mock('../../lib/gc/scheduleIo', () => {
  const loadSchedule = vi.fn()
  return { loadSchedule, loadScheduleWithHolds: vi.fn((state: unknown, id: string) => loadSchedule(state, id)), loadScheduleMoney: vi.fn() }
})
vi.mock('../../lib/gc/scheduleLetterIo', () => ({ sendScheduleLetter: vi.fn(() => Promise.resolve({ ok: true, to: 'Cibolo Creek Partners', email: 'elena@example.com' })) }))

const FEE = 'At $500 a day, the 4 days cost $2,000.'
vi.mock('../../lib/gc/lateFinish', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/gc/lateFinish')>()
  return {
    ...real,
    lateFinish: vi.fn((state: GcState, project: GcProject) => {
      const fee = project.ownerLateFinish?.perDay ? FEE : null
      return { ...real.lateFinish(state, project), late: 4, money: fee, words: fee ? [fee] : [], customerWords: ['We are working to make up the days.'], ask: null }
    }),
  }
})

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
let current: GcProject = fairOaks
const terms: OwnerTermsRow = {
  project_id: 'fairoaksd', owner_retainage_pct: 10, owner_retainage_step_at_pct: null, owner_retainage_step_to_pct: null, owner_retainage_step_way: null,
  owner_pay_days: null, owner_late_interest_pct_per_month: null, owner_late_finish_per_day: 500, billing_job_id: null, property_owner_customer_id: null,
}
const MONEY: ScheduleMoney = { bills: { terms: [terms], contract: [], billing: new Map(), names: {}, payDays: {} }, changeOrders: [], draws: NO_DRAWS }

beforeEach(() => {
  current = fairOaks
  vi.mocked(loadSchedule).mockImplementation(() => Promise.resolve({ state: s, project: current, version: 3 }))
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const card = () =>
  waitFor(() => {
    const el = document.querySelector('[data-gc-schedule-letter]')
    if (!el) throw new Error('the letter is not drawn yet')
    return el as HTMLElement
  })
const open = (canMove = true, reads: { money?: boolean } = {}) => render(<GcScheduleWindow state={s} project={fairOaks} by="Robert Douglas" canMove={canMove} reads={reads} onClose={vi.fn()} />)

describe('The customer’s letter on the Schedule window (PR 15a)', () => {
  it('sends the letter through the window’s io with the read’s own state, then reads the schedule again', async () => {
    open()
    const letter = await card()
    expect(within(letter).getByText('Send Cibolo Creek Partners their schedule')).toBeTruthy()
    fireEvent.click(within(letter).getByRole('button', { name: 'Send to Elena Marchetti' }))
    await waitFor(() => expect(sendScheduleLetter).toHaveBeenCalled())
    const [state, projectId, sent, test] = vi.mocked(sendScheduleLetter).mock.calls[0]!
    expect([state, projectId, test]).toEqual([s, 'fairoaksd', false])
    expect(sent).toEqual(customerScheduleLetter(s, fairOaks, 'Robert Douglas'))
    expect(await within(letter).findByText('Sent to Cibolo Creek Partners at elena@example.com.')).toBeTruthy()
    await waitFor(() => expect(vi.mocked(loadSchedule).mock.calls.length).toBeGreaterThan(1))
  })

  it('sends a test copy to the sender through the same io', async () => {
    vi.mocked(sendScheduleLetter).mockResolvedValueOnce({ ok: true, to: 'Robert Douglas', email: 'robert@example.com', test: true })
    open()
    fireEvent.click(within(await card()).getByRole('button', { name: 'Send a test to me' }))
    await waitFor(() => expect(sendScheduleLetter).toHaveBeenCalled())
    expect(vi.mocked(sendScheduleLetter).mock.calls[0]![3]).toBe(true)
    expect(await screen.findByText('A test copy went to robert@example.com.')).toBeTruthy()
  })

  it('reads the same letter with the money read on, and never the fee (gc 4’s note 1)', async () => {
    vi.mocked(loadScheduleMoney).mockResolvedValue(MONEY)
    open(true, { money: true })
    // The money is on: the fee reads elsewhere on the window.
    expect(await screen.findByText(FEE)).toBeTruthy()
    const letter = await card()
    fireEvent.click(within(letter).getByRole('button', { name: 'Read the letter' }))
    const text = letter.querySelector('[data-gc-schedule-letter-text]')!
    const lines = [...text.querySelectorAll('div > div')].map((d) => d.textContent)
    expect(lines).toEqual(customerScheduleLetter(s, fairOaks, 'Robert Douglas').lines)
    expect(lines).toContain('We are working to make up the days.')
    expect(text.textContent).not.toContain('$')
  })

  it('shows no letter in the what-if copy', async () => {
    current = { ...fairOaks, whatIf: whatIfCopy(fairOaks, 'Robert', s.today)! }
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'What if · 0' }))
    await screen.findByText('Tried in the what-if')
    expect(document.querySelector('[data-gc-schedule-letter]')).toBeNull()
  })

  it('shows no letter to someone who may not move a bar', async () => {
    open(false)
    await screen.findByText(/^Changes to the schedule/)
    expect(document.querySelector('[data-gc-schedule-letter]')).toBeNull()
  })
})
