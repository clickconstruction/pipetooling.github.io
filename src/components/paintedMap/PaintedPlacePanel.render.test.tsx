// @vitest-environment jsdom
/**
 * The place panel under **Put the dot where I am** (punch list #402, call 5). One reading, asked
 * for by the press: the Precise Location line says how it did. A rough reading says the dot was not
 * moved and shows the way to the switch. With no reading taken on this visit the panel says nothing
 * of the phone. A press that got no reading at all says why in the same place, under the press.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const browser = vi.hoisted(() => ({ kind: 'iphone-safari' as string }))
vi.mock('../../hooks/usePreciseLocation', () => ({ usePhoneKind: () => browser.kind }))
/** The camera, stood in for: it keeps each file the sheet hands it, and a test may put a shot in it. */
const camera = vi.hoisted(() => ({ picked: [] as File[], shot: null as null | { id: string; blob: Blob; previewUrl: string } }))
vi.mock('../../hooks/useTaskShot', () => ({ useTaskShot: () => ({ shot: camera.shot, shrinking: false, kept: false, error: null, pick: async (file: File) => { camera.picked.push(file) }, clear: () => {}, markKept: () => {} }) }))

/** A place's other photos, stood in for (punch list #413, step 7): the saved ones, and what a test puts in as picked. */
const morePhotos = vi.hoisted(() => ({ added: [] as Array<{ id: string; blob: Blob; previewUrl: string }> }))
vi.mock('../../hooks/usePlaceMorePhotos', async () => {
  const { useState } = await import('react')
  return {
    usePlaceMorePhotos: (saved: ReadonlyArray<{ path: string; at: string | null; by: string | null }> | null | undefined) => {
      const [kept, setKept] = useState([...(saved ?? [])])
      const [added, setAdded] = useState(morePhotos.added)
      return {
        kept,
        added,
        shrinking: false,
        error: null,
        canAdd: kept.length + added.length < 12,
        pick: async (file: File) => setAdded((a) => [...a, { id: `new-${a.length + 1}`, blob: file, previewUrl: `blob:new-${a.length + 1}` }]),
        removeKept: (path: string) => setKept((k) => k.filter((p) => p.path !== path)),
        removeAdded: (id: string) => setAdded((a) => a.filter((p) => p.id !== id)),
      }
    },
  }
})

import type { MyFixFailure } from '../../lib/materials/myLocation'
import { PaintedPlacePanel } from './PaintedPlacePanel'

const presses = { onUseWhereIAm: vi.fn(), onSave: vi.fn(), onRemove: vi.fn(), onCancel: vi.fn() }
type More = { accuracyM?: number | null; roughAccuracyM?: number | null; noFix?: MyFixFailure | null; movedOffReading?: boolean; finding?: boolean }
const panel = (more: More = {}) => <PaintedPlacePanel place={null} photoUrl={null} accuracyM={more.accuracyM ?? null} roughAccuracyM={more.roughAccuracyM ?? null} noFix={more.noFix ?? null} movedOffReading={more.movedOffReading ?? false} finding={more.finding ?? false} busy={false} canRemove={false} {...presses} />
const draw = (more: More = {}) => render(panel(more))

const fix = () => document.querySelector('[data-painted-place-fix]')
const HINT = 'Drag the blue dot onto the spot, or press the map to bring it there. Your phone is read once, on that press, and not followed.'

afterEach(() => {
  cleanup()
  browser.kind = 'iphone-safari'
  camera.picked = []
  camera.shot = null
  morePhotos.added = []
  Object.values(presses).forEach((p) => p.mockClear())
})

