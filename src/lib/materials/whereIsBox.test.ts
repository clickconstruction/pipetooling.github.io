import { describe, expect, it } from 'vitest'
import type { Container, ContainerMove, Movement, Place } from './onSite'
import { BOX_PIN_OLD_DAYS, findBoxTask, boxPinSentence, boxPinShort, foundNoFixWords, foundRoughNoteWords, foundVerdict, lastPutOf, lastTouchOf, newestPhotoWords, noPlaceAsk, stillThereAsk, whereIsBoxFar, whereIsBoxWords, whereMapPins, whereNoPinWords } from './whereIsBox'
import { PLAIN_WORDS_MAX_SENTENCE_WORDS } from '../plainWords'

// Noon on the company's calendar, Tuesday Nov 17 2026. Every name, place and point here is made up.
const NOW = new Date('2026-11-17T18:00:00Z')
const places: Place[] = [{ id: 'yard', jobId: 'j1', name: 'Laydown yard', createdAt: '' }, { id: 'l2', jobId: 'j1', name: 'Level 2', createdAt: '' }]
const box = (over: Partial<Container> = {}): Container => ({ id: 'a7', jobId: 'j1', label: 'A7', kind: 'cage', where: 'by the north fence', locationId: 'yard', lat: null, lng: null, retiredAt: null, createdAt: '2026-10-20T15:00:00Z', ...over })
const PIN = { lat: 29.5, lng: -98.4 }
const pinned = (over: Partial<Container> = {}) => box({ ...PIN, pinnedAt: '2026-11-12T15:00:00Z', pinnedByName: 'Marcus Reyes', pinAccuracyM: 5.5, ...over })
const words = (b: Container, lastPut: ReturnType<typeof lastPutOf> = null, lastTouch: ReturnType<typeof lastTouchOf> = null) => whereIsBoxWords({ box: b, places, lastPut, lastTouch, now: NOW })
/** A point this many feet due north of the pin's south. */
const feetSouth = (feet: number) => ({ lat: PIN.lat - (feet * 0.3048) / 111_195, lng: PIN.lng })

