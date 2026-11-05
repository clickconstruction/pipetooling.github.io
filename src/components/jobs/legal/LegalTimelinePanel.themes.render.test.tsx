// @vitest-environment jsdom
/**
 * Themes on a matter's Timeline (v2.6548, punch list #269 T2b): Record what happened carries the theme strip when the
 * acts give the catalog and hands the marks to addEvent with the draft; a row with marks draws them as chips, the why
 * and the grade on the tip, a proposed one dashed; a hand with no catalog sees neither. Made-up rows only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LegalTimelinePanel, { type TimelinePlanActs } from './LegalTimelinePanel'
import { buildLegalTimeline } from '../../../lib/legal/legalTimeline'
import type { LegalEntryRow } from '../../../lib/legal/legalMatters'
import type { LegalTheme, LegalThemeMark } from '../../../lib/legal/legalThemes'

afterEach(cleanup)

const TODAY = '2026-10-23'
const entry = (over: Partial<LegalEntryRow>): LegalEntryRow => ({ id: 'e', matter_id: 'm', kind: 'event', amount: null, body: '', occurred_on: TODAY, meta: { notes: '', source: 'office' }, via_portal: false, created_by: 'u1', acknowledged_at: null, created_at: '2026-10-20T00:00:00Z', ...over } as LegalEntryRow)
const entries = [entry({ id: 'ev1', body: 'Trip taken after three refusals by phone that week.', occurred_on: '2026-10-20' }), entry({ id: 'ev2', body: 'A charge the day after leaving.', occurred_on: '2026-10-21' })]
const timeline = () => buildLegalTimeline({ entries, documents: [], todayYmd: TODAY, holds: {}, holdReasons: {}, reader: 'office' })

const theme = (id: string, name: string): LegalTheme => ({ id, name, what_counts: '', counsel_words: '', created_by: null, created_at: '2026-11-05T00:00:00Z', updated_at: '2026-11-05T00:00:00Z', retired_at: null, retired_by: null, proposed_by_agent: false, kept_at: null })
const mark = (over: Partial<LegalThemeMark>): LegalThemeMark => ({ id: 'm1', theme_id: 't1', target_kind: 'matter_entry', target_id: 'ev1', person_id: null, matter_id: 'm', why: 'went anyway', proves_by: 'firsthand', marked_by: 'u1', marked_at: '2026-11-05T00:00:00Z', author_label: null, proposed: false, kept_at: '2026-11-05T00:00:00Z', kept_by: 'u1', removed_at: null, removed_by: null, removed_why: '', ...over })
const THEMES = [theme('t1', 'Company money without say-so'), theme('t2', 'Dishonesty')]

function acts(over: Partial<TimelinePlanActs> = {}): TimelinePlanActs {
  return { busy: false, addEvent: vi.fn(async () => true), documents: [], ...over }
}

describe('LegalTimelinePanel · themes (v2.6548)', () => {
  it('Record what happened carries the strip and hands the marks to addEvent; a row draws its marks as chips', async () => {
    const a = acts({ themes: THEMES, marks: [mark({ id: 'm1' }), mark({ id: 'm2', theme_id: 't2', target_id: 'ev2', proposed: true, kept_at: null, kept_by: null, proves_by: null, why: '' })] })
    render(<LegalTimelinePanel timeline={timeline()} todayYmd={TODAY} reader="office" acts={a} />)
    const row1 = document.querySelector('[data-legal-timeline-item="entry:ev1"]')!
    const chip1 = row1.querySelector('[data-legal-timeline-theme="t1"]')!
    expect(chip1.textContent).toBe('Company money without say-so')
    expect(chip1.getAttribute('title')).toBe('why: went anyway · proves it by a firsthand account')
    const row2 = document.querySelector('[data-legal-timeline-item="entry:ev2"]')!
    const chip2 = row2.querySelector('[data-legal-timeline-theme="t2"]')!
    expect(chip2.textContent).toBe('Dishonesty · proposed')
    expect((chip2 as HTMLElement).style.border).toContain('dashed')

    fireEvent.click(screen.getByRole('button', { name: /Add to the timeline/ }))
    const form = document.querySelector('[data-legal-composer]')!
    const picker = within(form as HTMLElement).getByTestId('event-theme-picker')
    fireEvent.change(within(form as HTMLElement).getByLabelText('What happened'), { target: { value: 'Card charges on a day with no job.' } })
    fireEvent.click(within(picker).getByTestId('theme-pick-t1'))
    fireEvent.change(within(picker).getByTestId('theme-mark-why'), { target: { value: 'no job that day' } })
    fireEvent.click(within(picker).getByTestId('theme-proves-document'))
    fireEvent.submit(form)
    await waitFor(() => expect(a.addEvent).toHaveBeenCalledTimes(1))
    expect(a.addEvent).toHaveBeenCalledWith({ on: TODAY, body: 'Card charges on a day with no job.', notes: '', documentIds: [], marks: { themeIds: ['t1'], why: 'no job that day', provesBy: 'document' } })
  })

  it('a hand with no catalog sees no strip and no chips', () => {
    render(<LegalTimelinePanel timeline={timeline()} todayYmd={TODAY} reader="office" acts={acts()} />)
    fireEvent.click(screen.getByRole('button', { name: /Add to the timeline/ }))
    expect(document.querySelector('[data-legal-composer-themes]')).toBeNull()
    expect(document.querySelector('[data-legal-timeline-themes]')).toBeNull()
  })
})
