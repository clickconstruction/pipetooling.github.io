// @vitest-environment jsdom
/**
 * The firm's confirm page when the link cannot answer (punch list #184, v2.5965): a lost signal reads No connection
 * with Try again; an answer the page cannot read is a refusal, never *That link has expired*; an expired answer
 * shows its reason only when it is one the function writes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LegalConfirm from './LegalConfirm'

const TOKEN = 'c0nf1rmt0k3n-0123456789abcdef'
const answer = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response

function mount() {
  return render(
    <MemoryRouter initialEntries={[`/legal/confirm?t=${TOKEN}`]}>
      <LegalConfirm />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('LegalConfirm failures (v2.5965)', () => {
  it('a lost signal reads No connection with Try again, which confirms', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockResolvedValue(answer(200, { kind: 'confirmed', name: 'Ann Lawyer', email: 'ann@firm.example.com' }))
    vi.stubGlobal('fetch', fetchMock)
    mount()
    expect(await screen.findByText('No connection')).toBeTruthy()
    expect(screen.getByText('Check your signal and try again.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/ann@firm\.example\.com/)).toBeTruthy()
  })

  it('an answer the page cannot read is a refusal, never an expired link', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(500, null)))
    mount()
    expect(await screen.findByText("We couldn't open this page")).toBeTruthy()
    expect(screen.getByText('Please try again later.')).toBeTruthy()
    expect(screen.queryByText('That link has expired.')).toBeNull()
  })

  it('an expired answer shows a reason the function writes, and the page’s own reason for any other', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(404, { kind: 'expired', reason: 'Use the link in a newer email, or stop emails from the portal.' })))
    mount()
    expect(await screen.findByText('Use the link in a newer email, or stop emails from the portal.')).toBeTruthy()
    cleanup()
    vi.stubGlobal('fetch', vi.fn(async () => answer(404, { kind: 'expired', reason: 'relation "legal_firm_recipients" does not exist' })))
    mount()
    expect(await screen.findByText('That link has expired.')).toBeTruthy()
    expect(screen.queryByText(/legal_firm_recipients/)).toBeNull()
  })
})
