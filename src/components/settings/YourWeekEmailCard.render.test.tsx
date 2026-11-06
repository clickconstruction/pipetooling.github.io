// @vitest-environment jsdom
/**
 * The Monday email's card (punch list #255, v2.6607): a dev turns it on after a confirm and off at once; Preview mine
 * shows the caller's own email and who hears it on Monday; a person with no card reads why; an assistant reads the
 * switch and presses nothing on it; a refused flip names its reason.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WeekEmailIo } from '../../lib/techWeek/weekEmailIo'

const auth = vi.hoisted(() => ({ role: 'dev' as string, readOnly: false }))
const confirmAnswer = vi.hoisted(() => ({ yes: true }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: auth.role, readOnly: auth.readOnly, user: { id: 'viewer' } }) }))
vi.mock('../../contexts/ConfirmDialogContext', () => ({ useConfirmDialog: () => async () => confirmAnswer.yes }))
vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: vi.fn() }) }))

import { YourWeekEmailCard } from './YourWeekEmailCard'

function ioWith(on: boolean, mine: { subject: string; text: string; html: string } | null, fail?: string): WeekEmailIo & { setOn: ReturnType<typeof vi.fn> } {
  return {
    load: vi.fn(async () => ({ on, lastRun: null })),
    setOn: vi.fn(async () => {
      if (fail) throw new Error(fail)
    }),
    previewMine: vi.fn(async () => ({ mine, to: [{ name: 'Marcus Lee', email: 'm@x' }, { name: '', email: 'j@x' }] })),
    testMine: vi.fn(async () => 'me@x'),
  }
}

afterEach(() => {
  cleanup()
  auth.role = 'dev'
  auth.readOnly = false
  confirmAnswer.yes = true
})

describe('YourWeekEmailCard', () => {
  it('a dev turns it on after the confirm, and off at once', async () => {
    const io = ioWith(false, null)
    render(<YourWeekEmailCard io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn it on' }))
    await waitFor(() => expect(io.setOn).toHaveBeenCalledWith(true))
    expect(await screen.findByText('On. Goes out Monday at 6 AM Central.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Turn it off' }))
    await waitFor(() => expect(io.setOn).toHaveBeenCalledWith(false))
  })

  it('a declined confirm changes nothing', async () => {
    confirmAnswer.yes = false
    const io = ioWith(false, null)
    render(<YourWeekEmailCard io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn it on' }))
    await new Promise((r) => setTimeout(r, 20))
    expect(io.setOn).not.toHaveBeenCalled()
  })

  it('Preview mine shows the caller’s own email and who hears it; no card reads why', async () => {
    render(<YourWeekEmailCard io={ioWith(true, { subject: 'Your week, Nov 1 to Nov 7: 29 of your last 30 jobs', text: 'Marcus, here is your week.', html: '' })} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Preview mine' }))
    expect(await screen.findByText('Your week, Nov 1 to Nov 7: 29 of your last 30 jobs')).toBeTruthy()
    expect(screen.getByText(/Monday it goes to 2 people: Marcus Lee, j@x/)).toBeTruthy()
    cleanup()
    render(<YourWeekEmailCard io={ioWith(true, null)} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Preview mine' }))
    expect(await screen.findByText(/No card for you yet/)).toBeTruthy()
  })

  it('an assistant reads the switch with no press on it, and a refused flip names its reason', async () => {
    auth.role = 'assistant'
    render(<YourWeekEmailCard io={ioWith(false, null)} />)
    expect(await screen.findByText('Off. Nothing goes out.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Turn it on' })).toBeNull()
    cleanup()
    auth.role = 'dev'
    render(<YourWeekEmailCard io={ioWith(false, null, 'The switch did not change. Only a dev can turn the Monday email on or off.')} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn it on' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Only a dev can turn the Monday email on or off.')
  })
})
