// @vitest-environment jsdom
/**
 * The owner's ask of 2026-11-19: a primary's My Bids card opens folded to its
 * heading, at every width. The heading keeps its count and New Bid beside it,
 * and one press shows the bids. Every other role's card opens as it did.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const BIDS = [
  {
    id: 'b1',
    project_name: 'Fire Cabinet Installation',
    bid_due_date: '2025-10-27',
    bid_date_sent: null,
    outcome: null,
    customer_id: null,
    estimator_id: 'me',
    account_manager_id: null,
    service_type: { name: 'Plumbing' },
  },
  {
    id: 'b2',
    project_name: 'Restroom Stalls',
    bid_due_date: '2026-03-23',
    bid_date_sent: null,
    outcome: null,
    customer_id: null,
    estimator_id: null,
    account_manager_id: 'me',
    service_type: { name: 'Plumbing' },
  },
]

/** What the `bids` read answers, and a gate that holds it while a test reads the loading card. */
const bidsRead: { rows: unknown[]; hold: Promise<void> | null } = { rows: BIDS, hold: null }
/** What the other tables answer: someone else's note on a bid makes it unread. */
const otherRows: Record<string, unknown[]> = {}
const openBidPreview = vi.fn()
/** True for a test that runs on a device held in the hand, where a bid is hidden with a swipe; `viewAs` while View as is on. */
const device = { handHeld: false, viewAs: false }
/** Every upsert to the person's read-state rows, and the refusal the next ones answer with, if any. */
const readStateWrites: { rows: Array<Record<string, unknown>>; onConflict: string | undefined }[] = []
const writeAnswer: { error: { code: string; message: string } | null } = { error: null }

vi.mock('../../lib/paintedMap/handHeld', () => ({ handHeld: () => device.handHeld }))
vi.mock('../../lib/impersonationSession', () => ({ isImpersonationSessionActive: () => device.viewAs }))

vi.mock('../../contexts/BidPreviewModalContext', () => ({ useBidPreview: () => ({ openBidPreview }) }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { from: (table: string) => unknown }
  const origFrom = stub.from.bind(stub)
  /** A chain that answers the bids at whatever point it is awaited. */
  const bidsChain = (): unknown => {
    const answer = async () => {
      if (bidsRead.hold) await bidsRead.hold
      return { data: bidsRead.rows, error: null }
    }
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'or', 'is', 'order', 'limit']) chain[m] = () => chain
    chain.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => answer().then(ok, bad)
    return chain
  }
  const rowsChain = (rows: unknown[]): unknown => {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in']) chain[m] = () => chain
    chain.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok, bad)
    return chain
  }
  /** The person's read-state rows: a read answers `otherRows`, an upsert is recorded and answers `writeAnswer`. */
  const readStateChain = (): unknown => {
    const chain = rowsChain(otherRows.user_bid_notes_read_state ?? []) as Record<string, unknown>
    chain.upsert = (rows: Array<Record<string, unknown>>, opts?: { onConflict?: string }) => {
      readStateWrites.push({ rows, onConflict: opts?.onConflict })
      return Promise.resolve({ data: null, error: writeAnswer.error })
    }
    return chain
  }
  stub.from = (table: string) =>
    table === 'bids' ? bidsChain() : table === 'user_bid_notes_read_state' ? readStateChain() : otherRows[table] ? rowsChain(otherRows[table]) : origFrom(table)
  return { supabase: stub }
})

import { DashboardMyBidsSection } from './DashboardMyBidsSection'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { UserRole } from '../../hooks/useAuth'

const noop = () => {}
const section = (role: UserRole | null) => (
  <DashboardMyBidsSection authUserId="me" role={role} onContentVisibleChange={noop} />
)

/** The heading once the bids have loaded: the count is in its name. */
const loadedHeading = () => screen.findByRole('button', { name: 'My Bids, 2 bids' })

afterEach(() => {
  bidsRead.rows = BIDS
  bidsRead.hold = null
  for (const k of Object.keys(otherRows)) delete otherRows[k]
  openBidPreview.mockClear()
  localStorage.clear()
  device.handHeld = false
  device.viewAs = false
  readStateWrites.length = 0
  writeAnswer.error = null
})

