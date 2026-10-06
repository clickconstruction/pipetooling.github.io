// @vitest-environment jsdom
/**
 * Days on the job (v2.4694): the summary line, the people chips that light one
 * person's days, a month grid per month worked with the people count in each
 * worked day, the day as a button that opens the day window, the range chips.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import JobHistoryCrewCalendar from './JobHistoryCrewCalendar'
import { buildCrewCalendar } from '../../lib/jobs/jobHistoryCalendar'
import type { ProjectsJobHistoryClockRow } from '../../lib/projectsJobHistoryData'

const JOB = 'job-1'
function row(work_date: string, user_id: string, extra: Partial<ProjectsJobHistoryClockRow> = {}): ProjectsJobHistoryClockRow {
  return { job_ledger_id: JOB, user_id, work_date, clocked_in_at: `${work_date}T12:00:00Z`, clocked_out_at: `${work_date}T20:00:00Z`, quick_add_minutes: null, ...extra }
}
const rows = [row('2026-07-14', 'u1'), row('2026-07-14', 'u2'), row('2026-08-05', 'u1'), row('2026-08-05', 'u2'), row('2026-08-05', 'u3'), row('2026-10-06', 'u1', { clocked_out_at: null })]
const names = { u1: 'Malachi', u2: 'Jose', u3: 'Edgar' }
const opts = { jobId: JOB, todayYmd: '2026-10-06', startYmd: '2026-01-01', endYmd: '2026-10-06' }

function draw(over: Partial<ComponentProps<typeof JobHistoryCrewCalendar>> = {}) {
  const props: ComponentProps<typeof JobHistoryCrewCalendar> = {
    calendar: buildCrewCalendar(rows, opts),
    namesById: names,
    todayYmd: '2026-10-06',
    range: { mode: 'whole', start: '2026-07-14', end: '2026-10-06' },
    onRangeMode: vi.fn(),
    onCustomRange: vi.fn(),
    pickedUserId: null,
    onPickUser: vi.fn(),
    onOpenDay: vi.fn(),
    ...over,
  }
  return { ...render(<JobHistoryCrewCalendar {...props} />), props }
}

describe('JobHistoryCrewCalendar', () => {
  it('the summary line, one month per month worked, the count in each worked day, a press opens the day', () => {
    const { container, props } = draw()
    expect(container.querySelector('[data-crew-summary]')?.textContent).toBe('3 days · Jul 14 → today · 3 people at most · 40 h')
    expect(Array.from(container.querySelectorAll('[data-crew-month]')).map((m) => m.getAttribute('data-crew-month'))).toEqual(['2026-07', '2026-08', '2026-10'])
    expect(container.querySelector('[data-crew-month="2026-10"] [data-crew-quiet]')?.textContent).toBe('after a quiet month')
    const aug5 = container.querySelector('[data-crew-day="2026-08-05"]')!
    expect(aug5.tagName).toBe('BUTTON')
    expect(aug5.getAttribute('data-crew-people')).toBe('3')
    expect(aug5.getAttribute('aria-label')).toBe('Wed Aug 5 · 3 people · 24 h · Malachi, Jose, Edgar')
    fireEvent.click(aug5)
    expect(props.onOpenDay).toHaveBeenCalledWith('2026-08-05')
    const aug6 = container.querySelector('[data-crew-day="2026-08-06"]')!
    expect(aug6.tagName).toBe('SPAN')
    expect(aug6.getAttribute('data-crew-people')).toBe('0')
    expect(container.querySelector('[data-crew-month="2026-08"] [data-crew-month-foot]')?.textContent).toBe('1 day · 24 h')
  })

  it('who: a chip per person with their days; pressing one picks them, pressing again clears', () => {
    const { container, props } = draw()
    const chips = container.querySelectorAll('[data-crew-person]')
    expect(chips.length).toBe(3)
    expect(chips[0]!.textContent).toBe('Malachi3 d · 16 h')
    fireEvent.click(chips[2]!)
    expect(props.onPickUser).toHaveBeenCalledWith('u3')
    const picked = draw({ pickedUserId: 'u3', calendar: buildCrewCalendar(rows, { ...opts, onlyUserId: 'u3' }) })
    expect((picked.container.querySelector('[data-crew-day="2026-07-14"]') as HTMLElement).style.opacity).toBe('0.28')
    expect((picked.container.querySelector('[data-crew-day="2026-08-05"]') as HTMLElement).style.opacity).toBe('1')
    fireEvent.click(picked.container.querySelector('[data-crew-person="u3"]')!)
    expect(picked.props.onPickUser).toHaveBeenCalledWith(null)
  })

  it('the range chips; Dates… shows From and To; nothing worked says so', () => {
    const { props } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Last 90d' }))
    expect(props.onRangeMode).toHaveBeenCalledWith(90)
    expect(screen.getByRole('button', { name: 'Whole job' }).getAttribute('aria-pressed')).toBe('true')
    const custom = draw({ range: { mode: 'custom', start: '2026-09-01', end: '2026-09-30' }, calendar: buildCrewCalendar(rows, { ...opts, startYmd: '2026-09-01', endYmd: '2026-09-30' }) })
    expect((screen.getAllByLabelText('Days on the job from')[0] as HTMLInputElement).value).toBe('2026-09-01')
    expect(custom.container.querySelector('[data-crew-summary]')?.textContent).toBe('No days worked in this range.')
    expect(custom.container.querySelector('[data-crew-months]')).toBeNull()
  })
})