describe('whereIsBoxWords', () => {
  it('a pin and a place: leads with the place, then the pin with its day, its person and its margin', () => {
    const w = words(pinned(), null, { at: '2026-11-12T15:05:00Z', byName: 'Marcus Reyes', counted: true })
    expect(w.lead).toBe('A7 is at Laydown yard, by the north fence.')
    expect(w.lines).toEqual(['Pinned on Nov 12 by Marcus Reyes, within 20 ft.', 'Marcus Reyes counted it last, on Nov 12.'])
    expect(w).toMatchObject({ pinned: true, placed: true, old: null })
  })

  it('a place and no pin: leads with nobody having pinned it, then where it was last put and by whom', () => {
    const w = words(box(), { at: '2026-10-28T16:00:00Z', byName: 'Marcus Reyes', toLocationId: 'yard' })
    expect(w.lead).toBe('Nobody has pinned A7.')
    expect(w.lines).toEqual(['It is at Laydown yard, by the north fence.', 'Marcus Reyes put it there on Oct 28.'])
    expect(w.pinned).toBe(false)
  })

  it('a move to another place than the one it stands in is not said as how it got here', () => {
    expect(words(box(), { at: '2026-10-28T16:00:00Z', byName: 'Marcus Reyes', toLocationId: 'l2' }).lines).toEqual(['It is at Laydown yard, by the north fence.'])
  })

  it('a pin and no place: says it has no place yet, and the note on its own line', () => {
    const w = words(pinned({ locationId: null }))
    expect(w.lead).toBe('A7 has no place yet.')
    expect(w.lines).toEqual(['The note says: by the north fence.', 'Pinned on Nov 12 by Marcus Reyes, within 20 ft.'])
    expect(w.placed).toBe(false)
  })

  it('neither a pin nor a place nor a note: two short sentences', () => {
    const w = words(box({ locationId: null, where: '' }))
    expect([w.lead, ...w.lines]).toEqual(['Nobody has pinned A7.', 'It has no place yet.'])
  })

  it('a pin made today reads today, and one dragged by hand has no margin', () => {
    expect(boxPinSentence(pinned({ pinnedAt: '2026-11-17T14:00:00Z', pinnedByName: 'Priya Nair', pinAccuracyM: null }), NOW)).toBe('Pinned today by Priya Nair.')
  })

  it('a pin with no name still says its day, and a pin from before the day was kept says so', () => {
    expect(boxPinSentence(pinned({ pinnedByName: null }), NOW)).toBe('Pinned on Nov 12, within 20 ft.')
    expect(boxPinSentence(pinned({ pinnedAt: null }), NOW)).toBe('Pinned on the map. The day was not kept.')
    expect(boxPinSentence(box(), NOW)).toBeNull()
  })

  it('an evening pin reads on the company’s day, not the next one', () => {
    // 9 PM Central on Nov 12 is Nov 13 on the UTC clock.
    expect(boxPinSentence(pinned({ pinnedAt: '2026-11-13T03:00:00Z', pinAccuracyM: null }), NOW)).toBe('Pinned on Nov 12 by Marcus Reyes.')
  })

  it('a pin older than the limit carries a caution, in weeks and then in months', () => {
    expect(BOX_PIN_OLD_DAYS).toBe(30)
    expect(words(pinned({ pinnedAt: '2026-10-18T15:00:00Z' })).old).toBeNull()
    expect(words(pinned({ pinnedAt: '2026-10-06T15:00:00Z' })).old).toBe('That pin is 6 weeks old. Boxes get moved. If A7 is not there, look near it, then press I found it.')
    expect(words(pinned({ pinnedAt: '2026-08-10T15:00:00Z' })).old).toContain('That pin is 3 months old.')
  })

  it('a where note that ends in a full stop is not said with two', () => {
    expect(words(pinned({ where: 'By the north stair.' })).lead).toBe('A7 is at Laydown yard, By the north stair.')
  })

  it('every sentence it can write is within the plain-words length', () => {
    const all = [
      ...Object.values(words(pinned({ pinnedAt: '2026-10-06T15:00:00Z' }), null, { at: '2026-11-12T15:05:00Z', byName: 'Marcus Reyes', counted: false })).flat(),
      ...Object.values(words(box(), { at: '2026-10-28T16:00:00Z', byName: 'Marcus Reyes', toLocationId: 'yard' })).flat(),
      whereNoPinWords('A7'),
      foundNoFixWords('A7', 'refused'), foundNoFixWords('A7', 'none'), foundNoFixWords('A7', 'failed'),
      noPlaceAsk('A7'),
    ].filter((x): x is string => typeof x === 'string')
    for (const text of all) for (const sentence of text.split(/(?<=[.?])\s+/)) expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(PLAIN_WORDS_MAX_SENTENCE_WORDS)
  })
})

describe('boxPinShort', () => {
  it('is the box screen’s short mark', () => {
    expect(boxPinShort(pinned(), NOW)).toBe('pinned Nov 12')
    expect(boxPinShort(pinned({ pinnedAt: '2026-11-17T14:00:00Z' }), NOW)).toBe('pinned today')
    expect(boxPinShort(pinned({ pinnedAt: null }), NOW)).toBe('pinned on the map')
    expect(boxPinShort(box(), NOW)).toBeNull()
  })
})

describe('whereIsBoxFar', () => {
  it('says 40 ft, 500 ft and 5,000 ft the way a task’s place does, with about in front', () => {
    expect(whereIsBoxFar({ ...feetSouth(40), accuracyM: 6 }, PIN).lead).toBe('About 40 ft north of you.')
    expect(whereIsBoxFar({ ...feetSouth(500), accuracyM: 6 }, PIN).lead).toBe('About 500 ft north of you.')
    expect(whereIsBoxFar({ ...feetSouth(5000), accuracyM: 6 }, PIN).lead).toBe('About 0.9 mi north of you.')
  })

  it('says how sure the phone is and that the line is straight', () => {
    const far = whereIsBoxFar({ ...feetSouth(240), accuracyM: 7 }, PIN)
    expect(far).toMatchObject({ sure: 'Your phone is sure within 25 ft.', note: 'The line is straight. It knows no fence, wall or gate.', rough: false, here: false })
  })

  it('inside about 30 ft it stops counting', () => {
    expect(whereIsBoxFar({ ...feetSouth(20), accuracyM: 5 }, PIN)).toMatchObject({ lead: 'You are at the pin.', note: null, here: true })
  })

  it('a wide margin makes the line a rough guide, and never says the reader is at the pin', () => {
    const far = whereIsBoxFar({ ...feetSouth(20), accuracyM: 80 }, PIN)
    expect(far).toMatchObject({ rough: true, here: false, sure: 'Your phone is only sure within 270 ft.', note: 'You may be indoors. The line is a rough guide here. Go by the place, the note and the photo.' })
    expect(far.lead).toBe('About 20 ft north of you.')
  })

  it('a reading with no margin says nothing about how sure it is', () => {
    expect(whereIsBoxFar({ ...feetSouth(240), accuracyM: null }, PIN).sure).toBeNull()
  })
})

