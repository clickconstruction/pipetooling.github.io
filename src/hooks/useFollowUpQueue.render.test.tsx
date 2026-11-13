// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FollowUpIo } from '../lib/followUp/followUpIo'
import type { FollowUpRows } from '../lib/followUp/followUpRows'
import { QUEUE_READ_OFFLINE_WORDS } from '../lib/followUp/queue'
import { OFFLINE_ERROR_MESSAGE } from '../lib/networkErrorMessage'
import { plainWordsFailures } from '../lib/plainWords'
import { DatabaseError } from '../utils/errorHandling'
import { useFollowUpQueue } from './useFollowUpQueue'

afterEach(cleanup)

const contactRow = (id: string, patch: Record<string, unknown>) => ({
  id,
  kind: 'trade',
  customer_id: null,
  customer_contact_person_id: null,
  gc_company_id: null,
  gc_company_person_id: null,
  person_id: null,
  name: null,
  goes_by: null,
  off_since: null,
  off_why: null,
  off_by: null,
  prospect_id: null,
  supply_house_id: null,
  supply_house_contact_id: null,
  team_prospect_id: null,
  state: 'waiting',
  snoozed_until: null,
  has_user_id: null,
  has_since: null,
  has_how: null,
  ...patch,
})

/** Greg waiting on a text with nobody on him, the unknown number done. */
const ROWS: FollowUpRows = {
  contacts: [contactRow('greg', { gc_company_id: 'gc-hillside' }), contactRow('unk1', { kind: 'unknown', state: 'done' })],
  channels: [],
  records: { gcCompanies: [{ id: 'gc-hillside', name: 'Hillside Excavation', contact_name: 'Greg Paulk', trades: ['Sitework'] }] },
  messages: [
    {
      id: 'm1',
      contact_id: 'greg',
      channel_id: null,
      bid_id: null,
      project_id: null,
      jobs_ledger_id: null,
      channel: 'text',
      direction: 'in',
      who_user_id: null,
      who_text: '',
      at: '2026-10-02T14:00:00.000Z',
      subject: null,
      body: 'Is the detention pond in sitework?',
      optout_line: null,
      back_on: null,
      back_by: null,
      back_words: null,
      back_done_at: null,
    },
  ],
  heard: [],
  owed: [],
} as FollowUpRows

function fakeIo(overrides: Partial<FollowUpIo> = {}): FollowUpIo {
  const none = vi.fn(async () => undefined)
  return {
    loadQueue: vi.fn(async () => ROWS),
    loadHighlights: vi.fn(async () => []),
    count: vi.fn(async () => 1),
    takeIt: none,
    handTo: none,
    setState: vi.fn(async () => null),
    noReplyNeeded: vi.fn(async () => undefined),
    loadDoneFold: vi.fn(async () => ({ said: [], filed: [] })),
    markOwed: vi.fn(async () => 'o1'),
    owedDone: vi.fn(async () => 'n1'),
    owedSentDone: vi.fn(async () => undefined),
    writeDown: none,
    readQuestion: none,
    addNote: vi.fn(async () => 'n2'),
    logCall: vi.fn(async () => 'm-call-new'),
    setBackDay: none,
    backDone: none,
    highlight: vi.fn(async () => 'h1'),
    callAdd: vi.fn(async () => 'c1'),
    callDone: none,
    callMove: none,
    setPrefers: vi.fn(async () => undefined),
    putBack: vi.fn(async () => undefined),
    unhighlight: none,
    ...overrides,
  }
}

