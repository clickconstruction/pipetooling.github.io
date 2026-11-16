// @vitest-environment jsdom
/**
 * Render smoke for These are on boxes (punch list #329, design section 10, PR 10): the Names field read as the print
 * window reads it, the plan counted from the site before the press, the press naming its count and dead with its
 * reason, the kind, the place and the where line sent with the names, the answer said in sentences with a held name
 * kept beside its reason, a refusal in the database's words, no signal, a site that did not load, and both frames.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Place } from '../../lib/materials/onSite'
import type { SiteStickerNames } from '../../lib/materials/stickerRunsIo'
import type { OnBoxesAnswer, OnBoxesRequest } from '../../lib/materials/stickersOnBoxes'

vi.mock('../../lib/materials/stickerRunsIo', () => ({ fetchSiteStickerNames: vi.fn(async () => ({ boxes: [], blankNames: [] })) }))
vi.mock('../../lib/materials/stickersOnBoxesIo', () => ({ placeStickerRange: vi.fn() }))

import StickersOnBoxes from './StickersOnBoxes'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

/** A made-up site: G80 stands, and stickers G78 to G82 are printed and blank. */
const SITE: SiteStickerNames = { boxes: [{ id: 'g80', label: 'G80', kind: 'cage', retiredAt: null }], blankNames: ['G78', 'G79', 'G80', 'G81', 'G82'] }
const places: Place[] = [{ id: 'arena', jobId: 'job-a', name: 'Arena', createdAt: '2026-11-01T00:00:00Z' }, { id: 'barn', jobId: 'job-a', name: 'Barn', createdAt: '2026-11-01T00:00:00Z' }]
const answer = (over: Partial<OnBoxesAnswer> = {}): OnBoxesAnswer => ({ made: [], took: [], already: [], noSticker: [], held: [], stickers: 0, ...over })

function mount(over: Partial<Parameters<typeof StickersOnBoxes>[0]> = {}) {
  const place = vi.fn(over.place ?? (async (_r: OnBoxesRequest) => answer({ made: ['G78', 'G79', 'G81'], took: ['G80'], stickers: 4 })))
  const onClose = vi.fn()
  const onPlaced = vi.fn()
  renderWithProviders(<StickersOnBoxes jobId="job-a" jobLabel="1204 · Juniper Ridge" places={places} onClose={onClose} onPlaced={onPlaced} siteNames={async () => SITE} online={() => true} {...over} place={place} />)
  return { place, onClose, onPlaced }
}
const type = (text: string) => fireEvent.change(screen.getByTestId('on-boxes-names'), { target: { value: text } })
const read = async () => { await waitFor(() => expect(screen.queryByTestId('on-boxes-reading')).toBeNull()) }

