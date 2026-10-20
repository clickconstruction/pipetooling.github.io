// @vitest-environment jsdom
/**
 * The trade portal's presses (P2b-ii): each posts its kind to `submit-gc-trade-portal` with the link, the page reads
 * the slice again when it went through (decision 10), a refusal shows in the company's words under the press, and
 * the office's preview posts nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gcTradePortalSample, SAMPLE_TRADE_IDS as ID } from '../../supabase/functions/_shared/gcTradePortalSample'
import type { TradePortalSlice } from '../../supabase/functions/_shared/gcTradePortalSlice'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const TOKEN = '0123456789abcdef0123456789abcdef'
const reads: string[] = []
const posts: Record<string, unknown>[] = []
let slice: TradePortalSlice
let postAnswer: { ok: boolean; body: unknown } = { ok: true, body: { ok: true } }

beforeEach(() => {
  reads.length = 0
  posts.length = 0
  slice = gcTradePortalSample(TODAY)
  postAnswer = { ok: true, body: { ok: true } }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return { ok: postAnswer.ok, json: async () => postAnswer.body }
      }
      reads.push(url)
      return { ok: true, json: async () => ({ today: TODAY, slice }) }
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

const open = (path = `/t/${TOKEN}`) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/t/:token" element={<GcTradePortal />} />
      </Routes>
    </MemoryRouter>,
  )

const block = (name: RegExp | string) => within(screen.getByRole('region', { name }))
const openProject = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^Sample Retail Shell/ }))
  return screen.findByRole('region', { name: 'Electrical · invitation to quote' })
}

describe('the presses', () => {
  it('welcomes a first visit and posts Got it, then reads the slice again', async () => {
    // A first visit: never pressed Got it, no set opened, no quote, no word from it in the portal and no paper signed yet.
    slice = { ...slice, company: { ...slice.company, portal_opened_on: null }, invites: slice.invites.map((i) => ({ ...i, seen_rev: null })), quotes: [], contacts: [], papers: [] }
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Got it' }))
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'got_it' }]))
    await waitFor(() => expect(reads).toHaveLength(2))
  })

  it('gives the day the quote will come, and passes', async () => {
    open()
    const ask = within(await openProject())
    fireEvent.change(ask.getByLabelText('The day your quote will come'), { target: { value: '2026-10-12' } })
    fireEvent.click(ask.getByRole('button', { name: /Change the day|Tell Click/ }))
    await waitFor(() => expect(posts[0]).toEqual({ token: TOKEN, kind: 'quote_day', inviteId: ID.ask, by: '2026-10-12' }))
    fireEvent.click(ask.getByRole('button', { name: 'Pass on this one' }))
    await waitFor(() => expect(posts[1]).toEqual({ token: TOKEN, kind: 'decline', inviteId: ID.ask }))
  })

  it('asks about the plans of the trade, with the sheets it names', async () => {
    open()
    await openProject()
    const questions = block('Electrical · questions about the plans')
    fireEvent.change(questions.getByLabelText('Your question'), { target: { value: ' Is the panel recessed? ' } })
    fireEvent.change(questions.getByLabelText(/Sheets it is about/), { target: { value: 'E-201, E-202' } })
    fireEvent.click(questions.getByRole('button', { name: 'Send the question' }))
    await waitFor(() => expect(posts[0]).toEqual({ token: TOKEN, kind: 'ask_question', packageId: ID.trade, text: 'Is the panel recessed?', sheets: ['E-201', 'E-202'] }))
  })

  it('adds a person to the emails and ticks what the main contact gets', async () => {
    open()
    const people = within(await screen.findByRole('region', { name: 'Who gets our emails' }))
    fireEvent.click(people.getByRole('button', { name: 'Add a person' }))
    fireEvent.change(people.getByLabelText('Name'), { target: { value: 'Ana Ruiz' } })
    fireEvent.change(people.getByLabelText('Email'), { target: { value: 'ana@example.com' } })
    fireEvent.click(within(people.getByRole('group', { name: 'Gets' })).getByLabelText('The job'))
    fireEvent.click(people.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(posts[0]).toEqual({ token: TOKEN, kind: 'add_person', name: 'Ana Ruiz', email: 'ana@example.com', role: '', gets: ['job'] }))
    const main = within(document.querySelector('[data-portal-person="main"]') as HTMLElement)
    fireEvent.click(main.getByLabelText('Contracts and changes'))
    await waitFor(() => expect(posts[1]).toEqual({ token: TOKEN, kind: 'set_gets', personId: null, gets: ['quotes', 'job'] }))
  })

  it('shows a refusal in the company’s words under the press, and reads nothing again', async () => {
    postAnswer = { ok: false, body: { error: 'tooMany' } }
    open()
    const ask = within(await openProject())
    fireEvent.click(ask.getByRole('button', { name: 'Pass on this one' }))
    expect(await ask.findByText('That is a lot at once. Give us an hour, or call our office.')).toBeTruthy()
    expect(reads).toHaveLength(1)
  })

  it('posts nothing from the office’s preview, and says so', async () => {
    open(`/t/${TOKEN}?preview=1`)
    const ask = within(await openProject())
    fireEvent.click(ask.getByRole('button', { name: 'Pass on this one' }))
    expect(await ask.findByText('Preview. Nothing is saved from here.')).toBeTruthy()
    expect(posts).toEqual([])
  })

  it('sends a quote from the form: the number, the lines, how long it holds and their schedule of values', async () => {
    open()
    const ask = within(await openProject())
    // The sample company has opened the plans, so its quote can price them.
    fireEvent.click(ask.getByLabelText('Lighting'))
    fireEvent.change(ask.getByLabelText('Your quote'), { target: { value: '60000' } })
    const amounts = ask.getAllByLabelText('Amount for this stage')
    fireEvent.change(amounts[0]!, { target: { value: '30000' } })
    fireEvent.change(amounts[1]!, { target: { value: '20000' } })
    expect(ask.getByText('Your lines add up to $50,000. That is $10,000 short.')).toBeTruthy()
    expect((ask.getByRole('button', { name: 'Send my quote' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(amounts[2]!, { target: { value: '10000' } })
    fireEvent.click(ask.getByRole('button', { name: 'Send my quote' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({
      token: TOKEN,
      kind: 'submit_quote',
      inviteId: ID.ask,
      quote: {
        amount: 60000,
        includes: { [ID.line1]: 'yes', [ID.line2]: 'yes', [ID.line3]: 'no' },
        goodForDays: 30,
        sov: [
          { label: 'Rough-in', amount: 30000 },
          { label: 'Top out', amount: 20000 },
          { label: 'Trim', amount: 10000 },
        ],
      },
    })
  })
})

describe('the job’s presses (P4b-ii)', () => {
  const openJob = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
    return screen.findByRole('region', { name: 'Electrical · charges from Click' })
  }

  it('agrees to a charge with one press, and opens its photo on Drive', async () => {
    open()
    const charges = within(await openJob())
    expect(charges.getByRole('link', { name: /See the photo/ }).getAttribute('href')).toBe('https://drive.google.com/file/d/sample-photo')
    fireEvent.click(charges.getByRole('button', { name: 'Agree' }))
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'answer_back_charge', chargeId: ID.charge, agree: true, note: '' }]))
    await waitFor(() => expect(reads).toHaveLength(2))
  })

  it('disputes a charge only with its reason', async () => {
    open()
    const charges = within(await openJob())
    fireEvent.click(charges.getByRole('button', { name: 'Dispute it' }))
    const send = charges.getByRole('button', { name: 'Send to Click' })
    expect((send as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(charges.getByLabelText('Why you dispute it'), { target: { value: ' We swept before we left. ' } })
    fireEvent.click(send)
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'answer_back_charge', chargeId: ID.charge, agree: false, note: 'We swept before we left.' }]))
  })

  it('asks for a change: what changed, why, what it asks and whole working days', async () => {
    open()
    await openJob()
    const changes = block('Electrical · changes to your work')
    // Its part of the change order with the customer, never the customer's price.
    expect(changes.getByText(/as change order 2 on .*\. Your part: \$3,400\./)).toBeTruthy()
    expect(changes.queryByText(/3,910/)).toBeNull()
    fireEvent.click(changes.getByRole('button', { name: 'Ask for a change' }))
    // Since P5a-1 a photo or a ticket is picked in the form (GcTradePortal.files.render.test.tsx sends one).
    expect(changes.getByLabelText('A photo or ticket, if you have one')).toBeTruthy()
    fireEvent.change(changes.getByLabelText('What changed'), { target: { value: ' Two more outlets in the break room. ' } })
    fireEvent.click(changes.getByLabelText('The customer asked for more'))
    fireEvent.change(changes.getByLabelText('What you ask for it'), { target: { value: '$1,250' } })
    fireEvent.change(changes.getByLabelText('Working days it adds'), { target: { value: '1.5' } })
    const send = changes.getByRole('button', { name: 'Send to Click' })
    expect((send as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(changes.getByLabelText('Working days it adds'), { target: { value: '2' } })
    fireEvent.click(send)
    await waitFor(() =>
      expect(posts).toEqual([{ token: TOKEN, kind: 'ask_change', packageId: ID.jobTrade, description: 'Two more outlets in the break room.', reason: 'owner', amount: 1250, days: 2 }]),
    )
  })

  it('shows a refusal in the company’s words under the press', async () => {
    postAnswer = { ok: false, body: { error: 'alreadyAnswered' } }
    open()
    const charges = within(await openJob())
    fireEvent.click(charges.getByRole('button', { name: 'Agree' }))
    expect(await charges.findByText('This charge has its answer already. Reload the page.')).toBeTruthy()
    expect(reads).toHaveLength(1)
  })

  it('posts nothing from the office’s preview, and says so', async () => {
    open(`/t/${TOKEN}?preview=1`)
    const charges = within(await openJob())
    fireEvent.click(charges.getByRole('button', { name: 'Agree' }))
    expect(await charges.findByText('Preview. Nothing is saved from here.')).toBeTruthy()
    expect(posts).toEqual([])
  })

  it('asks nothing more of the quote on its own job', async () => {
    open()
    await openJob()
    expect(screen.queryByRole('region', { name: 'Electrical · invitation to quote' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send it again' })).toBeNull()
  })

  it('reads a trade we gave another company as its result, with no questions to ask', async () => {
    slice = { ...slice, packages: slice.packages.map((p) => (p.id === ID.trade ? { ...p, awarded_invite_id: 'elsewhere' } : p)) }
    open()
    fireEvent.click(await screen.findByRole('button', { name: /^Sample Retail Shell/ }))
    const result = await screen.findByRole('region', { name: 'Electrical · result' })
    expect(within(result).getByText('This one went to another company. Thank you for your quote.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Electrical · questions about the plans' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Electrical · invitation to quote' })).toBeNull()
  })

  it('shows no charges and no changes on a trade that is not the company’s', async () => {
    open()
    await openProject()
    expect(screen.queryByRole('region', { name: /charges from Click/ })).toBeNull()
    expect(screen.queryByRole('region', { name: /changes to your work/ })).toBeNull()
  })
})
