// @vitest-environment jsdom
/**
 * Punch list #205, PR 5: the Messages tab of a trade partner's portal becomes its thread with a reply box when the
 * answer carries `thread`. Sample Electric reads a text of its own, our email, a line from its portal and the invitation
 * email we sent, oldest first; picks a job, writes a line and presses Send, which posts `portal_message` and keeps the
 * line on screen; and with no thread in the answer keeps the read-only list.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gcTradePortalSample, gcTradePortalSampleThread, SAMPLE_TRADE_IDS as ID } from '../../supabase/functions/_shared/gcTradePortalSample'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const TOKEN = '0123456789abcdef0123456789abcdef'
const posts: Record<string, unknown>[] = []
let body: Record<string, unknown> = {}
let sendAnswer: { ok: boolean; body: unknown } = { ok: true, body: { ok: true } }

beforeEach(() => {
  posts.length = 0
  body = { today: TODAY, slice: gcTradePortalSample(TODAY), thread: gcTradePortalSampleThread(TODAY) }
  sendAnswer = { ok: true, body: { ok: true } }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return { ok: sendAnswer.ok, json: async () => sendAnswer.body }
      }
      return { ok: true, json: async () => body }
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const openTab = async (name: string) => {
  render(
    <MemoryRouter initialEntries={[`/t/${TOKEN}`]}>
      <Routes>
        <Route path="/t/:token" element={<GcTradePortal />} />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.click(await screen.findByRole('tab', { name }))
}

describe('the thread with its reply box (punch list #205, PR 5)', () => {
  it('draws the conversation oldest first, ours and theirs, with the emails we sent among them', async () => {
    await openTab('Messages')
    const list = within(await screen.findByRole('list', { name: 'Messages' }))
    const items = list.getAllByRole('listitem')
    expect(items.map((li) => li.getAttribute('data-portal-line'))).toEqual(['mine', 'theirs', 'theirs', 'mine'])
    // The text, our email, the invitation email we sent the next day, then the portal line.
    expect(items[0]!.textContent).toContain('We can start the rough-in Monday if the drywall is clear.')
    expect(items[0]!.textContent).toContain('You · Tue Sep 29 · by text')
    expect(items[1]!.textContent).toContain('Rough-in start on Sample Dental Office')
    expect(items[1]!.textContent).toContain('Avery · Tue Sep 29 · by email')
    expect(items[2]!.textContent).toContain('Click Construction asks you to quote Electrical on Sample Retail Shell')
    expect(items[2]!.textContent).toContain('Click · Wed Sep 30 · by email')
    expect(items[3]!.textContent).toContain('You · Mon Oct 5 · from the portal')
    expect(screen.getByText('The same conversation as your texts and emails with us.')).toBeTruthy()
    expect(screen.getByText('Click answers in office hours. For something urgent on site, call Jordan Reyes.')).toBeTruthy()
  })

  it('posts a line as portal_message about the job picked and keeps it on screen', async () => {
    await openTab('Messages')
    const about = (await screen.findByLabelText(/^About/)) as HTMLSelectElement
    // The company's three projects stand; none is picked until it picks one.
    expect([...about.options].map((o) => o.textContent)).toEqual(['No job', 'Sample Retail Shell', 'Sample Clinic Finish Out', 'Sample Dental Office'])
    fireEvent.change(about, { target: { value: ID.job } })
    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Write to Click…'), { target: { value: 'The temporary panel is in. Rough-in starts Monday.' } })
    fireEvent.click(send)
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ token: TOKEN, kind: 'portal_message', projectId: ID.job, text: 'The temporary panel is in. Rough-in starts Monday.' })
    const list = within(await screen.findByRole('list', { name: 'Messages' }))
    await waitFor(() => expect(list.getAllByRole('listitem')).toHaveLength(5))
    const last = list.getAllByRole('listitem')[4]!
    expect(last.textContent).toContain('The temporary panel is in. Rough-in starts Monday.')
    expect(last.textContent).toContain('from the portal')
    expect((screen.getByLabelText('Write to Click…') as HTMLTextAreaElement).value).toBe('')
  })

  it('says a refusal in the company’s words and keeps what was typed', async () => {
    sendAnswer = { ok: false, body: { error: 'tooMany' } }
    await openTab('Messages')
    fireEvent.change(await screen.findByLabelText('Write to Click…'), { target: { value: 'One more.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(await screen.findByText('That is a lot at once. Give us an hour, or call our office.')).toBeTruthy()
    expect((screen.getByLabelText('Write to Click…') as HTMLTextAreaElement).value).toBe('One more.')
  })

  it('keeps the read-only list of what we sent when the answer has no thread', async () => {
    body = { today: TODAY, slice: gcTradePortalSample(TODAY) }
    await openTab('Messages from Click')
    expect(await screen.findByText('Click Construction asks you to quote Electrical on Sample Retail Shell')).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Messages' })).toBeNull()
    expect(screen.queryByLabelText('Write to Click…')).toBeNull()
  })
})
