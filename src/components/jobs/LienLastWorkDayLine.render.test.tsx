// @vitest-environment jsdom
/**
 * The last day of work line (v2.4676): the day and its source, a day typed in place, a good day saves the four
 * columns through the window and the caller re-reads, Back clears them. Since punch list #399 the day is a value in
 * place: no Change › and no editor box.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { LienLastWorkDayLine } from './LienLastWorkDayLine'

const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ update }) } }))

afterEach(() => {
  cleanup()
  update.mockClear()
})

/** The value's own field. The window's field is *Last day of work*, with a capital. */
const FIELD = 'last day of work'
/** The day as the line draws it, whichever look it wears. */
const dayValue = () => screen.getByTestId('lien-last-work-day').querySelector('[data-value]') as HTMLElement
/** Opens the day's field: Set by hand beside a default, the day itself once a person set it. */
const openField = () => fireEvent.click(screen.queryByRole('button', { name: `Set by hand, ${FIELD}` }) ?? within(screen.getByTestId('lien-last-work-day')).getByRole('button'))
/** Types a day in the open field and presses Keep. */
const keep = (day: string) => {
  fireEvent.change(screen.getByLabelText(FIELD), { target: { value: day } })
  fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
}
/** The window's own day field. */
const windowDay = () => within(screen.getByTestId('lien-last-work-confirm')).getByLabelText('Last day of work')

