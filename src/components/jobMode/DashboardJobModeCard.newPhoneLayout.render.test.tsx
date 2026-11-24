// @vitest-environment jsdom
/**
 * The Job Mode card under the new phone layout (`lib/phoneLayout`): one tick per device, off until someone
 * ticks it, and only ever on at a phone's width. A routed supabase stub feeds today's blocks, the open session,
 * the visited jobs and the job's customer, as in the press bar smoke; the viewport hook is mocked per case and the
 * tick is the device's stored one.
 *
 * The second half walks every state the card has. For each, the card is drawn the old way and then the new way,
 * and every press the old card offers must still be offered by the new one. Every job and person here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

const JOB_A = '00000000-0000-0000-0000-00000000aaaa'
const JOB_B = '00000000-0000-0000-0000-00000000bbbb'
const JOB_C = '00000000-0000-0000-0000-00000000cccc'
const JOB_X = '00000000-0000-0000-0000-00000000eeee'

const scenario: {
  blocks: Array<Record<string, unknown>>
  openSession: Record<string, unknown> | null
  visited: Array<{ job_ledger_id: string }>
  role: string
  phone: boolean
  closed: Set<string>
  /** The job's thread notes, as the thread's read returns them. */
  notes: Array<Record<string, unknown>>
} = { blocks: [], openSession: null, visited: [], role: 'helpers', phone: true, closed: new Set(), notes: [] }

const doors = vi.hoisted(() => ({ openJobDetail: vi.fn(), openInExternalBrowser: vi.fn(), navigate: vi.fn() }))

function ledgerJoin(n: number) {
  return { hcp_number: `${500 + n}`, click_number: null, job_name: `Smoke Job ${n}`, job_address: `${n} Test St`, service_type_id: null }
}

function makeBlocks(count = 3): Array<Record<string, unknown>> {
  return [
    { id: 'blk-1', job_id: JOB_A, time_start: '08:00', time_end: '10:00', jobs_ledger: ledgerJoin(1) },
    { id: 'blk-2', job_id: JOB_B, time_start: '10:30', time_end: '13:00', jobs_ledger: ledgerJoin(2) },
    { id: 'blk-3', job_id: JOB_C, time_start: '14:00', time_end: '17:00', jobs_ledger: ledgerJoin(3) },
  ].slice(0, count)
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'eq', 'neq', 'is', 'in', 'or', 'not', 'order', 'range', 'limit', 'abortSignal', 'filter']) builder[m] = () => builder
    builder.single = () => { single = true; return builder }
    builder.maybeSingle = () => { single = true; return builder }
    const result = () => {
      if (table === 'job_schedule_blocks') return Promise.resolve({ data: scenario.blocks, error: null, count: 0 })
      if (table === 'clock_sessions') {
        return single
          ? Promise.resolve({ data: scenario.openSession, error: null, count: 0 })
          : Promise.resolve({ data: scenario.visited, error: null, count: 0 })
      }
      if (table === 'jobs_ledger_thread_notes') return Promise.resolve({ data: single ? null : scenario.notes, error: null, count: 0 })
      // The job's own row: its labels for a job off today's schedule, and its customer for the details.
      if (table === 'jobs_ledger' && single) {
        return Promise.resolve({
          data: { id: JOB_X, hcp_number: '777', click_number: null, job_name: 'Off Schedule Job', job_address: '9 Elsewhere Rd', service_type_id: null, customer_name: 'Pat Customer', customer_phone: '6175550142', customer_email: 'pat@example.com', status: 'working', created_at: '2026-11-01T12:00:00Z', job_plans_link: null, development_id: null },
          error: null,
          count: 0,
        })
      }
      return Promise.resolve({ data: single ? null : [], error: null, count: 0 })
    }
    builder.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => result().then(f, r)
    builder.catch = (r?: (e: unknown) => unknown) => result().catch(r)
    builder.finally = (f?: () => void) => result().finally(f)
    return builder
  }
  const channel = () => {
    const ch: Record<string, unknown> = {}
    ch.on = () => ch
    ch.subscribe = () => ch
    ch.unsubscribe = () => Promise.resolve('ok')
    return ch
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      rpc: () => makeBuilder('__rpc__'),
      channel,
      removeChannel: () => {},
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    },
  }
})

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: scenario.role, profileName: 'Luis Ortega' }) }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => scenario.phone }))
vi.mock('../../hooks/useJobsClosedToMe', () => ({
  useJobsClosedToMe: () => ({ closed: scenario.closed }),
  useJobsLockedInLists: () => new Set<string>(),
  rereadJobsClosedToMe: async () => {},
}))
vi.mock('../../contexts/JobDetailModalContext', () => ({ useJobDetailModal: () => ({ openJobDetail: doors.openJobDetail }) }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => doors.openInExternalBrowser(url) }))
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))
vi.mock('../../hooks/useTallyUnlinkedCounts', () => ({ useTallyUnlinkedCounts: () => ({ unlinked: 2, staleUnlinked: 0, minAgeDays: 3, refetch: () => {} }) }))
vi.mock('../photos/JobPhotosWindowLazy', () => ({ JobPhotosWindowLazy: ({ job }: { job: { id: string } }) => <div data-testid="photos-window">{job.id}</div> }))
vi.mock('../jobs/JobPapersGate', () => ({
  JobPapersGate: ({ jobId }: { jobId: string }) => <div data-testid="papers-gate">{jobId}</div>,
  LockedJobLine: ({ jobId }: { jobId: string }) => <span>{jobId}</span>,
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => doors.navigate }
})

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { LedgerDisplayPrefixProvider } from '../../contexts/LedgerDisplayPrefixContext'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { foldedJobId } from '../../lib/phoneLayout/foldedJob'
import { NEW_PHONE_LAYOUT_STORAGE_KEY } from '../../lib/phoneLayout/newPhoneLayout'
import DashboardJobModeCard from './DashboardJobModeCard'