describe('DashboardMyBidsSection — how the card opens', () => {
  it('a primary: folded to the heading, with its count and New Bid in view, and one press shows the bids', async () => {
    renderWithProviders(section('primary'))
    const heading = await loadedHeading()
    expect(heading.getAttribute('aria-expanded')).toBe('false')
    expect(heading.textContent).toContain('My Bids (2)')
    expect(screen.getByRole('link', { name: 'New Bid' }).getAttribute('href')).toBe('/bids?new=true')
    expect(screen.queryByText('Fire Cabinet Installation')).toBeNull()
    expect(screen.queryByText('View all')).toBeNull()

    fireEvent.click(heading)
    await waitFor(() => expect(screen.getByText('Fire Cabinet Installation')).toBeTruthy())
    expect(screen.getByText('Restroom Stalls')).toBeTruthy()
    expect(heading.getAttribute('aria-expanded')).toBe('true')
    expect(heading.textContent).toContain('My Bids (2)')

    fireEvent.click(heading)
    await waitFor(() => expect(screen.queryByText('Fire Cabinet Installation')).toBeNull())
    expect(screen.getByRole('link', { name: 'New Bid' })).toBeTruthy()
  })

  it.each(['estimator', 'assistant', 'master_technician', 'dev'] as const)('%s: open, as before', async (role) => {
    renderWithProviders(section(role))
    const heading = await loadedHeading()
    expect(heading.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Fire Cabinet Installation')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'New Bid' })).toBeTruthy()
  })

  it('a primary, while the bids load: the folded heading gives no count it does not have', async () => {
    let release = noop
    bidsRead.hold = new Promise<void>((resolve) => {
      release = resolve
    })
    renderWithProviders(section('primary'))
    const loading = await screen.findByRole('button', { name: 'My Bids, loading' })
    expect(loading.getAttribute('aria-expanded')).toBe('false')
    expect(loading.textContent).not.toMatch(/\(\d+\)/)
    expect(screen.getByRole('link', { name: 'New Bid' })).toBeTruthy()

    release()
    const heading = await loadedHeading()
    expect(heading.getAttribute('aria-expanded')).toBe('false')
  })

  it('a role that arrives after the first paint as primary still folds the card', async () => {
    const view = renderWithProviders(section(null))
    view.rerender(section('primary'))
    const heading = await loadedHeading()
    expect(heading.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Fire Cabinet Installation')).toBeNull()
  })
})

describe('DashboardMyBidsSection — the bids by state (punch list #426)', () => {
  const row = (over: Record<string, unknown>) => ({ ...BIDS[0], ...over })
  const group = (name: string | RegExp) => screen.findByRole('button', { name })

  it('a bid marked won with no sent date is under Won, folded, and never in the unsent list', async () => {
    bidsRead.rows = [row({ id: 'u1', project_name: 'Alder St changes' }), row({ id: 'w1', project_name: 'Quarry Rd shell', outcome: 'won', bid_date_sent: null })]
    renderWithProviders(section('estimator'))
    expect(await group('Unsent, 1 bid, 1 past due')).toBeTruthy()
    expect(screen.getByText('Alder St changes')).toBeTruthy()
    expect(screen.queryByText('Quarry Rd shell')).toBeNull()
    fireEvent.click(await group('Won, 1 bid'))
    expect(screen.getByText('Quarry Rd shell')).toBeTruthy()
  })

  it('a bid the Bid Board no longer lists is not drawn: archived from the board while unsent, or adopted', async () => {
    bidsRead.rows = [
      row({ id: 'u1', project_name: 'Alder St changes' }),
      row({ id: 'a1', project_name: 'Harbor St rough-in', working_board_archived_at: '2026-05-11T15:00:00Z' }),
      row({ id: 'a2', project_name: 'Maple Court Lot 2', adopted_into_bid_id: 'u1' }),
    ]
    renderWithProviders(section('estimator'))
    expect(await screen.findByRole('button', { name: 'My Bids, 1 bid' })).toBeTruthy()
    expect(screen.queryByText('Harbor St rough-in')).toBeNull()
    expect(screen.queryByText('Maple Court Lot 2')).toBeNull()
  })

  it('a sent bid with no answer is under the board\'s words, and its group opens on a press', async () => {
    bidsRead.rows = [row({ id: 'p1', project_name: 'Juniper Ave finish', bid_date_sent: '2026-11-03' })]
    renderWithProviders(section('estimator'))
    const heading = await group('Not yet won or lost, 1 bid')
    expect(heading.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Juniper Ave finish')).toBeNull()
    // Unsent is always drawn, with its good words when it is empty.
    expect(screen.getByText('Nothing unsent.')).toBeTruthy()
    fireEvent.click(heading)
    expect(screen.getByText('Juniper Ave finish')).toBeTruthy()
    expect(screen.getByText('Sent. Waiting on an answer.')).toBeTruthy()
  })

  it('a folded group still draws a bid with unread updates', async () => {
    bidsRead.rows = [row({ id: 'p1', project_name: 'Juniper Ave finish', bid_date_sent: '2026-11-03' }), row({ id: 'p2', project_name: 'Tanner Way remodel', bid_date_sent: '2026-11-10' })]
    otherRows.bids_submission_entries = [{ id: 'e1', bid_id: 'p1', created_at: '2026-11-20T15:00:00Z', created_by: 'someone-else', notes: 'The owner wants the price held.', occurred_at: '2026-11-20', contact_method: null }]
    renderWithProviders(section('estimator'))
    const heading = await group('Not yet won or lost, 2 bids, 1 unread')
    expect(heading.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText('Juniper Ave finish')).toBeTruthy()
    expect(screen.getByText('Unread updates')).toBeTruthy()
    expect(screen.queryByText('Tanner Way remodel')).toBeNull()
  })

  it('Hide moves a bid to Hidden, and Show again brings it back', async () => {
    renderWithProviders(section('estimator'))
    await loadedHeading()
    fireEvent.click(screen.getByRole('button', { name: 'Hide, Fire Cabinet Installation' }))
    expect(await screen.findByRole('button', { name: 'My Bids, 1 bid' })).toBeTruthy()
    const hidden = await group('Hidden, 1 bid')
    expect(screen.queryByText('Fire Cabinet Installation')).toBeNull()
    fireEvent.click(hidden)
    fireEvent.click(screen.getByRole('button', { name: 'Show again, Fire Cabinet Installation' }))
    expect(await loadedHeading()).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Hidden/ })).toBeNull()
  })

  it('with every bid hidden the card still draws, and Hidden is the way back', async () => {
    localStorage.setItem('dashboard_my_bids_hidden_me', JSON.stringify(['b1', 'b2']))
    renderWithProviders(section('estimator'))
    expect(await screen.findByRole('button', { name: 'My Bids, 0 bids' })).toBeTruthy()
    expect(screen.getByText('Nothing unsent.')).toBeTruthy()
    expect(screen.getByText('The bids you hid are below.')).toBeTruthy()
    expect(await group('Hidden, 2 bids')).toBeTruthy()
  })

  it('a press on a bid opens the bid\'s window, and the card has one door, Bid Board', async () => {
    renderWithProviders(section('estimator'))
    await loadedHeading()
    fireEvent.click(screen.getByText('Restroom Stalls'))
    expect(openBidPreview).toHaveBeenCalledWith('b2')
    expect(screen.getByRole('link', { name: 'Bid Board ›' }).getAttribute('href')).toBe('/bids?tab=bid-board')
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull()
  })

  it('the trade is left off while every bid shares one', async () => {
    renderWithProviders(section('estimator'))
    await loadedHeading()
    expect(screen.queryByText('Plumbing')).toBeNull()
  })

  it('the trade is on each bid when they span more than one', async () => {
    bidsRead.rows = [row({ id: 'u1', project_name: 'Alder St changes' }), row({ id: 'u2', project_name: 'Cobalt Dr shell', service_type: { name: 'HVAC' } })]
    renderWithProviders(section('estimator'))
    await loadedHeading()
    expect(screen.getByText('Plumbing')).toBeTruthy()
    expect(screen.getByText('HVAC')).toBeTruthy()
  })
})

