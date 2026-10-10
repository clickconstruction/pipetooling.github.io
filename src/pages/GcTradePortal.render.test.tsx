// @vitest-environment jsdom
/**
 * Render smoke for GC mode's trade partner portal (P1b-ii-b): it opens on the link alone, draws the company's home
 * from the sample `gc-trade-portal` answers, opens a project's page with its plans, questions and ask, lists the
 * messages we sent, says so when the link is off, and keeps a Spanish company in English while Spanish is held.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gcTradePortalSample } from '../../supabase/functions/_shared/gcTradePortalSample'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const urls: string[] = []
let answer: { ok: boolean; body: unknown } = { ok: true, body: null }

beforeEach(() => {
  urls.length = 0
  answer = { ok: true, body: { today: TODAY, slice: gcTradePortalSample(TODAY), sample: true } }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url)
      return { ok: answer.ok, json: async () => answer.body }
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

const open = (path = '/t/sample') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/t/:token" element={<GcTradePortal />} />
      </Routes>
    </MemoryRouter>,
  )

const block = (name: RegExp | string) => within(screen.getByRole('region', { name }))

describe('GcTradePortal', () => {
  it('opens on the link alone and draws the company’s home', async () => {
    open()
    expect(await screen.findByText('Hello, Dana Ortiz.')).toBeTruthy()
    expect(urls[0]).toContain('/functions/v1/gc-trade-portal?t=sample')
    expect(screen.getByText('A sample portal. The company and its jobs are made up.')).toBeTruthy()
    const asked = block('Asked to quote · 1')
    expect(asked.getByText('Sample Retail Shell')).toBeTruthy()
    expect(asked.getByText('Due Mon Oct 19, 11 days left.')).toBeTruthy()
    expect(asked.getByText('no quote yet')).toBeTruthy()
    expect(block('Who gets our emails').getByText(/Marcus Lee/)).toBeTruthy()
    expect(block('Before').getByText(/Sample Clinic Finish Out · Electrical · you passed/)).toBeTruthy()
  })

  it('opens a project’s page with its plans, the questions it may read, its ask and who to call', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: /^Sample Retail Shell/ }))
    expect(await screen.findByText(/1 Sample Rd, Boerne · 9,600 sq ft retail shell, four bays/)).toBeTruthy()
    const plans = block('Electrical · plans')
    // The newest set, and again in the note of what is new for its trade.
    expect(plans.getAllByText('Addendum 1')).toHaveLength(2)
    expect((plans.getByRole('link', { name: /Open the plans/ }) as HTMLAnchorElement).href).toBe('https://drive.google.com/drive/folders/sample')
    expect(plans.getByText('New for Electrical since you last looked')).toBeTruthy()
    const questions = block('Electrical · questions about the plans')
    expect(questions.getByText('Is the site lighting on its own panel?')).toBeTruthy()
    expect(questions.getByText('Copper, as the panel schedules say.')).toBeTruthy()
    const ask = block('Electrical · invitation to quote')
    expect(ask.getByText('Panels and feeders')).toBeTruthy()
    // The known exclusion, said with who does it (the form's own exclusion ticks name it again).
    expect(ask.getByText('Permits and fees (the owner does it)')).toBeTruthy()
    // Its own quote file is picked in the quote form since P5a-1, so no line says to email it.
    expect(ask.queryByText(/Email it to/)).toBeNull()
    // The presses (P2b-ii) are in GcTradePortal.presses.render.test.tsx.
    expect(ask.getByRole('button', { name: 'Pass on this one' })).toBeTruthy()
    expect(block('Who to call').getByText('Avery Lin')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '← Everything with Click' }))
    expect(await screen.findByText('Hello, Dana Ortiz.')).toBeTruthy()
  })

  it('lists the messages we sent, as they went', async () => {
    open()
    fireEvent.click(await screen.findByRole('tab', { name: 'Messages from Click' }))
    expect(screen.getByText('Click Construction asks you to quote Electrical on Sample Retail Shell')).toBeTruthy()
    expect(screen.getByText('To Dana Ortiz')).toBeTruthy()
    expect(screen.getByText('Service and gear')).toBeTruthy()
  })

  it('says a link that is off in words, with no page behind it', async () => {
    answer = { ok: false, body: { error: 'linkOff' } }
    open('/t/0123456789abcdef0123')
    expect((await screen.findByRole('alert')).textContent).toBe('This link is no longer active. Ask Click Construction for your new link.')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('offers to try again when the portal did not open, and forwards the office’s preview', async () => {
    answer = { ok: false, body: { error: 'failed' } }
    open('/t/0123456789abcdef0123?preview=1')
    expect(await screen.findByText('Your portal did not open. Try again in a minute.')).toBeTruthy()
    expect(urls[0]).toContain('&preview=1')
    answer = { ok: true, body: { today: TODAY, slice: gcTradePortalSample(TODAY) } }
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('The office preview. This visit is not counted.')).toBeTruthy()
  })

  it('keeps a Spanish company in English while Spanish is held', async () => {
    const slice = gcTradePortalSample(TODAY)
    answer = { ok: true, body: { today: TODAY, slice: { ...slice, company: { ...slice.company, lang: 'es' } } } }
    open()
    expect(await screen.findByText('Hello, Dana Ortiz.')).toBeTruthy()
    expect(screen.queryByText('Hola, Dana Ortiz.')).toBeNull()
  })
})
