// @vitest-environment jsdom
/**
 * Render smoke for the Bids page — the safety net for the Bids.tsx second pass
 * (docs/BIDS_TABS_ARCHITECTURE.md, docs/PAGE_DECOMPOSITION_PLAYBOOK.md).
 *
 * It walks the `?tab=` keys per role: each case deep-links to a tab, waits for the page to
 * settle past its role load, and reads where the URL and the strips ended up. What a role may
 * open is `lib/bids/bidsTabAccess` (its own matrix test pins the rule); this pins that the
 * page's router, strips and lens bars follow it without crashing on mount. Not a behavior
 * test of any tab.
 *
 * The supabase stub is table-aware, like the Materials page smoke: the page reads its role
 * from a `users.single()` SELECT on mount and every gate keys off it.
 */
import type { ReactElement, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ToastProvider } from '../contexts/ToastContext'
import { ConfirmDialogProvider } from '../contexts/ConfirmDialogContext'
import { ThemeProvider } from '../contexts/ThemeContext'

const smoke = vi.hoisted(() => ({
  role: 'dev' as string,
  bids: [] as Array<Record<string, unknown>>,
  bidsReads: 0,
  /** Every insert / update / upsert / delete the page sends, in order (#51 PR 2). */
  writes: [] as Array<{ table: string; op: string; payload: unknown; filters: Array<[string, unknown]> }>,
  /** Answer `bids` updates with no rows — what RLS does to a write it refuses. */
  refuseBidUpdates: false,
}))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const generic = makeSupabaseStub()

  type WriteRecord = { op: string | null; payload: unknown; filters: Array<[string, unknown]>; logged: boolean }

  /**
   * Chainable builder that resolves `rows` (list) / `rows[0] ?? null` (single). A write
   * (insert / update / upsert / delete) is recorded in `smoke.writes` once, when it is awaited.
   */
  function makeTableBuilder(table: string, rows: () => Array<Record<string, unknown>>): Record<string, unknown> {
    const rec: WriteRecord = { op: null, payload: undefined, filters: [], logged: false }
    const build = (single: boolean): Record<string, unknown> => {
      const result = () => {
        if (rec.op && !rec.logged) {
          rec.logged = true
          smoke.writes.push({ table, op: rec.op, payload: rec.payload, filters: rec.filters })
        }
        const refused = rec.op === 'update' && table === 'bids' && smoke.refuseBidUpdates
        const list = refused ? [] : rows()
        return Promise.resolve({ data: single ? (list[0] ?? null) : list, error: null, count: list.length })
      }
      const b: Record<string, unknown> = {}
      for (const m of [
        'select', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
        'is', 'in', 'or', 'not', 'contains', 'filter',
        'order', 'range', 'limit', 'abortSignal',
      ]) {
        b[m] = () => b
      }
      for (const op of ['insert', 'update', 'upsert', 'delete']) {
        b[op] = (payload?: unknown) => {
          rec.op = op
          rec.payload = payload
          return b
        }
      }
      b.eq = (col: string, val: unknown) => {
        rec.filters.push([col, val])
        return b
      }
      b.single = () => build(true)
      b.maybeSingle = () => build(true)
      b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => result().then(f, r)
      b.catch = (r?: (e: unknown) => unknown) => result().catch(r)
      b.finally = (fin?: () => void) => result().finally(fin)
      return b
    }
    return build(false)
  }

  const TABLE_ROWS: Record<string, () => Array<Record<string, unknown>>> = {
    users: () => [{
      // An id and a name, so lists keyed by user id draw without React's missing-key warning.
      id: 'smoke-user',
      name: 'Smoke User',
      role: smoke.role,
      estimator_service_type_ids: null,
      primary_service_type_ids: null,
      superintendent_service_type_ids: null,
    }],
    service_types: () => [{ id: 'st-1', name: 'Plumbing', sequence_order: 1 }],
    bids: () => {
      smoke.bidsReads += 1
      return smoke.bids
    },
  }

  return {
    supabase: {
      ...generic,
      from: (table: string) => {
        const rows = TABLE_ROWS[table]
        return rows ? makeTableBuilder(table, rows) : (generic.from as () => unknown)()
      },
    },
  }
})

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import Bids from './Bids'
import { installDomShims, settle } from '../test/renderSmokeMocks'
import { BIDS_TABS, bidsTabOpenFor, isFollowupLens, resolveBidsTabRoute, type BidsTabKey } from '../lib/bids/bidsTabAccess'
import { followupLensCaption, followupLenses } from '../lib/bids/bidsLenses'
import { resetRoleGateAnnouncements } from '../hooks/useRoleGate'
import { BID_DATE_SENT_ATTESTATION_NULLS } from '../lib/bids/bidDateSentAttestation'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

