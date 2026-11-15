// @vitest-environment jsdom
/**
 * The crew's job window on a phone (punch list #355, direction C, the crew half, v2.7355): the plain window at
 * 375 px reads in PR B's order. The name first with the status, a quiet line, ⋯ over ✕; then Where · Photos · Who ·
 * Today's work · What's happening; the rest folded under More on this job. The office's reads leave the crew's
 * phone (the two dates, the Status rail, the foot's words), a helper gets no email row and no Parts cost, the
 * superintendent keeps both, and the bar is untouched. On a desk nothing changes. Today's work (v2.7376) is the open
 * stage as a card on a job with two stages or more, then Plans and Materials on site as folds.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import DetailJobModal from './DetailJobModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { CREW_FOLDS_KEY } from '../../lib/jobs/jobWindowCrewPhone'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

// The job's stages as `list_job_stage_progress` answers them; a test sets them before it renders.
const stages = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }))
// Our lead on the job as `job_lead_contact` answers; none until a test names one.
const lead = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  // The limited read answers the job's row, as it does for a role on the crew; every other read is empty.
  const ledger = () => {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit']) builder[m] = () => builder
    builder.maybeSingle = () =>
      Promise.resolve({
        data: {
          id: 'job-1',
          hcp_number: '9001',
          job_name: 'Whitfield water heater',
          job_address: '1208 Mesquite Ln, Cedar Bend, TX',
          google_drive_link: null,
          job_pictures_link: null,
          job_plans_link: null,
          revenue: 1850,
          project_id: null,
          customer_id: 'cust-1',
          customer_name: 'Dana Whitfield',
          customer_email: 'dana@whitfield.example',
          customer_phone: '(512) 555-0142',
          last_work_date: null,
          status: 'working',
        },
        error: null,
      })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      ...stub,
      from: (table: string) => (table === 'jobs_ledger' ? ledger() : stub.from()),
      rpc: (fn: string) =>
        fn === 'list_job_stage_progress' ? Promise.resolve({ data: stages.rows, error: null }) : fn === 'job_lead_contact' ? Promise.resolve({ data: lead.rows, error: null }) : stub.rpc(),
    },
  }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers', profileName: 'Luis Ortega' })
})

let narrowMatches = false
function widthQueryMatches(query: string): boolean {
  const width = narrowMatches ? 375 : 1280
  const max = /\(max-width:\s*(\d+)px\)/.exec(query)
  const min = /\(min-width:\s*(\d+)px\)/.exec(query)
  if (!max && !min) return false
  return (!max || width <= Number(max[1])) && (!min || width >= Number(min[1]))
}
beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  window.matchMedia = ((query: string) => ({
    matches: widthQueryMatches(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})
afterEach(() => {
  narrowMatches = false
  stages.rows = []
  lead.rows = []
  localStorage.removeItem(CREW_FOLDS_KEY)
})

const assigned = [{ id: 'job-1', hcp_number: '9001', job_name: 'Whitfield water heater', job_address: '1208 Mesquite Ln, Cedar Bend, TX', google_drive_link: null, job_pictures_link: null, job_plans_link: null, revenue: 1850, project_id: null }]
const block = { workDate: '2099-03-14', timeStart: '08:00:00', timeEnd: '12:00:00', note: 'Gate code 4471' }

async function renderPlainWindow(input: { phone: boolean; role?: string; scheduled?: boolean }) {
  narrowMatches = input.phone
  const onClose = vi.fn()
  renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <DetailJobModal open onClose={onClose} jobId="job-1" authRole={input.role ?? 'helpers'} assignedJobsRows={assigned} scheduleContext={input.scheduled ? block : null} />
    </UpdateFocusOpenerBridgeProvider>,
  )
  await settle()
  await screen.findByRole('heading', { name: /Whitfield water heater/ })
  return onClose
}

const folds = () => [...document.querySelectorAll('[data-phone-fold]')].map((el) => el.getAttribute('data-phone-fold'))
const sections = () => [...document.querySelectorAll('[data-phone-section] h3')].map((el) => el.textContent)

describe('DetailJobModal · the crew’s window on a phone', () => {
  it('reads the name first with the status and a quiet line, and ✕ closes it', async () => {
    const onClose = await renderPlainWindow({ phone: true })
    const head = screen.getByTestId('crew-window-head')
    expect(within(head).getByRole('heading', { name: /Whitfield water heater/ })).toBeTruthy()
    await waitFor(() => expect(within(head).getByTestId('crew-window-status').textContent).toBe('Working'))
    expect(within(head).getByTestId('crew-window-quiet-line').textContent).toBe('9001 · Dana Whitfield')
    // One Close on the screen, in the title; the foot's Close is gone.
    const closes = screen.getAllByRole('button', { name: 'Close job detail' })
    expect(closes).toHaveLength(1)
    expect(parseFloat(closes[0]!.style.height)).toBeGreaterThanOrEqual(44)
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    fireEvent.click(closes[0]!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('names its doors in the ⋯ sheet', async () => {
    await renderPlainWindow({ phone: true })
    fireEvent.click(screen.getByRole('button', { name: 'More on this job' }))
    const sheet = await screen.findByRole('menu', { name: 'More on this job' })
    expect(within(sheet).getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Share the job'])
  })

  it('reads Where · Photos · Who · Today’s work · What’s happening · More on this job, the block it was opened from first', async () => {
    await renderPlainWindow({ phone: true, scheduled: true })
    await waitFor(() => expect(sections()).toEqual(['Where', 'Photos', 'Who', "Today's work", "What's happening", 'More on this job']))
    const row = screen.getByTestId('crew-window-block')
    expect(row.textContent).toContain('Next on site')
    expect(row.textContent).toContain('8:00 AM')
    expect(row.textContent).toContain('Gate code 4471')
    // The number is written out as a press that calls.
    expect(screen.getByRole('button', { name: 'Call (512) 555-0142' })).toBeTruthy()
  })

  it('leaves out What’s happening with no block and nothing written', async () => {
    await renderPlainWindow({ phone: true })
    await waitFor(() => expect(sections()).toEqual(['Where', 'Photos', 'Who', "Today's work", 'More on this job']))
  })

  it('Today’s work on a one-line job is Plans and Materials on site, folded, with no stage card', async () => {
    await renderPlainWindow({ phone: true })
    const work = await screen.findByTestId('crew-window-work')
    expect(within(work).queryByTestId('crew-window-stage')).toBeNull()
    expect([...work.querySelectorAll('[data-phone-fold]')].map((el) => el.getAttribute('data-phone-fold'))).toEqual(['Plans', 'Materials on site'])
    // The fold opens in place, the phone remembers it, and its press leads to the crew's own screen for the boxes.
    const materials = within(work).getByRole('button', { name: /^Materials on site/ })
    expect(materials.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(materials)
    expect(materials.getAttribute('aria-expanded')).toBe('true')
    expect(JSON.parse(localStorage.getItem(CREW_FOLDS_KEY) ?? '[]')).toEqual(['materials'])
    expect(within(work).getByTestId('job-window-materials-door').textContent).toBe('Open Materials on site')
  })

  it('Today’s work names the open stage with the job’s bar on a job with stages', async () => {
    stages.rows = [
      { fixture_id: 'f1', name: 'Rough In', stage_kind: 'order', sequence_order: 1, weight_pct: 40, progress_pct: 100, draw_paid: false },
      { fixture_id: 'f2', name: 'Top Out', stage_kind: 'order', sequence_order: 2, weight_pct: 30, progress_pct: 50, draw_paid: false },
      { fixture_id: 'f3', name: 'Trim Set', stage_kind: 'order', sequence_order: 3, weight_pct: 30, progress_pct: null, draw_paid: false },
    ]
    await renderPlainWindow({ phone: true })
    const card = await screen.findByTestId('crew-window-stage')
    expect(card.textContent).toContain('Top Out')
    expect(card.textContent).toContain('Rough In done · Top Out 50% · Trim Set not started')
    expect(within(card).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('55')
  })

  it('takes the office’s reads off a helper’s phone and gives no email row and no Parts cost', async () => {
    await renderPlainWindow({ phone: true })
    await waitFor(() => expect(folds()).toEqual(['Plans', 'Materials on site', 'Notes and reports']))
    expect(screen.queryByText('Last bill date')).toBeNull()
    expect(screen.queryByText('Last work date')).toBeNull()
    expect(screen.queryByText('Payments and invoices are not shown in this view.')).toBeNull()
    expect(screen.queryByTestId('job-target-line')).toBeNull()
    expect(screen.queryByRole('button', { name: /dana@whitfield\.example/ })).toBeNull()
    expect(screen.queryByTestId('job-window-who-portal')).toBeNull()
  })

  it('keeps the email row and Parts cost for the superintendent, folded', async () => {
    await renderPlainWindow({ phone: true, role: 'superintendent' })
    await waitFor(() => expect(folds()).toEqual(['Plans', 'Materials on site', 'Notes and reports', 'Parts cost']))
    expect(screen.getByRole('button', { name: 'Copy dana@whitfield.example' })).toBeTruthy()
    // A fold opens in place and the phone remembers it.
    const parts = screen.getByRole('button', { name: 'Parts cost' })
    expect(parts.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(parts)
    expect(parts.getAttribute('aria-expanded')).toBe('true')
    expect(JSON.parse(localStorage.getItem(CREW_FOLDS_KEY) ?? '[]')).toEqual(['parts'])
  })

  it('a sub sees who runs the job for us and their number, never the customer’s', async () => {
    lead.rows = [{ lead_user_id: 'u-9', lead_name: 'Mo Reyes', lead_phone: '512 555 0100', lead_role: 'master_technician' }]
    await renderPlainWindow({ phone: true, role: 'subcontractor' })
    const who = await screen.findByTestId('job-window-who')
    expect(who.textContent).toContain('Mo Reyes')
    expect(within(who).getByTestId('job-window-who-note').textContent).toBe('runs this job')
    expect(within(who).getByRole('button', { name: 'Call 512 555 0100' })).toBeTruthy()
    // The customer stays on the title's quiet line; their number and email are nowhere on the screen.
    expect(screen.getByTestId('crew-window-quiet-line').textContent).toBe('9001 · Dana Whitfield')
    expect(document.body.textContent).not.toContain('(512) 555-0142')
    expect(document.body.textContent).not.toContain('dana@whitfield.example')
  })

  it('a sub on a job with no lead is pointed at the office, not at the customer', async () => {
    await renderPlainWindow({ phone: true, role: 'subcontractor' })
    const who = await screen.findByTestId('job-window-who')
    expect(who.textContent).toContain('The office')
    expect(within(who).getByTestId('job-window-who-note').textContent).toBe('no one of ours is on this job yet')
    expect(document.body.textContent).not.toContain('(512) 555-0142')
  })

  it('a sub on a desk reads our lead under the customer’s name', async () => {
    lead.rows = [{ lead_user_id: 'u-9', lead_name: 'Mo Reyes', lead_phone: '512 555 0100', lead_role: 'master_technician' }]
    await renderPlainWindow({ phone: false, role: 'subcontractor' })
    const line = await screen.findByTestId('customer-panel-our-lead')
    expect(line.textContent).toBe('Mo Reyes runs this job')
    expect(screen.getByRole('link', { name: 'Call Mo Reyes' }).textContent).toContain('512 555 0100')
    expect(document.body.textContent).not.toContain('(512) 555-0142')
    expect(document.body.textContent).not.toContain('dana@whitfield.example')
  })

  it('keeps the bar: Arrived · Leave report · Note', async () => {
    await renderPlainWindow({ phone: true })
    const bar = await screen.findByRole('toolbar', { name: 'Job actions' })
    expect(within(bar).getAllByRole('button').map((b) => b.textContent)).toEqual(['Arrived', 'Leave report', 'Note'])
  })

  it('on a desk the window is as it was: the number chip, the dates, the foot’s Close', async () => {
    await renderPlainWindow({ phone: false })
    expect(screen.queryByTestId('crew-window-head')).toBeNull()
    expect(document.querySelectorAll('[data-phone-section]')).toHaveLength(0)
    expect(folds()).toEqual([])
    expect(await screen.findByText('Last bill date')).toBeTruthy()
    expect(screen.getByText('Payments and invoices are not shown in this view.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(screen.getByTestId('job-target-line')).toBeTruthy()
  })
})
