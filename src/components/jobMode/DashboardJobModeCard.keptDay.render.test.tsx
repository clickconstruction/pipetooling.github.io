// @vitest-environment jsdom
/**
 * The Job Mode card's kept day (punch list #183 PR 3). Today's schedule read is a controllable
 * promise and the kept-read store a mock, so each case says what the device kept and when the live
 * read lands or fails: the rail as read at 7:52 AM under the stamp while the read hangs, every
 * press held; the live rail once it lands; the stamp's Retry when the read fails over a kept day;
 * the panel, as before, with nothing kept. Made-up jobs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { KEPT_READ_SCHEMA, type KeptRead } from '../../lib/keptRead'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import { jobModeKeptKey, type JobModeKeptRow } from '../../lib/jobMode/keptDay'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'

const JOB_A = '00000000-0000-0000-0000-00000000aaaa'
const JOB_B = '00000000-0000-0000-0000-00000000bbbb'
const JOB_C = '00000000-0000-0000-0000-00000000cccc'

/**
 * Every read of today's blocks still waiting: the card's own, and the details section's once a
 * kept day gives it a job. `release()` answers them all, so the card's read is never left hanging
 * behind another's.
 */
let blocksPending: Array<() => void> = []
/** Today's schedule read answers with this once released; a result error while set. */
let blocksAnswer: { data: unknown; error: unknown } = { data: [], error: null }
let phone = false

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    const builder: Record<string, unknown> = {}
    const chainMethods = ['select', 'insert', 'update', 'eq', 'neq', 'is', 'in', 'or', 'not', 'order', 'range', 'limit', 'abortSignal', 'filter']
    for (const m of chainMethods) builder[m] = () => builder
    builder.single = () => {
      single = true
      return builder
    }
    builder.maybeSingle = () => {
      single = true
      return builder
    }
    const result = (): Promise<unknown> => {
      if (table === 'job_schedule_blocks') {
        return new Promise((resolve) => {
          blocksPending.push(() => resolve({ ...blocksAnswer, count: 0, status: 0 }))
        })
      }
      if (table === 'clock_sessions') return Promise.resolve({ data: single ? null : [], error: null, count: 0 })
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
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    },
  }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
vi.mock('../../hooks/useIsDigitalTwin', () => ({ useIsDigitalTwin: () => false }))
vi.mock('../../lib/impersonationSession', () => ({ isImpersonationSessionActive: () => false }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => phone }))

const readKept = vi.fn<(key: string) => Promise<KeptRead | null>>()
const writeKept = vi.fn<(kept: KeptRead) => Promise<void>>(async () => {})
vi.mock('../../lib/keptReadStore', () => ({
  readKeptRead: (key: string) => readKept(key),
  writeKeptRead: (kept: KeptRead) => writeKept(kept),
  clearKeptReads: vi.fn(async () => {}),
}))

import { renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { LedgerDisplayPrefixProvider } from '../../contexts/LedgerDisplayPrefixContext'
import DashboardJobModeCard from './DashboardJobModeCard'

const KEY = jobModeKeptKey(SMOKE_AUTH_USER_ID, denverCalendarDayKey(Date.now()))
const KEPT_AT = Date.now() - 11 * 60_000

function keptBlock(id: string, job_id: string, n: number, time_start: string) {
  return { id, job_id, time_start, time_end: '12:00', hcp_number: `${500 + n}`, click_number: null, job_name: `Kept Job ${n}`, job_address: `${n} Kept St`, service_type_id: null }
}
const keptRows: JobModeKeptRow[] = [
  { block: keptBlock('k1', JOB_A, 1, '08:00'), current: false, visited: true },
  { block: keptBlock('k2', JOB_B, 2, '10:30'), current: true, visited: false },
  { block: keptBlock('k3', JOB_C, 3, '14:00'), current: false, visited: false },
]
const stored = (): KeptRead<JobModeKeptRow> => ({ key: KEY, schema: KEPT_READ_SCHEMA, scopes: ['today'], readAt: KEPT_AT, rows: keptRows })

function liveBlocks() {
  const ledger = (n: number) => ({ hcp_number: `${600 + n}`, click_number: null, job_name: `Live Job ${n}`, job_address: `${n} Live St`, service_type_id: null })
  return [
    { id: 'blk-1', job_id: JOB_A, time_start: '08:00', time_end: '10:00', jobs_ledger: ledger(1) },
    { id: 'blk-2', job_id: JOB_B, time_start: '10:30', time_end: '13:00', jobs_ledger: ledger(2) },
  ]
}

function renderCard() {
  return renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <LedgerDisplayPrefixProvider authUserId={SMOKE_AUTH_USER_ID}>
        <DashboardJobModeCard userId={SMOKE_AUTH_USER_ID} onLeaveReport={() => {}} onTurnaway={() => {}} canClockOut />
      </LedgerDisplayPrefixProvider>
    </UpdateFocusOpenerBridgeProvider>,
  )
}

const release = async () => {
  await waitFor(() => expect(blocksPending.length).toBeGreaterThan(0))
  await act(async () => {
    const waiting = blocksPending
    blocksPending = []
    for (const answer of waiting) answer()
  })
}

beforeEach(() => {
  blocksPending = []
  blocksAnswer = { data: liveBlocks(), error: null }
  phone = false
  readKept.mockReset()
  readKept.mockResolvedValue(stored())
  writeKept.mockClear()
})
afterEach(() => {
  cleanup()
})

