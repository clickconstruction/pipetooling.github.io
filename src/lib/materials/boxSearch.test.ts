import { describe, expect, it } from 'vitest'
import { searchDoors } from '../search/doors'
import { boxDoors } from './boxSearch'
import { containerLines, type Container, type Movement, type Place } from './onSite'

const box = (id: string, jobId: string, label: string, kind: Container['kind'] = 'cage', over: Partial<Container> = {}): Container => ({ id, jobId, label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z', ...over })
const mv = (over: Partial<Movement> & Pick<Movement, 'reason' | 'quantity' | 'at' | 'jobId'>): Movement => ({ id: `${over.at}-${over.quantity}`, partId: null, partName: '3/4" copper 90', manufacturer: 'Nibco', fromContainerId: null, toContainerId: null, note: '', byUserId: null, byName: 'Carla', source: null, itemId: null, ...over })

const jobs = [{ id: 'j1', label: '972 · Oak Hollow Bldg C' }]
const places: Place[] = [{ id: 'p1', jobId: 'j1', name: 'Building A · level 2', createdAt: '2026-10-01T00:00:00Z' }]
const containers = [box('a1', 'j1', 'A1', 'cage', { locationId: 'p1', where: 'north stair' }), box('b7', 'j1', 'B7', 'box'), box('old', 'j1', 'Z9', 'box', { retiredAt: '2026-10-20T00:00:00Z' }), box('u', 'j2', 'Unsorted', 'unsorted')]
const lines = containerLines([
  mv({ jobId: 'j1', reason: 'delivered', quantity: 25, at: '2026-10-24T20:00:00Z', toContainerId: 'a1' }),
  mv({ jobId: 'j1', reason: 'delivered', quantity: 4, at: '2026-10-24T20:00:00Z', toContainerId: 'b7', partName: '1/2" ball valve', manufacturer: null }),
  mv({ jobId: 'j1', reason: 'used', quantity: 4, at: '2026-10-25T20:00:00Z', fromContainerId: 'b7', partName: '1/2" ball valve', manufacturer: null }),
])

describe('boxDoors', () => {
  it('makes a door per live box with its job and place, and the parts in it as words', () => {
    const doors = boxDoors({ jobs, containers, lines, places, forField: false })
    expect(doors.map((d) => d.label)).toEqual(['A1 · cage', 'B7 · box', 'Unsorted · delivered'])
    const a1 = doors[0]!
    expect(a1.where).toBe('972 · Oak Hollow Bldg C · Building A · level 2 · north stair')
    expect(a1.words).toContain('3/4" copper 90')
    expect(a1.words).toContain('nibco')
    // a job the list does not know reads by its id
    expect(doors[2]!.where).toBe('job j2')
    // B7's valve was all used, so it is not a word of the box any more
    expect(doors[1]!.words).not.toContain('1/2" ball valve')
  })

  it('sends the office to the materials page with the phone screen a second press, and a crew straight to the box', () => {
    const office = boxDoors({ jobs, containers, lines, places, forField: false })[0]!
    expect(office.to).toBe('/jobs?tab=materials&job=j1')
    expect(office.also).toEqual({ label: 'Open on the phone screen', to: '/tally?tab=on-site&job=j1&container=a1' })
    const crew = boxDoors({ jobs, containers, lines, places, forField: true })[0]!
    expect(crew.to).toBe('/tally?tab=on-site&job=j1&container=a1')
    expect(crew.also).toBeUndefined()
  })

  it('is found by its stencil, by a part in it or by its place, under Boxes on site', () => {
    const doors = boxDoors({ jobs, containers, lines, places, forField: false })
    const byStencil = searchDoors('a1', doors)
    expect(byStencil.map((g) => g.key)).toEqual(['box'])
    expect(byStencil[0]!.label).toBe('Boxes on site')
    expect(byStencil[0]!.doors.map((d) => d.label)).toEqual(['A1 · cage'])
    expect(searchDoors('copper', doors)[0]!.doors.map((d) => d.label)).toEqual(['A1 · cage'])
    expect(searchDoors('level 2', doors)[0]!.doors.map((d) => d.label)).toEqual(['A1 · cage'])
  })
})
