// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BoxPublicPage } from './BoxPublicPage'
import { POST_LOGIN_REDIRECT_KEY } from '../../lib/iosPwa'

const box = {
  ok: true,
  box: {
    code: '4F2A9C18', stencil: 'B3', kind: 'cage', place: 'Level 2', where: 'by the north stair',
    lines: [{ partName: '3/4" copper 90° elbows', manufacturer: 'Mueller', onHand: 42 }, { partName: '1/2" PEX crimp rings', manufacturer: null, onHand: 200 }],
    lastCountedOn: '2026-11-05',
    photo: { id: 'ph1', takenOn: '2026-11-07', url: 'https://x.supabase.co/functions/v1/box-read?code=4F2A9C18&photo=ph1' },
  },
}

function answer(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ status, ok: status < 400, json: async () => body })))
}

function mount(code = '4F2A9C18') {
  return render(
    <MemoryRouter initialEntries={[`/b/${code}`]}>
      <Routes>
        <Route path="/b/:code" element={<BoxPublicPage code={code} />} />
        <Route path="/sign-in" element={<div data-testid="sign-in-page">sign in</div>} />
        <Route path="/b" element={<div data-testid="scan-page">scan a label</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// The verdict reads the last count against today: hold the clock at noon Central on 2026-11-10 (timers stay real).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-10T18:00:00Z') })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('BoxPublicPage', () => {
  it('draws the box, its photo, its lines and the last count, and never the job', async () => {
    answer(200, box)
    mount()
    expect((await screen.findByTestId('box-page-title')).textContent).toBe('Cage B3')
    expect(screen.getByTestId('box-page-place').textContent).toBe('Level 2 · by the north stair')
    expect(screen.getByTestId('box-page-photo').getAttribute('src')).toContain('box-read?code=4F2A9C18&photo=ph1')
    expect(screen.getByTestId('box-page-lines').textContent).toContain('3/4" copper 90° elbows')
    expect(screen.getByTestId('box-page-lines').textContent).toContain('Mueller')
    // v2.6868: the top reads as the label does, and the count is a verdict by the 14-day rule.
    // v2.6899: the stencil is the plate's heading, large, with the kind read aloud before it.
    expect(screen.getByTestId('box-page-tile').textContent).toBe('B3')
    expect(screen.getByTestId('box-page-code').textContent).toBe('4F2A-9C18')
    expect(screen.getByTestId('box-page-counted').textContent).toBe('Counted 5 days agoThursday, Nov 5')
    expect(screen.getByTestId('box-page-counted').getAttribute('data-verdict')).toBe('fresh')
    expect(screen.getByTestId('box-page-parts').textContent).toBe('2 parts')
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain('/functions/v1/box-read?code=4F2A9C18')
    // The title is set by an effect after the box is drawn. On a slow runner the read above can land a tick before it (two
    // CI runs failed here on 2026-11-10 reading 'Box label'), so wait for it instead of reading once.
    await waitFor(() => expect(document.title).toBe('Cage B3 · Click Plumbing & Electrical'))
  })

  it('a cage last counted 14 days ago or more is due a count', async () => {
    answer(200, { ...box, box: { ...box.box, lastCountedOn: '2026-10-19' } })
    mount()
    const counted = await screen.findByTestId('box-page-counted')
    expect(counted.textContent).toBe('Due a countlast counted 22 days ago')
    expect(counted.getAttribute('data-verdict')).toBe('due')
  })

  it('the photo is a band, and a tap opens it whole', async () => {
    answer(200, box)
    mount()
    const press = await screen.findByTestId('box-page-photo-press')
    expect(press.textContent).toContain('Photo from Saturday, Nov 7 · tap to see it whole')
    expect(screen.getByTestId('box-page-photo').style.height).toBe('150px')
    fireEvent.click(press)
    expect(screen.getByTestId('box-page-photo').style.height).toBe('auto')
    expect(press.getAttribute('aria-expanded')).toBe('true')
  })

  it('Sign in to record a use or a count remembers the box and goes to the sign-in', async () => {
    answer(200, box)
    mount()
    // v2.6899: the press is a row, its title over one line of who it is for.
    expect((await screen.findByTestId('box-page-sign-in')).textContent).toContain('Sign in to record a use or a countOn Click\'s crew? Once on this phone.')
    fireEvent.click(await screen.findByTestId('box-page-sign-in'))
    expect(localStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBe('/b/4f2a9c18')
    expect(await screen.findByTestId('sign-in-page')).toBeTruthy()
  })

  it('an empty box says so and still offers the sign-in', async () => {
    answer(200, { ...box, box: { ...box.box, lines: [], photo: null, lastCountedOn: null } })
    mount()
    expect((await screen.findByTestId('box-page-empty')).textContent).toContain('Nothing is recorded in this cage yet')
    expect(screen.getByTestId('box-page-counted').textContent).toContain('Never counted')
    expect(screen.getByTestId('box-page-sign-in').textContent).toContain('Sign in to add a part')
    // The search stays: an empty cage is when a person most needs the others.
    expect(screen.getByTestId('box-page-find-form')).toBeTruthy()
  })

  it('a cage counted down to nothing says nothing is on hand', async () => {
    answer(200, { ...box, box: { ...box.box, lines: [], photo: null } })
    mount()
    expect((await screen.findByTestId('box-page-empty')).textContent).toContain('Nothing on hand in this cage')
  })

  it('a code no box carries, a retired box and a locked source each say so in words', async () => {
    answer(404, { error: 'not_found' })
    mount('4F2A9C19')
    expect((await screen.findByTestId('box-page-not-found')).textContent).toContain('4F2A-9C19 is not a box on any job')
    cleanup()
    answer(410, { error: 'retired', retiredOn: '2026-11-08' })
    mount()
    expect((await screen.findByTestId('box-page-retired')).textContent).toContain('It left the job on Sunday, Nov 8')
    // v2.6868: no search from a retired label (the function refuses it); the way on is another label.
    expect(screen.queryByTestId('box-page-find-open-press')).toBeNull()
    expect(screen.getByTestId('box-page-scan-another').getAttribute('href')).toBe('/b')
    cleanup()
    answer(429, { error: 'x', code: 'locked' })
    mount()
    expect((await screen.findByTestId('box-page-locked')).textContent).toContain('Too many wrong codes')
  })

  it('a code no box carries offers the typed code, and the site this phone last scanned', async () => {
    answer(404, { error: 'not_found' })
    mount('4F2A9C19')
    await screen.findByTestId('box-page-not-found')
    expect(screen.getByTestId('box-page-type-code').getAttribute('href')).toBe('/b')
    expect(screen.queryByTestId('box-page-last-site')).toBeNull()
    cleanup()
    localStorage.setItem('pt.boxPage.last', JSON.stringify({ code: 'AAAA1111', stencil: 'A1', kind: 'cage', at: Date.now() - 60_000 }))
    mount('4F2A9C19')
    await screen.findByTestId('box-page-not-found')
    expect(screen.getByTestId('box-page-last-site').getAttribute('href')).toBe('/b/aaaa1111?find=1')
  })

  it('a retired label opened on the search shows the retired words, not a search that cannot answer', async () => {
    answer(410, { error: 'retired', retiredOn: '2026-11-08' })
    render(
      <MemoryRouter initialEntries={['/b/4F2A9C18?find=1']}>
        <Routes>
          <Route path="/b/:code" element={<BoxPublicPage code="4F2A9C18" />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByTestId('box-page-retired')).toBeTruthy()
    expect(screen.queryByTestId('box-page-find')).toBeNull()
  })

  it('a line emptied since the count reads None left, a Can\'t find shows on its line, and Text the office is a link (v2.6874)', async () => {
    answer(200, {
      ...box,
      box: { ...box.box, lines: [{ partName: '3/4" ball valves', manufacturer: 'Apollo', onHand: 10, cannotFind: 2 }], gone: [{ partName: '1" copper tees', manufacturer: 'Mueller', onHand: 0 }] },
      office: { phone: '(512) 555-0142' },
    })
    mount()
    expect((await screen.findByTestId('box-page-cannot-find')).textContent).toBe('2 could not be found since the count')
    expect(screen.getByTestId('box-page-gone').textContent).toBe('1" copper teesMuellerNone left')
    // The part count is what is on hand, and the line at zero lists after it.
    expect(screen.getByTestId('box-page-parts').textContent).toBe('1 part')
    expect(screen.getAllByRole('row').map((r) => r.getAttribute('data-testid'))).toEqual(['box-page-line', 'box-page-gone'])
    const text = screen.getByTestId('box-page-text-office')
    expect(text.textContent).toContain('Text the office about Cage B3')
    expect(text.getAttribute('href')).toBe('sms:+15125550142?&body=Cage%20B3%2C%204F2A-9C18%3A%20')
    // v2.6899: the call has a row of its own, with the number as its second line.
    expect(screen.getByTestId('box-page-call-office').getAttribute('href')).toBe('tel:+15125550142')
    expect(screen.getByTestId('box-page-call-office').textContent).toContain('Call the office(512) 555-0142')
  })

  it('a cage with only lines at zero lists them, not the empty words', async () => {
    answer(200, { ...box, box: { ...box.box, lines: [], gone: [{ partName: '1" copper tees', manufacturer: null, onHand: 0 }], photo: null } })
    mount()
    expect((await screen.findByTestId('box-page-gone')).textContent).toContain('None left')
    expect(screen.queryByTestId('box-page-empty')).toBeNull()
    expect(screen.queryByTestId('box-page-parts')).toBeNull()
  })

  it('an answer with no office number draws no Text the office', async () => {
    answer(200, box)
    mount()
    await screen.findByTestId('box-page-title')
    expect(screen.queryByTestId('box-page-text-office')).toBeNull()
    expect(screen.queryByTestId('box-page-call-office')).toBeNull()
    // The sign-in row still stands alone in the card.
    expect(screen.getByTestId('box-page-sign-in')).toBeTruthy()
  })

  it('a retired label names its box and offers the text when the function answers them', async () => {
    answer(410, { error: 'retired', retiredOn: '2026-11-08', stencil: 'B3', kind: 'cage', phone: '(512) 555-0142' })
    mount()
    expect((await screen.findByTestId('box-page-retired')).textContent).toContain('Cage B3 was retired')
    expect(screen.getByTestId('box-page-text-office').getAttribute('href')).toBe('sms:+15125550142?&body=Cage%20B3%2C%204F2A-9C18%3A%20')
  })

  it('a lost signal offers Try again', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    mount()
    expect(await screen.findByTestId('box-page-error')).toBeTruthy()
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
  })
})

describe('BoxPublicPage · Find a part on this site (v2.6799)', () => {
  const found = { ok: true, find: { words: ['copper'], total: 2, boxes: [
    { code: '4F2A9C18', stencil: 'B3', kind: 'cage', place: 'Level 2', where: '', thisBox: true, lines: [{ partName: '3/4" copper 90° elbows', manufacturer: 'Mueller', onHand: 42 }] },
    { code: 'AAAA1111', stencil: 'A1', kind: 'cage', place: 'Laydown yard', where: '', thisBox: false, lines: [{ partName: '3/4" copper pipe, 20 ft', manufacturer: 'Cerro', onHand: 24 }] },
  ] } }

  it('opens the search from the press, asks the function with the words and the code, lists the hits with a door to each other box', async () => {
    const fetchMock = vi.fn(async (url: string) => ({ status: 200, ok: true, json: async () => (url.includes('&find=') ? found : box) }))
    vi.stubGlobal('fetch', fetchMock)
    mount()
    fireEvent.click(await screen.findByTestId('box-page-find-open-press'))
    expect(await screen.findByTestId('box-page-find')).toBeTruthy()
    fireEvent.change(screen.getByTestId('box-page-find-input'), { target: { value: '3/4 copper' } })
    fireEvent.click(screen.getByTestId('box-page-find-go'))
    expect((await screen.findByTestId('box-page-find-count')).textContent).toBe('2 boxes hold a line that matches.')
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('box-read?code=4F2A9C18&find=3%2F4%20copper'))).toBe(true)
    const hits = screen.getAllByTestId('box-page-find-hit')
    expect(hits).toHaveLength(2)
    expect(hits[0]!.textContent).toContain('this cage')
    expect(screen.getAllByTestId('box-page-find-open')).toHaveLength(1)
    expect(screen.getByTestId('box-page-find-open').getAttribute('href')).toBe('/b/aaaa1111')
    fireEvent.click(screen.getByTestId('box-page-find-back'))
    expect(await screen.findByTestId('box-page-title')).toBeTruthy()
  })

  it('words typed in the field on the box\'s own page are asked at once (v2.6868)', async () => {
    const fetchMock = vi.fn(async (url: string) => ({ status: 200, ok: true, json: async () => (url.includes('&find=') ? found : box) }))
    vi.stubGlobal('fetch', fetchMock)
    mount()
    fireEvent.change(await screen.findByTestId('box-page-find-first'), { target: { value: 'copper' } })
    fireEvent.click(screen.getByTestId('box-page-find-open-press'))
    expect((await screen.findByTestId('box-page-find-count')).textContent).toBe('2 boxes hold a line that matches.')
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('box-read?code=4F2A9C18&find=copper'))).toBe(true)
    expect((screen.getByTestId('box-page-find-input') as HTMLInputElement).value).toBe('copper')
  })

  it('nothing matching says so in words', async () => {
    const fetchMock = vi.fn(async (url: string) => ({ status: 200, ok: true, json: async () => (url.includes('&find=') ? { ok: true, find: { words: ['wax', 'ring'], boxes: [], total: 0 } } : box) }))
    vi.stubGlobal('fetch', fetchMock)
    mount()
    fireEvent.click(await screen.findByTestId('box-page-find-open-press'))
    fireEvent.change(screen.getByTestId('box-page-find-input'), { target: { value: 'wax ring' } })
    fireEvent.click(screen.getByTestId('box-page-find-go'))
    expect((await screen.findByTestId('box-page-find-empty')).textContent).toContain('Nothing on this site matches wax ring')
  })

  it('remembers the box this phone scanned', async () => {
    answer(200, box)
    mount()
    await screen.findByTestId('box-page-title')
    expect(JSON.parse(localStorage.getItem('pt.boxPage.last') ?? '{}')).toMatchObject({ code: '4F2A9C18', stencil: 'B3', kind: 'cage' })
  })
})
