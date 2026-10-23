// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LegalTimelinePanel, { PORTAL_LOOK, type TimelinePlanActs } from './LegalTimelinePanel'
import { buildLegalTimeline, planHoldKey, timelineDocumentsFromRows } from '../../../lib/legal/legalTimeline'
import type { LegalEntryRow } from '../../../lib/legal/legalMatters'

afterEach(cleanup)

const TODAY = '2026-10-23'
function entry(over: Partial<LegalEntryRow>): LegalEntryRow {
  return { id: 'e', matter_id: 'm', kind: 'note', amount: null, body: '', occurred_on: TODAY, meta: {}, via_portal: false, created_by: 'u1', acknowledged_at: null, created_at: '2026-10-20T15:00:00Z', ...over }
}
const entries: LegalEntryRow[] = [
  entry({ id: 'fee', kind: 'fee', amount: 450, body: 'Demand letter', occurred_on: '2026-10-01', via_portal: true }),
  entry({ id: 'p-late', kind: 'plan', occurred_on: '2026-10-21', body: 'Call the GC’s AP desk', meta: { notes: '', source: 'office' } }),
  entry({ id: 'p-done', kind: 'plan', occurred_on: '2026-10-20', body: 'Pull the photos', meta: { notes: '', done_at: '2026-10-18', done_by: 'u1', source: 'office' } }),
  entry({ id: 'p-next', kind: 'plan', occurred_on: '2026-10-27', body: 'Send the response letter and settlement offer', meta: { notes: 'Certified mail and email.', source: 'office' } }),
  entry({ id: 'p-held', kind: 'plan', occurred_on: '2026-11-03', body: 'Burd’s response date', meta: { notes: '', source: 'office' } }),
]
const docs = timelineDocumentsFromRows([{ id: 'd1', title: 'Final invoice 891', shows: 'The amount owed.', added_at: '2026-10-22T18:00:00Z', added_by: 'u1', held_reason: '' }], (iso) => iso.slice(0, 10), () => 'Grace')
const timeline = (holds: Record<string, boolean> = {}) => buildLegalTimeline({ entries, documents: docs, todayYmd: TODAY, holds, holdReasons: { [planHoldKey('p-held')]: 'Not settled yet' }, userNameOf: () => 'Grace', reader: 'office' })

function acts(over: Partial<TimelinePlanActs> = {}): TimelinePlanActs {
  return { busy: false, add: vi.fn(async () => true), update: vi.fn(async () => true), markDone: vi.fn(async () => true), undo: vi.fn(async () => true), canUndo: (i) => i.kind === 'plan' && !i.voided && !i.viaPortal, hold: { holdBack: vi.fn(async () => {}), shareAgain: vi.fn(async () => {}) }, ...over }
}