describe('DashboardMyBidsSection — hiding a bid (punch list #426, step 4)', () => {
  const pointer = (el: Element, type: string, x: number) => fireEvent(el, new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: 10, button: 0 }))

  it('at a desk, Hide says what it did, and Undo puts the bid back', async () => {
    renderWithProviders(section('estimator'))
    await loadedHeading()
    expect(document.querySelector('[data-my-bids-hint]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hide, Fire Cabinet Installation' }))
    expect(await screen.findByText('Hidden: Fire Cabinet Installation.')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'My Bids, 1 bid' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await loadedHeading()).toBeTruthy()
    expect(screen.getByText('Fire Cabinet Installation')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('dashboard_my_bids_hidden_me') ?? '[]')).toEqual([])
  })

  it('on a device held in the hand, a swipe to the left hides the bid and the card says how', async () => {
    device.handHeld = true
    renderWithProviders(section('estimator'))
    await loadedHeading()
    expect(document.querySelector('[data-my-bids-hint]')?.textContent).toBe('Swipe a bid left to hide it.')
    const slide = document.querySelector('[data-my-bid="b1"] [data-swipe-away-slide]') as HTMLElement
    pointer(slide, 'pointerdown', 300)
    pointer(slide, 'pointermove', 280)
    pointer(slide, 'pointermove', 150)
    pointer(slide, 'pointerup', 150)
    expect(await screen.findByText('Hidden: Fire Cabinet Installation.')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Hidden, 1 bid' })).toBeTruthy()
    // The swipe did not also open the bid.
    expect(openBidPreview).not.toHaveBeenCalled()
    // The hide is the person's own row (step 6), not this browser's.
    await waitFor(() => expect(readStateWrites.map((w) => w.rows.map((r) => [r.bid_id, typeof r.hidden_at]))).toEqual([[['b1', 'string']]]))
    expect(localStorage.getItem('dashboard_my_bids_hidden_me')).toBeNull()
  })

  it('on a device held in the hand, a short swipe leaves the bid, and a press still opens its window', async () => {
    device.handHeld = true
    renderWithProviders(section('estimator'))
    await loadedHeading()
    const slide = document.querySelector('[data-my-bid="b2"] [data-swipe-away-slide]') as HTMLElement
    pointer(slide, 'pointerdown', 300)
    pointer(slide, 'pointermove', 280)
    pointer(slide, 'pointermove', 240)
    pointer(slide, 'pointerup', 240)
    expect(screen.getByRole('button', { name: 'My Bids, 2 bids' })).toBeTruthy()
    await new Promise((r) => setTimeout(r, 5))
    fireEvent.click(screen.getByText('Restroom Stalls'))
    expect(openBidPreview).toHaveBeenCalledWith('b2')
  })

  it('at a desk, Show again says what it did, and Undo hides the bid again and says nothing more (v2.8603)', async () => {
    renderWithProviders(section('estimator'))
    await loadedHeading()
    fireEvent.click(screen.getByRole('button', { name: 'Hide, Fire Cabinet Installation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Hidden, 1 bid' }))
    // A desk keeps the press, and the line under the heading names it.
    expect(screen.getByText('You hid these. Show again puts one back.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show again, Fire Cabinet Installation' }))
    expect(await screen.findByText('Shown again: Fire Cabinet Installation.')).toBeTruthy()
    expect(await loadedHeading()).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByRole('button', { name: 'Hidden, 1 bid' })).toBeTruthy()
    // One Undo does not raise another.
    expect(screen.queryByText('Hidden: Fire Cabinet Installation.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('on a device held in the hand, a hidden bid has no press: a swipe to the right shows it again (v2.8603)', async () => {
    device.handHeld = true
    renderWithProviders(section('estimator'))
    await loadedHeading()
    const out = document.querySelector('[data-my-bid="b1"] [data-swipe-away-slide]') as HTMLElement
    pointer(out, 'pointerdown', 300)
    pointer(out, 'pointermove', 280)
    pointer(out, 'pointermove', 150)
    pointer(out, 'pointerup', 150)
    fireEvent.click(await screen.findByRole('button', { name: 'Hidden, 1 bid' }))
    // The line over the rows says the move, and the row draws no word press.
    expect(screen.getByText('You hid these. Swipe one right to show it again.')).toBeTruthy()
    expect(document.querySelectorAll('[data-swipe-away-press]').length).toBe(0)
    expect(document.querySelector('[data-my-bid="b1"] [data-swipe-away-row]')?.getAttribute('data-swipe-away-row')).toBe('right')
    // A keyboard and a screen reader still have a real press: the strip.
    expect(screen.getByRole('button', { name: 'Show again, Fire Cabinet Installation' }).getAttribute('data-swipe-away-strip')).toBe('rest')
    const back = document.querySelector('[data-my-bid="b1"] [data-swipe-away-slide]') as HTMLElement
    // A short swipe right springs back.
    pointer(back, 'pointerdown', 100)
    pointer(back, 'pointermove', 120)
    pointer(back, 'pointermove', 180)
    pointer(back, 'pointerup', 180)
    expect(screen.getByRole('button', { name: 'Hidden, 1 bid' })).toBeTruthy()
    // Past the mark it shows the bid again, with Undo.
    pointer(back, 'pointerdown', 100)
    pointer(back, 'pointermove', 120)
    pointer(back, 'pointermove', 250)
    pointer(back, 'pointerup', 250)
    expect(await screen.findByText('Shown again: Fire Cabinet Installation.')).toBeTruthy()
    expect(await loadedHeading()).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Hidden/ })).toBeNull()
    // Neither swipe opened the bid.
    expect(openBidPreview).not.toHaveBeenCalled()
    // The person's row is written twice: hidden, then shown again.
    await waitFor(() => expect(readStateWrites.map((w) => w.rows.map((r) => [r.bid_id, r.hidden_at === null ? 'null' : typeof r.hidden_at]))).toEqual([[['b1', 'string']], [['b1', 'null']]]))
  })
})

