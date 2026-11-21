// @vitest-environment jsdom
/**
 * The last day of work line (v2.4676): the day and its source, Change opens the box, a day before
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
    fireEvent.click(screen.getByTestId('lien-last-work-save'))
    // Save the day opens the window (v2.4717): the shift from the creation day, the dates, and the reason asked there.
    expect(screen.getByTestId('lien-last-work-confirm').getAttribute('data-verdict')).toBe('fine')
    expect(screen.getByTestId('lien-last-work-shift').textContent).toBe("Last day of work Aug 14 — 44 days later than the job's creation (Jul 1).")
    expect(screen.queryByTestId('lien-last-work-diff')).toBeNull()
    expect((screen.getByTestId('lien-last-work-confirm-set') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why the last day is set by hand'), { target: { value: 'Final walk-through with Dunmere' } })
    expect((screen.getByTestId('lien-last-work-confirm-set') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByTestId('lien-last-work-confirm-set'))
    await settle()
    expect(update).toHaveBeenCalledTimes(1)
    const patch = (update.mock.calls[0] as unknown as [Record<string, unknown>])[0]
    expect(patch.lien_last_work_on).toBe('2026-08-14')
    expect(patch.lien_last_work_note).toBe('Final walk-through with Dunmere')
    expect(patch.lien_last_work_set_by).toBe('u1')
    expect(typeof patch.lien_last_work_set_at).toBe('string')
    expect(onSaved).toHaveBeenCalledTimes(1)
  })
  it('the window shows the dates that move on a desk job, lit where they change', () => {
    renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-02' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} jobLabel="922 · Michael Palvern" clockMonths={['2026-07', '2026-09']} propertyKind="residential" />)
    fireEvent.click(screen.getByTestId('lien-last-work-change'))
    fireEvent.change(screen.getByLabelText('Last day of work'), { target: { value: '2026-10-02' } })
    fireEvent.blur(screen.getByLabelText('Last day of work'))
    fireEvent.click(screen.getByTestId('lien-last-work-save'))
    const rows = Array.from(screen.getByTestId('lien-last-work-diff').querySelectorAll('tbody tr'))
    expect(rows.map((r) => r.getAttribute('data-changed'))).toEqual(['yes', 'yes', 'yes', 'yes', 'yes'])
    expect(rows[3]!.textContent).toContain('file by Jan 15, 2027')
    // A day in the same month moves only the day: the window recomputes from its own date field.
    fireEvent.change(screen.getAllByLabelText('Last day of work')[1]!, { target: { value: '2026-09-20' } })
    fireEvent.blur(screen.getAllByLabelText('Last day of work')[1]!)
    expect(Array.from(screen.getByTestId('lien-last-work-diff').querySelectorAll('tbody tr')).map((r) => r.getAttribute('data-changed'))).toEqual(['yes', 'no', 'no', 'no', 'no'])
    // A day after today is refused in the window's own words.
    fireEvent.change(screen.getAllByLabelText('Last day of work')[1]!, { target: { value: '2026-12-01' } })
    fireEvent.blur(screen.getAllByLabelText('Last day of work')[1]!)
    expect(screen.getByTestId('lien-last-work-confirm').getAttribute('data-verdict')).toBe('refused')
    expect(screen.getByTestId('lien-last-work-shift').textContent).toBe('Last day of work Dec 1 — after today.')
  })
  it('a day far past the hours reads Set the day anyway', () => {
    renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-02' }} todayYmd="2027-01-20" canEdit userId="u1" onSaved={() => {}} clockMonths={['2026-09']} propertyKind="residential" />)
    fireEvent.click(screen.getByTestId('lien-last-work-change'))
    fireEvent.change(screen.getByLabelText('Last day of work'), { target: { value: '2026-12-01' } })
    fireEvent.blur(screen.getByLabelText('Last day of work'))
    fireEvent.click(screen.getByTestId('lien-last-work-save'))
    expect(screen.getByTestId('lien-last-work-confirm').getAttribute('data-verdict')).toBe('look')
    expect(screen.getByTestId('lien-last-work-confirm-set').textContent).toBe('Set the day anyway')
  })
  it('a day before the clock hours is saved since v2.7447, after the window says the hours stay; a hand-set day shows who, when and why, and Back clears the four columns', async () => {
    const onSaved = vi.fn()
    const view = renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={onSaved} />)
    expect(screen.getByTestId('lien-last-work-source').textContent).toBe('from clock hours')
    fireEvent.click(screen.getByTestId('lien-last-work-change'))
    fireEvent.change(screen.getByLabelText('Last day of work'), { target: { value: '2026-09-10' } })
    fireEvent.blur(screen.getByLabelText('Last day of work'))
    fireEvent.click(screen.getByTestId('lien-last-work-save'))
    await settle()
    expect(update).not.toHaveBeenCalled()
    expect(screen.getByTestId('lien-last-work-confirm').getAttribute('data-verdict')).toBe('fine')
    expect(screen.getByTestId('lien-last-work-say').textContent).toContain('The hours run to Sep 24, after this day. They stay as they are and do not move it.')
    // The reason is still required: Set the day stays off until one is typed.
    expect((screen.getByTestId('lien-last-work-confirm-set') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why the last day is set by hand'), { target: { value: 'the Sep 24 hours were a warranty call' } })
    fireEvent.click(screen.getByTestId('lien-last-work-confirm-set'))
    await settle()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ lien_last_work_on: '2026-09-10', lien_last_work_note: 'the Sep 24 hours were a warranty call', lien_last_work_set_by: 'u1' }))
    update.mockClear()
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

  it('a day set by hand that approved hours follow still counts, and the line says the hours do not move it (v2.7193, punch list #335, row 1)', () => {
    renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-10-20', lien_last_work_on: '2026-06-12', lien_last_work_note: 'final walk-through' }} todayYmd="2026-11-13" canEdit userId="u1" onSaved={() => {}} />)
    expect(screen.getByTestId('lien-last-work-day').textContent).toBe('Jun 12')
    expect(screen.getByTestId('lien-last-work').getAttribute('data-source')).toBe('hand')
    expect(screen.getByTestId('lien-last-work-later-hours').textContent).toBe('Hours were approved after it, through Oct 20. They do not move it.')
    // The door to change it stands beside the line.
    expect(screen.getByTestId('lien-last-work-change')).toBeTruthy()
  })

  it('no later-hours line when the hand day is the later, or when no day is set by hand', () => {
    const first = renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-07-17', lien_last_work_on: '2026-08-14' }} todayYmd="2026-11-13" canEdit userId="u1" onSaved={() => {}} />)
    expect(screen.queryByTestId('lien-last-work-later-hours')).toBeNull()
    first.unmount()
    renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-11-13" canEdit userId="u1" onSaved={() => {}} />)
    expect(screen.queryByTestId('lien-last-work-later-hours')).toBeNull()
  })

  describe('values in place (punch list #399, the first screen)', () => {
    const worked = (el: Element | null) => [...(el?.querySelectorAll('[data-value="worked-out"]') ?? [])].map((v) => v.textContent)

    it('one fact a line: the day, why, and the later hours each on their own line, the values bold and apart from the words', () => {
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-10-20', lien_last_work_on: '2026-06-12', lien_last_work_note: 'final walk-through', lien_last_work_set_at: '2026-10-06T14:00:00Z', lien_last_work_set_by: 'u1' }} setByName="Robert" todayYmd="2026-11-13" canEdit userId="u1" onSaved={() => {}} />)
      const lines = screen.getByTestId('lien-last-work').querySelector('[data-value-lines]') as HTMLElement
      expect([...lines.querySelectorAll('.vipLineLabel')].map((l) => l.textContent)).toEqual(['Last day of work', 'Why', 'Later hours'])
      // The day, then who set it and when inside the chip, then the hours' last day: each its own value.
      expect(worked(screen.getByTestId('lien-last-work-day'))).toEqual(['Jun 12'])
      expect(worked(screen.getByTestId('lien-last-work-source'))).toEqual(['Robert', 'Oct 6'])
      expect(worked(screen.getByTestId('lien-last-work-later-hours'))).toEqual(['Oct 20'])
      // The words are the kernels' own, whole.
      expect(screen.getByTestId('lien-last-work-source').textContent).toBe('set by hand · Robert · Oct 6')
      expect(screen.getByTestId('lien-last-work-later-hours').textContent).toBe('Hours were approved after it, through Oct 20. They do not move it.')
      expect(screen.getByTestId('lien-last-work').textContent).not.toMatch(/[⟪⟫]/)
    })

    it('a day from clock hours is one line, and a job with no day says so in quiet words with no value', () => {
      const first = renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} />)
      expect([...screen.getByTestId('lien-last-work').querySelectorAll('.vipLineLabel')].map((l) => l.textContent)).toEqual(['Last day of work'])
      expect(worked(screen.getByTestId('lien-last-work'))).toEqual(['Sep 24'])
      first.unmount()
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={null} todayYmd="2026-10-06" canEdit={false} userId={null} onSaved={() => {}} />)
      expect(screen.getByTestId('lien-last-work-day').textContent).toBe('none yet')
      expect(worked(screen.getByTestId('lien-last-work'))).toEqual([])
    })

    it('the day takes no press of its own: it moves every lien deadline, so its change is still Change › and the window that shows what moves', async () => {
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} />)
      expect(screen.getByTestId('lien-last-work').querySelector('[data-value="changeable"]')).toBeNull()
      expect(screen.getByTestId('lien-last-work-day').querySelector('button')).toBeNull()
      fireEvent.click(screen.getByTestId('lien-last-work-day'))
      expect(screen.queryByTestId('lien-last-work-editor')).toBeNull()
      // The door that was there is the door that is there, and nothing is written until the window's Set the day.
      fireEvent.click(screen.getByTestId('lien-last-work-change'))
      fireEvent.change(screen.getByLabelText('Last day of work'), { target: { value: '2026-09-10' } })
      fireEvent.blur(screen.getByLabelText('Last day of work'))
      fireEvent.click(screen.getByTestId('lien-last-work-save'))
      await settle()
      expect(screen.getByTestId('lien-last-work-confirm')).toBeTruthy()
      expect(update).not.toHaveBeenCalled()
    })
  })
})
