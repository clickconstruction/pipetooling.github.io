// @vitest-environment jsdom
/**
 * Render smoke for a project's card (punch list #242, PR 3): the strip in each tone, the slider
 * in the budget's range, the reason box once the handle moved with Keep it dead until a reason,
 * the pinned over-budget state's words, the target line with back to the budget, and the title
 * as the door to the large view with its − / + and typed box.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

import { ProjectCard, ProjectCardBody } from './ProjectCard'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { projectPace, type ProjectRow } from '../../lib/jobs/projectsBoard'
import { DEFAULT_LINE_BUDGET_SETTINGS } from '../../lib/jobs/lineBudgets'
import type { JobChargeEvent } from '../../lib/jobChargesTimeline'

const row: ProjectRow = {
  id: 'job-1',
  hcp_number: '1044',
  click_number: null,
  job_name: 'The Lodge',
  job_address: '1 Hill Rd',
  status: 'working',
  pct_complete: 50,
  revenue: 27000,
  fixtures: [
    { id: 'r', name: 'Rough In', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: 100, sequence_order: 1 },
    { id: 't', name: 'Top Out', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: 50, sequence_order: 2 },
    { id: 's', name: 'Trim Set', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: null, sequence_order: 3 },
  ],
}
const settings = DEFAULT_LINE_BUDGET_SETTINGS
const job = (p: { pct?: number | null; hours: number; spent?: number }, target?: Parameters<typeof projectPace>[0]['target']) =>
  projectPace({
    job: { ...row, pct_complete: p.pct === undefined ? 50 : p.pct, budgetKind: null, budgetHours: null, labor: p.hours > 0 ? [{ ymd: '2026-10-20', who: 'Ana', hours: p.hours / 2 }, { ymd: '2026-10-21', who: 'Ana', hours: p.hours / 2 }] : [], values: [], spentPct: p.spent ?? null },
    target: target ?? null,
    checklist: { answered: 0, asked: 0 },
    settings,
  })
const pace = (p: { pct?: number | null; hours: number; spent?: number }) => job(p)
const events: JobChargeEvent[] = [
  { source: 'team_labor', dateKey: '2026-10-20', amount: 1080, label: 'a', who: 'Ana', hours: 24 },
  { source: 'team_labor', dateKey: '2026-10-21', amount: 1080, label: 'b', who: 'Ana', hours: 24 },
]
const noop = () => Promise.resolve(true)

describe('ProjectCard', () => {
  afterEach(cleanup)

  it('wears its tone and draws the strip with the slider in the budget\'s range', () => {
    const ahead = pace({ hours: 48 })
    renderWithProviders(<ProjectCard row={row} pace={ahead} target={null} events={events} valueEvents={[]} dollars canEdit onSetTarget={noop} onClearTarget={noop} />)
    expect(screen.getByTestId('project-card').dataset.tone).toBe('ahead')
    expect(screen.getByTestId('pace-strip')).toBeTruthy()
    const slider = screen.getByLabelText('Expected hours for J1044 · The Lodge') as HTMLInputElement
    expect(slider.min).toBe('48')
    // Rough In 90 h, Top Out 90 h, Trim Set 80 h at the company split.
    expect(slider.max).toBe('260')
    expect(slider.value).toBe('260')
    expect(screen.getByText('Job ›').getAttribute('href')).toBe('/jobs?edit=job-1')
  })

  it('opens the reason box once the handle moved, keeps only with a reason, and puts it back', async () => {
    const onSetTarget = vi.fn(() => Promise.resolve(true))
    renderWithProviders(<ProjectCard row={row} pace={pace({ hours: 48 })} target={null} events={events} valueEvents={[]} dollars canEdit onSetTarget={onSetTarget} onClearTarget={noop} />)
    expect(screen.queryByTestId('target-edit')).toBeNull()
    fireEvent.change(screen.getByLabelText('Expected hours for J1044 · The Lodge'), { target: { value: '200' } })
    expect(screen.getByTestId('target-edit')).toBeTruthy()
    const keep = screen.getByRole('button', { name: 'Keep it' }) as HTMLButtonElement
    expect(keep.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why the number moved'), { target: { value: 'framed in a week' } })
    expect(keep.disabled).toBe(false)
    fireEvent.click(keep)
    expect(onSetTarget).toHaveBeenCalledWith(200, 260, 'framed in a week')
    await screen.findByText('200 h')
    fireEvent.change(screen.getByLabelText('Expected hours for J1044 · The Lodge'), { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: 'Put it back' }))
    expect(screen.queryByTestId('target-edit')).toBeNull()
  })

  it('pins the slider at or over the budget and says the budget is the lever', () => {
    renderWithProviders(<ProjectCard row={row} pace={pace({ hours: 280 })} target={null} events={events} valueEvents={[]} dollars canEdit onSetTarget={noop} onClearTarget={noop} />)
    const slider = screen.getByLabelText('Expected hours for J1044 · The Lodge') as HTMLInputElement
    expect(slider.disabled).toBe(true)
    expect(screen.getByTestId('project-pinned').textContent).toBe('Over the labor budget by 20 h. The budget is the lever now, on the Costs tab, not the target.')
    expect(screen.getByTestId('project-card').dataset.tone).toBe('behind')
  })

  it('reads the target line with back to the budget for a setter, and a dead slider for a reader', () => {
    const target = { id: 't1', jobId: 'job-1', hours: 200, from: 260, by: 'Robert', at: '2026-11-01T20:00:00Z', why: 'framed in a week' }
    const withTarget = job({ hours: 48 }, target)
    const onClearTarget = vi.fn(() => Promise.resolve(true))
    const { unmount } = renderWithProviders(<ProjectCard row={row} pace={withTarget} target={target} events={events} valueEvents={[]} dollars canEdit onSetTarget={noop} onClearTarget={onClearTarget} />)
    expect(screen.getByTestId('project-target').textContent).toContain('Expected 200 h, set by Robert on Nov 1 (was 260 h): framed in a week')
    fireEvent.click(screen.getByRole('button', { name: 'back to the budget' }))
    expect(onClearTarget).toHaveBeenCalledTimes(1)
    unmount()
    renderWithProviders(<ProjectCard row={row} pace={withTarget} target={target} events={events} valueEvents={[]} dollars={false} canEdit={false} onSetTarget={noop} onClearTarget={noop} />)
    expect((screen.getByLabelText('Expected hours for J1044 · The Lodge') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'back to the budget' })).toBeNull()
  })

  it("says frozen at award on the glyph and the big line when the budget is the award's hours (the owner's call of 2026-11-09)", () => {
    const frozen = projectPace({ job: { ...row, pct_complete: 50, budgetKind: 'bid', budgetHours: 220, labor: [], values: [], spentPct: null }, target: null, checklist: { answered: 0, asked: 0 }, settings, score: { certifiedPct: 50, signedOn: '2026-11-08', subHours: 0, awardedHours: 180, awardedKind: 'bid' } })
    renderWithProviders(<ProjectCard row={row} pace={frozen} target={null} events={[]} valueEvents={[]} dollars canEdit onSetTarget={noop} onClearTarget={noop} />)
    expect(screen.getByTitle('◆ from the bid, frozen at award')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open J1044 · The Lodge large' }))
    expect(screen.getByTestId('project-card-big').textContent).toContain('180 h labor budget, frozen at award · expected 180 h')
  })

  it('opens the card large from its title, with − / + and a typed box', () => {
    renderWithProviders(<ProjectCard row={row} pace={pace({ hours: 48 })} target={null} events={events} valueEvents={[]} dollars canEdit onSetTarget={noop} onClearTarget={noop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open J1044 · The Lodge large' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByTestId('project-card-big')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'One crew day less' })).toBeTruthy()
    const typed = screen.getByLabelText('Expected hours, typed') as HTMLInputElement
    fireEvent.change(typed, { target: { value: '9000' } })
    // Typed past the edge clamps to it.
    expect(typed.value).toBe('260')
    fireEvent.click(screen.getByRole('button', { name: 'One crew day less' }))
    // The job read a 24 h crew day from its two worked days.
    expect(typed.value).toBe('236')
    expect(screen.getByTestId('pace-stage-words')).toBeTruthy()
  })

  it('reads a day in hours only for a viewer whose read carries no wages', () => {
    const labor: JobChargeEvent[] = [{ source: 'team_labor', dateKey: '2026-10-20', amount: 0, label: 'Ana', who: 'Ana', hours: 24 }]
    renderWithProviders(<ProjectCard row={row} pace={pace({ hours: 48 })} target={null} events={labor} valueEvents={[]} dollars={false} canEdit={false} onSetTarget={noop} onClearTarget={noop} />)
    fireEvent.click(screen.getAllByTestId('pace-day')[0]!)
    const day = screen.getByTestId('day-details')
    expect(day.textContent).toContain('24 h')
    expect(day.textContent).toContain('Ana')
    expect(day.textContent).not.toContain('$')
    expect(day.textContent).not.toContain('Bought that day')
  })

  it('reads a day in dollars for a payroll viewer', () => {
    renderWithProviders(<ProjectCard row={row} pace={pace({ hours: 48 })} target={null} events={events} valueEvents={[]} dollars canEdit onSetTarget={noop} onClearTarget={noop} />)
    fireEvent.click(screen.getAllByTestId('pace-day')[0]!)
    const day = screen.getByTestId('day-details')
    expect(day.textContent).toContain('24 h · $1,080')
    expect(day.textContent).toContain('Bought that day')
  })

  it('keeps the job window\'s door for the office, since a superintendent\'s RLS would not open most jobs', () => {
    renderWithProviders(<ProjectCardBody row={row} pace={pace({ hours: 48 })} target={null} events={events} valueEvents={[]} dollars={false} canEdit={false} onSetTarget={noop} onClearTarget={noop} />)
    expect(screen.queryByText('Job ›')).toBeNull()
  })
})