describe('LegalTimelinePanel (v2.5800)', () => {
  it('draws the line around today with the states in plain words, and a document with its door', () => {
    const open = vi.fn()
    render(<LegalTimelinePanel timeline={timeline()} todayYmd={TODAY} reader="office" acts={null} onOpenEvidence={open} />)
    expect(screen.getByRole('separator', { name: 'Today, Fri, Oct 23' })).toBeTruthy()
    const item = (key: string) => document.querySelector(`[data-legal-timeline-item="${key}"]`)!
    expect(item('entry:p-late').getAttribute('data-legal-timeline-state')).toBe('overdue')
    expect(item('entry:p-late').textContent).toContain('Overdue by 2 days. Not marked done.')
    expect(item('entry:p-done').textContent).toContain('Done Oct 18. Planned for Oct 20.')
    expect(item('entry:p-next').textContent).toContain('Planned. In 4 days.')
    expect(item('entry:p-next').textContent).toContain('Certified mail and email.')
    expect(item('entry:fee').textContent).toContain('$450.00')
    expect(screen.getByText('6 planned · 1 overdue · 1 done'.replace('6', '3'))).toBeTruthy()
    // The order: earlier items, today, ahead.
    const keys = [...document.querySelectorAll('[data-legal-timeline-item]')].map((el) => el.getAttribute('data-legal-timeline-item'))
    expect(keys).toEqual(['entry:fee', 'entry:p-done', 'entry:p-late', 'doc:d1', 'entry:p-next', 'entry:p-held'])
    fireEvent.click(screen.getByRole('button', { name: 'Open Evidence ↗' }))
    expect(open).toHaveBeenCalled()
    // Read only: no plan form, no acts.
    expect(document.querySelector('[data-legal-plan-form]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark done' })).toBeNull()
  })

  it('plans a step from the form once the draft is sound, then clears it', async () => {
    const a = acts()
    render(<LegalTimelinePanel timeline={timeline()} todayYmd={TODAY} reader="office" acts={a} />)
    const save = screen.getByRole('button', { name: 'Add to the timeline' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('What is planned'), { target: { value: 'Mail the materials lien notice' } })
    expect(screen.getByText('Pick the day it is planned for.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Day planned for'), { target: { value: '2026-11-13' } })
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'To the owner and the GC.' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(a.add).toHaveBeenCalledWith({ on: '2026-11-13', body: 'Mail the materials lien notice', notes: 'To the owner and the GC.' }))
    await waitFor(() => expect((screen.getByLabelText('What is planned') as HTMLInputElement).value).toBe(''))
  })

  it('marks a live step done with a day and a note, edits one, holds one from counsel and undoes one', async () => {
    const a = acts()
    render(<LegalTimelinePanel timeline={timeline()} todayYmd={TODAY} reader="office" acts={a} />)
    const next = document.querySelector('[data-legal-timeline-item="entry:p-next"]') as HTMLElement
    // A done step can still be held from counsel, but not edited, marked done or undone; a live one has all four.
    expect([...(document.querySelector('[data-legal-timeline-item="entry:p-done"]') as HTMLElement).querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Hold from counsel…', 'Undo…'])
    fireEvent.click(next.querySelector('button[title^="Keep this planned step"]')!)
    fireEvent.change(screen.getByLabelText('Why counsel should not see it'), { target: { value: 'Not until the offer is out' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hold back' }))
    await waitFor(() => expect(a.hold!.holdBack).toHaveBeenCalledWith('plan:p-next', 'Not until the offer is out'))
    const late = document.querySelector('[data-legal-timeline-item="entry:p-late"]') as HTMLElement
    fireEvent.click([...late.querySelectorAll('button')].find((b) => b.textContent === 'Mark done')!)
    const dayDone = screen.getByLabelText('Day it was done') as HTMLInputElement
    expect(dayDone.value).toBe(TODAY)
    fireEvent.change(dayDone, { target: { value: '2026-10-22' } })
    fireEvent.change(screen.getByLabelText('What happened'), { target: { value: 'Spoke to Kim in AP.' } })
    fireEvent.click(late.querySelector('form[data-legal-plan-done] button[type="submit"]')!)
    await waitFor(() => expect(a.markDone).toHaveBeenCalledWith('p-late', '2026-10-22', 'Spoke to Kim in AP.'))
    fireEvent.click([...late.querySelectorAll('button')].find((b) => b.textContent === 'Edit')!)
    fireEvent.change(screen.getByLabelText('What is planned', { selector: '[data-legal-timeline-item] input' }), { target: { value: 'Call the GC’s AP desk again' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the step' }))
    await waitFor(() => expect(a.update).toHaveBeenCalledWith('p-late', { on: '2026-10-21', body: 'Call the GC’s AP desk again', notes: '' }))
    fireEvent.click([...late.querySelectorAll('button')].find((b) => b.textContent === 'Undo…')!)
    fireEvent.change(screen.getByLabelText('Why undo it'), { target: { value: 'Entered twice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(a.undo).toHaveBeenCalledWith('p-late', 'Entered twice'))
  })

  it('a held step reads held with its reason and offers Share; the firm’s look draws the same line read only', () => {
    const a = acts()
    const { unmount } = render(<LegalTimelinePanel timeline={timeline({ [planHoldKey('p-held')]: true })} todayYmd={TODAY} reader="office" acts={a} />)
    const held = document.querySelector('[data-legal-timeline-item="entry:p-held"]') as HTMLElement
    expect(held.textContent).toContain('Held from counsel: Not settled yet')
    fireEvent.click([...held.querySelectorAll('button')].find((b) => b.textContent === 'Share with counsel')!)
    expect(a.hold!.shareAgain).toHaveBeenCalledWith('plan:p-held')
    expect(screen.getByText('1 held from counsel')).toBeTruthy()
    unmount()
    render(<LegalTimelinePanel timeline={buildLegalTimeline({ entries, todayYmd: TODAY, reader: 'firm' })} todayYmd={TODAY} reader="firm" look={PORTAL_LOOK} acts={null} footer={<div data-firm-footer>the firm's form</div>} />)
    expect(document.querySelector('[data-firm-footer]')).toBeTruthy()
    expect(document.querySelector('[data-legal-timeline-item="entry:fee"]')!.textContent).toContain('Attorney fee')
    expect(screen.queryByText(/Held from counsel/)).toBeNull()
  })

  it('folds a long past behind Show N earlier', () => {
    const many = Array.from({ length: 9 }, (_, i) => entry({ id: `n${i}`, kind: 'note', body: `Note ${i}`, occurred_on: `2026-09-${String(i + 1).padStart(2, '0')}` }))
    render(<LegalTimelinePanel timeline={buildLegalTimeline({ entries: many, todayYmd: TODAY, reader: 'office' })} todayYmd={TODAY} reader="office" acts={null} />)
    expect(document.querySelectorAll('[data-legal-timeline-item]').length).toBe(6)
    fireEvent.click(screen.getByRole('button', { name: 'Show 3 earlier' }))
    expect(document.querySelectorAll('[data-legal-timeline-item]').length).toBe(9)
  })
})
