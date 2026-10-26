// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CustomerReview from './CustomerReview'

function mount(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/r/${token}`]}>
      <Routes>
        <Route path="/r/:token" element={<CustomerReview />} />
      </Routes>
    </MemoryRouter>,
  )
}

function answer(status: number, body: unknown) {
  const fn = vi.fn(async () => ({ status, ok: status < 400, json: async () => body }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('CustomerReview (v2.5896, punch list #185)', () => {
  it('the sample asks the question, lights the stars on a tap, and thanks with the Google ask at five', async () => {
    mount('sample')
    expect(screen.getByText('How did we do on the water heater, Sam?')).toBeTruthy()
    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '5 stars' }))
    expect(screen.getByText('Great')).toBeTruthy()
    const send5 = screen.getByRole('button', { name: 'Send 5 stars' }) as HTMLButtonElement
    expect(send5.disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('A sentence in your words, if you like.'), { target: { value: 'Luis was great.' } })
    fireEvent.click(send5)
    expect(screen.getByText('Thank you, Sam.')).toBeTruthy()
    expect(screen.getByText(/Luis was great\./)).toBeTruthy()
    expect(screen.getByText('Post it on Google')).toBeTruthy()
    expect(screen.getByText(/Sample — this is what a customer sees/)).toBeTruthy()
  })

  it('fewer stars asks what we could have done better, promises the call, and keeps the Google line under it', () => {
    mount('sample')
    fireEvent.click(screen.getByRole('button', { name: '2 stars' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send 2 stars' }))
    expect(screen.getByText('Thank you for telling us, Sam.')).toBeTruthy()
    expect(screen.getByText('What could we have done better?')).toBeTruthy()
    expect(screen.getByText(/Someone from the office will call you/)).toBeTruthy()
    expect(screen.getByText('Post it on Google')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('What could we have done better?'), { target: { value: 'Wipe the floor.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByText('Thank you. The office reads this today.')).toBeTruthy()
  })

  it('the done sample draws the answered page', () => {
    mount('sample-done')
    expect(screen.getByText('Thank you, Sam.')).toBeTruthy()
    expect(screen.getByText(/In and out in an hour/)).toBeTruthy()
  })

  it('a live token asks the function, and a dead link says so in words', async () => {
    const fn = answer(200, {
      ok: true,
      state: 'open',
      first: 'Dana',
      jobName: 'job 1312',
      company: { name: 'Click Plumbing and Electrical', phone: '(512) 360-0599' },
      lang: 'en',
      stars: null,
      words: null,
      better: null,
      googleLink: null,
      googlePressed: false,
      portalUrl: null,
    })
    mount('abc123')
    await waitFor(() => expect(screen.getByText('How did we do on job 1312, Dana?')).toBeTruthy())
    expect(String(fn.mock.calls[0]?.[0])).toContain('/functions/v1/customer-review?t=abc123')
    cleanup()
    answer(410, { error: 'expired' })
    mount('old')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('This link has run out'))
  })
})
