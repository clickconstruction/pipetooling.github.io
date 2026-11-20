// @vitest-environment jsdom
/**
 * Render smokes for the Development page's Schedule look (punch list #382, PR 5), over an io that keeps its rows in
 * memory. The look draws only where this person is on a job's desk and a job has a stage line. The banner says what
 * the customer owes us and how far they have moved. One card a stage ahead, sorted by trouble, each with its dot, its
 * days, the ready bar and its list, one sentence with its values in place, and one press that opens the stage.
 * Every site, person and day here is made up.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { memoryStart, memoryStartChecksIo, type MemoryStart } from '../../test/startChecksMemoryIo'
import { useSiteStartChecks } from '../../hooks/useSiteStartChecks'
import type { StageLine, StartBulletRow, StartMarkRow } from '../../lib/startChecks/startCheckRows'
import { DevelopmentScheduleCard } from './DevelopmentScheduleCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// Messages' box has its own tests. Here it says what it was handed, and its send is a press.
vi.mock('../jobs/JobCustomerBox', () => ({
  JobCustomerBox: ({ kind, jobId, jobName, customerId, onSent }: { kind: string; jobId: string; jobName: string; customerId: string; onSent: () => void }) => (
    <div data-testid="messages-box" data-kind={kind} data-job={jobId} data-job-name={jobName} data-customer={customerId}>
      <button type="button" onClick={onSent}>
        send from Messages
      </button>
    </div>
  ),
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant', profileName: 'Dana' })
})

const TODAY = '2026-11-17'
const JOBS = [
  { id: 'j1', label: 'J2101', part: 'Lodge' },
  { id: 'j2', label: 'J2102', part: 'Bunkhouse' },
]
let n = 0
const at = () => `2026-11-${String(1 + (++n % 27)).padStart(2, '0')}T15:00:00Z`
const bullet = (id: string, jobId: string, fixtureId: string, o: Partial<StartBulletRow> = {}): StartBulletRow => ({ id, job_id: jobId, fixture_id: fixtureId, sort_order: ++n, words: `Bullet ${id}.`, waits_on: 'them', wants_photo: false, shown_to_gc: true, by_day: null, reads: null, hand_ok: false, hand_ok_at: null, hand_ok_by_name: '', template_id: null, removed_at: null, created_at: at(), ...o })
const mark = (id: string, bulletId: string, jobId: string, o: Partial<StartMarkRow> = {}): StartMarkRow => ({ id, bullet_id: bulletId, job_id: jobId, know: 'word', who_name: 'Ray', how: 'by phone', said_on: '2026-11-14', source: 'office', photo_storage_path: null, photo_file_name: null, taken_back_at: null, created_at: at(), ...o })
const line = (fixtureId: string, jobId: string, name: string, window: [string, string] | null, o: Partial<StageLine> = {}): StageLine => ({ fixtureId, jobId, name, order: ++n, finished: false, window, ...o })

/** Lodge Top Out waits on Ray near its day (amber). Bunkhouse Underground has their day after ours (red). Bunkhouse Rough In is far out (grey). Lodge Trim Set has no list. Lodge Rough In is finished. */
function seeded(over: Partial<MemoryStart> = {}): MemoryStart {
  return memoryStart({
    lines: [
      line('done', 'j1', 'Rough In', ['2026-03-09', '2026-03-20'], { finished: true }),
      line('top', 'j1', 'Top Out', ['2026-12-01', '2026-12-12']),
      line('trim', 'j1', 'Trim Set', ['2027-02-08', '2027-02-12']),
      line('under', 'j2', 'Underground', ['2026-12-08', '2026-12-12']),
      line('rough', 'j2', 'Rough In', ['2027-01-12', '2027-01-23']),
    ],
    rows: {
      bullets: [
        bullet('t1', 'j1', 'top', { words: 'The framing inspection has passed.' }),
        bullet('t2', 'j1', 'top', { words: 'Power is on for our tools.' }),
        bullet('u1', 'j2', 'under', { words: 'Forms are set where our pipe passes.' }),
        bullet('u2', 'j2', 'under', { words: 'Water is on site.' }),
        bullet('r1', 'j2', 'rough', { words: 'The slab is poured and cured enough to walk.' }),
        bullet('d1', 'j1', 'done', { words: 'Old bullet.' }),
      ],
      marks: [mark('m1', 't2', 'j1', { know: 'saw', who_name: 'Luis', how: 'on site' })],
      asks: [],
      theirDays: [
        { id: 'd1', job_id: 'j2', fixture_id: 'under', ready_day: '2026-12-01', said_on: '2026-10-28', who_name: 'Ray', how: 'phone', source: 'office', removed_at: null, created_at: at() },
        { id: 'd2', job_id: 'j2', fixture_id: 'under', ready_day: '2026-12-12', said_on: '2026-11-16', who_name: 'Ray', how: 'phone', source: 'office', removed_at: null, created_at: at() },
      ],
      decisions: [],
      arrivals: [],
    },
    ...over,
  })
}

