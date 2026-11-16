import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BOX_PAGE_LOCKED_WORDS, BOX_PAGE_SIGN_IN_ERROR, boxPageAddressWords, boxPageAsksInside, boxPageBidWords, boxPageCallHref, boxPageCode, boxPageCodeWords, boxPageDayWords, boxPageDialNumber, boxPageEarlyAnswer, boxPageNoun, boxPageOfficePhone, boxPagePath, boxPagePlate, boxPageSiteWords, boxPageStickerAnswer, boxPageTextHref, boxPageTextWords, boxPageView, boxPageWorkWords, buildBoxPagePayload, parseBoxPageResponse } from './boxPage'
import { typedCodeWords } from './boxPageMemory'
import { labelPlate } from './labels'

const CONTAINER = { id: '4f2a9c18-1111-4222-8333-444455556666', label: 'B3', kind: 'cage', retired_at: null, code: '4F2A9C18' }

/** An answer as the function gave it before v2.7379: the place, the photo, the lines with their counts, what ran out. */
const BEFORE_THE_SEAL = {
  ok: true,
  box: {
    code: '4F2A9C18', stencil: 'B3', kind: 'cage', place: 'Level 2', where: 'by the north stair', line: 'Copper fittings',
    lines: [{ partName: '3/4" copper 90', manufacturer: 'Mueller', onHand: 140, cannotFind: 2 }],
    gone: [{ partName: '1" copper tee', manufacturer: 'Mueller', onHand: 0 }],
    lastCountedOn: '2026-11-13',
    photo: { id: 'ph1', takenOn: '2026-11-13', url: 'https://x.supabase.co/functions/v1/box-read?code=4F2A9C18&photo=ph1' },
  },
  office: { phone: '(512) 555-0142' },
}

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

  it('prints the code for a person with its dash, the return path lower-cased, and the label’s own address', () => {
    expect(boxPageCodeWords('4F2A9C18')).toBe('4F2A-9C18')
    expect(boxPagePath('4F2A9C18')).toBe('/b/4f2a9c18')
    expect(boxPageAddressWords('849fdb0b')).toBe('prts.co/b/849F-DB0B')
    expect(typedCodeWords('4f2a9c')).toBe('4F2A-9C')
  })
})

describe('what is inside needs a sign-in (v2.7379)', () => {
  it('the answer is the name, the kind, the code and the office’s number, and nothing a box holds', () => {
    const p = buildBoxPagePayload({ container: CONTAINER, officePhone: ' (512) 555-0142 ' })
    expect(p).toEqual({ ok: true, box: { code: '4F2A9C18', stencil: 'B3', kind: 'cage' }, office: { phone: '(512) 555-0142' } })
    expect(Object.keys(p.box).sort()).toEqual(['code', 'kind', 'stencil'])
    expect(parseBoxPageResponse(JSON.parse(JSON.stringify(p)))).toEqual(p)
    expect(buildBoxPagePayload({ container: CONTAINER, officePhone: '' }).office).toBeNull()
  })

  it('the builder cannot be handed a part, a count, a place or a photo: a row that carries them answers none of them', () => {
    const fat = { ...CONTAINER, job_id: 'j1', where_note: 'by the north stair', description: 'Kohler toilets', place_id: 'p1' }
    const wire = JSON.stringify(buildBoxPagePayload({ container: fat, officePhone: '(512) 555-0142' }))
    for (const word of ['job', 'north stair', 'Kohler', 'place', 'lines', 'gone', 'photo', 'lastCountedOn', 'line']) expect(wire).not.toContain(word)
  })

  it('the name is what the label prints: the letters and number alone, as labelPlate cuts it', () => {
    expect(boxPagePlate('G12 COPPER 90')).toBe('G12')
    expect(boxPagePlate(' r76 toilets ')).toBe('R76')
    expect(boxPagePlate('G24B')).toBe('G24B')
    // No letters and number: the label prints the name whole, so the page does.
    expect(boxPagePlate('MISL PILE OF JUNK PIPE')).toBe('MISL PILE OF JUNK PIPE')
    for (const name of ['G12 COPPER 90', 'R76', 'ab12 valves', 'G24B', 'B3']) expect(boxPagePlate(name)).toBe(labelPlate(name))
    expect(buildBoxPagePayload({ container: { ...CONTAINER, label: 'G12 COPPER 90' } }).box.stencil).toBe('G12')
  })

  it('a request for the search or a photo asks for what is inside; the page’s own read does not', () => {
    expect(boxPageAsksInside({ find: 'copper', photo: null })).toBe(true)
    expect(boxPageAsksInside({ find: '', photo: null })).toBe(true)
    expect(boxPageAsksInside({ find: null, photo: 'ph1' })).toBe(true)
    expect(boxPageAsksInside({ find: null, photo: null })).toBe(false)
    expect(BOX_PAGE_SIGN_IN_ERROR).toBe('sign_in')
    // The refusal is not a box: the page that asked reads a failure, never a list.
    expect(boxPageView(401, { error: BOX_PAGE_SIGN_IN_ERROR }).kind).toBe('error')
  })

  it('an answer from the function before the seal is read as the sealed page: its lines, place and photo are dropped unread', () => {
    const read = parseBoxPageResponse(BEFORE_THE_SEAL)
    expect(read).toEqual({ ok: true, box: { code: '4F2A9C18', stencil: 'B3', kind: 'cage' }, office: { phone: '(512) 555-0142' } })
    const wire = JSON.stringify(read)
    for (const word of ['copper', 'Mueller', '140', 'Level 2', 'north stair', 'ph1', '2026-11-13']) expect(wire).not.toContain(word)
    // And a name with words after it is cut on the way in, whichever function sent it.
    expect(parseBoxPageResponse({ ok: true, box: { code: '4F2A9C18', stencil: 'G12 COPPER 90', kind: 'box' } })!.box.stencil).toBe('G12')
  })

  it('the function reads nothing a box holds and has no search or photo left in it', () => {
    const fn = readFileSync(resolve(process.cwd(), 'supabase/functions/box-read/index.ts'), 'utf8')
    const code = fn.slice(fn.indexOf('const corsHeaders'))
    for (const gone of ['on_site_job_summary', 'job_box_photos', 'job_places', 'box-photos', 'driveMedia', 'where_note', 'description', 'place_id', 'job_id']) expect(code).not.toContain(gone)
    expect(code).toContain("select('id, label, kind, retired_at, code')")
    // The refusal comes before the database client is made.
    expect(code.indexOf('boxPageAsksInside(')).toBeGreaterThan(-1)
    expect(code.indexOf('boxPageAsksInside(')).toBeLessThan(code.indexOf('createClient('))
  })

  it('names the kind for a person', () => {
    expect(boxPageNoun('cage')).toBe('Cage')
    expect(boxPageNoun('box', false)).toBe('box')
    expect(boxPageNoun('pile')).toBe('Pile')
    expect(boxPageSiteWords('box')).toBe('Box on this site')
    expect(boxPageSiteWords('cage')).toBe('Cage on this site')
  })

  it('refuses an answer that is not the shape', () => {
    expect(parseBoxPageResponse(null)).toBeNull()
    expect(parseBoxPageResponse({ ok: true, box: { code: 'X' } })).toBeNull()
    expect(parseBoxPageResponse({ ok: false, box: { code: 'X', stencil: 'A1' } })).toBeNull()
  })
})

