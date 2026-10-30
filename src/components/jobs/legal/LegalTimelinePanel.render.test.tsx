// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    // v2.6107: the counts read as chips with numbers.
    expect([...document.querySelectorAll('[data-legal-timeline-count]')].map((e) => e.textContent)).toEqual(['planned 3', 'overdue 1', 'done 1'])
    // The order: earlier items, today, ahead.
    const keys = [...document.querySelectorAll('[data-legal-timeline-item]')].map((el) => el.getAttribute('data-legal-timeline-item'))
    expect(keys).toEqual(['entry:fee', 'entry:p-done', 'entry:p-late', 'doc:d1', 'entry:p-next', 'entry:p-held'])
    // v2.6166: the document line's Evidence door names the row it lands on.
    fireEvent.click(screen.getByRole('button', { name: 'Show on Evidence ↗' }))
    expect(open).toHaveBeenCalledWith('d1')
    // Read only: no composer door, no form, no acts.
    expect(document.querySelector('[data-legal-composer-door]')).toBeNull()
    expect(document.querySelector('[data-legal-plan-form]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark done' })).toBeNull()
  })

  it('opens the composer from its door, plans a step once the draft is sound, then closes (v2.5892)', async () => {
    const a = acts()
    render(<LegalTimelinePanel timeline={timeline()} todayYmd={TODAY} reader="office" acts={a} />)
    expect(document.querySelector('[data-legal-composer]')).toBeNull()
    fireEvent.click(document.querySelector('[data-legal-composer-door]')!)
    const form = document.querySelector('[data-legal-composer]') as HTMLFormElement
    const save = form.querySelector('button[type="submit"]') as HTMLButtonElement
    // Only `add` is given, so the composer is pinned to a planned step; the day prefills today.
    expect(save.textContent).toBe('Add to the timeline')
    expect((screen.getByLabelText('Day planned for') as HTMLInputElement).value).toBe(TODAY)
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('What is planned'), { target: { value: 'Mail the materials lien notice' } })
    fireEvent.change(screen.getByLabelText('Day planned for'), { target: { value: '2026-11-13' } })
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'To the owner and the GC.' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(a.add).toHaveBeenCalledWith({ on: '2026-11-13', body: 'Mail the materials lien notice', notes: 'To the owner and the GC.', deadlineKey: null }))
    await waitFor(() => expect(document.querySelector('[data-legal-composer]')).toBeNull())
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

  it('the day decides the kind, the tag overrides, a day ahead refuses, and documents attach (v2.5892)', async () => {
    const addEvent = vi.fn(async () => true)
    render(<LegalTimelinePanel timeline={line()} todayYmd={TODAY} reader="office" acts={acts({ addEvent, documents: [{ id: 'd1', title: 'Final invoice 891' }] })} />)
    fireEvent.click(document.querySelector('[data-legal-composer-door]')!)
    // The day prefills today, so with both acts the composer records what happened.
    expect(document.querySelector('[data-legal-composer-kind="event"]')).toBeTruthy()
    const form = document.querySelector('[data-legal-composer]') as HTMLFormElement
    const save = () => form.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(save().textContent).toBe('Record it on the timeline')
    expect(save().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('What happened'), { target: { value: 'The GC’s notice arrived' } })
    // A day ahead flips the tag to planned step; pressed back to happened, the draft says why it cannot save.
    fireEvent.change(screen.getByLabelText('Day it happened'), { target: { value: '2026-10-30' } })
    expect(document.querySelector('[data-legal-composer-kind="plan"]')).toBeTruthy()
    fireEvent.click(document.querySelector('[data-legal-composer-kind]')!)
    expect(screen.getByText(/cannot be ahead of today/)).toBeTruthy()
    expect(save().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Day it happened'), { target: { value: '2026-10-22' } })
    fireEvent.change(screen.getByLabelText('Event notes'), { target: { value: 'By email.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Final invoice 891' }))
    expect(save().disabled).toBe(false)
    fireEvent.click(save())
    await waitFor(() => expect(addEvent).toHaveBeenCalledWith({ on: '2026-10-22', body: 'The GC’s notice arrived', notes: 'By email.', documentIds: ['d1'] }))
    await waitFor(() => expect(document.querySelector('[data-legal-composer]')).toBeNull())
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
    expect(buttons).toEqual(['Show on Evidence ↗', 'Hold from counsel…', 'Undo…'])
    // v2.6166: the event's door lands on its first proving document.
    fireEvent.click(item.querySelector('button:nth-of-type(1)')!)
    expect(open).toHaveBeenCalledWith('d1')
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
    expect(document.querySelector('[data-legal-timeline-count="deadlines"]')?.textContent).toBe('◆ deadlines 1')
  })

  it('offers the deadline the day lands before, warns when the day falls after it, and saves the key (v2.5892)', async () => {
    const add = vi.fn(async () => true)
    render(<LegalTimelinePanel timeline={line} todayYmd={TODAY} reader="office" acts={acts({ add })} />)
    fireEvent.click(document.querySelector('[data-legal-composer-door]')!)
    fireEvent.change(screen.getByLabelText('What is planned'), { target: { value: 'Mail the August notice' } })
    fireEvent.change(screen.getByLabelText('Day planned for'), { target: { value: '2026-11-13' } })
    // The recorded June deadline never offers; August does, in one line.
    expect(document.querySelector('[data-legal-composer-suggest]')!.textContent).toContain('§ 53.056 notice for August · job 891')
    fireEvent.click(screen.getByRole('button', { name: 'Serves it' }))
    expect(document.querySelector('[data-legal-composer-suggest]')).toBeNull()
    expect(document.querySelector('[data-legal-composer-serves]')!.textContent).toContain('Serves § 53.056 notice for August · job 891')
    fireEvent.change(screen.getByLabelText('Day planned for'), { target: { value: '2026-11-18' } })
    expect(document.querySelector('[data-legal-plan-late]')!.textContent).toContain('After the deadline')
    fireEvent.change(screen.getByLabelText('Day planned for'), { target: { value: '2026-11-13' } })
    expect(document.querySelector('[data-legal-plan-late]')).toBeNull()
    fireEvent.click(document.querySelector('[data-legal-composer] button[type="submit"]')!)
    await waitFor(() => expect(add).toHaveBeenCalledWith({ on: '2026-11-13', body: 'Mail the August notice', notes: '', deadlineKey: 'deadline:j-891:notice:2026-08' }))
  })

  it('No dismisses the offer, and Serves a deadline… opens the full pick without the recorded one (v2.5892)', () => {
    render(<LegalTimelinePanel timeline={line} todayYmd={TODAY} reader="office" acts={acts()} />)
    fireEvent.click(document.querySelector('[data-legal-composer-door]')!)
    fireEvent.change(screen.getByLabelText('Day planned for'), { target: { value: '2026-11-13' } })
    fireEvent.click(screen.getByRole('button', { name: 'No' }))
    expect(document.querySelector('[data-legal-composer-suggest]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Serves a deadline…' }))
    const pick = screen.getByLabelText('Deadline this step serves') as HTMLSelectElement
    expect([...pick.options].map((o) => o.value)).toEqual(['', 'deadline:j-891:notice:2026-08'])
    fireEvent.change(pick, { target: { value: 'deadline:j-891:notice:2026-08' } })
    expect(document.querySelector('[data-legal-composer-serves]')!.textContent).toContain('Serves § 53.056')
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

describe('LegalTimelinePanel · the empty line (punch list #184, sweep C)', () => {
  const empty = buildLegalTimeline({ entries: [], documents: [], todayYmd: TODAY, userNameOf: () => 'Grace', reader: 'office' })
  const words = () => document.querySelector('[data-legal-timeline-empty] [data-empty-state]') as HTMLElement

  it('offers the composer’s door as the press, and only while the composer is shut', () => {
    render(<LegalTimelinePanel timeline={empty} todayYmd={TODAY} reader="office" acts={acts()} />)
    expect(words().textContent).toBe('Nothing on the line yet. Add to the timeline plans the first step.')
    fireEvent.click(within(words()).getByRole('button', { name: 'Add to the timeline' }))
    expect(document.querySelector('[data-legal-composer]')).toBeTruthy()
    expect(words().textContent).toBe('Nothing on the line yet.')
  })

  it('a reader who cannot add reads the fact alone', () => {
    render(<LegalTimelinePanel timeline={empty} todayYmd={TODAY} reader="firm" look={PORTAL_LOOK} acts={null} />)
    expect(words().textContent).toBe('Nothing on the timeline yet.')
    expect(within(words()).queryByRole('button')).toBeNull()
  })

  it('a lane chip that hides every item offers All', () => {
    render(<LegalTimelinePanel timeline={timeline()} todayYmd={TODAY} reader="office" lanes acts={acts()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Said · 0' }))
    expect(words().textContent).toBe('Nothing under Said yet. All › shows the whole line.')
    fireEvent.click(within(words()).getByRole('button', { name: 'All ›' }))
    expect(document.querySelector('[data-legal-timeline-empty]')).toBeNull()
    expect(document.querySelectorAll('[data-legal-timeline-item]').length).toBeGreaterThan(2)
  })
})

describe('LegalTimelinePanel · the strip of days, the hot overdue row and the document chip (punch list #214, v2.6107)', () => {
  it('draws one column a day with today marked and the overdue step as a red ring, and a press on a day unfolds the past and scrolls to it', () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    vi.useFakeTimers()
    // Two past rows shown: Oct 21's overdue step and the Oct 22 document; the Oct 1 fee and the Oct 18 done step fold behind Show earlier.
    render(<LegalTimelinePanel timeline={timeline()} todayYmd={TODAY} reader="office" acts={null} pastShown={2} />)
    const strip = document.querySelector('[data-legal-timeline-strip]')!
    expect(strip).toBeTruthy()
    expect(strip.querySelector('[data-legal-timeline-strip-day][data-today="yes"]')?.getAttribute('data-legal-timeline-strip-day')).toBe(TODAY)
    // Oct 21's planned step is overdue: a red ring on its day; Oct 18's done step a filled dot.
    expect([...strip.querySelectorAll('[data-legal-timeline-strip-day="2026-10-21"] [data-legal-timeline-strip-dot]')].map((d) => d.getAttribute('data-legal-timeline-strip-dot'))).toEqual(['late'])
    expect([...strip.querySelectorAll('[data-legal-timeline-strip-day="2026-10-18"] [data-legal-timeline-strip-dot]')].map((d) => d.getAttribute('data-legal-timeline-strip-dot'))).toEqual(['done'])
    // The overdue row wears the red rule down its left edge.
    expect(document.querySelector('[data-legal-timeline-item="entry:p-late"] [data-legal-timeline-hot="yes"]')).toBeTruthy()
    expect(document.querySelector('[data-legal-timeline-item="entry:p-done"] [data-legal-timeline-hot="yes"]')).toBeNull()
    // The fee of Oct 1 is folded; pressing its day unfolds the past and scrolls to it.
    expect(document.querySelector('[data-legal-timeline-item="entry:fee"]')).toBeNull()
    fireEvent.click(strip.querySelector('[data-legal-timeline-strip-day="2026-10-01"]')!)
    vi.runAllTimers()
    expect(document.querySelector('[data-legal-timeline-item="entry:fee"]')).toBeTruthy()
    expect(scroll).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('an overdue step offers Mark done first; a sent paper wears its chip and keeps the sentence on the hover', () => {
    const sent = timelineDocumentsFromRows([{ id: 'd2', title: 'Response letter', shows: 'The answer.', added_at: '2026-10-22T18:00:00Z', added_by: 'u1', held_reason: '', dated_on: '2026-10-20', state: 'sent', sent_on: '2026-10-20', sent_how: 'certified_mail', sent_to: 'the GC' }], (iso) => iso.slice(0, 10), () => 'Grace')
    const t = buildLegalTimeline({ entries, documents: sent, todayYmd: TODAY, holds: {}, holdReasons: {}, userNameOf: () => 'Grace', reader: 'office' })
    render(<LegalTimelinePanel timeline={t} todayYmd={TODAY} reader="office" acts={acts()} />)
    const late = document.querySelector('[data-legal-timeline-item="entry:p-late"]')!
    const buttons = [...late.querySelectorAll('button')].map((b) => b.textContent)
    expect(buttons[0]).toBe('Mark done')
    expect(late.querySelector('[data-legal-timeline-done-first]')).toBeTruthy()
    const doc = document.querySelector('[data-legal-timeline-item="doc:d2"]')!
    expect(doc.textContent).toContain('document · sent · certified mail')
    expect(doc.querySelector('[data-legal-timeline-state-words]')).toBeNull()
    expect(doc.querySelector('[title^="Sent Oct 20 by certified mail to the GC"]')).toBeTruthy()
  })
})

describe('LegalTimelinePanel · a document line’s two doors (v2.6166)', () => {
  const docLine = () => document.querySelector('[data-legal-timeline-item="doc:d1"]') as HTMLElement

  it('Open the paper opens the file in place and Show on Evidence lands on the row; the words name the act', async () => {
    const openDocument = vi.fn(async () => {})
    const showOnEvidence = vi.fn()
    render(<LegalTimelinePanel timeline={timeline()} todayYmd={TODAY} reader="office" acts={null} onOpenEvidence={showOnEvidence} onOpenDocument={openDocument} />)
    expect([...docLine().querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Open the paper', 'Show on Evidence ↗'])
    fireEvent.click(docLine().querySelector('[data-legal-timeline-open-paper]')!)
    await waitFor(() => expect(openDocument).toHaveBeenCalledWith('d1'))
    expect(docLine().querySelector('[data-legal-timeline-open-error]')).toBeNull()
    fireEvent.click(docLine().querySelector('[data-legal-timeline-show-evidence]')!)
    expect(showOnEvidence).toHaveBeenCalledWith('d1')
    // A planned step has neither door.
    expect(document.querySelector('[data-legal-timeline-item="entry:p-next"] [data-legal-timeline-open-paper]')).toBeNull()
  })

  it('a paper the session may not read, or one gone from the bucket, says why under the line', async () => {
    const openDocument = vi.fn(async () => { throw new Error('Object not found') })
    render(<LegalTimelinePanel timeline={timeline()} todayYmd={TODAY} reader="office" acts={null} onOpenEvidence={vi.fn()} onOpenDocument={openDocument} />)
    fireEvent.click(docLine().querySelector('[data-legal-timeline-open-paper]')!)
    await waitFor(() => expect(docLine().querySelector('[data-legal-timeline-open-error]')!.textContent).toBe('Object not found'))
    expect(screen.getByRole('alert').textContent).toBe('Object not found')
  })

  it('without an opener (the firm’s portal) the line draws no Open the paper; without an Evidence door, none at all', () => {
    const { unmount } = render(<LegalTimelinePanel timeline={timeline()} todayYmd={TODAY} reader="office" acts={null} onOpenEvidence={vi.fn()} />)
    expect([...docLine().querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Show on Evidence ↗'])
    unmount()
    render(<LegalTimelinePanel timeline={timeline()} todayYmd={TODAY} reader="firm" look={PORTAL_LOOK} acts={null} />)
    expect(docLine().querySelectorAll('button').length).toBe(0)
  })
})
