// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BidRoom from './BidRoom'
import { buildBidRoomRevisionPayload } from '../lib/bids/bidRoomPayload'
import { esignConsentPayload, esignConsentText } from '../lib/esignConsent'
import { installDomShims, settle } from '../test/renderSmokeMocks'

const padState = { empty: true }
vi.mock('signature_pad', () => ({
  default: class {
    off() {}
    clear() {
      padState.empty = true
    }
    isEmpty() {
      return padState.empty
    }
    toDataURL() {
      return 'data:image/png;base64,MOCK'
    }
  },
}))
vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({}) }))

const payload = buildBidRoomRevisionPayload({
  projectName: 'Game Show Battle Rooms',
  projectAddress: '123 Main St, San Antonio',
  gcName: 'NORTHSTAR CONSTRUCTION SERVICES',
  serviceTypeName: 'Plumbing',
  inclusions: 'All plumbing per plans.',
  exclusions: 'Fixtures by others.',
  terms: 'Net 30.',
  sections: [{ name: 'To Plans', isAlternate: false, revenueSum: 249971.29, fixtureRows: [{ fixture: 'ft of 4IN WASTE', count: 537.27 }] }],
})

const room = {
  revision: { id: 'rev-1', rev_number: 1, note: '', published_at: '2026-09-01T00:00:00Z' },
  payload,
  attachment: null,
  outcome: null,
  documents: [],
}

// v2.3964: the room after the proposal is signed, with one change order waiting for an answer.
const changeOrder = {
  id: 'co-1',
  title: 'CO 1 — Added floor drains',
  change_order_fields: { description_of_change: 'Two floor drains added at the bar.', reason_for_change: 'Owner request', impact_on_schedule: '2 days' },
  line_items_snapshot: [],
  terms_snapshot: null,
  total_cents: 125000,
  status: 'sent',
  sent_at: '2026-09-20T00:00:00Z',
  acceptor_printed_name: null,
  acceptor_consented_at: null,
}
const roomWithChangeOrder = {
  ...room,
  outcome: { event_type: 'signed', metadata: { option_name: 'To Plans', total_cents: 24997129, printed_name: 'Dana Ruiz' }, occurred_at: '2026-09-02T00:00:00Z' },
  documents: [changeOrder],
}
const changeOrderConsent = esignConsentText({ audience: 'gc', documentNoun: 'this change order' })

const served: { room: unknown } = { room }

type SentBody = Record<string, unknown>
const posted: SentBody[] = []

beforeEach(() => {
  posted.length = 0
  padState.empty = true
  served.room = room
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/sign-bid-room')) {
        posted.push(JSON.parse(String(init?.body ?? '{}')) as SentBody)
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response
      }
      return { ok: true, status: 200, json: async () => served.room } as Response
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderRoom() {
  return render(
    <MemoryRouter initialEntries={['/bid-room?t=room-token']}>
      <BidRoom />
    </MemoryRouter>,
  )
}

describe('Bid Room approval offers a drawn signature (v2.3159)', () => {
  it('shows the Type / Draw switch under the name and refuses an empty pad', async () => {
    renderRoom()
    await screen.findByText('Approve this proposal')
    expect(screen.getByRole('group', { name: 'Sign by typing or drawing' })).toBeTruthy()
    expect(screen.queryByLabelText('Signature drawing area')).toBeNull()

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Dana Ruiz' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Draw' }))
    expect(screen.getByLabelText('Signature drawing area')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Approve “To Plans”/ }))
    expect(screen.getByText('Please sign in the box.')).toBeTruthy()
    expect(posted).toHaveLength(0)
  })

  it('sends the PNG with a drawn approval, and nothing extra with a typed one', async () => {
    renderRoom()
    await screen.findByText('Approve this proposal')
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Dana Ruiz' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Draw' }))
    padState.empty = false
    fireEvent.click(screen.getByRole('button', { name: /^Approve “To Plans”/ }))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({
      action: 'sign',
      optionKey: 'base',
      printedName: 'Dana Ruiz',
      agreedTerms: true,
      signaturePngBase64: 'data:image/png;base64,MOCK',
      token: 'room-token',
      revision_id: 'rev-1',
    })
    expect(posted[0]).toHaveProperty('esignConsent')
  })

  it('a typed approval carries no signaturePngBase64 key', async () => {
    renderRoom()
    await screen.findByText('Approve this proposal')
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Dana Ruiz' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /^Approve “To Plans”/ }))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({ action: 'sign', printedName: 'Dana Ruiz', agreedTerms: true })
    expect('signaturePngBase64' in posted[0]!).toBe(false)
  })
})

