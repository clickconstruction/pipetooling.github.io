// @vitest-environment jsdom
/**
 * v2.2222: primaries only reach their own Account-Man jobs (v2.2177 RLS), and
 * Recent Reports also lists reports on jobs that list them as superintendent and
 * the reports they wrote on any job — so the section must not offer them the
 * job-detail door (clickable job name + "Job detail" chip). Other roles keep both.
 *
 * 2026-11-19: a primary reads their own jobs' reports alone. The database decides
 * (migration 20261119040000_primary_scope_reports, held by the primary-scope-reports
 * SQL bed); the card lists what `list_reports_with_job_info` answers, counts from that
 * list alone, and says over it whose reports those are.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const report = {
  id: 'r1',
  template_name: 'Status Report',
  created_by_user_id: 'u1',
  created_by_name: 'Abraham',
  // Inside the card's 14-day window, whenever the suite runs.
  created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  field_values: { 'How complete is the job?': '100' },
  job_ledger_id: 'j1',
  project_id: null,
  job_display_name: 'Mike Holmby',
  job_hcp_number: '473',
  job_address: null,
}
/** What list_reports_with_job_info answers; the empty-state case empties it. */
const listed: { rows: unknown[] } = { rows: [report] }
/** True for a test that runs on a device held in the hand, where a report is marked opened with a swipe. */
const device = { handHeld: false }

