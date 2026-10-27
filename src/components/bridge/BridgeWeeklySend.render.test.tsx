// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeWeeklySend } from './BridgeWeeklySend'
import { WEEKLY_SEND_CONFIRM } from '../../lib/bridge/weeklySend'
import type { WeeklySendIo } from '../../lib/bridge/weeklySendIo'

const fakeIo = (on: boolean, lastRun: Awaited<ReturnType<WeeklySendIo['load']>>['lastRun'] = null): WeeklySendIo & { setOn: ReturnType<typeof vi.fn> } => ({
  load: async () => ({ on, lastRun }),
  setOn: vi.fn(async () => {}),
})

describe('BridgeWeeklySend', () => {
  it('reads the switch and the last run', async () => {
    renderWithProviders(<BridgeWeeklySend io={fakeIo(true, { at: '', day: '2026-10-19', dry: false, sent: ['a@x.com', 'b@x.com'], failed: [], gaps: [], subject: '' })} />)
    expect((await screen.findByRole('switch', { name: 'Weekly email' })).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('bridge-weekly-send-state').textContent).toContain('On: the sheet goes to every dev on Monday at 6 AM Central. Last sent Oct 19 to 2 people.')
  })

  it('off: says so, and that the button still works', async () => {
    renderWithProviders(<BridgeWeeklySend io={fakeIo(false)} />)
    expect((await screen.findByRole('switch', { name: 'Weekly email' })).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByTestId('bridge-weekly-send-state').textContent).toContain('Off: nothing goes out on Monday. Email me this sheet still works. Not sent yet.')
  })

  it('turning it on asks first; cancel changes nothing, confirm writes true', async () => {
    const io = fakeIo(false)
    renderWithProviders(<BridgeWeeklySend io={io} />)
    const toggle = await screen.findByRole('switch', { name: 'Weekly email' })
    fireEvent.click(toggle)
    const ask = await screen.findByRole('alertdialog')
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    expect(io.setOn).not.toHaveBeenCalled()
    fireEvent.click(toggle)
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: WEEKLY_SEND_CONFIRM.confirmLabel }))
    await waitFor(() => expect(io.setOn).toHaveBeenCalledWith(true))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Weekly email' }).getAttribute('aria-checked')).toBe('true'))
  })

  it('turning it off asks nothing', async () => {
    const io = fakeIo(true)
    renderWithProviders(<BridgeWeeklySend io={io} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Weekly email' }))
    await waitFor(() => expect(io.setOn).toHaveBeenCalledWith(false))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