/** jsdom has no `CSS.escape`; the tab strips use it to find the open tab's button. */
function installCssEscapeShim() {
  const g = globalThis as { CSS?: { escape?: (value: string) => string } }
  if (!g.CSS) g.CSS = {}
  if (!g.CSS.escape) g.CSS.escape = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`)
}

function renderBidsAt(url: string, role: string, bids: Array<Record<string, unknown>> = []) {
  smoke.role = role
  smoke.bids = bids
  smoke.bidsReads = 0
  smoke.writes = []
  smoke.refuseBidUpdates = false
  installDomShims()
  installCssEscapeShim()
  return render((<><Bids /><LocationProbe /></>) as ReactElement, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider>
        <ToastProvider>
          <ConfirmDialogProvider>
            <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: false, v7_relativeSplatPath: true }}>
              {children}
            </MemoryRouter>
          </ConfirmDialogProvider>
        </ToastProvider>
      </ThemeProvider>
    ),
  })
}

afterEach(() => {
  cleanup()
  resetRoleGateAnnouncements()
})

const BIDS_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'] as const

/** The strips' buttons by tab key. The Robots group tab needs robot bids or audits, so it is absent on this empty account. */
const STRIP_TABS: BidsTabKey[] = ['bid-board', 'builder-review', 'working', 'bid-costs', 'estimators', 'day-book', 'counts', 'takeoffs', 'labor', 'pricing', 'cover-letter', 'submittals', 'rfi', 'change-order', 'lien-release']

const stripButton = (key: string) => document.querySelector(`[data-tabkey="${key}"]`)
const currentUrl = () => screen.getByTestId('location').textContent
/** The `?tab=` the URL came to rest on — a tab may add params of its own (the Day book's dates). */
const currentTab = () => new URLSearchParams((currentUrl() ?? '').split('?')[1] ?? '').get('tab')

/**
 * The page at rest: its first load of bids has landed and React has nothing pending. A click
 * belongs after this — the load re-applies the URL's tab when it lands, so a tab clicked while
 * it is in flight can be snapped back (the flake this file had on main, 2026-09-28).
 */
async function pageAtRest() {
  await waitFor(() => expect(smoke.bidsReads).toBeGreaterThan(0))
  await settle()
}

/** Deep-links to a tab and waits until the page is past its role load and the URL has come to rest. */
async function landOn(tab: string, role: string): Promise<string> {
  const route = resolveBidsTabRoute(tab, role)
  const expected = route.bounce ? 'bid-board' : route.tab
  renderBidsAt(`/bids?tab=${tab}`, role)
  await waitFor(() => expect(stripButton('bid-board')).toBeTruthy())
  await waitFor(() => expect(currentTab()).toBe(expected))
  await settle()
  return expected as string
}

describe('Bids page render smoke — the default landing', () => {
  it('a dev with no ?tab= lands on the Bid Board, every strip tab drawn', async () => {
    renderBidsAt('/bids', 'dev')
    expect(await screen.findByRole('button', { name: 'Bid Board' })).toBeTruthy()
    await waitFor(() => expect(currentUrl()).toBe('/bids?tab=bid-board'))
    for (const key of STRIP_TABS) expect(stripButton(key)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New Bid' })).toBeTruthy()
  })

  it('a role with no Bids access is told so', async () => {
    renderBidsAt('/bids', 'helpers')
    expect(await screen.findByText('You do not have access to Bids.')).toBeTruthy()
    expect(stripButton('bid-board')).toBeNull()
  })
})

describe('Bids page render smoke — every ?tab= key, every role', () => {
  it.each(BIDS_ROLES)('%s: each tab mounts or bounces as the rule says, and the strips draw what the role may open', async (role) => {
    for (const tab of [...BIDS_TABS, 'cost-estimate']) {
      const landed = await landOn(tab, role)
      for (const key of STRIP_TABS) {
        expect(!!stripButton(key), `${role} at ?tab=${tab}: the ${key} strip button`).toBe(bidsTabOpenFor(key, role))
      }
      const followupPills = followupLenses({ role, jobAccountsMissing: 0 })
      if (isFollowupLens(landed)) {
        for (const lens of followupPills) expect(screen.getAllByRole('button', { name: new RegExp(`^${lens.label}`) }).length, `${role} at ?tab=${tab}: the ${lens.label} pill`).toBeGreaterThan(0)
        expect(screen.getByText(followupLensCaption(landed))).toBeTruthy()
      } else {
        expect(screen.queryByText(followupLensCaption('call-queue'))).toBeNull()
      }
      cleanup()
    }
  }, 120_000)
})

describe('Bids page render smoke — a refused link', () => {
  it('a superintendent on Pricing is told so and lands on the board', async () => {
    await landOn('pricing', 'superintendent')
    expect(await screen.findByText(/This page is for the office/)).toBeTruthy()
  })

  it('a primary on Counts is told so and lands on the board', async () => {
    await landOn('counts', 'primary')
    expect(await screen.findByText(/This page is for the office/)).toBeTruthy()
  })

  it('an estimator on the Day book lands on the board without a word', async () => {
    await landOn('day-book', 'estimator')
    expect(screen.queryByText(/This page is for the office/)).toBeNull()
  })

  it('an old Cost Estimate link lands on Labor', async () => {
    expect(await landOn('cost-estimate', 'estimator')).toBe('labor')
  })

  it('an old Shadows link lands on the Robot Board', async () => {
    expect(await landOn('robot-shadows', 'estimator')).toBe('robot-board')
  })
})

/** One unsent bid on the account, enough of a row for the board and the workflow tabs to draw. */
const BID = {
  id: 'bid-1',
  bid_number: '482',
  project_name: 'Pondhill Building 2',
  address: '4114 Pond Hill Rd',
  service_type_id: 'st-1',
  outcome: null,
  bid_date_sent: null,
  bid_due_date: '2026-10-01',
  bid_value: null,
  customer_id: null,
  gc_builder_id: null,
  customers: null,
  bids_gc_builders: null,
  estimator_id: null,
  account_manager_id: null,
  created_by: 'someone-else',
  estimator: null,
  account_manager: null,
  adopted_into_bid_id: null,
  working_board_archived_at: null,
  materials_model: 'rough',
}

const currentParam = (name: string) => new URLSearchParams((currentUrl() ?? '').split('?')[1] ?? '').get(name)

describe('Bids page render smoke — a link to a bid', () => {
  it('?tab=bid-board&bidId= rings the row and drops the bidId', async () => {
    renderBidsAt('/bids?tab=bid-board&bidId=bid-1', 'estimator', [BID])
    await waitFor(() => expect(document.getElementById('bid-board-row-bid-1')).toBeTruthy())
    await waitFor(() => expect(currentParam('bidId')).toBeNull())
    expect(currentTab()).toBe('bid-board')
    expect(document.getElementById('bid-board-row-bid-1')!.getAttribute('data-deeplink-gen')).toBe('1')
  })

  it('a bid that is not on the account keeps its link while the page looks for it', async () => {
    renderBidsAt('/bids?tab=bid-board&bidId=bid-404', 'estimator', [BID])
    await waitFor(() => expect(document.getElementById('bid-board-row-bid-1')).toBeTruthy())
    await settle()
    expect(currentParam('bidId')).toBe('bid-404')
    expect(document.getElementById('bid-board-row-bid-1')!.getAttribute('data-deeplink-gen')).toBeNull()
  })

  it('?tab=submission-followup&bidId= lands on By status and drops the bidId', async () => {
    renderBidsAt('/bids?tab=submission-followup&bidId=bid-1', 'estimator', [BID])
    await waitFor(() => expect(currentParam('bidId')).toBeNull())
    expect(currentTab()).toBe('submission-followup')
    expect(screen.getByText(followupLensCaption('submission-followup'))).toBeTruthy()
  })

  it('?tab=builder-review&bidId= on a bid with no customer says so and drops the bidId', async () => {
    renderBidsAt('/bids?tab=builder-review&bidId=bid-1', 'estimator', [BID])
    expect(await screen.findByText('This bid is not linked to a customer. Builder Review lists customers.')).toBeTruthy()
    await waitFor(() => expect(currentParam('bidId')).toBeNull())
    expect(currentTab()).toBe('builder-review')
  })

  it.each(['counts', 'takeoffs', 'labor', 'pricing', 'cover-letter', 'submittals', 'rfi', 'change-order', 'lien-release'])('?tab=%s&bidId= opens the tab on that bid and keeps the link', async (tab) => {
    renderBidsAt(`/bids?tab=${tab}&bidId=bid-1`, 'estimator', [BID])
    await waitFor(() => expect(stripButton('bid-board')).toBeTruthy())
    await waitFor(() => expect(screen.getAllByText(/Pondhill Building 2/).length).toBeGreaterThan(0))
    await settle()
    expect(currentTab()).toBe(tab)
    expect(currentParam('bidId')).toBe('bid-1')
  })

  it('a superintendent’s link to Pricing on a bid bounces to the board', async () => {
    renderBidsAt('/bids?tab=pricing&bidId=bid-1', 'superintendent', [BID])
    await waitFor(() => expect(currentTab()).toBe('bid-board'))
    expect(await screen.findByText(/This page is for the office/)).toBeTruthy()
  })

  it('?openBidEdit=1&bidId= opens the bid’s window and drops the flag', async () => {
    renderBidsAt('/bids?tab=bid-board&bidId=bid-1&openBidEdit=1', 'estimator', [BID])
    await waitFor(() => expect(currentParam('openBidEdit')).toBeNull())
    await waitFor(() => expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0))
  })
})

describe('Bids page render smoke — the Day book’s params', () => {
  const dayBookParams = () => [...new URLSearchParams((currentUrl() ?? '').split('?')[1] ?? '').keys()].filter((k) => k.startsWith('dayb_'))

  it('stay while the Day book is open and leave the URL when another tab is clicked', async () => {
    renderBidsAt('/bids?tab=day-book', 'dev')
    await waitFor(() => expect(stripButton('bid-board')).toBeTruthy())
    await waitFor(() => expect(dayBookParams()).toEqual(['dayb_from', 'dayb_to']))
    await pageAtRest()
    fireEvent.click(stripButton('estimators') as HTMLElement)
    await waitFor(() => expect(currentTab()).toBe('estimators'))
    expect(dayBookParams()).toEqual([])
  })

  it('coming back opens the week it was left on', async () => {
    renderBidsAt('/bids?tab=day-book&dayb_from=2026-08-10&dayb_to=2026-08-16', 'dev')
    await waitFor(() => expect(stripButton('bid-board')).toBeTruthy())
    await pageAtRest()
    fireEvent.click(stripButton('estimators') as HTMLElement)
    await waitFor(() => expect(currentTab()).toBe('estimators'))
    expect(dayBookParams()).toEqual([])
    await pageAtRest()
    fireEvent.click(stripButton('day-book') as HTMLElement)
    await waitFor(() => expect(currentTab()).toBe('day-book'))
    await waitFor(() => expect(currentParam('dayb_from')).toBe('2026-08-10'))
    expect(currentParam('dayb_to')).toBe('2026-08-16')
  })

  it('a Day book link someone may not open lands on the board without its week', async () => {
    renderBidsAt('/bids?tab=day-book&dayb_from=2026-08-10&dayb_to=2026-08-16&dayb_person=u-1', 'estimator')
    await waitFor(() => expect(currentTab()).toBe('bid-board'))
    expect(dayBookParams()).toEqual([])
  })
})

/**
 * Edit Bid — the guard for punch list #51 (the Edit Bid controller moves out of the page).
 * What the page sends to `bids` when a bid is edited, closed, or created: recorded by the
 * stub, asserted exactly. These cases must pass before each of #51's moves and after it.
 */
describe('Bids page render smoke — Edit Bid writes', () => {
  const bidWrites = () => smoke.writes.filter((w) => w.table === 'bids')
  /**
   * A quirk pinned as it is (#51 must not change it): on a bid with no sent date, every Edit
   * Bid write also carries the eight sent-date stamps as null — the attestation merge answers
   * "cleared" for an empty date, and the prune does not drop columns that are not form fields.
   * Null over null; recorded on the #51 card.
   */
  const unsentStampNulls = { ...BID_DATE_SENT_ATTESTATION_NULLS }
  const projectName = () => document.getElementById('bid-form-project-name') as HTMLInputElement | null
  const bidWindowOpen = () => !!screen.queryByRole('button', { name: 'Close bid window' })

  /** Opens BID on the Bid window's Edit face and waits until the form holds the bid. */
  async function openBidOnEdit() {
    renderBidsAt('/bids?tab=bid-board&bidId=bid-1&openBidEdit=1', 'estimator', [BID])
    await waitFor(() => expect(projectName()?.value).toBe('Pondhill Building 2'))
    await pageAtRest()
    smoke.writes = []
  }

  /** Real timers for the page, fake ones for the debounce that starts after this call. */
  async function runTheDebounce(change: () => void) {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      change()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1300)
      })
    } finally {
      vi.useRealTimers()
    }
    await settle()
  }

  it('opening a bid and closing it untouched writes nothing', async () => {
    await openBidOnEdit()
    fireEvent.click(screen.getByRole('button', { name: 'Close bid window' }))
    await waitFor(() => expect(bidWindowOpen()).toBe(false))
    expect(bidWrites()).toEqual([])
  })

  it('a change saves itself after the pause — one update, that field only, on that bid', async () => {
    await openBidOnEdit()
    await runTheDebounce(() => fireEvent.change(projectName()!, { target: { value: 'Pondhill Building 3' } }))
    await waitFor(() => expect(bidWrites()).toHaveLength(1))
    expect(bidWrites()[0]).toEqual({ table: 'bids', op: 'update', payload: { project_name: 'Pondhill Building 3', ...unsentStampNulls }, filters: [['id', 'bid-1']] })
    expect(bidWindowOpen()).toBe(true)
  })

  it('closing inside the pause saves the change first, once, then closes', async () => {
    await openBidOnEdit()
    fireEvent.change(projectName()!, { target: { value: 'Pondhill Building 3' } })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Close bid window' }))
    await waitFor(() => expect(bidWindowOpen()).toBe(false))
    expect(bidWrites()).toEqual([{ table: 'bids', op: 'update', payload: { project_name: 'Pondhill Building 3', ...unsentStampNulls }, filters: [['id', 'bid-1']] }])
  })

  it('a refused write keeps the window open and says so; Close without saving closes it with no second write', async () => {
    await openBidOnEdit()
    smoke.refuseBidUpdates = true
    fireEvent.change(projectName()!, { target: { value: 'Pondhill Building 3' } })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Close bid window' }))
    expect(await screen.findByText(/Couldn’t save your latest changes/)).toBeTruthy()
    expect(bidWindowOpen()).toBe(true)
    expect(bidWrites().filter((w) => w.op === 'update')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close without saving' }))
    await waitFor(() => expect(bidWindowOpen()).toBe(false))
    await settle()
    expect(bidWrites().filter((w) => w.op === 'update')).toHaveLength(1)
  })

  it('a required field left blank holds the save — nothing is written, not even on close', async () => {
    await openBidOnEdit()
    await runTheDebounce(() => fireEvent.change(projectName()!, { target: { value: '' } }))
    expect(screen.getByText(/Required: Project Name/)).toBeTruthy()
    expect(bidWrites()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Close bid window' }))
    await waitFor(() => expect(bidWindowOpen()).toBe(false))
    expect(bidWrites()).toEqual([])
  })

  it('Delete bid: held until the project name is typed, then one delete of that bid and the window closes', async () => {
    await openBidOnEdit()
    fireEvent.click(screen.getByRole('button', { name: 'Delete bid…' }))
    const typed = await screen.findByPlaceholderText('Project name')
    const confirm = () => screen.getByRole('button', { name: 'Delete bid' }) as HTMLButtonElement
    expect(confirm().disabled).toBe(true)
    fireEvent.change(typed, { target: { value: 'Pondhill' } })
    expect(confirm().disabled).toBe(true)
    fireEvent.change(typed, { target: { value: 'Pondhill Building 2' } })
    expect(confirm().disabled).toBe(false)
    fireEvent.click(confirm())
    await waitFor(() => expect(bidWindowOpen()).toBe(false))
    expect(bidWrites()).toEqual([{ table: 'bids', op: 'delete', payload: undefined, filters: [['id', 'bid-1']] }])
  })

  it('Delete bid → Cancel writes nothing and leaves the bid open', async () => {
    await openBidOnEdit()
    fireEvent.click(screen.getByRole('button', { name: 'Delete bid…' }))
    fireEvent.change(await screen.findByPlaceholderText('Project name'), { target: { value: 'Pondhill Building 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await settle()
    expect(screen.queryByPlaceholderText('Project name')).toBeNull()
    expect(bidWindowOpen()).toBe(true)
    expect(bidWrites()).toEqual([])
  })

  it('Go/no-go: the checklist opens over the bid, starts empty every time, and writes nothing', async () => {
    await openBidOnEdit()
    const checklist = () => screen.queryByRole('heading', { name: 'Go/no-go checklist' })
    const boxes = () => screen.getAllByRole('checkbox', { name: /^(LOCATION|PAYMENT TERMS|BID DOCUMENTS|COMPETITION|STRENGTHS)$/ }) as HTMLInputElement[]
    fireEvent.click(screen.getByRole('button', { name: 'Go/no-go' }))
    expect(checklist()).toBeTruthy()
    expect(boxes().map((b) => b.checked)).toEqual([false, false, false, false, false])
    fireEvent.click(screen.getByRole('checkbox', { name: 'LOCATION' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'COMPETITION' }))
    expect(boxes().map((b) => b.checked)).toEqual([true, false, false, true, false])
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(checklist()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Go/no-go' }))
    expect(boxes().map((b) => b.checked)).toEqual([false, false, false, false, false])
    fireEvent.click(screen.getByRole('checkbox', { name: 'STRENGTHS' }))
    fireEvent.click(screen.getByRole('button', { name: '×' }))
    expect(checklist()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Go/no-go' }))
    expect(boxes().every((b) => !b.checked)).toBe(true)
    expect(bidWindowOpen()).toBe(true)
    expect(smoke.writes).toEqual([])
  })

  it('Open Counts on an open bid saves the pending change, closes, and lands on its Counts tab', async () => {
    await openBidOnEdit()
    fireEvent.change(projectName()!, { target: { value: 'Pondhill Building 3' } })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Open Counts' }))
    await waitFor(() => expect(currentTab()).toBe('counts'))
    await waitFor(() => expect(bidWindowOpen()).toBe(false))
    expect(currentParam('bidId')).toBe('bid-1')
    expect(bidWrites()).toEqual([{ table: 'bids', op: 'update', payload: { project_name: 'Pondhill Building 3', ...unsentStampNulls }, filters: [['id', 'bid-1']] }])
  })

  it('New Bid → Create and open counts inserts one bid and lands on Counts', async () => {
    renderBidsAt('/bids?tab=bid-board', 'estimator', [BID])
    await waitFor(() => expect(stripButton('bid-board')).toBeTruthy())
    await pageAtRest()
    smoke.writes = []
    fireEvent.click(screen.getByRole('button', { name: 'New Bid' }))
    await waitFor(() => expect(projectName()).toBeTruthy())
    fireEvent.change(projectName()!, { target: { value: 'Smoke Test Clinic' } })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Create and open counts' }))
    await waitFor(() => expect(currentTab()).toBe('counts'))
    expect(bidWrites().filter((w) => w.op === 'insert')).toHaveLength(1)
    expect(bidWrites().find((w) => w.op === 'insert')!.payload).toMatchObject({ project_name: 'Smoke Test Clinic', service_type_id: 'st-1', materials_model: 'rough' })
    expect(bidWrites().filter((w) => w.op === 'update')).toEqual([])
  })

  it('New Bid → Create bid inserts one bid in the picked trade, and updates nothing', async () => {
    renderBidsAt('/bids?tab=bid-board', 'estimator', [BID])
    await waitFor(() => expect(stripButton('bid-board')).toBeTruthy())
    await pageAtRest()
    smoke.writes = []
    fireEvent.click(screen.getByRole('button', { name: 'New Bid' }))
    await waitFor(() => expect(projectName()).toBeTruthy())
    fireEvent.change(projectName()!, { target: { value: 'Smoke Test Clinic' } })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Create bid' }))
    await waitFor(() => expect(bidWrites().filter((w) => w.op === 'insert')).toHaveLength(1))
    const insert = bidWrites().find((w) => w.op === 'insert')!
    expect(insert.payload).toMatchObject({ project_name: 'Smoke Test Clinic', service_type_id: 'st-1' })
    expect(bidWrites().filter((w) => w.op === 'update')).toEqual([])
  })
})
