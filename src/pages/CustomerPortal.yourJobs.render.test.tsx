// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CustomerPortal from './CustomerPortal'

/** Your jobs on the portal (v2.5948, punch list #185 PR 5): where each job is, and the review. */
const base = {
  company: { name: 'Click Plumbing and Electrical', cityLine: '', licenseLine: '', phone: '', email: '' },
  customerName: 'Dana Whitfield',
  audience: 'customer',
  bills: [],
  totalDue: 0,
  requestableJobs: [],
}

function mount(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
  return render(
    <MemoryRouter initialEntries={['/portal?t=abcdef1234567890abcdef']}>
      <CustomerPortal />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('CustomerPortal · Your jobs', () => {
  it('lists each job with its stage, a door to the review while it is open, and the stars after', async () => {
    mount({
      ...base,
      myJobs: [
        { jobId: 'j-sink', label: 'Kitchen sink', address: '1208 Mesquite Ln', stage: 1, rateToken: null, stars: null },
        { jobId: 'j-heater', label: 'Water heater', address: '1208 Mesquite Ln', stage: 4, rateToken: 'a'.repeat(32), stars: null },
        { jobId: 'j-softener', label: 'Water softener', address: null, stage: 4, rateToken: null, stars: 5 },
      ],
    })
    await waitFor(() => expect(screen.getByText('Your jobs')).toBeTruthy())
    const jobs = [...document.querySelectorAll('[data-portal-my-job]')] as HTMLElement[]
    expect(jobs).toHaveLength(3)
    const sink = within(jobs[0]!)
    expect(sink.getByText('Kitchen sink')).toBeTruthy()
    expect(sink.getByText('Working').closest('li')?.getAttribute('aria-current')).toBe('step')
    const rate = within(jobs[1]!).getByRole('link', { name: /How did we do\? Rate us with one tap/ }) as HTMLAnchorElement
    expect(rate.getAttribute('href')).toBe(`/rate?t=${'a'.repeat(32)}`)
    expect(within(jobs[2]!).getByText(/You gave us 5 stars\. Thank you\./)).toBeTruthy()
  })

  it('draws no card for a customer with nothing to follow, or a function from before it', async () => {
    mount(base)
    await waitFor(() => expect(screen.getByText('Dana Whitfield')).toBeTruthy())
    expect(screen.queryByText('Your jobs')).toBeNull()
  })
})
