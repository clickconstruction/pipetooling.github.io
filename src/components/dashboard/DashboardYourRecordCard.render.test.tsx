// @vitest-environment jsdom
/**
 * Render smoke for punch list #217, field-8 (a prototype): the Your record card's *Week strip*
 * switch. Off by default, an item reads as before, the summed sentence under its title. On, the
 * item draws its pay week as a strip: a bar with its hours on the day worked, today's open session
 * hatched, the week rule under it, and the switch is remembered per person on the device. A dev
 * with `?sbs=1` on the URL sees both looks, labelled Today and With the strip, on the same read.
 * Made-up rows over a fake client; the three doors are stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import { shapeViewStorageKey } from '../prototypes/useShapeView'
import { installDomShims, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'

const todayYmd = denverCalendarDayKey(Date.now())

const rows = vi.hoisted(() => ({
  sessions: [] as Array<Record<string, unknown>>,
  openSessions: [] as Array<Record<string, unknown>>,
  jobs: [] as Array<Record<string, unknown>>,
  reports: [] as Array<Record<string, unknown>>,
}))

vi.mock('../../lib/supabase', () => {
  const builder = (data: () => unknown) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'gte', 'lte', 'is', 'in', 'limit', 'order']) b[m] = () => b
    b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve({ data: data(), error: null }).then(resolve, reject)
    return b
  }
  let sessionCalls = 0
  return {
    supabase: {
      from: (table: string) => {
        if (table === 'clock_sessions') {
          sessionCalls += 1
          const nth = sessionCalls
          return builder(() => (nth % 2 === 1 ? rows.sessions : rows.openSessions))
        }
        if (table === 'jobs_ledger') return builder(() => rows.jobs)
        if (table === 'reports') return builder(() => rows.reports)
        return builder(() => [])
      },
    },
  }
})
vi.mock('../../lib/overheadOfficeJobSettings', () => ({ fetchOverheadOfficeJobLedgerIdFromAppSettings: () => Promise.resolve(null) }))
vi.mock('./FieldPctUpdateModal', () => ({ default: () => null }))
vi.mock('../AdditionalReportModal', () => ({ default: () => null }))
vi.mock('../DashboardMyTimeDayEditorModal', () => ({ DashboardMyTimeDayEditorModal: () => null }))

const auth = vi.hoisted(() => ({ role: 'helpers' as string }))
vi.mock('../../hooks/useAuth', async () => {
  const m = await import('../../test/renderSmokeMocks')
  return { ...m.useAuthModuleMock(), useOptionalAuth: () => m.makeUseAuthValue({ role: auth.role }) }
})

import DashboardYourRecordCard from './DashboardYourRecordCard'

const STORAGE_KEY = shapeViewStorageKey('your-record-week-strip', SMOKE_AUTH_USER_ID)

function open(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/dashboard${search}`]}>
      <DashboardYourRecordCard userId={SMOKE_AUTH_USER_ID} role="helpers" displayName="Sam" isSalary={false} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  installDomShims()
  localStorage.clear()
  auth.role = 'helpers'
  // A closed 8.5 h session today on the job, and an open one clocked in 2.5 h ago; no report from this person.
  const now = Date.now()
  rows.sessions = [
    { id: 's-closed', job_ledger_id: 'j1', work_date: todayYmd, clocked_in_at: new Date(now - 11 * 3_600_000).toISOString(), clocked_out_at: new Date(now - 2.5 * 3_600_000).toISOString() },
    { id: 's-open', job_ledger_id: 'j1', work_date: todayYmd, clocked_in_at: new Date(now - 2.5 * 3_600_000).toISOString(), clocked_out_at: null },
  ]
  rows.openSessions = [rows.sessions[1]!]
  rows.jobs = [{ id: 'j1', hcp_number: '1318', click_number: null, job_name: 'Sample Retail Shell rough-in', job_address: '', pct_complete: 40, status: 'working' }]
  rows.reports = []
})
afterEach(cleanup)

describe('DashboardYourRecordCard · Week strip', () => {
  it('off by default: the item reads its summed sentence, no strip, and the switch is there', async () => {
    open()
    await screen.findByText('No report on 1318 Sample Retail Shell rough-in')
    expect(screen.getByText(/no field report from you yet/)).toBeTruthy()
    expect(screen.queryByTestId('your-record-week-strip')).toBeNull()
    expect(screen.getByTestId('dashboard-your-record').getAttribute('data-your-record-shape')).toBe('words')
    const sw = screen.getByTestId('shape-switch') as HTMLButtonElement
    expect(sw.getAttribute('aria-pressed')).toBe('false')
    expect(sw.textContent).toBe('Week strip')
  })

  it('on: the week draws as a strip with the day worked, today open and hatched, the week rule under it; remembered on the device', async () => {
    open()
    await screen.findByText('No report on 1318 Sample Retail Shell rough-in')
    fireEvent.click(screen.getByTestId('shape-switch'))
    const strip = await screen.findByTestId('your-record-week-strip')
    expect(screen.getByTestId('dashboard-your-record').getAttribute('data-your-record-shape')).toBe('strip')
    const days = within(strip).getAllByTestId('your-record-week-day')
    expect(days.length).toBe(7)
    const today = days.find((d) => d.getAttribute('data-today') === 'true')!
    expect(today.getAttribute('data-worked')).toBe('true')
    expect(today.getAttribute('data-open')).toBe('true')
    expect(today.textContent).toContain('8.5h')
    expect(today.getAttribute('title')).toMatch(/^Today · 8\.5 h on this job · 2\.5 h so far, still on the clock$/)
    expect(strip.getAttribute('aria-label')).toMatch(/8\.5 h \w+day; 2\.5 h so far today, still on the clock\. No report from you this pay week\.$/)
    expect(screen.getByText('no report from you this pay week')).toBeTruthy()
    expect(screen.queryByText(/no field report from you yet/)).toBeNull()
    expect(screen.getByText('Report')).toBeTruthy()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
    cleanup()
    open()
    await screen.findByTestId('your-record-week-strip')
    expect((screen.getByTestId('shape-switch') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')
  })

  it('a report day gets its dot', async () => {
    rows.reports = [{ job_ledger_id: 'j2', created_at: new Date().toISOString() }]
    rows.sessions.push({ id: 's-j2', job_ledger_id: 'j2', work_date: todayYmd, clocked_in_at: new Date(Date.now() - 6 * 3_600_000).toISOString(), clocked_out_at: new Date(Date.now() - 5 * 3_600_000).toISOString() })
    rows.jobs.push({ id: 'j2', hcp_number: '1400', click_number: null, job_name: 'Second job', job_address: '', pct_complete: null, status: 'working' })
    localStorage.setItem(STORAGE_KEY, '1')
    open()
    await screen.findByText('1400 Second job has no % complete')
    const strips = screen.getAllByTestId('your-record-week-strip')
    const j2 = strips.find((s) => s.getAttribute('aria-label')?.includes('a report'))!
    expect(j2).toBeTruthy()
    expect(within(j2).getAllByTestId('your-record-week-day').filter((d) => d.getAttribute('data-report') === 'true').length).toBe(1)
    expect(screen.getByText('nobody has said how far along it is')).toBeTruthy()
  })

  it('a dev with ?sbs=1 sees Today and With the strip on the same read; anyone else does not', async () => {
    auth.role = 'dev'
    open('?sbs=1')
    await screen.findByTestId('side-by-side')
    expect(screen.getByTestId('dashboard-your-record').getAttribute('data-your-record-shape')).toBe('side-by-side')
    expect(screen.getByText('Today')).toBeTruthy()
    expect(screen.getByText('With the strip')).toBeTruthy()
    expect(screen.getAllByText('No report on 1318 Sample Retail Shell rough-in').length).toBe(2)
    expect(screen.getByText(/no field report from you yet/)).toBeTruthy()
    expect(screen.getByTestId('your-record-week-strip')).toBeTruthy()
    cleanup()
    auth.role = 'helpers'
    open('?sbs=1')
    await screen.findByText('No report on 1318 Sample Retail Shell rough-in')
    await waitFor(() => expect(screen.queryByTestId('side-by-side')).toBeNull())
  })
})
