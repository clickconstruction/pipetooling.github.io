// @vitest-environment jsdom
/**
 * Punch list #217, outside-12 (a prototype): the customer's pay-by promise as a strip on the bill's row. Without the
 * flag the statement reads as today (the sentence and the chips at the top); with `?shape=1` the day on record draws
 * under each owed bill with the chips under the first; with `?sbs=1` on the sample token both looks draw one above the
 * other; a real token with nobody signed in keeps today's look whatever the flag says.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CustomerPortal from './CustomerPortal'
import { SAMPLE_TOKEN } from '../../supabase/functions/_shared/customerSample'
import { promiseChangeChips, promiseStripMonthDay, promiseStripWeekday } from '../lib/portal/portalPromiseStrip'

// The page reads today from the browser's clock, so the fixture is laid out from it.
const now = new Date()
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const plus = (n: number) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n)
  return ymd(d)
}
const TODAY = plus(0)
const PROMISED = plus(7)
const CALL = plus(14)
const BILLED = plus(-40)

const payload = {
  company: { name: 'Click Plumbing and Electrical', cityLine: 'San Antonio, Texas', licenseLine: '', phone: '', email: '' },
  customerName: 'Michael Hageman',
  audience: 'customer',
  bills: [
    { jobLabel: 'Water heater replacement · Job 612', jobNumber: '612', jobName: 'Water heater replacement', serviceTag: 'plum', jobAddress: '3827 Sage Ridge Dr, San Antonio, TX 78258', amount: 1450, billedOn: BILLED, payUrl: null, checkRef: '612' },
    { jobLabel: 'Service call · Job 655', jobNumber: '655', jobName: 'Service call', jobAddress: null, amount: 250, billedOn: plus(-9), payUrl: null, checkRef: '655' },
  ],
  totalDue: 1700,
  requestableJobs: [],
  promise: { promisedYmd: PROMISED, source: 'customer', callYmd: CALL },
}

const REAL = 'abcdef1234567890abcdef'
const posts: unknown[] = []

function mountAt(url: string) {
  posts.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)))
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      return new Response(JSON.stringify(payload), { status: 200 })
    }),
  )
  return render(
    <MemoryRouter initialEntries={[url]}>
      <CustomerPortal />
    </MemoryRouter>,
  )
}

const strips = () => Array.from(document.querySelectorAll<HTMLElement>('[data-portal-promise-strip]'))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the pay-by promise on the bill’s row (punch list #217, outside-12)', () => {
  it('reads as today without the flag: the sentence and the chips at the top, no strip', async () => {
    mountAt(`/portal?t=${REAL}`)
    await waitFor(() => expect(screen.getByText(/You told us to expect payment by/)).toBeTruthy())
    expect(strips()).toHaveLength(0)
    expect(document.querySelector('[data-side-by-side]')).toBeNull()
  })

  it('draws the strip under each owed bill with ?shape=1, the chips under the first, and no sentence at the top', async () => {
    mountAt(`/portal?t=${REAL}&shape=1`)
    await waitFor(() => expect(strips()).toHaveLength(2))
    expect(screen.queryByText(/You told us to expect payment by/)).toBeNull()
    // The ledger lists the newest bill first; the strip reads whichever bill it sits under.
    const billed = strips()[0]!.getAttribute('data-billed')!
    expect([BILLED, plus(-9)]).toContain(billed)
    const first = within(strips()[0]!)
    const picture = first.getByRole('img')
    expect(picture.getAttribute('aria-label')).toBe(`Billed ${promiseStripMonthDay(billed)}. Your day is ${promiseStripWeekday(PROMISED)}. We call ${promiseStripMonthDay(CALL)} if it has not come.`)
    expect(first.getByText(promiseStripWeekday(PROMISED))).toBeTruthy()
    expect(first.getByText('billed')).toBeTruthy()
    expect(first.getByText('your day')).toBeTruthy()
    expect(first.getByText('we call')).toBeTruthy()
    expect(first.getByText(`${promiseStripMonthDay(CALL)}, if not in`)).toBeTruthy()
    expect(first.getByText('Changed?')).toBeTruthy()
    expect(first.getByRole('button', { name: 'Tell us' })).toBeTruthy()
    // The account has one day, so the second bill carries the strip and not the chips.
    expect(within(strips()[1]!).queryByText('Changed?')).toBeNull()
    expect(strips()[1]!.getAttribute('data-call')).toBe(CALL)
  })

  it('moves the day from the chips on the sample, sends nothing, and every strip redraws on it', async () => {
    mountAt(`/portal?t=${SAMPLE_TOKEN}&shape=1`)
    await waitFor(() => expect(strips()).toHaveLength(2))
    const chip = promiseChangeChips(TODAY, PROMISED)[0]!
    const first = within(strips()[0]!)
    fireEvent.click(first.getByRole('button', { name: chip.label }))
    fireEvent.click(first.getByRole('button', { name: 'Tell us' }))
    await waitFor(() => expect(screen.getByText("Thank you. We'll hold off on reminders until then.")).toBeTruthy())
    expect(posts).toEqual([])
    for (const s of strips()) expect(s.getAttribute('data-promised')).toBe(chip.ymd)
  })

  it('draws both looks one above the other with ?sbs=1 on the sample token', async () => {
    mountAt(`/portal?t=${SAMPLE_TOKEN}&sbs=1`)
    const both = await screen.findByTestId('portal-side-by-side')
    expect(within(both).getByText('Today')).toBeTruthy()
    expect(within(both).getByText('With the strip')).toBeTruthy()
    const today = both.querySelector('[data-side-by-side-today]') as HTMLElement
    const shape = both.querySelector('[data-side-by-side-shape]') as HTMLElement
    expect(within(today).getByText(/You told us to expect payment by/)).toBeTruthy()
    expect(today.querySelector('[data-portal-promise-strip]')).toBeNull()
    expect(shape.querySelectorAll('[data-portal-promise-strip]')).toHaveLength(2)
    expect(within(shape).queryByText(/You told us to expect payment by/)).toBeNull()
  })

  it('keeps today’s look under ?sbs=1 on a real token with nobody signed in', async () => {
    mountAt(`/portal?t=${REAL}&sbs=1`)
    await waitFor(() => expect(screen.getByText(/You told us to expect payment by/)).toBeTruthy())
    expect(document.querySelector('[data-side-by-side]')).toBeNull()
    expect(strips()).toHaveLength(0)
  })
})
