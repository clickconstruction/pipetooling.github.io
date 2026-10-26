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
    await waitFor(() => expect(a.add).toHaveBeenCalledWith({ on: '2026-11-13', body: 'Mail the materials lien notice', notes: 'To the owner and the GC.', deadlineKey: null }))
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
    await waitFor(() => expect(a.update).toHaveBeenCalledWith('p-late', { on: '2026-10-21', body: 'Call the GC’s AP desk again', notes: '', deadlineKey: null }))
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

describe('LegalTimelinePanel · record what happened (punch list #167, v2.5836)', () => {
  const withEvent = [
    ...entries,
    entry({ id: 'ev', kind: 'event', occurred_on: '2026-10-22', body: 'The supplier’s job account was paid in full', meta: { notes: 'Receipt on Evidence.', document_ids: ['d1'], source: 'office' } }),
  ]
  const line = (holds: Record<string, boolean> = {}) => buildLegalTimeline({ entries: withEvent, documents: docs, todayYmd: TODAY, holds, holdReasons: {}, userNameOf: () => 'Grace', reader: 'office' })

  it('switches to the event form, refuses a day ahead, and records once the draft is sound, with its documents', async () => {
    const addEvent = vi.fn(async () => true)
    render(<LegalTimelinePanel timeline={line()} todayYmd={TODAY} reader="office" acts={acts({ addEvent, documents: [{ id: 'd1', title: 'Final invoice 891' }] })} />)
    expect(document.querySelector('[data-legal-plan-form]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Record what happened' }))
    expect(document.querySelector('[data-legal-plan-form]')).toBeNull()
    const save = screen.getByRole('button', { name: 'Record it on the timeline' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('What happened'), { target: { value: 'The GC’s notice arrived' } })
    fireEvent.change(screen.getByLabelText('Day it happened'), { target: { value: '2026-10-30' } })
    expect(screen.getByText(/cannot be ahead of today/)).toBeTruthy()
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Day it happened'), { target: { value: '2026-10-22' } })
    fireEvent.change(screen.getByLabelText('Event notes'), { target: { value: 'By email.' } })
    fireEvent.click(screen.getByLabelText('Final invoice 891'))
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(addEvent).toHaveBeenCalledWith({ on: '2026-10-22', body: 'The GC’s notice arrived', notes: 'By email.', documentIds: ['d1'] }))
    await waitFor(() => expect((screen.getByLabelText('What happened') as HTMLInputElement).value).toBe(''))
  })

  it('draws the event on its day with the happened chip, its notes, its document and the Evidence door; holds and undoes it like a step', async () => {
    const open = vi.fn()
    const hold = { holdBack: vi.fn(async () => {}), shareAgain: vi.fn(async () => {}) }
    const a = acts({ hold, canUndo: (i) => (i.kind === 'plan' || i.kind === 'event') && !i.voided && !i.viaPortal })
    render(<LegalTimelinePanel timeline={line()} todayYmd={TODAY} reader="office" acts={a} onOpenEvidence={open} />)
    const item = document.querySelector('[data-legal-timeline-item="entry:ev"]')!
    expect(item.getAttribute('data-legal-timeline-state')).toBe('happened')
    expect(item.textContent).toContain('happened')
    expect(item.textContent).toContain('Receipt on Evidence.')
    expect(item.querySelector('[data-legal-timeline-document="d1"]')!.textContent).toContain('Final invoice 891')
    // No Edit and no Mark done on an event; Hold and Undo, yes.
    const buttons = [...item.querySelectorAll('button')].map((b) => b.textContent)
    expect(buttons).toEqual(['Open Evidence ↗', 'Hold from counsel…', 'Undo…'])
    fireEvent.click(item.querySelector('button:nth-of-type(1)')!)
    expect(open).toHaveBeenCalled()
    fireEvent.click([...item.querySelectorAll('button')].find((b) => b.textContent === 'Hold from counsel…')!)
    fireEvent.change(screen.getByLabelText('Why counsel should not see it'), { target: { value: 'Counsel first' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hold back' }))
    await waitFor(() => expect(hold.holdBack).toHaveBeenCalledWith('event:ev', 'Counsel first'))
  })

  it('on the portal the event reads in the firm’s words, with no form and no hold', () => {
    const firm = buildLegalTimeline({ entries: withEvent, documents: docs, todayYmd: TODAY, reader: 'firm' })
    render(<LegalTimelinePanel timeline={firm} todayYmd={TODAY} reader="firm" look={PORTAL_LOOK} acts={null} />)
    const item = document.querySelector('[data-legal-timeline-item="entry:ev"]')!
    expect(item.textContent).toContain('what happened · recorded by the office')
    expect(document.querySelector('[data-legal-event-form]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hold from counsel…' })).toBeNull()
  })
})

describe('LegalTimelinePanel · the lien clock’s deadlines (punch list #170, v2.5842)', () => {
  const deadlines = [
    { key: 'deadline:j-891:notice:2026-08', jobId: 'j-891', jobLabel: '891', kind: 'notice' as const, cite: '§ 53.056', what: '§ 53.056 notice for August · job 891', ymd: '2026-11-16', recorded: false, missed: false },
    { key: 'deadline:j-891:notice:2026-06', jobId: 'j-891', jobLabel: '891', kind: 'notice' as const, cite: '§ 53.056', what: '§ 53.056 notice for June · job 891', ymd: '2026-09-15', recorded: true, missed: false },
  ]
  const late = entry({ id: 'p-serves', kind: 'plan', occurred_on: '2026-11-18', body: 'Mail the August notice', meta: { notes: '', source: 'office', deadline_key: 'deadline:j-891:notice:2026-08' } })
  const line = buildLegalTimeline({ entries: [...entries, late], documents: docs, todayYmd: TODAY, userNameOf: () => 'Grace', reader: 'office', deadlines })

  it('draws a deadline read only with Record it… to the Lien window, none on a recorded one, and says a step is after its deadline', () => {
    const open = vi.fn()
    render(<LegalTimelinePanel timeline={line} todayYmd={TODAY} reader="office" acts={acts()} onOpenLienWindow={open} />)
    const aug = document.querySelector('[data-legal-timeline-item="deadline:j-891:notice:2026-08"]')!
    expect(aug.textContent).toContain('§ 53.056 notice for August · job 891')
    expect(aug.textContent).toContain('deadline · lien clock')
    expect(aug.textContent).toContain('Deadline. In 24 days, by the lien clock.')
    expect([...aug.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Record it…'])
    fireEvent.click(aug.querySelector('[data-legal-timeline-record]')!)
    expect(open).toHaveBeenCalledWith('j-891')
    const jun = document.querySelector('[data-legal-timeline-item="deadline:j-891:notice:2026-06"]')!
    expect(jun.textContent).toContain('Recorded on the Lien desk.')
    expect(jun.querySelectorAll('button')).toHaveLength(0)
    const step = document.querySelector('[data-legal-timeline-item="entry:p-serves"]')!
    expect(step.querySelector('[data-legal-timeline-serves]')!.getAttribute('data-legal-timeline-serves')).toBe('late')
    expect(step.textContent).toContain('Serves § 53.056 notice for August · job 891 · Mon, Nov 16 · after the deadline')
    expect(screen.getByText(/1 deadline from the lien clock/)).toBeTruthy()
  })

  it('lets Plan a step name an open deadline, warns when the day falls after it, and saves the key', async () => {
    const add = vi.fn(async () => true)
    render(<LegalTimelinePanel timeline={line} todayYmd={TODAY} reader="office" acts={acts({ add })} />)
    const pick = screen.getByLabelText('Deadline this step serves') as HTMLSelectElement
    // The recorded June deadline is not offered; August is.
    expect([...pick.options].map((o) => o.value)).toEqual(['', 'deadline:j-891:notice:2026-08'])
    fireEvent.change(screen.getByLabelText('What is planned'), { target: { value: 'Mail the August notice' } })
    fireEvent.change(pick, { target: { value: 'deadline:j-891:notice:2026-08' } })
    fireEvent.change(screen.getByLabelText('Day planned for'), { target: { value: '2026-11-18' } })
    expect(document.querySelector('[data-legal-plan-late]')!.textContent).toContain('After the deadline')
    fireEvent.change(screen.getByLabelText('Day planned for'), { target: { value: '2026-11-13' } })
    expect(document.querySelector('[data-legal-plan-late]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add to the timeline' }))
    await waitFor(() => expect(add).toHaveBeenCalledWith({ on: '2026-11-13', body: 'Mail the August notice', notes: '', deadlineKey: 'deadline:j-891:notice:2026-08' }))
  })

  it('on the portal the deadlines read the same, with no door', () => {
    const firm = buildLegalTimeline({ entries, documents: docs, todayYmd: TODAY, reader: 'firm', deadlines })
    render(<LegalTimelinePanel timeline={firm} todayYmd={TODAY} reader="firm" look={PORTAL_LOOK} acts={null} />)
    const aug = document.querySelector('[data-legal-timeline-item="deadline:j-891:notice:2026-08"]')!
    expect(aug.textContent).toContain('deadline · lien clock')
    expect(aug.querySelectorAll('button')).toHaveLength(0)
  })
})

describe('LegalTimelinePanel · a day’s burst of documents folds (v2.5850)', () => {
  it('four or more documents added on one day fold into one row that opens; a dated one stays on its own', () => {
    const burst = timelineDocumentsFromRows(
      [1, 2, 3, 4, 5].map((n) => ({ id: `b${n}`, title: `Paper ${n}`, shows: 'x', added_at: '2026-10-20T18:00:00Z', added_by: 'u1', held_reason: '' })).concat([{ id: 'dated', title: 'Subcontract', shows: 'x', added_at: '2026-10-20T19:00:00Z', added_by: 'u1', held_reason: '', dated_on: '2026-05-12' } as never]),
      (iso) => iso.slice(0, 10), () => 'Grace',
    )
    render(<LegalTimelinePanel timeline={buildLegalTimeline({ entries: [], documents: burst, todayYmd: TODAY, reader: 'office' })} todayYmd={TODAY} reader="office" acts={null} />)
    const fold = document.querySelector('[data-legal-timeline-burst="2026-10-20"]')!
    expect(fold.textContent).toContain('5 documents added to Evidence')
    expect(document.querySelector('[data-legal-timeline-item="doc:b1"]')).toBeNull()
    expect(document.querySelector('[data-legal-timeline-item="doc:dated"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show each' }))
    expect(document.querySelector('[data-legal-timeline-burst]')).toBeNull()
    expect(document.querySelectorAll('[data-legal-timeline-item^="doc:b"]')).toHaveLength(5)
  })
})

describe('LegalTimelinePanel · lanes (v2.5851)', () => {
  it('the chips narrow the line and a said item holds from counsel under its own key', async () => {
    const hold = { holdBack: vi.fn(async () => {}), shareAgain: vi.fn(async () => {}) }
    const t = buildLegalTimeline({ entries, documents: docs, todayYmd: TODAY, userNameOf: () => 'Grace', reader: 'office', said: [{ key: 'call:c1', ymd: '2026-10-19', kind: 'call', text: 'Kim in AP said the check is cut', by: 'Grace', jobLabel: '717', shared: true }], did: [{ ymd: '2026-10-01', kind: 'billed', text: 'Invoice sent', jobLabel: '717' }] })
    render(<LegalTimelinePanel timeline={t} todayYmd={TODAY} reader="office" lanes acts={acts({ hold })} doors={<button type="button">Call mode</button>} />)
    expect(screen.getByRole('button', { name: 'Call mode' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Said · 1' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Said · 1' }))
    expect(document.querySelectorAll('[data-legal-timeline-item]')).toHaveLength(1)
    const said = document.querySelector('[data-legal-timeline-item="said:call:c1"]')!
    expect(said.textContent).toContain('call · job 717')
    fireEvent.click([...said.querySelectorAll('button')].find((b) => b.textContent === 'Hold from counsel…')!)
    fireEvent.change(screen.getByLabelText('Why counsel should not see it'), { target: { value: 'Counsel first' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hold back' }))
    await waitFor(() => expect(hold.holdBack).toHaveBeenCalledWith('call:c1', 'Counsel first'))
    fireEvent.click(screen.getByRole('button', { name: /^Did · / }))
    expect(document.querySelector('[data-legal-timeline-item="did:billed:0"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^All · / }))
    expect(document.querySelectorAll('[data-legal-timeline-item]').length).toBeGreaterThan(2)
  })
})
