// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CustomerRating from './CustomerRating'

/** The review ask on /rate (v2.5934, punch list #185): the paths the owner asked for, on top of the one-tap rating. */

const TOKEN = 'b'.repeat(32)
const AROUND = {
  jobName: 'the water heater',
  company: { name: 'Click Plumbing and Electrical', phone: '(512) 360-0599' },
  lang: 'en',
  googleLink: 'https://g.page/r/example/review',
  googlePressed: false,
  portalUrl: 'https://my.clickplumbing.com/dana-whitfield',
}

function mount(search = `?t=${TOKEN}`) {
  return render(
    <MemoryRouter initialEntries={[`/rate${search}`]}>
      <Routes>
        <Route path="/rate" element={<CustomerRating />} />
      </Routes>
    </MemoryRouter>,
  )
}

function answer(bodies: Array<{ status: number; body: unknown }>) {
  let i = 0
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    const a = bodies[Math.min(i, bodies.length - 1)] ?? { status: 500, body: {} }
    i += 1
    return { status: a.status, ok: a.status < 400, json: async () => a.body }
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const bodyOf = (fn: ReturnType<typeof answer>, call: number) => JSON.parse(String((fn.mock.calls[call]?.[1] as RequestInit | undefined)?.body ?? '{}')) as Record<string, unknown>

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the review ask on the rating page', () => {
  it('names the company and the job, and at five stars asks for Google with their words copied and the press sent', async () => {
    const fn = answer([
      { status: 200, body: { ok: true, name: 'Dana', score: null, words: '', answered: false, ...AROUND } },
      { status: 200, body: { ok: true, score: 5, words: '', answered: true } },
      { status: 200, body: { ok: true, score: 5, words: 'Luis was great.', answered: true } },
      { status: 200, body: { ok: true, score: 5, words: 'Luis was great.', answered: true, googlePressed: true } },
    ])
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    mount()
    expect(await screen.findByText('Dana, how did we do on the water heater?')).toBeTruthy()
    expect(screen.getAllByText('Click Plumbing and Electrical').length).toBeGreaterThan(0)
    expect(screen.getByText('Tap a star')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Great' }))
    expect(await screen.findByText('Would you put this on Google for us? It takes a minute, and it helps the next family find us.')).toBeTruthy()
    expect(screen.queryByText('Someone from the office will call you. We want to make this right.')).toBeNull()
    fireEvent.change(screen.getByLabelText('Anything we should know? (optional)'), { target: { value: 'Luis was great.' } })
    const link = screen.getByRole('link', { name: /Post it on Google/ })
    expect(link.getAttribute('href')).toBe('https://g.page/r/example/review')
    expect(link.getAttribute('target')).toBe('_blank')
    fireEvent.click(link)
    expect(writeText).toHaveBeenCalledWith('Luis was great.')
    await waitFor(() => expect(fn.mock.calls.length).toBe(4))
    expect(bodyOf(fn, 2)).toEqual({ t: TOKEN, score: 5, words: 'Luis was great.' })
    expect(bodyOf(fn, 3)).toEqual({ t: TOKEN, action: 'google' })
    expect(await screen.findByText('Your words are copied. Paste them there.')).toBeTruthy()
    expect(screen.getByText('my.clickplumbing.com/dana-whitfield')).toBeTruthy()
  })

  it('at two stars asks what we could have done better, promises the call, and keeps the same Google line under it', async () => {
    answer([{ status: 200, body: { ok: true, name: 'Dana', score: 2, words: '', answered: true, ...AROUND } }])
    mount()
    expect(await screen.findByText('Thank you for the honest answer. We will do better.')).toBeTruthy()
    expect(screen.getByText('Someone from the office will call you. We want to make this right.')).toBeTruthy()
    expect(screen.getByLabelText('What could we have done better? (optional)')).toBeTruthy()
    expect(screen.getByText('If you want to say it on Google too, the same button is here.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Poor' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('at four stars asks what we could have done better and promises no call', async () => {
    answer([{ status: 200, body: { ok: true, name: 'Dana', score: 4, words: '', answered: true, ...AROUND } }])
    mount()
    expect(await screen.findByLabelText('What could we have done better? (optional)')).toBeTruthy()
    expect(screen.queryByText('Someone from the office will call you. We want to make this right.')).toBeNull()
  })

  it('names no Google without a link: a trade partner, or no link set', async () => {
    answer([{ status: 200, body: { ok: true, name: 'Greg', score: 5, words: '', answered: true, ...AROUND, googleLink: null } }])
    mount()
    expect(await screen.findByText('Thank you. Your answer is saved.')).toBeTruthy()
    expect(screen.queryByText(/Post it on Google/)).toBeNull()
  })

  it('draws the answered samples for What customers see without a fetch', async () => {
    const fn = answer([{ status: 500, body: {} }])
    mount('?t=sample-done')
    expect(await screen.findByText('Would you put this on Google for us? It takes a minute, and it helps the next family find us.')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Sample')
    cleanup()
    mount('?t=sample-low')
    expect(await screen.findByText('Someone from the office will call you. We want to make this right.')).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: /Post it on Google/ }))
    expect(fn.mock.calls).toHaveLength(0)
  })
})