const onLeaveReport = vi.fn()
const onTurnaway = vi.fn()

function renderCard(opts: { canClockOut?: boolean; short?: boolean } = {}) {
  return renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <LedgerDisplayPrefixProvider authUserId="u1">
        <DashboardJobModeCard userId="u1" onLeaveReport={onLeaveReport} onTurnaway={onTurnaway} canClockOut={opts.canClockOut ?? true} short={opts.short} />
      </LedgerDisplayPrefixProvider>
    </UpdateFocusOpenerBridgeProvider>,
  )
}

/** The device's tick and the screen's width: the two halves of the one rule. */
function device(opts: { switchOn: boolean; phone: boolean }) {
  scenario.phone = opts.phone
  if (opts.switchOn) localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
  else localStorage.removeItem(NEW_PHONE_LAYOUT_STORAGE_KEY)
}

type Day = Partial<Pick<typeof scenario, 'blocks' | 'openSession' | 'visited' | 'role' | 'notes'>> & { closed?: string[] }
function day(d: Day) {
  Object.assign(scenario, { blocks: [], openSession: null, visited: [], role: 'helpers', notes: [], ...d, closed: new Set(d.closed ?? []) })
}

/** A thread note. `ago` is how long before now it was written, in hours. */
function threadNote(id: string, hoursAgo: number, body: string, author: string, authorUserId: string) {
  return { id, body, created_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(), author_user_id: authorUserId, author: { name: author } }
}

const clockedInMidDay = () => day({ blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: JOB_B, bid_id: null }, visited: [{ job_ledger_id: JOB_A }] })

const card = () => screen.getByTestId('job-mode-card')

/** A press as a person or a screen reader meets it. The plus a wide press carries and the mark at a line's end are not its name. */
const nameOf = (el: Element) =>
  (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '')
    .replace(/\s+/g, ' ')
    .replace(/^＋\s*/, '')
    .replace(/\s*[▸›]$/, '')
    .trim()

/** Every press on the card, the bar's too. */
const presses = () => Array.from(card().querySelectorAll('button, a[href], [role="tab"]')).map(nameOf).filter(Boolean)