describe('PaintedPlacePanel and one reading of the phone', () => {
  it('says how the press works before any reading, and nothing of the phone', () => {
    draw()
    expect(screen.getByText(HINT)).toBeTruthy()
    expect(document.querySelector('[data-precise]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Put the dot where I am' }))
    expect(presses.onUseWhereIAm).toHaveBeenCalledTimes(1)
  })

  it('holds the press while the phone is read', () => {
    draw({ finding: true })
    expect((screen.getByRole('button', { name: 'Finding you…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a sure reading: the switch is on, with the tick', () => {
    draw({ accuracyM: 4.5 })
    expect(fix()?.getAttribute('data-painted-place-fix')).toBe('read')
    expect(fix()?.textContent).toBe('Precise Location is on. Sure within 15 ft.')
    expect(fix()?.querySelector('[data-precise-tick]')).toBeTruthy()
    expect(screen.queryByText(HINT)).toBeNull()
  })

  it('a weak reading: one amber box, and a drag the rest of the way', () => {
    draw({ accuracyM: 35 })
    expect(fix()?.textContent).toBe('Precise Location is on, but the signal is weak here. Your phone is only sure within 120 ft. Drag the dot onto the spot.')
    cleanup()
    draw({ accuracyM: 300 })
    expect(fix()?.textContent).toBe('The signal is weak here. Your phone is only sure within 990 ft. Drag the dot onto the spot.')
  })

  it('a rough reading: the dot was not moved, why, and the steps for this phone', () => {
    draw({ roughAccuracyM: 3200 })
    expect(fix()?.getAttribute('data-painted-place-fix')).toBe('rough')
    const alert = screen.getByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(alert.querySelector('[data-precise-compare]')?.textContent).toBe('Your phone nowwithin 2 milesWith Precise Location onwithin 20 ft')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('The dot was not moved. Drag it onto the spot by hand, or turn the switch on and press again.')
    expect([...alert.querySelectorAll('ol[data-precise-steps] li')].map((li) => li.textContent)).toEqual(['Open the Settings app.', 'Tap Privacy & Security, then Location Services.', 'Tap Safari Websites.', 'Turn on Precise Location.', 'Come back to this screen.'])
    // The press stays live: turning the switch on and pressing again is one of the two ways on.
    expect((screen.getByRole('button', { name: 'Put the dot where I am' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('brings a rough reading’s words into view, since nothing on the map moved to show the press did anything', () => {
    const seen: Array<string | null> = []
    Element.prototype.scrollIntoView = function (this: Element) {
      seen.push(this.getAttribute('data-painted-place-fix'))
    }
    try {
      const view = draw({ accuracyM: 4.5 })
      expect(seen).toEqual([])
      view.rerender(<PaintedPlacePanel place={null} photoUrl={null} accuracyM={4.5} roughAccuracyM={3200} movedOffReading={false} finding={false} busy={false} canRemove={false} {...presses} />)
      expect(seen).toEqual(['rough'])
      // The same rough answer drawn again does not pull the panel about.
      view.rerender(<PaintedPlacePanel place={null} photoUrl={null} accuracyM={4.5} roughAccuracyM={3200} movedOffReading={false} finding busy={false} canRemove={false} {...presses} />)
      expect(seen).toEqual(['rough'])
    } finally {
      delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView
    }
  })

  it('a rough reading wins over an earlier good one: the newest press is what is spoken of', () => {
    draw({ accuracyM: 4.5, roughAccuracyM: 3200 })
    expect(fix()?.getAttribute('data-painted-place-fix')).toBe('rough')
    expect(document.querySelectorAll('[data-precise]')).toHaveLength(1)
  })

  it('on Android the switch has Android’s name', () => {
    browser.kind = 'android'
    draw({ roughAccuracyM: 3200 })
    expect(screen.getByRole('alert').querySelector('b')?.textContent).toBe('Precise location looks off.')
    expect(screen.getByRole('alert').textContent).toContain('Turn on Use precise location.')
  })

  it('on a desk no switch is named, in the line or in the note', () => {
    browser.kind = 'other'
    draw({ roughAccuracyM: 3200 })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('This device only knows the area it is in. It is only sure within 2 miles. The dot was not moved. Drag it onto the spot by hand.')
    expect(alert.textContent).not.toMatch(/the switch/)
    cleanup()
    draw({ accuracyM: 4.5 })
    expect(fix()?.textContent).toBe('Found you. Sure within 15 ft.')
  })

  it('says the dot was moved by hand once it is off its reading', () => {
    draw({ movedOffReading: true })
    expect(screen.getByRole('status').textContent).toBe('You moved the dot. The place is where the dot is now.')
    expect(document.querySelector('[data-precise]')).toBeNull()
  })
})

describe('PaintedPlacePanel and a press that got no reading (#402)', () => {
  const WORDS: Record<MyFixFailure, string> = {
    failed: 'Your phone did not find you in time. The dot was not moved. Drag it onto the spot, or press Put the dot where I am again.',
    refused: 'Location is off for this app. The dot was not moved. Drag it onto the spot, or allow location in the phone’s settings and press again.',
    none: 'This device gives no location. The dot was not moved. Drag it onto the spot by hand.',
  }

  it('says why in an amber alert right under the press, with the press live again', () => {
    for (const why of ['failed', 'refused', 'none'] as const) {
      draw({ noFix: why })
      const alert = screen.getByRole('alert')
      expect(fix(), why).toBe(alert)
      expect(alert.getAttribute('data-painted-place-fix'), why).toBe('no-reading')
      expect(alert.getAttribute('data-painted-place-no-fix'), why).toBe(why)
      expect(alert.textContent, why).toBe(WORDS[why])
      expect(alert.textContent, why).not.toMatch(/Drag the map/)
      expect(alert.style.background, why).toBe('var(--bg-amber-tint)')
      expect(alert.style.color, why).toBe('var(--text-amber-800)')
      // Right under the press: the press is the alert's own neighbour above it.
      const button = screen.getByRole('button', { name: 'Put the dot where I am' }) as HTMLButtonElement
      expect(alert.previousElementSibling, why).toBe(button)
      expect(button.disabled, why).toBe(false)
      expect(screen.queryByText(HINT), why).toBeNull()
      cleanup()
    }
  })

  it('stands in for the line: an older reading, weak or rough, is not what the press is seen to answer', () => {
    draw({ accuracyM: 300, noFix: 'failed' })
    expect(document.querySelectorAll('[data-painted-place-fix]')).toHaveLength(1)
    expect(document.querySelector('[data-precise]')).toBeNull()
    expect(screen.getByRole('alert').textContent).toBe(WORDS.failed)
    cleanup()
    draw({ accuracyM: 4.5, roughAccuracyM: 3200, noFix: 'refused' })
    expect(document.querySelectorAll('[data-painted-place-fix]')).toHaveLength(1)
    expect(document.querySelector('[data-precise]')).toBeNull()
    expect(screen.getByRole('alert').textContent).toBe(WORDS.refused)
    cleanup()
    draw({ movedOffReading: true, noFix: 'failed' })
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('alert').textContent).toBe(WORDS.failed)
  })

  it('brings the reason into view when the press answers, and again when a second press fails the same way', () => {
    const seen: Array<string | null> = []
    Element.prototype.scrollIntoView = function (this: Element) {
      seen.push(this.getAttribute('data-painted-place-fix'))
    }
    try {
      // A rough alert from an earlier press, then the press is made again.
      const view = draw({ roughAccuracyM: 3200 })
      expect(seen).toEqual(['rough'])
      view.rerender(panel({ roughAccuracyM: 3200, finding: true }))
      expect(seen).toEqual(['rough'])
      // The phone does not answer in time.
      view.rerender(panel({ noFix: 'failed' }))
      expect(seen).toEqual(['rough', 'no-reading'])
      // The same answer drawn again does not pull the panel about.
      view.rerender(panel({ noFix: 'failed' }))
      expect(seen).toEqual(['rough', 'no-reading'])
      // A third press holds the reason while the phone is read, and scrolls nothing until it answers.
      view.rerender(panel({ noFix: 'failed', finding: true }))
      expect(screen.getByRole('alert').textContent).toBe(WORDS.failed)
      expect(seen).toEqual(['rough', 'no-reading'])
      view.rerender(panel({ noFix: 'failed' }))
      expect(seen).toEqual(['rough', 'no-reading', 'no-reading'])
      // A reading takes the reason away, and a good reading moves the dot: the map itself shows the press worked.
      view.rerender(panel({ accuracyM: 4.5 }))
      expect(screen.queryByRole('alert')).toBeNull()
      expect(seen).toEqual(['rough', 'no-reading', 'no-reading'])
    } finally {
      delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView
    }
  })
})

/**
 * The sheet's presses since punch list #413 (Taunya's three changes of 2026-11-21): the kinds are big
 * presses, **Buried line** asks what is buried, **＋ Something else** is one wide press that hands
 * the name box the keyboard, and the words are a description as long as the person needs.
 */
describe('PaintedPlacePanel, what is here and what is buried', () => {
  const kind = (k: string) => document.querySelector(`[data-place-kind="${k}"]`) as HTMLButtonElement
  const other = (where: 'top' | 'buried') => document.querySelector(`[data-place-kind-else="${where}"]`) as HTMLButtonElement
  const nameBox = () => document.querySelector('[data-place-name]') as HTMLInputElement
  const save = () => fireEvent.click(document.querySelector('[data-painted-place-save]') as HTMLButtonElement)
  const saved = () => presses.onSave.mock.calls[presses.onSave.mock.calls.length - 1]?.[0] as { name: string; words: string; kind: string | null }

  it('offers each kind as a press 56 px tall, two to a row, and Something else the full width', () => {
    draw()
    const kinds = [...document.querySelectorAll('[data-place-kinds] > [data-place-kind]')] as HTMLButtonElement[]
    expect(kinds.map((b) => b.textContent)).toEqual(['Gate', 'Park here', 'Door', 'Meter', 'Shutoff', 'Cleanout', 'Buried line', 'Hazard'])
    expect(kinds.every((b) => b.style.minHeight === '56px')).toBe(true)
    expect((document.querySelector('[data-place-kinds]') as HTMLElement).style.gridTemplateColumns).toBe('1fr 1fr')
    expect(other('top').textContent).toBe('＋ Something else')
    expect(other('top').style.minHeight).toBe('56px')
    expect(other('top').style.gridColumn).toBe('1 / -1')
    expect((document.querySelector('[data-painted-place-save]') as HTMLButtonElement).style.minHeight).toBe('56px')
  })

  it('asks what is buried only once Buried line is pressed', () => {
    draw()
    expect(document.querySelector('[data-place-buried]')).toBeNull()
    fireEvent.click(kind('buried'))
    expect(kind('buried').getAttribute('aria-pressed')).toBe('true')
    const block = document.querySelector('[data-place-buried]') as HTMLElement
    expect(block.textContent).toContain('What is buried?')
    expect([...block.querySelectorAll('[data-place-kind]')].map((b) => b.textContent)).toEqual(['Water', 'Sewer', 'Gas', 'Electric', 'Irrigation', 'Cable'])
    expect(block.textContent).toContain('The colors are the ones a locator paints on the ground.')
    expect(nameBox().value).toBe('Buried line')
  })

  it('names the place for what is buried, keeps Buried line pressed, and saves that kind', () => {
    draw()
    fireEvent.click(kind('buried'))
    fireEvent.click(kind('buried_sewer'))
    expect(kind('buried_sewer').getAttribute('aria-pressed')).toBe('true')
    expect(kind('buried').getAttribute('aria-pressed')).toBe('true')
    expect(nameBox().value).toBe('Buried sewer line')
    save()
    expect(saved()).toMatchObject({ name: 'Buried sewer line', kind: 'buried_sewer' })
  })

  it('takes an answer off on a second press and leaves a buried line, and takes the whole kind off from Buried line', () => {
    draw()
    fireEvent.click(kind('buried'))
    fireEvent.click(kind('buried_gas'))
    fireEvent.click(kind('buried_gas'))
    expect(nameBox().value).toBe('Buried line')
    expect(kind('buried').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(kind('buried'))
    expect(document.querySelector('[data-place-buried]')).toBeNull()
    expect(nameBox().value).toBe('')
    save()
    expect(saved()).toMatchObject({ kind: null })
  })

  it('Something else clears a name a press gave, takes the mark off and asks what it is', () => {
    draw()
    fireEvent.click(kind('cleanout'))
    expect(nameBox().value).toBe('Cleanout')
    fireEvent.click(other('top'))
    expect(other('top').getAttribute('aria-pressed')).toBe('true')
    expect(kind('cleanout').getAttribute('aria-pressed')).toBe('false')
    expect(nameBox().value).toBe('')
    expect(screen.getByLabelText('What is it?')).toBe(nameBox())
    fireEvent.change(nameBox(), { target: { value: 'Septic tank lid' } })
    save()
    expect(saved()).toMatchObject({ name: 'Septic tank lid', kind: null })
  })

  it('Something else under What is buried? stays a buried line with a name to type', () => {
    draw()
    fireEvent.click(kind('buried'))
    fireEvent.click(kind('buried_water'))
    fireEvent.click(other('buried'))
    expect(other('buried').getAttribute('aria-pressed')).toBe('true')
    expect(kind('buried_water').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByLabelText('What is buried?')).toBe(nameBox())
    fireEvent.change(nameBox(), { target: { value: 'Conduit for the gate' } })
    save()
    expect(saved()).toMatchObject({ name: 'Conduit for the gate', kind: 'buried' })
  })

  it('a kind pressed after Something else puts the name box back to Name', () => {
    draw()
    fireEvent.click(other('top'))
    fireEvent.click(kind('meter'))
    expect(other('top').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByLabelText('Name')).toBe(nameBox())
    expect(nameBox().value).toBe('Meter')
  })

  it('takes a description far past one line, and hands it over whole', () => {
    draw()
    const box = screen.getByLabelText('Describe it') as HTMLTextAreaElement
    expect(box.tagName).toBe('TEXTAREA')
    expect(box.maxLength).toBe(4000)
    const words = '4 in. PVC sewer, from the house to the tap at the street.\nAbout 4 ft deep at the walk and 6 ft at the curb.\n' + 'It runs straight. '.repeat(40)
    fireEvent.change(box, { target: { value: words } })
    save()
    expect(saved().words).toBe(words)
    expect(screen.getByText('As much as you need. What it is, how deep, which way it runs.')).toBeTruthy()
    expect(screen.getByText('Never type a gate code or a lock code here. Anyone this map is shared with would read it.')).toBeTruthy()
  })
})

/** A place that starts from a photo (punch list #413, **Photo of a spot**): the sheet is handed the photo. */
describe('PaintedPlacePanel, opened with a photo', () => {
  const file = new File(['x'], 'spot.jpg', { type: 'image/jpeg' })
  const withShot = (more: { note?: string | null } = {}) => render(<PaintedPlacePanel place={null} photoUrl={null} accuracyM={6} movedOffReading={false} finding={false} busy={false} canRemove={false} startShot={file} note={more.note ?? null} {...presses} />)
  const order = () => [...document.querySelectorAll('[data-painted-place-panel] > *')].map((el) => (el.hasAttribute('data-place-photo') ? 'photo' : el.hasAttribute('data-place-note') ? 'note' : el.querySelector('[data-place-kinds]') ? 'kinds' : 'other'))

  it('reads the photo it was handed once, and shows the photo before what it is', () => {
    camera.shot = { id: 'shot-1', blob: new Blob(['x']), previewUrl: 'blob:spot' }
    withShot()
    expect(camera.picked).toEqual([file])
    expect(order().slice(0, 2)).toEqual(['photo', 'kinds'])
    expect(document.querySelector('[data-place-photo]')?.getAttribute('data-place-photo')).toBe('first')
    const img = document.querySelector('[data-place-photo] img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('blob:spot')
    expect(img.style.width).toBe('100%')
  })

  it('hands the photo over with the place', () => {
    camera.shot = { id: 'shot-1', blob: new Blob(['x']), previewUrl: 'blob:spot' }
    withShot()
    fireEvent.click(document.querySelector('[data-painted-place-save]') as HTMLButtonElement)
    expect(presses.onSave.mock.calls[0]?.[0].photo).toMatchObject({ kind: 'new', id: 'shot-1' })
  })

  it('says at the top why the dot is not where the person stands', () => {
    withShot({ note: 'This photo was taken 6 hours ago. You are not there now, so the dot was not put where you stand. Drag it onto the spot.' })
    expect(order().slice(0, 3)).toEqual(['note', 'photo', 'kinds'])
    expect(document.querySelector('[data-place-note]')?.getAttribute('role')).toBe('status')
    expect(document.querySelector('[data-place-note]')?.textContent).toBe('This photo was taken 6 hours ago. You are not there now, so the dot was not put where you stand. Drag it onto the spot.')
  })

  it('with no photo handed over, the photo stays where it was, after the words', () => {
    draw()
    expect(camera.picked).toEqual([])
    expect(document.querySelector('[data-place-photo]')?.getAttribute('data-place-photo')).toBe('after')
    expect(order()[0]).toBe('kinds')
  })
})

/** More than one photo on a place (punch list #413, step 7): open and covered, before and after. */
describe('PaintedPlacePanel, more than one photo', () => {
  const SAVED = { id: 'p1', mapId: 'm1', name: 'Cleanout', words: '', lat: 29.5, lng: -98.2, accuracyM: null, photoPath: 'm1/first.jpg', kind: 'cleanout' as const, setBy: 'me', setAt: '2026-11-21T15:00:00Z', morePhotos: [{ path: 'm1/open.jpg', at: '2026-11-21T15:01:00Z', by: 'me' }, { path: 'm1/covered.jpg', at: '2026-11-21T16:00:00Z', by: 'me' }] }
  const urls = new Map([['m1/open.jpg', 'https://signed.test/open'], ['m1/covered.jpg', 'https://signed.test/covered']])
  const edit = () => render(<PaintedPlacePanel place={SAVED} photoUrl="https://signed.test/first" morePhotoUrls={urls} accuracyM={null} movedOffReading={false} finding={false} busy={false} canRemove {...presses} />)
  const block = () => document.querySelector('[data-place-more-photos]') as HTMLElement | null
  const lastSave = () => presses.onSave.mock.calls[presses.onSave.mock.calls.length - 1]?.[0] as { more?: { keep: Array<{ path: string }>; add: Array<{ id: string }> } }
  const save = () => fireEvent.click(document.querySelector('[data-painted-place-save]') as HTMLButtonElement)

  it('gives the photos’ own presses and Remove this place a thumb’s height, 44 px', () => {
    edit()
    const named = (name: string) => (screen.getByRole('button', { name }) as HTMLButtonElement).style.minHeight
    expect(['Take another', 'Remove the photo', 'Remove photo 2', 'Remove photo 3', 'Remove this place'].map(named)).toEqual(['44px', '44px', '44px', '44px', '44px'])
  })

  it('offers another photo only once the place has its first', () => {
    draw()
    expect(block()).toBeNull()
    cleanup()
    camera.shot = { id: 'shot-1', blob: new Blob(['x']), previewUrl: 'blob:first' }
    draw()
    const add = document.querySelector('[data-place-more-add]') as HTMLButtonElement
    expect(add.textContent).toBe('＋ Another photo')
    expect(add.style.minHeight).toBe('48px')
  })

  it('shows the photos a place already keeps, and hands nothing over when none changed', () => {
    edit()
    const kept = [...document.querySelectorAll('[data-place-more-photo="kept"] img')] as HTMLImageElement[]
    expect(kept.map((i) => i.getAttribute('src'))).toEqual(['https://signed.test/open', 'https://signed.test/covered'])
    expect(kept.map((i) => i.alt)).toEqual(['Photo 2 of the place', 'Photo 3 of the place'])
    save()
    expect(lastSave().more).toBeUndefined()
  })

  it('hands over the ones still kept when one is taken off', () => {
    edit()
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 2' }))
    expect(document.querySelectorAll('[data-place-more-photo="kept"]')).toHaveLength(1)
    save()
    expect(lastSave().more).toEqual({ keep: [{ path: 'm1/covered.jpg', at: '2026-11-21T16:00:00Z', by: 'me' }], add: [] })
  })

  it('hands over a new photo to send, after the ones kept', () => {
    morePhotos.added = [{ id: 'new-1', blob: new Blob(['y']), previewUrl: 'blob:new-1' }]
    edit()
    expect((document.querySelector('[data-place-more-photo="new"] img') as HTMLImageElement).alt).toBe('Photo 4 of the place')
    save()
    expect(lastSave().more?.keep.map((p) => p.path)).toEqual(['m1/open.jpg', 'm1/covered.jpg'])
    expect(lastSave().more?.add.map((p) => p.id)).toEqual(['new-1'])
  })

  it('a new photo taken off again before the save changes nothing', () => {
    morePhotos.added = [{ id: 'new-1', blob: new Blob(['y']), previewUrl: 'blob:new-1' }]
    edit()
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 4' }))
    save()
    expect(lastSave().more).toBeUndefined()
  })

  it('stops at twelve more, and says how to add another', () => {
    const many = { ...SAVED, morePhotos: Array.from({ length: 12 }, (_, i) => ({ path: `m1/p${i}.jpg`, at: null, by: null })) }
    render(<PaintedPlacePanel place={many} photoUrl="https://signed.test/first" accuracyM={null} movedOffReading={false} finding={false} busy={false} canRemove {...presses} />)
    expect(document.querySelector('[data-place-more-add]')).toBeNull()
    expect(block()?.textContent).toContain('A place holds twelve more photos. Take one off to add another.')
  })
})
