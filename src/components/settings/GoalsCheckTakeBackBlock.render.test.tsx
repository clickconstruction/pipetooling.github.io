// @vitest-environment jsdom
/**
 * Today's goals check (punch list #443, row 19): a dev reads whether their own account passed today's check and
 * takes that record back after a confirm that names the act, a check not passed has a dead press with its reason,
 * and nobody else sees the block. A made-up user id.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { GoalsCheckToday } from '../../lib/goalsCheckTakeBack'
import GoalsCheckTakeBackBlock from './GoalsCheckTakeBackBlock'

const io = vi.hoisted(() => ({
  today: null as unknown,
  reads: [] as Array<{ userId: string; days: string[] }>,
  taken: [] as Array<{ userId: string; days: string[] }>,
  readFails: false,
  refuse: null as null | Error,
}))
vi.mock('../../lib/goalsCheckTakeBackIo', () => ({
  readGoalsCheckToday: async (userId: string, days: string[]) => {
    io.reads.push({ userId, days: [...days] })
    if (io.readFails) throw new Error('The network dropped.')
    return io.today
  },
  takeGoalsCheckBack: async (userId: string, days: string[]) => {
    if (io.refuse) throw io.refuse
    io.taken.push({ userId, days: [...days] })
    io.today = { ...(io.today as GoalsCheckToday), acks: [] }
    return 1
  },
}))

const ME = 'user-zz-dev'
const DAY = '2026-11-26'
const NAME = /Today’s goals check \(dev\)/
const PRESS = 'Take today’s check back…'
const draw = (role: string, userId: string | null = ME) => renderWithProviders(<GoalsCheckTakeBackBlock role={role} userId={userId} />)
const open = async () => {
  fireEvent.click(screen.getByRole('button', { name: NAME }))
  await screen.findByTestId('goals-check-today')
}

beforeEach(() => {
  // Noon in Chicago on the day, so the company's day and the test machine's own day agree wherever CI runs.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-26T18:00:00Z') })
  io.today = { acks: [{ localDate: DAY, completedAtIso: '2026-11-26T15:14:00Z' }], goals: 3, sessions: 1 } satisfies GoalsCheckToday
  io.reads = []
  io.taken = []
  io.readFails = false
  io.refuse = null
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('GoalsCheckTakeBackBlock', () => {
  it('draws nothing for every role but a dev, and nothing with no signed-in person', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']) {
      draw(role)
      expect(screen.queryByTestId('goals-check-take-back')).toBeNull()
      cleanup()
    }
    draw('dev', null)
    expect(screen.queryByTestId('goals-check-take-back')).toBeNull()
    expect(io.reads).toEqual([])
  })

  it('opens folded and reads nothing until it is opened', async () => {
    draw('dev')
    expect(screen.queryByRole('button', { name: PRESS })).toBeNull()
    expect(io.reads).toEqual([])
    await open()
    expect(io.reads).toHaveLength(1)
    expect(io.reads[0]!.userId).toBe(ME)
    expect(io.reads[0]!.days).toContain(DAY)
  })

  it('draws the day’s facts one a line, each value apart from its label', async () => {
    draw('dev')
    await open()
    const facts = screen.getByTestId('goals-check-today')
    expect(facts.querySelector('[data-value-lines]')).toBeTruthy()
    const values = Array.from(facts.querySelectorAll('[data-value="worked-out"]')).map((el) => el.textContent)
    expect(values[0]).toContain('Thu, Nov 26')
    expect(values[1]).toBe('9:14 AM')
    expect(values.slice(2)).toEqual(['3', '1'])
    const why = screen.getByTestId('goals-check-why')
    expect(why.textContent).toBe('You have 1 clock session today, so the check asks again the next time the app loads.')
    expect(why.querySelector('[data-value="worked-out"]')?.textContent).toBe('1 clock session')
  })

  it('takes the check back after a confirm that names the act, then reads the day again', async () => {
    draw('dev')
    await open()
    fireEvent.click(screen.getByRole('button', { name: PRESS }))
    const yes = await screen.findByRole('button', { name: 'Take the check back' })
    expect(screen.getByText('Take today’s goals check back?')).toBeTruthy()
    expect(screen.getByText(/^This deletes your own record that you passed the check on Thu, Nov 26\. Your goals and your clock sessions stay\./)).toBeTruthy()
    expect(io.taken).toEqual([])
    fireEvent.click(yes)
    await waitFor(() => expect(io.taken).toHaveLength(1))
    expect(io.taken[0]!.userId).toBe(ME)
    expect(io.taken[0]!.days).toContain(DAY)
    expect(await screen.findByText('Today’s goals check was taken back.')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('goals-check-why').textContent).toBe('You have not passed today’s check, so there is nothing to take back.'))
    expect((screen.getByRole('button', { name: PRESS }) as HTMLButtonElement).disabled).toBe(true)
    expect(io.reads).toHaveLength(2)
  })

  it('takes nothing back when the confirm is cancelled', async () => {
    draw('dev')
    await open()
    fireEvent.click(screen.getByRole('button', { name: PRESS }))
    await screen.findByRole('button', { name: 'Take the check back' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Take the check back' })).toBeNull())
    expect(io.taken).toEqual([])
  })

  it('has a dead press with its reason when the check is not passed', async () => {
    io.today = { acks: [], goals: 3, sessions: 0 } satisfies GoalsCheckToday
    draw('dev')
    await open()
    expect((screen.getByRole('button', { name: PRESS }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('goals-check-why').textContent).toBe('You have not passed today’s check, so there is nothing to take back.')
    const values = Array.from(screen.getByTestId('goals-check-today').querySelectorAll('[data-value="worked-out"]')).map((el) => el.textContent)
    expect(values[1]).toBe('not yet')
  })

  it('says the first clock in when no session stands today, and that an account with no goals is never asked', async () => {
    io.today = { acks: [{ localDate: DAY, completedAtIso: null }], goals: 2, sessions: 0 } satisfies GoalsCheckToday
    draw('dev')
    await open()
    expect(screen.getByTestId('goals-check-why').textContent).toBe('You have no clock session today, so the check asks again after your first clock in.')
    cleanup()
    io.today = { acks: [{ localDate: DAY, completedAtIso: null }], goals: 0, sessions: 0 } satisfies GoalsCheckToday
    draw('dev')
    await open()
    expect(screen.getByTestId('goals-check-why').textContent).toBe('You have no goals, so the check does not ask.')
  })

  it('says the reason when the read fails, keeps the press dead, and reads again on Read again', async () => {
    io.readFails = true
    draw('dev')
    fireEvent.click(screen.getByRole('button', { name: NAME }))
    expect((await screen.findByTestId('goals-check-read-why')).textContent).toBe('The network dropped.')
    expect((screen.getByRole('button', { name: PRESS }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByTestId('goals-check-today')).toBeNull()
    io.readFails = false
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    await screen.findByTestId('goals-check-today')
    expect(screen.queryByTestId('goals-check-read-why')).toBeNull()
    expect((screen.getByRole('button', { name: PRESS }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('says the reason when the take-back is refused, and the record stays', async () => {
    io.refuse = new Error('The check was not taken back. Its record may be gone already. Read it again.')
    draw('dev')
    await open()
    fireEvent.click(screen.getByRole('button', { name: PRESS }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take the check back' }))
    expect(await screen.findByText('The check was not taken back. Its record may be gone already. Read it again.')).toBeTruthy()
    expect(io.taken).toEqual([])
    await waitFor(() => expect((screen.getByRole('button', { name: PRESS }) as HTMLButtonElement).disabled).toBe(false))
  })
})
