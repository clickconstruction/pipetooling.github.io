// @vitest-environment jsdom
/**
 * Render smoke for Jobs → Inspections with nothing on file (punch list #184, sweep C): Upcoming names
 * Add Inspection, Permit Portals names Edit Portals, and each Edit window names its own Add. Supabase is
 * stubbed empty, so every list is empty.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../AddInspectionModal', () => ({ default: ({ open }: { open: boolean }) => (open ? <div data-testid="add-inspection-stub" /> : null) }))

import JobsInspectionsTab from './JobsInspectionsTab'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

/** The press of that name inside an empty state: the page's own button of the same name sits beside it. */
const pressIn = (name: string) => screen.getAllByRole('button', { name }).find((b) => b.closest('[data-empty-state]')) as HTMLElement
const wordsOf = (press: HTMLElement) => (press.closest('[data-empty-state]') as HTMLElement).textContent

describe('JobsInspectionsTab · the empty lists (#184)', () => {
  it('Upcoming names Add Inspection, and the press opens it', async () => {
    renderWithProviders(<JobsInspectionsTab authUserId="u1" error={null} onError={() => {}} />)
    await settle()
    const add = pressIn('Add Inspection')
    expect(wordsOf(add)).toBe('Nothing booked in the next 14 days. Add Inspection books one.')
    fireEvent.click(add)
    expect(screen.getByTestId('add-inspection-stub')).toBeTruthy()
  })

  it('a day with nothing booked names Add Inspection, and the press swaps the day for it', async () => {
    renderWithProviders(<JobsInspectionsTab authUserId="u1" error={null} onError={() => {}} />)
    await settle()
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent === '15') as HTMLElement)
    const day = screen.getByRole('dialog')
    const add = within(day).getByRole('button', { name: 'Add Inspection' })
    expect(wordsOf(add)).toBe('Nothing is booked on this day. Add Inspection books one.')
    fireEvent.click(add)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('add-inspection-stub')).toBeTruthy()
  })

  it('Permit Portals names Edit Portals, whose window names Add portal', async () => {
    renderWithProviders(<JobsInspectionsTab authUserId="u1" error={null} onError={() => {}} />)
    await settle()
    const edit = pressIn('Edit Portals')
    expect(wordsOf(edit)).toBe('No permit portals yet. Edit Portals adds the first.')
    fireEvent.click(edit)
    await settle()
    const add = pressIn('Add portal')
    expect(wordsOf(add)).toBe('No portals yet. Add portal adds the first.')
    fireEvent.click(add)
    expect(screen.getByRole('heading', { name: 'Add portal' })).toBeTruthy()
  })

  it('the Inspection Types window names Add type', async () => {
    renderWithProviders(<JobsInspectionsTab authUserId="u1" error={null} onError={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Inspection Types' }))
    await settle()
    const add = pressIn('Add type')
    expect(wordsOf(add)).toBe('No inspection types yet. Add type adds the first.')
    fireEvent.click(add)
    expect(screen.getByRole('heading', { name: 'Add inspection type' })).toBeTruthy()
  })
})
