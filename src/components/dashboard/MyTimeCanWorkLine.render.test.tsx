// @vitest-environment jsdom
/**
 * The line at the foot of My Time (punch list #429): a person with working hours reads them with no press and is
 * told who sets them; hours about to start are told a week ahead; with none, the old line asks; a salaried person
 * with none sees nothing. Made-up people and hours.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { MyTimeCanWorkLine } from './MyTimeCanWorkLine'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { AvailabilityIo } from '../../lib/people/availabilityIo'
import type { AvailableHoursAnswer } from '../../lib/people/utilization'
import type { WeekDays } from '../../lib/people/weekAvailability'

vi.mock('../../utils/dateUtils', async (orig) => ({ ...(await orig<typeof import('../../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-11-25' }))
vi.mock('../people/AvailableHoursModal', () => ({ AvailableHoursModal: () => null }))

const SIX: WeekDays = [[], [[360, 720]], [[360, 720]], [[360, 720]], [[360, 720]], [[360, 720]], []]
const SEVEN: WeekDays = [[], [[420, 780]], [[420, 780]], [[420, 780]], [[420, 780]], [[420, 780]], []]
const row = (over: Partial<AvailableHoursAnswer>): AvailableHoursAnswer => ({ user_id: 'u-wes', hours_per_week: 30, days: SIX, effective_from: '2026-11-22', set_by: 'u-office', set_at: '2026-11-22T10:00:00Z', kind: 'set', ...over })
const io = (rows: AvailableHoursAnswer[]): AvailabilityIo => ({ kind: 'local', listAnswers: async () => rows, saveAnswer: async () => {} }) as unknown as AvailabilityIo
const mount = (rows: AvailableHoursAnswer[], asks = true) => renderWithProviders(<MyTimeCanWorkLine userId="u-wes" displayName="ZZ Test Wes" asks={asks} io={io(rows)} />)

describe('MyTimeCanWorkLine', () => {
  it('reads working hours with no press, and says who sets them', async () => {
    mount([row({})])
    await settle()
    const line = await screen.findByTestId('my-time-working-hours')
    expect(line.textContent).toBe('Your hours are 6:00 AM to 12:00 PM, Mon to Fri.The office sets these hours.')
    expect(line.querySelector('button')).toBeNull()
    expect(screen.queryByTestId('my-time-can-work')).toBeNull()
  })

  it('tells hours that start next Sunday beside the ones in force', async () => {
    mount([row({}), row({ days: SEVEN, effective_from: '2026-11-29', set_at: '2026-11-24T10:00:00Z' })], false)
    await settle()
    const coming = await screen.findByTestId('my-time-hours-coming')
    expect(coming.textContent).toBe('New from Sun Nov 297:00 AM to 1:00 PM, Mon to Fri.')
    expect(screen.getByTestId('my-time-working-hours').textContent).toContain('Your hours are 6:00 AM to 12:00 PM, Mon to Fri.')
  })

  it('with no working hours it asks, and a person who is not asked sees nothing', async () => {
    const asked = mount([])
    await settle()
    expect((await screen.findByTestId('my-time-can-work')).textContent).toContain('How many hours a week can you work?')
    asked.unmount()
    const { container } = mount([], false)
    await settle()
    expect(container.textContent).toBe('')
  })
})
