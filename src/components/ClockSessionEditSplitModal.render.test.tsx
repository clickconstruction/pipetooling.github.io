// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderSettled } from '../test/renderSmokeMocks'

// The signed-in role and the assistant hours window setting (weeks; null = no row).
const mockRole: { current: string } = { current: 'assistant' }
const windowWeeks: { current: number | null } = { current: 3 }
const insertMock = vi.fn()

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ role: mockRole.current, user: { id: 'me' } }) }))

vi.mock('../lib/supabase', () => {
  const builder = () => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'gte', 'lte', 'not', 'in', 'order']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: windowWeeks.current == null ? null : { value_num: windowWeeks.current }, error: null })
    b.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) => resolve({ data: [], error: null })
    return b
  }
  return {
    supabase: {
      from: (table: string) => {
        const b = builder()
        if (table === 'clock_sessions') {
          b.insert = (payload: unknown) => {
            insertMock(payload)
            return Promise.resolve({ data: null, error: null })
          }
        }
        return b
      },
      auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'me' } } } }) },
    },
  }
})

import { ClockSessionEditSplitModal } from './ClockSessionEditSplitModal'
import { assistantHoursWindowFloorYmd } from '../lib/people/assistantHoursWindow'
import { sessionDayWords } from '../lib/clock/sessionDayBounds'
import { todayYmdInAppTz, ymdAddDays } from '../utils/dateUtils'

const TODAY = todayYmdInAppTz()
const PEOPLE = [{ value: 'u-mike', label: 'Michael A' }]

async function mountCreate(props: { dayLocked?: boolean; people?: typeof PEOPLE; workDate?: string } = {}) {
  const onSaved = vi.fn()
  const onClose = vi.fn()
  await renderSettled(
    <ClockSessionEditSplitModal
      createFor={{ userId: props.people ? '' : 'u-mike', workDate: props.workDate ?? TODAY }}
      people={props.people}
      dayLocked={props.dayLocked}
      onClose={onClose}
      onSaved={onSaved}
    />,
    { loaded: () => screen.findByTestId('clock-create-day-note') },
  )
  return { onSaved, onClose }
}

describe('ClockSessionEditSplitModal — the days a session may be typed onto', () => {
  beforeEach(() => {
    insertMock.mockReset()
    mockRole.current = 'assistant'
    windowWeeks.current = 3
  })

  it('an assistant from the strip: a Day picker bounded by her window and today, and the line names the floor', async () => {
    await mountCreate({ people: PEOPLE })
    const floor = assistantHoursWindowFloorYmd(TODAY, 3)!
    const day = await waitFor(() => {
      const el = screen.getByLabelText('Day') as HTMLInputElement
      expect(el.min).toBe(floor)
      return el
    })
    expect(day.type).toBe('date')
    expect(day.max).toBe(TODAY)
    expect(day.value).toBe(TODAY)
    expect(screen.getByTestId('clock-create-day-note').textContent).toBe(`${sessionDayWords(floor)} through today. Ask the owner for earlier days.`)
    expect((screen.getByLabelText('Clocked in') as HTMLInputElement).type).toBe('time')
  })

  it('a day before the floor turns the line red and holds Save; the floor day itself is inside', async () => {
    await mountCreate({ people: PEOPLE })
    const floor = assistantHoursWindowFloorYmd(TODAY, 3)!
    await waitFor(() => expect((screen.getByLabelText('Day') as HTMLInputElement).min).toBe(floor))
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: ymdAddDays(floor, -1) } })
    expect(screen.getByTestId('clock-create-day-note').textContent).toBe(`${sessionDayWords(floor)} is the earliest day in your hours window. Ask the owner for earlier days.`)
    fireEvent.change(screen.getByLabelText('What are you working on?'), { target: { value: 'Friday the app would not clock him in' } })
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Day'), { target: { value: floor } })
    expect(screen.getByTestId('clock-create-day-note').textContent).toContain('through today')
  })

  it('a dev has no floor: any day through today', async () => {
    mockRole.current = 'dev'
    await mountCreate({ people: PEOPLE })
    const day = screen.getByLabelText('Day') as HTMLInputElement
    expect(day.min).toBe('')
    expect(day.max).toBe(TODAY)
    expect(screen.getByTestId('clock-create-day-note').textContent).toBe('Any day through today.')
  })

  it('a day-locked door: the day is in the title, there is no Day to pick, and the save lands on it', async () => {
    const locked = ymdAddDays(TODAY, -2)
    const { onSaved } = await mountCreate({ dayLocked: true, workDate: locked })
    expect(screen.getByRole('heading', { name: `Add clock session · ${sessionDayWords(locked)}` })).toBeTruthy()
    expect(screen.queryByLabelText('Day')).toBeNull()
    expect(screen.getByTestId('clock-create-day-note').textContent).toBe(`This session goes on ${sessionDayWords(locked)}.`)
    fireEvent.change(screen.getByLabelText('Clocked in'), { target: { value: '08:00' } })
    fireEvent.change(screen.getByLabelText('Clocked out'), { target: { value: '12:30' } })
    fireEvent.change(screen.getByLabelText('What are you working on?'), { target: { value: 'Rough-in at the Sink job' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1))
    const payload = insertMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.user_id).toBe('u-mike')
    expect(payload.work_date).toBe(locked)
    expect((new Date(String(payload.clocked_out_at)).getTime() - new Date(String(payload.clocked_in_at)).getTime()) / 3_600_000).toBe(4.5)
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('the edit form bounds its pickers the same way', async () => {
    await renderSettled(
      <ClockSessionEditSplitModal
        session={{
          id: 's1',
          user_id: 'u-mike',
          clocked_in_at: `${TODAY}T14:00:00.000Z`,
          clocked_out_at: `${TODAY}T18:00:00.000Z`,
          work_date: TODAY,
          notes: 'x',
          job_ledger_id: null,
          bid_id: null,
        }}
        onClose={vi.fn()}
      />,
      { loaded: () => screen.findByRole('heading', { name: 'Edit clock session' }) },
    )
    const floor = assistantHoursWindowFloorYmd(TODAY, 3)!
    await waitFor(() => expect((screen.getByLabelText('Clocked in') as HTMLInputElement).min).toBe(`${floor}T00:00`))
    expect((screen.getByLabelText('Clocked out') as HTMLInputElement).max).toBe(`${TODAY}T23:59`)
  })
})
