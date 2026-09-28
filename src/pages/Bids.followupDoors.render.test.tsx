// @vitest-environment jsdom
/**
 * The doors into Submission & Followup that never pass through the URL router: the Bid
 * Board's Last contact cell and the By builder lens's "View submissions" glass. Both set the
 * tab by state, so the router's role gate (`resolveBidsTabRoute`) never sees them — the page
 * hands each door to its child only when `bidsTabOpenFor('submission-followup', role)` says
 * the tab stands. What a role may open is `lib/bids/bidsTabAccess` (its matrix test pins the
 * rule); this pins that the two doors follow it.
 *
 * The supabase stub is table-aware, like the Materials page smoke: the page reads its role
 * from a `users.single()` SELECT on mount, and one bid under one builder gives both children
 * a row to draw.
 */
import type { ReactElement, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../contexts/ToastContext'
import { ConfirmDialogProvider } from '../contexts/ConfirmDialogContext'
import { ThemeProvider } from '../contexts/ThemeContext'

const smoke = vi.hoisted(() => ({ role: 'dev' as string }))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub, SMOKE_AUTH_USER_ID } = await import('../test/renderSmokeMocks')
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

  const builder = { id: 'gc-knight', name: 'Knight Contracting', master_user_id: SMOKE_AUTH_USER_ID, contact_info: null, address: null }

  const TABLE_ROWS: Record<string, () => Array<Record<string, unknown>>> = {
    users: () => [{
      role: smoke.role,
      estimator_service_type_ids: null,
      primary_service_type_ids: null,
      superintendent_service_type_ids: null,
    }],
    service_types: () => [{ id: 'st-1', name: 'Plumbing', sequence_order: 1 }],
    customers: () => [builder],
    bids: () => [{
      id: 'bid-1',
      bid_number: '482',
      project_name: 'Jakes Burgers',
      bid_value: 100000,
      outcome: null,
      bid_due_date: '2026-08-01',
      bid_date_sent: '2026-08-01',
      last_contact: '2026-08-10T15:00:00Z',
      customer_id: builder.id,
      gc_builder_id: null,
      service_type_id: 'st-1',
      estimator_id: SMOKE_AUTH_USER_ID,
      account_manager_id: null,
      created_by: SMOKE_AUTH_USER_ID,
      adopted_into_bid_id: null,
      customers: builder,
      bids_gc_builders: null,
      estimator: null,
      account_manager: null,
      service_type: { id: 'st-1', name: 'Plumbing', color: null },
    }],
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
import { bidsTabOpenFor } from '../lib/bids/bidsTabAccess'
import { followupLensCaption } from '../lib/bids/bidsLenses'

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
  return render((<Bids />) as ReactElement, {
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
})

const BIDS_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'] as const

const lastContactDoors = () => screen.queryAllByRole('button', { name: /8\/10/ })
const viewSubmissionsDoors = () => screen.queryAllByTitle('View submissions')
const onByStatus = () => screen.queryByText(followupLensCaption('submission-followup')) != null

/** The page past its role load, the seeded bid drawn. */
async function landOnBoard(role: string) {
  renderBidsAt('/bids?tab=bid-board', role)
  await waitFor(() => expect(document.querySelector('[data-tabkey="bid-board"]')).toBeTruthy())
  await waitFor(() => expect(screen.getAllByText(/Jakes Burgers/).length).toBeGreaterThan(0))
  await settle()
}

describe('Bids — the Bid Board’s Last contact door', () => {
  it.each(BIDS_ROLES)('%s: the door is drawn only when By status stands for the role', async (role) => {
    await landOnBoard(role)
    // The date is what the row knows; every role that reads the board reads it.
    expect(screen.getAllByText(/8\/10/).length).toBeGreaterThan(0)
    const doors = lastContactDoors()
    if (!bidsTabOpenFor('submission-followup', role)) {
      expect(doors).toHaveLength(0)
      return
    }
    expect(doors.length).toBeGreaterThan(0)
    fireEvent.click(doors[0]!)
    await waitFor(() => expect(onByStatus()).toBe(true))
  })

  it('a primary and a superintendent are the two roles it is closed to', () => {
    expect(BIDS_ROLES.filter((role) => !bidsTabOpenFor('submission-followup', role))).toEqual(['primary', 'superintendent'])
  })
})

describe('Bids — the By builder lens’s View submissions door', () => {
  it.each(BIDS_ROLES.filter((role) => bidsTabOpenFor('builder-review', role)))('%s: the glass is drawn only when By status stands for the role', async (role) => {
    renderBidsAt('/bids?tab=builder-review', role)
    await waitFor(() => expect(screen.getByText(followupLensCaption('builder-review'))).toBeTruthy())
    await waitFor(() => expect(screen.getAllByText(/Jakes Burgers/).length).toBeGreaterThan(0))
    await settle()
    const doors = viewSubmissionsDoors()
    if (!bidsTabOpenFor('submission-followup', role)) {
      expect(doors).toHaveLength(0)
      return
    }
    expect(doors.length).toBeGreaterThan(0)
    fireEvent.click(doors[0]!)
    await waitFor(() => expect(onByStatus()).toBe(true))
  })
})
