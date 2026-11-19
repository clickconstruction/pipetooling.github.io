// @vitest-environment jsdom
/**
 * Render smoke for the By person look of a site's materials: every press on the site by day with
 * who made it, one person picked from the list with their last press, the acts worth a look
 * wearing their chip and narrowing the list, a box opening from its row, and the two empty states.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container, ContainerMove, Movement, MovementReason, Place } from '../../lib/materials/onSite'
import type { SiteTrail } from '../../lib/materials/sitePeopleTrailIo'
import SitePeopleView from './SitePeopleView'

afterEach(() => cleanup())

// A made-up site, Cedar Ridge.
let seq = 0
function row(reason: MovementReason, qty: number, boxId: string, at: string, by: string, note = '', source: string | null = null): Movement {
  seq += 1
  const into = reason === 'delivered'
  return { id: `m${String(seq).padStart(3, '0')}`, jobId: 'j1', partId: null, partName: '2" PVC 90', manufacturer: null, quantity: qty, reason, fromContainerId: into ? null : boxId, toContainerId: into ? boxId : null, note, byUserId: null, byName: by, at, source, itemId: null }
}
const places: Place[] = [{ id: 'p1', jobId: 'j1', name: 'Arena', createdAt: '2026-11-01T12:00:00' }, { id: 'p2', jobId: 'j1', name: 'Bunker', createdAt: '2026-11-01T12:00:00' }]
const containers: Container[] = [{ id: 'g22', jobId: 'j1', label: 'G22', kind: 'cage', where: '', locationId: 'p1', lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T12:00:00' }]
const movements: Movement[] = [
  row('delivered', 40, 'g22', '2026-11-16T10:00:00', 'Dana K.', '', 'INV-10422'),
  row('taken', 30, 'g22', '2026-11-17T09:15:00', 'Sam R.', 'bunker drains'),
  row('taken', 4, 'g22', '2026-11-18T11:02:00', 'Sam R.'),
  row('counted', 2, 'g22', '2026-11-18T13:52:00', 'Sam R.'),
]
const moves: ContainerMove[] = [{ id: 'cm1', jobId: 'j1', containerId: 'g22', fromLocationId: 'p1', toLocationId: 'p2', byName: 'Sam R.', at: '2026-11-18T10:48:00' }]
const jobs = [{ id: 'j1', label: 'J101 · Rough in' }]
const boxHref = (jobId: string, boxId: string) => `/jobs?tab=materials&job=${jobId}&box=${boxId}`

const noTrail: SiteTrail = { boxChanges: [], boxRenames: [], removedAnswers: [] }
const readNothing = async () => noTrail

function draw(over: Partial<Parameters<typeof SitePeopleView>[0]> = {}) {
  return renderWithProviders(<SitePeopleView siteId="dev1" readTrail={readNothing} jobs={jobs} movements={movements} containerMoves={moves} containers={containers} places={places} boxHref={boxHref} {...over} />)
}

describe('SitePeopleView', () => {
  it('draws every press by day with who made it, and the figures over them', () => {
    draw()
    const rows = within(screen.getByTestId('site-people')).getAllByRole('row')
    // The head, three day lines and five acts.
    expect(rows).toHaveLength(9)
    expect(screen.getByRole('columnheader', { name: 'Who' })).toBeTruthy()
    expect(screen.getByTestId('site-people-tiles').textContent).toContain('5presses over 3 days')
    expect(screen.getByTestId('site-people-tiles').textContent).toContain('34pieces taken or used')
    expect(screen.getByTestId('site-people-tiles').textContent).toContain('2worth a look')
    // The count reads what the ledger expected against what was found.
    expect(screen.getByText('6 → 2')).toBeTruthy()
  })

  it('narrows to one person, says their last press and drops the Who column', () => {
    draw()
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'sam r.' } })
    expect(screen.getByTestId('site-people-last').textContent).toContain('Sam R. · last press')
    expect(screen.queryByRole('columnheader', { name: 'Who' })).toBeNull()
    expect(screen.queryByText('INV-10422')).toBeNull()
    expect(screen.getByTestId('site-people-tiles').textContent).toContain('4presses over 2 days')
  })

  it('narrows to the presses worth a look, each with its chip, and to one kind', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Worth a look only' }))
    expect(screen.getByText('count changed the number')).toBeTruthy()
    expect(screen.getByText('no note')).toBeTruthy()
    expect(screen.queryByText('bunker drains')).toBeNull()
    fireEvent.change(screen.getByLabelText('Kind of press'), { target: { value: 'counted' } })
    expect(screen.queryByText('no note')).toBeNull()
    fireEvent.change(screen.getByLabelText('Kind of press'), { target: { value: 'box_moved' } })
    // Nothing is both a box move and worth a look: the way out is one press.
    fireEvent.click(screen.getByRole('button', { name: 'Show every press' }))
    expect(screen.getByText('bunker drains')).toBeTruthy()
  })

  it('opens a box from its row', () => {
    draw()
    const door = screen.getAllByRole('link', { name: 'G22 · Arena' })[0]
    expect(door?.getAttribute('href')).toBe('/jobs?tab=materials&job=j1&box=g22')
    expect(screen.getByRole('link', { name: 'G22 · Arena → Bunker' })).toBeTruthy()
  })

  it('says what fills an empty site, and that it is still reading', () => {
    draw({ movements: [], containerMoves: [] })
    expect(screen.getByText('No press is on record on this site yet.')).toBeTruthy()
    cleanup()
    draw({ movements: [], containerMoves: [], loading: true })
    expect(screen.getByText('Reading the boxes…')).toBeTruthy()
  })

  it('adds the changes that are not ledger rows once their read answers', async () => {
    const readTrail = vi.fn(async () => ({
      boxChanges: [{ id: 'c1', containerId: 'g22', what: 'retired' as const, oldValue: '', newValue: '', byName: 'Sam R.', at: '2026-11-18T13:50:00' }],
      boxRenames: [{ id: 'n1', containerId: 'g22', oldLabel: 'G2', newLabel: 'G22', byName: 'Dana K.', at: '2026-11-15T09:00:00' }],
      removedAnswers: [{ id: 'r1', answer: 'price' as const, jobId: 'j1', words: '2 PVC 90, $4.50', byName: 'Sam R.', at: '2026-11-18T08:00:00' }],
    }))
    draw({ readTrail })
    // The picker offers the same words, so the rows are read inside the table.
    const table = () => within(screen.getByRole('table'))
    await waitFor(() => expect(table().getByText('Retired a box')).toBeTruthy())
    expect(table().getByText('Renamed a box')).toBeTruthy()
    expect(table().getByText('G2 → G22')).toBeTruthy()
    expect(table().getByText('Removed a price')).toBeTruthy()
    expect(table().getByText('2 PVC 90, $4.50')).toBeTruthy()
    expect(readTrail).toHaveBeenCalledWith({ siteId: 'dev1', jobIds: ['j1'], containerIds: ['g22'] })
    fireEvent.change(screen.getByLabelText('Kind of press'), { target: { value: 'box_retired' } })
    expect(screen.getByTestId('site-people-tiles').textContent).toContain('1press over 1 day')
  })

  it('says so when the trail did not load, keeps the presses, and reads again on Try again', async () => {
    let fail = true
    const readTrail = vi.fn(async () => {
      if (fail) throw { message: 'permission denied for table job_container_changes' }
      return { ...noTrail, boxChanges: [{ id: 'c1', containerId: 'g22', what: 'brought_back' as const, oldValue: '', newValue: '', byName: 'Dana K.', at: '2026-11-18T14:00:00' }] }
    })
    draw({ readTrail })
    const line = await screen.findByTestId('site-people-trail-error')
    expect(line.textContent).toContain('Box changes and answers taken off are not in this list.')
    expect(line.textContent).toContain('permission denied for table job_container_changes')
    expect(screen.getByText('bunker drains')).toBeTruthy()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Brought a box back')).toBeTruthy())
    await waitFor(() => expect(screen.queryByTestId('site-people-trail-error')).toBeNull())
  })
})
