/**
 * Shared setup for the render-smoke test harness (*.render.test.tsx files).
 *
 * These tests exist to catch crash-on-mount / undefined-destructure / missed-prop
 * regressions in the components extracted from Jobs.tsx (v2.820–v2.831) — they are
 * NOT behavior tests. Each test file opts into jsdom with the per-file
 * `// @vitest-environment jsdom` docblock so the global vitest environment stays
 * `node` for the pure-logic *.test.ts suite.
 *
 * Module-mocking pattern (vi.mock factories are hoisted, so they cannot reference
 * top-level imports directly — use a dynamic import inside the factory):
 *
 *   vi.mock('../../lib/supabase', async () => {
 *     const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
 *     return { supabase: makeSupabaseStub() }
 *   })
 *
 * THE RULE — settle before you assert. `renderWithProviders` resolves its mocks outside
 * `act`, so the moment a `findBy*` on a container resolves the component has painted ONCE,
 * with its effects, Suspense retries and effect-seeded state still pending. A synchronous
 * read or click on the next line races that work: it wins on an idle machine and loses under
 * a full suite or a busy merge queue (v2.3551, PR #3575, v2.3771 — three flakes, one shape).
 * So: assert on something the data load PRODUCES — a seeded value, a revealed pane, a
 * loaded marker — never on the line after `render()` or after a `findBy*` on a container.
 * `renderSettled(ui, { loaded })` is the easy path; `settle()` flushes pending work before a
 * click. Never widen a `waitFor` timeout to paper over it: wall time on a loaded machine
 * measures load, not code. `node scripts/render-smokes-settle.mjs` sweeps the pattern (v2.3855);
 * a read that means the FIRST paint opts out with `// first paint` on the line above it.
 */
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { act, render, type RenderResult } from '@testing-library/react'
import { ToastProvider } from '../contexts/ToastContext'
import { ConfirmDialogProvider } from '../contexts/ConfirmDialogContext'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { LaborJob } from '../types/laborJob'

type JobsLedgerInvoice = JobWithDetails['invoices'][number]

// ---------------------------------------------------------------------------
// Supabase client stub
// ---------------------------------------------------------------------------

/**
 * Chainable, thenable supabase query stub: every builder method returns the
 * builder again, and awaiting any point in the chain resolves
 * `{ data, error: null, count: 0 }` (`data` is `[]` for list endings and `null`
 * after `.single()` / `.maybeSingle()`). Covers `from().select().eq().order()…`,
 * `rpc()`, `auth.getSession()`, and `functions.invoke()` — enough for
 * mount-time effects to run without throwing.
 */
export function makeSupabaseStub() {
  function makeBuilder(single: boolean): Record<string, unknown> {
    const result = () => Promise.resolve({ data: single ? null : [], error: null, count: 0 })
    const builder: Record<string, unknown> = {}
    const chainMethods = [
      'select',
      'insert',
      'update',
      'upsert',
      'delete',
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'like',
      'ilike',
      'is',
      'in',
      'or',
      'not',
      'contains',
      'filter',
      'order',
      'range',
      'limit',
      'abortSignal',
    ]
    for (const m of chainMethods) {
      builder[m] = () => builder
    }
    builder.single = () => makeBuilder(true)
    builder.maybeSingle = () => makeBuilder(true)
    builder.csv = () => Promise.resolve({ data: '', error: null })
    builder.then = (
      onFulfilled?: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => result().then(onFulfilled, onRejected)
    builder.catch = (onRejected?: (e: unknown) => unknown) => result().catch(onRejected)
    builder.finally = (onFinally?: () => void) => result().finally(onFinally)
    return builder
  }
  return {
    from: () => makeBuilder(false),
    rpc: () => makeBuilder(false),
    functions: {
      invoke: () => Promise.resolve({ data: null, error: null }),
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
    // `.on()` returns the channel itself — real subscriptions chain several
    // postgres_changes listeners before `.subscribe()` (useJobThreadNotesForModal).
    channel: () => {
      const ch: Record<string, unknown> = {}
      ch.on = () => ch
      ch.subscribe = () => ch
      ch.unsubscribe = () => Promise.resolve('ok')
      return ch
    },
    removeChannel: () => {},
  }
}

// ---------------------------------------------------------------------------
// useAuth module stub
// ---------------------------------------------------------------------------

export const SMOKE_AUTH_USER_ID = 'smoke-auth-user-1'

/**
 * Replacement for the `useAuth` module: a signed-in dev user. Spread extra keys
 * over it if a test needs a different role. Mirrors the UseAuthReturn surface
 * loosely — components under smoke only read user / role / profileName /
 * loading-ish flags.
 */
export function makeUseAuthValue(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: SMOKE_AUTH_USER_ID, email: 'smoke@example.com' },
    session: null,
    role: 'dev',
    profileName: 'Smoke Dev',
    loading: false,
    readOnly: false,
    sessionExpiresAt: null,
    signOut: async () => {},
    ...overrides,
  }
}

