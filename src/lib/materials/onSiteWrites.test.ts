import { describe, expect, it } from 'vitest'
import { applyOnSiteWrites, insertAlreadyLanded, parseOnSiteWrites, type OnSiteRows, type OnSiteWrite } from './onSiteWrites'

const empty = (): OnSiteRows => ({ places: [], containers: [], moves: [], movements: [], photos: [] })
const AT = '2026-11-13T15:00:00.000Z'
const box: OnSiteWrite = { table: 'job_containers', op: 'insert', id: 'a1', row: { id: 'a1', job_id: 'j1', label: 'A1', kind: 'cage', where_note: 'by the stair', place_id: null, created_by: null } }
const used: OnSiteWrite = { table: 'job_material_movements', op: 'insert', id: 'm1', row: { id: 'm1', job_id: 'j1', part_id: null, part_name: 'ZZ test elbow', manufacturer: null, quantity: 4, reason: 'used', from_container_id: 'a1', to_container_id: null, note: '', source: null, by_user_id: 'u1', by_name: 'Mateo', at: '2026-11-13T14:59:00.000Z' } }

describe('parseOnSiteWrites', () => {
  it('takes the rows the store writes', () => {
    expect(parseOnSiteWrites([box, used])).toEqual([box, used])
  })
  it('refuses anything else', () => {
    expect(parseOnSiteWrites([])).toBeNull()
    expect(parseOnSiteWrites(null)).toBeNull()
    expect(parseOnSiteWrites([{ ...box, table: 'users' }])).toBeNull()
    expect(parseOnSiteWrites([{ ...box, op: 'delete' }])).toBeNull()
    // An insert names its own row, and the ledger takes no update.
    expect(parseOnSiteWrites([{ ...box, id: 'other' }])).toBeNull()
    expect(parseOnSiteWrites([{ table: 'job_material_movements', op: 'update', id: 'm1', row: { quantity: 9 } }])).toBeNull()
    expect(parseOnSiteWrites([{ ...box, row: [] }])).toBeNull()
  })
})

