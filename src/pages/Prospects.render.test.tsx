// @vitest-environment jsdom
/**
 * Render smoke for the Prospects page — the safety net for the cuts in docs/PROSPECTS_TABS_ARCHITECTURE.md.
 * It mounts the page at an address against a stateful Supabase stand-in and reads what a caller sees: which
 * tab and lane the address opens for each role, the card and its queue, what an outcome press writes and which
 * card comes up next, a run, the list, Convert, Activity, and the windows. The Hiring board and the Permits
 * tab are stubbed: each loads its own data and has its own tests. Not a test of every region.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ToastProvider } from '../contexts/ToastContext'
import { ConfirmDialogProvider } from '../contexts/ConfirmDialogContext'

type Row = Record<string, unknown>
type Step = { method: string; args: unknown[] }
type Write = { table: string; method: string; payload: unknown; filters: Record<string, unknown> }

const world = vi.hoisted(() => ({
  role: 'dev' as string | null,
  estimatorProspectsAccess: false,
  teamProspectsAccess: true,
  hiringShares: [] as string[],
  prospects: [] as Array<Record<string, unknown>>,
  comments: [] as Array<Record<string, unknown>>,
  jobs: [] as Array<Record<string, unknown>>,
  timerEvents: [] as Array<Record<string, unknown>>,
  appSettings: [] as Array<Record<string, unknown>>,
  /** Calling locks on record. A live one held by somebody else hides its prospect from the deck. */
  locks: [] as Array<Record<string, unknown>>,
  /** A prospect's Messages thread: the contact that points at it, and that contact's numbers. */
  contacts: [] as Array<Record<string, unknown>>,
  channels: [] as Array<Record<string, unknown>>,
  /** The Subs Board's pins: one row a company a trade. */
  ranks: [] as Array<Record<string, unknown>>,
  writes: [] as Array<{ table: string; method: string; payload: unknown; filters: Record<string, unknown> }>,
  invokes: [] as Array<{ name: string; body: unknown }>,
  /** The GC board's read: null refuses it (the lanes then draw without their strips). */
  gcBoard: null as null | Record<string, unknown>,
  gcProjects: [] as Array<Record<string, unknown>>,
  /** The Project Board's read fails (the Jobs to GC strip says so). */
  gcProjectsRefused: false,
  nextId: 1,
}))

vi.mock('../lib/supabase', () => {
  const has = (steps: Step[], m: string) => steps.some((s) => s.method === m)
  const arg = (steps: Step[], m: string, i = 0) => steps.find((s) => s.method === m)?.args[i]
  const eqs = (steps: Step[]) => Object.fromEntries(steps.filter((s) => s.method === 'eq').map((s) => [String(s.args[0]), s.args[1]]))
  const inList = (steps: Step[], col: string) => steps.find((s) => s.method === 'in' && s.args[0] === col)?.args[1] as unknown[] | undefined

  function answer(table: string, steps: Step[]): { data: unknown; error: { message: string } | null } {
    const single = has(steps, 'single') || has(steps, 'maybeSingle')
    const list = (rows: Row[]) => ({ data: single ? (rows[0] ?? null) : rows, error: null })
    const filters = eqs(steps)
    for (const m of ['insert', 'update', 'delete', 'upsert']) {
      if (!has(steps, m)) continue
      const payload = arg(steps, m)
      world.writes.push({ table, method: m, payload, filters })
      if (table === 'prospects' && m === 'update') {
        world.prospects = world.prospects.map((p) => (p.id === filters.id ? { ...p, ...(payload as Row) } : p))
      }
      if (table === 'prospects' && m === 'delete') {
        world.prospects = world.prospects.filter((p) => p.id !== filters.id)
      }
      if (table === 'prospects' && m === 'insert') {
        const row = { id: `new-${world.nextId++}`, prospect_fit_status: null, last_contact: null, created_at: '2026-10-16T12:00:00Z', ...(payload as Row) }
        world.prospects = [...world.prospects, row]
        return list([row])
      }
      if (table === 'prospect_comments' && m === 'insert') {
        const row = { id: `c-${world.nextId++}`, created_at: new Date().toISOString(), created_by_user: { name: 'Pat Office', email: 'pat@example.test' }, ...(payload as Row) }
        world.comments = [row, ...world.comments]
        return list([row])
      }
      if (table === 'customers' && m === 'insert') return list([{ id: 'cust-new', ...(payload as Row) }])
      if (table === 'prospect_jobs' && m === 'insert') {
        const row = { id: `j-${world.nextId++}`, won_by: null, created_at: '2026-10-16T12:00:00Z', ...(payload as Row) }
        world.jobs = [...world.jobs, row]
        return list([row])
      }
      if (table === 'prospect_jobs' && m === 'update') {
        world.jobs = world.jobs.map((j) => (j.id === filters.id ? { ...j, ...(payload as Row) } : j))
        return list(world.jobs.filter((j) => j.id === filters.id))
      }
      if (table === 'prospect_jobs' && m === 'delete') world.jobs = world.jobs.filter((j) => j.id !== filters.id)
      if (table === 'prospect_calling_locks' && m === 'upsert') world.locks = [...world.locks.filter((l) => l.prospect_id !== (payload as Row).prospect_id), payload as Row]
      if (table === 'prospect_calling_locks' && m === 'delete') world.locks = world.locks.filter((l) => !(l.prospect_id === filters.prospect_id && l.user_id === filters.user_id))
      return { data: null, error: null }
    }
    switch (table) {
      case 'prospects': {
        let rows = world.prospects
        if (filters.kind) rows = rows.filter((p) => p.kind === filters.kind)
        if (filters.id) rows = rows.filter((p) => p.id === filters.id)
        if (has(steps, 'or')) rows = rows.filter((p) => p.prospect_fit_status !== 'not_a_fit')
        const notIn = steps.find((st) => st.method === 'not' && st.args[0] === 'id' && st.args[1] === 'in')?.args[2]
        if (typeof notIn === 'string') rows = rows.filter((p) => !notIn.slice(1, -1).split(',').includes(String(p.id)))
        return list(rows)
      }
      case 'prospect_comments': {
        let rows = world.comments
        if (filters.prospect_id) rows = rows.filter((c) => c.prospect_id === filters.prospect_id)
        const kinds = inList(steps, 'interaction_type')
        if (kinds) rows = rows.filter((c) => kinds.includes(c.interaction_type))
        return list(rows)
      }
      case 'prospect_jobs': {
        const ids = inList(steps, 'prospect_id')
        return list(ids ? world.jobs.filter((j) => ids.includes(j.prospect_id)) : world.jobs)
      }
      case 'prospect_timer_events':
        return list(world.timerEvents)
      case 'app_settings':
        return list(world.appSettings)
      case 'prospect_calling_locks': {
        const notMine = steps.find((st) => st.method === 'neq' && st.args[0] === 'user_id')?.args[1]
        let rows = world.locks
        if (notMine) rows = rows.filter((l) => l.user_id !== notMine)
        if (filters.prospect_id) rows = rows.filter((l) => l.prospect_id === filters.prospect_id)
        return list(rows)
      }
      case 'prospect_trade_ranks':
        return list(world.ranks)
      case 'contacts':
        return list(filters.prospect_id ? world.contacts.filter((c) => c.prospect_id === filters.prospect_id) : world.contacts)
      case 'contact_channels':
        return list(world.channels.filter((c) => c.contact_id === filters.contact_id))
      case 'users':
        if (filters.id) return list([{ id: 'smoke-auth-user-1', name: 'Pat Office', email: 'pat@example.test', phone: '555-0199', role: world.role }])
        return list([{ id: 'smoke-auth-user-1', name: 'Pat Office', email: 'pat@example.test', role: world.role }])
      case 'service_types':
        return list([{ id: 'st-1', name: 'Plumbing' }])
      default:
        return list([])
    }
  }

  function chain(table: string) {
    const steps: Step[] = []
    const p: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(answer(table, steps))
          return (...a: unknown[]) => {
            steps.push({ method: String(prop), args: a })
            return p
          }
        },
      },
    )
    return p
  }

  return {
    supabase: {
      from: (table: string) => chain(table),
      rpc: (name: string) => chain(`rpc:${name}`),
      functions: {
        invoke: async (name: string, opts: { body?: unknown } = {}) => {
          world.invokes.push({ name, body: opts.body })
          return { data: { ok: true }, error: null }
        },
      },
      auth: {
        getUser: async () => ({ data: { user: { id: 'smoke-auth-user-1' } }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      },
    },
  }
})

vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  const value = () => ({
    ...makeUseAuthValue(),
    role: world.role,
    estimatorProspectsAccess: world.estimatorProspectsAccess,
    teamProspectsAccess: world.teamProspectsAccess,
  })
  return { useAuth: value, useOptionalAuth: value, AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }
})

vi.mock('../hooks/useMyHiringShares', () => ({
  useMyHiringShares: () => ({ sharedRoleIds: world.hiringShares, loading: false }),
}))

vi.mock('../components/prospects/TeamProspectsTab', () => ({
  default: (props: { shared: boolean }) => <div data-testid="hiring-tab" data-shared={String(props.shared)} />,
}))

vi.mock('../components/prospects/ProspectsResearchTab', () => ({
  ProspectsResearchTab: () => <div data-testid="permits-tab" />,
}))

