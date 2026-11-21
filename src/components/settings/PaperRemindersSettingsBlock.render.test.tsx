// @vitest-environment jsdom
/**
 * Settings → People & teams → Paper reminders by email (punch list #376): the one switch for all. It reads off as
 * shipped, asks before it is turned on, saves what was picked, and says why when the save is refused.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import PaperRemindersSettingsBlock from './PaperRemindersSettingsBlock'

const io = vi.hoisted(() => ({ on: false, writes: [] as boolean[], fail: null as null | Error }))
vi.mock('../../lib/contracts/personPaperReminderIo', () => ({
  readPaperRemindersSwitch: async () => io.on,
  writePaperRemindersSwitch: async (next: boolean) => {
    io.writes.push(next)
    if (io.fail) throw io.fail
  },
}))

beforeEach(() => {
  io.on = false
  io.writes = []
  io.fail = null
})
afterEach(() => cleanup())

const state = () => screen.getByTestId('paper-reminders-state').textContent

describe('PaperRemindersSettingsBlock', () => {
  it('reads off as shipped, and says what a reminder is', async () => {
    renderWithProviders(<PaperRemindersSettingsBlock />)
    await waitFor(() => expect(state()).toBe('Reminders are off.'))
    expect(screen.getByTestId('paper-reminders-settings').textContent).toContain('up to 3 reminders by email, 3 days apart')
    expect(screen.getByTestId('paper-reminders-settings').textContent).toContain('Only a paper sent after this is turned on is reminded.')
  })

  it('asks before it turns on, and Cancel saves nothing', async () => {
    renderWithProviders(<PaperRemindersSettingsBlock />)
    await waitFor(() => expect(state()).toBe('Reminders are off.'))
    fireEvent.click(screen.getByRole('button', { name: 'Turn reminders on' }))
    expect(await screen.findByText(/Papers already out are not reminded\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByText(/Papers already out are not reminded\./)).toBeNull())
    expect(io.writes).toEqual([])
    expect(state()).toBe('Reminders are off.')
  })

  it('turns on once confirmed', async () => {
    renderWithProviders(<PaperRemindersSettingsBlock />)
    await waitFor(() => expect(state()).toBe('Reminders are off.'))
    fireEvent.click(screen.getByRole('button', { name: 'Turn reminders on' }))
    await screen.findByText(/Papers already out are not reminded\./)
    const confirms = screen.getAllByRole('button', { name: 'Turn reminders on' })
    fireEvent.click(confirms[confirms.length - 1]!)
    await waitFor(() => expect(io.writes).toEqual([true]))
    await waitFor(() => expect(state()).toBe('Reminders are on.'))
  })

  it('turns off at once, with no question', async () => {
    io.on = true
    renderWithProviders(<PaperRemindersSettingsBlock />)
    await waitFor(() => expect(state()).toBe('Reminders are on.'))
    fireEvent.click(screen.getByRole('button', { name: 'Turn reminders off' }))
    await waitFor(() => expect(io.writes).toEqual([false]))
    await waitFor(() => expect(state()).toBe('Reminders are off.'))
  })

  it('says why when the save is refused, and stays as it was', async () => {
    io.on = true
    io.fail = new Error('The switch was not saved. Only the owner and a dev may change it.')
    renderWithProviders(<PaperRemindersSettingsBlock />)
    await waitFor(() => expect(state()).toBe('Reminders are on.'))
    fireEvent.click(screen.getByRole('button', { name: 'Turn reminders off' }))
    expect(await screen.findByText('The switch was not saved. Only the owner and a dev may change it.')).toBeTruthy()
    expect(state()).toBe('Reminders are on.')
  })
})
