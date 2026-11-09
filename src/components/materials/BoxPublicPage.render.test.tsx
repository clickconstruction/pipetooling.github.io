// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
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
    expect(screen.getByTestId('box-page-counted').textContent).toContain('Last counted Thursday, Nov 5')
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain('/functions/v1/box-read?code=4F2A9C18')
    expect(document.title).toBe('Cage B3 · Click Plumbing & Electrical')
  })

  it('Sign in to change a count remembers the box and goes to the sign-in', async () => {
    answer(200, box)
    mount()
    fireEvent.click(await screen.findByTestId('box-page-sign-in'))
    expect(localStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBe('/b/4f2a9c18')
    expect(await screen.findByTestId('sign-in-page')).toBeTruthy()
  })

  it('an empty box says so and still offers the sign-in', async () => {
    answer(200, { ...box, box: { ...box.box, lines: [], photo: null, lastCountedOn: null } })
    mount()
    expect((await screen.findByTestId('box-page-empty')).textContent).toContain('Nothing is recorded in this cage yet')
    expect(screen.getByTestId('box-page-counted').textContent).toContain('Never counted')
    expect(screen.getByTestId('box-page-sign-in')).toBeTruthy()
  })

  it('a code no box carries, a retired box and a locked source each say so in words', async () => {
    answer(404, { error: 'not_found' })
    mount('4F2A9C19')
    expect((await screen.findByTestId('box-page-not-found')).textContent).toContain('4F2A-9C19 is not a box on any job')
    cleanup()
    answer(410, { error: 'retired', retiredOn: '2026-11-08' })
    mount()
    expect((await screen.findByTestId('box-page-retired')).textContent).toContain('It left the job on Sunday, Nov 8')
    cleanup()
    answer(429, { error: 'x', code: 'locked' })
    mount()
    expect((await screen.findByTestId('box-page-locked')).textContent).toContain('Too many wrong codes')
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
