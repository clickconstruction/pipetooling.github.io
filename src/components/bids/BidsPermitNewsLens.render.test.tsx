// @vitest-environment jsdom
/**
 * Render smoke for Followup → Permit news (punch list #401): the page's wiring in small. The news
 * hook reads the permits once and the answers beside them, `permitInbox` sorts them for the
 * reader, and the lens draws a card per line nobody has answered. A press writes one answer and
 * the card folds to a line with Undo. We lost it… opens the board's own outcome and writes no
 * answer. Every bid, builder and plumber here is made up.
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { permitInbox, type NewsBid } from '../../lib/research/bidPermitNews'
import type { PermitAnswerRow } from '../../lib/research/bidPermitAnswers'
import type { SitePermitRow } from '../../lib/research/bidSitePanel'
import { ymdPlusDays } from '../../lib/research/permitResearch'
import { todayYmdInAppTz } from '../../utils/dateUtils'

const io = vi.hoisted(() => ({ loadPermitsByHouseNumber: vi.fn(), loadBidsOfCustomers: vi.fn() }))
vi.mock('../../lib/research/bidSiteIo', () => io)
// The answers table in small: an insert appends a row and tells the listeners, as the real write does.
const answers = vi.hoisted(() => {
  const state = { rows: [] as PermitAnswerRow[], listeners: new Set<() => void>(), fail: null as string | null }
  return {
    state,
    loadPermitAnswers: vi.fn(async () => [...state.rows]),
    onPermitAnswered: (fn: () => void) => {
      state.listeners.add(fn)
      return () => {
        state.listeners.delete(fn)
      }
    },
    recordPermitAnswer: vi.fn(async (input: { bidId: string; permit: { city: string; permit_number: string; permit_type: string }; answer: PermitAnswerRow['answer'] }) => {
      if (state.fail) throw new Error(state.fail)
      state.rows.push({ id: `a${state.rows.length + 1}`, bid_id: input.bidId, ...input.permit, answer: input.answer, answered_by: 'u-me', answered_at: new Date(Date.UTC(2026, 10, 19, 12, 0, state.rows.length)).toISOString() })
      for (const fn of state.listeners) fn()
    }),
  }
})
vi.mock('../../lib/research/bidPermitAnswersIo', () => answers)
// Every write the two outcome windows could make goes through one of these: the bid's own row or a GC's packet.
const writes = vi.hoisted(() => ({ from: vi.fn(), setGcPacketOutcome: vi.fn() }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  return { supabase: { ...stub, from: (table: string) => { writes.from(table); return stub.from() } } }
})
vi.mock('../../lib/bids/gcPacketOutcome', () => ({ setGcPacketOutcome: writes.setGcPacketOutcome }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})

import { BidsPermitNewsLens, type PermitNewsBid } from './BidsPermitNewsLens'
import { BidBoardNewsMarkLost } from './BidBoardNewsMarkLost'
import { PermitNewsChip } from './PermitChip'
import { useBidPermitNews } from '../../hooks/useBidPermitNews'

const RECENT = ymdPlusDays(todayYmdInAppTz(), -5)

function permit(over: Partial<SitePermitRow> = {}): SitePermitRow {
  return {
    id: 'p1', permit_number: 'COM-1', address: '4120 MILL ST', kind: 'building', stage: 'applied', permit_type: 'Commercial Project Application', work_type: 'Commercial project',
    project_name: 'MILL STREET LOFTS BLDG C', submitted_on: RECENT, issued_on: null, contact: 'Dana Whitlow', declared_value: null, area_sf: null, builder_key: 'danawhitlow', ...over,
  }
}
type Bid = NewsBid & PermitNewsBid
function bid(over: Partial<Bid> = {}): Bid {
  return { id: 'b1', bid_number: '512', project_name: 'Mill Street Lofts, Building C', address: '4120 Mill Street, San Antonio, TX 78215', outcome: null, bid_date_sent: null, last_contact: null, gcName: 'Ridgeway Builders', ...over }
}
const BIDS = [
  bid(),
  bid({ id: 'b2', bid_number: '501', project_name: 'Pecan Grove Pharmacy', address: '88 Harbor St, San Antonio, TX 78205', bid_date_sent: '2026-02-01', gcName: 'Hartwell Interiors' }),
]

/** The page's wiring in small: the hook, the inbox for the reader, the lens, the red count and each row's chip. */
function Page({ bids = BIDS, mine = () => true, onOpen = () => {}, onCallQueue = () => {}, onChanged = () => {} }: { bids?: Bid[]; mine?: (bidId: string) => boolean; onOpen?: (id: string) => void; onCallQueue?: () => void; onChanged?: () => void }) {
  const permitNews = useBidPermitNews(bids, true)
  const inbox = permitInbox(permitNews, mine)
  const [focus, setFocus] = useState<string | null>(null)
  const doors = { chips: permitNews.chips, lineBidIds: new Set(permitNews.news.map((n) => n.bidId)), onOpen: setFocus }
  return (
    <div>
      <div data-testid="count">{inbox.mine.fresh.length}</div>
      <BidsPermitNewsLens
        inbox={inbox}
        bidsById={new Map(bids.map((b) => [b.id, b]))}
        nameOf={(id) => (id === 'u-me' ? 'You' : 'Priya')}
        onOpenBid={onOpen}
        onOpenCallQueue={onCallQueue}
        renderMarkLost={(bidId, close) => <BidBoardNewsMarkLost bid={{ id: bidId, outcome: null }} packets={undefined} onChanged={onChanged} onClose={close} />}
        focusBidId={focus}
      />
      {bids.map((b) => (
        <div key={b.id} data-testid={`row-${b.id}`}>
          {permitNews.chips.get(b.id) ? <PermitNewsChip bidId={b.id} news={doors} /> : 'no chip'}
        </div>
      ))}
    </div>
  )
}

