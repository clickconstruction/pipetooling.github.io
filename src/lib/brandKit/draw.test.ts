import { describe, expect, it } from 'vitest'
import { drawKit, fitSize, guessTextWidth, pipePath, placePhoto, placeRows, printPage, sheetOfTen, type KitPerson } from './draw'
import { CARD, CHOSEN_LOOK, LAYOUTS, LOOKS } from './layouts'
import { cardHold, kitFileSlug, kitPersonFromUser, readCrop } from './person'

const photo = { href: 'data:image/png;base64,AAAA', w: 400, h: 600, fx: 0.5, fy: 0.4, zoom: 1 }
const dale: KitPerson = { name: 'Dale Okafor', title: 'Master Plumber', email: 'dale@example.com', mobile: '(512) 555-0177', office: '(512) 555-0100', photo }
const ys = (rows: { y: number }[]) => rows.map((r) => +r.y.toFixed(2))

describe('the pipes, as fitted to the designer’s footer', () => {
  const pipes = LAYOUTS.footer01.pipes!
  const topRight = pipes[0]!
  const bottomRight = pipes[1]!
  const bottomLeft = pipes[2]!
  it('bends the top-right run where the designer’s does', () => {
    expect(pipePath(topRight)).toBe('M1736 -60 L1736 -19.5 C1736 40.5 1766 170.5 1986 170.5 L2703 170.5')
  })
  it('keeps the bottom-right run straight', () => {
    expect(pipePath(bottomRight)).toBe('M1645 541.5 L2703 541.5')
  })
  it('bends the bottom-left run down and out of the bottom', () => {
    expect(pipePath(bottomLeft)).toBe('M5 452.5 L140 452.5 C399 452.5 441 468 441 690 L441 690')
  })
})

describe('the stack of words', () => {
  it('sets the designer’s footer rows on the designer’s baselines', () => {
    expect(ys(placeRows(LAYOUTS.footer01.words!, dale))).toEqual([349, 418])
  })
  it('sets the designer’s card lines on the designer’s uneven steps when there is no title', () => {
    expect(ys(placeRows(LAYOUTS.cardBack1.words!, { ...dale, title: '' }))).toEqual([306, 382, 436, 499])
  })
  it('closes up when a line is missing', () => {
    const rows = placeRows(LAYOUTS.cardBack1.words!, { ...dale, title: '', mobile: '' })
    expect(rows.map((r) => r.row.fact)).toEqual(['name', 'email', 'office'])
    expect(ys(rows)).toEqual([306, 382, 436])
  })
  it('puts the chosen card’s lines on even steps, under the name or under the title', () => {
    expect(ys(placeRows(LAYOUTS.cardBackReworked.words!, { ...dale, title: '' }))).toEqual([306, 382, 440, 498])
    expect(ys(placeRows(LAYOUTS.cardBackReworked.words!, dale))).toEqual([306, 345, 397, 455, 513])
  })
  it('gives a person with no title and no phone the designer’s footer exactly', () => {
    expect(ys(placeRows(LAYOUTS.footerReworked.words!, { name: 'Renee Castillo', email: 'renee@example.com' }))).toEqual([349, 418])
  })
  it('keeps four footer rows clear of the pipe under them', () => {
    const rows = placeRows(LAYOUTS.footerReworked.words!, dale)
    expect(rows.map((r) => r.row.fact)).toEqual(['name', 'title', 'email', 'mobile'])
    expect(rows[3]?.y).toBe(462)
    expect(ys(rows)).toEqual([276, 332, 398, 462])
  })
  it('shows the office line on the footer when there is no mobile', () => {
    const rows = placeRows(LAYOUTS.footerReworked.words!, { ...dale, mobile: '' })
    expect(rows[3]?.text).toBe('(512) 555-0100')
  })
  it('leaves the designer’s layouts as they were', () => {
    expect(LAYOUTS.cardBack1.words!.lineSteps).toEqual([54, 63])
    expect(LAYOUTS.cardBack1.words!.rows[2]?.dx).toBe(5)
    expect(LAYOUTS.footer01.words!.rows).toHaveLength(2)
    expect(LAYOUTS.cardBack1.orange).toBe('#e37334')
    expect(LAYOUTS.cardBackReworked.orange).toBe('#e17232')
  })
})

describe('a long line', () => {
  it('keeps its size when it fits', () => {
    expect(fitSize('Dale Okafor', 700, 69, 1129)).toBe(69)
  })
  it('shrinks to the width it is given', () => {
    const size = fitSize('Priya Ramanathan-Whitfield of Juniper', 700, 69, 1129)
    expect(size).toBeLessThan(69)
    expect(guessTextWidth('Priya Ramanathan-Whitfield of Juniper', 700, size)).toBeCloseTo(1129, 5)
  })
  it('never shrinks under 55 percent', () => {
    expect(fitSize('x'.repeat(400), 300, 56, 1129)).toBeCloseTo(56 * 0.55, 5)
  })
  it('uses the real measure when one is handed in', () => {
    expect(fitSize('abc', 300, 50, 150, () => 200)).toBe(37.5)
  })
})