/**
 * The page reads `?t=` from the router location, so it renders in the file's own MemoryRouter
 * (`renderWithProviders` starts at `/`); `settle()` from the harness flushes the load before a click.
 */
async function openChangeOrder() {
  served.room = roomWithChangeOrder
  installDomShims()
  const view = renderRoom()
  // The load produces the card's button — the marker that the room is past its fetch.
  const review = await screen.findByRole('button', { name: /^Review & sign/ })
  await settle()
  fireEvent.click(review)
  await screen.findByRole('checkbox', { name: changeOrderConsent.checkbox })
  return view
}

describe('Bid Room change order carries the electronic-signature consent (v2.3964)', () => {
  it('shows the consent line and its own checkbox on the change order card', async () => {
    const { container } = await openChangeOrder()
    // The proposal is already signed, so every consent word on the page belongs to the card.
    expect(screen.queryByText('Approve this proposal')).toBeNull()
    expect(screen.getByText(changeOrderConsent.line, { exact: false })).toBeTruthy()
    expect(screen.getByRole('button', { name: /How electronic signing works/ })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: changeOrderConsent.checkbox })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'I agree to this change order and its impact on cost and schedule.' })).toBeTruthy()

    // What is stored is what is on the card: every line of the clause, the checkbox sentence included.
    const shown = container.textContent ?? ''
    for (const part of [changeOrderConsent.line, ...changeOrderConsent.paragraphs, changeOrderConsent.disclosureLabel, changeOrderConsent.checkbox]) {
      expect(shown).toContain(part)
    }
  })

  it('refuses a signature until the consent box is ticked', async () => {
    await openChangeOrder()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Dana Ruiz' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to this change order and its impact on cost and schedule.' }))
    fireEvent.click(screen.getByRole('button', { name: /^Approve — / }))
    expect(screen.getByText('Please tick "I agree to sign electronically" to continue.')).toBeTruthy()
    expect(posted).toHaveLength(0)

    fireEvent.click(screen.getByRole('checkbox', { name: changeOrderConsent.checkbox }))
    expect(screen.queryByText('Please tick "I agree to sign electronically" to continue.')).toBeNull()
  })

  it('still asks for the agree box once consent is given', async () => {
    await openChangeOrder()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Dana Ruiz' } })
    fireEvent.click(screen.getByRole('checkbox', { name: changeOrderConsent.checkbox }))
    fireEvent.click(screen.getByRole('button', { name: /^Approve — / }))
    expect(screen.getByText('Please confirm you agree to this change order.')).toBeTruthy()
    expect(posted).toHaveLength(0)
  })

  it('posts esignConsent with the change order signature — the words on the card', async () => {
    await openChangeOrder()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Dana Ruiz' } })
    fireEvent.click(screen.getByRole('checkbox', { name: changeOrderConsent.checkbox }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to this change order and its impact on cost and schedule.' }))
    fireEvent.click(screen.getByRole('button', { name: /^Approve — / }))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({
      token: 'room-token',
      revision_id: 'rev-1',
      action: 'sign',
      documentId: 'co-1',
      printedName: 'Dana Ruiz',
      agreedTerms: true,
      esignConsent: esignConsentPayload(changeOrderConsent),
    })
    expect((posted[0]!.esignConsent as { audience: string; documentNoun: string }).audience).toBe('gc')
    expect((posted[0]!.esignConsent as { audience: string; documentNoun: string }).documentNoun).toBe('this change order')
    // The card answers in place: its form gives way to the signed line (the banner above is the proposal's).
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Approve — / })).toBeNull())
    expect(screen.getAllByText(/✍ Signed/)).toHaveLength(2)
  })

  it('a decline carries the note and no consent', async () => {
    await openChangeOrder()
    fireEvent.change(screen.getByLabelText('Decline note'), { target: { value: 'Owner dropped the bar.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({ token: 'room-token', revision_id: 'rev-1', action: 'decline', documentId: 'co-1', note: 'Owner dropped the bar.' })
  })
})