describe('DashboardJobModeCard, the kept day (#183 PR 3)', () => {
  it('draws the kept rail under the stamp while the read hangs, every press held, then the live rail once it lands and writes it', async () => {
    const { getByText, getAllByText, getByRole, getByTestId, queryByText, queryByRole } = renderCard()
    const stamp = await waitFor(() => getByRole('status'))
    expect(stamp.textContent).toMatch(/^Your day as read at \d{1,2}:\d{2} [AP]M · reading again…$/)
    expect(readKept).toHaveBeenCalledWith(KEY)
    expect(getByTestId('job-mode-card').hasAttribute('data-kept-read')).toBe(true)
    expect(queryByText('Loading Job Mode…')).toBeNull()
    // The rail as read: one done, one NOW, one upcoming; the header on the current job.
    expect(getByText(/Today · 1 of 3 done/)).toBeTruthy()
    expect(getByText('NOW')).toBeTruthy()
    expect(getByText(/Kept Job 3/)).toBeTruthy()
    // Held: the day's presses wait for the live read.
    const leave = getByRole('button', { name: 'Leave Report' }) as HTMLButtonElement
    expect(leave.disabled).toBe(true)
    expect(leave.className).toContain('keptPress')
    expect(leave.title).toBe('reading again…')
    const upcoming = getByRole('button', { name: /Go to .*Kept Job 3/ }) as HTMLButtonElement
    expect(upcoming.disabled).toBe(true)
    expect(upcoming.className).toContain('keptPress')
    expect((getByRole('button', { name: 'Clock out' }) as HTMLButtonElement).disabled).toBe(true)
    // A navigation stays live.
    expect((getByRole('button', { name: 'Materials on site' }) as HTMLButtonElement).disabled).toBe(false)
    expect(queryByRole('button', { name: 'Retry' })).toBeNull()

    await release()
    await waitFor(() => expect(queryByRole('status')).toBeNull())
    expect(getByTestId('job-mode-card').hasAttribute('data-kept-read')).toBe(false)
    expect(getByText(/Today · 0 of 2 done/)).toBeTruthy()
    expect(getAllByText(/Live Job 1/).length).toBeGreaterThan(0) // the header and the rail
    expect(queryByText(/Kept Job 3/)).toBeNull()
    expect(document.querySelector('.keptPress')).toBeNull()
    await waitFor(() => expect(writeKept).toHaveBeenCalledTimes(1))
    const written = writeKept.mock.calls[0]![0] as KeptRead<JobModeKeptRow>
    expect(written.key).toBe(KEY)
    expect(written.scopes).toEqual(['today'])
    expect(written.rows.map((r) => [r.block.job_id, r.current, r.visited])).toEqual([
      [JOB_A, false, false],
      [JOB_B, false, false],
    ])
  })

  it('on a phone the press bar is held whole while the kept day shows', async () => {
    phone = true
    const { getByRole, getByTestId } = renderCard()
    await waitFor(() => getByRole('status'))
    const bar = getByTestId('job-mode-press-bar')
    expect(bar.getAttribute('data-held')).toBe('true')
    // The buttons mute, not the bar: a translucent bar would show the card through it.
    expect(bar.className).not.toContain('keptPress')
    for (const b of Array.from(bar.querySelectorAll('button')) as HTMLButtonElement[]) {
      expect(b.disabled).toBe(true)
      expect(b.className).toContain('keptPress')
      expect(b.title).toBe('reading again…')
    }
    await release()
    await waitFor(() => expect(bar.getAttribute('data-held')).toBeNull())
    expect((getByTestId('job-mode-press-day-press') as HTMLButtonElement).disabled).toBe(false)
  })

  it('a failed read over the kept day keeps the rail up, the stamp reads could not read again with Retry, and Retry reads again', async () => {
    blocksAnswer = { data: null, error: { message: 'canceling statement due to statement timeout', code: '57014', details: null, hint: null } }
    const { getByRole, getByText, queryByText } = renderCard()
    await waitFor(() => getByRole('status'))
    await release()
    await waitFor(() => expect(getByRole('status').textContent).toMatch(/could not read again · Retry$/))
    expect(getByText(/Today · 1 of 3 done/)).toBeTruthy()
    // The stamp carries the retry; the panel is not drawn over a kept day.
    expect(queryByText(OFFLINE_ERROR_MESSAGE)).toBeNull()
    expect(writeKept).not.toHaveBeenCalled()

    blocksAnswer = { data: liveBlocks(), error: null }
    fireEvent.click(getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(getByRole('status').textContent).toMatch(/reading again…$/))
    await release()
    await waitFor(() => expect(getByText(/Today · 0 of 2 done/)).toBeTruthy())
  })

  it('with nothing kept the card reads Loading Job Mode… and a failed read draws the panel as before', async () => {
    readKept.mockResolvedValue(null)
    blocksAnswer = { data: null, error: { message: 'TypeError: Load failed', details: '', hint: '', code: '' } }
    const { getByText, queryByRole, getByTestId } = renderCard()
    expect(getByText('Loading Job Mode…')).toBeTruthy()
    expect(getByTestId('job-mode-card').hasAttribute('data-kept-read')).toBe(false)
    await release()
    await waitFor(() => expect(getByText(OFFLINE_ERROR_MESSAGE)).toBeTruthy())
    expect(queryByRole('status')).toBeNull()
  })
})