describe('the photo in its ring', () => {
  it('covers the ring at zoom 1 on the short side', () => {
    const at = placePhoto(photo, 100, 100, 50)
    expect(at.w).toBe(100)
    expect(at.h).toBe(150)
    expect(at.x).toBe(50)
  })
  it('never leaves a gap, whatever the focus point', () => {
    for (const fy of [0, 0.5, 1]) {
      const at = placePhoto({ ...photo, fy }, 100, 100, 50)
      expect(at.y).toBeLessThanOrEqual(50)
      expect(at.y + at.h).toBeGreaterThanOrEqual(150)
    }
  })
  it('treats a zoom under 1 as 1', () => {
    expect(placePhoto({ ...photo, zoom: 0.2 }, 100, 100, 50).w).toBe(100)
  })
})

describe('one drawing', () => {
  it('draws the person’s words, escaped', () => {
    const svg = drawKit(LAYOUTS.footerReworked, { ...dale, name: 'Dale <b> & Sons' })
    expect(svg).toContain('Dale &lt;b&gt; &amp; Sons')
    expect(svg).toContain('viewBox="0 0 2709 625"')
  })
  it('says so in the ring when there is no photo', () => {
    expect(drawKit(LAYOUTS.footer01, { ...dale, photo: null })).toContain('No photo yet')
    expect(drawKit(LAYOUTS.footer01, dale)).not.toContain('No photo yet')
  })
  it('sets the wordmark as type and the mark as a picture', () => {
    const svg = drawKit(LAYOUTS.cardFrontReworked, null, { assets: { mark: 'mark.png', cardFrontPhoto: 'front.jpg' } })
    expect(svg).toContain('>CLICK</text>')
    expect(svg).toContain('>Plumbing</text>')
    expect(svg).toContain('href="mark.png"')
    expect(svg).toContain('href="front.jpg"')
  })
  it('gives two drawings on one page their own clip ids', () => {
    const a = drawKit(LAYOUTS.footer01, dale)
    const b = drawKit(LAYOUTS.footer01, dale)
    expect(a.match(/clipPath id="([^"]+)"/)![1]).not.toBe(b.match(/clipPath id="([^"]+)"/)![1])
  })
  it('has every layout a look names', () => {
    for (const look of Object.values(LOOKS)) for (const name of Object.values(look)) expect(LAYOUTS[name]).toBeTruthy()
    expect(CHOSEN_LOOK).toBe(LOOKS.reworked)
  })
})

describe('the print pages', () => {
  const back = drawKit(LAYOUTS.cardBackReworked, dale)
  it('puts one side on a 4.25 x 2.75 inch page at 300 to the inch', () => {
    expect(printPage(back)).toContain(`viewBox="0 0 ${CARD.w + 150} ${CARD.h + 150}"`)
    expect(printPage(back).match(/stroke="#000" stroke-width="1.5" fill="none"/g)).toHaveLength(4)
  })
  it('lays ten on a letter page with the bleed cropped off', () => {
    const sheet = sheetOfTen(back)
    expect(sheet).toContain('viewBox="0 0 2550 3300"')
    expect(sheet.match(/viewBox="37.5 37.5 1050 600"/g)).toHaveLength(10)
  })
})

describe('a person’s facts', () => {
  it('prefers the name on the card and trims every fact', () => {
    const p = kitPersonFromUser({ name: 'Renee', card_name: ' Renee Castillo ', title: null, email: 'renee@example.com', phone: ' (512) 555-0131 ' }, '(512) 555-0100', null)
    expect(p).toEqual({ name: 'Renee Castillo', title: '', email: 'renee@example.com', mobile: '(512) 555-0131', office: '(512) 555-0100', photo: null })
  })
  it('falls back to the account name', () => {
    expect(kitPersonFromUser({ name: 'Renee', card_name: '  ' }, '', null).name).toBe('Renee')
  })
  it('holds a person with no photo, no email or no name, and nobody for a missing mobile or title', () => {
    expect(cardHold({ ...dale, photo: null })).toBe('has no photo')
    expect(cardHold({ ...dale, email: '' })).toBe('has no email')
    expect(cardHold({ ...dale, name: '' })).toBe('has no name')
    expect(cardHold({ ...dale, mobile: '', title: '' })).toBeNull()
  })
  it('reads a saved crop back in range', () => {
    expect(readCrop(null)).toEqual({ fx: 0.5, fy: 0.4, zoom: 1 })
    expect(readCrop({ fx: 2, fy: -1, zoom: 99 })).toEqual({ fx: 1, fy: 0, zoom: 4 })
    expect(readCrop({ fx: 'x', fy: 0.3, zoom: 1.5 })).toEqual({ fx: 0.5, fy: 0.3, zoom: 1.5 })
  })
  it('makes a file name from a name', () => {
    expect(kitFileSlug('Priya Ramanathan-Whitfield')).toBe('priya-ramanathan-whitfield')
    expect(kitFileSlug('  ')).toBe('someone')
  })
})

describe('the kit’s files', () => {
  it('are all under public/, where the paths say', async () => {
    const { existsSync } = await import('node:fs')
    const { KIT_ASSET_PATHS, KIT_FONT_FILES } = await import('./assets')
    for (const path of [...Object.values(KIT_ASSET_PATHS), ...KIT_FONT_FILES.map((f) => f.path), 'fonts/Lexend-OFL.txt']) {
      expect(existsSync(`public/${path}`), path).toBe(true)
    }
  })
  it('name the two weights the brand sets its words in', async () => {
    const { KIT_FONT_FILES } = await import('./assets')
    const { BRAND } = await import('./layouts')
    for (const f of KIT_FONT_FILES) expect(BRAND.weights[f.weight]).toBe(f.cssWeight)
  })
})