describe('StickersOnBoxes', () => {
  it('opens as a window that says what to type, with a dead press until names are read', async () => {
    mount()
    expect(screen.getByRole('dialog', { name: 'These are on boxes' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('These are on boxes · 1204 · Juniper Ridge')
    expect(screen.getByTestId('on-boxes-read').textContent).toBe('Type the first name and the last with a dash between, like G78-150. One name alone is one box.')
    const press = screen.getByTestId('on-boxes-press') as HTMLButtonElement
    expect(press.textContent).toBe('Put stickers on boxes')
    expect(press.disabled).toBe(true)
    expect(screen.getByTestId('on-boxes-goes-on').textContent).toContain('New boxes go on 1204 · Juniper Ridge.')
    await read()
  })

  it('counts the plan from the site: what will be made, what is a box already, what has no blank sticker', async () => {
    mount()
    type('g78-83')
    await read()
    expect(screen.getByTestId('on-boxes-read').textContent).toBe('G78 to G83 · 6 names.')
    const plan = within(screen.getByTestId('on-boxes-plan')).getAllByText(/./).map((p) => p.textContent)
    expect(plan).toEqual(['4 boxes will be made, G78, G79 and 2 more.', '1 is a box on this site already, G80. Its sticker goes on it.', '1 has no reserved sticker, G83. Nothing is done for it.'])
    expect(screen.getByTestId('on-boxes-press').textContent).toBe('Put 5 stickers on their boxes')
    expect((screen.getByTestId('on-boxes-press') as HTMLButtonElement).disabled).toBe(false)
  })

  it('one press sends the names with the kind, the place and the where line, and says what became of them', async () => {
    const { place, onPlaced } = mount()
    type('G78-81')
    await read()
    fireEvent.click(within(screen.getByRole('group', { name: 'How they sit' })).getByText('Box'))
    fireEvent.click(within(screen.getByRole('group', { name: 'Which place on site' })).getByText('Barn'))
    fireEvent.change(screen.getByTestId('on-boxes-where'), { target: { value: ' by the north stair ' } })
    fireEvent.click(screen.getByTestId('on-boxes-press'))
    await waitFor(() => expect(screen.getByTestId('on-boxes-done')).toBeTruthy())
    expect(place).toHaveBeenCalledWith({ jobId: 'job-a', names: ['G78', 'G79', 'G80', 'G81'], boxKind: 'box', placeId: 'barn', where: 'by the north stair' })
    expect(screen.getAllByTestId('on-boxes-done-line').map((l) => l.textContent)).toEqual(['3 boxes made with their stickers on them, G78, G79 and 1 more.', '1 box already on this site took its sticker, G80.'])
    expect(screen.getByTestId('on-boxes-done').getAttribute('data-tone')).toBe('success')
    expect(screen.queryByTestId('on-boxes-held')).toBeNull()
    expect(onPlaced).toHaveBeenCalledTimes(1)
    expect(onPlaced.mock.calls[0]![0].stickers).toBe(4)
    // the kind is remembered for the next box, as Add a container remembers it
    expect(localStorage.length).toBeGreaterThan(0)
    expect(screen.queryByTestId('on-boxes-press')).toBeNull()
    expect(screen.getByTestId('on-boxes-close').textContent).toBe('Close')
  })

  it('a name the database refused stays with its reason while the rest are said', async () => {
    mount({ place: async () => answer({ made: ['G79'], held: [{ name: 'G78', why: 'G78 is already on this site.' }], stickers: 1 }) })
    type('G78-79')
    await read()
    fireEvent.click(screen.getByTestId('on-boxes-press'))
    await waitFor(() => expect(screen.getByTestId('on-boxes-held')).toBeTruthy())
    expect(screen.getByTestId('on-boxes-held').textContent).toContain('1 name did not go on. It stays here with the reason.')
    expect(screen.getByTestId('on-boxes-held-row').textContent).toBe('G78: G78 is already on this site.')
    expect(screen.getByTestId('on-boxes-done').getAttribute('data-tone')).toBe('warning')
  })

  it('names with no blank sticker leave the press dead, and a range the rule refuses says why', async () => {
    const { place } = mount()
    type('G90-92')
    await read()
    expect(screen.getByTestId('on-boxes-plan').textContent).toBe('3 have no reserved sticker, G90 to G92. Nothing is done for them.')
    const press = screen.getByTestId('on-boxes-press') as HTMLButtonElement
    expect(press.textContent).toBe('Put stickers on boxes')
    expect(press.disabled).toBe(true)
    fireEvent.click(press)
    expect(place).not.toHaveBeenCalled()
    type('G92-90')
    expect(screen.getByTestId('on-boxes-read').textContent).toBe('The range runs upward: G90 to G92.')
    expect(screen.getByTestId('on-boxes-read').getAttribute('role')).toBe('alert')
    expect(screen.queryByTestId('on-boxes-plan')).toBeNull()
  })

  it('a refusal of the whole call is said in the database’s words, and the form stays', async () => {
    mount({ place: async () => { throw { message: 'That place is not on this job.', code: 'P0001' } } })
    type('G78')
    await read()
    fireEvent.click(screen.getByTestId('on-boxes-press'))
    await waitFor(() => expect(screen.getByTestId('on-boxes-failure').textContent).toBe('The stickers were not put on boxes: That place is not on this job.'))
    expect(screen.getByTestId('on-boxes-names')).toBeTruthy()
  })

  it('with no signal the press is dead and says why', async () => {
    const { place } = mount({ online: () => false })
    type('G78')
    await read()
    expect(screen.getByTestId('on-boxes-no-signal').textContent).toContain('No signal.')
    expect((screen.getByTestId('on-boxes-press') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('on-boxes-press'))
    expect(place).not.toHaveBeenCalled()
  })

  it('a site that did not load counts nothing ahead, says so, and the press still sends every name', async () => {
    const { place } = mount({ siteNames: async () => { throw new Error('offline') } })
    type('G78-80')
    await waitFor(() => expect(screen.getByTestId('on-boxes-unread')).toBeTruthy())
    expect(screen.queryByTestId('on-boxes-plan')).toBeNull()
    expect(screen.getByTestId('on-boxes-press').textContent).toBe('Put 3 stickers on their boxes')
    fireEvent.click(screen.getByTestId('on-boxes-press'))
    await waitFor(() => expect(place).toHaveBeenCalledTimes(1))
    expect(place.mock.calls[0]![0].names).toEqual(['G78', 'G79', 'G80'])
  })

  it('opens on a run’s blank names when it is handed them, and a where line past 120 holds the press', async () => {
    mount({ initialNames: 'G79-G81' })
    await read()
    expect((screen.getByTestId('on-boxes-names') as HTMLInputElement).value).toBe('G79-G81')
    expect(screen.getByTestId('on-boxes-press').textContent).toBe('Put 3 stickers on their boxes')
    fireEvent.change(screen.getByTestId('on-boxes-where'), { target: { value: 'x'.repeat(121) } })
    expect(screen.getByTestId('on-boxes-refusal').textContent).toBe('The where line holds 120 characters. This one is 121.')
    expect((screen.getByTestId('on-boxes-press') as HTMLButtonElement).disabled).toBe(true)
  })

  it('on the phone it is a sheet with the same form, and Close closes after the answer', async () => {
    const { onClose } = mount({ sheet: true })
    expect(screen.getByRole('dialog', { name: 'These are on boxes' })).toBeTruthy()
    type('G78')
    await read()
    fireEvent.click(screen.getByTestId('on-boxes-press'))
    await waitFor(() => expect(screen.getByTestId('on-boxes-close')).toBeTruthy())
    fireEvent.click(screen.getByTestId('on-boxes-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
