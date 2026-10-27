// @vitest-environment jsdom
/**
 * Render smokes for Settings → What customers see → Customer page (Messages, cut 8d): the switches on each job on a
 * customer's portal, saved as they change; every sentence of ours by where it shows, found by its words, changed in
 * both languages with its blanks kept; and the same block read only for a training account. The reads and the writes
 * are mocked at the loader.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

const auth = vi.hoisted(() => ({ role: 'assistant', readOnly: false }))

vi.mock('../../lib/supabase', async () => ({ supabase: (await import('../../test/renderSmokeMocks')).makeSupabaseStub() }))
vi.mock('../../hooks/useAuth', async () => {
  const m = await import('../../test/renderSmokeMocks')
  return { ...m.useAuthModuleMock(), useAuth: () => ({ ...m.makeUseAuthValue({ role: auth.role }), readOnly: auth.readOnly }) }
})
vi.mock('../../lib/portal/customerPageWordsIo', () => ({
  loadSavedWords: vi.fn(),
  saveWord: vi.fn(),
  loadPortalSwitchJobs: vi.fn(),
  setPortalSwitch: vi.fn(),
}))

import { loadPortalSwitchJobs, loadSavedWords, saveWord, setPortalSwitch } from '../../lib/portal/customerPageWordsIo'
import { customerPageWordRows } from '../../lib/portal/pageWords'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SettingsCustomerPageBlock } from './SettingsCustomerPageBlock'

const JOBS = [
  { projectId: 'p-dental', name: 'Sample Dental Office', stage: 'building', photos: false, forecast: false, spanish: false },
  { projectId: 'p-shell', name: 'Sample Retail Shell', stage: 'buyout', photos: true, forecast: false, spanish: false },
]
const SAVED = customerPageWordRows().map((r) => ({ key: r.key, en: r.en, es: r.es, editedAt: null, editedBy: null }))

beforeEach(() => {
  auth.role = 'assistant'
  auth.readOnly = false
  vi.mocked(loadPortalSwitchJobs).mockReset().mockResolvedValue(JOBS)
  vi.mocked(loadSavedWords).mockReset().mockResolvedValue(SAVED)
  vi.mocked(saveWord).mockReset()
  vi.mocked(setPortalSwitch).mockReset().mockResolvedValue(undefined)
})

async function open() {
  renderWithProviders(<SettingsCustomerPageBlock />)
  await screen.findByRole('checkbox', { name: 'Photos on Sample Dental Office' })
  await screen.findByRole('searchbox', { name: 'Find a sentence' })
}

describe('Settings → Customer page', () => {
  it('turns a switch on a job and keeps it on', async () => {
    await open()
    const photos = screen.getByRole('checkbox', { name: 'Photos on Sample Dental Office' }) as HTMLInputElement
    expect(photos.checked).toBe(false)
    expect((screen.getByRole('checkbox', { name: 'Photos on Sample Retail Shell' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(photos)
    await waitFor(() => expect(setPortalSwitch).toHaveBeenCalledWith('p-dental', 'photos', true))
    await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Photos on Sample Dental Office' }) as HTMLInputElement).checked).toBe(true))
  })

  it('with no job on a portal it links to GC projects, and a find with no match clears', async () => {
    vi.mocked(loadPortalSwitchJobs).mockResolvedValue([])
    renderWithProviders(<SettingsCustomerPageBlock />)
    const link = await screen.findByRole('link', { name: 'GC projects' })
    expect(link.getAttribute('href')).toBe('/gc')
    expect(link.closest('[data-empty-state]')?.textContent).toBe('No job is on a customer’s portal yet. A GC job joins it at buyout. GC projects lists every GC job.')
    const find = await screen.findByRole('searchbox', { name: 'Find a sentence' })
    fireEvent.change(find, { target: { value: 'zzzz' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Clear the search' }))
    expect((find as HTMLInputElement).value).toBe('')
  })

  it('finds a sentence by its words and changes it in both languages', async () => {
    vi.mocked(saveWord).mockResolvedValue({ key: 'weAreOn', en: 'Right now we are on {step}.', es: 'Ahora estamos en {step}.', editedAt: '2026-10-12T15:00:00Z', editedBy: 'Rosa' })
    await open()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a sentence' }), { target: { value: 'we are on' } })
    const steps = within(await screen.findByRole('list', { name: 'The page and Home' }))
    fireEvent.click(steps.getByRole('button', { name: 'Edit: We are on {step}.' }))
    const english = screen.getByRole('textbox', { name: 'English' })
    fireEvent.change(english, { target: { value: 'Right now we are on it.' } })
    expect(screen.getByRole('alert').textContent).toBe('The English keeps {step} as written. The page fills it in.')
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(english, { target: { value: 'Right now we are on {step}.' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Spanish' }), { target: { value: 'Ahora estamos en {step}.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveWord).toHaveBeenCalledWith('weAreOn', 'Right now we are on {step}.', 'Ahora estamos en {step}.'))
    expect(await screen.findByText('Right now we are on {step}.')).toBeTruthy()
    expect(screen.getByText(/^Changed by Rosa/)).toBeTruthy()
    expect(screen.getByText(/As we shipped it: We are on \{step\}\./)).toBeTruthy()
  })

  it('reads only, for a training account', async () => {
    auth.readOnly = true
    await open()
    expect(screen.getByText('A training account reads these. Nothing here changes.')).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: 'Spanish on Sample Dental Office' }) as HTMLInputElement).disabled).toBe(true)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a sentence' }), { target: { value: 'we are on' } })
    expect(within(await screen.findByRole('list', { name: 'The page and Home' })).queryByRole('button', { name: /^Edit/ })).toBeNull()
  })
})