describe('applyOnSiteWrites', () => {
  it('draws a new box and a press on it, in order', () => {
    const rows = applyOnSiteWrites(empty(), [box, used], 'j1', AT)
    expect(rows.containers).toEqual([{ id: 'a1', jobId: 'j1', label: 'A1', kind: 'cage', where: 'by the stair', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: AT }])
    expect(rows.movements).toHaveLength(1)
    expect(rows.movements[0]).toMatchObject({ id: 'm1', jobId: 'j1', partName: 'ZZ test elbow', quantity: 4, reason: 'used', fromContainerId: 'a1', toContainerId: null, byName: 'Mateo', at: '2026-11-13T14:59:00.000Z', itemId: null })
  })

  it('an insert the rows already hold changes nothing: the read has it, so it landed', () => {
    const once = applyOnSiteWrites(empty(), [box, used], 'j1', AT)
    const twice = applyOnSiteWrites(once, [box, used], 'j1', '2026-11-14T00:00:00.000Z')
    expect(twice).toEqual(once)
  })

  it('changes only the columns an update names', () => {
    const start = applyOnSiteWrites(empty(), [box], 'j1', AT)
    const moved = applyOnSiteWrites(start, [{ table: 'job_containers', op: 'update', id: 'a1', row: { place_id: 'p1' } }], 'j1', AT)
    expect(moved.containers[0]).toMatchObject({ locationId: 'p1', retiredAt: null, lat: null })
    const pinned = applyOnSiteWrites(moved, [{ table: 'job_containers', op: 'update', id: 'a1', row: { lat: 29.5, lng: -98.4 } }], 'j1', AT)
    expect(pinned.containers[0]).toMatchObject({ locationId: 'p1', lat: 29.5, lng: -98.4 })
    const retired = applyOnSiteWrites(pinned, [{ table: 'job_containers', op: 'update', id: 'a1', row: { retired_at: AT } }], 'j1', AT)
    expect(retired.containers[0]!.retiredAt).toBe(AT)
    const back = applyOnSiteWrites(retired, [{ table: 'job_containers', op: 'update', id: 'a1', row: { retired_at: null } }], 'j1', AT)
    expect(back.containers[0]).toMatchObject({ retiredAt: null, locationId: 'p1', lat: 29.5 })
  })

  it('an update of a row that is not there changes nothing', () => {
    expect(applyOnSiteWrites(empty(), [{ table: 'job_containers', op: 'update', id: 'gone', row: { retired_at: AT } }], 'j1', AT)).toEqual(empty())
  })

  it('draws a place, a box move stamped when pressed, and a photo with its later change', () => {
    const rows = applyOnSiteWrites(
      empty(),
      [
        { table: 'job_places', op: 'insert', id: 'p1', row: { id: 'p1', job_id: 'j1', name: 'Level 2', created_by: null } },
        { table: 'job_container_moves', op: 'insert', id: 'v1', row: { id: 'v1', container_id: 'a1', from_place_id: null, to_place_id: 'p1', by_user_id: 'u1', by_name: 'Mateo', at: '2026-11-13T14:00:00.000Z' } },
        { table: 'job_box_photos', op: 'insert', id: 'f1', row: { id: 'f1', job_id: 'j1', container_id: 'a1', by_user_id: 'u1', by_name: 'Mateo', words: 'A1 after Count', file_name: 'a1.jpg', taken_at: '2026-11-13T14:30:00.000Z', bytes: 400000, width: 1600, height: 1200, status: 'on-phone', storage_path: null } },
        { table: 'job_box_photos', op: 'update', id: 'f1', row: { status: 'sending', storage_path: 'j1/f1.jpg' } },
      ],
      'j1',
      AT,
    )
    expect(rows.places).toEqual([{ id: 'p1', jobId: 'j1', name: 'Level 2', createdAt: AT }])
    expect(rows.moves).toEqual([{ id: 'v1', jobId: 'j1', containerId: 'a1', fromLocationId: null, toLocationId: 'p1', byName: 'Mateo', at: '2026-11-13T14:00:00.000Z' }])
    expect(rows.photos[0]).toMatchObject({ id: 'f1', containerId: 'a1', fileName: 'a1.jpg', at: '2026-11-13T14:30:00.000Z', status: 'sending', storagePath: 'j1/f1.jpg', driveFileId: null, words: 'A1 after Count' })
  })

  it('does not change the rows it was given', () => {
    const start = empty()
    applyOnSiteWrites(start, [box, used], 'j1', AT)
    expect(start).toEqual(empty())
  })
})

describe('insertAlreadyLanded', () => {
  it('a duplicate of the row’s own key is a landing', () => {
    expect(insertAlreadyLanded({ code: '23505', message: 'duplicate key value violates unique constraint "job_material_movements_pkey"' }, 'job_material_movements')).toBe(true)
    expect(insertAlreadyLanded({ code: '23505', message: 'duplicate key value', details: 'Key (id)=(m1) already exists.' }, 'job_containers')).toBe(true)
  })
  it('any other duplicate is a real no', () => {
    // A stencil a live box already carries, a place name twice.
    expect(insertAlreadyLanded({ code: '23505', message: 'duplicate key value violates unique constraint "job_containers_live_label_key"' }, 'job_containers')).toBe(false)
    expect(insertAlreadyLanded({ code: '23505', message: 'duplicate key value violates unique constraint "job_places_job_name_key"', details: 'Key (job_id, lower(name))=(j1, level 2) already exists.' }, 'job_places')).toBe(false)
  })
  it('a refusal or no error is not a landing', () => {
    expect(insertAlreadyLanded({ code: '42501', message: 'new row violates row-level security policy' }, 'job_containers')).toBe(false)
    expect(insertAlreadyLanded(null, 'job_containers')).toBe(false)
  })
})
