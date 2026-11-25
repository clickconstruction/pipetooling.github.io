// @vitest-environment jsdom
/**
 * The gear menu's Hard Reload over typed words (v2.8513, punch list #85): the press is asked first, the place
 * that holds the words is ringed, and nothing reloads until Reload anyway.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'master_technician', profileName: 'Sample leader' })
})
const hardReloadFromRoot = vi.hoisted(() => vi.fn())
vi.mock('../lib/hardReload', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/hardReload')>()), hardReloadFromRoot }))

import Layout from './Layout'
import { ReloadOverWordsBar } from './ReloadOverWordsBar'
import { ThemeProvider } from '../contexts/ThemeContext'
import { DailyGoalsGateProvider } from '../contexts/DailyGoalsGateContext'
import { PersonDeskProvider } from '../contexts/PersonDeskContext'
import { __resetReloadAskForTests } from '../lib/reloadOverWords'
import { __forgetTypedTextForTests } from '../lib/typedText'
import { TYPED_SHOWN_ATTR } from '../lib/typedTextTour'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'

/** The app's shell with a page that has a note box on it, the gear menu open. */
async function openGearMenu(note: string) {
  renderWithProviders(
    <ThemeProvider>
      <DailyGoalsGateProvider>
        <PersonDeskProvider>
          <ReloadOverWordsBar />
          <Routes>
            <Route element={<Layout />}>
              <Route path="*" element={<textarea data-testid="note" aria-label="Note to the customer" defaultValue={note} />} />
            </Route>
          </Routes>
        </PersonDeskProvider>
      </DailyGoalsGateProvider>
    </ThemeProvider>,
    { route: '/dashboard' },
  )
  await settle()
  const box = (await screen.findByTestId('note')) as HTMLTextAreaElement
  // jsdom lays nothing out: the box is given a place on the screen.
  box.getBoundingClientRect = () => ({ top: 300, bottom: 360, left: 10, right: 310, width: 300, height: 60, x: 10, y: 300, toJSON: () => ({}) })
  fireEvent.click(screen.getByTitle('Settings'))
  return box
}

describe('Layout: Hard Reload over typed words', () => {
  beforeEach(() => {
    localStorage.clear()
    hardReloadFromRoot.mockClear()
    __resetReloadAskForTests()
    __forgetTypedTextForTests()
    // Noon: the gear menu's Dark Mode row follows the clock (see Layout.gearSwitches.render.test.tsx).
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0, 0))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    localStorage.clear()
  })

  it('with nothing typed, Hard Reload reloads at once, as it always did', async () => {
    await openGearMenu('')
    fireEvent.click(screen.getByRole('button', { name: 'Hard Reload' }))
    expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Reloading clears what you typed.')).toBeNull()
  })

  it('says Reloading… over the whole page from the press, since the reload can wait three seconds on the wipe (punch list #406)', async () => {
    await openGearMenu('')
    expect(screen.queryByTestId('reloading-screen')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hard Reload' }))
    // The reload is a stub here and never leaves: the words are up while the page is still here.
    const cover = screen.getByTestId('reloading-screen')
    expect(cover.textContent).toBe('Reloading…')
    expect(cover.getAttribute('role')).toBe('status')
    expect(cover.parentElement).toBe(document.body)
    expect(cover.style.position).toBe('fixed')
    expect(parseFloat(cover.style.inset)).toBe(0)
    expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
  })

  it('with a note typed, Hard Reload reloads nothing: the note is ringed, and Reload anyway reloads once it was shown', async () => {
    const note = await openGearMenu('We can start Monday. Call me first.')
    fireEvent.click(screen.getByRole('button', { name: 'Hard Reload' }))
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
    expect(screen.getByText('Reloading clears what you typed.')).toBeTruthy()
    // Asked, not reloading: the page is not covered while the person decides.
    expect(screen.queryByTestId('reloading-screen')).toBeNull()
    expect(note.hasAttribute(TYPED_SHOWN_ATTR)).toBe(true)
    // The menu has closed: the page is what the person is shown.
    expect(screen.queryByRole('button', { name: 'Hard Reload' })).toBeNull()
    const anyway = screen.getByRole('button', { name: 'Reload anyway' })
    expect(anyway.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(anyway)
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
    await waitFor(() => expect(anyway.getAttribute('aria-disabled')).toBeNull(), { timeout: 3000 })
    expect(note.hasAttribute(TYPED_SHOWN_ATTR)).toBe(false)
    expect(note.value).toBe('We can start Monday. Call me first.')
    fireEvent.click(anyway)
    expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('reloading-screen').textContent).toBe('Reloading…')
  })

  it('Not now keeps the note, and nothing reloads', async () => {
    const note = await openGearMenu('Report: rough-in passed.')
    fireEvent.click(screen.getByRole('button', { name: 'Hard Reload' }))
    const anyway = screen.getByRole('button', { name: 'Reload anyway' })
    await waitFor(() => expect(anyway.getAttribute('aria-disabled')).toBeNull(), { timeout: 3000 })
    // The clock here is held at noon. The bar ignores a press right behind the one that raised it, so the clock is moved on.
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0, 5))
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText('Reloading clears what you typed.')).toBeNull()
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
    expect(screen.queryByTestId('reloading-screen')).toBeNull()
    expect(note.value).toBe('Report: rough-in passed.')
  })
})
