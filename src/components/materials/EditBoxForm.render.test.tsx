// @vitest-environment jsdom
/**
 * Render smoke for Edit a box (v2.7179): the form opens on the box as it is with a dead press, names the act as the
 * name changes, says what happens to a printed label, refuses a taken name in words, and sends only what changed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container, Place } from '../../lib/materials/onSite'

const editContainer = vi.fn()
const moveContainer = vi.fn()
const addPlace = vi.fn((_: { jobId: string; name: string; byUserId?: string | null }) => ({ id: 'p-new' }))
vi.mock('../../lib/materials/onSiteStore', () => ({
  editContainer: (...a: unknown[]) => editContainer(...a),
  moveContainer: (...a: unknown[]) => moveContainer(...a),
  addPlace: (a: { jobId: string; name: string; byUserId?: string | null }) => addPlace(a),
}))

import EditBoxForm from './EditBoxForm'

afterEach(() => { cleanup(); editContainer.mockReset(); moveContainer.mockReset(); addPlace.mockClear() })

const box = (over: Partial<Container> = {}): Container => ({ id: 'c1', jobId: 'j1', label: 'R70 NO CONTAINER', kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T12:00:00Z', ...over })
const site = [box({ locationId: 'p1' }), box({ id: 'c2', label: 'R71' })]
const places: Place[] = [{ id: 'p1', jobId: 'j1', name: 'Arena', createdAt: '' }, { id: 'p2', jobId: 'j1', name: 'Yard', createdAt: '' }]
const who = { places, byName: 'Dana', byUserId: 'u1' }

describe('EditBoxForm', () => {
  it('opens on the box as it is, with a press that does nothing yet', () => {
    renderWithProviders(<EditBoxForm container={site[0]!} containers={site} {...who} onSaved={() => {}} />)
    expect((screen.getByLabelText('Its name') as HTMLInputElement).value).toBe('R70 NO CONTAINER')
    expect(screen.getByRole('button', { name: 'Cage' }).getAttribute('aria-pressed')).toBe('true')
    const press = screen.getByRole('button', { name: 'Save R70 NO CONTAINER' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(screen.queryByTestId('edit-box-label-note')).toBeNull()
  })

  it('renames, changes the kind and the where line, and sends only what changed', () => {
    const onSaved = vi.fn()
    renderWithProviders(<EditBoxForm container={site[0]!} containers={site} {...who} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText('Its name'), { target: { value: 'r70' } })
    expect(screen.getByTestId('edit-box-label-note').textContent).toBe('A label printed as R70 NO CONTAINER still opens this box. Print it again to show the new name.')
    fireEvent.click(screen.getByRole('button', { name: 'Loose pile' }))
    fireEvent.change(screen.getByLabelText('Where exactly'), { target: { value: ' on a pallet ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename to R70' }))
    expect(editContainer).toHaveBeenCalledWith('c1', { label: 'R70', kind: 'loose', where: 'on a pallet' })
    expect(moveContainer).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledWith('R70 NO CONTAINER is now R70. Its printed label still opens it.')
  })

  it('opens on the box’s place and moves it to a picked one, with nothing else sent (v2.7199)', () => {
    const onSaved = vi.fn()
    renderWithProviders(<EditBoxForm container={site[0]!} containers={site} {...who} onSaved={onSaved} />)
    expect(screen.getByRole('button', { name: 'Arena' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Yard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save R70 NO CONTAINER' }))
    expect(editContainer).toHaveBeenCalledWith('c1', {})
    expect(moveContainer).toHaveBeenCalledWith('c1', 'p2', 'Dana', 'u1')
    expect(onSaved).toHaveBeenCalledWith('R70 NO CONTAINER moved to Yard.')
  })

  it('makes a typed place and moves the box there along with a rename', () => {
    const onSaved = vi.fn()
    renderWithProviders(<EditBoxForm container={site[0]!} containers={site} {...who} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText('Its name'), { target: { value: 'r70' } })
    fireEvent.change(screen.getByLabelText('A new place'), { target: { value: ' Laydown yard ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename to R70' }))
    expect(editContainer).toHaveBeenCalledWith('c1', { label: 'R70' })
    expect(addPlace).toHaveBeenCalledWith({ jobId: 'j1', name: 'Laydown yard', byUserId: 'u1' })
    expect(moveContainer).toHaveBeenCalledWith('c1', 'p-new', 'Dana', 'u1')
    expect(onSaved).toHaveBeenCalledWith('R70 NO CONTAINER is now R70. Its printed label still opens it. It stands at Laydown yard now.')
  })

  it('refuses a name another box on the job carries, in words, and sends nothing', () => {
    renderWithProviders(<EditBoxForm container={site[0]!} containers={site} {...who} onSaved={() => {}} />)
    fireEvent.change(screen.getByLabelText('Its name'), { target: { value: 'r71' } })
    expect(screen.getByRole('alert').textContent).toBe('R71 is already on this job. Pick another name.')
    const press = screen.getByRole('button', { name: 'Rename to R71' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.submit(screen.getByTestId('edit-box-form'))
    expect(editContainer).not.toHaveBeenCalled()
  })

  it('holds a new name to the rule and moves words typed after it to What is in it (punch list #351)', () => {
    const onSaved = vi.fn()
    renderWithProviders(<EditBoxForm container={site[0]!} containers={site} siteBoxes={[...site, box({ id: 'c9', jobId: 'j2', label: 'R80' })]} {...who} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText('Its name'), { target: { value: 'r80' } })
    expect(screen.getByRole('alert').textContent).toBe('R80 is already on this site. Pick another name.')
    fireEvent.change(screen.getByLabelText('Its name'), { target: { value: 'concrete mix' } })
    expect(screen.getByRole('alert').textContent).toBe('A name is one to three letters and a number from 1 to 999, like R76. Words about what is inside go in What is in it.')
    fireEvent.change(screen.getByLabelText('Its name'), { target: { value: 'r76 toilets' } })
    expect(screen.getByTestId('edit-box-moved-note').textContent).toBe('“Toilets” moved to What is in it.')
    expect((screen.getByLabelText('What is in it') as HTMLInputElement).value).toBe('Toilets')
    fireEvent.click(screen.getByRole('button', { name: 'Rename to R76' }))
    expect(editContainer).toHaveBeenCalledWith('c1', { label: 'R76', said: 'Toilets' })
    expect(onSaved).toHaveBeenCalledWith('R70 NO CONTAINER is now R76. Its printed label still opens it.')
  })
})