describe('DashboardMyBidsSection — a hidden bid follows the person (punch list #426, step 6)', () => {
  const hiddenRow = (bidId: string) => ({ bid_id: bidId, last_seen_bid_submission_at: null, last_seen_customer_contact_at: null, hidden_at: '2026-11-20T15:00:00Z' })

  it('a bid hidden in the person\'s row is under Hidden on any device, with nothing in this browser', async () => {
    otherRows.user_bid_notes_read_state = [hiddenRow('b2')]
    renderWithProviders(section('estimator'))
    expect(await screen.findByRole('button', { name: 'My Bids, 1 bid' })).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Hidden, 1 bid' })).toBeTruthy()
    expect(screen.queryByText('Restroom Stalls')).toBeNull()
    expect(readStateWrites).toEqual([])
  })

  it('Hide writes the person\'s row, and Show again sets it back to null', async () => {
    renderWithProviders(section('estimator'))
    await loadedHeading()
    fireEvent.click(screen.getByRole('button', { name: 'Hide, Fire Cabinet Installation' }))
    await waitFor(() => expect(readStateWrites.length).toBe(1))
    const hide = readStateWrites[0]!
    expect(hide.onConflict).toBe('user_id,bid_id')
    expect(hide.rows).toHaveLength(1)
    expect(hide.rows[0]).toMatchObject({ user_id: 'me', bid_id: 'b1' })
    expect(Number.isNaN(Date.parse(String(hide.rows[0]!.hidden_at)))).toBe(false)
    // The write names no read mark, so Mark read's watermarks are left as they are.
    expect(Object.keys(hide.rows[0]!).sort()).toEqual(['bid_id', 'hidden_at', 'updated_at', 'user_id'])
    fireEvent.click(await screen.findByRole('button', { name: 'Hidden, 1 bid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show again, Fire Cabinet Installation' }))
    await waitFor(() => expect(readStateWrites.length).toBe(2))
    expect(readStateWrites[1]!.rows[0]).toMatchObject({ user_id: 'me', bid_id: 'b1', hidden_at: null })
    expect(await loadedHeading()).toBeTruthy()
  })

  it('Undo right after Hide runs after the hide, so the bid ends shown in the person\'s row', async () => {
    renderWithProviders(section('estimator'))
    await loadedHeading()
    fireEvent.click(screen.getByRole('button', { name: 'Hide, Fire Cabinet Installation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(readStateWrites.length).toBe(2))
    expect(readStateWrites.map((w) => w.rows[0]!.hidden_at === null)).toEqual([false, true])
    expect(await loadedHeading()).toBeTruthy()
  })

  it('the ids this browser kept move into the person\'s rows once, and an id the read did not bring stays', async () => {
    localStorage.setItem('dashboard_my_bids_hidden_me', JSON.stringify(['b1', 'gone']))
    renderWithProviders(section('estimator'))
    expect(await screen.findByRole('button', { name: 'My Bids, 1 bid' })).toBeTruthy()
    await waitFor(() => expect(readStateWrites.length).toBe(1))
    expect(readStateWrites[0]!.rows.map((r) => r.bid_id)).toEqual(['b1'])
    await waitFor(() => expect(JSON.parse(localStorage.getItem('dashboard_my_bids_hidden_me') ?? '[]')).toEqual(['gone']))
  })

  it('a hide the database refuses stays on this device, and says why', async () => {
    writeAnswer.error = { code: '42501', message: 'new row violates row-level security policy' }
    renderWithProviders(section('estimator'))
    await loadedHeading()
    fireEvent.click(screen.getByRole('button', { name: 'Hide, Fire Cabinet Installation' }))
    expect(await screen.findByText(/^Hidden on this device only:/)).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('dashboard_my_bids_hidden_me') ?? '[]')).toEqual(['b1'])
    expect(screen.getByRole('button', { name: 'My Bids, 1 bid' })).toBeTruthy()
  })

  it('while View as is on, a hide is this browser\'s alone and the person\'s row is not written', async () => {
    device.viewAs = true
    localStorage.setItem('dashboard_my_bids_hidden_me', JSON.stringify(['b2']))
    renderWithProviders(section('estimator'))
    expect(await screen.findByRole('button', { name: 'My Bids, 1 bid' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide, Fire Cabinet Installation' }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem('dashboard_my_bids_hidden_me') ?? '[]')).toEqual(['b2', 'b1']))
    expect(readStateWrites).toEqual([])
  })
})