describe('foundVerdict', () => {
  it('takes a reading the phone is sure of, and says how sure', () => {
    expect(foundVerdict('A7', { ...PIN, accuracyM: 4.2 })).toEqual({ ok: true, pin: PIN, accuracyM: 4.2, words: 'A7 is pinned where you stand. Your phone was sure within 15 ft.' })
    expect(foundVerdict('A7', { ...PIN, accuracyM: 46 }).ok).toBe(true)
  })

  it('refuses a reading worse than about 150 ft, in words', () => {
    expect(foundVerdict('A7', { ...PIN, accuracyM: 120 })).toEqual({ ok: false, words: 'Your phone is only sure within 400 ft. A7 was not pinned. Try again in the open, or move the pin by hand.' })
    expect(foundVerdict('A7', { ...PIN, accuracyM: 47 }).ok).toBe(false)
  })

  it('refuses a reading that does not say how sure it is', () => {
    expect(foundVerdict('A7', { ...PIN, accuracyM: null })).toEqual({ ok: false, words: 'Your phone did not say how sure it is. A7 was not pinned. Try again in the open, or move the pin by hand.' })
  })

  it('refuses a rough reading too, and has the words for after the Precise Location line (#402)', () => {
    expect(foundVerdict('A7', { ...PIN, accuracyM: 3200 }).ok).toBe(false)
    // The open sky is not the cure for a phone that gives only an area: the switch is.
    expect(foundRoughNoteWords('A7', 'iphone-safari')).toBe('A7 was not pinned. Move the pin by hand, or turn the switch on and try again.')
    expect(foundRoughNoteWords('A7', 'android')).toBe('A7 was not pinned. Move the pin by hand, or turn the switch on and try again.')
    expect(foundRoughNoteWords('A7', 'other')).toBe('A7 was not pinned. Move the pin by hand.')
    for (const kind of ['iphone-safari', 'other'] as const) {
      for (const sentence of foundRoughNoteWords('A7', kind).split(/(?<=[.?!])\s+/)) expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(PLAIN_WORDS_MAX_SENTENCE_WORDS)
    }
  })
})

describe('after I found it', () => {
  it('asks whether the place changed too, or offers the one press that gives a box a place', () => {
    expect(stillThereAsk('A7', places, 'yard')).toBe('Is A7 still at Laydown yard?')
    expect(stillThereAsk('A7', places, null)).toBeNull()
    expect(noPlaceAsk('A7')).toBe('Move box gives A7 a place.')
    expect(newestPhotoWords('2026-11-12T15:00:00Z', NOW)).toBe('The newest photo, from Nov 12.')
    expect(newestPhotoWords('2026-11-17T15:00:00Z', NOW)).toBe('The newest photo, from today.')
    expect(newestPhotoWords(null, NOW)).toBe('The newest photo.')
  })
})

