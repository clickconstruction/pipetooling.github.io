/**
 * Figures in a lesson (punch list #116, v2.5598): the figure line parses, an unknown name or an empty caption
 * throws with the lesson's key, the registry is sorted and unique, and the drawings map holds exactly the
 * registry's names.
 */
import { describe, expect, it } from 'vitest'
import { FIGURE_NAMES, isFigureName, itemWords, lessonItems, parseFigureItem } from './figures'
import { FIGURES } from '../../components/training/figures'

describe('parseFigureItem', () => {
  it('reads a figure line into its name and caption, and a sentence into null', () => {
    expect(parseFigureItem('{{figure:clearance-stack|Five distances under the anchor.}}')).toEqual({ figure: 'clearance-stack', caption: 'Five distances under the anchor.' })
    expect(parseFigureItem('  {{figure:controls-ladder| Start at the top. }}  ')).toEqual({ figure: 'controls-ladder', caption: 'Start at the top.' })
    expect(parseFigureItem('A plain fact with **18 ft** in it.')).toBeNull()
    expect(parseFigureItem('{{button:blue|Start}}')).toBeNull()
  })

  it('throws, naming the lesson, for a figure the app does not draw or a caption that is missing', () => {
    expect(() => parseFigureItem('{{figure:no-such-drawing|Words.}}', '03-a')).toThrow(/"03-a": figure "no-such-drawing" is not drawn/)
    expect(() => parseFigureItem('{{figure:controls-ladder|   }}', '01-a')).toThrow(/has no caption/)
  })

  it('lessonItems and itemWords read a list the way the page and the plain-words rules do', () => {
    const items = lessonItems(['First fact.', '{{figure:controls-ladder|Start at the top.}}'])
    expect(items).toEqual([
      { kind: 'text', text: 'First fact.' },
      { kind: 'figure', figure: 'controls-ladder', caption: 'Start at the top.' },
    ])
    expect(itemWords('{{figure:controls-ladder|Start at the top.}}')).toBe('Start at the top.')
    expect(itemWords('First fact.')).toBe('First fact.')
  })
})

describe('the registry', () => {
  it('is sorted, unique and lower-case kebab names', () => {
    const names = [...FIGURE_NAMES]
    expect(names).toEqual([...new Set(names)].sort())
    for (const n of names) {
      expect(n).toMatch(/^[a-z0-9-]+$/)
      expect(isFigureName(n)).toBe(true)
    }
    expect(isFigureName('ladder')).toBe(false)
  })

  it('the drawings map holds exactly the registry: no drawing without a name, no name without a drawing', () => {
    expect(Object.keys(FIGURES).sort()).toEqual([...FIGURE_NAMES])
  })
})