describe('useFollowUpQueue', () => {
  it('a failed read keeps its failure by class in readFailure, and a landed read clears it (punch list #183 PR 5)', async () => {
    const timedOut = new DatabaseError('Failed to read Follow up: canceling statement due to statement timeout', '57014', null, { serverMessage: 'canceling statement due to statement timeout' })
    const io = fakeIo({ loadQueue: vi.fn(async () => Promise.reject(timedOut)) })
    const { result } = renderHook(() => useFollowUpQueue({ io, userNames: {}, todayYmd: '2026-10-02' }))
    await waitFor(() => expect(result.current.readFailure).not.toBeNull())
    expect(result.current.readFailure).toEqual({ kind: timedOut.kind, message: expect.stringContaining('statement timeout') })
    expect(result.current.problem).toContain('statement timeout')
    expect(result.current.queue).toBeNull()
    ;(io.loadQueue as ReturnType<typeof vi.fn>).mockImplementation(async () => ROWS)
    await act(async () => {
      await result.current.reload()
    })
    expect(result.current.readFailure).toBeNull()
    expect(result.current.problem).toBeNull()
    expect(result.current.queue).not.toBeNull()
  })

  it('a lost signal on a read says a read’s words, never the write’s nothing was saved; a press that fails on one keeps its own (punch list #183 PR 5)', async () => {
    const lost = new DatabaseError(OFFLINE_ERROR_MESSAGE, undefined, undefined, { kind: 'network' })
    const io = fakeIo({ loadQueue: vi.fn(async () => Promise.reject(lost)) })
    const { result } = renderHook(() => useFollowUpQueue({ io, userNames: {}, todayYmd: '2026-10-02' }))
    await waitFor(() => expect(result.current.readFailure).not.toBeNull())
    expect(result.current.readFailure!.kind).toBe('network')
    expect(result.current.problem).toBe(QUEUE_READ_OFFLINE_WORDS)
    expect(plainWordsFailures(QUEUE_READ_OFFLINE_WORDS)).toEqual([])
    ;(io.loadQueue as ReturnType<typeof vi.fn>).mockImplementation(async () => ROWS)
    await act(async () => {
      await result.current.reload()
    })
    ;(io.takeIt as ReturnType<typeof vi.fn>).mockImplementation(async () => Promise.reject(lost))
    await act(async () => {
      await result.current.press('take it', (x) => x.takeIt('greg'))
    })
    expect(result.current.problem).toMatch(/nothing was saved/)
    expect(result.current.readFailure).toBeNull()
  })

  it('a read that fails while another is out leaves loading on, so the later read that lands ends it; the last failure ends it too (punch list #183 PR 5)', async () => {
    const timedOut = new DatabaseError('Failed to read Follow up: canceling statement due to statement timeout', '57014', null, { serverMessage: 'canceling statement due to statement timeout' })
    const reads: Array<{ resolve: (rows: FollowUpRows) => void; reject: (e: unknown) => void }> = []
    const io = fakeIo({ loadQueue: vi.fn(() => new Promise<FollowUpRows>((resolve, reject) => reads.push({ resolve, reject }))) })
    const { result } = renderHook(() => useFollowUpQueue({ io, userNames: {}, todayYmd: '2026-10-02' }))
    await waitFor(() => expect(reads).toHaveLength(1))
    act(() => {
      void result.current.reload()
    })
    expect(reads).toHaveLength(2)
    await act(async () => reads[0]!.reject(timedOut))
    expect(result.current.readFailure).not.toBeNull()
    expect(result.current.loading).toBe(true)
    await act(async () => reads[1]!.resolve(ROWS))
    expect(result.current.loading).toBe(false)
    expect(result.current.readFailure).toBeNull()
    expect(result.current.queue).not.toBeNull()

    // Two out, both fail: the first leaves loading on, the second ends it with the failure kept.
    act(() => {
      void result.current.reload()
      void result.current.reload()
    })
    expect(reads).toHaveLength(4)
    await act(async () => reads[2]!.reject(timedOut))
    expect(result.current.loading).toBe(true)
    await act(async () => reads[3]!.reject(timedOut))
    expect(result.current.loading).toBe(false)
    expect(result.current.readFailure).not.toBeNull()

    // Two out, the first lands: that read is what the page shows now, with the other still out.
    act(() => {
      void result.current.reload()
      void result.current.reload()
    })
    await act(async () => reads[4]!.resolve(ROWS))
    expect(result.current.loading).toBe(false)
    expect(result.current.readFailure).toBeNull()
    await act(async () => reads[5]!.resolve(ROWS))
    expect(result.current.loading).toBe(false)
  })

  it('loads the rows and builds the queue with today', async () => {
    const io = fakeIo()
    const { result } = renderHook(() => useFollowUpQueue({ io, userNames: {}, todayYmd: '2026-10-02' }))
    await waitFor(() => expect(result.current.queue).not.toBeNull())
    expect(io.loadQueue).toHaveBeenCalledWith('2026-10-02')
    // Nobody is on Greg's conversation, so he waits in New (residential R7) at his line, and not in Needs a reply.
    expect(result.current.queue!.newLane.map((r) => [r.contactId, r.sort, r.messageId])).toEqual([['greg', 'has', 'm1']])
    expect(result.current.queue!.needsReply).toEqual([])
    expect(result.current.contacts.map((c) => c.name)).toEqual(['Greg Paulk', ''])
    expect(result.current.queue!.count).toBe(1)
  })

  it('loads nothing while the tab is closed', async () => {
    const io = fakeIo()
    const { result } = renderHook(() => useFollowUpQueue({ io, userNames: {}, enabled: false, todayYmd: '2026-10-02' }))
    await act(async () => {})
    expect(io.loadQueue).not.toHaveBeenCalled()
    expect(result.current.queue).toBeNull()
  })

  it('reads again after a press, and keeps a refused press’s own words', async () => {
    const refused = new DatabaseError('Failed to take a conversation: That conversation is not there.', 'P0001', null, {
      serverMessage: 'That conversation is not there.',
      operationName: 'take a conversation',
    })
    const io = fakeIo({ takeIt: vi.fn(async () => Promise.reject(refused)) })
    const { result } = renderHook(() => useFollowUpQueue({ io, userNames: {}, todayYmd: '2026-10-02' }))
    await waitFor(() => expect(result.current.queue).not.toBeNull())

    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.press('set state', (x) => x.setState('greg', 'done'))
    })
    expect(ok).toBe(true)
    expect(io.setState).toHaveBeenCalledWith('greg', 'done')
    expect(io.loadQueue).toHaveBeenCalledTimes(2)

    await act(async () => {
      ok = await result.current.press('take it', (x) => x.takeIt('nobody'))
    })
    expect(ok).toBe(false)
    expect(result.current.problem).toBe('That conversation is not there.')
    expect(result.current.pressing).toBeNull()
  })
})
