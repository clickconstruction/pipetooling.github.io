import { describe, expect, it } from 'vitest'
import { boxPageCode, boxPageCodeWords, boxPageDayWords, boxPageLines, boxPageNoun, boxPagePath, boxPagePhotoUrl, boxPageView, buildBoxPagePayload, parseBoxPageResponse } from './boxPage'

const CONTAINER = { id: '4f2a9c18-1111-4222-8333-444455556666', job_id: 'j1', label: 'B3', kind: 'cage', where_note: ' by the north stair ', place_id: 'p1', retired_at: null, code: '4F2A9C18' }

describe('the box page code', () => {
  it('reads the eight hex characters however they were typed, and nothing else', () => {
    expect(boxPageCode('4f2a9c18')).toBe('4F2A9C18')
    expect(boxPageCode('4F2A-9C18')).toBe('4F2A9C18')
    expect(boxPageCode(' 4f2a 9c18 ')).toBe('4F2A9C18')
    expect(boxPageCode('4F2A9C1')).toBeNull()
    expect(boxPageCode('4F2A9C18Z')).toBeNull()
    expect(boxPageCode('ZZZZZZZZ')).toBeNull()
    expect(boxPageCode(null)).toBeNull()
  })

  it('prints the code for a person with its dash, and the return path lower-cased', () => {
    expect(boxPageCodeWords('4F2A9C18')).toBe('4F2A-9C18')
    expect(boxPagePath('4F2A9C18')).toBe('/b/4f2a9c18')
  })
})

describe('the payload', () => {
  it('cuts the job summary to the one container, drops empty lines, sorts by name, trims the where-note', () => {
    const lines = [
      { container_id: CONTAINER.id, part_name: '3/4" copper couplings', manufacturer: 'Mueller', on_hand: 36 },
      { container_id: 'other', part_name: '3/4" copper couplings', manufacturer: 'Mueller', on_hand: 9 },
      { container_id: CONTAINER.id, part_name: '1/2" copper pipe, 10 ft', manufacturer: null, on_hand: 18 },
      { container_id: CONTAINER.id, part_name: 'gone', manufacturer: null, on_hand: 0 },
    ]
    expect(boxPageLines(lines, CONTAINER.id)).toEqual([
      { partName: '1/2" copper pipe, 10 ft', manufacturer: null, onHand: 18 },
      { partName: '3/4" copper couplings', manufacturer: 'Mueller', onHand: 36 },
    ])
    const p = buildBoxPagePayload({ container: CONTAINER, place: 'Level 2', lines, lastCountedOn: '2026-11-05', photo: { id: 'ph1', takenOn: '2026-11-07', url: 'https://x/functions/v1/box-read?code=4F2A9C18&photo=ph1' } })
    expect(p.box).toMatchObject({ code: '4F2A9C18', stencil: 'B3', kind: 'cage', place: 'Level 2', where: 'by the north stair', lastCountedOn: '2026-11-05' })
    expect(p.box.lines).toHaveLength(2)
    // the payload never carries the job, the customer, a price or a name
    expect(JSON.stringify(p)).not.toContain('job')
    expect(parseBoxPageResponse(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })

  it('names the kind for a person and the photo address on the function', () => {
    expect(boxPageNoun('cage')).toBe('Cage')
    expect(boxPageNoun('box', false)).toBe('box')
    expect(boxPageNoun('pile')).toBe('Pile')
    expect(boxPagePhotoUrl('https://x.supabase.co/', '4F2A9C18', 'ph1')).toBe('https://x.supabase.co/functions/v1/box-read?code=4F2A9C18&photo=ph1')
  })

  it('refuses an answer that is not the shape', () => {
    expect(parseBoxPageResponse(null)).toBeNull()
    expect(parseBoxPageResponse({ ok: true, box: { code: 'X' } })).toBeNull()
    expect(parseBoxPageResponse({ ok: true, box: { code: 'X', stencil: 'A1', lines: [{ partName: 1 }] } })).toBeNull()
  })
})

describe('the page state from the answer', () => {
  const good = buildBoxPagePayload({ container: CONTAINER, place: '', lines: [], lastCountedOn: null, photo: null })
  it('maps each answer', () => {
    expect(boxPageView(200, good)).toEqual({ kind: 'box', payload: good })
    expect(boxPageView(404, { error: 'not_found' })).toEqual({ kind: 'not_found' })
    expect(boxPageView(410, { error: 'retired', retiredOn: '2026-11-08' })).toEqual({ kind: 'retired', retiredOn: '2026-11-08' })
    expect(boxPageView(429, { error: 'words', code: 'locked' })).toEqual({ kind: 'locked' })
    expect(boxPageView(429, { error: 'Too many requests. Try again in a minute.' }).kind).toBe('error')
    expect(boxPageView(500, null)).toEqual({ kind: 'error', failure: 'refused' })
    expect(boxPageView(200, { nope: true }).kind).toBe('error')
  })

  it('reads a day for a person', () => {
    expect(boxPageDayWords('2026-11-05')).toBe('Thursday, Nov 5')
    expect(boxPageDayWords('')).toBe('')
  })
})
