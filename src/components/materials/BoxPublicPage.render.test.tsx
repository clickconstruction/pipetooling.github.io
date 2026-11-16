// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BoxPublicPage } from './BoxPublicPage'
import { POST_LOGIN_REDIRECT_KEY } from '../../lib/iosPwa'

/** What the function answers since v2.7379: the name, the kind, the code and the office's number. */
const box = { ok: true, box: { code: '849FDB0B', stencil: 'G81', kind: 'box' }, office: { phone: '(512) 555-0142' } }

/** What it answered before: the place, the photo, the lines with their counts, what ran out. A page on the old function gets this. */
const beforeTheSeal = {
  ok: true,
  box: {
    code: '849FDB0B', stencil: 'G81 COPPER 90', kind: 'box', place: 'Level 2', where: 'by the north stair', line: 'Copper fittings and valves',
    lines: [{ partName: '3/4" copper 90° elbows', manufacturer: 'Mueller', onHand: 318, cannotFind: 2 }, { partName: '1/2" PEX crimp rings', manufacturer: null, onHand: 200 }],
    gone: [{ partName: '1" copper tee', manufacturer: 'Mueller', onHand: 0 }],
    lastCountedOn: '2026-11-05',
    photo: { id: 'ph1', takenOn: '2026-11-07', url: 'https://x.supabase.co/functions/v1/box-read?code=849FDB0B&photo=ph1' },
  },
  office: { phone: '(512) 555-0142' },
}

function answer(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ status, ok: status < 400, json: async () => body })))
}

