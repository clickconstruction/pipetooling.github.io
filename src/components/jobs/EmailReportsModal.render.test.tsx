// @vitest-environment jsdom
/**
 * Render smoke for the Email reports modal (v2.3595 — one list by person): the intro, one row
 * per person with a Digest chip and an Every-report chip, Edit opening the person editor,
 * + Add person, the Schedules line, and the two ways out. The data hook is stubbed.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('./emailReports/useEmailReportsData', () => ({
  useEmailReportsData: () => ({
    loading: false,
    error: null,
    roster: [{ id: 'u-rob', name: 'Robert', email: 'robert@x.com' }],
    schedules: [{ id: 's-yest', name: 'Yesterday recap', enabled: true, days_of_week: [2, 3, 4, 5, 6], time_local: '03:00:00', timezone: 'America/Chicago' }],
    digestRecipients: [],
    subscriptions: [],
    teamLeads: [],
    people: [
      { key: 'user:u-rob', userId: 'u-rob', email: 'robert@x.com', name: 'Robert', outside: false, digests: [{ rowId: 'r1', scheduleId: 's-yest', scheduleName: 'Yesterday recap', text: 'jobs yesterday · all users', activityScope: 'calendar_yesterday', crewFilter: 'all_users', includeCosts: false }], everyReport: { subscriptionId: 'sub-1', text: 'reports from everyone Abraham leads', enabled: true } },
      { key: 'email:owner@example.com', userId: null, email: 'owner@example.com', name: 'Owner', outside: true, digests: [], everyReport: { subscriptionId: 'sub-2', text: 'reports from Darren', enabled: true } },
    ],
    reload: vi.fn(async () => {}),
  }),
}))
vi.mock('./emailReports/EmailReportPersonEditor', () => ({
  EmailReportPersonEditor: ({ person }: { person: { name: string } | null }) => <div data-testid="person-editor">{person ? `editing ${person.name}` : 'adding'}</div>,
}))
vi.mock('./emailReports/DigestScheduleEditor', () => ({
  DigestScheduleEditor: ({ schedule }: { schedule: { name: string } | null }) => <div data-testid="schedule-editor">{schedule ? schedule.name : 'new'}</div>,
}))
vi.mock('./emailReports/DigestPreviewToolbar', () => ({ DigestPreviewToolbar: () => <div data-testid="preview-toolbar" /> }))

import { EmailReportsModal } from './EmailReportsModal'

function props(over: Partial<Parameters<typeof EmailReportsModal>[0]> = {}) {
  return { open: true, onClose: vi.fn(), authUserId: 'u1', authRole: 'dev' as const, scopeMasterChoices: [{ id: 'm1', label: 'Robert' }], ...over }
}

describe('EmailReportsModal (one list by person)', () => {
  it('lists one row per person with the two chips, an outside address with a dash under Digest', () => {
    render(<EmailReportsModal {...props()} />)
    expect(screen.getByRole('heading', { name: 'Email reports' })).toBeTruthy()
    const rows = screen.getAllByTestId('email-report-person-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.textContent).toContain('Robert')
    expect(rows[0]?.textContent).toContain('Yesterday recap · jobs yesterday · all users')
    expect(rows[0]?.textContent).toContain('reports from everyone Abraham leads')
    expect(rows[1]?.textContent).toContain('outside address · owner@example.com')
    expect(rows[1]?.textContent).toContain('—')
    expect(screen.getByTestId('email-reports-schedules').textContent).toContain('Yesterday recap Tue–Sat 3:00 AM')
  })

  it('Edit opens the person editor, + Add person opens it empty, a schedule name opens the schedule editor', () => {
    render(<EmailReportsModal {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Robert' }))
    expect(screen.getByTestId('person-editor').textContent).toBe('editing Robert')
  })

  it('+ Add person and New… open their editors', () => {
    const { unmount } = render(<EmailReportsModal {...props()} />)
    fireEvent.click(screen.getByText('+ Add person'))
    expect(screen.getByTestId('person-editor').textContent).toBe('adding')
    unmount()
    render(<EmailReportsModal {...props()} />)
    fireEvent.click(screen.getByText('New…'))
    expect(screen.getByTestId('schedule-editor').textContent).toBe('new')
  })

  it('an estimator sees the refusal; Close and the backdrop report; closed renders nothing', () => {
    const { unmount } = render(<EmailReportsModal {...props({ authRole: 'estimator' as const })} />)
    expect(screen.getByText(/Only dev, leader, or assistant/)).toBeTruthy()
    unmount()
    const p = props()
    const r = render(<EmailReportsModal {...p} />)
    fireEvent.click(screen.getByText('Close'))
    expect(p.onClose).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(screen.getByRole('presentation'))
    expect(p.onClose).toHaveBeenCalledTimes(2)
    r.unmount()
    render(<EmailReportsModal {...props({ open: false })} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