/** Factory for `vi.mock('../../hooks/useAuth', …)`: useAuth() + passthrough AuthProvider. */
export function useAuthModuleMock(overrides: Record<string, unknown> = {}) {
  const value = makeUseAuthValue(overrides)
  return {
    useAuth: () => value,
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
}

// ---------------------------------------------------------------------------
// jsdom gap fills
// ---------------------------------------------------------------------------

/**
 * Fill jsdom API gaps the components touch on mount / focus flows:
 * `Element.scrollIntoView` (used by the Stages focus/flash effects) and
 * `window.matchMedia`. Call once per test file (top level or beforeAll).
 */
export function installDomShims() {
  if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
  if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
  }
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

/**
 * Render wrapped in MemoryRouter (for useNavigate / useSearchParams consumers)
 * and the real ToastProvider + ConfirmDialogProvider (useToastContext and
 * useConfirmDialog throw without one; the modal contexts return null without
 * a provider, which the components tolerate).
 */
export function renderWithProviders(ui: ReactElement): RenderResult {
  installDomShims()
  // All providers live in the wrapper (not in `ui`) so RenderResult.rerender
  // keeps them — the JobsStagesTab active-flip tests depend on that.
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ToastProvider>
        <ConfirmDialogProvider>
          <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {children}
          </MemoryRouter>
        </ConfirmDialogProvider>
      </ToastProvider>
    ),
  })
}

/**
 * Flush React's pending work — the effects a resolved mock queued, a lazy pane's Suspense
 * retry, the state an effect seeds — so the next read or click sees the settled tree. Use it
 * before a click that follows a container `findBy*` (the PR #3575 fix: the editors' mount-effect
 * reset landed after the click's `setOpen(true)`, and the box never opened).
 */
export async function settle(): Promise<void> {
  await act(async () => {})
}

export interface RenderSettledOptions<T> {
  /**
   * The state the data load produces: a `findBy*` on a value the load paints, a `waitFor` on a
   * seeded field, the loaded markers a sibling test awaits — anything that resolves only once
   * the component is past its first-load cascade. Its value comes back as `loaded`.
   */
  loaded: (result: RenderResult) => Promise<T> | T
}

/**
 * `renderWithProviders`, then `settle()`, then `await` the caller's `loaded` marker — so
 * "wait for the state, not the container" is the one-line path. Returns the render result with
 * the marker's value on `loaded`.
 */
export async function renderSettled<T = unknown>(ui: ReactElement, { loaded }: RenderSettledOptions<T>): Promise<RenderResult & { loaded: T }> {
  const result = renderWithProviders(ui)
  await settle()
  const value = await loaded(result)
  return Object.assign(result, { loaded: value })
}

// ---------------------------------------------------------------------------
// Fixtures (house factory style — see src/lib/jobs/invoiceBilling.test.ts)
// ---------------------------------------------------------------------------

let fixtureSeq = 0

/** Minimal jobs_ledger_invoices row; spread overrides for the fields under test. */
export function makeInvoice(p: Partial<Record<string, unknown>> = {}): JobsLedgerInvoice {
  fixtureSeq += 1
  return {
    id: `inv-${fixtureSeq}`,
    job_id: 'job-1',
    amount: 100,
    sequence_order: 0,
    status: 'ready_to_bill',
    estimated_bill_date: null,
    billed_at: null,
    external_send_channel: null,
    stripe_invoice_id: null,
    sent_to_customer_at: null,
    is_primary_rtb_bundle: false,
    created_at: '2026-07-01T00:00:00Z',
    ...p,
  } as unknown as JobsLedgerInvoice
}

/** Minimal JobWithDetails; spread overrides for the fields under test. */
export function makeJob(p: Partial<Record<string, unknown>> = {}): JobWithDetails {
  fixtureSeq += 1
  return {
    id: `job-${fixtureSeq}`,
    hcp_number: `${1000 + fixtureSeq}`,
    click_number: null,
    job_name: `Job ${fixtureSeq}`,
    job_address: '123 Main St, Austin, TX 78701',
    status: 'working',
    revenue: 1000,
    payments_made: 0,
    pct_complete: null,
    customer_id: null,
    customer_name: null,
    master_user_id: SMOKE_AUTH_USER_ID,
    project_id: null,
    project: null,
    bid_id: null,
    google_drive_link: null,
    job_plans_link: null,
    job_pictures_link: null,
    fixtures: [],
    materials: [],
    payments: [],
    invoices: [],
    team_members: [],
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...p,
  } as unknown as JobWithDetails
}

/** Team-member join row for JobWithDetails.team_members. */
export function makeTeamMember(userId: string, name: string): JobWithDetails['team_members'][number] {
  return { user_id: userId, users: { name } } as unknown as JobWithDetails['team_members'][number]
}

/** Minimal Sub Labor ledger row (people_labor_jobs shape used by the form modal). */
export function makeLaborJob(p: Partial<LaborJob> = {}): LaborJob {
  fixtureSeq += 1
  return {
    id: `labor-${fixtureSeq}`,
    assigned_to_name: 'Sub Sam',
    address: '500 Oak Ln, Austin, TX',
    job_number: 'HCP-77',
    labor_rate: 20,
    job_date: '2026-07-10',
    created_at: '2026-07-01T00:00:00Z',
    distance_miles: 12,
    invoice_link: null,
    items: [
      {
        fixture: 'Toilet',
        count: 2,
        hrs_per_unit: 1.5,
        is_fixed: false,
        labor_rate: 20,
        direct_labor_amount: null,
      },
    ],
    payments: [],
    ...p,
  }
}
