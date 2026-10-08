// @vitest-environment jsdom
/**
 * The My Time day editor's session data engine (map step 8): the day's `clock_sessions` read and
 * when it is skipped, a read a newer one replaced, the refetch bump, the parent's sessions, who is
 * signed in and the title's name, the on-demand refetch and the 15 s clock — on the real timeline
 * kernels, with a supabase stub that records every read and can hold one in flight.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { CLOCK_SESSION_DAY_EDITOR_SELECT } from '../../lib/clockSessionSelect'
import type { DayEditorSession } from '../../lib/myTimeDayTimeline'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useMyTimeDaySessions, type UseMyTimeDaySessionsInput } from './useMyTimeDaySessions'

type Result = { data: unknown; error: unknown }
type Read = { table: string; select: string; filters: Array<[string, string, unknown]> }

const h = vi.hoisted(() => ({
  authUserId: 'u-me' as string | null,
  /** When set, the sign-in lookup waits on it. */
  authGate: null as null | Promise<void>,
  reads: [] as Read[],
  /** Rows by `${user_id}|${work_date}`. */
  sessionsByDay: {} as Record<string, unknown[]>,
  sessionsError: null as null | { message: string },
  /** One gate per `clock_sessions` read, taken in order: a read held in flight. */
  sessionGates: [] as Array<Promise<void>>,
  names: {} as Record<string, string | null>,
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () =>
        (h.authGate ?? Promise.resolve()).then(() => ({
          data: { user: h.authUserId ? { id: h.authUserId } : null },
          error: null,
        })),
    },
    from: (table: string) => {
      const read: Read = { table, select: '', filters: [] }
      const b: Record<string, unknown> = {}
      b.select = (cols: string) => {
        read.select = cols
        return b
      }
      b.eq = (col: string, v: unknown) => {
        read.filters.push(['eq', col, v])
        return b
      }
      b.is = (col: string, v: unknown) => {
        read.filters.push(['is', col, v])
        return b
      }
      b.maybeSingle = () => b
      b.then = (res: (v: Result) => unknown, rej: (e: unknown) => unknown) => {
        h.reads.push(read)
        const value = (col: string) => read.filters.find(([, c]) => c === col)?.[2]
        if (table === 'clock_sessions') {
          const answer: Result = h.sessionsError
            ? { data: null, error: h.sessionsError }
            : { data: h.sessionsByDay[`${value('user_id')}|${value('work_date')}`] ?? [], error: null }
          const gate = h.sessionGates.shift()
          return (gate ? gate.then(() => answer) : Promise.resolve(answer)).then(res, rej)
        }
        const id = String(value('id'))
        const answer: Result = { data: id in h.names ? { name: h.names[id] } : null, error: null }
        return Promise.resolve(answer).then(res, rej)
      }
      return b
    },
  },
}))