describe('the page state from the answer', () => {
  const good = buildBoxPagePayload({ container: CONTAINER })
  it('maps each answer', () => {
    expect(boxPageView(200, good)).toEqual({ kind: 'box', payload: good })
    expect(boxPageView(404, { error: 'not_found' })).toEqual({ kind: 'not_found' })
    expect(boxPageView(410, { error: 'retired', retiredOn: '2026-11-08' })).toEqual({ kind: 'retired', retiredOn: '2026-11-08', stencil: null, boxKind: null, phone: null })
    // v2.6874: the function names the retired box and answers the office's number.
    expect(boxPageView(410, { error: 'retired', retiredOn: '2026-11-08', stencil: 'B3', kind: 'cage', phone: '(512) 555-0142' })).toEqual({ kind: 'retired', retiredOn: '2026-11-08', stencil: 'B3', boxKind: 'cage', phone: '(512) 555-0142' })
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

describe('the presses that reach the office', () => {
  it('Text the office is a link with the box\'s name filled in, to a number a phone can dial', () => {
    expect(boxPageDialNumber('(512) 555-0142')).toBe('+15125550142')
    expect(boxPageDialNumber('1-512-555-0142')).toBe('+15125550142')
    expect(boxPageDialNumber('555-0142')).toBeNull()
    expect(boxPageDialNumber(null)).toBeNull()
    expect(boxPageTextWords('cage', 'B3', '4F2A9C18')).toBe('Cage B3, 4F2A-9C18: ')
    expect(boxPageTextHref('(512) 555-0142', 'Cage B3, 4F2A-9C18: ')).toBe('sms:+15125550142?&body=Cage%20B3%2C%204F2A-9C18%3A%20')
    expect(boxPageTextHref('', 'x')).toBeNull()
    expect(boxPageCallHref('(512) 555-0142')).toBe('tel:+15125550142')
  })

  it('Ask for a bid and Work with us open a text that says which box was scanned (v2.7379)', () => {
    expect(boxPageBidWords('box', 'G81', '849FDB0B')).toBe('I would like a bid. I scanned box G81, 849F-DB0B: ')
    expect(boxPageWorkWords('cage', 'B3', '4F2A9C18')).toBe('I would like to work with Click. I scanned cage B3, 4F2A-9C18: ')
  })
})

describe('the office number (v2.6910)', () => {
  it('is the team box\'s line when Settings has one, then the fallback, then the letterhead', () => {
    expect(boxPageOfficePhone(['(512) 555-0144', '(512) 555-0100', '(512) 555-0199'])).toBe('(512) 555-0144')
    expect(boxPageOfficePhone(['', ' (512) 555-0100 ', '(512) 555-0199'])).toBe('(512) 555-0100')
    expect(boxPageOfficePhone([null, undefined, '(512) 555-0199'])).toBe('(512) 555-0199')
    expect(boxPageOfficePhone(['', null])).toBe('')
  })
})

describe('a sticker\'s code (v2.7072, punch list #329)', () => {
  const STICKER = { id: '9b1c0d2e-1111-4222-8333-444455556666', number: 147, code: '9B1C0D2E', container_id: null as string | null, lost_at: null as string | null }

  it('no sticker carries the code: it is read as a box\'s own', () => {
    expect(boxPageStickerAnswer(null)).toEqual({ kind: 'none' })
  })

  it('a blank sticker answers its number and nothing else', () => {
    const a = boxPageStickerAnswer(STICKER)
    expect(a).toEqual({ kind: 'blank', status: 404, body: { error: 'sticker_blank', number: 147 } })
    // nothing of a job, a box, a run or a person
    expect(Object.keys(a.kind === 'blank' ? a.body : {})).toEqual(['error', 'number'])
    expect(boxPageView(404, a.kind === 'blank' ? a.body : null)).toEqual({ kind: 'sticker_blank', number: 147 })
  })

  it('a sticker on a box goes on to that box', () => {
    expect(boxPageStickerAnswer({ ...STICKER, container_id: CONTAINER.id })).toEqual({ kind: 'box', containerId: CONTAINER.id, number: 147 })
  })

  it('a lost sticker says so, even while it keeps the box it was on', () => {
    const a = boxPageStickerAnswer({ ...STICKER, container_id: CONTAINER.id, lost_at: '2026-11-14T15:00:00Z' }, '2026-11-14')
    expect(a).toEqual({ kind: 'lost', status: 410, body: { error: 'sticker_lost', number: 147, lostOn: '2026-11-14' } })
    expect(boxPageView(410, a.kind === 'lost' ? a.body : null)).toEqual({ kind: 'sticker_lost', number: 147, lostOn: '2026-11-14' })
    expect(boxPageView(410, { error: 'sticker_lost', number: 147, lostOn: null })).toEqual({ kind: 'sticker_lost', number: 147, lostOn: null })
  })

  it('a locked source is answered locked before the sticker is, blank or lost; an open one hears the sticker\'s own answer (v2.7264)', () => {
    const blank = boxPageStickerAnswer(STICKER)
    const lost = boxPageStickerAnswer({ ...STICKER, container_id: CONTAINER.id, lost_at: '2026-11-14T15:00:00Z' }, '2026-11-14')
    const onBox = boxPageStickerAnswer({ ...STICKER, container_id: CONTAINER.id })
    const locked = { status: 429, body: { error: BOX_PAGE_LOCKED_WORDS, code: 'locked' }, state: 'locked' }
    // Locked: the same 429 whatever the code, so the sticker numbers that exist never reach a guesser.
    expect(boxPageEarlyAnswer(true, blank)).toEqual(locked)
    expect(boxPageEarlyAnswer(true, lost)).toEqual(locked)
    expect(boxPageEarlyAnswer(true, onBox)).toEqual(locked)
    expect(boxPageEarlyAnswer(true, { kind: 'none' })).toEqual(locked)
    expect(boxPageView(429, boxPageEarlyAnswer(true, blank)!.body)).toEqual({ kind: 'locked' })
    // Open: a blank or lost sticker answers for itself; a sticker on a box, or no sticker, goes on to the box.
    expect(boxPageEarlyAnswer(false, blank)).toEqual({ status: 404, body: { error: 'sticker_blank', number: 147 }, state: 'sticker_blank' })
    expect(boxPageEarlyAnswer(false, lost)).toEqual({ status: 410, body: { error: 'sticker_lost', number: 147, lostOn: '2026-11-14' }, state: 'sticker_lost' })
    expect(boxPageEarlyAnswer(false, onBox)).toBeNull()
    expect(boxPageEarlyAnswer(false, { kind: 'none' })).toBeNull()
  })

  it('the old answers still read as they did', () => {
    expect(boxPageView(404, { error: 'not_found' })).toEqual({ kind: 'not_found' })
    expect(boxPageView(404, { error: 'sticker_blank' })).toEqual({ kind: 'not_found' })
    expect(boxPageView(404, { error: 'sticker_blank', number: 'x' })).toEqual({ kind: 'not_found' })
    expect(boxPageView(410, { error: 'retired', retiredOn: '2026-11-08' }).kind).toBe('retired')
  })

  it('the box a sticker is on answers under the scanned code, with the sticker\'s number, and round-trips', () => {
    const p = buildBoxPagePayload({ container: CONTAINER, scannedCode: '9B1C0D2E', stickerNumber: 147 })
    expect(p.box.code).toBe('9B1C0D2E')
    expect(p.box.stickerNumber).toBe(147)
    expect(JSON.stringify(p)).not.toContain('job')
    expect(parseBoxPageResponse(JSON.parse(JSON.stringify(p)))).toEqual(p)
    // a label's own code carries no sticker number
    const own = buildBoxPagePayload({ container: CONTAINER, scannedCode: null, stickerNumber: null })
    expect(own.box.code).toBe('4F2A9C18')
    expect('stickerNumber' in own.box).toBe(false)
  })
})
