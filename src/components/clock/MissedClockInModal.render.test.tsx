// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'

// The person's own clock time for the two weeks the form covers, and what the form inserts.
const ownSessions: { current: Array<Record<string, unknown>> } = { current: [] }
const insertMock = vi.fn()

vi.mock('../../lib/supabase', () => {
  const builder = (rows: () => unknown[]) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'gte', 'lte', 'not', 'in', 'order']) b[m] = () => b
    b.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) => resolve({ data: rows(), error: null })
    return b
  }
  return {
    supabase: {
      from: (table: string) => {
        if (table === 'clock_sessions') {
          const b = builder(() => ownSessions.current) as Record<string, unknown>
          b.insert = (payload: unknown) => {
            insertMock(payload)
            return Promise.resolve({ data: null, error: null })
          }
          return b
        }
        return builder(() => [])
      },
    },
  }
})

import { MissedClockInModal } from './MissedClockInModal'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'

const YESTERDAY = ymdAddDays(todayYmdInAppTz(), -1)

async function mount(onClose = vi.fn(), onSaved = vi.fn()) {
  await renderSettled(<MissedClockInModal userId="me" onClose={onClose} onSaved={onSaved} />, {
    loaded: () => screen.findByTestId('missed-clock-on-the-day').then((el) => waitFor(() => expect(el.textContent).not.toContain('Checking'))),
  })
  return { onClose, onSaved }
}

function fill(day: string, inTime: string, outTime: string, reason: string) {
  fireEvent.change(screen.getByLabelText('Which day'), { target: { value: day } })
  fireEvent.change(screen.getByLabelText('Started'), { target: { value: inTime } })
  fireEvent.change(screen.getByLabelText('Stopped'), { target: { value: outTime } })
  fireEvent.change(screen.getByLabelText('What happened'), { target: { value: reason } })
}

describe('MissedClockInModal — a person reports a day the clock missed', () => {
  beforeEach(() => {
    insertMock.mockReset()
    ownSessions.current = []
  })

  it('sends the day as the person’s own session, with what happened as the note', async () => {
    const { onClose, onSaved } = await mount()
    fill(YESTERDAY, '10:00', '14:30', 'App would not let me clock in')
    expect(screen.getByTestId('missed-clock-summary').textContent).toContain('4.5h')
    expect(screen.getByTestId('missed-clock-summary').textContent).toContain('typed by you, 1 day late · no location')
    fireEvent.click(screen.getByRole('button', { name: 'Send to the office' }))
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1))
    const payload = insertMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.user_id).toBe('me')
    expect(payload.work_date).toBe(YESTERDAY)
    expect(payload.notes).toBe('Clock missed it — App would not let me clock in')
    expect(payload.job_ledger_id).toBeNull()
    expect((new Date(String(payload.clocked_out_at)).getTime() - new Date(String(payload.clocked_in_at)).getTime()) / 3_600_000).toBe(4.5)
    expect(payload).not.toHaveProperty('approved_at')
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })

  it('says why it cannot be sent, and sends nothing', async () => {
    await mount()
    fill(YESTERDAY, '10:00', '14:30', '')
    fireEvent.click(screen.getByRole('button', { name: 'Send to the office' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Say what happened')
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('shows what the clock already has for the day and refuses hours inside it', async () => {
    ownSessions.current = [
      { id: 's1', work_date: YESTERDAY, clocked_in_at: `${YESTERDAY}T14:00:00Z`, clocked_out_at: `${YESTERDAY}T18:00:00Z`, job_ledger_id: null, rejected_at: null },
    ]
    await mount()
    fireEvent.change(screen.getByLabelText('Which day'), { target: { value: YESTERDAY } })
    await waitFor(() => expect(screen.getByTestId('missed-clock-on-the-day').textContent).toContain('The clock already has:'))
    fill(YESTERDAY, '09:30', '11:00', 'Forgot to clock in')
    fireEvent.click(screen.getByRole('button', { name: 'Send to the office' }))
    expect((await screen.findByRole('alert')).textContent).toContain('already have clocked time')
    expect(insertMock).not.toHaveBeenCalled()
  })
})
