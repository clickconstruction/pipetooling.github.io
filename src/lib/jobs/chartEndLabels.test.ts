/**
 * The end-of-line labels as one column (v2.6718): no two overlap, none crosses a mark at the last bucket,
 * none leaves the plot, and the one whose line ends higher stays higher.
 */
import { describe, expect, it } from 'vitest'
import { END_LABEL_GAP, endLabelWidth, iconRowSpan, iconRowY, marksWithin, paymentMarkerY, placeEndLabels, type EndLabelWant } from './chartEndLabels'

const layout = { lineHeight: 15, top: 0, bottom: 300 }
const span = (c: number) => ({ top: c - 7.5, bottom: c + 7.5 })
const noOverlap = (ys: number[]) => {
  const s = [...ys].sort((a, b) => a - b)
  for (let i = 1; i < s.length; i++) expect(s[i]! - s[i - 1]!).toBeGreaterThanOrEqual(15 - 1e-9)
}

describe('placeEndLabels', () => {
  it('labels far apart sit where they want: just above or below their line', () => {
    const wants: EndLabelWant[] = [
      { key: 'cost', lineY: 100, side: 'above' },
      { key: 'cash', lineY: 200, side: 'below' },
    ]
    const y = placeEndLabels(wants, layout)
    expect(y.get('cost')).toBe(100 - END_LABEL_GAP)
    expect(y.get('cash')).toBe(200 + END_LABEL_GAP)
  })

  it('two labels wanting the same height are spread one line apart; the higher line keeps its place', () => {
    // The site's walk: true cost above its line, cost below the same line, cash just under both.
    const y = placeEndLabels(
      [
        { key: 'trueCost', lineY: 120, side: 'above' },
        { key: 'cost', lineY: 124, side: 'below' },
        { key: 'cash', lineY: 128, side: 'below' },
      ],
      layout,
    )
    expect(y.get('trueCost')).toBe(110)
    expect(y.get('cost')).toBe(134)
    expect(y.get('cash')).toBe(149)
    noOverlap([...y.values()])
  })

  it('a stack that would fall off the floor is pulled up as one column, none past the floor', () => {
    const y = placeEndLabels(
      [
        { key: 'a', lineY: 285, side: 'below' },
        { key: 'b', lineY: 290, side: 'below' },
        { key: 'c', lineY: 295, side: 'below' },
      ],
      layout,
    )
    expect(Math.max(...y.values()) + 7.5).toBeLessThanOrEqual(300)
    expect(y.get('c')).toBe(292.5)
    expect(y.get('b')).toBe(277.5)
    expect(y.get('a')).toBe(262.5)
    noOverlap([...y.values()])
  })

  it('a label never crosses a mark at the last bucket: it steps under the icon row', () => {
    const icons = iconRowSpan(iconRowY(100))
    expect(icons).toEqual({ top: 68, bottom: 92 })
    const y = placeEndLabels([{ key: 'cost', lineY: 100, side: 'above' }], { ...layout, obstacles: [icons] })
    // Wanted 90, inside the icons' band; placed just under it.
    expect(y.get('cost')).toBe(92 + 7.5)
    const bands = [span(y.get('cost')!)]
    for (const b of bands) expect(b.top < icons.bottom && icons.top < b.bottom).toBe(false)
  })

  it('pulled up past a mark, a label steps over it instead of into it', () => {
    const mark = { top: 270, bottom: 285 }
    const y = placeEndLabels(
      [
        { key: 'a', lineY: 280, side: 'below' },
        { key: 'b', lineY: 290, side: 'below' },
      ],
      { ...layout, obstacles: [mark] },
    )
    expect(y.get('b')).toBe(292.5)
    // 'a' would close up at 277.5, inside the mark; it sits above the mark instead.
    expect(y.get('a')).toBe(270 - 7.5)
    noOverlap([...y.values()])
  })

  it('the top holds: a label wanting above the chart sits at the top edge, and the rest follow under it', () => {
    const y = placeEndLabels(
      [
        { key: 'a', lineY: 2, side: 'above' },
        { key: 'b', lineY: 4, side: 'above' },
      ],
      layout,
    )
    expect(y.get('a')).toBe(7.5)
    expect(y.get('b')).toBe(22.5)
  })

  it('a tall stack of marks is cleared by the near side: a label wanting just inside its top goes over it, not under', () => {
    const y = placeEndLabels([{ key: 'cost', lineY: 110, side: 'above' }], { ...layout, obstacles: [{ top: 95, bottom: 250 }] })
    // Wanted 100; under the stack is 257.5, over it is 87.5.
    expect(y.get('cost')).toBe(87.5)
    // Two labels wanting inside the stack's top both go over it, the higher line still higher.
    const two = placeEndLabels(
      [
        { key: 'trueCost', lineY: 108, side: 'above' },
        { key: 'cost', lineY: 112, side: 'below' },
      ],
      { ...layout, obstacles: [{ top: 95, bottom: 250 }] },
    )
    expect(two.get('cost')).toBe(87.5)
    expect(two.get('trueCost')).toBe(72.5)
  })

  it('marksWithin keeps the marks whose glyphs reach into the labels’ band; endLabelWidth reads a label’s reach', () => {
    const marks = [
      { x: 100, halfWidth: 11, top: 10, bottom: 30 },
      { x: 300, halfWidth: 35, top: 40, bottom: 60 },
      { x: 500, halfWidth: 11, top: 70, bottom: 90 },
    ]
    expect(marksWithin(marks, 330, 480)).toEqual([{ top: 40, bottom: 60 }])
    expect(marksWithin(marks, 330, 492)).toHaveLength(2)
    expect(marksWithin(marks, 0, 600)).toHaveLength(3)
    expect(endLabelWidth('$1,031,650.15')).toBe(13 * 7 + 6)
  })

  it('a dense stack of many marks is cleared whole, however many: the walk at 375 wide had twenty-six', () => {
    // Marks every 12px from 100 to 400, overlapping each other, and a label wanting inside them.
    const obstacles = Array.from({ length: 26 }, (_, i) => ({ top: 100 + i * 12, bottom: 124 + i * 12 }))
    const y = placeEndLabels([{ key: 'cost', lineY: 250, side: 'below' }], { lineHeight: 15, top: 0, bottom: 600, obstacles })
    const c = y.get('cost')!
    for (const b of obstacles) expect(c - 7.5 < b.bottom && b.top < c + 7.5).toBe(false)
    // Over the stack is nearer than under it.
    expect(c).toBe(92.5)
  })

  it('an empty chart places nothing', () => {
    expect(placeEndLabels([], layout).size).toBe(0)
  })

  it('the marker helpers mirror the dot renderers: the icon row rides above the point, the 💵 flips under a point near the floor', () => {
    expect(iconRowY(10)).toBe(24)
    expect(iconRowY(200)).toBe(188)
    expect(paymentMarkerY(250)).toBe(234)
    expect(paymentMarkerY(100)).toBe(126)
  })
})
