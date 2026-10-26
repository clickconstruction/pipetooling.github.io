// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CustomerRating from './CustomerRating'

const TOKEN = 'a'.repeat(32)
const fresh = { ok: true, name: 'Dana', score: null, words: '', answered: false }

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
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const a = bodies[Math.min(i, bodies.length - 1)]
      i += 1
      return { status: a.status, ok: a.status < 400, json: async () => a.body }
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CustomerRating page', () => {
  it('asks by name, saves one tap and thanks, then sends the words', async () => {
    answer([
      { status: 200, body: fresh },
      { status: 200, body: { ok: true, score: 5, words: '', answered: true } },
      { status: 200, body: { ok: true, score: 5, words: 'Fast and clean.', answered: true } },
    ])
    mount()
    expect(await screen.findByText('Dana, how did we do?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Great' }))
    expect(await screen.findByText('Thank you. Your answer is saved.')).toBeTruthy()
    const post = vi.mocked(fetch).mock.calls[1]
    expect(String(post?.[0])).toContain('/functions/v1/job-rating')
    expect(JSON.parse(String((post?.[1] as RequestInit).body))).toEqual({ t: TOKEN, score: 5 })
    fireEvent.change(screen.getByLabelText('Anything we should know? (optional)'), { target: { value: 'Fast and clean.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the words' }))
    expect(await screen.findByText('Sent. Thank you.')).toBeTruthy()
  })

  it('thanks a low score with the honest line and shows an answered ask as answered', async () => {
    answer([
      { status: 200, body: { ok: true, name: '', score: 2, words: 'Late twice.', answered: true } },
    ])
    mount()
    expect(await screen.findByText('How did we do?')).toBeTruthy()
    expect(await screen.findByText('Thank you for the honest answer. We will do better.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Poor' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('reads a bad link as one, without a fetch', async () => {
    answer([{ status: 200, body: fresh }])
    mount('?t=nope')
    expect(await screen.findByText('This link is incomplete or has expired. Reply to our text and we will send a fresh one.')).toBeTruthy()
    expect(vi.mocked(fetch).mock.calls).toHaveLength(0)
  })

  it('says when an expired link cannot be read', async () => {
    answer([{ status: 404, body: { error: 'This link has expired.' } }])
    mount()
    expect(await screen.findByText('This link is incomplete or has expired. Reply to our text and we will send a fresh one.')).toBeTruthy()
  })
})
