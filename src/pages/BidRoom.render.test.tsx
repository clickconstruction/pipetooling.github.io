// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BidRoom from './BidRoom'
import { buildBidRoomRevisionPayload } from '../lib/bids/bidRoomPayload'

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

type SentBody = Record<string, unknown>
const posted: SentBody[] = []

beforeEach(() => {
  posted.length = 0
  padState.empty = true
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/sign-bid-room')) {
        posted.push(JSON.parse(String(init?.body ?? '{}')) as SentBody)
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response
      }
      return { ok: true, status: 200, json: async () => room } as Response
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
