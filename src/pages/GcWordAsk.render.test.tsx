// @vitest-environment jsdom
/**
 * Render smoke for the ask-by-link page: it opens on the token alone, shows
 * each GC with the broken promise and the last word, sends only the rows he
 * finished, names the one he did not, and says so when the link is dead.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

import GcWordAsk from './GcWordAsk'

const PAGE = {
  ownerName: 'Malachi Douglas',
  askedByName: 'Taunya Smith',
  weekStart: '2026-09-28',
  expiresAt: '2026-10-06T15:00:00Z',
  answeredAt: null,
  gcs: [
    { gcId: 'knight', gcName: 'Knight Contracting', amount: 26000, oldestAgeDays: 41, over90: 0, lastWord: { temperature: 'warm', note: 'Check run is the 20th.', by: 'Malachi', at: '2026-09-18T15:00:00Z' }, promise: { payBy: '2026-09-20', late: true, daysLate: 8 }, noChangeAllowed: true, answer: null },
    { gcId: 'loberg', gcName: 'Loberg Contracting', amount: 22000, oldestAgeDays: 19, over90: 0, lastWord: null, promise: null, noChangeAllowed: false, answer: null },
  ],
}

const calls: Array<{ url: string; init?: RequestInit }> = []
let getResponse: { ok: boolean; body: unknown } = { ok: true, body: PAGE }

beforeEach(() => {
  calls.length = 0
  getResponse = { ok: true, body: PAGE }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (init?.method === 'POST') return { ok: true, json: async () => ({ ok: true, saved: 1 }) }
      return { ok: getResponse.ok, json: async () => getResponse.body }
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

const open = (search = '?t=0123456789abcdef0123456789abcdef') =>
  render(
    <MemoryRouter initialEntries={[`/ask${search}`]}>
      <GcWordAsk />
    </MemoryRouter>,
  )

const gc = (name: string) => within(screen.getByRole('region', { name }))

describe('GcWordAsk', () => {
  it('opens on the token, with no sign-in, and shows what he needs to answer', async () => {
    open()
    expect(await screen.findByText('Malachi, 2 GCs · $48,000 owed')).toBeTruthy()
    expect(calls[0]?.url).toContain('/functions/v1/gc-word-ask?token=0123456789abcdef0123456789abcdef')
    expect(gc('Knight Contracting').getByText('promised Sep 20 — 8 days late')).toBeTruthy()
    expect(gc('Knight Contracting').getByText(/Last word Sep 18 · warm · “Check run is the 20th.” — Malachi/)).toBeTruthy()
    expect(gc('Loberg Contracting').getByText('Nobody has written down what this GC said.')).toBeTruthy()
    expect(gc('Loberg Contracting').queryByLabelText('no change')).toBeNull()
    expect((screen.getByRole('button', { name: /Answer at least one/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('sends only the rows he finished, to the office', async () => {
    open()
    await screen.findByText('Malachi, 2 GCs · $48,000 owed')
    fireEvent.click(gc('Knight Contracting').getByRole('radio', { name: /Cool/ }))
    fireEvent.change(gc('Knight Contracting').getByLabelText('What Knight Contracting said'), { target: { value: 'Missed the 20th, now says the 10th.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send 1 answer to Taunya' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Sent to Taunya — 1 answer'))
    const post = calls.find((c) => c.init?.method === 'POST')!
    expect(JSON.parse(String(post.init?.body))).toEqual({
      token: '0123456789abcdef0123456789abcdef',
      answers: [{ gcId: 'knight', temperature: 'cool', note: 'Missed the 20th, now says the 10th.', payBy: null, noChange: false }],
      website: '',
    })
  })

  it('holds a half-filled row back and names it', async () => {
    open()
    await screen.findByText('Malachi, 2 GCs · $48,000 owed')
    fireEvent.click(gc('Knight Contracting').getByLabelText('no change'))
    fireEvent.click(gc('Loberg Contracting').getByRole('radio', { name: /Warm/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Send 1 answer to Taunya' }))
    expect(screen.getByRole('alert').textContent).toBe('Loberg Contracting: a sentence, not a word.')
    expect(calls.some((c) => c.init?.method === 'POST')).toBe(false)
  })

  it('says so when the link is dead', async () => {
    getResponse = { ok: false, body: { error: 'This link has run out. Ask the office to send you a new one.' } }
    open()
    expect(await screen.findByText('This link has run out. Ask the office to send you a new one.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Send/ })).toBeNull()
  })

  it('does not call out without a token', async () => {
    open('')
    expect(await screen.findByText(/missing its key/)).toBeTruthy()
    expect(calls).toHaveLength(0)
  })
})