const cards = () => screen.queryAllByTestId('permit-news-card')
const cardOf = (name: RegExp) => screen.getByRole('group', { name })

beforeEach(() => {
  answers.state.rows = []
  answers.state.fail = null
  answers.loadPermitAnswers.mockClear()
  answers.recordPermitAnswer.mockClear()
  writes.from.mockReset()
  writes.setGcPacketOutcome.mockReset().mockResolvedValue({ error: null, autoLost: [], bidOutcomeSet: null })
  io.loadPermitsByHouseNumber.mockReset().mockResolvedValue([
    permit(),
    permit({ id: 'p2', permit_number: 'PLB-2', address: '88 HARBOR ST', kind: 'plumbing', permit_type: 'Plumbing General Permit', stage: 'issued', issued_on: '2026-03-01', project_name: 'TENANT FINISH OUT PLUMBING', contact: 'Lone Oak Plumbing' }),
  ])
})
afterEach(() => cleanup())

describe('Followup → Permit news', () => {
  it('reads the permits once, leads with another name on a plumbing permit, and asks each card its own question', async () => {
    const onOpen = vi.fn()
    renderWithProviders(<Page onOpen={onOpen} />)
    await waitFor(() => expect(cards()).toHaveLength(2))
    expect(io.loadPermitsByHouseNumber).toHaveBeenCalledTimes(1)
    expect(answers.loadPermitAnswers).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('count').textContent).toBe('2')
    expect(screen.getByTestId('permit-news-count').textContent).toBe('2')

    const plumber = cardOf(/Pecan Grove Pharmacy/)
    expect(cards()[0]).toBe(plumber)
    expect(plumber.textContent).toContain('Another name on the plumbing permit')
    expect(plumber.textContent).toContain('The city lists Lone Oak Plumbing on a plumbing permit here, issued Mar 1.')
    expect(plumber.textContent).toContain('The city’s words: “TENANT FINISH OUT PLUMBING” · Permit PLB-2')
    expect(plumber.textContent).toContain('Did we lose this bid?')
    expect(within(plumber).getAllByRole('button').map((b) => b.textContent)).toEqual(['501', 'We lost it…', 'Still waiting', 'Not our job'])

    const filed = cardOf(/Mill Street Lofts/)
    expect(filed.textContent).toContain('Application filed')
    expect(filed.textContent).toContain('Not sent yet')
    expect(filed.textContent).toContain('Plans are with the city.')
    expect(within(filed).getAllByRole('button').map((b) => b.textContent)).toEqual(['512', 'Got it', 'Not our job'])

    fireEvent.click(within(plumber).getByRole('button', { name: '501' }))
    expect(onOpen).toHaveBeenCalledWith('b2')
  })

  it('Still waiting writes this job, folds the card to a line with Undo, and takes it out of the count', async () => {
    renderWithProviders(<Page />)
    await waitFor(() => expect(cards()).toHaveLength(2))
    fireEvent.click(within(cardOf(/Pecan Grove Pharmacy/)).getByRole('button', { name: 'Still waiting' }))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    expect(answers.recordPermitAnswer).toHaveBeenCalledWith({ bidId: 'b2', permit: { city: 'San Antonio', permit_number: 'PLB-2', permit_type: 'Plumbing General Permit' }, answer: 'this_job' })
    // The receipt stands where the card stood, above the card that is left.
    const receipt = screen.getByTestId('permit-news-receipt')
    expect(receipt.textContent).toContain('501 · Pecan Grove Pharmacy · You said still waiting. The permit stays on the bid as a chip.')
    expect(receipt.compareDocumentPosition(cards()[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The permit is still on the bid: its row keeps the chip.
    expect(screen.getByTestId('row-b2').textContent).toBe('Permit lists Lone Oak Plumbing · Mar 1 ›')
    // What this window answered is its receipt, not a second row under Answered.
    expect(screen.queryByRole('button', { name: /^Answered on your bids/ })).toBeNull()

    fireEvent.click(within(receipt).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(cards()).toHaveLength(2))
    expect(answers.recordPermitAnswer).toHaveBeenLastCalledWith(expect.objectContaining({ bidId: 'b2', answer: 'taken_back' }))
    expect(screen.getByTestId('count').textContent).toBe('2')
    expect(cards()[0]).toBe(cardOf(/Pecan Grove Pharmacy/))
  })

  it('Not our job takes the permit off the bid: no card, no chip, and Undo puts both back', async () => {
    renderWithProviders(<Page />)
    await waitFor(() => expect(cards()).toHaveLength(2))
    fireEvent.click(within(cardOf(/Pecan Grove Pharmacy/)).getByRole('button', { name: 'Not our job' }))
    await waitFor(() => expect(screen.getByTestId('row-b2').textContent).toBe('no chip'))
    expect(answers.recordPermitAnswer).toHaveBeenCalledWith(expect.objectContaining({ bidId: 'b2', answer: 'not_this_job' }))
    expect(screen.getByTestId('permit-news-receipt').textContent).toContain('You said it is not our job. It is off the bid for everyone.')
    expect(screen.getByTestId('count').textContent).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(screen.getByTestId('row-b2').textContent).toBe('Permit lists Lone Oak Plumbing · Mar 1 ›'))
    expect(cards()).toHaveLength(2)
  })

  it('We lost it… opens the board’s own loss window across the card and writes no answer', async () => {
    renderWithProviders(<Page />)
    await waitFor(() => expect(cards()).toHaveLength(2))
    const plumber = cardOf(/Pecan Grove Pharmacy/)
    fireEvent.click(within(plumber).getByRole('button', { name: 'We lost it…' }))
    expect(within(plumber).getByText('Mark lost — why?')).toBeTruthy()
    // The answers give way to the window, and nothing is written until a pick in it.
    expect(within(plumber).queryByRole('button', { name: 'Still waiting' })).toBeNull()
    expect(answers.recordPermitAnswer).not.toHaveBeenCalled()
    expect(writes.from).not.toHaveBeenCalled()
    fireEvent.click(within(plumber).getByRole('button', { name: 'Cancel' }))
    expect(within(plumber).queryByText('Mark lost — why?')).toBeNull()
    expect(within(plumber).getByRole('button', { name: 'Still waiting' })).toBeTruthy()
  })

  it('says why an answer was not saved, and leaves the card to be pressed again', async () => {
    answers.state.fail = 'The network dropped.'
    renderWithProviders(<Page />)
    await waitFor(() => expect(cards()).toHaveLength(2))
    fireEvent.click(within(cardOf(/Mill Street Lofts/)).getByRole('button', { name: 'Got it' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('The network dropped.'))
    expect(cards()).toHaveLength(2)
    expect(screen.queryByTestId('permit-news-receipt')).toBeNull()
  })

  it('counts the reader’s own bids, and lists everyone’s on the switch with each bid’s own answers', async () => {
    renderWithProviders(<Page mine={(id) => id === 'b1'} />)
    await waitFor(() => expect(cards()).toHaveLength(1))
    expect(screen.getByTestId('count').textContent).toBe('1')
    expect(screen.getByText('New on your bids')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Everyone’s 2' }))
    expect(screen.getByText('New on everyone’s bids')).toBeTruthy()
    expect(cards()).toHaveLength(2)
    // Your own first, then the rest. Answering another person's line does not move your count.
    expect(cards()[0]).toBe(cardOf(/Mill Street Lofts/))
    fireEvent.click(within(cardOf(/Pecan Grove Pharmacy/)).getByRole('button', { name: 'Still waiting' }))
    await waitFor(() => expect(screen.getByTestId('permit-news-receipt')).toBeTruthy())
    expect(screen.getByTestId('count').textContent).toBe('1')
  })

  it('lists what was answered before, with who said so, and takes an answer back', async () => {
    answers.state.rows = [
      { id: 'a1', bid_id: 'b2', city: 'San Antonio', permit_number: 'PLB-2', permit_type: 'Plumbing General Permit', answer: 'not_this_job', answered_by: 'u-priya', answered_at: '2026-11-14T15:00:00Z' },
      { id: 'a2', bid_id: 'b1', city: 'San Antonio', permit_number: 'COM-1', permit_type: 'Commercial Project Application', answer: 'this_job', answered_by: 'u-me', answered_at: '2026-11-15T15:00:00Z' },
    ]
    renderWithProviders(<Page />)
    const fold = await screen.findByRole('button', { name: /^Answered on your bids · 2/ })
    // Nothing is new, so nothing is counted and the list says so.
    expect(cards()).toHaveLength(0)
    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByText('Nothing waiting on you.')).toBeTruthy()
    fireEvent.click(fold)
    const rows = screen.getAllByTestId('permit-news-answered').map((r) => r.textContent)
    expect(rows[0]).toContain('512 · Mill Street Lofts, Building C')
    expect(rows[0]).toContain('You said it is this job, Nov 15')
    expect(rows[1]).toContain('501 · Pecan Grove Pharmacy')
    expect(rows[1]).toContain('Plumbing permit listing Lone Oak Plumbing, Mar 1 · Priya said it is not this job, Nov 14')
    fireEvent.click(screen.getByRole('button', { name: 'Put back' }))
    await waitFor(() => expect(cards()).toHaveLength(1))
    expect(answers.recordPermitAnswer).toHaveBeenCalledWith({ bidId: 'b2', permit: { city: 'San Antonio', permit_number: 'PLB-2', permit_type: 'Plumbing General Permit' }, answer: 'taken_back' })
    expect(screen.getByTestId('count').textContent).toBe('1')
  })

  it('points an issued building permit on a sent bid at the Call queue', async () => {
    const onCallQueue = vi.fn()
    io.loadPermitsByHouseNumber.mockResolvedValue([permit({ stage: 'issued', permit_type: 'Comm New Building Permit', issued_on: RECENT })])
    renderWithProviders(<Page bids={[bid({ bid_date_sent: '2026-02-01' })]} onCallQueue={onCallQueue} />)
    await waitFor(() => expect(cards()).toHaveLength(1))
    expect(cards()[0]!.textContent).toContain('The job is moving.')
    fireEvent.click(screen.getByRole('button', { name: 'Open the Call queue ›' }))
    expect(onCallQueue).toHaveBeenCalledTimes(1)
  })

  it('draws no card when the read is not on the database yet or fails, and the rows keep no chip', async () => {
    io.loadPermitsByHouseNumber.mockResolvedValueOnce(null)
    const waiting = renderWithProviders(<Page />)
    await waitFor(() => expect(io.loadPermitsByHouseNumber).toHaveBeenCalledTimes(1))
    expect(cards()).toHaveLength(0)
    expect(screen.getByText('Nothing waiting on you.')).toBeTruthy()
    waiting.unmount()
    io.loadPermitsByHouseNumber.mockRejectedValueOnce(new Error('The network dropped.'))
    renderWithProviders(<Page />)
    await waitFor(() => expect(io.loadPermitsByHouseNumber).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('row-b1').textContent).toBe('no chip')
  })

  it('makes the chip on a bid with a line a press that opens the lens on that bid, on everyone’s list when the bid is not yours', async () => {
    renderWithProviders(<Page mine={(id) => id === 'b1'} />)
    await waitFor(() => expect(cards()).toHaveLength(1))
    // The other person's bid: its chip is a press, and its card is not on your list.
    const chip = within(screen.getByTestId('row-b2')).getByRole('button', { name: 'Permit lists Lone Oak Plumbing · Mar 1 ›' })
    expect(screen.queryByRole('group', { name: /Pecan Grove Pharmacy/ })).toBeNull()
    fireEvent.click(chip)
    await waitFor(() => expect(cardOf(/Pecan Grove Pharmacy/)).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Everyone’s 2' }).getAttribute('aria-pressed')).toBe('true')
    expect(cardOf(/Pecan Grove Pharmacy/).style.outline).toContain('2px solid')
    expect(cardOf(/Mill Street Lofts/).style.outline).toBe('')
  })

  it('opens Answered for a chip on a bid whose line stands, and leaves a chip with no line a label', async () => {
    answers.state.rows = [{ id: 'a1', bid_id: 'b2', city: 'San Antonio', permit_number: 'PLB-2', permit_type: 'Plumbing General Permit', answer: 'this_job', answered_by: 'u-priya', answered_at: '2026-11-14T15:00:00Z' }]
    // An application older than thirty days is a chip with no line.
    io.loadPermitsByHouseNumber.mockResolvedValue([
      permit({ submitted_on: ymdPlusDays(todayYmdInAppTz(), -60) }),
      permit({ id: 'p2', permit_number: 'PLB-2', address: '88 HARBOR ST', kind: 'plumbing', permit_type: 'Plumbing General Permit', stage: 'issued', issued_on: '2026-03-01', project_name: null, contact: 'Lone Oak Plumbing' }),
    ])
    renderWithProviders(<Page />)
    await waitFor(() => expect(screen.getByTestId('row-b2').textContent).toBe('Permit lists Lone Oak Plumbing · Mar 1 ›'))
    expect(within(screen.getByTestId('row-b1')).queryByRole('button')).toBeNull()
    expect(screen.getByTestId('row-b1').textContent).toMatch(/^Applied /)
    expect(screen.queryByTestId('permit-news-answered')).toBeNull()
    fireEvent.click(within(screen.getByTestId('row-b2')).getByRole('button'))
    await waitFor(() => expect(screen.getAllByTestId('permit-news-answered')).toHaveLength(1))
    expect(screen.getByTestId('permit-news-answered').textContent).toContain('Priya said it is this job, Nov 14')
  })
})
