// @vitest-environment jsdom
/**
 * Render smoke for the Lien desk's Calendar tab (v2.4101 the shell, v2.4152
 * the body): a GC row with counted flags and its jobs' marks on the shared
 * axis, the search narrows, a row opens the job, and the phone list instead
 * of the axis. The grouping, the axis and every mark come from
 * lib/jobs/lienCalendar.ts (kernel-tested).
 * v2.4265: the work tick and its date, the grey wash past a dead lien, a job
 * row that speaks only when it differs from its GC, and the key whose long
 * words open on a tap.
 * v2.4340: the pills and the buckets (lib/jobs/lienCalendarBuckets.ts) —
 * each job counted once at its next date, Overdue folded at the top, a
 * picked pill shows its bucket alone, Draft the N on a bar, the counts on
 * the date row and the key one line at the bottom.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LienDeskCalendarTab from './LienDeskCalendarTab'

const promiseWrites: unknown[] = []
const kindWrites: unknown[] = []
vi.mock('../../lib/jobs/paymentChaseIo', () => ({
  addJobPaymentPromise: vi.fn(async (args: unknown) => {
    promiseWrites.push(args)
  }),
  addJobPaymentPromisesSettled: vi.fn(async (args: { jobIds: string[] }) => {
    promiseWrites.push(args)
    return { saved: args.jobIds, failed: [] }
  }),
}))
vi.mock('../../lib/jobs/propertyKindWrite', () => ({ savePropertyKind: vi.fn(async (id: string, kind: string) => { kindWrites.push([id, kind]) }) }))
vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: vi.fn(), showActionToast: vi.fn() }) }))
afterEach(() => {
  cleanup()
  promiseWrites.length = 0
  kindWrites.length = 0
})
import { buildLienPayRunway } from '../../lib/jobs/lienPayRunway'
import type { LienCalendarJob } from '../../lib/jobs/lienCalendar'

const TODAY = '2026-09-28'
const base = { todayYmd: TODAY, openBalance: 1000, propertyKind: 'residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null }
const rows: LienCalendarJob[] = [
  { jobId: 'a', number: '890 PLUM', name: 'Rizvi', customer: 'Dudley Mason', gcId: 'gc1', gcName: 'RMC · Dudley Mason', address: '628 Terrell Rd', openBalance: 9800, isSub: true, runway: buildLienPayRunway({ ...base, openBalance: 9800, lastWorkYmd: '2026-08-12', isSub: true }), lastWorkYmd: '2026-08-12' },
  { jobId: 'b', number: '881 PLUM', name: 'Umar Khan', customer: 'Dudley Mason', gcId: 'gc1', gcName: 'RMC · Dudley Mason', address: '9703 Lenox Hl', openBalance: 7902, isSub: true, runway: buildLienPayRunway({ ...base, openBalance: 7902, lastWorkYmd: '2026-08-20', propertyKind: '', isSub: true, workMonths: ['2026-07', '2026-08'], noticedMonths: ['2026-07'] }), lastWorkYmd: '2026-08-20', addressId: 'addr-b' },
  { jobId: 'd', number: '473 PLUM', name: 'Mike Holub', customer: 'Michael Holub', gcId: null, gcName: null, address: '109 Tuscarora', openBalance: 5724, isSub: false, runway: buildLienPayRunway({ ...base, openBalance: 5724, lastWorkYmd: '2026-08-12', expectedPayYmd: '2026-09-30' }), lastWorkYmd: '2026-08-12' },
  { jobId: 'e', number: '663 PLUM', name: 'Knight', customer: 'Knight Contracting', gcId: 'gc2', gcName: 'Knight Contracting', address: '', openBalance: 658, isSub: true, runway: buildLienPayRunway({ ...base, openBalance: 658, lastWorkYmd: '2026-03-01', isSub: true }), lastWorkYmd: '2026-03-01' },
  // a direct job with no pay date — the one row that draws its own dashed dot (under a GC the GC row's dot speaks)
  { jobId: 'f', number: '512 PLUM', name: 'Garza', customer: 'Ana Garza', gcId: null, gcName: null, address: '77 Alamo Pl', openBalance: 1200, isSub: false, runway: buildLienPayRunway({ ...base, openBalance: 1200, lastWorkYmd: null, createdAt: '2026-08-03T15:00:00Z' }), lastWorkYmd: null },
]

/** A job's row on the board, found by its number. */
function rowOf(number: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${number}`) }).closest('[role="row"]') as HTMLElement
}

/** The Overdue section's bar (the pill of the same name filters instead). */
function overdueBar(): HTMLElement {
  return within(screen.getByTestId('lien-cal-bucket-overdue')).getByRole('button', { name: /^Overdue/ })
}

function mount(over: Partial<Parameters<typeof LienDeskCalendarTab>[0]> = {}) {
  const onOpen = vi.fn()
  render(<LienDeskCalendarTab rows={rows} todayYmd={TODAY} onOpenJob={onOpen} {...over} />)
  return { onOpen }
}

describe('LienDeskCalendarTab', () => {
  // On Sep 28 the two RMC notices fall due Oct 15 (next month), the two direct liens Nov 16 (later), and Knight's lien is gone.
  it('the pills count each job once at its next date; All shows every bucket that has a job, Overdue folded at the top', () => {
    mount()
    expect(within(screen.getByTestId('lien-cal-pills')).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'All · 5 jobs · $25,284',
      'Overdue · 1 job · $658',
      'This month · 0 jobs · $0',
      'Next month · 2 jobs · $17,702',
      'Later · 2 jobs · $6,924',
    ])
    expect(screen.getByRole('button', { name: /^All · 5 jobs/ }).getAttribute('aria-pressed')).toBe('true')
    const sections = screen.getAllByTestId(/^lien-cal-bucket-/)
    expect(sections.map((s) => s.getAttribute('data-testid'))).toEqual(['lien-cal-bucket-overdue', 'lien-cal-bucket-next_month', 'lien-cal-bucket-later'])
    const overdue = within(sections[0]!).getByRole('button', { name: /^Overdue/ })
    expect(overdue.getAttribute('aria-expanded')).toBe('false')
    expect(sections[0]!.textContent).toContain('1 job · nothing left to file · money still owed')
    expect(overdue.getAttribute('title')).toContain('Collections or the Legal desk can chase it.')
    expect(sections[1]!.textContent).toContain('by Oct 15 · in 17 days · 2 notices to RMC · Dudley Mason')
    expect(sections[2]!.textContent).toContain('by Nov 16 · in 49 days · 2 liens to file')
    // the date row: the search, each 15th with how many jobs it is the next date for, today
    expect(screen.getAllByTestId('lien-cal-date-count').map((c) => c.textContent)).toEqual(['2', '2'])
    expect(screen.getByTestId('lien-cal-today-pill').textContent).toBe('today · Sep 28')
    expect(screen.getByTestId('lien-cal-today-line')).toBeTruthy()
    const key = screen.getByTestId('lien-cal-key')
    expect(key.textContent).toContain('Notice owed')
    expect(key.textContent).toContain('Last day worked')
    expect(key.textContent).not.toContain('§ 53.056')
    expect(screen.queryByTestId('lien-cal-todo')).toBeNull()
    expect(screen.queryByTestId('lien-cal-density')).toBeNull()
  })

  it('a pill shows its bucket alone and shades its stretch; a second tap goes back to All', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: /^Later · 2 jobs/ }))
    expect(screen.getAllByTestId(/^lien-cal-bucket-/).map((s) => s.getAttribute('data-testid'))).toEqual(['lien-cal-bucket-later'])
    expect(screen.getByTestId('lien-cal-band')).toBeTruthy()
    expect(screen.queryByText('Rizvi')).toBeNull()
    expect(screen.getByText('Mike Holub')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Later · 2 jobs/ }))
    expect(screen.getAllByTestId(/^lien-cal-bucket-/)).toHaveLength(3)
    expect(screen.queryByTestId('lien-cal-band')).toBeNull()
    // an empty month says so
    fireEvent.click(screen.getByRole('button', { name: /^This month · 0 jobs/ }))
    expect(screen.getByText('Nothing else falls due in September.')).toBeTruthy()
    // the Overdue pill opens Overdue; All folds it again
    fireEvent.click(screen.getByRole('button', { name: /^Overdue · 1 job/ }))
    expect(screen.getByText('Knight')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^All · 5 jobs/ }))
    expect(screen.queryByText('Knight')).toBeNull()
  })

  it('groups: the GC row folds its flags with a count, its jobs draw their marks; Overdue opens to its rows', () => {
    mount()
    const rmc = screen.getByTestId('lien-cal-group-gc:gc1')
    expect(rmc.textContent).toContain('RMC · Dudley Mason')
    // the bar names Oct 15, so the GC row says only what to send
    expect(rmc.textContent).toContain('send 2 notices')
    expect(rmc.textContent).not.toContain('by Oct 15')
    expect(rmc.querySelector('[title="2 notices owed by Oct 15"]')).toBeTruthy()
    // Umar Khan: the sent month's check, the owed month's hollow flag (a door), the kind bracket
    const tracks = screen.getAllByTestId('lien-cal-track')
    expect(tracks.length).toBe(4)
    const umar = rowOf('881 PLUM')
    expect(within(umar).getByRole('button', { name: /A § 53.056 notice is owed for August 2026 — send it by Oct 15/ })).toBeTruthy()
    expect(within(umar).getByTitle('The July 2026 notice is on file')).toBeTruthy()
    // every flag names its month — Rizvi's August too, which used to say "the last work month"
    expect(within(rowOf('890 PLUM')).getByRole('button', { name: /A § 53.056 notice is owed for August 2026 — send it by Oct 15/ })).toBeTruthy()
    expect(screen.getByTitle(/Property kind not set: residential would be the first date, commercial Dec 15/)).toBeTruthy()
    // Mike Holub: a pay dot and room
    expect(screen.getByTitle(/Expected to pay Sep 30/)).toBeTruthy()
    expect(screen.getByTitle('Room — the money is expected before the lien date')).toBeTruthy()
    expect(screen.queryByText('Knight')).toBeNull()
    fireEvent.click(overdueBar())
    expect(screen.getByText('Knight')).toBeTruthy()
    // Overdue's rows sit straight under its bar: no Lien gone row repeating it
    expect(screen.queryByTestId('lien-cal-group-gone')).toBeNull()
    expect(screen.getByTitle(/The notice window closed May 15 unsent/)).toBeTruthy()
  })

  it('every row starts at its work tick; a job dated from its creation day says so in amber (v2.4265)', () => {
    mount()
    const ticks = screen.getAllByTestId('lien-cal-work')
    expect(ticks.length).toBe(4) // Rizvi, Umar Khan, Holub, Garza; Knight's is folded under Overdue
    expect(ticks.filter((t) => t.textContent === 'Aug 12').length).toBe(2)
    expect(screen.getByText('Aug 20')).toBeTruthy()
    expect(screen.getByText('Aug · no hours')).toBeTruthy()
    expect(screen.getByTitle(/No approved hours — the board counts from the month the job was created \(Aug 3\)/)).toBeTruthy()
  })

  it('a job row says only what its GC row does not; under a GC the dashed dot is the GC’s (v2.4265)', () => {
    mount()
    const money = screen.getAllByTestId('lien-cal-row-money')
    // Rizvi and Umar Khan owe the Oct 15 notice the RMC row already names — nothing under their money
    expect(money[0]!.textContent).toBe('$9,800')
    expect(money[1]!.textContent).toBe('$7,902')
    // Holub, direct, keeps his verdict
    expect(screen.getByText('47 d of room')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Record when Dudley Mason expects to pay · 890 PLUM' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Record when Ana Garza expects to pay · 512 PLUM' })).toBeTruthy()
  })

  it('a dead row goes grey past the day its lien died, with that day under the flag (v2.4265)', () => {
    mount()
    expect(screen.queryByTestId('lien-cal-gone')).toBeNull()
    fireEvent.click(overdueBar())
    const wash = screen.getByTestId('lien-cal-gone')
    expect(wash.textContent).toBe('notice not sent by May 15')
    const knight = screen.getAllByTestId('lien-cal-row-money').find((m) => m.textContent?.startsWith('$658'))!
    expect(knight.textContent).toBe('$658still owed')
  })

  it('the key is one line: a tap opens the long words, a second tap or Esc closes them, and its door acts (v2.4265)', () => {
    mount({ canWrite: true })
    expect(screen.queryByTestId('lien-cal-key-panel')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Kind not set' }))
    const panel = screen.getByTestId('lien-cal-key-panel')
    expect(panel.textContent).toContain('A house read as commercial is a lien lost a month late')
    expect(screen.getByRole('button', { name: 'Kind not set' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Lien gone' }))
    expect(screen.getByTestId('lien-cal-key-panel').textContent).toContain('nothing can be filed after it')
    fireEvent.click(screen.getByRole('button', { name: 'Lien gone' }))
    expect(screen.queryByTestId('lien-cal-key-panel')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'No approved hours' }))
    fireEvent.keyDown(screen.getByTestId('lien-cal-key'), { key: 'Escape' })
    expect(screen.queryByTestId('lien-cal-key-panel')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Kind not set' }))
    fireEvent.click(within(screen.getByTestId('lien-cal-key-panel')).getByRole('button', { name: 'Set kinds, biggest first ›' }))
    expect(screen.getByTestId('lien-cal-kinds')).toBeTruthy()
    expect(screen.queryByTestId('lien-cal-key-panel')).toBeNull()
  })

  it('a row and a hollow flag open the job; the search narrows the buckets and their counts', () => {
    const { onOpen } = mount()
    fireEvent.click(screen.getByRole('button', { name: /^890 PLUM/ }))
    expect(onOpen).toHaveBeenCalledWith('a')
    fireEvent.click(within(rowOf('881 PLUM')).getByRole('button', { name: /A § 53.056 notice is owed for August 2026/ }))
    expect(onOpen).toHaveBeenLastCalledWith('b')
    fireEvent.change(screen.getByLabelText('Search the lien calendar'), { target: { value: 'holub' } })
    expect(screen.queryByText('RMC · Dudley Mason')).toBeNull()
    expect(screen.getByText('Direct — we contracted with the owner')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'All · 1 job · $5,724' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search the lien calendar'), { target: { value: 'nobody' } })
    expect(screen.getByText('No billed job matches that.')).toBeTruthy()
    // the search stays on the board, so it can be cleared
    expect(screen.getByLabelText('Search the lien calendar')).toBeTruthy()
  })

  it('Draft the N sits on the bar whose notices the desk lists; the kinds door is the pen’s', () => {
    const onDraft = vi.fn()
    mount({ onDraft })
    fireEvent.click(screen.getByRole('button', { name: 'Draft the two ›' }))
    expect(onDraft).toHaveBeenCalledWith('2026-10-15', ['a', 'b'])
    // without the pen the toolbar names the kinds, it does not open them
    expect(screen.getByText('1 kind not set')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /kind not set/ })).toBeNull()
  })

  it('a job worked over several months: counted once at its earliest notice, its GC row in that month; the phone line agrees (v2.4308)', () => {
    // Job 878, read live on 2026-10-01: commercial, worked June through September, no notice recorded.
    // The row said "send the notice by Dec 15 · 75 d" and sorted near the bottom while July's notice was due Oct 15.
    const OCT_1 = '2026-10-01'
    const seguin: LienCalendarJob = { jobId: 's', number: '878', name: 'Take 5- Seguin', customer: '', gcId: 'gc-sp', gcName: 'Southern Post Construction', address: '380 TX-123, Seguin', openBalance: 38625, isSub: true, runway: buildLienPayRunway({ ...base, todayYmd: OCT_1, openBalance: 38625, propertyKind: 'non_residential', lastWorkYmd: '2026-09-21', isSub: true, workMonths: ['2026-06', '2026-07', '2026-08', '2026-09'] }), lastWorkYmd: '2026-09-21' }
    const later: LienCalendarJob = { jobId: 'h', number: '983', name: 'Water Heater removal', customer: '', gcId: 'gc-hi', gcName: 'H & I Construction', address: '25233 Four Iron Ct', openBalance: 350, isSub: true, runway: buildLienPayRunway({ ...base, todayYmd: OCT_1, openBalance: 350, lastWorkYmd: '2026-09-03', isSub: true, workMonths: ['2026-09'] }), lastWorkYmd: '2026-09-03' }
    render(<LienDeskCalendarTab rows={[later, seguin]} todayYmd={OCT_1} onOpenJob={vi.fn()} />)
    expect(within(screen.getByTestId('lien-cal-bucket-this_month')).getByTestId('lien-cal-group-gc:gc-sp').textContent).toContain('send the notice')
    expect(screen.getByTestId('lien-cal-bucket-this_month').textContent).toContain('by Oct 15 · in 14 days · 1 notice to Southern Post Construction')
    expect(within(screen.getByTestId('lien-cal-bucket-next_month')).getByTestId('lien-cal-group-gc:gc-hi')).toBeTruthy()
    expect(screen.getByTestId('lien-cal-bucket-next_month').textContent).toContain('by Nov 16 · in 46 days')
    // July, August and September each carry a hollow flag; June's window closed, so it draws none
    expect(within(rowOf('878')).getAllByRole('button', { name: /A § 53.056 notice is owed for (July|August|September) 2026/ })).toHaveLength(3)
    cleanup()
    render(<LienDeskCalendarTab rows={[later, seguin]} todayYmd={OCT_1} onOpenJob={vi.fn()} isMobile />)
    expect(screen.getByText('notice by Oct 15 · lien by Jan 15')).toBeTruthy()
  })

  it('on a phone: no axis — the pills, then each bucket’s rows as sentences', () => {
    const onDraft = vi.fn()
    mount({ isMobile: true, onDraft })
    const phone = screen.getByTestId('lien-cal-phone')
    expect(within(phone).getAllByTestId(/^lien-cal-bucket-/).map((s) => s.getAttribute('data-testid'))).toEqual(['lien-cal-bucket-overdue', 'lien-cal-bucket-next_month', 'lien-cal-bucket-later'])
    expect(within(phone).getAllByText('notice by Oct 15 · lien by Nov 16')).toHaveLength(2)
    fireEvent.click(within(phone).getByRole('button', { name: 'Draft the two ›' }))
    expect(onDraft).toHaveBeenCalledWith('2026-10-15', ['a', 'b'])
    expect(screen.getByRole('button', { name: /^Next month · 2 jobs/ })).toBeTruthy()
    expect(screen.queryByTestId('lien-cal-dates')).toBeNull()
    expect(screen.queryByTestId('lien-cal-key')).toBeNull()
    // the search sits behind its button
    expect(screen.queryByLabelText('Search the lien calendar')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    fireEvent.change(screen.getByLabelText('Search the lien calendar'), { target: { value: 'garza' } })
    expect(within(screen.getByTestId('lien-cal-phone')).getAllByTestId(/^lien-cal-bucket-/)).toHaveLength(1)
  })
})

describe('before the Pipeline has read its billed jobs (v2.4321)', () => {
  // The phone board loads a stage's rows only when its chip is picked, so the desk can open before
  // the billed jobs are on the board. It said "0 jobs · $0 open" and "Nothing billed is on a lien clock."
  it.each([false, true])('rows not read yet say so, never 0 jobs (phone: %s)', (isMobile) => {
    mount({ rows: null, isMobile })
    expect(screen.getByText('Reading the board…')).toBeTruthy()
    expect(screen.queryByText(/0 jobs/)).toBeNull()
    expect(screen.queryByTestId('lien-cal-pills')).toBeNull()
    expect(screen.queryByText('Nothing billed is on a lien clock.')).toBeNull()
    expect(screen.queryByTestId('lien-cal-phone')).toBeNull()
  })

  it('an empty board that was read is empty: the count, then the sentence', () => {
    mount({ rows: [], isMobile: true })
    expect(screen.getByRole('button', { name: 'All · 0 jobs · $0' })).toBeTruthy()
    expect(screen.getByText('Nothing billed is on a lien clock.')).toBeTruthy()
    expect(screen.queryByText('Reading the board…')).toBeNull()
  })
})


describe('the pen (v2.4153)', () => {
  it('the dashed dot opens They said… with the consequence read back; Save writes the promise', async () => {
    const onChanged = vi.fn()
    mount({ canWrite: true, onChanged })
    fireEvent.click(screen.getByRole('button', { name: 'Record when Ana Garza expects to pay · 512 PLUM' }))
    const pen = screen.getByTestId('lien-cal-pen')
    expect(pen.textContent).toContain('512 PLUM')
    fireEvent.change(within(pen).getByLabelText('Pay by'), { target: { value: '2026-11-20' } })
    expect(screen.getByTestId('lien-cal-pen-consequence').textContent).toBe('4 d after the lien flag — file first')
    fireEvent.change(within(pen).getByLabelText('Pay by'), { target: { value: '2026-10-03' } })
    expect(screen.getByTestId('lien-cal-pen-consequence').textContent).toBe('44 d of room before the lien flag')
    fireEvent.change(within(pen).getByLabelText('Note'), { target: { value: 'check with the draw' } })
    fireEvent.click(within(pen).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(promiseWrites).toHaveLength(1))
    expect(promiseWrites[0]).toEqual({ jobId: 'f', ymd: '2026-10-03', saidBy: 'Ana Garza', channel: null, note: 'check with the draw' })
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('promise'))
    expect(screen.queryByTestId('lien-cal-pen')).toBeNull()
  })
  it('without the pen the dot opens the job', () => {
    const { onOpen } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Record when Ana Garza expects to pay · 512 PLUM' }))
    expect(onOpen).toHaveBeenCalledWith('f')
    expect(screen.queryByTestId('lien-cal-pen')).toBeNull()
  })
  it('the GC row’s dot writes the GC’s word for every job in the group', async () => {
    mount({ canWrite: true })
    fireEvent.click(screen.getByRole('button', { name: 'Record RMC · Dudley Mason\'s word for all 2 jobs' }))
    const pen = screen.getByTestId('lien-cal-pen')
    expect(pen.textContent).toContain('RMC · Dudley Mason · 2 jobs')
    fireEvent.change(within(pen).getByLabelText('Pay by'), { target: { value: '2026-10-09' } })
    fireEvent.click(within(pen).getByRole('button', { name: 'Save for all 2' }))
    await waitFor(() => expect(promiseWrites).toHaveLength(1))
    expect(promiseWrites[0]).toMatchObject({ jobIds: ['a', 'b'], ymd: '2026-10-09', saidBy: 'RMC · Dudley Mason' })
  })
  it('the toolbar’s kinds door opens the sheet biggest first and writes the kind', async () => {
    const onChanged = vi.fn()
    mount({ canWrite: true, onChanged })
    const door = screen.getByRole('button', { name: '1 kind not set ›' })
    fireEvent.click(door)
    expect(door.getAttribute('aria-expanded')).toBe('true')
    const sheet = screen.getByTestId('lien-cal-kinds')
    expect(within(sheet).getByTestId('lien-cal-kind-b').textContent).toContain('881 PLUM · Umar Khan')
    fireEvent.click(within(within(sheet).getByTestId('lien-cal-kind-b')).getByRole('button', { name: /residential/i }))
    await waitFor(() => expect(kindWrites).toEqual([['addr-b', 'residential']]))
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('kind'))
  })
})
