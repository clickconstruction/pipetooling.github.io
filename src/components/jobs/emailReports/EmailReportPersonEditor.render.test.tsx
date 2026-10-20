// @vitest-environment jsdom
/**
 * Render smoke for one person's report email editor: its Save row is pinned to the foot of
 * the Email reports window's scrolling body, and what a save says shows inside that row.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { EmailReportPersonEditor } from './EmailReportPersonEditor'
import type { EmailReportPerson } from '../../../lib/reports/emailReportPeople'
import type { ScheduleRow } from './useEmailReportsData'

const schedules = [{ id: 's-yest', name: 'Yesterday recap', enabled: true, days_of_week: [2, 3, 4, 5, 6], time_local: '03:00:00', timezone: 'UTC' }] as unknown as ScheduleRow[]
const roster = [{ id: 'u-rob', name: 'Robert', email: 'robert@x.com' }]
const robert: EmailReportPerson = { key: 'user:u-rob', userId: 'u-rob', email: 'robert@x.com', name: 'Robert', outside: false, digests: [{ rowId: 'r1', scheduleId: 's-yest', scheduleName: 'Yesterday recap', text: 'jobs yesterday · all users', activityScope: 'calendar_yesterday', crewFilter: 'all_users', includeCosts: false }], everyReport: null }

function editor(person: EmailReportPerson | null, onCancel = vi.fn()) {
  return <EmailReportPersonEditor person={person} roster={roster} schedules={schedules} subscriptions={[]} people={person ? [person] : []} authUserId="u1" onDone={() => {}} onCancel={onCancel} />
}

describe('EmailReportPersonEditor · the Save row', () => {
  it('Save, Cancel and Remove sit in a row pinned to the foot of the scrolling body; the fields sit above it', () => {
    const onCancel = vi.fn()
    renderWithProviders(editor(robert, onCancel))
    const actions = screen.getByTestId('email-report-person-actions')
    expect(actions.style.position).toBe('sticky')
    expect(actions.style.bottom).toBe('0px')
    // Opaque, so the fields scrolling under it do not show through.
    expect(actions.style.background).toBe('var(--surface)')
    expect(actions.contains(screen.getByRole('button', { name: 'Save' }))).toBe(true)
    expect(actions.contains(screen.getByRole('button', { name: 'Cancel' }))).toBe(true)
    expect(actions.contains(screen.getByRole('button', { name: 'Remove' }))).toBe(true)
    // The row is the editor's last child, and no field is inside it.
    expect(screen.getByTestId('email-report-person-editor').lastElementChild).toBe(actions)
    expect(actions.querySelector('input, select')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('what a save says shows inside the pinned row, so it is never below the fold', () => {
    renderWithProviders(editor(null))
    const actions = screen.getByTestId('email-report-person-actions')
    expect(screen.queryByText('Pick a person.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(actions.contains(screen.getByText('Pick a person.'))).toBe(true)
  })
})
