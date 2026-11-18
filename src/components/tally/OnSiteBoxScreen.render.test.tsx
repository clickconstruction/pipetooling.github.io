// @vitest-environment jsdom
/**
 * Render smoke for a box's own screen on the phone (punch list #398): the name and More, the parts as closed rows
 * that open one at a time, the four tiles with their facts, and what an empty box and Unsorted draw. Every name,
 * part and box is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Container, ContainerLine } from '../../lib/materials/onSite'
import OnSiteBoxScreen, { type OnSiteBoxScreenProps } from './OnSiteBoxScreen'

// Noon on the company's calendar, Wednesday Nov 18 2026.
const NOW = new Date('2026-11-18T18:00:00Z')
const box = (over: Partial<Container> = {}): Container => ({ id: 'g12', jobId: 'j1', label: 'G12', kind: 'cage', where: 'by the north stair', locationId: 'l2', lat: null, lng: null, retiredAt: null, createdAt: '2026-10-20T15:00:00Z', ...over })
const line = (name: string, onHand: number, over: Partial<ContainerLine> = {}): ContainerLine => ({ containerId: 'g12', partKey: name, partId: null, partName: name, manufacturer: null, onHand, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: 0, cannotFindSinceCount: 0, ...over })
const five = [line('2 in. PVC coupling', 31), line('2 in. PVC 90 elbow', 14, { lastCountDiff: -2 }), line('2 in. test cap', 9), line('3 in. PVC tee', 6), line('2 in. pipe hanger', 1)]

const acts = { onBack: vi.fn(), onMore: vi.fn(), onCount: vi.fn(), onAddPart: vi.fn(), onWhere: vi.fn(), onPart: vi.fn() }
const draw = (over: Partial<OnSiteBoxScreenProps> = {}) =>
  render(
    <OnSiteBoxScreen
      container={box()}
      lines={five}
      stickers=""
      said=""
      now={NOW}
      lastCount={{ at: '2026-11-17T17:00:00Z', byName: 'Mateo' }}
      place="Level 2"
      pin={null}
      photos={[{ at: '2026-11-17T17:05:00Z' }]}
      after={null}
      narrow={false}
      photoTile={({ fact, fresh }) => <button type="button" data-fresh={fresh}>Photo<span>{fact}</span></button>}
      {...acts}
      {...over}
    />,
  )

afterEach(() => { cleanup(); for (const f of Object.values(acts)) f.mockReset() })

describe('OnSiteBoxScreen', () => {
  it('opens on the name, More and the parts as closed rows with their numbers', () => {
    draw({ said: 'PVC fittings, mixed' })
    expect(screen.getByText('G12')).toBeTruthy()
    expect(screen.getByTestId('on-site-box-said').textContent).toBe('PVC fittings, mixed')
    expect(screen.getByText('In G12')).toBeTruthy()
    const rows = screen.getAllByTestId('on-site-part')
    expect(rows.map((r) => r.textContent)).toEqual(['2 in. PVC coupling31▾', '2 in. PVC 90 elbow2 missing at the last count14▾', '2 in. test cap9▾', '3 in. PVC tee6▾', '2 in. pipe hanger1▾'])
    // No part's presses are on the first screen.
    expect(screen.queryByRole('button', { name: 'Used' })).toBeNull()
    expect(screen.queryByRole('button', { name: "Can't find" })).toBeNull()
    expect(screen.getByText('Tap a part if some are missing, moved or needed.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /More for G12/ }))
    expect(acts.onMore).toHaveBeenCalledTimes(1)
  })

  it('opens a part’s four presses under it, one part at a time, and closes on a second tap', () => {
    draw()
    const elbow = screen.getByRole('button', { name: /2 in\. PVC 90 elbow/ })
    fireEvent.click(elbow)
    expect(elbow.getAttribute('aria-expanded')).toBe('true')
    const open = screen.getAllByTestId('on-site-part')[1]!
    expect(within(open).getAllByRole('button').slice(1).map((b) => b.textContent)).toEqual(['Used', 'Move to…', "Can't find", 'Ask for more'])
    fireEvent.click(within(open).getByRole('button', { name: 'Ask for more' }))
    expect(acts.onPart).toHaveBeenCalledWith('short', five[1])
    // Another part opens and the first closes.
    fireEvent.click(screen.getByRole('button', { name: /3 in\. PVC tee/ }))
    expect(elbow.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getAllByRole('button', { name: 'Used' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /3 in\. PVC tee/ }))
    expect(screen.queryByRole('button', { name: 'Used' })).toBeNull()
  })

  it('draws four tiles that each carry their fact', () => {
    draw()
    const tiles = within(screen.getByTestId('on-site-box-tiles')).getAllByRole('button')
    expect(tiles.map((t) => t.textContent)).toEqual(['Count G12Counted yesterday by Mateo', 'Photo1 so far, Nov 17', 'Add a part5 kinds in G12 now', 'Where is it?Level 2, by the north stair, no pin yet'])
    fireEvent.click(tiles[0]!)
    fireEvent.click(tiles[2]!)
    fireEvent.click(tiles[3]!)
    expect(acts.onCount).toHaveBeenCalledTimes(1)
    expect(acts.onAddPart).toHaveBeenCalledTimes(1)
    expect(acts.onWhere).toHaveBeenCalledTimes(1)
  })

  it('turns Count amber when a count is due, and tells the Photo tile what a photo now would be of', () => {
    draw({ lastCount: { at: '2026-11-02T17:00:00Z', byName: 'Mateo' }, after: 'Count' })
    const tiles = within(screen.getByTestId('on-site-box-tiles')).getAllByRole('button')
    expect(tiles[0]!.textContent).toBe('Count G12Due. Last counted 16 days ago')
    expect(tiles[0]!.style.background).toBe('var(--bg-amber-tint)')
    expect(tiles[1]!.textContent).toBe('PhotoOf G12 as you counted it')
    expect(tiles[1]!.getAttribute('data-fresh')).toBe('true')
  })

  it('offers one Add a part on an empty box, and no Count', () => {
    draw({ lines: [], photos: [], place: null, container: box({ where: '' }) })
    expect(screen.getByText('Nothing in G12 yet.')).toBeTruthy()
    const tiles = within(screen.getByTestId('on-site-box-tiles')).getAllByRole('button')
    expect(tiles.map((t) => t.textContent)).toEqual(['PhotoNone yet', 'Add a partThe first part in G12', 'Where is it?No place yet'])
    expect(screen.getAllByRole('button', { name: 'Add a part to G12' })).toHaveLength(1)
    expect(screen.queryByText('Tap a part if some are missing, moved or needed.')).toBeNull()
  })

  it('keeps a part with none left to the ask for more', () => {
    draw({ lines: [line('2 in. pipe hanger', 0, { cannotFindSinceCount: 1 })] })
    fireEvent.click(screen.getByRole('button', { name: /2 in\. pipe hanger/ }))
    const open = screen.getByTestId('on-site-part')
    expect(within(open).getByText('G12 has none left.')).toBeTruthy()
    expect(within(open).getAllByRole('button').slice(1).map((b) => b.textContent)).toEqual(['Ask for more'])
  })

  it('opens every part on Unsorted with Put in… first, and draws no More, Count, Photo or Where is it?', () => {
    draw({ container: box({ id: 'u', label: 'Unsorted', kind: 'unsorted', where: '', locationId: null }), lines: [line('2 in. PVC coupling', 12), line('3 in. PVC tee', 4)] })
    expect(screen.getAllByRole('button', { name: 'Put in…' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Move to…' })).toBeNull()
    expect(screen.queryByRole('button', { name: /More for/ })).toBeNull()
    expect(within(screen.getByTestId('on-site-box-tiles')).getAllByRole('button').map((t) => t.textContent)).toEqual(['Add a part2 kinds in Unsorted now'])
    fireEvent.click(screen.getAllByRole('button', { name: 'Put in…' })[1]!)
    expect(acts.onPart).toHaveBeenCalledWith('put-in', expect.objectContaining({ partName: '3 in. PVC tee' }))
  })

  it('draws the strips, the history and the bottom bar the tab hands in, in that order', () => {
    draw({ strips: <div data-testid="s">a take left open</div>, history: <div data-testid="h">the takes</div>, footer: <div data-testid="f">Take from G12</div> })
    const all = screen.getByTestId('on-site-box-screen').textContent ?? ''
    expect(all.indexOf('a take left open')).toBeLessThan(all.indexOf('In G12'))
    expect(all.indexOf('Photos and takes')).toBeGreaterThan(all.indexOf('Where is it?'))
    expect(all.indexOf('the takes')).toBeGreaterThan(all.indexOf('Photos and takes'))
    expect(all.indexOf('Take from G12')).toBeGreaterThan(all.indexOf('the takes'))
    cleanup()
    draw()
    expect(screen.queryByText('Photos and takes')).toBeNull()
  })
})