vi.mock('../../lib/paintedMap/handHeld', () => ({ handHeld: () => device.handHeld }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { rpc: (name: string) => unknown }
  const origRpc = stub.rpc.bind(stub)
  stub.rpc = (name: string) =>
    name === 'list_reports_with_job_info' ? Promise.resolve({ data: listed.rows, error: null }) : origRpc(name)
  return { supabase: stub }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { DashboardRecentReportsSection } from './DashboardRecentReportsSection'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { UserRole } from '../../hooks/useAuth'

async function renderExpandedAs(role: UserRole) {
  renderWithProviders(<DashboardRecentReportsSection authUserId="me" role={role} />)
  await waitFor(() => expect(screen.getByText('Recent Reports')).toBeTruthy())
  fireEvent.click(screen.getByText('Recent Reports'))
  await waitFor(() => expect(screen.getByText(/Mike Holmby/)).toBeTruthy())
  fireEvent.click(screen.getByText(/Abraham/))
  await waitFor(() => expect(screen.getByText(/How complete is the job/)).toBeTruthy())
}

describe('DashboardRecentReportsSection — primary job-detail gating', () => {
  it('primary: job name is plain text and there is no Job detail chip', async () => {
    await renderExpandedAs('primary')
    expect(screen.queryByRole('button', { name: /Job details/ })).toBeNull()
    expect(screen.queryByText('Job detail')).toBeNull()
  })
})

describe('DashboardRecentReportsSection — no report yet (punch list #184, sweep C)', () => {
  it('the empty list links to Jobs → Reports, where New report is', async () => {
    listed.rows = []
    try {
      renderWithProviders(<DashboardRecentReportsSection authUserId="me" role="assistant" />)
      await waitFor(() => expect(screen.getByText('Recent Reports')).toBeTruthy())
      fireEvent.click(screen.getByText('Recent Reports'))
      const empty = await waitFor(() => {
        const el = document.querySelector('[data-empty-state]') as HTMLElement | null
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      expect(empty.textContent).toBe('No reports yet. Reports is where you write one.')
      expect(screen.getByRole('link', { name: 'Reports' }).getAttribute('href')).toBe('/jobs?tab=reports')
    } finally {
      listed.rows = [report]
    }
  })
})

describe('DashboardRecentReportsSection — a primary reads their own jobs\' reports (2026-11-19)', () => {
  const second = { ...report, id: 'r2', job_ledger_id: 'j2', job_display_name: 'Lloyd Field Bathroom Rough', created_by_name: 'Abraham' }

  it('the counts are the list the database answered, and no more', async () => {
    listed.rows = [report, second]
    const counts: Array<{ listed: number; fresh: number } | null> = []
    try {
      renderWithProviders(<DashboardRecentReportsSection authUserId="me" role="primary" onCounts={(c) => counts.push(c)} />)
      await waitFor(() => expect(counts[counts.length - 1]).toEqual({ listed: 2, fresh: 2 }))
      fireEvent.click(screen.getByText('Recent Reports'))
      await waitFor(() => expect(screen.getByText(/Lloyd Field Bathroom Rough/)).toBeTruthy())
      expect(screen.getByLabelText('2 new reports')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Mark 2 opened' })).toBeTruthy()
      expect(document.querySelectorAll('li').length).toBe(2)
    } finally {
      listed.rows = [report]
    }
  })

  it('the card says whose reports a primary reads, and says nothing to the office', async () => {
    renderWithProviders(<DashboardRecentReportsSection authUserId="me" role="primary" />)
    await waitFor(() => expect(screen.getByText('Recent Reports')).toBeTruthy())
    fireEvent.click(screen.getByText('Recent Reports'))
    await waitFor(() => expect(screen.getByText(/Mike Holmby/)).toBeTruthy())
    expect(document.querySelector('[data-reports-scope]')?.textContent).toBe('You see reports on jobs where you are the account manager or the superintendent, and reports you wrote.')
  })

  it('the office reads the list with no line', async () => {
    renderWithProviders(<DashboardRecentReportsSection authUserId="me" role="assistant" />)
    await waitFor(() => expect(screen.getByText(/Mike Holmby/)).toBeTruthy())
    expect(document.querySelector('[data-reports-scope]')).toBeNull()
  })

  it('a primary with no report on their jobs reads whose reports the list waits for', async () => {
    listed.rows = []
    try {
      renderWithProviders(<DashboardRecentReportsSection authUserId="me" role="primary" />)
      await waitFor(() => expect(screen.getByText('Recent Reports')).toBeTruthy())
      fireEvent.click(screen.getByText('Recent Reports'))
      const empty = await waitFor(() => {
        const el = document.querySelector('[data-empty-state]') as HTMLElement | null
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      expect(empty.textContent).toBe('No reports on your jobs yet. Reports is where you write one.')
    } finally {
      listed.rows = [report]
    }
  })
})

describe('DashboardRecentReportsSection — one heading row, a foot, and Opened (punch list #426)', () => {
  /** `n` reports an hour apart, the newest first, each on its own made-up job. */
  const filed = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ ...report, id: `n${i}`, job_ledger_id: `j${i}`, job_display_name: `Maple Court Lot ${i + 1}`, created_at: new Date(Date.now() - (i + 1) * 60 * 60 * 1000).toISOString() }))
  const open = async (rows: unknown[], role: UserRole = 'assistant') => {
    listed.rows = rows
    renderWithProviders(<DashboardRecentReportsSection authUserId="me" role={role} />)
    await waitFor(() => expect(screen.getByText('Maple Court Lot 1')).toBeTruthy())
  }
  const restore = () => {
    listed.rows = [report]
  }

  it('the heading holds the fold, the title and the badge, and nothing else', async () => {
    try {
      await open(filed(2))
      const head = document.querySelector('[data-dashboard-card-head]') as HTMLElement
      expect(head.querySelectorAll('button').length).toBe(1)
      expect(head.querySelector('a')).toBeNull()
      expect(head.textContent).toContain('2 new')
      // What acted on the whole list, and the two doors, are at the foot.
      expect(document.querySelector('[data-reports-foot="mark"]')?.textContent).toBe('2 new reportsMark 2 opened')
      const doors = document.querySelector('[data-reports-foot="doors"]') as HTMLElement
      expect(doors.textContent).toBe('Email reportsView all ›')
      expect(screen.getByRole('link', { name: 'View all ›' }).getAttribute('href')).toBe('/jobs?tab=reports')
    } finally {
      restore()
    }
  })

  it('a ninth new report is counted, and comes up when one of the eight is marked opened', async () => {
    try {
      await open(filed(9))
      expect(screen.getByLabelText('9 new reports')).toBeTruthy()
      expect(document.querySelectorAll('[data-reports-list] > li').length).toBe(8)
      expect(screen.queryByText('Maple Court Lot 9')).toBeNull()
      expect(screen.getByRole('button', { name: 'Mark 8 opened' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Mark opened, Maple Court Lot 1' }))
      await waitFor(() => expect(screen.getByText('Maple Court Lot 9')).toBeTruthy())
      expect(screen.getByLabelText('8 new reports')).toBeTruthy()
      expect(screen.queryByText('Maple Court Lot 1')).toBeNull()
      expect(screen.getByRole('button', { name: 'Opened, 1 report' })).toBeTruthy()
    } finally {
      restore()
    }
  })

  it('Mark opened says what it did with Undo, and Undo puts the report back as new', async () => {
    try {
      await open(filed(2))
      fireEvent.click(screen.getByRole('button', { name: 'Mark opened, Maple Court Lot 2' }))
      expect(await screen.findByText('Marked opened: Maple Court Lot 2.')).toBeTruthy()
      expect(screen.getByLabelText('1 new report')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
      await waitFor(() => expect(screen.getByLabelText('2 new reports')).toBeTruthy())
      expect(screen.queryByRole('button', { name: /^Opened,/ })).toBeNull()
    } finally {
      restore()
    }
  })

  it('with every report marked opened the list says nothing is new, and Mark unread brings one back', async () => {
    try {
      await open(filed(2))
      fireEvent.click(screen.getByRole('button', { name: 'Mark 2 opened' }))
      const empty = await waitFor(() => {
        const el = document.querySelector('[data-empty-state]') as HTMLElement | null
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      expect(empty.textContent).toBe('Nothing new to read. A report lands here when the crew files one.')
      expect(document.querySelector('[data-reports-foot="mark"]')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Opened, 2 reports' }))
      fireEvent.click(screen.getByRole('button', { name: 'Mark unread, Maple Court Lot 1' }))
      await waitFor(() => expect(screen.getByLabelText('1 new report')).toBeTruthy())
      expect(document.querySelectorAll('[data-reports-list] > li').length).toBe(1)
    } finally {
      restore()
    }
  })

  it('a press on the name opens the report in place, where Job detail is, and there is no Done', async () => {
    try {
      await open(filed(1))
      expect(screen.queryByRole('button', { name: /Job details/ })).toBeNull()
      fireEvent.click(screen.getByText('Maple Court Lot 1'))
      await waitFor(() => expect(screen.getByText(/How complete is the job/)).toBeTruthy())
      expect(screen.getByRole('button', { name: 'Job detail' })).toBeTruthy()
      expect(screen.queryByText(/Done/)).toBeNull()
      // Opened in place: it stays in the list with its tick, and no longer counts as new.
      expect(screen.getByLabelText('Opened')).toBeTruthy()
      expect(screen.queryByLabelText(/new report/)).toBeNull()
      expect(document.querySelector('[data-reports-foot="mark"]')?.textContent).toBe('Every report here is opened.')
    } finally {
      restore()
    }
  })

  it('a report older than 14 days is not on the card, which then says nothing is new', async () => {
    listed.rows = [{ ...report, id: 'old', created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() }]
    try {
      renderWithProviders(<DashboardRecentReportsSection authUserId="me" role="assistant" />)
      await waitFor(() => expect(screen.getByText('Recent Reports')).toBeTruthy())
      fireEvent.click(screen.getByText('Recent Reports'))
      await waitFor(() => expect(document.querySelector('[data-empty-state]')?.textContent).toBe('Nothing new to read. A report lands here when the crew files one.'))
      expect(screen.queryByText(/Mike Holmby/)).toBeNull()
    } finally {
      restore()
    }
  })

  it('on a device held in the hand, a swipe to the left marks a report opened and the foot says how', async () => {
    device.handHeld = true
    const pointer = (el: Element, type: string, x: number) => fireEvent(el, new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: 10, button: 0 }))
    try {
      await open(filed(2))
      expect(document.querySelector('[data-reports-foot="mark"]')?.textContent).toBe('Swipe a report left to mark it opened.Mark 2 opened')
      // No word press on the row: the strip's press carries its name for Tab and a screen reader.
      expect(document.querySelectorAll('[data-swipe-away-press]').length).toBe(0)
      const slide = document.querySelector('[data-report-row="n0"] [data-swipe-away-slide]') as HTMLElement
      pointer(slide, 'pointerdown', 300)
      pointer(slide, 'pointermove', 280)
      pointer(slide, 'pointermove', 150)
      pointer(slide, 'pointerup', 150)
      expect(await screen.findByText('Marked opened: Maple Court Lot 1.')).toBeTruthy()
      expect(screen.getByLabelText('1 new report')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Opened, 1 report' })).toBeTruthy()
      // The swipe did not also open the report.
      expect(screen.queryByText(/How complete is the job/)).toBeNull()
    } finally {
      device.handHeld = false
      restore()
    }
  })

  it('at a desk, Mark unread from Opened says what it did, and Undo marks the report opened again (v2.8603)', async () => {
    try {
      await open(filed(2))
      fireEvent.click(screen.getByRole('button', { name: 'Mark 2 opened' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Opened, 2 reports' }))
      expect(screen.getByText('You marked these opened. Mark unread puts one back.')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Mark unread, Maple Court Lot 1' }))
      expect(await screen.findByText('Marked unread: Maple Court Lot 1.')).toBeTruthy()
      await waitFor(() => expect(screen.getByLabelText('1 new report')).toBeTruthy())
      // The toast of Mark 2 opened is about both reports and still stands. The newest Undo is this report's.
      const undos = screen.getAllByRole('button', { name: 'Undo' })
      fireEvent.click(undos[undos.length - 1]!)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Opened, 2 reports' })).toBeTruthy())
      expect(screen.queryByLabelText('1 new report')).toBeNull()
    } finally {
      restore()
    }
  })

  it('on a device held in the hand, an opened report has no press: a swipe to the right marks it unread (v2.8603)', async () => {
    device.handHeld = true
    const pointer = (el: Element, type: string, x: number) => fireEvent(el, new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: 10, button: 0 }))
    try {
      await open(filed(2))
      fireEvent.click(screen.getByRole('button', { name: 'Mark 2 opened' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Opened, 2 reports' }))
      expect(screen.getByText('You marked these opened. Swipe one right to mark it unread.')).toBeTruthy()
      expect(document.querySelectorAll('[data-swipe-away-press]').length).toBe(0)
      const slide = document.querySelector('[data-reports-opened] [data-report-row="n0"] [data-swipe-away-slide]') as HTMLElement
      expect(slide.closest('[data-swipe-away-row]')?.getAttribute('data-swipe-away-row')).toBe('right')
      pointer(slide, 'pointerdown', 100)
      pointer(slide, 'pointermove', 120)
      pointer(slide, 'pointermove', 250)
      pointer(slide, 'pointerup', 250)
      expect(await screen.findByText('Marked unread: Maple Court Lot 1.')).toBeTruthy()
      await waitFor(() => expect(screen.getByLabelText('1 new report')).toBeTruthy())
      expect(screen.getByRole('button', { name: 'Opened, 1 report' })).toBeTruthy()
      // The swipe did not also open the report.
      expect(screen.queryByText(/How complete is the job/)).toBeNull()
    } finally {
      device.handHeld = false
      restore()
    }
  })
})
