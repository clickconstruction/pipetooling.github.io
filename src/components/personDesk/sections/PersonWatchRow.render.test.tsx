// @vitest-environment jsdom
/**
 * Render smoke for the Person desk's watch control: no watch offers the press with its reason and the
 * list, turning it on shows who set it and when, stopping needs a reason, and a refusal is said in
 * the database's own words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import type { PersonWatch } from '../../../lib/people/personWatchIo'
import PersonWatchRow from './PersonWatchRow'

afterEach(() => cleanup())

const live: PersonWatch = { id: 'w1', userId: 'u-sam', why: 'back on site alone', tellUserIds: ['u-dana'], setByName: 'Dana K.', setAt: '2026-11-18T12:00:00' }

function io(over: Partial<{ read: () => Promise<PersonWatch | null>; set: () => Promise<PersonWatch>; lift: () => Promise<void> }> = {}) {
  return {
    read: vi.fn(over.read ?? (async () => null)),
    set: vi.fn(over.set ?? (async () => live)),
    lift: vi.fn(over.lift ?? (async () => {})),
  }
}

describe('PersonWatchRow', () => {
  it('offers the watch with its reason and the list, and turns it on', async () => {
    const calls = io()
    renderWithProviders(<PersonWatchRow userId="u-sam" name="Sam" viewerUserId="u-dana" io={calls} />)
    const press = await screen.findByRole('button', { name: 'Turn on the watch' })
    expect(screen.getByText(/It changes nothing Sam may do and nothing Sam sees\./)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Why the watch is on'), { target: { value: ' back on site alone ' } })
    fireEvent.click(press)
    await waitFor(() => expect(calls.set).toHaveBeenCalledWith('u-sam', ' back on site alone ', ['u-dana']))
    expect(await screen.findByText(/Watched since/)).toBeTruthy()
    expect(screen.getByTestId('person-watch').textContent).toContain('set by Dana K.')
    expect(screen.getByTestId('person-watch').textContent).toContain('tells you')
  })

  it('leaves the viewer off the list when the box is cleared', async () => {
    const calls = io()
    renderWithProviders(<PersonWatchRow userId="u-sam" name="Sam" viewerUserId="u-dana" io={calls} />)
    fireEvent.click(await screen.findByLabelText('Tell me when they press'))
    fireEvent.click(screen.getByRole('button', { name: 'Turn on the watch' }))
    await waitFor(() => expect(calls.set).toHaveBeenCalledWith('u-sam', '', []))
  })

  it('stops a watch only with a reason', async () => {
    const calls = io({ read: async () => live })
    renderWithProviders(<PersonWatchRow userId="u-sam" name="Sam" viewerUserId="u-dana" io={calls} />)
    const stop = (await screen.findByRole('button', { name: 'Stop watching' })) as HTMLButtonElement
    expect(stop.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why the watch stops'), { target: { value: 'the job is done' } })
    fireEvent.click(stop)
    await waitFor(() => expect(calls.lift).toHaveBeenCalledWith('w1', 'the job is done'))
    expect(await screen.findByRole('button', { name: 'Turn on the watch' })).toBeTruthy()
  })

  it('says the database’s reason when the watch is refused', async () => {
    const calls = io({
      set: async () => {
        throw { message: 'new row violates row-level security policy for table "person_watches"' }
      },
    })
    renderWithProviders(<PersonWatchRow userId="u-sam" name="Sam" viewerUserId={null} io={calls} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on the watch' }))
    expect((await screen.findByRole('alert')).textContent).toContain('row-level security')
    expect(screen.getByRole('button', { name: 'Turn on the watch' })).toBeTruthy()
  })
})
