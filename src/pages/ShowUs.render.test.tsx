// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ShowUsRoute from './ShowUsRoute'
import { FIRST_LOOK_WORDS, type FirstLookPagePayload, type FirstLookPageView } from '../lib/firstLook/look'
import type { PieceTransport } from '../lib/firstLook/pieces'
import type { ShowUsIo } from '../lib/firstLook/showUsIo'

vi.mock('../lib/firstLook/kept', async (orig) => {
  const real = await orig<typeof import('../lib/firstLook/kept')>()
  // jsdom has no IndexedDB: the page keeps its files in memory, as a private window does.
  return { ...real, openKeptStore: async () => real.createMemoryKeptStore() }
})
vi.mock('../lib/photos/shrink', () => ({ shrinkReportPhoto: async (file: File) => ({ blob: file, width: 10, height: 10, shrunk: false }) }))

const CODE = 'k7m2p9xq4d'

const payload = (more: Partial<FirstLookPagePayload['look']> = {}): FirstLookPagePayload => ({
  ok: true,
  look: { askedBy: 'Rosa', photos: 0, videos: 0, sentCount: 0, ...more },
  caps: { photos: 20, videos: 3, photoBytes: 8_388_608, videoBytes: 52_428_800 },
  office: { phone: '(512) 555-0100', open: true, closesWords: '5 PM', opensWords: null },
})

const noPieces: PieceTransport = {
  create: async () => ({ ok: false, status: 400 }),
  offset: async () => null,
  patch: async () => ({ ok: false, status: 400 }),
}

function fakeIo(view: FirstLookPageView | { kind: 'signal' }, more: Partial<ShowUsIo> = {}): ShowUsIo {
  return {
    read: vi.fn(async () => view),
    sign: vi.fn(async () => ({ ok: true as const, fileId: 'f1', bucket: 'first-look-files', path: 'look/f1.jpg', token: 't', signedUrl: 'https://storage.example/sign' })),
    done: vi.fn(async () => ({ ok: true as const, photos: 1, videos: 0 })),
    send: vi.fn(async () => ({ ok: true as const, thanks: { got: 'Got it. Rosa has your 1 photo.', steps: ['Rosa looks at them today, before 5 PM.', 'We text you at this number with a price or a time to come out.', 'The tech confirms the price at your home before any work starts.'] } })),
    putWhole: vi.fn(async (_url: string, blob: Blob, _mime: string, onSent: (n: number) => void) => {
      onSent(blob.size)
      return { ok: true as const }
    }),
    pieces: noPieces,
    piecePlan: (signed, mime) => ({ endpoint: 'e', bucket: signed.bucket, path: signed.path, mime, headers: {} }),
    ...more,
  }
}

function mount(io: ShowUsIo, code = CODE) {
  return render(
    <MemoryRouter initialEntries={[`/show/${code}`]}>
      <Routes>
        <Route path="/show/:code" element={<ShowUsRoute io={io} />} />
      </Routes>
    </MemoryRouter>,
  )
}