describe('lastPutOf and lastTouchOf', () => {
  const move = (id: string, to: string | null, at: string, containerId = 'a7'): ContainerMove => ({ id, jobId: 'j1', containerId, fromLocationId: null, toLocationId: to, byName: 'Marcus Reyes', at })
  const row = (id: string, reason: Movement['reason'], at: string, from: string | null, to: string | null, byName = 'Priya Nair'): Movement => ({ id, jobId: 'j1', partId: null, partName: 'Elbow', manufacturer: null, quantity: 1, reason, fromContainerId: from, toContainerId: to, note: '', byUserId: null, byName, at, source: null, itemId: null })

  it('the newest move of this box into a place', () => {
    expect(lastPutOf([move('m1', 'l2', '2026-10-20T10:00:00Z'), move('m2', 'yard', '2026-10-28T16:00:00Z'), move('m3', 'l2', '2026-11-01T10:00:00Z', 'b1'), move('m4', null, '2026-11-02T10:00:00Z')], 'a7')).toEqual({ at: '2026-10-28T16:00:00Z', byName: 'Marcus Reyes', toLocationId: 'yard' })
    expect(lastPutOf([], 'a7')).toBeNull()
  })

  it('the newest count wins, else the newest press on anything in the box', () => {
    const ledger = [row('a', 'delivered', '2026-11-01T10:00:00Z', null, 'a7'), row('b', 'counted', '2026-11-02T10:00:00Z', 'a7', 'a7', 'Marcus Reyes'), row('c', 'used', '2026-11-05T10:00:00Z', 'a7', null)]
    expect(lastTouchOf(ledger, 'a7')).toEqual({ at: '2026-11-02T10:00:00Z', byName: 'Marcus Reyes', counted: true })
    expect(lastTouchOf([ledger[0]!, ledger[2]!], 'a7')).toEqual({ at: '2026-11-05T10:00:00Z', byName: 'Priya Nair', counted: false })
    expect(lastTouchOf(ledger, 'b9')).toBeNull()
  })
})

describe('whereMapPins', () => {
  it('draws the box, and the other live pinned boxes of its place faint', () => {
    const others = [
      box({ id: 'a3', label: 'A3', lat: 29.5001, lng: -98.4001 }),
      box({ id: 'b1', label: 'B1', locationId: 'l2', lat: 29.6, lng: -98.5 }),
      box({ id: 'a9', label: 'A9', lat: 29.5002, lng: -98.4002, retiredAt: '2026-11-01T00:00:00Z' }),
      box({ id: 'a4', label: 'A4' }),
    ]
    expect(whereMapPins(pinned(), [pinned(), ...others], NOW)).toEqual([
      { id: 'a3', label: 'A3', lat: 29.5001, lng: -98.4001, tone: 'dim' },
      { id: 'a7', label: 'A7', ...PIN, tone: 'target' },
    ])
    expect(whereMapPins(pinned({ pinnedAt: '2026-10-06T15:00:00Z' }), [], NOW)[0]!.tone).toBe('target-old')
    expect(whereMapPins(box(), others, NOW).map((p) => p.id)).toEqual(['a3'])
  })
})

describe('findBoxTask — Send someone to it (step 5)', () => {
  it('a pinned box in a place with a way: the title, the pin as the task’s place, the way as its map', () => {
    expect(findBoxTask({ box: pinned(), places, way: { id: 'way-1', name: 'The way to Laydown yard' } })).toEqual({
      title: 'Find A7 at Laydown yard, by the north fence',
      links: [],
      place: { ...PIN, name: 'A7 at Laydown yard', accuracyM: 5.5, mapId: 'way-1', mapName: 'The way to Laydown yard' },
    })
  })
  it('a pin with no way carries no map, and a pin dragged by hand no margin', () => {
    expect(findBoxTask({ box: pinned({ pinAccuracyM: null }), places }).place).toEqual({ ...PIN, name: 'A7 at Laydown yard', accuracyM: null })
  })
  it('a box nobody pinned still makes a task, with its words and no dot', () => {
    expect(findBoxTask({ box: box(), places, way: { id: 'way-1', name: 'The way to Laydown yard' } })).toEqual({ title: 'Find A7 at Laydown yard, by the north fence', links: [] })
    expect(findBoxTask({ box: box({ locationId: null }), places })).toEqual({ title: 'Find A7, by the north fence', links: [] })
    expect(findBoxTask({ box: box({ locationId: null, where: '' }), places })).toEqual({ title: 'Find A7', links: [] })
  })
  it('the place’s name fits a task place’s length', () => {
    const long: Place[] = [{ id: 'yard', jobId: 'j1', name: 'The far laydown yard behind the east parking garage', createdAt: '' }]
    expect(findBoxTask({ box: pinned(), places: long }).place!.name.length).toBeLessThanOrEqual(40)
  })
})