describe('LienLastWorkDayLine', () => {
  it('reads the creation day in amber when there are no hours, and saves a typed day with its reason', async () => {
    const onSaved = vi.fn()
    renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ created_at: '2026-07-01T15:00:00Z', last_work_date: null }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={onSaved} />)
    expect(screen.getByTestId('lien-last-work').getAttribute('data-source')).toBe('created')
    expect(dayValue().textContent).toBe('Jul 1')
    expect(screen.getByTestId('lien-last-work-source').textContent).toBe("from the job's creation")
    openField()
    keep('2026-08-14')
    // Keep opens the window (v2.4717): the shift from the creation day, the dates, and the reason asked there.
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
    expect(screen.queryByTestId('lien-last-work-confirm')).toBeNull()
  })
  it('the window shows the dates that move on a desk job, lit where they change', () => {
    renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-02' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} jobLabel="922 · Michael Palvern" clockMonths={['2026-07', '2026-09']} propertyKind="residential" />)
    openField()
    keep('2026-10-02')
    const rows = Array.from(screen.getByTestId('lien-last-work-diff').querySelectorAll('tbody tr'))
    expect(rows.map((r) => r.getAttribute('data-changed'))).toEqual(['yes', 'yes', 'yes', 'yes', 'yes'])
    expect(rows[3]!.textContent).toContain('file by Jan 15, 2027')
    // The window opens on the day kept, and a day in the same month moves only the day: it recomputes from its own date field.
    expect((windowDay() as HTMLInputElement).value).toBe('2026-10-02')
    fireEvent.change(windowDay(), { target: { value: '2026-09-20' } })
    fireEvent.blur(windowDay())
    expect(Array.from(screen.getByTestId('lien-last-work-diff').querySelectorAll('tbody tr')).map((r) => r.getAttribute('data-changed'))).toEqual(['yes', 'no', 'no', 'no', 'no'])
    // A day after today is refused in the window's own words.
    fireEvent.change(windowDay(), { target: { value: '2026-12-01' } })
    fireEvent.blur(windowDay())
    expect(screen.getByTestId('lien-last-work-confirm').getAttribute('data-verdict')).toBe('refused')
    expect(screen.getByTestId('lien-last-work-shift').textContent).toBe('Last day of work Dec 1 — after today.')
  })
  it('a day far past the hours reads Set the day anyway', () => {
    renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-02' }} todayYmd="2027-01-20" canEdit userId="u1" onSaved={() => {}} clockMonths={['2026-09']} propertyKind="residential" />)
    openField()
    keep('2026-12-01')
    expect(screen.getByTestId('lien-last-work-confirm').getAttribute('data-verdict')).toBe('look')
    expect(screen.getByTestId('lien-last-work-confirm-set').textContent).toBe('Set the day anyway')
  })
  it('a day before the clock hours is saved since v2.7447, after the window says the hours stay; a hand-set day shows who, when and why, and Back clears the four columns', async () => {
    const onSaved = vi.fn()
    const view = renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={onSaved} />)
    expect(screen.getByTestId('lien-last-work-source').textContent).toBe('from clock hours')
    openField()
    keep('2026-09-10')
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
    openField()
    fireEvent.click(screen.getByRole('button', { name: 'Back to clock hours' }))
    await settle()
    expect((update.mock.calls[0] as unknown as [Record<string, unknown>])[0]).toEqual({ lien_last_work_on: null, lien_last_work_note: '', lien_last_work_set_at: null, lien_last_work_set_by: null })
    // No window stood between the press and the write: going back to the hours is not a day set by hand.
    expect(screen.queryByTestId('lien-last-work-confirm')).toBeNull()
  })
  it('without the right to edit the day is bold and takes no press', () => {
    renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-10-06" canEdit={false} userId={null} onSaved={() => {}} />)
    expect(screen.getByTestId('lien-last-work').querySelector('button')).toBeNull()
    expect(dayValue().getAttribute('data-value')).toBe('worked-out')
    expect(screen.getByTestId('lien-last-work-day').textContent).toBe('Sep 24')
    expect(screen.getByTestId('lien-last-work-source').textContent).toBe('from clock hours')
  })

  it('a day set by hand that approved hours follow still counts, and the line says the hours do not move it (v2.7193, punch list #335, row 1)', () => {
    renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-10-20', lien_last_work_on: '2026-06-12', lien_last_work_note: 'final walk-through' }} todayYmd="2026-11-13" canEdit userId="u1" onSaved={() => {}} />)
    expect(screen.getByTestId('lien-last-work-day').textContent).toBe('Jun 12')
    expect(screen.getByTestId('lien-last-work').getAttribute('data-source')).toBe('hand')
    expect(screen.getByTestId('lien-last-work-later-hours').textContent).toBe('Hours were approved after it, through Oct 20. They do not move it.')
    // The door to change it is the day itself.
    expect(dayValue().getAttribute('data-value')).toBe('changeable')
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
      expect(dayValue().textContent).toBe('Jun 12')
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

    it('a day nobody typed is a default: bold, its source chip after it, and Set by hand beside it', () => {
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} />)
      const day = screen.getByTestId('lien-last-work-day')
      expect(dayValue().getAttribute('data-value')).toBe('worked-out')
      expect(day.textContent).toBe('Sep 24 from clock hours Set by hand')
      // The chip is the default's word, drawn once.
      expect(screen.getAllByTestId('lien-last-work-source')).toHaveLength(1)
      expect(day.contains(screen.getByTestId('lien-last-work-source'))).toBe(true)
      expect(screen.getByRole('button', { name: `Set by hand, ${FIELD}` })).toBeTruthy()
      // No Change › and no editor box: the value is the door.
      expect(screen.getByTestId('lien-last-work').textContent).not.toContain('Change')
      expect(screen.getAllByRole('button')).toHaveLength(1)
    })

    it('a day set by hand is underlined, and a press on it opens its field on that day, with Back to clock hours in it', () => {
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24', lien_last_work_on: '2026-09-30', lien_last_work_note: 'punch day' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} />)
      expect(dayValue().getAttribute('data-value')).toBe('changeable')
      expect(screen.getByRole('button', { name: `Sep 30, ${FIELD}, press to change` })).toBeTruthy()
      // The chip stays beside the value, outside it.
      expect(screen.getByTestId('lien-last-work-day').contains(screen.getByTestId('lien-last-work-source'))).toBe(false)
      openField()
      const field = screen.getByLabelText(FIELD) as HTMLInputElement
      expect(field.type).toBe('date')
      expect(field.value).toBe('2026-09-30')
      expect(field.max).toBe('2026-10-06')
      expect(screen.getByRole('button', { name: 'Keep' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Back to clock hours' })).toBeTruthy()
      expect(screen.getByTestId('lien-last-work-day').textContent).toContain('Keep shows what moves with the day and asks why before anything is saved.')
    })

    it('a job with no hours offers Back to the job’s creation day, and a default offers no way back', () => {
      const first = renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ created_at: '2026-07-01T15:00:00Z', lien_last_work_on: '2026-08-14' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} />)
      openField()
      expect(screen.getByRole('button', { name: "Back to the job's creation day" })).toBeTruthy()
      first.unmount()
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} />)
      openField()
      expect(screen.queryByRole('button', { name: /^Back to/ })).toBeNull()
    })

    it('a stand-in is no day anyone said, so its field opens empty; a day from clock hours opens on that day', () => {
      const first = renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ created_at: '2026-07-01T15:00:00Z' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} />)
      openField()
      expect((screen.getByLabelText(FIELD) as HTMLInputElement).value).toBe('')
      first.unmount()
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} />)
      openField()
      expect((screen.getByLabelText(FIELD) as HTMLInputElement).value).toBe('2026-09-24')
    })

    it('Keep writes nothing: it opens the window on the day typed, and Set the day there is the one write', async () => {
      const onSaved = vi.fn()
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24', lien_last_work_on: '2026-09-30', lien_last_work_note: 'punch day' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={onSaved} />)
      openField()
      keep('2026-09-10')
      await settle()
      expect(update).not.toHaveBeenCalled()
      expect(onSaved).not.toHaveBeenCalled()
      // The field closed behind the window, and the line still reads the day on the job.
      expect(screen.queryByLabelText(FIELD)).toBeNull()
      expect(dayValue().textContent).toBe('Sep 30')
      expect((windowDay() as HTMLInputElement).value).toBe('2026-09-10')
      // The reason already on the job is in the window, as from the timeline's press.
      expect((screen.getByLabelText('Why the last day is set by hand') as HTMLInputElement).value).toBe('punch day')
      fireEvent.click(screen.getByTestId('lien-last-work-confirm-set'))
      await settle()
      expect(update).toHaveBeenCalledTimes(1)
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ lien_last_work_on: '2026-09-10', lien_last_work_note: 'punch day' }))
      expect(onSaved).toHaveBeenCalledTimes(1)
      expect(screen.queryByTestId('lien-last-work-confirm')).toBeNull()
    })

    it('Cancel in the window writes nothing and leaves the line as it was', async () => {
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} />)
      openField()
      keep('2026-09-10')
      fireEvent.click(within(screen.getByTestId('lien-last-work-confirm')).getByRole('button', { name: 'Cancel' }))
      await settle()
      expect(screen.queryByTestId('lien-last-work-confirm')).toBeNull()
      expect(update).not.toHaveBeenCalled()
      expect(screen.getByTestId('lien-last-work-day').textContent).toBe('Sep 24 from clock hours Set by hand')
    })

    it('Escape and Cancel in the field save nothing and open no window', async () => {
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24', lien_last_work_on: '2026-09-30' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} />)
      openField()
      fireEvent.change(screen.getByLabelText(FIELD), { target: { value: '2026-09-10' } })
      fireEvent.keyDown(screen.getByLabelText(FIELD), { key: 'Escape' })
      expect(screen.queryByLabelText(FIELD)).toBeNull()
      openField()
      // What was typed is gone: the field opens on the job's day again.
      expect((screen.getByLabelText(FIELD) as HTMLInputElement).value).toBe('2026-09-30')
      fireEvent.change(screen.getByLabelText(FIELD), { target: { value: '2026-09-11' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      await settle()
      expect(screen.queryByLabelText(FIELD)).toBeNull()
      expect(screen.queryByTestId('lien-last-work-confirm')).toBeNull()
      expect(update).not.toHaveBeenCalled()
      expect(dayValue().textContent).toBe('Sep 30')
    })

    it('Enter keeps; the same day opens nothing; a day after today is held in the field with its reason', async () => {
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24', lien_last_work_on: '2026-09-30' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} />)
      // The day the job already holds: nothing to set.
      openField()
      fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
      expect(screen.queryByLabelText(FIELD)).toBeNull()
      expect(screen.queryByTestId('lien-last-work-confirm')).toBeNull()
      // After today: the field stays open and says why.
      openField()
      keep('2026-12-01')
      expect(screen.getByRole('alert').textContent).toBe('Pick Oct 6 or earlier.')
      expect(screen.queryByTestId('lien-last-work-confirm')).toBeNull()
      // A good day, kept with Enter.
      fireEvent.change(screen.getByLabelText(FIELD), { target: { value: '2026-10-01' } })
      fireEvent.keyDown(screen.getByLabelText(FIELD), { key: 'Enter' })
      expect((windowDay() as HTMLInputElement).value).toBe('2026-10-01')
      await settle()
      expect(update).not.toHaveBeenCalled()
    })

    it('a job with no day at all offers the press on its quiet words', () => {
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={null} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} />)
      expect(screen.getByRole('button', { name: `none yet, ${FIELD}, press to change` })).toBeTruthy()
      expect(screen.getByTestId('lien-last-work-source').textContent).toBe('no day yet')
    })

    it('opened from the Lien window’s press, the window is up with the day to pick; closed with nothing saved, the line folds away', async () => {
      const onCancel = vi.fn()
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={() => {}} startEditing onCancel={onCancel} />)
      // The window opens on the job's day, its day field in hand.
      expect((windowDay() as HTMLInputElement).value).toBe('2026-09-24')
      expect(document.activeElement).toBe(windowDay())
      expect(screen.queryByLabelText(FIELD)).toBeNull()
      fireEvent.click(within(screen.getByTestId('lien-last-work-confirm')).getByRole('button', { name: 'Cancel' }))
      await settle()
      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(update).not.toHaveBeenCalled()
    })

    it('that window’s save keeps the line open, and a later window off the value does not fold it', async () => {
      const onCancel = vi.fn()
      const onSaved = vi.fn()
      renderWithProviders(<LienLastWorkDayLine jobId="j1" job={{ last_work_date: '2026-09-24' }} todayYmd="2026-10-06" canEdit userId="u1" onSaved={onSaved} startEditing onCancel={onCancel} />)
      fireEvent.change(windowDay(), { target: { value: '2026-09-10' } })
      fireEvent.blur(windowDay())
      fireEvent.change(screen.getByLabelText('Why the last day is set by hand'), { target: { value: 'warranty call after' } })
      fireEvent.click(screen.getByTestId('lien-last-work-confirm-set'))
      await settle()
      expect(update).toHaveBeenCalledTimes(1)
      expect(onSaved).toHaveBeenCalledTimes(1)
      expect(onCancel).not.toHaveBeenCalled()
      expect(screen.queryByTestId('lien-last-work-confirm')).toBeNull()
      // A window opened by Keep, cancelled: the line stays.
      openField()
      keep('2026-09-12')
      fireEvent.click(within(screen.getByTestId('lien-last-work-confirm')).getByRole('button', { name: 'Cancel' }))
      await settle()
      expect(onCancel).not.toHaveBeenCalled()
    })
  })
})