const photo = (name = 'sink.jpg') => new File([new Uint8Array(2000)], name, { type: 'image/jpeg' })

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Show us the problem', () => {
  it('opens with who asked, the three presses, the four tips and the owner\'s line, and nothing about the customer', async () => {
    mount(fakeIo({ kind: 'open', payload: payload() }))
    expect(await screen.findByRole('heading', { name: FIRST_LOOK_WORDS.heading })).toBeTruthy()
    expect(screen.getByText(/Rosa asked for a look\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: FIRST_LOOK_WORDS.takePhoto })).toBeTruthy()
    expect(screen.getByRole('button', { name: FIRST_LOOK_WORDS.takeVideo })).toBeTruthy()
    expect(screen.getByTestId('show-us-take-photo').getAttribute('accept')).toBe('image/*')
    expect(screen.getByTestId('show-us-take-video').getAttribute('accept')).toBe('video/*')
    expect(screen.getByRole('button', { name: FIRST_LOOK_WORDS.choose })).toBeTruthy()
    for (const tip of FIRST_LOOK_WORDS.tips) expect(screen.getByText(tip)).toBeTruthy()
    expect(screen.getByText(FIRST_LOOK_WORDS.why)).toBeTruthy()
    expect(screen.getAllByRole('link', { name: '(512) 555-0100' }).length).toBeGreaterThan(0)
    expect(document.querySelector('[data-theme="light"]')).toBeTruthy()
  })

  it('a picked photo is sent, the press names its count, and the thank-you follows', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    window.scrollTo = vi.fn()
    const io = fakeIo({ kind: 'open', payload: payload() })
    mount(io)
    await screen.findByRole('heading', { name: FIRST_LOOK_WORDS.heading })
    fireEvent.change(screen.getByTestId('show-us-choose'), { target: { files: [photo()] } })
    const send = await screen.findByRole('button', { name: 'Send 1 photo' })
    expect(io.sign).toHaveBeenCalledWith(CODE, expect.objectContaining({ mime: 'image/jpeg', bytes: 2000, fileId: null }))
    expect(io.putWhole).toHaveBeenCalledTimes(1)
    expect(io.done).toHaveBeenCalledWith(CODE, expect.objectContaining({ fileId: 'f1', road: 'whole', resumed: 0 }))
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }))
    fireEvent.change(screen.getByLabelText(/What is going on\?/), { target: { value: 'It drips when the dishwasher runs.' } })
    fireEvent.click(send)
    expect(await screen.findByText('Got it. Rosa has your 1 photo.')).toBeTruthy()
    expect(io.send).toHaveBeenCalledWith(CODE, { place: 'Kitchen', words: 'It drips when the dishwasher runs.' })
    expect(screen.getByRole('button', { name: FIRST_LOOK_WORDS.more })).toBeTruthy()
  })

  it('with no signal the file is kept, the page says so, and Try now sends it', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    let online = false
    const io = fakeIo(
      { kind: 'open', payload: payload() },
      { sign: vi.fn(async () => (online ? { ok: true as const, fileId: 'f1', bucket: 'b', path: 'p', token: 't', signedUrl: 'u' } : { ok: false as const, why: 'signal' as const })) },
    )
    mount(io)
    await screen.findByRole('heading', { name: FIRST_LOOK_WORDS.heading })
    fireEvent.change(screen.getByTestId('show-us-choose'), { target: { files: [photo()] } })
    expect(await screen.findByText(FIRST_LOOK_WORDS.kept)).toBeTruthy()
    expect(screen.getByRole('button', { name: FIRST_LOOK_WORDS.waitsForSignal }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Kept on this phone')).toBeTruthy()
    online = true
    fireEvent.click(screen.getByRole('button', { name: FIRST_LOOK_WORDS.tryNow }))
    expect(await screen.findByRole('button', { name: 'Send 1 photo' })).toBeTruthy()
    expect(screen.queryByText(FIRST_LOOK_WORDS.kept)).toBeNull()
  })

  it('a file that is not a photo or a video is left out in words, and nothing is asked of the function', async () => {
    const io = fakeIo({ kind: 'open', payload: payload() })
    mount(io)
    await screen.findByRole('heading', { name: FIRST_LOOK_WORDS.heading })
    fireEvent.change(screen.getByTestId('show-us-choose'), { target: { files: [new File(['%PDF'], 'quote.pdf', { type: 'application/pdf' })] } })
    expect(await screen.findByText('quote.pdf is not a photo or a video, so it was left out.')).toBeTruthy()
    expect(io.sign).not.toHaveBeenCalled()
  })

  it('a refusal from the function shows on the file in the function\'s words', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const io = fakeIo({ kind: 'open', payload: payload() }, { sign: vi.fn(async () => ({ ok: false as const, why: 'refused' as const, words: 'This link takes 20 photos, and it has them.', gone: false })) })
    mount(io)
    await screen.findByRole('heading', { name: FIRST_LOOK_WORDS.heading })
    fireEvent.change(screen.getByTestId('show-us-choose'), { target: { files: [photo()] } })
    expect(await screen.findByText('This link takes 20 photos, and it has them.')).toBeTruthy()
  })

  it('opened again with files in and never sent, it offers the send', async () => {
    window.scrollTo = vi.fn()
    const io = fakeIo({ kind: 'open', payload: payload({ photos: 3, videos: 1, sentCount: 0 }) })
    mount(io)
    fireEvent.click(await screen.findByRole('button', { name: 'Send 3 photos and 1 video' }))
    await waitFor(() => expect(io.send).toHaveBeenCalledTimes(1))
  })

  it('opened again after a send, it says what the link holds and shows no picture', async () => {
    mount(fakeIo({ kind: 'open', payload: payload({ photos: 3, videos: 1, sentCount: 1 }) }))
    expect(await screen.findByText(/This link already has 3 photos and 1 video from you\./)).toBeTruthy()
    expect(document.querySelector('img')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Send / })).toBeNull()
  })

  it('says why a link opens nothing', async () => {
    mount(fakeIo({ kind: 'closed', phone: '(512) 555-0100' }))
    expect(await screen.findByRole('heading', { name: FIRST_LOOK_WORDS.closedHead })).toBeTruthy()
    cleanup()
    mount(fakeIo({ kind: 'expired', phone: '' }))
    expect(await screen.findByRole('heading', { name: FIRST_LOOK_WORDS.expiredHead })).toBeTruthy()
    cleanup()
    mount(fakeIo({ kind: 'not_found' }))
    expect(await screen.findByRole('heading', { name: FIRST_LOOK_WORDS.notFoundHead })).toBeTruthy()
    cleanup()
    mount(fakeIo({ kind: 'locked' }))
    expect(await screen.findByRole('heading', { name: FIRST_LOOK_WORDS.lockedHead })).toBeTruthy()
  })

  it('a code that is not ten letters is not found without a call', async () => {
    const io = fakeIo({ kind: 'open', payload: payload() })
    mount(io, 'nope')
    expect(await screen.findByRole('heading', { name: FIRST_LOOK_WORDS.notFoundHead })).toBeTruthy()
    expect(io.read).not.toHaveBeenCalled()
  })

  it('with no signal at the door it says the link needs one, and Try again reads again', async () => {
    const io = fakeIo({ kind: 'signal' })
    mount(io)
    expect(await screen.findByRole('heading', { name: 'This phone has no signal right now' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(io.read).toHaveBeenCalledTimes(2))
  })

  it('the sample’s done state opens on its thank-you (What customers see)', async () => {
    const thanks = { got: 'Got it. Rosa has your 3 photos and 1 video.', steps: ['Rosa looks at them today, before 5 PM.', 'We text you at this number with a price or a time to come out.'] }
    const io = fakeIo({ kind: 'open', payload: { ...payload(), look: { askedBy: 'Rosa', photos: 3, videos: 1, sentCount: 1 }, thanks } })
    mount(io, 'sample-done')
    expect(await screen.findByText('Got it. Rosa has your 3 photos and 1 video.')).toBeTruthy()
    expect(screen.getByText('Rosa looks at them today, before 5 PM.')).toBeTruthy()
    expect(io.read).toHaveBeenCalledWith('sample-done')
    expect(io.send).not.toHaveBeenCalled()
  })

  it('the sample opens as the page before anything is added', async () => {
    const io = fakeIo({ kind: 'open', payload: payload() })
    mount(io, 'sample')
    expect(await screen.findByRole('heading', { name: FIRST_LOOK_WORDS.heading })).toBeTruthy()
    expect(io.read).toHaveBeenCalledWith('sample')
  })
})