vi.mock('../lib/gc/gcIo', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return {
    ...real,
    loadGcProjects: async () => {
      if (world.gcProjectsRefused) throw new Error('refused')
      return world.gcProjects
    },
    loadGcBoardRows: async () => {
      if (!world.gcBoard) throw new Error('refused')
      return world.gcBoard
    },
    addGcCompany: async () => 'company-new',
    askGcCompanies: async () => [],
  }
})

import Prospects from './Prospects'
import { installDomShims, settle } from '../test/renderSmokeMocks'

function prospect(id: string, kind: 'customer' | 'gc_lead' | 'sub', company: string, extra: Row = {}): Row {
  return {
    id,
    master_user_id: 'owner-1',
    created_by: 'smoke-auth-user-1',
    warmth_count: 0,
    prospect_fit_status: null,
    company_name: company,
    contact_name: 'Pat Sample',
    phone_number: '555-0100',
    email: 'pat@example.test',
    address: '1 Test St',
    links_to_website: null,
    notes: null,
    last_contact: null,
    created_at: '2026-10-01T12:00:00Z',
    updated_at: null,
    kind,
    source: null,
    trades: kind === 'sub' ? ['Concrete'] : [],
    max_miles: null,
    lang: 'en',
    company_role: null,
    customer_id: null,
    converted_customer_id: null,
    converted_gc_company_id: null,
    is_person: false,
    contact_title: null,
    contact_phone: null,
    ok_to_text: 'not_asked',
    maps_url: null,
    license: null,
    also_reach: null,
    priority: null,
    ...extra,
  }
}

function seed() {
  world.role = 'dev'
  world.estimatorProspectsAccess = false
  world.teamProspectsAccess = true
  world.hiringShares = []
  world.prospects = [
    prospect('cu-1', 'customer', 'Alpha Builders', { last_contact: '2026-09-01T12:00:00Z' }),
    prospect('cu-2', 'customer', 'Bravo Homes', { last_contact: '2026-09-10T12:00:00Z' }),
    prospect('cu-3', 'customer', 'Charlie Group', { last_contact: '2026-09-20T12:00:00Z' }),
    prospect('cu-4', 'customer', 'Delta Gone', { prospect_fit_status: 'cant_reach' }),
    prospect('gc-1', 'gc_lead', 'Echo Owner', { last_contact: '2026-09-01T12:00:00Z', company_role: 'owner' }),
    prospect('gc-2', 'gc_lead', 'Foxtrot Developer', { last_contact: '2026-09-10T12:00:00Z', company_role: 'developer' }),
    prospect('su-1', 'sub', 'Golf Concrete', { last_contact: '2026-09-01T12:00:00Z' }),
    prospect('su-2', 'sub', 'Hotel Concrete', { last_contact: '2026-09-10T12:00:00Z' }),
    prospect('su-3', 'sub', 'India Framing', { last_contact: '2026-09-20T12:00:00Z', trades: ['Framing'] }),
  ]
  world.comments = [{ id: 'c-0', prospect_id: 'cu-2', created_by: 'smoke-auth-user-1', created_at: '2026-09-10T12:00:00Z', comment_text: 'Talked about the next set of plans', interaction_type: 'answered', created_by_user: { name: 'Pat Office', email: 'pat@example.test' } }]
  world.jobs = []
  world.timerEvents = []
  world.appSettings = [{ key: 'prospect_copy_no_response_email', value_text: 'Hello [company name], this is [User name].' }]
  world.locks = []
  world.contacts = []
  world.channels = []
  world.ranks = []
  world.writes = []
  world.invokes = []
  world.gcBoard = null
  world.gcProjects = []
  world.gcProjectsRefused = false
  world.nextId = 1
}

function Where() {
  const loc = useLocation()
  return <span data-testid="where">{loc.pathname + loc.search}</span>
}

function open(route: string) {
  installDomShims()
  return render(
    <>
      <Prospects />
      <Where />
    </>,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ToastProvider>
          <ConfirmDialogProvider>
            {/* The app's own router keeps v7_startTransition off (src/main.tsx): with it on, the address and the page's tab state commit in two renders, and the list's jump to a card loses its prospect. */}
            <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: false, v7_relativeSplatPath: true }}>
              {children}
            </MemoryRouter>
          </ConfirmDialogProvider>
        </ToastProvider>
      ),
    },
  )
}

const where = () => screen.getByTestId('where').textContent ?? ''
const writesTo = (table: string, method?: string): Write[] => world.writes.filter((w) => w.table === table && (!method || w.method === method))

beforeEach(() => {
  seed()
  window.localStorage.clear()
})
afterEach(() => cleanup())

/** The deck is up: the card's outcome row is drawn, and the effects its load queued have run. */
async function deck(route: string) {
  const r = open(route)
  await screen.findByText('How did the call end?')
  await settle()
  return r
}
/** The company on the card, read off the queue rail's row that says it is yours. */
const onCard = () => screen.getByText('← you').closest('button')?.textContent ?? ''
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('the address picks the tab and the lane (dev)', () => {
  it('with no tab named, lands on Follow Up on the Customers lane and writes the tab into the address', async () => {
    await deck('/prospects')
    expect(where()).toBe('/prospects?tab=follow-up')
    expect(onCard()).toContain('Alpha Builders')
    expect(screen.getByRole('button', { name: 'Convert' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Board' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Converted ✓' })).toBeTruthy()
  })

  it.each([
    ['/prospects?tab=follow-up', 'How did the call end?'],
    ['/prospects?tab=follow-up&kind=gc-leads', 'GC work in flight'],
    ['/prospects?tab=follow-up&kind=subs', 'What GC mode needs right now'],
    ['/prospects?tab=board&kind=subs', 'Call the 2 here →'],
    ['/prospects?tab=prospect-list', 'Never called (2)'],
    ['/prospects?tab=prospect-list&kind=gc-leads', 'Never called (2)'],
    ['/prospects?tab=prospect-list&kind=subs', 'Call for Concrete →'],
    ['/prospects?tab=convert', 'Who are you converting?'],
    ['/prospects?tab=activity', 'Marked / Updated by day — last 30 days'],
    ['/prospects?tab=activity&kind=gc-leads', 'Source success — Jobs to GC, every row of the lane'],
    ['/prospects?tab=activity&kind=subs', 'Source success — Subs, every row of the lane'],
  ])('%s draws its own tab', async (route, marker) => {
    open(route)
    expect(await screen.findByText(marker)).toBeTruthy()
    expect(where()).toBe(route)
  })

  it.each([
    ['/prospects?tab=board', '/prospects?tab=follow-up'],
    ['/prospects?tab=board&kind=gc-leads', '/prospects?tab=follow-up&kind=gc-leads'],
    ['/prospects?tab=convert&kind=subs', '/prospects?tab=follow-up&kind=subs'],
    ['/prospects?tab=convert&kind=gc-leads', '/prospects?tab=follow-up&kind=gc-leads'],
  ])('%s is not that lane’s tab, so it opens Follow Up', async (route, lands) => {
    await deck(route)
    expect(where()).toBe(lands)
  })

  it.each([
    ['/prospects?tab=subs', '/prospects?tab=follow-up&kind=subs', 'Add to the bench ✓'],
    ['/prospects?tab=gc-leads', '/prospects?tab=follow-up&kind=gc-leads', 'Asked us ✓'],
  ])('the door %s names the lane and lands on its deck', async (route, lands, lastPress) => {
    await deck(route)
    expect(where()).toBe(lands)
    expect(screen.getByRole('button', { name: lastPress })).toBeTruthy()
  })

  it('Hiring and Permits each draw their own component, and the old Research key is rewritten', async () => {
    const hiring = open('/prospects?tab=team')
    expect((await screen.findByTestId('hiring-tab')).getAttribute('data-shared')).toBe('false')
    expect(screen.queryByText('How did the call end?')).toBeNull()
    hiring.unmount()
    open('/prospects?tab=research')
    expect(await screen.findByTestId('permits-tab')).toBeTruthy()
    await waitFor(() => expect(where()).toBe('/prospects?tab=permits'))
  })

  it('the lane pills move the deck to another kind and keep the sub-tab', async () => {
    await deck('/prospects?tab=follow-up')
    press('Subs')
    await screen.findByRole('button', { name: 'Add to the bench ✓' })
    expect(where()).toBe('/prospects?tab=follow-up&kind=subs')
    expect(onCard()).toContain('Golf Concrete')
    press('Board')
    await screen.findByText('Call the 2 here →')
    press('Jobs to GC')
    await screen.findByRole('button', { name: 'Asked us ✓' })
    expect(where()).toBe('/prospects?tab=follow-up&kind=gc-leads')
    press('Customers')
    await screen.findByRole('button', { name: 'Converted ✓' })
    expect(where()).toBe('/prospects?tab=follow-up')
  })
})

