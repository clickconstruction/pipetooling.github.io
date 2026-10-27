// @vitest-environment jsdom
/**
 * Render smokes for the Bids → Lien Release tab's records and its code door (v2.5958, board 3 of the
 * Sign by his code canvas): an estimator's held unconditional waiver offers the leader's code; the press
 * records the paper with him under the line and opens the sign window for his code alone; the code
 * signs it and the outputs open signed; Already on this bid lists what was recorded and loads one back
 * on the page; a print records the paper and stamps it sent; a held primary keeps the plain line.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { BidLienReleaseTab } from './BidLienReleaseTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

const authState = vi.hoisted(() => ({ role: 'estimator' as string }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const base = useAuthModuleMock({ user: { id: 'wendi-1', email: 'wendi@example.com' }, profileName: 'Wendi' })
  return { ...base, useAuth: () => ({ ...(base.useAuth() as Record<string, unknown>), role: authState.role }) }
})

vi.mock('signature_pad', () => ({
  default: class {
    off() {}
    clear() {}
    isEmpty() {
      return true
    }
    toDataURL() {
      return null
    }
  },
}))

type Row = Record<string, unknown>
const io = vi.hoisted(() => ({
  rows: [] as Row[],
  leaders: [{ id: 'leader-1', name: 'Malachi Whites' }],
  mints: [] as Record<string, unknown>[],
  stamps: [] as string[],
  signCalls: [] as Record<string, unknown>[],
  printed: [] as string[],
  statusCalls: 0,
}))

vi.mock('../../lib/bids/bidLienReleaseIo', () => ({
  loadBidLienReleases: async () => ({ rows: io.rows, deviceNames: { 'wendi-1': 'Wendi' } }),
  loadBidLienWaiverLeaders: async () => io.leaders,
  mintBidLienRelease: async (args: { bidId: string; formType: string; fields: Record<string, string>; userId: string }) => {
    io.mints.push(args)
    const row = {
      id: `minted-${io.mints.length}`,
      bid_id: args.bidId,
      job_id: null,
      form_type: args.formType,
      amount: Number(args.fields.amount),
      status: 'issued',
      fields: { ...args.fields },
      through_date: args.fields.throughDate || null,
      signed_date: args.fields.signedDate || null,
      created_at: '2026-10-26T19:00:00Z',
      signed_at: null,
      signer_printed_name: null,
      signer_signature_mode: null,
      signer_consented_at: null,
      signed_on_device_of: null,
      sent_to_customer_at: null,
      voided_at: null,
    }
    io.rows = [row, ...io.rows]
    return { ok: true, row }
  },
  stampBidLienReleaseSent: async (id: string) => {
    io.stamps.push(id)
    io.rows = io.rows.map((r) => (r.id === id ? { ...r, sent_to_customer_at: '2026-10-26T19:30:00Z' } : r))
  },
}))

vi.mock('../../lib/jobs/lienDeskSignIo', async (importActual) => {
  const actual = (await importActual()) as Record<string, unknown>
  return {
    ...actual,
    lienSignCodeStatus: async () => {
      io.statusCalls += 1
      return { set: true, setAtIso: '2026-10-23T00:00:00Z', lastUsedAtIso: null, lockedUntilIso: null }
    },
  }
})

vi.mock('../../lib/jobs/lienReleaseSignIo', () => ({
  signLienRelease: vi.fn(),
  signLienReleaseWithCode: async (args: { releaseId: string }) => {
    io.signCalls.push(args)
    io.rows = io.rows.map((r) =>
      r.id === args.releaseId
        ? { ...r, status: 'signed', signed_at: '2026-10-26T19:14:00Z', signer_printed_name: 'Malachi Whites', signer_signature_mode: 'code', signer_consented_at: '2026-10-26T19:14:00Z', signer_user_id: 'leader-1', signed_on_device_of: 'wendi-1' }
        : r,
    )
    return { ok: true, signedAtIso: '2026-10-26T19:14:00Z', printedName: 'Malachi Whites' }
  },
}))

vi.mock('../../lib/sent/sentCopiesIo', () => ({
  printAndFile: (_html: string, meta: { title: string }) => {
    io.printed.push(meta.title)
    return true
  },
}))

function bid(): BidWithBuilder {
  return {
    id: 'bid-1',
    bid_number: '482',
    project_name: 'Take 5 Seguin',
    address: '380 TX-123, Seguin, TX 78155',
    agreed_value: 34825,
    customers: null,
    bids_gc_builders: { name: 'Southern Post Construction' },
  } as unknown as BidWithBuilder
}

function renderTab() {
  return renderWithProviders(
    <BidLienReleaseTab
      bids={[bid()]}
      onlyMyBids={false}
      setOnlyMyBids={() => {}}
      isMyBid={() => true}
      selectedBid={bid()}
      onSelectBid={() => {}}
      onClose={() => {}}
      onEditBid={() => {}}
    />,
  )
}

async function chooseUnconditional() {
  fireEvent.click(screen.getByRole('button', { name: 'Unconditional' }))
  await screen.findByText('Are you sure you meant to choose Unconditional?')
  fireEvent.click(screen.getByRole('button', { name: 'Acknowledge and choose Unconditional' }))
  await screen.findByText(/§ 53\.284\(c\)/)
}

beforeEach(() => {
  authState.role = 'estimator'
  io.rows = []
  io.leaders = [{ id: 'leader-1', name: 'Malachi Whites' }]
  io.mints = []
  io.stamps = []
  io.signCalls = []
  io.printed = []
  io.statusCalls = 0
})

describe('BidLienReleaseTab — the code door and the records (v2.5958)', () => {
  it('an estimator’s held unconditional waiver offers the leader’s code, and the paper waits for it', async () => {
    renderTab()
    await chooseUnconditional()
    const door = await screen.findByTestId('bid-lien-waiver-code-door')
    expect(within(door).getByText('MW')).toBeTruthy()
    expect(within(door).getByText('Malachi is with you?')).toBeTruthy()
    expect(within(door).getByRole('button', { name: 'Sign with his code' })).toBeTruthy()
    expect(screen.getByTestId('trade-waiver-foot-note').textContent).toBe('Waits for his ink or his code')
    expect(screen.queryByRole('button', { name: 'Copy for email' })).toBeNull()
    fireEvent.click(within(door).getByRole('button', { name: 'Ask him to send it himself ›' }))
    expect(screen.getByText(/Malachi opens this bid's Lien Release tab signed in as himself/)).toBeTruthy()
  })

  it('the press records the paper with him under the line and opens the window for his code alone', async () => {
    renderTab()
    await chooseUnconditional()
    fireEvent.click(await screen.findByRole('button', { name: 'Sign with his code' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sign release of lien' })
    expect(io.mints).toHaveLength(1)
    expect(io.mints[0]).toMatchObject({ bidId: 'bid-1', formType: 'unconditional_progress', userId: 'wendi-1' })
    expect((io.mints[0]!.fields as Record<string, string>).signerName).toBe('Malachi Whites')
    expect(within(dialog).getByText('Malachi Whites signs here — Bid B482')).toBeTruthy()
    expect(within(dialog).getByLabelText('Malachi types his signing code')).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: 'Draw instead' })).toBeNull()
  })

  it('his code signs it, the outputs open signed, and Already on this bid lists it', async () => {
    renderTab()
    await chooseUnconditional()
    fireEvent.click(await screen.findByRole('button', { name: 'Sign with his code' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sign release of lien' })
    // The tab re-renders under the open window (its history re-read, the ask line toggled twice); the code's status is
    // read once (v2.5987: a fresh signer object each render read it again every time, about three a second on prod).
    await waitFor(() => expect(within(screen.getByTestId('bid-lien-waiver-history')).getAllByRole('button').length).toBeGreaterThan(0))
    const ask = within(screen.getByTestId('bid-lien-waiver-code-door')).getByRole('button', { name: 'Ask him to send it himself ›' })
    fireEvent.click(ask)
    fireEvent.click(ask)
    await waitFor(() => expect(io.statusCalls).toBeGreaterThan(0))
    await new Promise((r) => setTimeout(r, 50))
    fireEvent.change(within(dialog).getByLabelText('Malachi types his signing code'), { target: { value: '2468' } })
    expect(io.statusCalls).toBe(1)
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign it with his code' }))
    await waitFor(() => expect(io.signCalls).toHaveLength(1))
    expect(io.signCalls[0]).toMatchObject({ releaseId: 'minted-1', signerUserId: 'leader-1', code: '2468', deviceUserName: 'Wendi' })
    await screen.findByRole('button', { name: 'Copy for email' })
    expect(screen.queryByTestId('bid-lien-waiver-hold')).toBeNull()
    expect(screen.getByTestId('trade-waiver-foot-note').textContent).toMatch(/signing code.*on Wendi’s screen/)
    // v2.5987: the page writes his name in the cursive face on the line, as the print does.
    expect(screen.getByTestId('lien-waiver-foot-typed').textContent).toBe('Malachi Whites')
    const history = screen.getByTestId('bid-lien-waiver-history')
    expect(within(history).getByRole('button', { name: 'Unconditional · progress — $34,825 · signed Oct 26' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Print' }))
    await waitFor(() => expect(io.printed).toEqual(['Unconditional Waiver and Release on Progress Payment, signed · Take 5 Seguin']))
    await waitFor(() => expect(io.stamps).toEqual(['minted-1']))
    expect(io.mints).toHaveLength(1)
  })

  it('a conditional print records the paper once and stamps it sent', async () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Print' }))
    await waitFor(() => expect(io.stamps).toEqual(['minted-1']))
    expect(io.mints[0]).toMatchObject({ formType: 'conditional_progress' })
    expect(await screen.findByRole('button', { name: /Conditional · progress — \$34,825 · sent Oct 26/ })).toBeTruthy()
  })

  it('a recorded waiver opens back on the page from Already on this bid', async () => {
    io.rows = [
      {
        id: 'old-1',
        bid_id: 'bid-1',
        job_id: null,
        form_type: 'conditional_progress',
        amount: 30400,
        status: 'issued',
        fields: { companyName: 'Click Plumbing and Electrical', checkFrom: 'Southern Post Construction', amount: '30400.00', projectDescription: 'Take 5 Seguin — 380 TX-123, Seguin, TX 78155', throughDate: '2026-09-01', signedDate: '2026-10-01', signerName: '', signerTitle: '' },
        created_at: '2026-10-01T15:00:00Z',
        sent_to_customer_at: '2026-10-01T16:00:00Z',
        voided_at: null,
      },
    ]
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: 'Conditional · progress — $30,400 · sent Oct 1' }))
    expect(await screen.findByText(/in the sum of \$30,400\.00/)).toBeTruthy()
  })

  it('a held primary keeps the plain hold line, with no code door', async () => {
    authState.role = 'primary'
    renderTab()
    await chooseUnconditional()
    expect(screen.getByTestId('bid-lien-waiver-hold').textContent).toMatch(/Ask your leader/)
    expect(screen.queryByTestId('bid-lien-waiver-code-door')).toBeNull()
  })
})
