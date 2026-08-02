// @vitest-environment jsdom
/**
 * Render-smoke tests for the Materials page — the safety net for the
 * Materials.tsx decomposition (see docs/MATERIALS_TABS_ARCHITECTURE.md and
 * docs/PAGE_DECOMPOSITION_PLAYBOOK.md).
 *
 * These pin crash-on-mount behavior for every tab × role combination BEFORE any
 * extraction moves code around: each test deep-links to a tab via `?tab=` and
 * asserts a distinctive anchor renders (or that the role-gate redirect/denial
 * fires). They are NOT behavior tests.
 *
 * The supabase stub here is table-aware (unlike the generic makeSupabaseStub):
 * Materials derives `myRole` from a `users.single()` SELECT on mount, and the
 * tab gates/URL guard all key off that role, so the stub must answer that one
 * query with a real row. `service_types` returns one row so the master
 * service-type scope resolves and the common-loader cascade runs (against
 * empty-list stub responses) exactly as on a fresh account.
 */
import type { ReactElement, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../contexts/ToastContext'

// Mutable holder the hoisted vi.mock factory can close over: tests flip the
// role between renders (vi.mock factories cannot reference other top-levels).
const smoke = vi.hoisted(() => ({ role: 'dev' as string }))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const generic = makeSupabaseStub()

  /** Chainable builder that resolves `rows` (list) / `rows[0] ?? null` (single). */
  function makeTableBuilder(rows: () => Array<Record<string, unknown>>): Record<string, unknown> {
    const build = (single: boolean): Record<string, unknown> => {
      const result = () =>
        Promise.resolve({
          data: single ? (rows()[0] ?? null) : rows(),
          error: null,
          count: rows().length,
        })
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

import Materials from './Materials'
import { installDomShims } from '../test/renderSmokeMocks'

/** Render Materials at a specific URL (the page reads `?tab=` via useSearchParams). */
function renderMaterialsAt(url: string, role: string) {
  smoke.role = role
  installDomShims()
  return render(<Materials /> as ReactElement, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ToastProvider>
        <MemoryRouter
          initialEntries={[url]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          {children}
        </MemoryRouter>
      </ToastProvider>
    ),
  })
}

// Distinctive per-tab anchors (placeholders/buttons unique to each tab's JSX).
const PARTS_BOOK_ANCHOR = 'Search parts...'
const ASSEMBLY_BOOK_ANCHOR = 'Search assemblies by name, description, or type...'
const PO_BUILDER_ANCHOR = 'Search assemblies by name or description…'
const PURCHASE_ORDERS_ANCHOR = 'Search purchase orders...'
const PO_GENERATOR_ANCHOR = 'Search by HCP #, job name, or address…'
const SUPPLY_HOUSES_ANCHOR = 'Add Supply House'

describe('Materials page render smoke — dev sees every tab', () => {
  it('mounts the default Parts Book tab with all six tab buttons', async () => {
    renderMaterialsAt('/materials', 'dev')
    expect(await screen.findByPlaceholderText(PARTS_BOOK_ANCHOR)).toBeTruthy()
    for (const label of ['Parts Book', 'Assembly Book', 'PO Builder', 'Purchase Orders', 'PO Generator']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    // Two "Supply Houses" buttons on this tab: the tab button + the legacy
    // Parts Book toolbar modal opener (preserve-quirk #16).
    expect(screen.getAllByRole('button', { name: 'Supply Houses' }).length).toBe(2)
  })

  it('mounts Assembly Book via ?tab=assembly-book', async () => {
    renderMaterialsAt('/materials?tab=assembly-book', 'dev')
    expect(await screen.findByPlaceholderText(ASSEMBLY_BOOK_ANCHOR)).toBeTruthy()
  })

  it('mounts PO Builder via ?tab=assemblies-po', async () => {
    renderMaterialsAt('/materials?tab=assemblies-po', 'dev')
    expect(await screen.findByPlaceholderText(PO_BUILDER_ANCHOR)).toBeTruthy()
  })

  it('mounts Purchase Orders via ?tab=purchase-orders', async () => {
    renderMaterialsAt('/materials?tab=purchase-orders', 'dev')
    expect(await screen.findByPlaceholderText(PURCHASE_ORDERS_ANCHOR)).toBeTruthy()
  })

  it('mounts PO Generator via ?tab=po-generator', async () => {
    renderMaterialsAt('/materials?tab=po-generator', 'dev')
    expect(await screen.findByPlaceholderText(PO_GENERATOR_ANCHOR)).toBeTruthy()
  })

  it('mounts the extracted Supply Houses tab via ?tab=supply-houses', async () => {
    renderMaterialsAt('/materials?tab=supply-houses', 'dev')
    expect(await screen.findByText(SUPPLY_HOUSES_ANCHOR)).toBeTruthy()
  })

  it('rewrites the legacy ?tab=price-book slug to Parts Book', async () => {
    renderMaterialsAt('/materials?tab=price-book', 'dev')
    expect(await screen.findByPlaceholderText(PARTS_BOOK_ANCHOR)).toBeTruthy()
  })
})

describe('Materials page render smoke — role gating', () => {
  it('estimator: no Supply Houses / PO Generator tab buttons; Parts Book renders', async () => {
    renderMaterialsAt('/materials', 'estimator')
    expect(await screen.findByPlaceholderText(PARTS_BOOK_ANCHOR)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'PO Generator' })).toBeNull()
    // Only the legacy toolbar modal opener remains — the tab button is hidden.
    expect(screen.getAllByRole('button', { name: 'Supply Houses' }).length).toBe(1)
    expect(screen.getByRole('button', { name: 'PO Builder' })).toBeTruthy()
  })

  it('estimator: ?tab=supply-houses redirects to Parts Book', async () => {
    renderMaterialsAt('/materials?tab=supply-houses', 'estimator')
    expect(await screen.findByPlaceholderText(PARTS_BOOK_ANCHOR)).toBeTruthy()
    expect(screen.queryByText(SUPPLY_HOUSES_ANCHOR)).toBeNull()
  })

  it('primary: only Parts Book + Assembly Book tabs; ?tab=purchase-orders redirects', async () => {
    renderMaterialsAt('/materials?tab=purchase-orders', 'primary')
    expect(await screen.findByPlaceholderText(PARTS_BOOK_ANCHOR)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'PO Builder' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Purchase Orders' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Assembly Book' })).toBeTruthy()
  })

  it('technician: access denied', async () => {
    renderMaterialsAt('/materials', 'technician')
    expect(await screen.findByText(/Access denied/)).toBeTruthy()
  })
})
