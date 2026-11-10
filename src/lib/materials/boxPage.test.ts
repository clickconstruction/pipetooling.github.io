import { describe, expect, it } from 'vitest'
import { BOX_PAGE_FIND_MAX, boxPageCode, boxPageCodeWords, boxPageCountVerdict, boxPageDayWords, boxPageFind, boxPageFindPath, boxPageFindView, boxPageFindWords, boxPageFoundWords, boxPageLines, boxPageNoun, boxPagePartsWords, boxPagePath, boxPagePhotoUrl, boxPageView, buildBoxPagePayload, compareStencils, parseBoxPageFindResponse, parseBoxPageResponse } from './boxPage'
import { LAST_BOX_MS, readLastBox, rememberLastBox, typedCodeWords } from './boxPageMemory'

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

describe('find a part on this site (PR 3, v2.6799)', () => {
  const boxes = [
    { ...CONTAINER },
    { id: 'c-a1', job_id: 'j1', label: 'A1', kind: 'cage', where_note: '', place_id: 'p2', retired_at: null, code: 'AAAA1111' },
    { id: 'c-c2', job_id: 'j1', label: 'C2', kind: 'box', where_note: 'mech room', place_id: 'p3', retired_at: null, code: 'CCCC2222' },
    { id: 'c-a10', job_id: 'j1', label: 'A10', kind: 'cage', where_note: '', place_id: null, retired_at: null, code: 'AAAA1010' },
    { id: 'c-old', job_id: 'j1', label: 'D1', kind: 'box', where_note: '', place_id: null, retired_at: '2026-11-01T00:00:00Z', code: 'DDDD1111' },
    { id: 'c-uns', job_id: 'j1', label: 'Unsorted', kind: 'unsorted', where_note: '', place_id: null, retired_at: null, code: 'UUUU0000' },
  ]
  const places = [{ id: 'p1', name: 'Level 2' }, { id: 'p2', name: 'Laydown yard' }, { id: 'p3', name: 'Level 3' }]
  const lines = [
    { container_id: CONTAINER.id, part_name: '3/4" copper 90° elbows', manufacturer: 'Mueller', on_hand: 42 },
    { container_id: CONTAINER.id, part_name: '1/2" PEX crimp rings', manufacturer: 'Sioux Chief', on_hand: 200 },
    { container_id: 'c-a1', part_name: '3/4" copper pipe, 20 ft', manufacturer: 'Cerro', on_hand: 24 },
    { container_id: 'c-c2', part_name: '3/4" copper tees', manufacturer: 'Mueller', on_hand: 15 },
    { container_id: 'c-a10', part_name: 'wax rings', manufacturer: null, on_hand: 6 },
    { container_id: 'c-old', part_name: '3/4" copper tees', manufacturer: 'Mueller', on_hand: 9 },
    { container_id: 'c-uns', part_name: '3/4" copper caps', manufacturer: null, on_hand: 3 },
  ]

  it('folds the words typed', () => {
    expect(boxPageFindWords('  3/4 Copper  ')).toEqual(['3/4', 'copper'])
    expect(boxPageFindWords(null)).toEqual([])
  })

  it('finds the boxes whose lines hold every word, the scanned box first, then stencil order, never a retired box or Unsorted', () => {
    const f = boxPageFind({ thisCode: '4F2A9C18', words: ['3/4', 'copper'], containers: boxes, places, lines })
    expect(f.boxes.map((b) => [b.stencil, b.thisBox, b.lines.map((l) => l.partName)])).toEqual([
      ['B3', true, ['3/4" copper 90° elbows']],
      ['A1', false, ['3/4" copper pipe, 20 ft']],
      ['C2', false, ['3/4" copper tees']],
    ])
    expect(f.boxes[1]).toMatchObject({ code: 'AAAA1111', kind: 'cage', place: 'Laydown yard' })
    expect(f.total).toBe(3)
  })

  it('a stencil or a place matches the box and brings every line; a word on the box and one on a line match together', () => {
    expect(boxPageFind({ thisCode: 'X', words: ['a10'], containers: boxes, places, lines }).boxes.map((b) => [b.stencil, b.lines.length])).toEqual([['A10', 1]])
    expect(boxPageFind({ thisCode: 'X', words: ['laydown'], containers: boxes, places, lines }).boxes.map((b) => b.stencil)).toEqual(['A1'])
    expect(boxPageFind({ thisCode: 'X', words: ['b3', 'pex'], containers: boxes, places, lines }).boxes.map((b) => [b.stencil, b.lines.map((l) => l.partName)])).toEqual([['B3', ['1/2" PEX crimp rings']]])
    expect(boxPageFind({ thisCode: 'X', words: ['wax', 'copper'], containers: boxes, places, lines }).boxes).toEqual([])
    expect(boxPageFind({ thisCode: 'X', words: [], containers: boxes, places, lines })).toEqual({ words: [], boxes: [], total: 0 })
  })

  it('caps the boxes and says how many there were, and the answer round-trips', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, job_id: 'j1', label: `M${i + 1}`, kind: 'box', where_note: '', place_id: null, retired_at: null, code: `M${String(i).padStart(7, '0')}` }))
    const manyLines = many.map((c) => ({ container_id: c.id, part_name: 'copper', manufacturer: null, on_hand: 1 }))
    const f = boxPageFind({ thisCode: 'X', words: ['copper'], containers: many, places: [], lines: manyLines })
    expect(f.boxes).toHaveLength(BOX_PAGE_FIND_MAX)
    expect(f.total).toBe(40)
    expect(f.boxes.map((b) => b.stencil).slice(0, 3)).toEqual(['M1', 'M2', 'M3'])
    expect(boxPageFoundWords(40, BOX_PAGE_FIND_MAX)).toBe('30 boxes hold a line that matches, the first 30 of 40. Type one more word to narrow it.')
    expect(boxPageFoundWords(1, BOX_PAGE_FIND_MAX)).toBe('1 box holds a line that matches.')
    expect(boxPageFoundWords(0, BOX_PAGE_FIND_MAX)).toBe('')
    const payload = { ok: true as const, find: f }
    expect(parseBoxPageFindResponse(JSON.parse(JSON.stringify(payload)))).toEqual(payload)
    expect(boxPageFindView(200, payload)).toEqual({ kind: 'found', payload })
    expect(boxPageFindView(500, null).kind).toBe('error')
  })

  it('sorts stencils by letters then number', () => {
    expect(['B1', 'A10', 'A2', 'A1', 'G76 TOILETS', 'G8'].sort(compareStencils)).toEqual(['A1', 'A2', 'A10', 'B1', 'G8', 'G76 TOILETS'])
  })
})

