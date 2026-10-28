// @vitest-environment jsdom
/**
 * Push me (punch list #141 PR 2) over a fake io: a person with hours sees them picked and read back, a day press lights
 * Save my hours and the save writes the row; a person with no row sees any time, and picking the hours saves the
 * default window at once; any time removes the row; To before From stops a save with the words.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parsePushHours } from '../../lib/messages/pushHours'
import type { PushHoursIo } from '../../lib/messages/pushHoursIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { PushHoursBlock } from './PushHoursBlock'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const WEEKDAYS = parsePushHours({ days: [1, 2, 3, 4, 5], opens: '06:00', closes: '20:00' })

function fakeIo(row: ReturnType<typeof parsePushHours>): PushHoursIo & { save: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> } {
  return {
    load: vi.fn(async () => row),
    save: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  }
}

afterEach(cleanup)

describe('PushHoursBlock', () => {
  it('shows the hours picked and read back, and a day press saves the row', async () => {
    const io = fakeIo(WEEKDAYS)
    renderWithProviders(<PushHoursBlock userId="u-rosa" io={io} />)
    const only = (await screen.findByLabelText('Push me only at these hours')) as HTMLInputElement
    await waitFor(() => expect(only.checked).toBe(true))
    expect(screen.getByText('Pushed Mon to Fri, 6:00 AM to 8:00 PM.')).toBeTruthy()
    const save = screen.getByRole('button', { name: 'Save my hours' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.click(within(screen.getByRole('group', { name: 'Days' })).getByRole('button', { name: 'Saturday' }))
    expect(screen.getByText('Pushed Mon to Sat, 6:00 AM to 8:00 PM.')).toBeTruthy()
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(io.save).toHaveBeenCalledWith('u-rosa', expect.objectContaining({ days: [1, 2, 3, 4, 5, 6], opens: '06:00', closes: '20:00' })))
    expect(await screen.findByText('Pushed Mon to Sat, 6:00 AM to 8:00 PM.', { selector: '[data-push-hours-line]' })).toBeTruthy()
  })

  it('shows any time for a person with no row, and picking the hours saves the default window at once', async () => {
    const io = fakeIo(null)
    renderWithProviders(<PushHoursBlock userId="u-luis" io={io} />)
    const any = (await screen.findByLabelText('Push me any time')) as HTMLInputElement
    await waitFor(() => expect(any.checked).toBe(true))
    expect(screen.queryByRole('group', { name: 'Days' })).toBeNull()
    fireEvent.click(screen.getByLabelText('Push me only at these hours'))
    await waitFor(() => expect(io.save).toHaveBeenCalledWith('u-luis', expect.objectContaining({ days: [0, 1, 2, 3, 4, 5, 6], opens: '06:00', closes: '20:00' })))
    expect(await screen.findByText('Pushed every day, 6:00 AM to 8:00 PM.', { selector: '[data-push-hours-line]' })).toBeTruthy()
    expect(screen.getByText(/^A push outside these hours waits for you\./)).toBeTruthy()
  })

  it('removes the row for any time and folds the fields away', async () => {
    const io = fakeIo(WEEKDAYS)
    renderWithProviders(<PushHoursBlock userId="u-rosa" io={io} />)
    await screen.findByText('Pushed Mon to Fri, 6:00 AM to 8:00 PM.')
    fireEvent.click(screen.getByLabelText('Push me any time'))
    await waitFor(() => expect(io.clear).toHaveBeenCalledWith('u-rosa'))
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Days' })).toBeNull())
    expect((screen.getByLabelText('Push me any time') as HTMLInputElement).checked).toBe(true)
  })

  it('stops a save when To is before From, with the words, and Put them back undoes it', async () => {
    const io = fakeIo(WEEKDAYS)
    renderWithProviders(<PushHoursBlock userId="u-rosa" io={io} />)
    await screen.findByText('Pushed Mon to Fri, 6:00 AM to 8:00 PM.')
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '20:00' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '06:00' } })
    expect(screen.getByText('To must come after From.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save my hours' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Put them back' }))
    expect(screen.getByText('Pushed Mon to Fri, 6:00 AM to 8:00 PM.')).toBeTruthy()
    expect(io.save).not.toHaveBeenCalled()
  })
})
