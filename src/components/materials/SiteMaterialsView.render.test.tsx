// @vitest-environment jsdom
/**
 * Render smoke for a site's materials on one screen (punch list #330): the figures over the list,
 * one row per part across two jobs with the same words folded and a near twin kept apart, a row
 * that opens to its boxes with a door each, the search with its running total, a figure that
 * narrows the list, the boxes by place with the device remembering the pick, money hidden from a
 * role that does not read it, and the empty site.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { makeUseAuthValue, renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container, Movement, MovementReason, Place } from '../../lib/materials/onSite'
import { readSiteView } from '../../lib/materials/siteMaterialsViewPrefs'
import SiteMaterialsView from './SiteMaterialsView'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => makeUseAuthValue({ role: 'dev' }),
  useOptionalAuth: () => makeUseAuthValue({ role: 'dev' }),
}))

// A made-up site, Juniper Ridge: two jobs, one yard both use.
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
let seq = 0
function row(jobId: string, reason: MovementReason, name: string, quantity: number, box: string, daysAgo: number): Movement {
  seq += 1
  const into = reason === 'delivered'
  return { id: `m${String(seq).padStart(4, '0')}`, jobId, partId: null, partName: name, manufacturer: null, quantity, reason, fromContainerId: into ? null : box, toContainerId: into ? box : null, note: '', byUserId: null, byName: 'Priya', at: ago(daysAgo), source: null, itemId: null }
}
const box = (id: string, jobId: string, label: string, locationId: string | null): Container => ({ id, jobId, label, kind: 'cage', where: '', locationId, lat: null, lng: null, retiredAt: null, createdAt: ago(30) })
const place = (id: string, jobId: string, name: string): Place => ({ id, jobId, name, createdAt: ago(30) })

const store = vi.hoisted(() => ({ containers: {} as Record<string, unknown[]>, places: {} as Record<string, unknown[]>, movements: {} as Record<string, unknown[]> }))
vi.mock('../../lib/materials/onSiteStore', () => ({
  listContainers: (id: string) => store.containers[id] ?? [],
  listPlaces: (id: string) => store.places[id] ?? [],
  listMovements: (id: string) => store.movements[id] ?? [],
  serverSummary: () => null,
  priceOf: (key: string) => (key === 'text:1/2" pex drop ear' ? 4 : null),
}))

function fill() {
  seq = 0
  store.containers = { ja: [box('r12', 'ja', 'R12', 'ya'), box('r58', 'ja', 'R58', 'ya'), box('r22', 'ja', 'R22', null)], jb: [box('p1', 'jb', 'P1', 'yb')] }
  store.places = { ja: [place('ya', 'ja', 'Laydown yard')], jb: [place('yb', 'jb', 'Laydown yard')] }
  store.movements = {
    ja: [
      row('ja', 'delivered', '2" 90 pvc', 94, 'r12', 5),
      row('ja', 'counted', '2" 90 pvc', 94, 'r12', 2),
      row('ja', 'delivered', '2" 90', 42, 'r58', 20),
      row('ja', 'delivered', '1/2" PEX drop ear', 28, 'r22', 6),
      row('ja', 'counted', '1/2" PEX drop ear', 28, 'r22', 5),
      row('ja', 'cannot_find', '1/2" PEX drop ear', 3, 'r22', 1),
    ],
    jb: [row('jb', 'delivered', '2 inch 90 PVC', 28, 'p1', 3), row('jb', 'used', '2 inch 90 PVC', 8, 'p1', 1)],
  }
}

const jobs = [
  { id: 'ja', label: 'J1042 · Juniper Ridge, phase 2' },
  { id: 'jb', label: 'J1057 · Juniper Ridge pump house' },
]

function setup(props: Partial<Parameters<typeof SiteMaterialsView>[0]> = {}) {
  fill()
  const onBack = vi.fn()
  renderWithProviders(<SiteMaterialsView site={{ id: 'dev1', name: 'Juniper Ridge' }} jobs={jobs} showMoney onBack={onBack} backLabel="Materials desk" boxHref={(jobId, boxId) => `/jobs?tab=materials&job=${jobId}#${boxId}`} developmentHref="/developments/dev1" {...props} />)
  return { onBack }
}

afterEach(() => {
  window.localStorage.clear()
})

describe('SiteMaterialsView', () => {
  it('draws the figures: how fresh the record is, the boxes, what is on hand, the week', () => {
    setup()
    const glance = screen.getByRole('group', { name: 'This site at a glance' })
    expect(within(glance).getByText('Yesterday')).toBeTruthy()
    expect(within(glance).getByText('by Priya')).toBeTruthy()
    expect(within(glance).getByText('2 jobs · 1 place')).toBeTruthy()
    expect(within(glance).getByText('4 lines')).toBeTruthy()
    expect(within(glance).getByText('181 pieces')).toBeTruthy()
    expect(within(glance).getByText('150 in')).toBeTruthy()
    expect(within(glance).getByText('8 used')).toBeTruthy()
    // The week's Can't find at the price the store knows: 3 at $4.
    expect(within(glance).getByText('$12.00')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open the Development page' }).getAttribute('href')).toBe('/developments/dev1')
  })

  it('folds the same words across two jobs into one row and keeps a near twin its own row', () => {
    setup()
    const rows = document.querySelectorAll('[data-site-part-row]')
    expect(rows).toHaveLength(3)
    const pvc = screen.getByRole('button', { name: /2" 90 pvc.*2 spellings/ })
    expect(within(pvc).getByText('114')).toBeTruthy()
    expect(within(pvc).getByText('R12 · 94')).toBeTruthy()
    expect(within(pvc).getByText('P1 · 20')).toBeTruthy()
    fireEvent.click(pvc)
    expect(screen.getByText(/These names are one row because their words are the same/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'P1' }).getAttribute('href')).toBe('/jobs?tab=materials&job=jb#p1')
    expect(screen.getByText(/typed “2 inch 90 PVC”/)).toBeTruthy()
  })

  it('the search adds up the rows it shows, and Show every row clears it', () => {
    setup()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a part or a box on this site' }), { target: { value: '2 90' } })
    expect(document.querySelectorAll('[data-site-part-row]')).toHaveLength(2)
    expect(screen.getByTestId('site-shown-total').textContent).toContain('156 pieces in the 2 rows shown')
    fireEvent.click(screen.getByRole('button', { name: 'Show every row' }))
    expect(document.querySelectorAll('[data-site-part-row]')).toHaveLength(3)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a part or a box on this site' }), { target: { value: 'zzz' } })
    expect(document.querySelectorAll('[data-site-part-row]')).toHaveLength(0)
    expect(screen.getByText(/zzz/)).toBeTruthy()
  })

  it("a figure narrows the list: Can't find leaves the one line", () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Can't find/ }))
    const rows = document.querySelectorAll('[data-site-part-row]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.textContent).toContain('1/2" PEX drop ear')
    expect(rows[0]!.textContent).toContain("3 can't find")
    expect(screen.getByTestId('site-shown-total').textContent).toContain('25 pieces in the 1 row shown')
  })

  it('reads by place, one section for a name two jobs share, and remembers the pick', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'By place' }))
    expect(readSiteView()).toBe('place')
    const yard = screen.getByRole('heading', { name: /Laydown yard/ })
    expect(yard.textContent).toContain('3 boxes')
    expect(yard.textContent).toContain('2 jobs')
    expect(screen.getByRole('heading', { name: /No place yet/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'R58' })).toBeTruthy()
  })

  it('draws no money for a role that does not read it, and no Development door without one', () => {
    setup({ showMoney: false, developmentHref: null })
    expect(screen.queryByText('$12.00')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Open the Development page' })).toBeNull()
  })

  it('an empty site says what fills it, and Back returns', () => {
    fill()
    const onBack = vi.fn()
    renderWithProviders(<SiteMaterialsView site={{ id: 'dev2', name: 'Alder Court' }} jobs={[]} showMoney onBack={onBack} backLabel="Materials desk" boxHref={() => '/'} />)
    expect(screen.getByText('No part is on hand on this site yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Materials desk' }))
    expect(onBack).toHaveBeenCalled()
  })
})