describe('the last box this phone scanned (boxPageMemory)', () => {
  it('remembers a box for a day, folds the typed code with its dash, and makes the search path', () => {
    const m = new Map<string, string>()
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
    rememberLastBox({ code: '4F2A9C18', stencil: 'B3', kind: 'cage' }, 1_000, s)
    expect(readLastBox(1_000 + 60_000, s)).toEqual({ code: '4F2A9C18', stencil: 'B3', kind: 'cage', at: 1_000 })
    expect(readLastBox(1_000 + LAST_BOX_MS + 1, s)).toBeNull()
    expect(readLastBox(500, s)).toBeNull()
    expect(typedCodeWords('4f2a9c18x')).toBe('4F2A-9C18')
    expect(typedCodeWords('4f2')).toBe('4F2')
    expect(boxPageFindPath('4F2A9C18')).toBe('/b/4f2a9c18?find=1')
  })
})

describe('the count as a verdict (v2.6868)', () => {
  it('says how long ago inside the 14 days, with the day beside it', () => {
    expect(boxPageCountVerdict('2026-11-10', '2026-11-10')).toEqual({ kind: 'fresh', words: 'Counted today', detail: 'Tuesday, Nov 10' })
    expect(boxPageCountVerdict('2026-11-09', '2026-11-10')).toEqual({ kind: 'fresh', words: 'Counted yesterday', detail: 'Monday, Nov 9' })
    expect(boxPageCountVerdict('2026-11-08', '2026-11-10')).toEqual({ kind: 'fresh', words: 'Counted 2 days ago', detail: 'Sunday, Nov 8' })
    expect(boxPageCountVerdict('2026-10-28', '2026-11-10').kind).toBe('fresh')
  })

  it('is due a count from the fourteenth day, the office badge\'s own rule', () => {
    expect(boxPageCountVerdict('2026-10-27', '2026-11-10')).toEqual({ kind: 'due', words: 'Due a count', detail: 'last counted 14 days ago' })
    expect(boxPageCountVerdict('2026-10-19', '2026-11-10')).toEqual({ kind: 'due', words: 'Due a count', detail: 'last counted 22 days ago' })
  })

  it('never counted says so, and a day that cannot be read gives no verdict on its age', () => {
    expect(boxPageCountVerdict(null, '2026-11-10')).toEqual({ kind: 'never', words: 'Never counted', detail: '' })
    expect(boxPageCountVerdict('2026-11-08', '')).toEqual({ kind: 'fresh', words: 'Counted Sunday, Nov 8', detail: '' })
    // A phone whose clock is a day behind the app's calendar still reads sensibly.
    expect(boxPageCountVerdict('2026-11-10', '2026-11-09').words).toBe('Counted today')
  })

  it('counts the parts beside the heading', () => {
    expect(boxPagePartsWords(0)).toBe('')
    expect(boxPagePartsWords(1)).toBe('1 part')
    expect(boxPagePartsWords(6)).toBe('6 parts')
  })
})