function mount(code = '849FDB0B', entry = `/b/${code}`) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/b/:code" element={<BoxPublicPage code={code} />} />
        <Route path="/sign-in" element={<div data-testid="sign-in-page">sign in</div>} />
        <Route path="/b" element={<div data-testid="scan-page">scan a label</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('BoxPublicPage · what is inside needs a sign-in (v2.7379)', () => {
  it('draws the name as the label prints it, whose the material is and the ways to the office, as Taunya drew it', async () => {
    answer(200, box)
    mount()
    expect((await screen.findByTestId('box-page-title')).textContent).toBe('G81')
    expect(screen.getByTestId('box-page-address').textContent).toBe('prts.co/b/849F-DB0B')
    expect(screen.getByTestId('box-page-signed-out').textContent).toBe('Not signed in')
    expect(screen.getByTestId('box-page-kind').textContent).toBe('Box on this site')
    expect(screen.getByTestId('box-page-code').textContent).toBe('849F-DB0B')
    expect(screen.getByTestId('box-page-watched').textContent).toBe('Counted and photographed by its crew.')
    expect(screen.getByTestId('box-page-belongs').textContent).toContain('This material belongs toClick Plumbing and ElectricalYour reliable team is just a click away')
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1)
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain('/functions/v1/box-read?code=849FDB0B')
    // The title is set by an effect after the box is drawn, so wait for it instead of reading once.
    await waitFor(() => expect(document.title).toBe('Box G81 · Click Plumbing & Electrical'))
  })

  it('every press but the sign-in is a link to the office’s number, each text opening with its own words', async () => {
    answer(200, box)
    mount()
    expect((await screen.findByTestId('box-page-bid')).getAttribute('href')).toBe(`sms:+15125550142?&body=${encodeURIComponent('I would like a bid. I scanned box G81, 849F-DB0B: ')}`)
    expect(screen.getByTestId('box-page-bid').textContent).toBe('Ask for a bid')
    expect(screen.getByTestId('box-page-call-office').getAttribute('href')).toBe('tel:+15125550142')
    expect(screen.getByTestId('box-page-call-office').textContent).toBe('(512) 555-0142')
    expect(screen.getByTestId('box-page-text-office').getAttribute('href')).toBe(`sms:+15125550142?&body=${encodeURIComponent('Box G81, 849F-DB0B: ')}`)
    expect(screen.getByTestId('box-page-text-office').textContent).toBe('Text the office about box G81' + 'Moved, damaged or in the way.')
    expect(screen.getByTestId('box-page-work').getAttribute('href')).toBe(`sms:+15125550142?&body=${encodeURIComponent('I would like to work with Click. I scanned box G81, 849F-DB0B: ')}`)
    expect(screen.getByTestId('box-page-work').textContent).toBe('Work with us' + 'Plumbers and electricians wanted.')
  })

  it('Sign in to see what is inside remembers the box and goes to the sign-in', async () => {
    answer(200, box)
    mount()
    expect((await screen.findByTestId('box-page-sign-in')).textContent).toBe('Sign in to see what is inside' + 'On Click\'s crew? Once on this phone.')
    fireEvent.click(screen.getByTestId('box-page-sign-in'))
    expect(localStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBe('/b/849fdb0b')
    expect(await screen.findByTestId('sign-in-page')).toBeTruthy()
  })

  it('draws no part, count, photo, place, freshness or search, even when an older function still sends them', async () => {
    answer(200, beforeTheSeal)
    const { container } = mount()
    // The name is cut to what the label prints, whichever function sent it.
    expect((await screen.findByTestId('box-page-title')).textContent).toBe('G81')
    const words = container.textContent ?? ''
    for (const never of ['copper', 'Copper', 'PEX', 'Mueller', '318', '200', 'Level 2', 'north stair', 'None left', 'could not be found', 'Counted 5', 'Due a count', 'Never counted', 'Photo from', 'Find']) expect(words).not.toContain(never)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('form')).toBeNull()
    for (const gone of ['box-page-lines', 'box-page-line', 'box-page-gone', 'box-page-photo', 'box-page-place', 'box-page-says', 'box-page-counted', 'box-page-parts', 'box-page-find-form', 'box-page-find']) expect(screen.queryByTestId(gone)).toBeNull()
  })

  it('asks the function once, for the box alone: never the search or a photo, whatever the address says', async () => {
    answer(200, box)
    mount('849FDB0B', '/b/849FDB0B?find=1')
    await screen.findByTestId('box-page-title')
    const asked = vi.mocked(fetch).mock.calls.map((c) => String(c[0]))
    expect(asked).toHaveLength(1)
    expect(asked[0]).not.toContain('find=')
    expect(asked[0]).not.toContain('photo=')
    expect(screen.queryByTestId('box-page-find')).toBeNull()
  })

  it('keeps nothing on the phone about the box that was scanned', async () => {
    answer(200, box)
    mount()
    await screen.findByTestId('box-page-title')
    expect(localStorage.getItem('pt.boxPage.last')).toBeNull()
  })

  it('an answer with no office number draws no press that needs one', async () => {
    answer(200, { ...box, office: null })
    mount()
    await screen.findByTestId('box-page-title')
    for (const press of ['box-page-bid', 'box-page-call-office', 'box-page-text-office', 'box-page-work']) expect(screen.queryByTestId(press)).toBeNull()
    // Whose it is and the sign-in still stand.
    expect(screen.getByTestId('box-page-company').textContent).toBe('Click Plumbing and Electrical')
    expect(screen.getByTestId('box-page-sign-in')).toBeTruthy()
  })

  it('a cage reads as a cage', async () => {
    answer(200, { ...box, box: { ...box.box, stencil: 'B3', kind: 'cage' } })
    mount()
    expect((await screen.findByTestId('box-page-kind')).textContent).toBe('Cage on this site')
    expect(screen.getByTestId('box-page-text-office').textContent).toContain('Text the office about cage B3')
  })
})

