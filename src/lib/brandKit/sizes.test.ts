import { describe, expect, it } from 'vitest'
import { drawKit, fitSize, guessTextWidth, placeRows, type KitPerson } from './draw'
import { BRAND, CAP_HEIGHT, CARD } from './layouts'
import { LOOK_IDS, lookLayouts } from './looks'
import {
  DEFAULT_CARD_SIZES, SIZES, SIZE_IDS, cardBackFor, parseCardSizes, resolveSize, serializeCardSizes, sizeCounts, sizePrints, withDefaultSize, withSizeSwitched,
} from './sizes'

const photo = { href: 'data:image/png;base64,AAAA', w: 400, h: 600, fx: 0.5, fy: 0.4, zoom: 1 }
/** The longest person the card is promised to hold: a name of 24 letters, a long title, an email of 36, both phones. */
const long: KitPerson = { name: 'Bartholomew Featherstone', title: 'Master Plumber and Estimator', email: 'bartholomew.featherstone@example.com', mobile: '(512) 555-0177', office: '(512) 555-0100', photo }
const short: KitPerson = { name: 'Renee Castillo', email: 'renee@example.com', office: '(512) 555-0100', photo }

const SAFE = { left: CARD.bleed + CARD.safe, right: CARD.w - CARD.bleed - CARD.safe, top: CARD.bleed + CARD.safe, bottom: CARD.h - CARD.bleed - CARD.safe }

/** The right edge of each row as it is set, by the same measure the drawing uses. */
function rightEdges(look: (typeof LOOK_IDS)[number], size: (typeof SIZE_IDS)[number], person: KitPerson): number[] {
  const w = cardBackFor(look, size).words!
  return placeRows(w, person).map(({ row, text }) => {
    const weight = BRAND.weights[row.weight]
    const tracking = row.tracking ?? 0
    const set = row.fit ? fitSize(text, weight, row.size, row.fit - tracking * text.length, undefined, row.min) : row.size
    const x = row.icon ? w.icons!.textX + (row.dx ?? 0) : (row.x ?? w.x)
    return x + guessTextWidth(text, weight, set) + tracking * text.length
  })
}

describe('every size of the card back, in every look', () => {
  it('keeps the words inside the safe margin, for the longest person and the shortest', () => {
    for (const look of LOOK_IDS) {
      for (const size of SIZE_IDS) {
        for (const person of [long, short]) {
          const rows = placeRows(cardBackFor(look, size).words!, person)
          const first = rows[0]!
          const tag = `${look} ${size} ${person.name}`
          expect(first.y - CAP_HEIGHT * first.row.size, tag).toBeGreaterThanOrEqual(SAFE.top)
          expect(rows[rows.length - 1]!.y, tag).toBeLessThanOrEqual(SAFE.bottom)
          for (const edge of rightEdges(look, size, person)) expect(edge, tag).toBeLessThanOrEqual(SAFE.right + 0.01)
        }
      }
    }
  })
  it('keeps the photo inside the safe margin, its ring inside the cut, and the words clear of the ring', () => {
    for (const look of LOOK_IDS) {
      for (const size of SIZE_IDS) {
        const L = cardBackFor(look, size)
        const r = L.ring!
        const tag = `${look} ${size}`
        expect(r.cx - r.photo, tag).toBeGreaterThanOrEqual(SAFE.left)
        expect(r.cy - r.photo, tag).toBeGreaterThanOrEqual(SAFE.top)
        expect(r.cy + r.photo, tag).toBeLessThanOrEqual(SAFE.bottom)
        expect(r.cx - r.ring, tag).toBeGreaterThanOrEqual(CARD.bleed)
        expect(L.words!.x - (r.cx + r.ring), tag).toBeGreaterThanOrEqual(25)
        expect(L.words!.icons!.x, tag).toBeGreaterThanOrEqual(L.words!.x)
      }
    }
  })
  it('shrinks a line too long for the card as far as the standard card does, so a larger size holds no less', () => {
    const tooLong: KitPerson = { ...long, name: 'Bartholomew Maximilian Featherstonehaugh', email: 'bartholomew.maximilian.featherstonehaugh@example.com' }
    const standard = cardBackFor('classic', 'standard').words!
    const edge = Math.max(...rightEdges('classic', 'standard', tooLong))
    expect(edge).toBeGreaterThan(SAFE.right)
    for (const size of ['photo', 'text'] as const) {
      const w = cardBackFor('classic', size).words!
      for (const row of w.rows) expect(row.min, `${size} ${row.fact}`).toBeCloseTo(0.55 * standard.rows.find((r) => r.fact === row.fact)!.size, 5)
      // the words of the larger-photo card start a hair further right, and no more than that is lost
      expect(Math.max(...rightEdges('classic', size, tooLong)), size).toBeLessThanOrEqual(edge + Math.max(0, w.x - standard.x))
    }
  })
  it('leaves the standard card exactly as the look draws it', () => {
    for (const look of LOOK_IDS) expect(cardBackFor(look, 'standard')).toBe(lookLayouts(look).back)
  })
  it('recolours a larger size as its look does, and moves nothing between looks', () => {
    for (const size of SIZE_IDS) {
      const classic = cardBackFor('classic', size)
      for (const look of LOOK_IDS) {
        const L = cardBackFor(look, size)
        expect(L.ground, `${look} ${size}`).toBe(lookLayouts(look).back.ground)
        expect(L.orange, `${look} ${size}`).toBe(lookLayouts(look).back.orange)
        expect(placeRows(L.words!, long), `${look} ${size}`).toEqual(placeRows(classic.words!, long))
        expect(L.ring, `${look} ${size}`).toEqual(classic.ring)
      }
    }
  })
  it('is larger than the standard card on both counts, each size most on its own', () => {
    const [standard, bigPhoto, bigText] = SIZE_IDS.map(sizePrints) as [ReturnType<typeof sizePrints>, ReturnType<typeof sizePrints>, ReturnType<typeof sizePrints>]
    expect(bigPhoto.photoIn).toBeGreaterThan(bigText.photoIn)
    expect(bigText.photoIn).toBeGreaterThan(standard.photoIn)
    expect(bigText.linePt).toBeGreaterThan(bigPhoto.linePt)
    expect(bigPhoto.linePt).toBeGreaterThan(standard.linePt)
    expect(bigText.namePt).toBeGreaterThan(bigPhoto.namePt)
    expect(bigPhoto.namePt).toBeGreaterThan(standard.namePt)
    expect(standard).toEqual({ namePt: 12.5, linePt: 8.4, photoIn: 0.86 })
  })
  it('centres the words of a larger size on the card’s middle, however many lines a person has', () => {
    for (const size of ['photo', 'text'] as const) {
      for (const person of [long, short]) {
        const rows = placeRows(cardBackFor('classic', size).words!, person)
        const top = rows[0]!.y - CAP_HEIGHT * rows[0]!.row.size
        expect((top + rows[rows.length - 1]!.y) / 2, `${size} ${person.name}`).toBeCloseTo(CARD.h / 2, 5)
        expect(cardBackFor('classic', size).ring!.cy).toBe(CARD.h / 2)
      }
    }
  })
  it('draws, with the panel ending where the ring sits', () => {
    for (const size of SIZE_IDS) {
      const L = cardBackFor('navy-yellow', size)
      const svg = drawKit(L, long)
      expect(svg).toContain('Bartholomew Featherstone')
      expect(svg).toContain('fill="#f6c700"')
      expect(L.panels![0]!.points[1]![0]).toBe(L.ring!.cx)
    }
  })
  it('names each size', () => {
    expect(SIZE_IDS.map((id) => SIZES[id].name)).toEqual(['Standard', 'Larger photo', 'Larger text'])
  })
})

