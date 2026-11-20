// @vitest-environment jsdom
/**
 * Render smokes for Ask them (punch list #382, PR 6). The ask is written from the open bullets across every stage it
 * covers, and any word can be changed. Text it and Email it open Messages' box filled and send nothing in the press.
 * A send from that box, or saying how it went out another way, keeps the ask: a row for each bullet it covered.
 * Every site, person and day here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { memoryStart, memoryStartChecksIo } from '../../test/startChecksMemoryIo'
import { stageFromRows, type StageLine, type StartBulletRow } from '../../lib/startChecks/startCheckRows'
import type { StartChecksIo } from '../../lib/startChecks/startChecksIo'
import { StartCheckAskPanel } from './StartCheckAskPanel'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// Messages' box has its own tests. Here it says what it was handed, and its send is a press.
vi.mock('../jobs/JobCustomerBox', () => ({
  JobCustomerBox: ({ kind, jobId, jobName, customerId, startWords, onSent }: { kind: string; jobId: string; jobName: string; customerId: string; startWords: string; onSent: () => void }) => (
    <div data-testid="messages-box" data-kind={kind} data-job={jobId} data-job-name={jobName} data-customer={customerId}>
      <pre>{startWords}</pre>
      <button type="button" onClick={onSent}>
        send from Messages
      </button>
    </div>
  ),
}))

const TODAY = '2026-11-17'
const SITE = { noticeDays: 10, contact: 'Ray' }
let n = 0
const at = () => `2026-11-${String(1 + (++n % 27)).padStart(2, '0')}T15:00:00Z`
const bullet = (id: string, jobId: string, fixtureId: string, o: Partial<StartBulletRow> = {}): StartBulletRow => ({ id, job_id: jobId, fixture_id: fixtureId, sort_order: ++n, words: `Bullet ${id}.`, waits_on: 'them', wants_photo: false, shown_to_gc: true, by_day: null, reads: null, hand_ok: false, hand_ok_at: null, hand_ok_by_name: '', template_id: null, removed_at: null, created_at: at(), ...o })
const top: StageLine = { fixtureId: 'top', jobId: 'j1', name: 'Top Out', order: 1, finished: false, window: ['2026-12-01', '2026-12-12'] }
const under: StageLine = { fixtureId: 'under', jobId: 'j2', name: 'Underground', order: 2, finished: false, window: ['2026-12-08', '2026-12-12'] }

function seeded() {
  const db = memoryStart({
    lines: [top, under],
    rows: {
      bullets: [
        bullet('t1', 'j1', 'top', { words: 'The framing inspection has passed.' }),
        bullet('u1', 'j2', 'under', { words: 'Forms are set where our pipe passes.', wants_photo: true }),
        bullet('u2', 'j2', 'under', { words: 'Water is on site.' }),
        bullet('ours', 'j2', 'under', { words: 'Our material lands before day one.', waits_on: 'us', reads: 'hand', shown_to_gc: false }),
      ],
      marks: [],
      asks: [],
      theirDays: [],
      decisions: [],
      arrivals: [],
    },
  })
  const io = memoryStartChecksIo(db)
  const ctx = (part: string) => ({ jobLabel: 'J', part, dayOf: (iso: string) => iso.slice(0, 10) })
  const stages = [
    { line: top, stage: stageFromRows(top, db.rows, ctx('Lodge')) },
    { line: under, stage: stageFromRows(under, db.rows, ctx('Bunkhouse')) },
  ]
  return { db, io, stages }
}

function mount(customerId: string | null = 'cust-1') {
  const { db, io, stages } = seeded()
  const onClose = vi.fn()
  const press = async (write: (w: StartChecksIo) => Promise<void>) => write(io)
  renderWithProviders(<StartCheckAskPanel stages={stages} site={SITE} today={TODAY} me={{ userId: 'u-dana', name: 'Dana' }} door={{ jobId: 'j1', jobName: 'Lodge plumbing', customerId }} press={press} onClose={onClose} />)
  return { db, onClose }
}

afterEach(cleanup)

describe('StartCheckAskPanel', () => {
  it('writes one ask across both stages from the open bullets on them, and says nothing goes out by itself', () => {
    mount()
    const panel = document.querySelector('[data-start-check-ask]') as HTMLElement
    expect(panel.textContent).toContain('Ask Ray about 3 things')
    expect(panel.textContent).toContain('One message for 2 stages. Change any word. Nothing goes out by itself.')
    const text = (screen.getByLabelText('The ask') as HTMLTextAreaElement).value
    expect(text).toBe(
      [
        'Ray, a few things before we lock in our crew.',
        '',
        'Lodge top out, we plan Tue Dec 1 and decide by Sat Nov 21:',
        '1. The framing inspection has passed.',
        '',
        'Bunkhouse underground, we plan Tue Dec 8 and decide by Sat Nov 28:',
        '1. Forms are set where our pipe passes. A photo would settle it.',
        '2. Water is on site.',
        '',
        'A yes or a not yet on each is all we need.',
      ].join('\n'),
    )
    // Nothing here points them to a page of theirs, and no bullet of ours is named.
    expect(text).not.toContain('page')
    expect(text).not.toContain('material')
  })

  it('Text it opens Messages’ box filled with the ask as it reads now, and sends nothing in the press', () => {
    const { db } = mount()
    fireEvent.change(screen.getByLabelText('The ask'), { target: { value: 'Ray, is the inspection done?' } })
    expect(screen.queryByTestId('messages-box')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Text it' }))
    const box = screen.getByTestId('messages-box')
    expect(box.dataset).toMatchObject({ kind: 'text', job: 'j1', jobName: 'Lodge plumbing', customer: 'cust-1' })
    expect(box.querySelector('pre')?.textContent).toBe('Ray, is the inspection done?')
    expect(db.calls).toEqual([])
    expect(db.rows.asks).toEqual([])
    // Email it turns the box to an email with the same words.
    fireEvent.click(screen.getByRole('button', { name: 'Email it' }))
    expect(screen.getByTestId('messages-box').dataset.kind).toBe('email')
  })

  it('a send from Messages’ box is the kept ask: a row for each bullet on each stage, in one batch', async () => {
    const { db, onClose } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Text it' }))
    fireEvent.click(screen.getByRole('button', { name: 'send from Messages' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(db.rows.asks.map((a) => `${a.job_id} ${a.fixture_id} ${a.bullet_id} ${a.kind} ${a.how} ${a.to_name} ${a.asked_on}`)).toEqual(['j1 top t1 ask text Ray 2026-11-17', 'j2 under u1 ask text Ray 2026-11-17', 'j2 under u2 ask text Ray 2026-11-17'])
    expect(new Set(db.rows.asks.map((a) => a.batch_id)).size).toBe(1)
  })

  it('an ask that went out another way is kept by saying how', async () => {
    const { db, onClose } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'I called' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(db.rows.asks.map((a) => a.how)).toEqual(['phone', 'phone', 'phone'])
  })

  it('a job with no customer to message offers Copy and the three ways alone', () => {
    mount(null)
    expect(screen.queryByRole('button', { name: 'Text it' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Email it' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()
    expect(screen.getByText('This job names no customer to message. Copy the ask and send it your way.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'I texted it' })).toBeTruthy()
  })

  it('Close puts the panel away with nothing kept', () => {
    const { db, onClose } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(db.rows.asks).toEqual([])
  })
})