vi.mock('../../utils/errorHandling', async (orig) => ({
  ...(await orig<typeof import('../../utils/errorHandling')>()),
  withSupabaseRetry: async (op: () => PromiseLike<Result>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
}))

const DAY = '2026-10-06'
const NEXT_DAY = '2026-10-07'

/** A row as PostgREST returns it: no `origin`, `salary_segment_index` or `quick_add_minutes` yet. */
function raw(id: string, inHms: string, outHms: string | null, day = DAY, extra: Record<string, unknown> = {}) {
  return {
    id,
    clocked_in_at: `${day}T${inHms}Z`,
    clocked_out_at: outHms ? `${day}T${outHms}Z` : null,
    work_date: day,
    notes: '',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    ...extra,
  }
}

const BASE: UseMyTimeDaySessionsInput = {
  dateStr: DAY,
  sessionsProp: [],
  subjectUserIdProp: 'u-sub',
  subjectDisplayName: null,
  inSaveableRange: true,
}

function mount(over: Partial<UseMyTimeDaySessionsInput> = {}) {
  return renderHook((p: UseMyTimeDaySessionsInput) => useMyTimeDaySessions(p), { initialProps: { ...BASE, ...over } })
}

const sessionReads = () => h.reads.filter((r) => r.table === 'clock_sessions')
const userReads = () => h.reads.filter((r) => r.table === 'users')
const lastUserRead = () => userReads()[userReads().length - 1]!
const ids = (rows: DayEditorSession[]) => rows.map((s) => s.id)
const flush = () => act(async () => {})

function gate() {
  let release!: () => void
  h.sessionGates.push(new Promise<void>((r) => (release = r)))
  return () => act(async () => release())
}

beforeEach(() => {
  h.authUserId = 'u-me'
  h.authGate = null
  h.reads = []
  h.sessionsByDay = {}
  h.sessionsError = null
  h.sessionGates = []
  h.names = {}
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useMyTimeDaySessions', () => {
  it('reads the subject’s day once, then normalizes, sorts, keys and clusters it', async () => {
    h.sessionsByDay[`u-sub|${DAY}`] = [raw('c', '19:00:00', '20:00:00'), raw('b', '16:00:00', '18:00:00'), raw('a', '14:00:00', '16:00:00')]
    const release = gate()
    const { result } = mount()
    expect(result.current.sessionsLoading).toBe(true)
    await release()
    await waitFor(() => expect(result.current.sessionsLoading).toBe(false))

    expect(sessionReads()).toHaveLength(1)
    expect(sessionReads()[0]).toEqual({
      table: 'clock_sessions',
      select: CLOCK_SESSION_DAY_EDITOR_SELECT,
      filters: [
        ['eq', 'user_id', 'u-sub'],
        ['eq', 'work_date', DAY],
        ['is', 'rejected_at', null],
        ['is', 'revoked_at', null],
      ],
    })
    expect(ids(result.current.sortedSessions)).toEqual(['a', 'b', 'c'])
    expect(result.current.sortedSessions[0]).toMatchObject({ origin: 'user_punch', salary_segment_index: null, quick_add_minutes: null })
    expect(result.current.sessionsKey).toBe(
      [['a', '14:00:00', '16:00:00'], ['b', '16:00:00', '18:00:00'], ['c', '19:00:00', '20:00:00']]
        .map(([id, i, o]) => `${id}:${DAY}T${i}Z:${DAY}T${o}Z::${DAY}`)
        .join('|'),
    )
    expect(result.current.sessionClusters.map(ids)).toEqual([['a', 'b'], ['c']])
    expect(result.current.sessionsFetchError).toBeNull()
  })

  it('uses a parent’s sessions as given and reads nothing', async () => {
    const given = [raw('b', '16:00:00', '18:00:00'), raw('a', '14:00:00', '16:00:00', DAY, { origin: 'salary_schedule', salary_segment_index: 1 })]
    const { result } = mount({ sessionsProp: given as DayEditorSession[] })
    await flush()
    expect(sessionReads()).toHaveLength(0)
    expect(result.current.fetchedSessions).toBeNull()
    expect(result.current.sessionsLoading).toBe(false)
    expect(ids(result.current.sortedSessions)).toEqual(['a', 'b'])
    expect(result.current.sortedSessions[0]).toMatchObject({ origin: 'salary_schedule', salary_segment_index: 1 })
    expect(result.current.sortedSessions[1]).toMatchObject({ origin: 'user_punch', quick_add_minutes: null })
  })

  it('outside the saveable range the day is empty and nothing is read', async () => {
    const { result } = mount({ inSaveableRange: false })
    await flush()
    expect(result.current.fetchedSessions).toEqual([])
    expect(result.current.sortedSessions).toEqual([])
    expect(sessionReads()).toHaveLength(0)
  })

  it('with no subject it waits for the sign-in, then reads the signed-in user’s own day', async () => {
    let signIn!: () => void
    h.authGate = new Promise<void>((r) => (signIn = r))
    h.sessionsByDay[`u-me|${DAY}`] = [raw('a', '14:00:00', '16:00:00')]
    const { result } = mount({ subjectUserIdProp: null })
    await flush()
    expect(result.current.pendingAuthForFetch).toBe(true)
    expect(result.current.effectiveSubjectUserId).toBeNull()
    expect(result.current.fetchedSessions).toEqual([])
    expect(sessionReads()).toHaveLength(0)

    await act(async () => signIn())
    await waitFor(() => expect(ids(result.current.sortedSessions)).toEqual(['a']))
    expect(result.current.pendingAuthForFetch).toBe(false)
    expect(result.current.authUserId).toBe('u-me')
    expect(result.current.effectiveSubjectUserId).toBe('u-me')
    expect(result.current.editingSelf).toBe(true)
    expect(sessionReads()).toHaveLength(1)
    expect(sessionReads()[0]!.filters[0]).toEqual(['eq', 'user_id', 'u-me'])
  })

  it('a failed read shows its error and an empty day', async () => {
    h.sessionsError = { message: 'permission denied for table clock_sessions' }
    const { result } = mount()
    await waitFor(() => expect(result.current.sessionsFetchError).not.toBeNull())
    expect(result.current.sessionsFetchError).toBe(formatErrorMessage(h.sessionsError, 'Could not load clock sessions'))
    expect(result.current.fetchedSessions).toEqual([])
    expect(result.current.sessionsLoading).toBe(false)
  })

  it('the refetch signal reads the day again and takes what it finds', async () => {
    h.sessionsByDay[`u-sub|${DAY}`] = [raw('a', '14:00:00', '16:00:00')]
    const { result } = mount()
    await waitFor(() => expect(ids(result.current.sortedSessions)).toEqual(['a']))

    h.sessionsByDay[`u-sub|${DAY}`] = [raw('a', '14:00:00', '16:00:00'), raw('b', '16:00:00', '17:00:00')]
    act(() => result.current.bumpSessionsFetchNonce())
    await waitFor(() => expect(ids(result.current.sortedSessions)).toEqual(['a', 'b']))
    expect(sessionReads()).toHaveLength(2)

    // The shell's writers bump the same counter through the setter.
    act(() => result.current.setSessionsFetchNonce((n) => n + 1))
    await waitFor(() => expect(sessionReads()).toHaveLength(3))
  })

  it('a read that a newer one replaced never lands', async () => {
    h.sessionsByDay[`u-sub|${DAY}`] = [raw('old', '14:00:00', '15:00:00')]
    h.sessionsByDay[`u-sub|${NEXT_DAY}`] = [raw('new', '09:00:00', '10:00:00', NEXT_DAY)]
    const releaseFirst = gate()
    const { result, rerender } = mount()
    await waitFor(() => expect(sessionReads()).toHaveLength(1))

    rerender({ ...BASE, dateStr: NEXT_DAY })
    await waitFor(() => expect(ids(result.current.sortedSessions)).toEqual(['new']))
    await releaseFirst()
    expect(ids(result.current.sortedSessions)).toEqual(['new'])
    expect(result.current.sessionsLoading).toBe(false)
  })

  it('names the person for the title: a given name first, else theirs from users once signed in', async () => {
    const given = mount({ subjectDisplayName: '  Paige ' })
    await waitFor(() => expect(given.result.current.authUserId).toBe('u-me'))
    expect(given.result.current.modalTitlePerson).toBe('Paige')
    expect(userReads()).toHaveLength(0)
    given.unmount()

    h.names['u-sub'] = 'Isiah'
    const other = mount()
    await waitFor(() => expect(other.result.current.modalTitlePerson).toBe('Isiah'))
    expect(other.result.current.editingSelf).toBe(false)
    expect(lastUserRead().filters).toEqual([['eq', 'id', 'u-sub']])
    other.unmount()

    h.names['u-me'] = 'Robert'
    const self = mount({ subjectUserIdProp: null })
    await waitFor(() => expect(self.result.current.modalTitlePerson).toBe('Robert'))
    expect(lastUserRead().filters).toEqual([['eq', 'id', 'u-me']])
  })

  it('fetchDaySessionsForEditor reads the same day on demand; with no one to read for it returns nothing', async () => {
    h.sessionsByDay[`u-sub|${DAY}`] = [raw('a', '14:00:00', '16:00:00')]
    const parentDay = [raw('p', '08:00:00', '09:00:00')] as DayEditorSession[]
    const { result } = mount({ sessionsProp: parentDay })
    await flush()
    let rows: DayEditorSession[] = []
    await act(async () => {
      rows = await result.current.fetchDaySessionsForEditor()
    })
    expect(rows).toEqual([expect.objectContaining({ id: 'a', origin: 'user_punch', quick_add_minutes: null })])
    expect(sessionReads()).toHaveLength(1)

    h.authUserId = null
    const nobody = mount({ subjectUserIdProp: null, sessionsProp: parentDay })
    await flush()
    await act(async () => {
      rows = await nobody.result.current.fetchDaySessionsForEditor()
    })
    expect(rows).toEqual([])
    expect(sessionReads()).toHaveLength(1)
  })

  it('the clock ticks every 15 s while a session is open, and stops when none is', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(new Date(`${DAY}T15:00:00Z`))
    const open = [raw('o', '14:00:00', null)] as DayEditorSession[]
    const { result, rerender } = mount({ sessionsProp: open })
    await flush()
    const t0 = result.current.nowTick
    expect(t0).toBe(Date.parse(`${DAY}T15:00:00Z`))
    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(result.current.nowTick).toBe(t0 + 15_000)

    rerender({ ...BASE, sessionsProp: [raw('o', '14:00:00', '15:00:00')] as DayEditorSession[] })
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.nowTick).toBe(t0 + 15_000)
  })
})