/**
 * The clock every test here reads: the middle of today. The notes are written minutes and hours "ago", and in the
 * first minutes after the app's midnight "six minutes ago" was yesterday, so the row named the weekday and not
 * *today* and wore no New mark (a merge queue build failed on it at 06:01 UTC on 2026-11-24). Only the date is
 * held, so every wait and timer runs as it did.
 */
const MIDDAY = (() => {
  const d = new Date()
  d.setUTCHours(18, 0, 0, 0)
  return d
})()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: MIDDAY })
  localStorage.clear()
  for (const fn of Object.values(doors)) fn.mockClear()
  vi.mocked(recordNavClick).mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
  localStorage.clear()
  onLeaveReport.mockReset()
  onTurnaway.mockReset()
  document.documentElement.style.removeProperty('--job-mode-press-bar')
})

describe('DashboardJobModeCard: the press bar under the new phone layout', { timeout: 15_000 }, () => {
  it('switch on, on a phone: the five buttons share one row and run the card’s own presses', async () => {
    device({ switchOn: true, phone: true })
    clockedInMidDay()
    renderCard()
    await screen.findByText(/Today · 1 of 3 done/)
    const bar = await screen.findByTestId('job-mode-press-bar')
    expect(bar.getAttribute('data-one-row')).toBe('true')
    const ids = Array.from(bar.children).map((el) => (el as HTMLElement).dataset.testid)
    expect(ids).toEqual(['job-mode-press-turnaway', 'job-mode-press-pct-done', 'job-mode-press-clock-out', 'job-mode-press-leave-report', 'job-mode-press-day-press'])
    expect(screen.getByTestId('job-mode-press-day-press').textContent).toBe('On my way')

    fireEvent.click(screen.getByTestId('job-mode-press-leave-report'))
    expect(onLeaveReport).toHaveBeenCalledWith(expect.objectContaining({ id: JOB_B, jobName: 'Smoke Job 2' }))
    fireEvent.click(screen.getByTestId('job-mode-press-turnaway'))
    expect(onTurnaway).toHaveBeenCalledWith(expect.objectContaining({ id: JOB_B }))
  })

  it('switch off, on a phone: the bar is its two rows, as it was', async () => {
    device({ switchOn: false, phone: true })
    clockedInMidDay()
    renderCard()
    await screen.findByText(/Today · 1 of 3 done/)
    const bar = await screen.findByTestId('job-mode-press-bar')
    expect(bar.hasAttribute('data-one-row')).toBe(false)
    expect(bar.children).toHaveLength(2)
    expect(bar.children[0]!.children).toHaveLength(3)
    expect(bar.children[1]!.children).toHaveLength(2)
  })

  it('switch on, at a desk: no bar, and the card’s own grid of presses, as it was', async () => {
    device({ switchOn: true, phone: false })
    clockedInMidDay()
    renderCard()
    await screen.findByText(/Today · 1 of 3 done/)
    expect(screen.queryByTestId('job-mode-press-bar')).toBeNull()
    expect(screen.getByRole('button', { name: 'Leave Report' }).textContent).toMatch(/Leave\s*Report/)
    expect(screen.getByRole('button', { name: 'Turnaway — client not home or site not ready' })).toBeTruthy()
  })

  it('at a desk the card is the same markup whether or not the device has the tick', async () => {
    const draw = async (switchOn: boolean) => {
      device({ switchOn, phone: false })
      clockedInMidDay()
      const { container } = renderCard()
      await screen.findByText(/Today · 1 of 3 done/)
      await screen.findByLabelText('Call customer at 6175550142')
      const html = container.innerHTML.replace(/:r[0-9a-z]+:/g, ':id:')
      cleanup()
      return html
    }
    expect(await draw(true)).toBe(await draw(false))
  })
})

