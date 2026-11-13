// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeJobHoursWindow } from './BridgeJobHours'
import { JOB_HOURS_DAYS_SHOWN, NO_JOB_HOURS, jobHoursByJob, type JobHoursSession } from '../../lib/bridge/jobHours'

// Made-up people on a made-up job.
const dayLabel = (ymd: string): string => `Mar ${Number(ymd.slice(8))}`
const s = (over: Partial<JobHoursSession>): JobHoursSession => ({ jobId: 'j1', userId: 'u1', name: 'Dana Reyes', ymd: '2026-03-02', hours: 8, approved: true, ...over })

describe('BridgeJobHoursWindow', () => {
  it('shows the total, each person, and each day, and opens the percent window from its foot', () => {
    const hours = jobHoursByJob([s({}), s({ ymd: '2026-03-03', hours: 6 }), s({ userId: 'u2', name: 'Sam Holt', ymd: '2026-03-03', hours: 4, approved: false })]).get('j1')!
    const onClose = vi.fn()
    const onSetPct = vi.fn()
    renderWithProviders(<BridgeJobHoursWindow jobLabel="301 · Pine Row" hours={hours} dayLabel={dayLabel} onClose={onClose} onSetPct={onSetPct} jobHref="/jobs?tab=stages&edit=j1" />)
    const win = screen.getByRole('dialog', { name: 'Hours on 301 · Pine Row' })
    expect(screen.getByTestId('bridge-job-hours-lead').textContent).toBe('14 hours approved over 2 days, from Mar 2 to Mar 3.4 hours more still wait on approval. They are not in the total.')
    const people = screen.getAllByTestId('bridge-job-hours-person').map((p) => p.textContent)
    expect(people).toEqual(['Dana Reyes142Mar 3', 'Sam Holt0 +4*1Mar 3'])
    expect(screen.getAllByTestId('bridge-job-hours-day').map((d) => d.textContent)).toEqual(['Mar 3Dana Reyes6 hours', 'Mar 3Sam Holt4 hours*', 'Mar 2Dana Reyes8 hours'])
    expect(win.textContent).toContain('* Still waiting on approval.')
    expect(screen.queryByTestId('bridge-job-hours-all')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Set the percent' }))
    expect(onSetPct).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the newest days and the rest on a press', () => {
    const many = Array.from({ length: JOB_HOURS_DAYS_SHOWN + 5 }, (_, i) => s({ ymd: `2026-03-${String(i + 1).padStart(2, '0')}`, hours: 8 }))
    renderWithProviders(<BridgeJobHoursWindow jobLabel="301 · Pine Row" hours={jobHoursByJob(many).get('j1')!} dayLabel={dayLabel} onClose={() => {}} />)
    expect(screen.getAllByTestId('bridge-job-hours-day')).toHaveLength(JOB_HOURS_DAYS_SHOWN)
    fireEvent.click(screen.getByRole('button', { name: `Show all ${JOB_HOURS_DAYS_SHOWN + 5}` }))
    expect(screen.getAllByTestId('bridge-job-hours-day')).toHaveLength(JOB_HOURS_DAYS_SHOWN + 5)
    // No percent window to hand on to: no press for it.
    expect(screen.queryByTestId('bridge-job-hours-set-pct')).toBeNull()
  })

  it('says so when nobody has clocked time', () => {
    renderWithProviders(<BridgeJobHoursWindow jobLabel="302 · Spruce Hall" hours={NO_JOB_HOURS} dayLabel={dayLabel} onClose={() => {}} />)
    expect(screen.getByTestId('bridge-job-hours-lead').textContent).toBe('Nobody has clocked time on this job yet.')
    expect(screen.queryByTestId('bridge-job-hours-people')).toBeNull()
    expect(screen.queryByTestId('bridge-job-hours-days')).toBeNull()
  })
})
