// @vitest-environment jsdom
/**
 * The last day of work line (v2.4653): the day and its source, Change opens the box, a day before
 * the clock hours is refused, a good day saves the four columns and the caller re-reads, Back
 * clears them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { LienLastWorkDayLine } from './LienLastWorkDayLine'

const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ update }) } }))

afterEach(() => {
  cleanup()
  update.mockClear()
})

describe('LienLastWorkDayLine', () => {
  it('reads the creation day in amber when there are no hours, and saves a typed day with its reason', async () => {
    const onSaved = vi.fn()
    renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ created_at: '2026-07-01T15:00:00Z', last_work_date: null }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={onSaved} />)
    expect(screen.getByTestId('lien-last-work').getAttribute('data-source')).toBe('created')
    expect(screen.getByTestId('lien-last-work-day').textContent).toBe('Jul 1')
    expect(screen.getByTestId('lien-last-work-source').textContent).toBe("from the job's creation")
    fireEvent.click(screen.getByTestId('lien-last-work-change'))
    fireEvent.change(screen.getByLabelText('Last day of work'), { target: { value: '2026-08-14' } })
    fireEvent.blur(screen.getByLabelText('Last day of work'))
    fireEvent.change(screen.getByLabelText('Why the last day is set by hand'), { target: { value: 'Final walk-through with Dudley' } })
    fireEvent.click(screen.getByTestId('lien-last-work-save'))
    await settle()
    expect(update).toHaveBeenCalledTimes(1)
    const patch = (update.mock.calls[0] as unknown as [Record<string, unknown>])[0]
    expect(patch.lien_last_work_on).toBe('2026-08-14')
    expect(patch.lien_last_work_note).toBe('Final walk-through with Dudley')
    expect(patch.lien_last_work_set_by).toBe('u1')
    expect(typeof patch.lien_last_work_set_at).toBe('string')
    expect(onSaved).toHaveBeenCalledTimes(1)
  })
  it('a day before the clock hours is refused and nothing is written; a hand-set day shows who, when and why, and Back clears the four columns', async () => {
    const onSaved = vi.fn()
    const view = renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={onSaved} />)
    expect(screen.getByTestId('lien-last-work-source').textContent).toBe('from clock hours')
    fireEvent.click(screen.getByTestId('lien-last-work-change'))
    fireEvent.change(screen.getByLabelText('Last day of work'), { target: { value: '2026-08-14' } })
    fireEvent.blur(screen.getByLabelText('Last day of work'))
    fireEvent.click(screen.getByTestId('lien-last-work-save'))
    await settle()
    expect(update).not.toHaveBeenCalled()
    expect(screen.getByText('The clock hours already say Sep 24. The last day cannot be earlier.')).toBeTruthy()
    view.unmount()
    renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24', lien_last_work_on: '2026-09-30', lien_last_work_note: 'punch day', lien_last_work_set_at: '2026-10-06T14:00:00Z', lien_last_work_set_by: 'u1' }} setByName="Robert" todayYmd="2026-10-06" canEdit userId="u1" onSaved={onSaved} />)
    expect(screen.getByTestId('lien-last-work').getAttribute('data-source')).toBe('hand')
    expect(screen.getByTestId('lien-last-work-source').textContent).toBe('set by hand · Robert · Oct 6')
    expect(screen.getByTestId('lien-last-work-note').textContent).toBe('“punch day”')
    fireEvent.click(screen.getByTestId('lien-last-work-change'))
    fireEvent.click(screen.getByTestId('lien-last-work-clear'))
    await settle()
    expect((update.mock.calls[0] as unknown as [Record<string, unknown>])[0]).toEqual({ lien_last_work_on: null, lien_last_work_note: '', lien_last_work_set_at: null, lien_last_work_set_by: null })
  })
  it('without the right to edit there is no Change', () => {
    renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-10-06" canEdit={false} userId={null} onSaved={() => {}} />)
    expect(screen.queryByTestId('lien-last-work-change')).toBeNull()
  })
})