/** Every state the card has. `details` says whether the card shows a job's details, which is when it is laid out the new way. */
const STATES: Array<{ name: string; set: () => void; details: boolean; canClockOut?: boolean; dayPress: string }> = [
  { name: 'no job today', set: () => day({}), details: false, dayPress: 'Clock In' },
  { name: 'ready to start, one stop', set: () => day({ blocks: makeBlocks(1) }), details: true, dayPress: 'On my way' },
  { name: 'ready to start, several stops', set: () => day({ blocks: makeBlocks() }), details: true, dayPress: 'On my way' },
  { name: 'on my way', set: () => day({ blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: JOB_A, bid_id: null, travel_started_at: '2026-11-22T13:40:00Z', arrived_at: null } }), details: true, dayPress: 'I’m here' },
  { name: 'on site', set: () => day({ blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: JOB_A, bid_id: null, travel_started_at: '2026-11-22T13:40:00Z', arrived_at: '2026-11-22T14:02:00Z' } }), details: true, dayPress: 'On my way' },
  { name: 'clocked in mid-day, a stop done', set: clockedInMidDay, details: true, dayPress: 'On my way' },
  { name: 'clocked in on the one stop of the day', set: () => day({ blocks: makeBlocks(1), openSession: { id: 'sess-1', job_ledger_id: JOB_A, bid_id: null } }), details: true, dayPress: 'Wrap Up Day' },
  { name: 'the last job, hourly', set: () => day({ blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null }, visited: [{ job_ledger_id: JOB_A }, { job_ledger_id: JOB_B }] }), details: true, dayPress: 'Wrap Up Day' },
  { name: 'the last job, salaried', set: () => day({ blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null }, visited: [{ job_ledger_id: JOB_A }, { job_ledger_id: JOB_B }] }), details: true, canClockOut: false, dayPress: 'Last job of the day' },
  { name: 'clocked onto a job off the schedule', set: () => day({ blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: JOB_X, bid_id: null } }), details: true, dayPress: 'On my way' },
  { name: 'clocked onto a bid', set: () => day({ blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: null, bid_id: 'bid-1' } }), details: false, dayPress: 'On my way' },
  { name: 'a job its papers close', set: () => day({ blocks: makeBlocks(), closed: [JOB_A] }), details: false, dayPress: 'On my way' },
  { name: 'a superintendent on site', set: () => day({ blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: JOB_A, bid_id: null }, role: 'superintendent' }), details: true, dayPress: 'On my way' },
  { name: 'a subcontractor ready to start', set: () => day({ blocks: makeBlocks(1), role: 'subcontractor' }), details: true, dayPress: 'On my way' },
]

/** The card has read its day and, where it shows a job's details, the job's customer. */
async function settled(details: boolean, dayPress: string) {
  await waitFor(() => expect(screen.getByTestId('job-mode-press-day-press').textContent).toBe(dayPress))
  if (details && scenario.role !== 'subcontractor') await screen.findByLabelText('Call customer at 6175550142')
  else await waitFor(() => expect(screen.queryByText('Loading Job Mode…')).toBeNull())
}

describe('DashboardJobModeCard: every state, the old way and the new', { timeout: 30_000 }, () => {
  it.each(STATES)('$name: every press the card offers today is still offered', async (state) => {
    device({ switchOn: false, phone: true })
    state.set()
    renderCard({ canClockOut: state.canClockOut })
    await settled(state.details, state.dayPress)
    expect(card().hasAttribute('data-phone-card')).toBe(false)
    const old = presses()
    cleanup()

    device({ switchOn: true, phone: true })
    state.set()
    renderCard({ canClockOut: state.canClockOut })
    await settled(state.details, state.dayPress)
    // The card is laid out the new way exactly when it shows a job's details, and holds the squares for that job alone.
    expect(card().hasAttribute('data-phone-card')).toBe(state.details)
    expect(foldedJobId() != null).toBe(state.details)
    const now = presses()

    for (const press of old) {
      // The section's own Message the customer press and the card's door were two presses on one sheet: Text is that door.
      const kept = now.includes(press) || (press === 'Message the customer by text' && now.some((p) => p.startsWith('Message the customer')))
      expect(kept, `"${press}" is gone`).toBe(true)
    }
    // The day's press keeps its words, and the bar every button it had.
    expect(screen.getByTestId('job-mode-press-day-press').textContent).toBe(state.dayPress)
  })

  it.each(STATES.filter((s) => !s.details))('$name: the card is the card it was, and the squares above it stay', async (state) => {
    const draw = async (switchOn: boolean) => {
      device({ switchOn, phone: true })
      state.set()
      const { container } = renderCard({ canClockOut: state.canClockOut })
      await settled(false, state.dayPress)
      // The bar is its own layout (the first PR): the card around it is what is held here.
      const html = container.innerHTML.replace(/:r[0-9a-z]+:/g, ':id:').replace(/<div[^>]*data-testid="job-mode-press-bar"[\s\S]*$/, '')
      expect(foldedJobId()).toBeNull()
      cleanup()
      return html
    }
    expect(await draw(true)).toBe(await draw(false))
  })

  it('the short page keeps its own layout with the switch on', async () => {
    device({ switchOn: true, phone: true })
    day({ blocks: makeBlocks(1) })
    renderCard({ short: true })
    await waitFor(() => expect(screen.getByTestId('job-mode-press-day-press').textContent).toBe('On my way'))
    expect(card().hasAttribute('data-phone-card')).toBe(false)
    expect(foldedJobId()).toBeNull()
    expect(screen.getByTestId('job-mode-short-open-job')).toBeTruthy()
  })
})