describe('who may open what', () => {
  it.each(['master_technician', 'assistant', 'controller'])('%s works the deck', async (role) => {
    world.role = role
    await deck('/prospects')
    expect(onCard()).toContain('Alpha Builders')
    expect(screen.getByRole('button', { name: 'New Prospect' })).toBeTruthy()
  })

  it('Activity shows to dev and the assistant-like, and anyone else is sent to Follow Up', async () => {
    world.role = 'assistant'
    const a = open('/prospects?tab=activity')
    expect(await screen.findByText('Marked / Updated by day — last 30 days')).toBeTruthy()
    a.unmount()
    world.role = 'master_technician'
    await deck('/prospects?tab=activity')
    expect(where()).toBe('/prospects?tab=follow-up')
    expect(screen.queryByRole('button', { name: 'Activity' })).toBeNull()
  })

  it('an estimator with the Prospects flag works the deck', async () => {
    world.role = 'estimator'
    world.estimatorProspectsAccess = true
    await deck('/prospects')
    expect(onCard()).toContain('Alpha Builders')
  })

  it('an estimator without the flag lands on Permits, and the deck’s address shows the way there', async () => {
    world.role = 'estimator'
    world.teamProspectsAccess = false
    const a = open('/prospects')
    expect(await screen.findByTestId('permits-tab')).toBeTruthy()
    expect(where()).toBe('/prospects?tab=permits')
    expect(screen.queryByRole('button', { name: 'Customers' })).toBeNull()
    a.unmount()
    open('/prospects?tab=follow-up')
    expect(await screen.findByText(/You don’t have access to Prospects/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Permits' }).getAttribute('href')).toBe('/prospects?tab=permits')
  })

  it('Hiring needs the switch or a shared column; a share holder gets the trimmed board', async () => {
    world.teamProspectsAccess = false
    await deck('/prospects?tab=team')
    expect(where()).toBe('/prospects?tab=follow-up')
    expect(screen.queryByRole('button', { name: 'Hiring' })).toBeNull()
    cleanup()
    world.hiringShares = ['role-1']
    open('/prospects?tab=team')
    expect((await screen.findByTestId('hiring-tab')).getAttribute('data-shared')).toBe('true')
  })
})

describe('the deck', () => {
  it('a link to a prospect puts that card up', async () => {
    await deck('/prospects?tab=follow-up&prospect_id=cu-3')
    expect(onCard()).toContain('Charlie Group')
    expect(screen.getByText('3 of 3')).toBeTruthy()
  })

  it('a link to another lane’s prospect opens it on its own lane', async () => {
    open('/prospects?tab=follow-up&prospect_id=su-2')
    await screen.findByRole('button', { name: 'Add to the bench ✓' })
    await waitFor(() => expect(onCard()).toContain('Hotel Concrete'))
    expect(where()).toBe('/prospects?tab=follow-up&prospect_id=su-2&kind=subs')
  })

  it('a link to a prospect that left the queue still opens it', async () => {
    await deck('/prospects?tab=follow-up&prospect_id=cu-4')
    expect(onCard()).toContain('Delta Gone')
    expect(screen.getByText('1 of 4')).toBeTruthy()
  })

  it('Next Prospect brings up the next card, names it in the address and logs the time', async () => {
    await deck('/prospects')
    press('Next Prospect →')
    await waitFor(() => expect(onCard()).toContain('Bravo Homes'))
    expect(where()).toBe('/prospects?tab=follow-up&prospect_id=cu-2')
    expect(writesTo('prospect_timer_events', 'insert').map((w) => (w.payload as Row).button_name)).toEqual(['next_prospect'])
    // Next releases the caller's own lock on the card they leave. The stand-in is lazy the way the real client is:
    // it records a write only when the write is awaited, so this fails if the release is built and dropped.
    expect(writesTo('prospect_calling_locks', 'delete').map((w) => w.filters)).toEqual([{ prospect_id: 'cu-1', user_id: 'smoke-auth-user-1' }])
  })

  it('Next Prospect on the last card wraps to the first', async () => {
    await deck('/prospects?tab=follow-up&prospect_id=cu-3')
    press('Next Prospect →')
    await waitFor(() => expect(onCard()).toContain('Alpha Builders'))
  })

  it('a row of the queue jumps to its card', async () => {
    await deck('/prospects')
    fireEvent.click(screen.getByText('Charlie Group'))
    await waitFor(() => expect(onCard()).toContain('Charlie Group'))
    expect(where()).toBe('/prospects?tab=follow-up&prospect_id=cu-3')
  })

  it('Not a fit marks the prospect, notes it, logs the time and brings up the card that followed', async () => {
    await deck('/prospects')
    press('Not a fit')
    await waitFor(() => expect(onCard()).toContain('Bravo Homes'))
    expect(writesTo('prospects', 'update')).toEqual([{ table: 'prospects', method: 'update', payload: { prospect_fit_status: 'not_a_fit' }, filters: { id: 'cu-1' } }])
    expect((writesTo('prospect_comments', 'insert')[0]?.payload as Row).interaction_type).toBe('no_longer_fit')
    expect((writesTo('prospect_timer_events', 'insert')[0]?.payload as Row).button_name).toBe('no_longer_fit')
    expect(screen.queryByText('Alpha Builders')).toBeNull()
    expect(where()).toBe('/prospects?tab=follow-up&prospect_id=cu-2')
  })

  it('Not a fit on a middle card leaves the pointer where it was, on the card that followed', async () => {
    await deck('/prospects?tab=follow-up&prospect_id=cu-2')
    expect(screen.getByText('2 of 3')).toBeTruthy()
    press('Not a fit')
    await waitFor(() => expect(onCard()).toContain('Charlie Group'))
    expect(screen.getByText('2 of 2')).toBeTruthy()
    expect(where()).toBe('/prospects?tab=follow-up&prospect_id=cu-3')
  })

  it('Can’t reach on the last card steps back onto the new last card', async () => {
    await deck('/prospects?tab=follow-up&prospect_id=cu-3')
    press('Can\'t reach')
    await waitFor(() => expect(onCard()).toContain('Bravo Homes'))
    expect(writesTo('prospects', 'update')[0]).toMatchObject({ payload: { prospect_fit_status: 'cant_reach' }, filters: { id: 'cu-3' } })
    expect(screen.getByText('2 of 2')).toBeTruthy()
  })

  it('Didn’t Answer logs the call, keeps the card up and clears its never-called chip', async () => {
    await deck('/prospects')
    expect(within(screen.getByText('← you').closest('button') as HTMLElement).getByText('never called')).toBeTruthy()
    press('Didn\'t Answer')
    await waitFor(() => expect(writesTo('prospect_comments', 'insert')).toHaveLength(1))
    expect(writesTo('prospect_comments', 'insert')[0]?.payload).toMatchObject({ prospect_id: 'cu-1', interaction_type: 'didnt_answer', comment_text: 'Prospect did not answer' })
    await waitFor(() => expect(within(screen.getByText('← you').closest('button') as HTMLElement).queryByText('never called')).toBeNull())
    expect(onCard()).toContain('Alpha Builders')
    expect(writesTo('prospect_timer_events')).toHaveLength(0)
  })

  it('Didn’t Answer moves to the next card when the caller ticked the box', async () => {
    await deck('/prospects')
    fireEvent.click(screen.getByRole('checkbox', { name: /Automatically move to the next prospect/ }))
    press('Didn\'t Answer')
    await waitFor(() => expect(onCard()).toContain('Bravo Homes'))
    expect(writesTo('prospect_timer_events')).toHaveLength(0)
    expect(window.localStorage.getItem('prospects_didnt_answer_move_next_smoke-auth-user-1')).toBe('true')
  })

  it('Answered logs the call with the typed words and warms the prospect by one', async () => {
    await deck('/prospects')
    fireEvent.change(screen.getByPlaceholderText(/^Type what happened/), { target: { value: 'Send plans next week' } })
    press('Answered')
    await waitFor(() => expect(writesTo('prospect_comments', 'insert')).toHaveLength(1))
    expect(writesTo('prospect_comments', 'insert')[0]?.payload).toMatchObject({ interaction_type: 'answered', comment_text: 'Send plans next week' })
    await waitFor(() => expect((writesTo('prospects', 'update')[0]?.payload as Row).warmth_count).toBe(1))
  })

  it('the calling order switch reloads the deck never-called first and remembers the choice', async () => {
    world.comments = [...world.comments, { id: 'c-9', prospect_id: 'cu-1', created_by: 'x', created_at: '2026-09-01T12:00:00Z', comment_text: 'no answer', interaction_type: 'didnt_answer' }]
    await deck('/prospects')
    expect(onCard()).toContain('Alpha Builders')
    press('Never called')
    await waitFor(() => expect(screen.getByText('1 of 3')).toBeTruthy())
    await waitFor(() => expect(window.localStorage.getItem('prospects_calling_order_v1_smoke-auth-user-1')).toBe('never_called_first'))
    const rail = document.querySelector('.followUpQueueRail') as HTMLElement
    const rows = within(rail).getAllByText(/^(Alpha Builders|Bravo Homes|Charlie Group)$/).map((n) => n.textContent)
    expect(rows).toEqual(['Charlie Group', 'Alpha Builders', 'Bravo Homes'])
  })
})

describe('the Subs lane', () => {
  it('a trade filter shows only that trade’s subs', async () => {
    await deck('/prospects?tab=follow-up&kind=subs&trade=Framing')
    expect(onCard()).toContain('India Framing')
    expect(screen.getByText('1 of 1')).toBeTruthy()
  })

  it('a run works its ids in their order, and its last Next shows the receipt', async () => {
    await deck('/prospects?tab=follow-up&kind=subs&run=su-2,su-1&trade=Concrete')
    expect(document.querySelector('[data-run-head]')).toBeTruthy()
    expect(onCard()).toContain('Hotel Concrete')
    expect(screen.getByText('The run')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Calling order' })).toBeNull()
    press('Next in the run →')
    await waitFor(() => expect(onCard()).toContain('Golf Concrete'))
    press('Finish the run →')
    await waitFor(() => expect(document.querySelector('[data-run-receipt]')).toBeTruthy())
    expect(screen.getByText('Run done.')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Back to the board →' }).length).toBeGreaterThan(0)
  })

  it('in a run, Didn’t Answer sets a callback and stays on the card', async () => {
    await deck('/prospects?tab=follow-up&kind=subs&run=su-2,su-1&trade=Concrete')
    fireEvent.click(screen.getByRole('checkbox', { name: /Automatically move to the next prospect/ }))
    press('Didn\'t Answer')
    await waitFor(() => expect(writesTo('prospect_callbacks', 'insert')).toHaveLength(1))
    expect(writesTo('prospect_callbacks', 'insert')[0]?.payload).toMatchObject({ prospect_id: 'su-2', user_id: 'smoke-auth-user-1' })
    expect(onCard()).toContain('Hotel Concrete')
  })

  it('the Board draws a column a trade, and its run press opens the deck on that column’s ids', async () => {
    open('/prospects?tab=board&kind=subs')
    fireEvent.click(await screen.findByText('Call the 2 here →'))
    await screen.findByText('How did the call end?')
    expect(where()).toContain('run=su-1%2Csu-2')
    expect(where()).toContain('trade=Concrete')
    await waitFor(() => expect(onCard()).toContain('Golf Concrete'))
  })

  it('a priority press on the card saves it', async () => {
    await deck('/prospects?tab=follow-up&kind=subs')
    press('★ Call first')
    await waitFor(() => expect(writesTo('prospects', 'update')).toHaveLength(1))
    expect(writesTo('prospects', 'update')[0]).toMatchObject({ payload: { priority: 1 }, filters: { id: 'su-1' } })
  })

  it('the list groups the lane by trade, and a row’s Call now opens the deck on it', async () => {
    open('/prospects?tab=prospect-list&kind=subs')
    await screen.findByText('Call for Concrete →')
    expect(screen.getByText('Concrete (2)')).toBeTruthy()
    expect(screen.getByText('Framing (1)')).toBeTruthy()
    const row = document.querySelector('[data-sub-row="su-3"]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Call now →' }))
    await screen.findByText('How did the call end?')
    await waitFor(() => expect(onCard()).toContain('India Framing'))
    expect(where()).toBe('/prospects?tab=follow-up&kind=subs&prospect_id=su-3')
  })

  it('Add a sub on an empty trade opens New Prospect as a sub with the trade filled in', async () => {
    open('/prospects?tab=prospect-list&kind=subs')
    await screen.findByText('Call for Concrete →')
    const section = document.querySelector('[data-subs-section="trade-masonry"]') as HTMLElement
    fireEvent.click(within(section).getByRole('button', { name: 'Add a sub' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('New Prospect')).toBeTruthy()
    expect((within(dialog).getByPlaceholderText('Concrete, Fire sprinkler') as HTMLInputElement).value).toBe('Masonry')
  })
})

/** A GC board the lanes can read: one project out for a bid that buys out Concrete, and one company on the bench. */
function seedGcBoard() {
  world.gcProjects = [
    { id: 'gp-1', name: 'Test Office Shell', stage: 'bidding', bidDue: '2099-12-01', lostOn: null, customerId: null, architectId: null, trades: [{ id: 'pk-1', trade: 'Concrete', ours: false }] },
  ]
  world.gcBoard = {
    today: '2026-11-17',
    projects: [],
    boardDates: {},
    customers: [],
    companies: [
      { id: 'co-1', name: 'Lima Concrete', trades: ['Concrete'], contact_name: 'Sam Sample', phone: '555-0150', email: '', address: '', max_miles: null, license: '', lang: 'en', vetting_status: 'approved', vetting_limit: null, vetting_decided_on: null, vetting_decided_by: null, vetting_note: '' },
    ],
    invites: [],
    quotes: [],
    contacts: [],
    promises: [],
    promiseMoves: [],
  }
}

describe('the lanes with the GC board read', () => {
  const pathStrip = () => screen.getByRole('group', { name: 'The path onto the bench' }).textContent ?? ''
  const needsPanel = () => screen.getByRole('group', { name: 'What GC mode needs right now' })

  it('a refused read still draws the Subs lane, and the panel says so', async () => {
    await deck('/prospects?tab=follow-up&kind=subs')
    expect(needsPanel().textContent).toContain('the bench could not be read')
    expect(pathStrip()).toContain('To call3')
  })

  it('the needs panel lists a trade short on the bench, and Call for it filters the deck', async () => {
    seedGcBoard()
    await deck('/prospects?tab=follow-up&kind=subs')
    const panel = needsPanel()
    await waitFor(() => expect(panel.textContent).toContain('1 on the bench · wants 2 more · 2 to call here'))
    fireEvent.click(within(panel).getByRole('button', { name: 'Call for Concrete' }))
    await waitFor(() => expect(where()).toBe('/prospects?tab=follow-up&kind=subs&trade=Concrete'))
    await waitFor(() => expect(screen.getByText('1 of 2')).toBeTruthy())
    const all = within(needsPanel()).getAllByRole('button', { name: 'All subs' })
    expect(all.length).toBe(2)
    fireEvent.click(all[0] as HTMLElement)
    await waitFor(() => expect(where()).toBe('/prospects?tab=follow-up&kind=subs'))
  })

  it('Add a sub on a need opens New Prospect as a sub with that trade', async () => {
    seedGcBoard()
    await deck('/prospects?tab=follow-up&kind=subs')
    await waitFor(() => expect(needsPanel().textContent).toContain('wants 2 more'))
    fireEvent.click(within(needsPanel()).getByRole('button', { name: 'Add a sub' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('radio', { name: /A sub/ }).getAttribute('aria-checked')).toBe('true')
    expect((within(dialog).getByPlaceholderText('Concrete, Fire sprinkler') as HTMLInputElement).value).toBe('Concrete')
  })

  it('a book chip with subs to call filters the deck, and one with none opens Add a sub', async () => {
    await deck('/prospects?tab=follow-up&kind=subs')
    const chips = screen.getByRole('group', { name: 'Trades nobody does yet' })
    fireEvent.click(within(chips).getByRole('button', { name: /^Framing · 1 to call/ }))
    await waitFor(() => expect(onCard()).toContain('India Framing'))
    expect(where()).toBe('/prospects?tab=follow-up&kind=subs&trade=Framing')
    fireEvent.click(within(screen.getByRole('group', { name: 'Trades nobody does yet' })).getByRole('button', { name: /^Sitework/ }))
    const dialog = await screen.findByRole('dialog')
    expect((within(dialog).getByPlaceholderText('Concrete, Fire sprinkler') as HTMLInputElement).value).toBe('Sitework')
  })

  it('the path strip counts a company as called once its call is logged', async () => {
    await deck('/prospects?tab=follow-up&kind=subs')
    expect(pathStrip()).toContain('To call3')
    press('Didn\'t Answer')
    await waitFor(() => expect(pathStrip()).toContain('To call2'))
    expect(pathStrip()).toContain('Called1')
  })

  it('the list’s For picker names the project, lights its trades and carries it in the address', async () => {
    seedGcBoard()
    open('/prospects?tab=prospect-list&kind=subs')
    const picker = await screen.findByRole('group', { name: /^For/ })
    expect(picker.textContent).toContain('Pick the project a set of plans is for')
    fireEvent.change(within(picker).getByRole('combobox'), { target: { value: 'gp-1' } })
    await waitFor(() => expect(where()).toBe('/prospects?tab=prospect-list&kind=subs&for=gp-1'))
    expect(screen.getByRole('group', { name: /^For/ }).textContent).toContain('needs Concrete')
    expect(screen.getByText('Concrete ★ (2)')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Call for Concrete →' }).getAttribute('href')).toContain('for=gp-1')
  })

  it('the work strip counts the projects in flight and names the one bidding', async () => {
    seedGcBoard()
    await deck('/prospects?tab=follow-up&kind=gc-leads')
    const strip = screen.getByRole('group', { name: 'GC work in flight' })
    await waitFor(() => expect(strip.textContent).toContain('Bidding 1'))
    expect(within(strip).getByRole('link', { name: 'Test Office Shell' }).getAttribute('href')).toContain('gp-1')
    expect(strip.textContent).toContain('On this deck: 0 of 2 leads carry a job with a bid day')
  })

  it('a refused read of the Project Board says so on the work strip', async () => {
    world.gcProjectsRefused = true
    await deck('/prospects?tab=follow-up&kind=gc-leads')
    expect(screen.getByRole('group', { name: 'GC work in flight' }).textContent).toContain('the Project Board could not be read')
  })
})

describe('the Jobs to GC lane', () => {
  it('draws the work strip and the card’s Jobs box', async () => {
    world.jobs = [{ id: 'j-1', prospect_id: 'gc-1', name: 'Test Office Shell', status: 'open', bid_due: '2026-12-01', won_by: null, created_at: '2026-10-01T12:00:00Z', created_by: 'smoke-auth-user-1', location: null, notes: null, trades: [] }]
    await deck('/prospects?tab=follow-up&kind=gc-leads')
    expect(screen.getByRole('group', { name: 'GC work in flight' })).toBeTruthy()
    expect(await screen.findByText(/Test Office Shell/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Soonest bid' })).toBeTruthy()
  })
})

describe('a lead’s jobs', () => {
  const job = (extra: Row = {}): Row => ({ id: 'j-1', prospect_id: 'gc-1', name: 'Test Office Shell', status: 'open', bid_due: '2026-12-01', won_by: null, created_at: '2026-10-01T12:00:00Z', created_by: 'smoke-auth-user-1', location: null, notes: null, plans: null, ...extra })
  const box = () => document.querySelector('[data-prospect-jobs]') as HTMLElement

  it('Add a job writes it under the lead and shows it in the box', async () => {
    await deck('/prospects?tab=follow-up&kind=gc-leads')
    fireEvent.click(within(box()).getByRole('button', { name: /Add a job/ }))
    fireEvent.change(within(box()).getByPlaceholderText('Retail shell'), { target: { value: 'Test Clinic' } })
    fireEvent.click(within(box()).getByRole('button', { name: /^(Add|Save)/ }))
    await waitFor(() => expect(writesTo('prospect_jobs', 'insert')).toHaveLength(1))
    expect(writesTo('prospect_jobs', 'insert')[0]?.payload).toMatchObject({ prospect_id: 'gc-1', name: 'Test Clinic', status: 'open', created_by: 'smoke-auth-user-1' })
    expect(await within(box()).findByText(/Test Clinic/)).toBeTruthy()
  })

  it('Drop and Remove write the job and the box follows', async () => {
    world.jobs = [job()]
    await deck('/prospects?tab=follow-up&kind=gc-leads')
    await within(box()).findByText(/Test Office Shell/)
    fireEvent.click(within(box()).getByRole('button', { name: /Drop/ }))
    await waitFor(() => expect(writesTo('prospect_jobs', 'update')).toHaveLength(1))
    expect(writesTo('prospect_jobs', 'update')[0]).toMatchObject({ payload: { status: 'dropped' }, filters: { id: 'j-1' } })
    fireEvent.click(await within(box()).findByRole('button', { name: /Remove/ }))
    await waitFor(() => expect(writesTo('prospect_jobs', 'delete')).toHaveLength(1))
    await waitFor(() => expect(within(box()).queryByText(/Test Office Shell/)).toBeNull())
  })

  it('Lost asks who got it and saves the answer', async () => {
    world.jobs = [job()]
    await deck('/prospects?tab=follow-up&kind=gc-leads')
    await within(box()).findByText(/Test Office Shell/)
    fireEvent.click(within(box()).getByRole('button', { name: /Lost/ }))
    const ask = await screen.findByRole('dialog')
    expect(within(ask).getByText('Who got it?')).toBeTruthy()
    fireEvent.change(within(ask).getByPlaceholderText('Another builder'), { target: { value: ' Other Builder ' } })
    fireEvent.click(within(ask).getByRole('button', { name: 'Mark lost' }))
    await waitFor(() => expect(writesTo('prospect_jobs', 'update')).toHaveLength(1))
    expect(writesTo('prospect_jobs', 'update')[0]).toMatchObject({ payload: { status: 'lost', won_by: 'Other Builder' }, filters: { id: 'j-1' } })
  })
})

describe('New Prospect’s double line', () => {
  it('a company already on a lane is named, Save reads Save anyway, and Open it opens its card', async () => {
    await deck('/prospects?tab=follow-up&kind=subs')
    press('New Prospect')
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Company'), { target: { value: 'Bravo Homes' } })
    const line = await waitFor(() => {
      const el = dialog.querySelector('[data-company-double]')
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    expect(within(dialog).getByRole('button', { name: 'Save anyway' })).toBeTruthy()
    fireEvent.click(within(line).getByRole('button', { name: 'Open it' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(onCard()).toContain('Bravo Homes'))
    expect(where()).toBe('/prospects?tab=follow-up&prospect_id=cu-2')
  })
})

describe('Prospect List', () => {
  it('a row’s Call now opens Follow Up on that prospect', async () => {
    open('/prospects?tab=prospect-list')
    await screen.findByText('Never called (2)')
    const row = screen.getAllByText('Charlie Group')[0]?.closest('tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Call now →' }))
    await screen.findByText('How did the call end?')
    await waitFor(() => expect(onCard()).toContain('Charlie Group'))
    expect(where()).toBe('/prospects?tab=follow-up&prospect_id=cu-3')
  })

  it('a link with a prospect opens its section and drops the id from the address', async () => {
    open('/prospects?tab=prospect-list&prospect_id=cu-4')
    await screen.findByText('Never called (2)')
    await waitFor(() => expect(where()).toBe('/prospects?tab=prospect-list'))
    expect(screen.getAllByText('Delta Gone').length).toBeGreaterThan(0)
  })

  it('Send back returns a prospect that left the queue', async () => {
    open('/prospects?tab=prospect-list&prospect_id=cu-4')
    await waitFor(() => expect(screen.getAllByText('Delta Gone').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByRole('button', { name: 'Send back' })[0] as HTMLElement)
    await waitFor(() => expect(writesTo('prospects', 'update')).toHaveLength(1))
    expect(writesTo('prospects', 'update')[0]).toMatchObject({ payload: { prospect_fit_status: null }, filters: { id: 'cu-4' } })
  })

  it('the search narrows the list, and a search with no match offers to clear it', async () => {
    open('/prospects?tab=prospect-list')
    await screen.findByText('Never called (2)')
    const search = screen.getByRole('searchbox')
    fireEvent.change(search, { target: { value: 'alpha' } })
    await screen.findByText('Never called (1)')
    fireEvent.change(search, { target: { value: 'no such company' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Clear the search' }))
    await screen.findByText('Never called (2)')
  })
})

describe('Prospect List, the row actions and what it remembers', () => {
  async function listWithGone() {
    open('/prospects?tab=prospect-list&prospect_id=cu-4')
    await waitFor(() => expect(screen.getAllByText('Delta Gone').length).toBeGreaterThan(0))
    return screen.getAllByText('Delta Gone')[0]?.closest('tr') as HTMLElement
  }

  it('the search and an opened section are still there after a look at another tab', async () => {
    open('/prospects?tab=prospect-list')
    await screen.findByText('Never called (2)')
    fireEvent.click(screen.getByRole('button', { name: /Going cold — last touch/ }))
    expect(await screen.findAllByText('Bravo Homes')).not.toHaveLength(0)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bravo' } })
    await waitFor(() => expect(screen.queryByText('Alpha Builders')).toBeNull())
    press('Follow Up')
    await screen.findByText('How did the call end?')
    press('Prospect List')
    await waitFor(() => expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('bravo'))
    expect(screen.getAllByText('Bravo Homes').length).toBeGreaterThan(0)
    expect(screen.queryByText('Alpha Builders')).toBeNull()
  })

  it('a section heading folds and unfolds its rows', async () => {
    open('/prospects?tab=prospect-list')
    await screen.findByText('Never called (2)')
    expect(screen.getAllByText('Alpha Builders').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Never called \(2\)/ }))
    await waitFor(() => expect(screen.queryByText('Alpha Builders')).toBeNull())
  })

  it('Edit on a row that left the queue opens the Edit window on that row', async () => {
    const row = await listWithGone()
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    expect((within(dialog).getByLabelText('Company') as HTMLInputElement).value).toBe('Delta Gone')
    expect(within(dialog).getByText('Edit Prospect')).toBeTruthy()
  })

  it('Not a fit and Delete on such a row write it, and Delete asks first', async () => {
    const row = await listWithGone()
    fireEvent.click(within(row).getByRole('button', { name: 'Not a fit' }))
    await waitFor(() => expect(writesTo('prospects', 'update')).toHaveLength(1))
    expect(writesTo('prospects', 'update')[0]).toMatchObject({ payload: { prospect_fit_status: 'not_a_fit' }, filters: { id: 'cu-4' } })
    // The row moved to Not a fit, a section that opens folded.
    fireEvent.click(await screen.findByRole('button', { name: /No longer a fit \(1\)/ }))
    await waitFor(() => expect(screen.getAllByText('Delta Gone').length).toBeGreaterThan(0))
    const again = screen.getAllByText('Delta Gone')[0]?.closest('tr') as HTMLElement
    fireEvent.click(within(again).getByRole('button', { name: 'Delete' }))
    const ask = await screen.findByRole('alertdialog')
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(writesTo('prospects', 'delete')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByText('Delta Gone')).toBeNull())
  })

  it('shows each row’s timed seconds beside its last touch', async () => {
    world.timerEvents = [{ id: 't-1', prospect_id: 'cu-1', created_at: '2026-10-01T12:00:00Z', timer_seconds: 125, button_name: 'next_prospect', prospect: null }]
    open('/prospects?tab=prospect-list')
    await screen.findByText('Never called (2)')
    expect((await screen.findAllByText(/02:05/)).length).toBeGreaterThan(0)
  })
})

describe('Convert', () => {
  it('a search picks a prospect, and the three steps of the form come up', async () => {
    open('/prospects?tab=convert')
    const search = await screen.findByLabelText('Who are you converting?')
    await settle()
    fireEvent.change(search, { target: { value: 'bravo' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(await screen.findByText('1. Customer details')).toBeTruthy()
    expect(screen.getByText('2. Contact persons')).toBeTruthy()
    expect(screen.getByText('3. Bids')).toBeTruthy()
    expect((screen.getAllByDisplayValue('Pat Sample')[0] as HTMLInputElement).value).toBe('Pat Sample')
  })
})

describe('Convert, the form', () => {
  async function pick(company: string) {
    open('/prospects?tab=convert')
    const search = await screen.findByLabelText('Who are you converting?')
    await settle()
    fireEvent.change(search, { target: { value: company } })
    fireEvent.keyDown(search, { key: 'Enter' })
    await screen.findByText('1. Customer details')
    await settle()
  }

  it('Convert to customer makes the customer, its contact and its first bid, marks the prospect and opens the customer', async () => {
    await pick('bravo')
    fireEvent.change(screen.getByPlaceholderText('Project name'), { target: { value: ' Test Office Shell ' } })
    const serviceType = (screen.getByPlaceholderText('Project name').closest('.convertCard') as HTMLElement).querySelector('select') as HTMLSelectElement
    await waitFor(() => expect(within(serviceType).getByRole('option', { name: 'Plumbing' })).toBeTruthy())
    fireEvent.change(serviceType, { target: { value: 'st-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Convert to customer' }))
    await waitFor(() => expect(where().startsWith('/customers/cust-new')).toBe(true))
    expect(writesTo('customers', 'insert')).toHaveLength(1)
    expect(writesTo('customer_contact_persons', 'insert').map((w) => w.payload)).toEqual([{ customer_id: 'cust-new', name: 'Pat Sample', phone: '555-0100', email: null, note: null }])
    expect(writesTo('bids', 'insert').map((w) => w.payload)).toEqual([{ customer_id: 'cust-new', created_by: 'smoke-auth-user-1', service_type_id: 'st-1', project_name: 'Test Office Shell', materials_model: 'rough' }])
    expect(writesTo('prospects', 'update')[0]).toMatchObject({ payload: { prospect_fit_status: 'converted' }, filters: { id: 'cu-2' } })
    expect((writesTo('prospect_comments', 'insert')[0]?.payload as Row).interaction_type).toBe('converted')
  })

  it('a bid card with no service type is left out', async () => {
    await pick('bravo')
    fireEvent.change(screen.getByPlaceholderText('Project name'), { target: { value: 'Test Office Shell' } })
    fireEvent.click(screen.getByRole('button', { name: 'Convert to customer' }))
    await waitFor(() => expect(where().startsWith('/customers/cust-new')).toBe(true))
    expect(writesTo('bids')).toHaveLength(0)
  })

  it('the picked prospect and a typed card are still there after a look at another tab', async () => {
    await pick('charlie')
    fireEvent.change(screen.getByPlaceholderText('Project name'), { target: { value: 'Test Office Shell' } })
    press('Prospect List')
    await screen.findByText('Never called (2)')
    press('Convert')
    expect(await screen.findByText('1. Customer details')).toBeTruthy()
    expect((screen.getByPlaceholderText('Project name') as HTMLInputElement).value).toBe('Test Office Shell')
    expect(document.querySelector('.convertProspectSummary')?.textContent).toContain('Charlie Group')
  })

  it('a prospect answered in the last 30 days is offered as a suggestion, and a press picks it', async () => {
    world.comments = [{ id: 'c-r', prospect_id: 'cu-3', created_by: 'smoke-auth-user-1', created_at: new Date(Date.now() - 2 * 86400000).toISOString(), comment_text: 'Talked', interaction_type: 'answered' }]
    open('/prospects?tab=convert')
    await screen.findByLabelText('Who are you converting?')
    fireEvent.click(await screen.findByRole('button', { name: /Charlie Group/ }))
    expect(await screen.findByText('1. Customer details')).toBeTruthy()
    expect(document.querySelector('.convertProspectSummary')?.textContent).toContain('Charlie Group')
  })
})

describe('Activity', () => {
  it('pages back a week and will not page past this one', async () => {
    open('/prospects?tab=activity')
    await screen.findByText('Marked / Updated by day — last 30 days')
    expect(screen.getByText(/^This week —/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /next week/ }) as HTMLButtonElement).disabled).toBe(true)
    press(/previous week/)
    expect(await screen.findByText(/^Week of —/)).toBeTruthy()
  })

  it('the week it is paged to survives a visit to another tab', async () => {
    open('/prospects?tab=activity')
    await screen.findByText('Marked / Updated by day — last 30 days')
    press(/previous week/)
    await screen.findByText(/^Week of —/)
    press('Follow Up')
    await screen.findByText('How did the call end?')
    press('Activity')
    expect(await screen.findByText(/^Week of —/)).toBeTruthy()
  })

  it('draws a caller’s week from the calls on record, and counts landings in the lane’s words', async () => {
    open('/prospects?tab=activity')
    expect(await screen.findByText('1 call')).toBeTruthy()
    expect(screen.getByText(/1 answered · 100%/)).toBeTruthy()
    expect(screen.getByText(/0 converted/)).toBeTruthy()
    expect(screen.getByText('Daily detail')).toBeTruthy()
    expect(screen.queryByText(/^Source success/)).toBeNull()
  })

  it('a week with no calls says so and offers the week before', async () => {
    world.comments = []
    open('/prospects?tab=activity')
    expect(await screen.findByText('No calling activity this week yet.')).toBeTruthy()
    press('Previous week')
    expect(await screen.findByText('No calling activity that week.')).toBeTruthy()
  })

  it('on a lane, heads the week with the lane and adds Source success from the lane’s rows', async () => {
    world.prospects = world.prospects.map((p) => (p.kind === 'sub' ? { ...p, source: p.id === 'su-3' ? 'A referral' : 'Google Maps', prospect_fit_status: p.id === 'su-1' ? 'converted' : null } : p))
    open('/prospects?tab=activity&kind=subs')
    expect(await screen.findByText('Source success — Subs, every row of the lane')).toBeTruthy()
    expect(await screen.findByText('Google Maps')).toBeTruthy()
    expect(screen.getByText('1 of 2')).toBeTruthy()
    expect(screen.getByText('A referral')).toBeTruthy()
    expect(screen.getByText(/^Subs · This week —/)).toBeTruthy()
    expect(screen.getByText(/0 to the bench/)).toBeTruthy()
  })
})

describe('the calling order and the deck’s order', () => {
  const rail = () => within(document.querySelector('.followUpQueueRail') as HTMLElement)
  const railOrder = (names: RegExp) => rail().getAllByText(names).map((n) => n.textContent)
  const remember = (mode: string) => window.localStorage.setItem('prospects_calling_order_v1_smoke-auth-user-1', mode)

  it('a remembered order is the one the deck loads in', async () => {
    remember('never_called_first')
    await deck('/prospects')
    await waitFor(() => expect(railOrder(/^(Alpha Builders|Bravo Homes|Charlie Group)$/)).toEqual(['Alpha Builders', 'Charlie Group', 'Bravo Homes']))
    expect(rail().getByRole('button', { name: 'Never called' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('the default order is coldest first', async () => {
    await deck('/prospects')
    expect(railOrder(/^(Alpha Builders|Bravo Homes|Charlie Group)$/)).toEqual(['Alpha Builders', 'Bravo Homes', 'Charlie Group'])
    expect(rail().getByRole('button', { name: 'Coldest' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('By rank on a trade leads with that trade’s pins', async () => {
    remember('by_rank')
    world.ranks = [{ prospect_id: 'su-2', trade: 'Concrete', rank_order: 1 }]
    await deck('/prospects?tab=follow-up&kind=subs&trade=Concrete')
    await waitFor(() => expect(railOrder(/^(Golf Concrete|Hotel Concrete)$/)).toEqual(['Hotel Concrete', 'Golf Concrete']))
    expect(onCard()).toContain('Hotel Concrete')
  })

  it('By rank with no pins keeps Call first ahead of Later', async () => {
    remember('by_rank')
    world.prospects = world.prospects.map((p) => (p.id === 'su-1' ? { ...p, priority: 3 } : p.id === 'su-3' ? { ...p, priority: 1 } : p))
    await deck('/prospects?tab=follow-up&kind=subs')
    await waitFor(() => expect(railOrder(/^(Golf Concrete|Hotel Concrete|India Framing)$/)).toEqual(['India Framing', 'Hotel Concrete', 'Golf Concrete']))
  })

  it('Soonest bid on Jobs to GC leads with the lead whose bid is due first', async () => {
    remember('soonest_bid')
    world.jobs = [{ id: 'j-1', prospect_id: 'gc-2', name: 'Test Clinic', status: 'open', bid_due: '2099-01-05', won_by: null, created_at: '2026-10-01T12:00:00Z', created_by: 'smoke-auth-user-1', location: null, notes: null, plans: null }]
    await deck('/prospects?tab=follow-up&kind=gc-leads')
    await waitFor(() => expect(railOrder(/^(Echo Owner|Foxtrot Developer)$/)).toEqual(['Foxtrot Developer', 'Echo Owner']))
  })

  it('a lane that has no such order falls back to its own rows, and the switch offers only its own orders', async () => {
    remember('soonest_bid')
    await deck('/prospects')
    expect(railOrder(/^(Alpha Builders|Bravo Homes|Charlie Group)$/)).toEqual(['Alpha Builders', 'Bravo Homes', 'Charlie Group'])
    expect(rail().queryByRole('button', { name: 'Soonest bid' })).toBeNull()
    expect(rail().queryByRole('button', { name: 'By rank' })).toBeNull()
  })

  it('a ZZ test company stays off the deck and the list for the office', async () => {
    world.role = 'assistant'
    world.prospects = [...world.prospects, prospect('cu-zz', 'customer', 'ZZ Test Company', { last_contact: '2026-08-01T12:00:00Z' })]
    await deck('/prospects')
    expect(screen.getByText('1 of 3')).toBeTruthy()
    expect(screen.queryByText('ZZ Test Company')).toBeNull()
    press('Prospect List')
    await screen.findByText('Never called (2)')
    expect(screen.queryByText('ZZ Test Company')).toBeNull()
  })

  it('switching lanes reloads the deck for the new lane and leaves no card of the old one', async () => {
    await deck('/prospects')
    press('Jobs to GC')
    await waitFor(() => expect(onCard()).toContain('Echo Owner'))
    expect(screen.queryByText('Alpha Builders')).toBeNull()
    expect(screen.getByText('1 of 2')).toBeTruthy()
  })
})

describe('the Board’s writes', () => {
  const card = (id: string) => document.querySelector(`[data-board-card="${id}"]`) as HTMLElement | null

  it('Pass asks first, marks the company not a fit and takes it off the column', async () => {
    open('/prospects?tab=board&kind=subs')
    await screen.findByText('Call the 2 here →')
    fireEvent.click(within(card('su-1') as HTMLElement).getByRole('button', { name: 'Pass' }))
    const ask = await screen.findByRole('alertdialog')
    fireEvent.click(within(ask).getByRole('button', { name: 'Pass' }))
    await waitFor(() => expect(writesTo('prospects', 'update')).toHaveLength(1))
    expect(writesTo('prospects', 'update')[0]).toMatchObject({ payload: { prospect_fit_status: 'not_a_fit' }, filters: { id: 'su-1' } })
    await waitFor(() => expect(card('su-1')).toBeNull())
    expect(card('su-2')).toBeTruthy()
  })

  it('To the bench opens the bench window filled from the card', async () => {
    open('/prospects?tab=board&kind=subs')
    await screen.findByText('Call the 2 here →')
    fireEvent.click(within(card('su-1') as HTMLElement).getByRole('button', { name: 'To the bench ✓' }))
    const dialog = await screen.findByRole('dialog')
    expect((within(dialog).getByDisplayValue('Golf Concrete') as HTMLInputElement).value).toBe('Golf Concrete')
  })
})

describe('the calling lock', () => {
  const lockUpserts = () => writesTo('prospect_calling_locks', 'upsert')

  it('looking at a card takes no lock; focusing the composer takes it, once', async () => {
    await deck('/prospects')
    expect(lockUpserts()).toHaveLength(0)
    const composer = screen.getByPlaceholderText(/^Type what happened/)
    fireEvent.focus(composer)
    await waitFor(() => expect(lockUpserts()).toHaveLength(1))
    expect(lockUpserts()[0]?.payload).toMatchObject({ prospect_id: 'cu-1', user_id: 'smoke-auth-user-1' })
    fireEvent.focus(composer)
    await settle()
    expect(lockUpserts()).toHaveLength(1)
  })

  it('an outcome press takes the lock for its card, and the next card takes its own', async () => {
    await deck('/prospects')
    press('Didn\'t Answer')
    await waitFor(() => expect(lockUpserts()).toHaveLength(1))
    press('Next Prospect →')
    await waitFor(() => expect(onCard()).toContain('Bravo Homes'))
    press('Set callback')
    await waitFor(() => expect(lockUpserts()).toHaveLength(2))
    expect(lockUpserts()[1]?.payload).toMatchObject({ prospect_id: 'cu-2' })
  })

  const lockReleases = () => writesTo('prospect_calling_locks', 'delete').map((w) => w.filters)
  const mine = (prospectId: string) => ({ prospect_id: prospectId, user_id: 'smoke-auth-user-1' })

  it('moving to another card releases the lock this tab took', async () => {
    await deck('/prospects')
    fireEvent.focus(screen.getByPlaceholderText(/^Type what happened/))
    await waitFor(() => expect(lockUpserts()).toHaveLength(1))
    expect(world.locks).toHaveLength(1)
    fireEvent.click(screen.getByText('Charlie Group'))
    await waitFor(() => expect(onCard()).toContain('Charlie Group'))
    await waitFor(() => expect(lockReleases()).toEqual([mine('cu-1')]))
    expect(world.locks).toHaveLength(0)
  })

  it('leaving the deck for another tab releases it too', async () => {
    await deck('/prospects')
    fireEvent.focus(screen.getByPlaceholderText(/^Type what happened/))
    await waitFor(() => expect(lockUpserts()).toHaveLength(1))
    press('Prospect List')
    await screen.findByText('Never called (2)')
    await waitFor(() => expect(lockReleases()).toEqual([mine('cu-1')]))
  })

  it('a card nobody locked is not released when the caller only looks and moves on by the queue', async () => {
    await deck('/prospects')
    fireEvent.click(screen.getByText('Charlie Group'))
    await waitFor(() => expect(onCard()).toContain('Charlie Group'))
    await settle()
    expect(lockReleases()).toEqual([])
  })

  it('an outcome that takes the card off the deck releases the caller’s lock on it', async () => {
    await deck('/prospects')
    press('Not a fit')
    await waitFor(() => expect(onCard()).toContain('Bravo Homes'))
    expect(lockReleases()).toContainEqual(mine('cu-1'))
    press('Can\'t reach')
    await waitFor(() => expect(onCard()).toContain('Charlie Group'))
    expect(lockReleases()).toContainEqual(mine('cu-2'))
  })

  it('Didn’t Answer and Answered keep the lock: the caller is still on the card', async () => {
    await deck('/prospects')
    press('Didn\'t Answer')
    await waitFor(() => expect(writesTo('prospect_comments', 'insert')).toHaveLength(1))
    await settle()
    expect(lockUpserts()).toHaveLength(1)
    expect(lockReleases()).toEqual([])
  })

  it('a colleague’s live lock keeps its prospect off the deck', async () => {
    world.locks = [{ prospect_id: 'cu-1', user_id: 'other-user', locked_at: new Date().toISOString() }]
    await deck('/prospects')
    expect(onCard()).toContain('Bravo Homes')
    expect(screen.getByText('1 of 2')).toBeTruthy()
  })

  it('a colleague who took the card after it came up is named on it, and their lock is left alone', async () => {
    await deck('/prospects')
    world.locks = [{ prospect_id: 'cu-1', user_id: 'other-user', locked_at: new Date().toISOString() }]
    fireEvent.focus(screen.getByPlaceholderText(/^Type what happened/))
    expect(await screen.findByText('Pat Office is calling this one')).toBeTruthy()
    expect(lockUpserts()).toHaveLength(0)
  })

  it('a colleague’s stale lock is taken over', async () => {
    await deck('/prospects')
    world.locks = [{ prospect_id: 'cu-1', user_id: 'other-user', locked_at: '2026-01-01T00:00:00Z' }]
    fireEvent.focus(screen.getByPlaceholderText(/^Type what happened/))
    await waitFor(() => expect(lockUpserts()).toHaveLength(1))
    expect(screen.queryByText(/is calling this one/)).toBeNull()
  })
})

describe('the copy templates', () => {
  it('show on the Customers lane only', async () => {
    await deck('/prospects?tab=follow-up&kind=subs')
    expect(screen.queryByRole('button', { name: 'No Response Email' })).toBeNull()
  })

  it('a template that names a detail the prospect lacks lists what is missing and copies nothing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    world.appSettings = [{ key: 'prospect_copy_phone_followup_email', value_text: 'Hi [prospect contact name], call me at [user phone number].' }]
    world.prospects = world.prospects.map((p) => (p.id === 'cu-1' ? { ...p, contact_name: null } : p))
    await deck('/prospects')
    fireEvent.click(await screen.findByRole('button', { name: 'Phone call Follow up Email' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Missing information')).toBeTruthy()
    expect(within(dialog).getByText('Prospect contact name')).toBeTruthy()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('Edit template saves a person’s own words, and Copy then uses them', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await deck('/prospects')
    fireEvent.click((await screen.findAllByTitle('Edit template'))[0] as HTMLElement)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Edit No Response Email')).toBeTruthy()
    const body = within(dialog).getByDisplayValue('Hello [company name], this is [User name].')
    fireEvent.change(body, { target: { value: 'Hi [company name].' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Save/ }))
    await waitFor(() => expect(writesTo('user_prospect_copy_templates', 'upsert')).toHaveLength(1))
    expect(writesTo('user_prospect_copy_templates', 'upsert')[0]?.payload).toEqual({ user_id: 'smoke-auth-user-1', template_key: 'no_response_email', value_text: 'Hi [company name].', subject_text: null })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'No Response Email' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Hi Alpha Builders.'))
  })

  it('Open in email opens the mail, records it sent and turns the envelope', async () => {
    const real = window.location
    const fake = { href: '' }
    Object.defineProperty(window, 'location', { value: fake, configurable: true, writable: true })
    try {
      await deck('/prospects')
      fireEvent.click((await screen.findAllByTitle('Open in email'))[0] as HTMLElement)
      await waitFor(() => expect(writesTo('prospect_email_sent', 'upsert')).toHaveLength(1))
      expect(fake.href).toBe(`mailto:${encodeURIComponent('pat@example.test')}?subject=&body=${encodeURIComponent('Hello Alpha Builders, this is Pat Office.')}`)
      expect(writesTo('prospect_email_sent', 'upsert')[0]?.payload).toEqual({ prospect_id: 'cu-1', user_id: 'smoke-auth-user-1', template_key: 'no_response_email' })
      expect(await screen.findByTitle('Email sent')).toBeTruthy()
    } finally {
      Object.defineProperty(window, 'location', { value: real, configurable: true, writable: true })
    }
  })
})

describe('the run’s text', () => {
  const run = '/prospects?tab=follow-up&kind=subs&run=su-2,su-1&trade=Concrete'
  const ledger = () => document.querySelector('[data-run-ledger]') as HTMLElement

  it('is held until they said we may text', async () => {
    await deck(run)
    press('Didn\'t Answer')
    await waitFor(() => expect(ledger()).toBeTruthy())
    const ask = within(ledger()).getByRole('button', { name: 'Ask first' }) as HTMLButtonElement
    expect(ask.disabled).toBe(true)
    expect(ask.title).toContain('has not said we may text')
    expect(world.invokes).toHaveLength(0)
  })

  it('goes to the number on their thread, is noted on the card and reads Text sent', async () => {
    world.prospects = world.prospects.map((p) => (p.id === 'su-2' ? { ...p, ok_to_text: 'yes' } : p))
    world.contacts = [{ id: 'ct-1', prospect_id: 'su-2' }]
    world.channels = [{ id: 'ch-1', contact_id: 'ct-1', kind: 'phone', value: '555-0100', opted_out_at: null }]
    await deck(run)
    press('Didn\'t Answer')
    await waitFor(() => expect(ledger()).toBeTruthy())
    fireEvent.click(within(ledger()).getByRole('button', { name: 'Text them' }))
    await waitFor(() => expect(world.invokes).toHaveLength(1))
    expect(world.invokes[0]).toMatchObject({ name: 'quo-send', body: { contactId: 'ct-1', channelId: 'ch-1' } })
    expect(await within(ledger()).findByText('Text sent')).toBeTruthy()
    const notes = writesTo('prospect_comments', 'insert').map((w) => w.payload as Row)
    expect(notes.some((n) => n.interaction_type === 'user_comment' && String(n.comment_text).startsWith('Text sent: '))).toBe(true)
  })
})

describe('the windows', () => {
  it('New Prospect opens on the lane’s kind and saves a row of that kind', async () => {
    await deck('/prospects?tab=follow-up&kind=subs')
    press('New Prospect')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('radio', { name: /A sub/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.change(within(dialog).getByLabelText('Company'), { target: { value: 'Kilo Masonry' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(writesTo('prospects', 'insert')).toHaveLength(1))
    expect(writesTo('prospects', 'insert')[0]?.payload).toMatchObject({ kind: 'sub', company_name: 'Kilo Masonry', created_by: 'smoke-auth-user-1', warmth_count: 0 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('the Dashboard’s link opens New Prospect and drops its key from the address', async () => {
    open('/prospects?tab=follow-up&newProspect=true')
    expect(await screen.findByRole('dialog')).toBeTruthy()
    await waitFor(() => expect(where()).toBe('/prospects?tab=follow-up'))
  })

  it('Edit prospect opens on the card’s facts and saves them', async () => {
    await deck('/prospects')
    press('Edit prospect')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Edit Prospect')).toBeTruthy()
    const company = within(dialog).getByLabelText('Company') as HTMLInputElement
    expect(company.value).toBe('Alpha Builders')
    fireEvent.change(company, { target: { value: 'Alpha Builders West' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(writesTo('prospects', 'update')).toHaveLength(1))
    expect(writesTo('prospects', 'update')[0]).toMatchObject({ payload: { company_name: 'Alpha Builders West' }, filters: { id: 'cu-1' } })
    await waitFor(() => expect(onCard()).toContain('Alpha Builders West'))
  })

  it('New Prospect closes on Escape while untouched, and asks once something is typed', async () => {
    await deck('/prospects')
    press('New Prospect')
    let dialog = await screen.findByRole('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    press('New Prospect')
    dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Company'), { target: { value: 'Kilo Masonry' } })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(await screen.findByText('The new prospect is not saved.')).toBeTruthy()
    expect(writesTo('prospects')).toHaveLength(0)
  })

  it('New Prospect with nobody named says what is missing and writes nothing', async () => {
    await deck('/prospects')
    press('New Prospect')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await settle()
    expect(writesTo('prospects')).toHaveLength(0)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(dialog.textContent).toMatch(/name|company/i)
  })

  it('New Prospect picked as another kind saves that kind and moves to its lane', async () => {
    await deck('/prospects')
    press('New Prospect')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('radio', { name: /A sub/ }))
    fireEvent.change(within(dialog).getByLabelText('Company'), { target: { value: 'Kilo Masonry' } })
    fireEvent.change(within(dialog).getByPlaceholderText('Concrete, Fire sprinkler'), { target: { value: 'Masonry, Concrete' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(writesTo('prospects', 'insert')).toHaveLength(1))
    expect(writesTo('prospects', 'insert')[0]?.payload).toMatchObject({ kind: 'sub', company_name: 'Kilo Masonry', trades: ['Masonry', 'Concrete'] })
    await waitFor(() => expect(where()).toBe('/prospects?tab=follow-up&kind=subs'))
  })

  it('Edit prospect on the card warms it with +, and Delete asks, deletes it and brings up the next card', async () => {
    await deck('/prospects')
    press('Edit prospect')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '+1' }))
    await waitFor(() => expect(writesTo('prospects', 'update')).toHaveLength(1))
    expect(writesTo('prospects', 'update')[0]).toMatchObject({ payload: { warmth_count: 1 }, filters: { id: 'cu-1' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete prospect' }))
    const ask = await screen.findByRole('alertdialog')
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(writesTo('prospects', 'delete')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(onCard()).toContain('Bravo Homes'))
    expect(screen.getByText('1 of 2')).toBeTruthy()
  })

  it('Edit prospect asks before it throws away a change', async () => {
    await deck('/prospects')
    press('Edit prospect')
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Company'), { target: { value: 'Alpha Builders West' } })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(await screen.findByText('The changes to this prospect are not saved.')).toBeTruthy()
    expect(writesTo('prospects')).toHaveLength(0)
  })

  it('Set callback opens its window and saves a callback for the card', async () => {
    await deck('/prospects')
    press('Set callback')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Set Call back date and time')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: /Save/ }))
    await waitFor(() => expect(writesTo('prospect_callbacks', 'insert')).toHaveLength(1))
    expect(writesTo('prospect_callbacks', 'insert')[0]?.payload).toMatchObject({ prospect_id: 'cu-1', title: 'Call back: Alpha Builders - Pat Sample' })
  })

  it('the card’s clock opens Timer history, and my time opens My time', async () => {
    world.timerEvents = [{ id: 't-1', created_at: '2026-10-01T12:00:00Z', timer_seconds: 125, button_name: 'next_prospect', prospect: { company_name: 'Alpha Builders' } }]
    await deck('/prospects')
    fireEvent.click(screen.getByTitle(/Click to view history/))
    const history = await screen.findByRole('dialog')
    expect(within(history).getByText('Timer history')).toBeTruthy()
    expect(await within(history).findByText('Next Prospect')).toBeTruthy()
    expect(within(history).getByText('02:05')).toBeTruthy()
    fireEvent.click(within(history).getByRole('button', { name: /Close/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    press('my time')
    const mine = await screen.findByRole('dialog')
    expect(within(mine).getByText('My time prospecting')).toBeTruthy()
  })

  it('Timer history with nothing timed says so', async () => {
    await deck('/prospects')
    fireEvent.click(screen.getByTitle(/Click to view history/))
    const history = await screen.findByRole('dialog')
    expect(await within(history).findByText('No events yet.')).toBeTruthy()
  })

  it('My time adds up the caller’s timed seconds', async () => {
    world.timerEvents = [{ id: 't-1', created_at: '2026-10-01T12:00:00Z', timer_seconds: 125, button_name: 'next_prospect', prospect: null }]
    await deck('/prospects')
    press('my time')
    const mine = await screen.findByRole('dialog')
    await waitFor(() => expect(within(mine).getAllByText('02:05')).toHaveLength(4))
    for (const label of ['Today', 'Yesterday', 'Last 7 days', 'Lifetime']) expect(within(mine).getByText(label)).toBeTruthy()
    fireEvent.click(within(mine).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('Set callback saves the typed note, and Cancel saves nothing', async () => {
    await deck('/prospects')
    press('Set callback')
    let dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(writesTo('prospect_callbacks')).toHaveLength(0)
    press('Set callback')
    dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-12-01' } })
    fireEvent.change(within(dialog).getByLabelText('Time'), { target: { value: '09:30' } })
    fireEvent.change(within(dialog).getByLabelText('Note'), { target: { value: '  discuss pricing ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(writesTo('prospect_callbacks', 'insert')).toHaveLength(1))
    expect(writesTo('prospect_callbacks', 'insert')[0]?.payload).toMatchObject({ note: 'discuss pricing', callback_date: new Date('2026-12-01T09:30').toISOString() })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('a template’s Copy puts the filled words on the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await deck('/prospects')
    fireEvent.click(await screen.findByRole('button', { name: 'No Response Email' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Hello Alpha Builders, this is Pat Office.'))
  })
})
