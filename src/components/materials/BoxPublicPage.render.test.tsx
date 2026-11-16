// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BoxPublicPage } from './BoxPublicPage'
import { POST_LOGIN_REDIRECT_KEY } from '../../lib/iosPwa'

/** What the function answers since v2.7405: the name, the kind, the code, the office's number and its two addresses. */
const box = { ok: true, box: { code: '849FDB0B', stencil: 'G81', kind: 'box' }, office: { phone: '(512) 555-0142', email: 'office@example.com', bidsEmail: 'bids@example.com' } }

/** What it answered from v2.7379 to v2.7405: the number alone. A page that loads before the function is deployed gets this. */
const numberAlone = { ...box, office: { phone: '(512) 555-0142' } }

const mailto = (to: string, subject: string, words: string) => `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(words)}`
const sms = (words: string) => `sms:+15125550142?&body=${encodeURIComponent(words)}`

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

describe('BoxPublicPage · the company\'s card (v2.7405, Taunya\'s drawing of 2026-11-15)', () => {
  it('reads the company first and the box right under it, on one plate', async () => {
    answer(200, box)
    const { container } = mount()
    expect((await screen.findByTestId('box-page-title')).textContent).toBe('Box G81')
    expect(screen.getByTestId('box-page-belongs').textContent).toBe('Click Plumbing and Electrical' + 'Your reliable team is just a click away')
    expect(screen.getByTestId('box-page-mark').getAttribute('src')).toBe('/brand/click-mark-on-dark.png')
    expect(screen.getByTestId('box-page-kind').textContent).toBe('Our box on this site')
    expect(screen.getByTestId('box-page-code').textContent).toBe('849F-DB0B')
    expect(screen.getByTestId('box-page-watched').textContent).toBe('Counted and photographed by its crew.')
    // The plate holds them in that order, and the line that named the address and "Not signed in" is gone.
    const plate = container.querySelector('header')?.textContent ?? ''
    expect(plate.indexOf('Click Plumbing and Electrical')).toBeLessThan(plate.indexOf('Box G81'))
    expect(screen.queryByTestId('box-page-address')).toBeNull()
    expect(screen.queryByTestId('box-page-signed-out')).toBeNull()
    expect(container.textContent).not.toContain('Not signed in')
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1)
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain('/functions/v1/box-read?code=849FDB0B')
    // The title is set by an effect after the box is drawn, so wait for it instead of reading once.
    await waitFor(() => expect(document.title).toBe('Box G81 · Click Plumbing & Electrical'))
  })

  it('Ask for a bid emails the bids box, and the call press says Call with the number', async () => {
    answer(200, box)
    mount()
    expect((await screen.findByTestId('box-page-bid')).getAttribute('href')).toBe(mailto('bids@example.com', 'Bid request', 'I would like a bid. I scanned box G81, 849F-DB0B: '))
    expect(screen.getByTestId('box-page-bid').textContent).toBe('Ask for a bid')
    expect(screen.getByTestId('box-page-call-office').getAttribute('href')).toBe('tel:+15125550142')
    expect(screen.getByTestId('box-page-call-office').textContent).toBe('Call (512) 555-0142')
  })

  it('Moved, damaged or in the way opens Let us know, with a text and an email that name the box', async () => {
    answer(200, box)
    mount()
    const row = await screen.findByTestId('box-page-know')
    expect(row.textContent).toBe('Moved, damaged or in the way?' + 'Let us know about box G81.' + '¿Estorba o está dañada? Avísenos.')
    expect(screen.queryByTestId('box-page-sheet')).toBeNull()
    fireEvent.click(row)
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true')
    expect(screen.getByTestId('box-page-sheet-title').textContent).toBe('Let us know')
    expect(screen.getByTestId('box-page-sheet-words').textContent).toBe('Send us a photo and we will work to make it right.')
    expect(screen.getByTestId('box-page-sheet-text').textContent).toBe('Send a text' + '(512) 555-0142')
    expect(screen.getByTestId('box-page-sheet-text').getAttribute('href')).toBe(sms('Box G81, 849F-DB0B: '))
    expect(screen.getByTestId('box-page-sheet-email').textContent).toBe('Send an email' + 'office@example.com')
    expect(screen.getByTestId('box-page-sheet-email').getAttribute('href')).toBe(mailto('office@example.com', 'Box G81, 849F-DB0B', 'Box G81, 849F-DB0B: '))
    // The first choice holds the focus, so a keyboard lands inside the sheet.
    expect(document.activeElement).toBe(screen.getByTestId('box-page-sheet-text'))
  })

  it('Work with us opens the same sheet under its own words', async () => {
    answer(200, box)
    mount()
    const row = await screen.findByTestId('box-page-work')
    expect(row.textContent).toBe('Work with us' + 'Always hiring motivated teammates.')
    fireEvent.click(row)
    expect(screen.getByTestId('box-page-sheet-title').textContent).toBe('Work with us')
    expect(screen.getByTestId('box-page-sheet-words').textContent).toBe('Always hiring motivated teammates. How would you like to reach the office?')
    expect(screen.getByTestId('box-page-sheet-text').getAttribute('href')).toBe(sms('I would like to work with Click. I scanned box G81, 849F-DB0B: '))
    expect(screen.getByTestId('box-page-sheet-email').getAttribute('href')).toBe(mailto('office@example.com', 'Work with Click', 'I would like to work with Click. I scanned box G81, 849F-DB0B: '))
  })

  it('a sheet closes on Not now, on Escape, on a press outside and on a choice, and the focus goes back to its row', async () => {
    answer(200, box)
    mount()
    const row = await screen.findByTestId('box-page-work')
    for (const shut of [
      () => fireEvent.click(screen.getByTestId('box-page-sheet-not-now')),
      () => fireEvent.keyDown(window, { key: 'Escape' }),
      () => fireEvent.click(screen.getByTestId('box-page-sheet-backdrop')),
      () => {
        // jsdom cannot follow a mail link; the press itself is what closes the sheet.
        const email = screen.getByTestId('box-page-sheet-email')
        email.addEventListener('click', (e) => e.preventDefault())
        fireEvent.click(email)
      },
    ]) {
      row.focus()
      fireEvent.click(row)
      expect(screen.getByTestId('box-page-sheet')).toBeTruthy()
      shut()
      expect(screen.queryByTestId('box-page-sheet')).toBeNull()
      expect(document.activeElement).toBe(row)
    }
  })

  it('Sign in to see what is inside stands on its own in an orange outline, remembers the box and goes to the sign-in', async () => {
    answer(200, box)
    mount()
    const signIn = await screen.findByTestId('box-page-sign-in')
    expect(signIn.textContent).toBe('Sign in to see what is inside' + 'For Click\'s crew. You stay signed in.')
    expect(signIn.style.border).toBe('2px solid rgb(199, 80, 0)')
    expect(signIn.closest('nav')).toBeNull()
    fireEvent.click(signIn)
    expect(localStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBe('/b/849fdb0b')
    expect(await screen.findByTestId('sign-in-page')).toBeTruthy()
  })

  it('the foot gives the website and the company\'s email', async () => {
    answer(200, box)
    mount()
    const foot = await screen.findByTestId('box-page-foot')
    expect(foot.textContent).toBe('clickplumbing.com · office@example.com')
    expect([...foot.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['https://clickplumbing.com', 'mailto:office@example.com'])
  })

  it('draws no part, count, photo, place, freshness or search, even when an older function still sends them', async () => {
    answer(200, beforeTheSeal)
    const { container } = mount()
    // The name is cut to what the label prints, whichever function sent it.
    expect((await screen.findByTestId('box-page-title')).textContent).toBe('Box G81')
    const words = container.textContent ?? ''
    for (const never of ['copper', 'Copper', 'PEX', 'Mueller', '318', '200', 'Level 2', 'north stair', 'None left', 'could not be found', 'Counted 5', 'Due a count', 'Never counted', 'Photo from', 'Find']) expect(words).not.toContain(never)
    // The one picture is the company's mark.
    expect([...container.querySelectorAll('img')].map((i) => i.getAttribute('data-testid'))).toEqual(['box-page-mark'])
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

  it('on a function that answers the number alone, the bid is a text, the sheets offer the text only and the foot gives the website', async () => {
    answer(200, numberAlone)
    mount()
    expect((await screen.findByTestId('box-page-bid')).getAttribute('href')).toBe(sms('I would like a bid. I scanned box G81, 849F-DB0B: '))
    fireEvent.click(screen.getByTestId('box-page-know'))
    expect(screen.getByTestId('box-page-sheet-text')).toBeTruthy()
    expect(screen.queryByTestId('box-page-sheet-email')).toBeNull()
    expect(screen.getByTestId('box-page-foot').textContent).toBe('clickplumbing.com')
  })

  it('with addresses and no number, the sheets offer the email only and no call is drawn', async () => {
    answer(200, { ...box, office: { phone: '', email: 'office@example.com', bidsEmail: 'bids@example.com' } })
    mount()
    await screen.findByTestId('box-page-title')
    expect(screen.queryByTestId('box-page-call-office')).toBeNull()
    fireEvent.click(screen.getByTestId('box-page-work'))
    expect(screen.queryByTestId('box-page-sheet-text')).toBeNull()
    expect(document.activeElement).toBe(screen.getByTestId('box-page-sheet-email'))
  })

  it('an answer with no office draws no press that needs one', async () => {
    answer(200, { ...box, office: null })
    mount()
    await screen.findByTestId('box-page-title')
    for (const press of ['box-page-bid', 'box-page-call-office', 'box-page-know', 'box-page-work']) expect(screen.queryByTestId(press)).toBeNull()
    // Whose it is and the sign-in still stand.
    expect(screen.getByTestId('box-page-company').textContent).toBe('Click Plumbing and Electrical')
    expect(screen.getByTestId('box-page-sign-in')).toBeTruthy()
  })

  it('a cage reads as a cage', async () => {
    answer(200, { ...box, box: { ...box.box, stencil: 'B3', kind: 'cage' } })
    mount()
    expect((await screen.findByTestId('box-page-kind')).textContent).toBe('Our cage on this site')
    expect(screen.getByTestId('box-page-title').textContent).toBe('Cage B3')
    expect(screen.getByTestId('box-page-know').textContent).toContain('Let us know about cage B3.')
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
  it('a blank sticker says only that, offers the sign-in and nothing else, and never its number', async () => {
    // box-read still answers the number; the page does not say it (Taunya's call of 2026-11-16)
    answer(404, { error: 'sticker_blank', number: 147 })
    mount('9B1C0D2E')
    const page = await screen.findByTestId('box-page-sticker-blank')
    expect(page.textContent).toBe('This sticker is reserved for a box' + 'It is not on a box yet. Sign in to say which box it is on.' + 'Sign in')
    expect(document.title).toBe('Reserved sticker · Click Plumbing & Electrical')
    expect(document.body.textContent).not.toContain('0147')
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
    expect(page.textContent).toContain('This sticker was marked lost')
    expect(document.title).toBe('Lost sticker · Click Plumbing & Electrical')
    expect(page.textContent).toContain('Someone marked it lost on Saturday, Nov 7. It no longer opens a box.')
    expect(screen.queryByTestId('box-page-retired')).toBeNull()
    fireEvent.click(screen.getByTestId('box-page-scan-another'))
    expect(await screen.findByTestId('scan-page')).toBeTruthy()
  })

  it('a sticker on a box draws that box as a label does, with the code scanned and no number', async () => {
    answer(200, { ...box, box: { ...box.box, code: '9B1C0D2E', stickerNumber: 147 } })
    mount('9B1C0D2E')
    expect((await screen.findByTestId('box-page-title')).textContent).toBe('Box G81')
    expect(screen.queryByTestId('box-page-sticker')).toBeNull()
    expect(screen.getByTestId('box-page-code').textContent).toBe('9B1C-0D2E')
  })

  it('a label\'s own code draws no sticker number', async () => {
    answer(200, box)
    mount()
    await screen.findByTestId('box-page-title')
    expect(screen.queryByTestId('box-page-sticker')).toBeNull()
  })
})