describe('BoxPublicPage · the answers that are not a box say what they said', () => {
  it('a code no box carries, a retired box and a locked source each say so in words', async () => {
    answer(404, { error: 'not_found' })
    mount('4F2A9C19')
    expect((await screen.findByTestId('box-page-not-found')).textContent).toContain('4F2A-9C19 is not a box on any job')
    expect(screen.getByTestId('box-page-type-code').getAttribute('href')).toBe('/b')
    cleanup()
    answer(410, { error: 'retired', retiredOn: '2026-11-08' })
    mount()
    expect((await screen.findByTestId('box-page-retired')).textContent).toContain('It left the job on Sunday, Nov 8')
    expect(screen.getByTestId('box-page-scan-another').getAttribute('href')).toBe('/b')
    cleanup()
    answer(429, { error: 'x', code: 'locked' })
    mount()
    expect((await screen.findByTestId('box-page-locked')).textContent).toContain('Too many wrong codes')
  })

  it('a code no box carries offers no search, even on a phone that scanned a box before v2.7379', async () => {
    localStorage.setItem('pt.boxPage.last', JSON.stringify({ code: 'AAAA1111', stencil: 'A1', kind: 'cage', at: Date.now() - 60_000 }))
    answer(404, { error: 'not_found' })
    mount('4F2A9C19')
    await screen.findByTestId('box-page-not-found')
    expect(screen.queryByTestId('box-page-last-site')).toBeNull()
  })

  it('a retired label names its box and offers the text when the function answers them', async () => {
    answer(410, { error: 'retired', retiredOn: '2026-11-08', stencil: 'B3', kind: 'cage', phone: '(512) 555-0142' })
    mount('4F2A9C18')
    expect((await screen.findByTestId('box-page-retired')).textContent).toContain('Cage B3 was retired')
    expect(screen.getByTestId('box-page-text-office').getAttribute('href')).toBe('sms:+15125550142?&body=Cage%20B3%2C%204F2A-9C18%3A%20')
  })

  it('a lost signal offers Try again', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    mount()
    expect(await screen.findByTestId('box-page-error')).toBeTruthy()
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
  })

  // v2.7072 (punch list #329): a code may be a sticker's.
  it('a blank sticker says its number, offers the sign-in and nothing else', async () => {
    answer(404, { error: 'sticker_blank', number: 147 })
    mount('9B1C0D2E')
    const page = await screen.findByTestId('box-page-sticker-blank')
    expect(page.textContent).toBe('Sticker 0147 is not on a box yet' + 'Sign in to say what it is.' + 'Sign in')
    expect(document.title).toBe('Sticker 0147 · Click Plumbing & Electrical')
    // no site, no office number, and not the words of a wrong code
    expect(screen.queryByTestId('box-page-not-found')).toBeNull()
    expect(screen.queryByTestId('box-page-text-office')).toBeNull()
    expect(screen.queryByTestId('box-page-bid')).toBeNull()
    fireEvent.click(screen.getByTestId('box-page-sticker-sign-in'))
    expect(await screen.findByTestId('sign-in-page')).toBeTruthy()
    expect(localStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBe('/b/9b1c0d2e')
  })

  it('a lost sticker says so with its day and offers another scan', async () => {
    answer(410, { error: 'sticker_lost', number: 147, lostOn: '2026-11-07' })
    mount('9B1C0D2E')
    const page = await screen.findByTestId('box-page-sticker-lost')
    expect(page.textContent).toContain('Sticker 0147 was marked lost')
    expect(page.textContent).toContain('Someone marked it lost on Saturday, Nov 7. It no longer opens a box.')
    expect(screen.queryByTestId('box-page-retired')).toBeNull()
    fireEvent.click(screen.getByTestId('box-page-scan-another'))
    expect(await screen.findByTestId('scan-page')).toBeTruthy()
  })

  it('a sticker on a box draws that box as a label does, with the sticker\'s number by the code', async () => {
    answer(200, { ...box, box: { ...box.box, code: '9B1C0D2E', stickerNumber: 147 } })
    mount('9B1C0D2E')
    expect((await screen.findByTestId('box-page-title')).textContent).toBe('G81')
    expect(screen.getByTestId('box-page-sticker').textContent).toBe('Sticker 0147, ')
    expect(screen.getByTestId('box-page-code').textContent).toBe('Sticker 0147, 9B1C-0D2E')
    expect(screen.getByTestId('box-page-address').textContent).toBe('prts.co/b/9B1C-0D2E')
  })

  it('a label\'s own code draws no sticker number', async () => {
    answer(200, box)
    mount()
    await screen.findByTestId('box-page-title')
    expect(screen.queryByTestId('box-page-sticker')).toBeNull()
  })
})
