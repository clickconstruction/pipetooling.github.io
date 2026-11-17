// @vitest-environment jsdom
/**
 * The four footers that wait on the leader, on their own (v2.7593): who gets which press, what each press hands
 * the desk, and the record panes that stand in for a footer. Inside the desk they are held by `LienDesk.render.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { LienDeskAwaitingFooter, LienDeskHeldFooter, LienDeskPrintedFooter, LienDeskReadyFooter, type LienNoticeFooterContext } from './LienDeskLeaderFooters'

vi.mock('../../lib/jobs/lienDeskSignIo', () => ({ confirmLienPenSignature: () => Promise.resolve(), disownLienPenSignature: () => Promise.resolve() }))

const item = { id: 'item-1', job_id: 'job-1', status: 'awaiting', fields: null, submitted_at: '2026-11-10T15:00:00Z', approval_mode: null }

const ctx = (over: Partial<LienNoticeFooterContext> = {}): LienNoticeFooterContext =>
  ({
    selected: { jobId: 'job-1', pile: 'awaiting', item, earliestDeadline: '2026-12-15', dueMonths: ['2026-10'], missedMonths: [] },
    monthsList: ['2026-10'],
    monthsWord: 'October 2026',
    todayYmd: '2026-11-17',
    authRole: 'assistant',
    authName: 'ZZ Test Office',
    leader: false,
    office: true,
    otherScreen: false,
    busy: false,
    run: async () => true,
    leaderName: 'ZZ Test Leader',
    gc: { name: 'ZZ Test Builder' },
    codeSigner: null,
    promise: null,
    claimGate: null,
    counts: { ready: 2, printed: 1 },
    runCount: 3,
    simpleApprove: false,
    detailsOpen: false,
    notYetOpen: false,
    setNotYetOpen: vi.fn(),
    holdOpen: null,
    setHoldOpen: vi.fn(),
    rulePick: null,
    wordOpen: false,
    setWordOpen: vi.fn(),
    wordNote: '',
    setWordNote: vi.fn(),
    wordChannel: 'phone',
    setWordChannel: vi.fn(),
    wordPreview: undefined,
    offerProblem: null,
    signLine: (_compact?: boolean, frame?: { press?: unknown; strip?: unknown }) => (
      <div data-test-sign-line>
        {frame?.press as never}
        {frame?.strip as never}
      </div>
    ),
    offerBox: () => <div data-test-offer-box />,
    offerSwitch: () => <span data-test-offer-switch />,
    byHandPane: null,
    penPane: null,
    approve: vi.fn(),
    signOnly: vi.fn(),
    sendOnWord: vi.fn(),
    pullBack: vi.fn(),
    saveOffer: vi.fn(),
    hold: vi.fn(),
    backToReady: vi.fn(async () => {}),
    signAgain: vi.fn(async () => {}),
    setByHandOpen: vi.fn(),
    setPenOpen: vi.fn(),
    setRunOpen: vi.fn(),
    openRunOnOne: vi.fn(),
    monthlyRunNotices: () => [],
    ...over,
  }) as unknown as LienNoticeFooterContext

const press = (sel: string) => fireEvent.click(document.querySelector(sel) as HTMLElement)
const button = (words: string) => [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(words)) as HTMLButtonElement | undefined

afterEach(() => cleanup())

describe('LienDeskAwaitingFooter', () => {
  it('the office sees the waiting row; Leader here, Approve opens the word’s record as standing over', () => {
    const c = ctx()
    render(<LienDeskAwaitingFooter ctx={c} />)
    expect(document.querySelector('[data-lien-desk-foot="awaiting"]')).not.toBeNull()
    expect(document.querySelector('[data-test-sign-line]')).toBeNull()
    press('[data-lien-desk-leader-here]')
    expect(c.setWordChannel).toHaveBeenCalledWith('standing_over')
    expect(c.setWordOpen).toHaveBeenCalledWith(true)
    expect(c.setWordNote).toHaveBeenCalledTimes(1)
  })

  it('a role that cannot send on his word gets no Leader here press', () => {
    render(<LienDeskAwaitingFooter ctx={ctx({ authRole: 'master' })} />)
    expect(document.querySelector('[data-lien-desk-leader-here]')).toBeNull()
    expect(button('Pull back to draft')).toBeDefined()
  })

  it('the leader gets his line with Sign and approve, the holds and Back to the office', () => {
    const c = ctx({ leader: true, office: false, authRole: 'master_technician' })
    render(<LienDeskAwaitingFooter ctx={c} />)
    expect(document.querySelector('[data-test-offer-box]')).not.toBeNull()
    fireEvent.click(button('Sign and approve & next ▸')!)
    expect(c.approve).toHaveBeenCalledTimes(1)
    fireEvent.click(button('Hold — they promised…')!)
    expect(c.setHoldOpen).toHaveBeenCalledWith('promised')
    fireEvent.click(button('Back to the office')!)
    expect(c.pullBack).toHaveBeenCalledTimes(1)
  })

  it('a pay offer whose day cannot stand deadens Sign and approve', () => {
    render(<LienDeskAwaitingFooter ctx={ctx({ leader: true, offerProblem: 'The day is past the affidavit’s.' })} />)
    expect(button('Sign and approve & next ▸')!.disabled).toBe(true)
  })

  it('an open by-hand record stands in for the footer', () => {
    render(<LienDeskAwaitingFooter ctx={ctx({ byHandPane: <div data-test-by-hand /> })} />)
    expect(document.querySelector('[data-test-by-hand]')).not.toBeNull()
    expect(document.querySelector('[data-lien-desk-foot="awaiting"]')).toBeNull()
  })
})

describe('LienDeskPrintedFooter', () => {
  it('offers the way back, the by-hand record and the run, to the office alone', () => {
    const c = ctx()
    render(<LienDeskPrintedFooter ctx={c} />)
    fireEvent.click(button('Back to Approved · to print')!)
    expect(c.backToReady).toHaveBeenCalledTimes(1)
    press('[data-lien-desk-by-hand]')
    expect(c.setByHandOpen).toHaveBeenCalledWith(true)
    fireEvent.click(document.querySelector('[data-lien-desk-foot="printed"] button:last-of-type') as HTMLButtonElement)
    expect(c.setRunOpen).toHaveBeenCalledWith(true)
    cleanup()
    render(<LienDeskPrintedFooter ctx={ctx({ office: false })} />)
    expect([...document.querySelectorAll<HTMLButtonElement>('[data-lien-desk-foot="printed"] button')].every((b) => b.disabled)).toBe(true)
  })
})

describe('LienDeskHeldFooter', () => {
  it('the office sees the row with when the lien right ends; the leader gets his line to release the hold', () => {
    render(<LienDeskHeldFooter ctx={ctx({ selected: { jobId: 'job-1', pile: 'held', item: { ...item, status: 'held' }, earliestDeadline: '2026-12-15' } as never })} />)
    expect(document.querySelector('[data-lien-desk-foot="held"]')?.textContent).toContain('lien right ends')
    expect(document.querySelector('[data-test-sign-line]')).toBeNull()
    cleanup()
    const c = ctx({ leader: true, selected: { jobId: 'job-1', pile: 'held', item: { ...item, status: 'held' }, earliestDeadline: '2026-12-15' } as never })
    render(<LienDeskHeldFooter ctx={c} />)
    expect(document.querySelector('[data-test-sign-line] [data-lien-desk-foot="held"]')).not.toBeNull()
    fireEvent.click(button('Release the hold, sign and approve ▸')!)
    expect(c.approve).toHaveBeenCalledTimes(1)
  })
})

describe('LienDeskReadyFooter', () => {
  const ready = { jobId: 'job-1', pile: 'ready', item: { ...item, status: 'approved' }, earliestDeadline: '2026-12-15' } as never

  it('the office gets the run’s two presses and the pen record on an unsigned notice', () => {
    const c = ctx({ selected: ready })
    render(<LienDeskReadyFooter ctx={c} />)
    press('[data-lien-desk-pen]')
    expect(c.setPenOpen).toHaveBeenCalledWith(true)
    press('[data-lien-desk-just-this-one]')
    expect(c.openRunOnOne).toHaveBeenCalledWith('item-1')
    fireEvent.click(document.querySelector('[data-lien-desk-foot="ready"] button:last-of-type') as HTMLButtonElement)
    expect(c.setRunOpen).toHaveBeenCalledWith(true)
  })

  it('the leader’s unsigned notice puts Sign in his line with the row as its strip', () => {
    const c = ctx({ selected: ready, leader: true, office: false })
    render(<LienDeskReadyFooter ctx={c} />)
    expect(document.querySelector('[data-test-sign-line] [data-lien-desk-foot="ready"]')).not.toBeNull()
    press('[data-lien-desk-sign]')
    expect(c.signOnly).toHaveBeenCalledTimes(1)
  })

  it('an open pen record stands in for the footer', () => {
    render(<LienDeskReadyFooter ctx={ctx({ selected: ready, penPane: <div data-test-pen /> })} />)
    expect(document.querySelector('[data-test-pen]')).not.toBeNull()
    expect(document.querySelector('[data-lien-desk-foot="ready"]')).toBeNull()
  })
})