describe('DashboardJobModeCard: the card laid out for a thumb', { timeout: 15_000 }, () => {
  async function drawNew(set: () => void) {
    device({ switchOn: true, phone: true })
    set()
    const result = renderCard()
    await screen.findByLabelText('Call customer at 6175550142')
    return result
  }

  it('opens on Call and Directions under the job’s name and address, 44 px each, and Call dials the number as it is kept', async () => {
    await drawNew(() => day({ blocks: makeBlocks(1) }))
    const row = screen.getByTestId('job-card-first-row')
    const names = Array.from(row.children).map((el) => el.textContent)
    // Not clocked in: nobody is offered Message the customer yet, so there is no Text.
    expect(names).toEqual(['📞Call', 'Directions'])
    for (const press of Array.from(row.children) as HTMLElement[]) expect(Number.parseFloat(press.style.minHeight)).toBeGreaterThanOrEqual(44)
    // The row is the first thing under the header.
    const header = screen.getByText('1 Test St').parentElement!
    expect(header.nextElementSibling!.contains(row)).toBe(true)

    fireEvent.click(within(row).getByLabelText('Call customer at 6175550142'))
    expect(doors.openInExternalBrowser).toHaveBeenCalledWith('tel:6175550142')
    fireEvent.click(within(row).getByLabelText('Directions to the job’s address'))
    expect(doors.openInExternalBrowser).toHaveBeenLastCalledWith('https://www.google.com/maps/dir/?api=1&destination=1%20Test%20St')
    expect(vi.mocked(recordNavClick).mock.calls.map((c) => [c[2], c[3]])).toContainEqual(['job-mode-row', '#directions'])
  })

  it('Text is the card’s own Message the customer door, only where the role and the day already offer it', async () => {
    // A helper clocked onto the job: the door is offered today, so it is the first row's third press.
    await drawNew(clockedInMidDay)
    const row = screen.getByTestId('job-card-first-row')
    const text = within(row).getByTestId('job-mode-message-door')
    expect(text.textContent).toBe('💬Text')
    expect(text.getAttribute('aria-label')).toBe('Message the customer')
    expect(Number.parseFloat(text.style.minHeight)).toBeGreaterThanOrEqual(44)
    // Drawn once: no second door, and no second press for the same sheet.
    expect(screen.getAllByTestId('job-mode-message-door')).toHaveLength(1)
    expect(screen.queryByTestId('job-mode-details-message-customer')).toBeNull()
    cleanup()

    // A leader clocked onto the same job is not offered the door today, so there is no Text.
    device({ switchOn: true, phone: true })
    clockedInMidDay()
    scenario.role = 'master_technician'
    renderCard()
    await screen.findByLabelText('Call customer at 6175550142')
    expect(screen.queryByTestId('job-mode-message-door')).toBeNull()
    expect(Array.from(screen.getByTestId('job-card-first-row').children).map((el) => el.textContent)).toEqual(['📞Call', 'Directions'])
  })

  it('the number reads as a phone number on one quiet line, and the email is a 44 px press that copies it', async () => {
    await drawNew(() => day({ blocks: makeBlocks(1) }))
    // The customer's name, then the number. The name is the part that is cut when the line is short of room.
    const line = screen.getByTestId('job-card-phone-line')
    expect(line.textContent).toBe('Pat Customer · (617) 555-0142')
    const name = within(line).getByTestId('job-card-phone-name')
    expect(name.style.textOverflow).toBe('ellipsis')
    expect(Number.parseFloat(name.style.minWidth)).toBe(0)
    const number = line.querySelector('b') as HTMLElement
    expect(number.textContent).toBe('(617) 555-0142')
    expect(number.style.flex).toMatch(/^(none|0 0 auto)$/)
    expect(number.style.whiteSpace).toBe('nowrap')
    expect(screen.queryByText('6175550142')).toBeNull()
    const copy = screen.getByTestId('job-mode-customer-email-copy')
    expect(copy.getAttribute('aria-label')).toBe('Copy the customer’s email address')
    expect(Number.parseFloat(copy.style.minHeight)).toBeGreaterThanOrEqual(44)
    expect(within(copy).getByTestId('job-mode-customer-email').textContent).toBe('pat@example.com')
    // Never a mailto: a tech does not email the customer from Job Mode.
    expect(card().querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('names the job once, and a day with one stop is one line: the time and where it stands in the day', async () => {
    await drawNew(() => day({ blocks: makeBlocks(1) }))
    expect(screen.getAllByText(/Smoke Job 1/)).toHaveLength(1)
    const rail = card().querySelector('[data-job-mode-rail="one"]') as HTMLElement
    expect(rail.textContent).toBe('8:00 AM · 1 of 1 today')
    expect(screen.queryByText(/Today · 0 of 1 done/)).toBeNull()
    // The line is still the stop's press, for a job whose papers are owed or a stop to head to.
    const stop = within(rail).getByRole('button')
    expect(stop.getAttribute('aria-label')).toBe('Go to J501 Smoke Job 1')
    expect(Number.parseFloat(stop.style.minHeight)).toBeGreaterThanOrEqual(44)
  })

  it('with several stops the list stays as it is, at a thumb’s height', async () => {
    await drawNew(clockedInMidDay)
    expect(screen.getByText(/Today · 1 of 3 done/)).toBeTruthy()
    expect(card().querySelector('[data-job-mode-rail="one"]')).toBeNull()
    const rows = ['Smoke Job 1', 'Smoke Job 2', 'Smoke Job 3'].map((n) => screen.getByText(new RegExp(`· ${n}$`)).closest('button') as HTMLElement)
    for (const r of rows) expect(Number.parseFloat(r.style.minHeight)).toBeGreaterThanOrEqual(40)
    expect(screen.getByText('NOW').style.fontSize).toBe('0.75rem')
  })

  it('draws the five rows in order, 44 px each, and each opens what it opened', async () => {
    await drawNew(() => day({ blocks: makeBlocks(1) }))
    const rows = Array.from(card().querySelectorAll('[data-job-card-row]')) as HTMLElement[]
    expect(rows.map((r) => r.dataset.jobCardRow)).toEqual(['materials', 'photos', 'updates', 'details', 'calendar'])
    expect(rows.map((r) => r.querySelector('button')!.firstElementChild!.firstChild!.textContent)).toEqual(['Materials on site', 'Photos', 'Job updates', 'Job details', 'Job calendar'])
    for (const r of rows) expect(Number.parseFloat((r.querySelector('button') as HTMLElement).style.minHeight)).toBeGreaterThanOrEqual(44)

    fireEvent.click(screen.getByTestId('job-mode-materials-on-site'))
    expect(doors.navigate).toHaveBeenCalledWith(`/tally?tab=on-site&job=${JOB_A}`)
    fireEvent.click(within(rows[1]!).getByRole('button'))
    expect(screen.getByTestId('photos-window').textContent).toBe(JOB_A)
    fireEvent.click(within(rows[3]!).getByRole('button', { name: 'Open job detail' }))
    expect(doors.openJobDetail).toHaveBeenCalledWith({ jobId: JOB_A })
    fireEvent.click(within(rows[4]!).getByRole('button', { name: 'Open the job calendar' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })

  it('Job updates opens in place, shut until pressed, and keeps what it holds while shut', async () => {
    await drawNew(() => day({ blocks: makeBlocks(1) }))
    const fold = card().querySelector('[data-job-card-row="updates"]') as HTMLElement
    const press = within(fold).getByTestId('job-card-updates')
    expect(press.getAttribute('aria-expanded')).toBe('false')
    const body = fold.lastElementChild as HTMLElement
    expect(body.style.display).toBe('none')
    // The thread is mounted while shut, so its presses are one press away and a note half typed is kept.
    expect(body.querySelector('[data-note-panel]')).toBeTruthy()
    fireEvent.click(press)
    expect(press.getAttribute('aria-expanded')).toBe('true')
    expect(body.style.display).toBe('')
    // The row says Job updates, so the thread does not say it again.
    expect(within(fold).getAllByText('Job updates')).toHaveLength(1)
  })

  it('the Job updates row says the newest note: who wrote it, its day and its first words', async () => {
    await drawNew(() =>
      day({
        blocks: makeBlocks(1),
        notes: [threadNote('n1', 300, 'The first note', 'Taunya', 'u-taunya'), threadNote('n2', 240, 'Is 25% right?\nSecond line', 'Robert', 'u-robert')],
      }),
    )
    const newest = await screen.findByTestId('job-card-updates-newest')
    expect(newest.textContent).toMatch(/^Robert, .+: Is 25% right\?$/)
    // One line, cut with an ellipsis where the row ends, at 13 px.
    const line = newest.parentElement as HTMLElement
    expect(line.style.whiteSpace).toBe('nowrap')
    expect(line.style.textOverflow).toBe('ellipsis')
    expect(line.style.fontSize).toBe('0.8125rem')
    // Ten days old with no look recorded: it is read on the row, and not called new.
    expect(screen.queryByTestId('job-card-updates-new')).toBeNull()
    // The rows are one column no wider than the card, so the one-line note is cut at the row's end and never widens them.
    const rows = card().querySelector('[data-job-card-rows]') as HTMLElement
    expect(rows.style.gridTemplateColumns).toBe('minmax(0, 1fr)')
  })

  it('marks the row New for another person’s note of today, and a press opens the thread, records the look and clears the mark', async () => {
    await drawNew(() => day({ blocks: makeBlocks(1), notes: [threadNote('n1', 0.1, 'Gate code is 4471', 'Robert', 'u-robert')] }))
    const mark = await screen.findByTestId('job-card-updates-new')
    expect(mark.textContent).toBe('New')
    expect(screen.getByTestId('job-card-updates-newest').textContent).toBe('Robert, today: Gate code is 4471')
    // The mark is the dot Message the customer wears, in the word's own colour, and the new note reads in strong words.
    expect(mark.style.color).toBe('var(--text-orange-700)')
    expect((mark.firstElementChild as HTMLElement).style.background).toBe('currentcolor')
    expect(screen.getByTestId('job-card-updates-newest').style.fontWeight).toBe('600')
    expect(screen.getByTestId('job-card-updates-newest').style.color).toBe('var(--text-strong)')
    const key = `pt_job_updates_look_u1_${JOB_A}`
    expect(localStorage.getItem(key)).toBeNull()

    const press = screen.getByTestId('job-card-updates')
    fireEvent.click(press)
    expect(press.getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByTestId('job-card-updates-new')).toBeNull()
    // The look is this person's, on this job, on this phone.
    expect(Date.parse(localStorage.getItem(key) ?? '')).toBeGreaterThan(Date.now() - 5_000)
    // Shut again, the row reads the note and is not marked: it was looked at.
    fireEvent.click(press)
    expect(screen.getByTestId('job-card-updates-newest').textContent).toBe('Robert, today: Gate code is 4471')
    expect(screen.queryByTestId('job-card-updates-new')).toBeNull()
    // Looked at, the note is the quiet line again.
    expect(screen.getByTestId('job-card-updates-newest').style.fontWeight).toBe('')
  })

  it('reads the look the phone kept: a note after it is new, a note before it is not', async () => {
    const key = `pt_job_updates_look_u1_${JOB_A}`
    const notes = [threadNote('n1', 30, 'Bring the lift', 'Robert', 'u-robert')]
    device({ switchOn: true, phone: true })
    day({ blocks: makeBlocks(1), notes })
    localStorage.setItem(key, new Date(Date.now() - 48 * 3_600_000).toISOString())
    renderCard()
    expect((await screen.findByTestId('job-card-updates-new')).textContent).toBe('New')
    cleanup()

    device({ switchOn: true, phone: true })
    day({ blocks: makeBlocks(1), notes })
    localStorage.setItem(key, new Date(Date.now() - 3_600_000).toISOString())
    renderCard()
    await screen.findByTestId('job-card-updates-newest')
    expect(screen.queryByTestId('job-card-updates-new')).toBeNull()
  })

  it('the viewer’s own note newest is read on the row and never marked New', async () => {
    await drawNew(() => day({ blocks: makeBlocks(1), notes: [threadNote('n1', 2, 'From the office', 'Robert', 'u-robert'), threadNote('n2', 0.1, 'On my way now', 'Luis Ortega', 'u1')] }))
    expect((await screen.findByTestId('job-card-updates-newest')).textContent).toBe('Luis Ortega, today: On my way now')
    expect(screen.queryByTestId('job-card-updates-new')).toBeNull()
  })

  it('with no note the row has no second line and no mark', async () => {
    await drawNew(() => day({ blocks: makeBlocks(1) }))
    await waitFor(() => expect(screen.getByTestId('job-card-updates').textContent).toContain('Job updates'))
    expect(screen.queryByTestId('job-card-updates-newest')).toBeNull()
    expect(screen.queryByTestId('job-card-updates-new')).toBeNull()
  })

  it('Paint a map is drawn once, in one row with Place on this job and My spend', async () => {
    await drawNew(() => day({ blocks: makeBlocks(1) }))
    expect(card().querySelectorAll('[data-paint-a-map]')).toHaveLength(1)
    const row = card().querySelector('[data-job-card-press-row]') as HTMLElement
    expect(Array.from(row.children).map((el) => el.textContent)).toEqual(['Paint a map', 'Place on this job', 'My spend2'])
    for (const press of Array.from(row.children) as HTMLElement[]) expect(Number.parseFloat(press.style.minHeight)).toBeGreaterThanOrEqual(44)
    const spend = within(row).getByRole('link', { name: 'My spend: 2 charges to put on a job' })
    expect(spend.getAttribute('href')).toBe('/tally?tab=transactions')
    // Photo of a spot keeps a press of its own.
    expect((card().querySelector('[data-job-spot]') as HTMLElement).textContent).toBe('Photo of a spot')
  })

  it('a subcontractor is shown who runs the job, never the customer’s number or email', async () => {
    device({ switchOn: true, phone: true })
    day({ blocks: makeBlocks(1), role: 'subcontractor' })
    renderCard()
    await waitFor(() => expect(screen.getByTestId('job-mode-press-day-press').textContent).toBe('On my way'))
    await screen.findByTestId('job-card-phone-line')
    expect(card().hasAttribute('data-phone-card')).toBe(true)
    expect(screen.queryByLabelText('Call customer at 6175550142')).toBeNull()
    expect(screen.queryByTestId('job-mode-customer-email')).toBeNull()
    expect(card().textContent).not.toContain('555-0142')
  })

  it('marks the card for the floor the stylesheet holds: no press under 40 px, no words under 12 px', async () => {
    await drawNew(() => day({ blocks: makeBlocks(1) }))
    expect(card().className).toBe('jobModeCardPhone')
    cleanup()
    device({ switchOn: false, phone: true })
    day({ blocks: makeBlocks(1) })
    renderCard()
    await screen.findByLabelText('Call customer at 6175550142')
    expect(card().hasAttribute('class')).toBe(false)
  })
})
