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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ToastProvider } from '../contexts/ToastContext'
import { ConfirmDialogProvider } from '../contexts/ConfirmDialogContext'
import { ThemeProvider } from '../contexts/ThemeContext'

const smoke = vi.hoisted(() => ({ role: 'dev' as string }))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const generic = makeSupabaseStub()

  /** Chainable builder that resolves `rows` (list) / `rows[0] ?? null` (single). */
  function makeTableBuilder(rows: () => Array<Record<string, unknown>>): Record<string, unknown> {
    const build = (single: boolean): Record<string, unknown> => {
      const result = () => Promise.resolve({ data: single ? (rows()[0] ?? null) : rows(), error: null, count: rows().length })
      const b: Record<string, unknown> = {}
      for (const m of [
        'select', 'insert', 'update', 'upsert', 'delete',
        'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
        'is', 'in', 'or', 'not', 'contains', 'filter',
        'order', 'range', 'limit', 'abortSignal',
      ]) {
        b[m] = () => b
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
      role: smoke.role,
      estimator_service_type_ids: null,
      primary_service_type_ids: null,
      superintendent_service_type_ids: null,
    }],
    service_types: () => [{ id: 'st-1', name: 'Plumbing', sequence_order: 1 }],
  }

  return {
    supabase: {
      ...generic,
      from: (table: string) => {
        const rows = TABLE_ROWS[table]
        return rows ? makeTableBuilder(rows) : (generic.from as () => unknown)()
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

function renderBidsAt(url: string, role: string) {
  smoke.role = role
  installDomShims()
  installCssEscapeShim()
  return render((<><Bids /><LocationProbe /></>) as ReactElement, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider>
        <ToastProvider>
          <ConfirmDialogProvider>
            <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