describe('which sizes the company offers', () => {
  it('offers only the standard card until the owner says otherwise', () => {
    expect(parseCardSizes(null)).toEqual(DEFAULT_CARD_SIZES)
    expect(parseCardSizes('not json')).toEqual(DEFAULT_CARD_SIZES)
    expect(parseCardSizes('{"approved":[],"default":"text"}')).toEqual(DEFAULT_CARD_SIZES)
    expect(parseCardSizes(null).approved).not.toBe(DEFAULT_CARD_SIZES.approved)
  })
  it('reads the setting back in the sizes’ own order, dropping a size it does not know', () => {
    const s = parseCardSizes('{"approved":["text","huge","standard","standard"],"default":"text"}')
    expect(s).toEqual({ approved: ['standard', 'text'], default: 'text' })
    expect(parseCardSizes(serializeCardSizes(s))).toEqual(s)
  })
  it('keeps the default to a size that is on', () => {
    expect(parseCardSizes('{"approved":["standard","photo"],"default":"text"}').default).toBe('standard')
  })
  it('draws a person in their pick while it is offered, and in the default once it is not', () => {
    const on = parseCardSizes('{"approved":["standard","photo"],"default":"standard"}')
    expect(resolveSize('photo', on)).toBe('photo')
    expect(resolveSize('text', on)).toBe('standard')
    expect(resolveSize(null, on)).toBe('standard')
    expect(resolveSize('something else', on)).toBe('standard')
  })
  it('will not switch the default off, and switches a size on when it becomes the default', () => {
    const s = parseCardSizes('{"approved":["standard","photo"],"default":"standard"}')
    expect(withSizeSwitched(s, 'standard', false)).toBe(s)
    expect(withSizeSwitched(s, 'photo', false)).toEqual({ approved: ['standard'], default: 'standard' })
    expect(withSizeSwitched(s, 'text', true)).toEqual({ approved: ['standard', 'photo', 'text'], default: 'standard' })
    expect(withDefaultSize(s, 'text')).toEqual({ approved: ['standard', 'photo', 'text'], default: 'text' })
  })
  it('counts a pick that is switched off on the default', () => {
    const s = parseCardSizes('{"approved":["standard","photo"],"default":"standard"}')
    expect(sizeCounts([null, 'photo', 'text', 'standard', undefined], s)).toEqual({ standard: 4, photo: 1, text: 0 })
  })
})