let mayDecide = true
function Harness({ db, far = true }: { db: MemoryStart; far?: boolean }) {
  // The io is made once a mount, so a press reads the same rows it wrote and the read is not asked for again on every draw.
  const [io] = useState(() => memoryStartChecksIo(db))
  const read = useSiteStartChecks({ developmentId: 'dev-1', jobs: JOBS, contact: 'Ray', far, enabled: true, io })
  return (
    <>
      <span data-testid="shows">{String(read.shows)}</span>
      <DevelopmentScheduleCard anchorId="development-schedule" developmentId="dev-1" read={read} todayYmd={TODAY} me={{ userId: 'u-dana', name: 'Dana' }} can={{ window: true, notice: true, company: true, decide: mayDecide }} foldFor={(l) => ({ open: true, onToggle: () => {}, line: l })} contactLine="Ray Ortiz is the GC’s contact on the bids." askCustomerId="cust-1" jobNameOf={(id) => (id === 'j1' ? 'Lodge plumbing' : 'Bunkhouse plumbing')} />
    </>
  )
}
async function mount(db: MemoryStart, far = true) {
  renderWithProviders(<Harness db={db} far={far} />)
  await settle()
  await settle()
}
const cards = () => Array.from(document.querySelectorAll('[data-schedule-stage]')) as HTMLElement[]
const card = (id: string) => document.querySelector(`[data-schedule-stage="${id}"]`) as HTMLElement

afterEach(() => {
  cleanup()
  mayDecide = true
})

describe('the Schedule look', () => {
  it('does not draw where this person is on no job’s desk, or no job has a stage line', async () => {
    await mount(seeded({ onDesk: false }))
    expect(screen.getByTestId('shows').textContent).toBe('false')
    expect(document.querySelector('[data-development-schedule]')).toBeNull()
    cleanup()
    await mount(seeded({ lines: [] }))
    expect(document.querySelector('[data-development-schedule]')).toBeNull()
  })

  it('reads only the jobs this person is on the desk of', async () => {
    await mount(seeded({ deskJobs: ['j2'] }))
    await waitFor(() => expect(cards().length).toBe(2))
    expect(cards().map((c) => c.dataset.scheduleStage)).toEqual(['under', 'rough'])
  })

  it('a desk check that fails shows Retry in place of a look that is a job short, and Retry reads every job', async () => {
    // The first job's check is lost. Left out without a word, the look would draw the other job's two stages alone.
    await mount(seeded({ failDesk: new TypeError('Failed to fetch') }))
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.getByTestId('shows').textContent).toBe('true')
    expect(cards().length).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(cards().length).toBe(4))
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('draws the banner: what they owe us, who the contact is, and how far they have moved', async () => {
    await mount(seeded())
    await waitFor(() => expect(cards().length).toBe(4))
    const banner = document.querySelector('[data-schedule-banner]') as HTMLElement
    expect(banner.textContent).toBe('Ray owes us 3 answers on 2 stages.Ray Ortiz is the GC’s contact on the bids. They have moved 11 days on this site so far.Ask Ray about all 3')
    expect(within(banner).getByText('3 answers').dataset.value).toBe('worked-out')
  })

  it('draws one card a stage ahead, sorted by trouble, and leaves a finished stage out', async () => {
    await mount(seeded())
    await waitFor(() => expect(cards().length).toBe(4))
    expect(cards().map((c) => `${c.dataset.scheduleStage} ${c.dataset.light}`)).toEqual(['under red', 'top amber', 'rough grey', 'trim grey'])
    const under = card('under')
    expect(under.textContent).toContain('Bunkhouse · Underground')
    expect(under.textContent).toContain('Dec 8 to 12')
    expect(within(under).getByRole('img', { name: 'Their day is after ours' })).toBeTruthy()
    expect((under.querySelector('[data-schedule-sentence]') as HTMLElement).textContent).toBe('Ray says ready Dec 12. We planned to start Tue Dec 8.')
    expect((card('top').querySelector('[data-schedule-sentence]') as HTMLElement).textContent).toBe('Waiting on Ray for 1 thing. We decide by Sat Nov 21, in 4 days.')
    expect((card('rough').querySelector('[data-schedule-sentence]') as HTMLElement).textContent).toBe('1 thing open. Nothing to do until Dec 19.')
    expect((card('trim').querySelector('[data-schedule-sentence]') as HTMLElement).textContent).toBe('Nobody has written what must be true before this stage.')
  })

  it('names the one press by what comes next', async () => {
    await mount(seeded())
    await waitFor(() => expect(cards().length).toBe(4))
    expect(within(card('under')).getByRole('button', { name: 'Move our start' })).toBeTruthy()
    expect(within(card('trim')).getByRole('button', { name: 'Write the list' })).toBeTruthy()
    expect(within(card('top')).getByRole('button', { name: 'Ask Ray' })).toBeTruthy()
    // A stage with nothing to do yet is opened, not acted on.
    expect(within(card('rough')).getByRole('button', { name: 'Open' })).toBeTruthy()
  })

  it('draws the values in a sentence in place: our first day and their day change where they sit, the rest are bold', async () => {
    const db = seeded()
    await mount(db)
    await waitFor(() => expect(cards().length).toBe(4))
    const sentence = card('under').querySelector('[data-schedule-sentence]') as HTMLElement
    expect(within(sentence).getByText('Ray').dataset.value).toBe('worked-out')
    fireEvent.click(within(sentence).getByRole('button', { name: 'Tue Dec 8, our first day, press to change' }))
    fireEvent.change(screen.getByLabelText('our first day'), { target: { value: '2026-12-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(db.lines.find((l) => l.fixtureId === 'under')?.window).toEqual(['2026-12-15', '2026-12-19']))
    // Their day is no longer after ours and the day to decide is 18 days off, so the stage leaves red and the cards sort again.
    await waitFor(() => expect(card('under').dataset.light).toBe('grey'))
    expect(cards().map((c) => c.dataset.scheduleStage)).toEqual(['top', 'under', 'rough', 'trim'])
  })

  it('the ready bar lists what it takes to start, on a press', async () => {
    await mount(seeded())
    await waitFor(() => expect(cards().length).toBe(4))
    const bar = within(card('top')).getByRole('button', { name: '50% ready, 1 of 2. Press to see what it takes to start.' })
    expect(document.querySelector('[data-ready-list]')).toBeNull()
    fireEvent.click(bar)
    const list = document.querySelector('[data-ready-list]') as HTMLElement
    expect(list.textContent).toContain('What it takes to start Top Out')
    expect(list.textContent).toContain('1 of 2 ready, which is 50%. Every bullet counts the same.')
    expect(list.textContent).toContain('Still open · 1')
    expect(list.textContent).toContain('The framing inspection has passed.Not asked yet.')
    expect(list.textContent).toContain('Has a yes · 1')
    // The press on the bar did not open the card.
    expect(card('top').querySelector('[data-start-check-stage]')).toBeNull()
    fireEvent.keyDown(bar, { key: 'Escape' })
    expect(document.querySelector('[data-ready-list]')).toBeNull()
    // A stage with no list has no bar.
    expect(card('trim').querySelector('.scReady')).toBeNull()
  })

  it('the one press opens the stage to its four lines and its lists, and a tick there moves the card', async () => {
    const db = seeded()
    await mount(db)
    await waitFor(() => expect(cards().length).toBe(4))
    fireEvent.click(within(card('top')).getByRole('button', { name: 'Ask Ray' }))
    const stage = card('top').querySelector('[data-start-check-stage]') as HTMLElement
    // The press named the ask, so the stage opens with the ask in hand.
    expect(card('top').querySelector('[data-start-check-ask]')).toBeTruthy()
    expect(Array.from(stage.querySelectorAll('.vipLineLabel')).map((l) => l.textContent)).toEqual(['We start', 'Ray says ready', 'Notice we need', 'We decide by'])
    expect(within(stage).getByText('10 days')).toBeTruthy()
    // The card's own press now closes it. The ask panel has a Close of its own.
    expect(within(card('top')).getAllByRole('button', { name: 'Close' }).some((b) => b.getAttribute('aria-expanded') === 'true')).toBe(true)
    fireEvent.click(within(stage).getByRole('button', { name: 'The framing inspection has passed.' }))
    await waitFor(() => expect(card('top').dataset.light).toBe('green'))
    expect((card('top').querySelector('[data-schedule-sentence]') as HTMLElement).textContent).toBe('Nothing is open. Press Go to confirm the crew for Tue Dec 1.')
    expect((document.querySelector('[data-schedule-banner]') as HTMLElement).textContent).toContain('Ray owes us 2 answers on 1 stage.')
    // The site's notice is kept on the site's row, for every stage on it.
    fireEvent.click(within(card('top')).getByRole('button', { name: 'Set this site’s own, days of notice' }))
    fireEvent.change(screen.getByLabelText('days of notice'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(db.site).toMatchObject({ development_id: 'dev-1', notice_days: 5 }))
  })

  it('the banner’s press asks about every stage whose day to decide is near, in one message kept on each bullet', async () => {
    const db = seeded()
    await mount(db)
    await waitFor(() => expect(cards().length).toBe(4))
    fireEvent.click(within(document.querySelector('[data-schedule-banner]') as HTMLElement).getByRole('button', { name: 'Ask Ray about all 3' }))
    const panel = document.querySelector('[data-start-check-ask]') as HTMLElement
    expect(panel.textContent).toContain('Ask Ray about 3 things')
    expect((within(panel).getByLabelText('The ask') as HTMLTextAreaElement).value).toContain('Bunkhouse underground, we plan Tue Dec 8 and decide by Sat Nov 28:')
    fireEvent.click(within(panel).getByRole('button', { name: 'Text it' }))
    // Messages ties the one message to the first stage's job, in the site's customer's thread.
    expect(screen.getByTestId('messages-box').dataset).toMatchObject({ kind: 'text', job: 'j1', jobName: 'Lodge plumbing', customer: 'cust-1' })
    expect(db.rows.asks).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'send from Messages' }))
    await waitFor(() => expect(db.rows.asks).toHaveLength(3))
    expect(db.rows.asks.map((a) => `${a.fixture_id} ${a.bullet_id} ${a.how}`).sort()).toEqual(['top t1 text', 'under u1 text', 'under u2 text'])
    await waitFor(() => expect(document.querySelector('[data-start-check-ask]')).toBeNull())
    // Every open bullet was asked today, so a stage that waits on them no longer offers the ask as what comes next.
    expect((document.querySelector('[data-schedule-banner]') as HTMLElement).textContent).toContain('Ray owes us 3 answers on 2 stages.')
  })

  it('an open stage asks about its own open bullets', async () => {
    const db = seeded()
    await mount(db)
    await waitFor(() => expect(cards().length).toBe(4))
    fireEvent.click(within(card('top')).getByRole('button', { name: 'Ask Ray' }))
    expect(within(card('top')).getByRole('button', { name: 'Ask Ray about 1' }).getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(within(card('top')).getByRole('button', { name: 'I called' }))
    await waitFor(() => expect(db.rows.asks.map((a) => `${a.bullet_id} ${a.how}`)).toEqual(['t1 phone']))
    await waitFor(() => expect(card('top').textContent).toContain('by phone. No answer yet.'))
    // A stage with nothing open on them offers no ask.
    fireEvent.click(within(card('trim')).getByRole('button', { name: 'Write the list' }))
    expect(within(card('trim')).queryByRole('button', { name: /^Ask Ray/ })).toBeNull()
  })

  it('Go, with every yes in: the press reads Go, the name is kept, and the Go can be taken back', async () => {
    const db = seeded()
    db.rows = { ...db.rows, marks: [...db.rows.marks, mark('m-t1', 't1', 'j1')] }
    await mount(db)
    await waitFor(() => expect(cards().length).toBe(4))
    expect(card('top').dataset.light).toBe('green')
    fireEvent.click(within(card('top')).getByRole('button', { name: 'Go' }))
    const panel = card('top').querySelector('[data-start-check-decide]') as HTMLElement
    expect(panel.textContent).toContain('Everything on the list has a yes.')
    expect(panel.textContent).toContain('Send the crew for Tue Dec 1.')
    expect(panel.textContent).toContain('Nothing is blocked. A crew can be scheduled with no Go.')
    fireEvent.click(within(panel.querySelector('[data-decide="go"]') as HTMLElement).getByRole('button', { name: 'Go' }))
    await waitFor(() => expect(db.rows.decisions).toHaveLength(1))
    expect(db.rows.decisions[0]).toMatchObject({ kind: 'go', fixture_id: 'top', by_name: 'Dana', decided_on: '2026-11-17', open_then: [], start_then: '2026-12-01', hold_until: null })
    await waitFor(() => expect((card('top').querySelector('[data-schedule-sentence]') as HTMLElement).textContent).toBe('Crew confirmed for Tue Dec 1. Dana pressed Go Nov 17.'))
    expect(card('top').querySelector('[data-start-check-decide]')).toBeNull()
    const foot = card('top').querySelector('[data-start-check-foot]') as HTMLElement
    expect((foot.querySelector('[data-start-check-decision="go"]') as HTMLElement).textContent).toBe('Go. Dana, Nov 17.')
    expect(within(foot).queryByRole('button', { name: 'Go or hold' })).toBeNull()
    fireEvent.click(within(foot).getByRole('button', { name: 'Take the Go back' }))
    await waitFor(() => expect(db.rows.decisions[0]?.taken_back_at).toBeTruthy())
    await waitFor(() => expect((card('top').querySelector('[data-schedule-sentence]') as HTMLElement).textContent).toBe('Nothing is open. Press Go to confirm the crew for Tue Dec 1.'))
  })

  it('a go on their promise keeps what was open, and the stage says when it comes back', async () => {
    const db = seeded()
    await mount(db)
    await waitFor(() => expect(cards().length).toBe(4))
    fireEvent.click(within(card('top')).getByRole('button', { name: 'Ask Ray' }))
    fireEvent.click(within(card('top')).getByRole('button', { name: 'Go or hold' }))
    // One panel at a time: the ask steps aside for the decision.
    expect(card('top').querySelector('[data-start-check-ask]')).toBeNull()
    const panel = card('top').querySelector('[data-start-check-decide]') as HTMLElement
    expect(panel.textContent).toContain('1 thing is still open.')
    expect(panel.textContent).toContain('This is a go on their promise. It comes back to you Mon Nov 30, the day before the crew leaves.')
    fireEvent.click(within(panel).getByRole('button', { name: 'Go, on their promise' }))
    await waitFor(() => expect(db.rows.decisions[0]).toMatchObject({ kind: 'go', open_then: ['The framing inspection has passed.'] }))
    await waitFor(() => expect((card('top').querySelector('[data-schedule-sentence]') as HTMLElement).textContent).toBe('Dana pressed Go Nov 17 with 1 thing open. Last check Mon Nov 30.'))
    expect(card('top').dataset.light).toBe('amber')
  })

  it('a Hold moves our start and keeps its length, and writes the note for the office to send', async () => {
    const db = seeded()
    await mount(db)
    await waitFor(() => expect(cards().length).toBe(4))
    fireEvent.click(within(card('top')).getByRole('button', { name: 'Ask Ray' }))
    fireEvent.click(within(card('top')).getByRole('button', { name: 'Go or hold' }))
    const hold = card('top').querySelector('[data-decide="hold"]') as HTMLElement
    // A week on from our first day is offered, and the day can be picked.
    expect((within(hold).getByLabelText('The day our start moves to') as HTMLInputElement).value).toBe('2026-12-08')
    fireEvent.change(within(hold).getByLabelText('The day our start moves to'), { target: { value: '2026-12-15' } })
    expect((hold.querySelector('[data-hold-note]') as HTMLElement).textContent).toBe('Ray, we are holding our start on the Lodge top out. We planned Tue Dec 1.\nWe cannot send a crew until this is true:\n1. The framing inspection has passed.\nOur next opening is Tue Dec 15. Tell us the day it is ready and we will lock it in.')
    fireEvent.click(within(hold).getByRole('button', { name: 'Hold until Dec 15' }))
    await waitFor(() => expect(db.rows.decisions[0]).toMatchObject({ kind: 'hold', hold_until: '2026-12-15', start_then: '2026-12-01', by_name: 'Dana' }))
    expect(db.lines.find((l) => l.fixtureId === 'top')?.window).toEqual(['2026-12-15', '2026-12-26'])
    // Nothing was sent. The note is in hand, written for the day our start moved to, and the office sends it.
    expect(db.rows.asks).toEqual([])
    const note = await waitFor(() => card('top').querySelector('[data-start-check-ask="note"]') as HTMLElement)
    expect(note.textContent).toContain('The note for Ray')
    expect(note.textContent).toContain('A hold tells nobody by itself. Change any word, then send the note.')
    expect((within(note).getByLabelText('The hold note') as HTMLTextAreaElement).value).toContain('We planned Tue Dec 1.')
    fireEvent.click(within(note).getByRole('button', { name: 'I emailed it' }))
    await waitFor(() => expect(db.rows.asks.map((a) => `${a.kind} ${a.fixture_id} ${a.bullet_id} ${a.how}`)).toEqual(['hold_note top null email']))
    await waitFor(() => expect((card('top').querySelector('[data-schedule-sentence]') as HTMLElement).textContent).toContain('On hold since Nov 17.'))
    expect((card('top').querySelector('[data-start-check-decision="hold"]') as HTMLElement).textContent).toBe('On hold. Dana, Nov 17.')
  })

  it('a decision that is refused says why, and nothing is decided', async () => {
    const db = seeded()
    await mount(db)
    await waitFor(() => expect(cards().length).toBe(4))
    fireEvent.click(within(card('top')).getByRole('button', { name: 'Ask Ray' }))
    fireEvent.click(within(card('top')).getByRole('button', { name: 'Go or hold' }))
    db.failNext = 'Go and Hold are for the office and the job’s superintendent.'
    fireEvent.click(within(card('top')).getByRole('button', { name: 'Go, on their promise' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Go and Hold are for the office and the job’s superintendent.')
    expect(db.rows.decisions).toEqual([])
    expect(card('top').querySelector('[data-start-check-decide]')).toBeTruthy()
  })

  it('a person who may not decide is offered the stage, and no Go or hold', async () => {
    mayDecide = false
    const db = seeded()
    db.rows = { ...db.rows, marks: [...db.rows.marks, mark('m-t1', 't1', 'j1')] }
    await mount(db)
    await waitFor(() => expect(cards().length).toBe(4))
    fireEvent.click(within(card('top')).getByRole('button', { name: 'Open' }))
    expect(card('top').querySelector('[data-start-check-decide]')).toBeNull()
    expect(within(card('top')).queryByRole('button', { name: 'Go or hold' })).toBeNull()
  })

  it('a near site reads two days of notice by default', async () => {
    await mount(seeded(), false)
    await waitFor(() => expect(cards().length).toBe(4))
    expect((card('top').querySelector('[data-schedule-sentence]') as HTMLElement).textContent).toBe('Waiting on Ray for 1 thing. We decide by Sun Nov 29, in 12 days.')
  })
})
