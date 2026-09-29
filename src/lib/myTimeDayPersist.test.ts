import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The My Time day editor's save, branch by branch: what each shape of cluster writes to
 * `clock_sessions`, in what order, and the sentence each refusal shows. PAYROLL PATH.
 *
 * A characterization: it pins what the routine does today, quirks included. The predicates it
 * branches on have their own suites; this pins the ladder (MY_TIME_DAY_EDITOR_MODAL map, "The
 * save engine", branches 1–9).
 *
 * Every direct write and every RPC call lands in one log, in the order it was made.
 */
type Written =
  | { op: 'insert'; table: string; label: string; values: unknown }
  | { op: 'update'; table: string; label: string; values: unknown; match: Record<string, unknown> }
  | { op: 'rpc'; rpc: 'splitSeg' | 'splitCluster' | 'replaceMixed'; target: string | string[]; segments: unknown }
  | { op: 'dbRpc'; fn: string; label: string; args: unknown }

const db = vi.hoisted(() => {
  const state = {
    log: [] as Written[],
    /** The operation name `withSupabaseRetry` was handed for the write being built. */
    label: '',
    directWrites: 0,
    /** Nth direct write (1-based) → the error the database answers with. */
    refuse: new Map<number, unknown>(),
  }
  const settle = (entry: Written) => ({
    then<R>(resolve: (result: { data: null; error: unknown }) => R): Promise<R> {
      state.directWrites += 1
      state.log.push(entry)
      return Promise.resolve(resolve({ data: null, error: state.refuse.get(state.directWrites) ?? null }))
    },
  })
  return { state, settle }
})

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (fn: string, args: unknown) => db.settle({ op: 'dbRpc', fn, label: db.state.label, args }),
    from: (table: string) => ({
      insert: (values: unknown) => db.settle({ op: 'insert', table, label: db.state.label, values }),
      update: (values: unknown) => ({
        eq: (column: string, value: unknown) =>
          db.settle({ op: 'update', table, label: db.state.label, values, match: { [column]: value } }),
      }),
    }),
  },
}))

vi.mock('../utils/errorHandling', async (importOriginal) => {
  const real = await importOriginal<typeof import('../utils/errorHandling')>()
  return {
    ...real,
    withSupabaseRetry: async <T>(
      operation: () => PromiseLike<{ data: T; error: unknown }>,
      operationName: string,
    ): Promise<T> => {
      db.state.label = operationName
      const result = await operation()
      if (result.error) throw result.error
      return result.data
    },
  }
})

import * as leader from './leaderClockSessionSplit'
import {
  MY_TIME_DRAFT_IN_BLOCK_EDITED_MESSAGE,
  MY_TIME_SALARY_SYNC_SAVED_NOTE,
  myTimeDayPersistRpcs,
  persistMyTimeDayDirtyClusters,
  type PersistMyTimeDayInput,
} from './myTimeDayPersist'
import {
  attachAllocationsToPayloads,
  MY_TIME_CLUSTER_RPC_METADATA_USER_MESSAGE,
  myTimeClusterPersistRpcMetadataUserMessage,
} from './myTimeDaySavePlan'
import { sessionClusterId, type DayEditorSession, type SplitEditorState } from './myTimeDayTimeline'
import { DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX } from './peopleHoursManualDraftSession'
import * as own from './splitOwnClockSessionSegments'
import type { SplitClockSegmentPayload } from './splitOwnClockSessionSegments'
import { formatDenverBlockDateHeader, formatDenverTimeOnly } from '../utils/dateUtils'
import { DatabaseError } from '../utils/errorHandling'

const H = 3_600_000
const DAY = Date.UTC(2026, 0, 5, 14, 0, 0)
const T = (hours: number, extraMs = 0) => DAY + hours * H + extraMs
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = T(9)
/** The rows' own work date, and the day the editor is open on — apart, to see which one is written. */
const ROW_DATE = '2026-01-05'
const EDITOR_DATE = '2026-01-06'
const DRAFT_ID = `${DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX}one`

function mk(
  id: string,
  inMs: number,
  outMs: number | null,
  over: Partial<DayEditorSession> = {},
): DayEditorSession {
  return {
    id,
    clocked_in_at: iso(inMs),
    clocked_out_at: outMs != null ? iso(outMs) : null,
    work_date: ROW_DATE,
    notes: 'n',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin: 'user_punch',
    salary_segment_index: null,
    ...over,
  }
}
const salary = (id: string, inMs: number, outMs: number | null, idx: number | null, over: Partial<DayEditorSession> = {}) =>
  mk(id, inMs, outMs, { origin: 'salary_schedule', salary_segment_index: idx, ...over })

function rpcSpies() {
  return {
    runSplitSeg: vi.fn(async (sessionId: string, segments: SplitClockSegmentPayload[]): Promise<unknown> => {
      db.state.log.push({ op: 'rpc', rpc: 'splitSeg', target: sessionId, segments })
      return []
    }),
    runSplitCluster: vi.fn(async (sessionIds: string[], segments: SplitClockSegmentPayload[]): Promise<unknown> => {
      db.state.log.push({ op: 'rpc', rpc: 'splitCluster', target: sessionIds, segments })
      return []
    }),
    runReplaceMixed: vi.fn(async (sessionIds: string[], segments: SplitClockSegmentPayload[]): Promise<unknown> => {
      db.state.log.push({ op: 'rpc', rpc: 'replaceMixed', target: sessionIds, segments })
      return []
    }),
  }
}
let spies: ReturnType<typeof rpcSpies>

/** Saves `clusters`, each with the split state beside it; every cluster is dirty, in day order, unless `over` says otherwise. */
function save(
  clusters: DayEditorSession[][],
  splits: Array<SplitEditorState | undefined>,
  over: Partial<PersistMyTimeDayInput> = {},
) {
  const splitByCluster: Record<string, SplitEditorState> = {}
  clusters.forEach((c, i) => {
    const split = splits[i]
    if (split) splitByCluster[sessionClusterId(c)] = split
  })
  return persistMyTimeDayDirtyClusters({
    dirty: clusters.map(sessionClusterId),
    sessionClusters: clusters,
    splitByCluster,
    nowTick: NOW,
    effectiveSubjectUserId: 'user-1',
    dateStr: EDITOR_DATE,
    peopleHoursGridProportionalSeed: false,
    rpcs: spies,
    ...over,
  })
}

const caught = (p: Promise<unknown>): Promise<unknown> => p.then(() => 'resolved', (e: unknown) => e)

async function expectRefused(p: Promise<unknown>, message: string) {
  const err = await caught(p)
  expect(err).toBeInstanceOf(DatabaseError)
  expect((err as DatabaseError).message).toBe(message)
}

const noteUpdate = (id: string, notes: string): Written => ({
  op: 'update',
  table: 'clock_sessions',
  label: 'update clock session notes',
  values: { notes },
  match: { id },
})
const timesUpdate = (
  id: string,
  inMs: number,
  outMs: number | null,
  notes: string,
  label = 'update clock session times',
): Written => ({
  op: 'update',
  table: 'clock_sessions',
  label,
  values: { clocked_in_at: iso(inMs), clocked_out_at: outMs != null ? iso(outMs) : null, notes },
  match: { id },
})
const PARTITION_LABEL = 'update clock session times after mixed cross-row merge partition'
const COALESCED_LABEL = 'update clock session times after mixed coalesced partition save'
const seg = (inMs: number, outMs: number | null, notes: string, extra: Partial<SplitClockSegmentPayload> = {}): SplitClockSegmentPayload => ({
  clocked_in_at: iso(inMs),
  clocked_out_at: outMs != null ? iso(outMs) : null,
  notes,
  ...extra,
})

const blockRefusal = (firstInMs: number, lastOutMs: number) =>
  `Block ${formatDenverBlockDateHeader(firstInMs, lastOutMs)} (${formatDenverTimeOnly(firstInMs)} – ${formatDenverTimeOnly(lastOutMs)}): add notes and ensure at least 0.01 hours per part.`
const BLOCK_REFUSAL_TAIL = 'add notes and ensure at least 0.01 hours per part.'
const DRAFT_SPLIT_REFUSAL =
  'Splitting a draft session before its first save is not supported yet. Save once, then edit splits.'
const DRAFT_OPEN_REFUSAL = 'Draft session must be clocked out before saving.'
const DRAFT_NO_USER_REFUSAL = 'Missing subject user for new clock session.'
const TIMES_MOVED_REFUSAL =
  'To change clock times for one block, add a split first (tap the gray strip) or edit in People → Hours.'
const TOO_SMALL_REFUSAL =
  'Cannot save: the time span is too small to split across these clock rows (each needs at least 0.01 hours), or the block is too compressed. Widen the span or edit in People → Hours.'

/** Punch, punch, salary — three touching one-hour rows. */
const mixedThree = () => [mk('a', T(0), T(1)), mk('b', T(1), T(2)), salary('c', T(2), T(3), 2)]
/** Two touching two-hour punches on different jobs. */
const twoJobs = (over: Partial<DayEditorSession> = {}) => [
  mk('a', T(0), T(2), { job_ledger_id: 'j1' }),
  mk('b', T(2), T(4), { job_ledger_id: 'j2', ...over }),
]

/** Every refusal the ladder can reach, as the tests below raise it. */
const refusals: Record<string, { run: () => Promise<unknown>; message: () => string }> = {
  'a blank note': {
    run: () => save([[mk('a', T(0), T(2))]], [{ boundaries: [T(0), T(2)], notes: ['   '] }]),
    message: () => blockRefusal(T(0), T(2)),
  },
  'a draft split in two': {
    run: () => save([[mk(DRAFT_ID, T(0), T(4))]], [{ boundaries: [T(0), T(2), T(4)], notes: ['x', 'y'] }]),
    message: () => DRAFT_SPLIT_REFUSAL,
  },
  'an open draft': {
    run: () => save([[mk(DRAFT_ID, T(0), null)]], [{ boundaries: [T(0), NOW], notes: ['x'] }]),
    message: () => DRAFT_OPEN_REFUSAL,
  },
  'a draft with no subject user': {
    run: () =>
      save([[mk(DRAFT_ID, T(0), T(4))]], [{ boundaries: [T(0), T(4)], notes: ['x'] }], { effectiveSubjectUserId: null }),
    message: () => DRAFT_NO_USER_REFUSAL,
  },
  'a saved row whose times moved': {
    run: () => save([[mk('a', T(0), T(4))]], [{ boundaries: [T(0), T(3)], notes: ['x'] }]),
    message: () => TIMES_MOVED_REFUSAL,
  },
  'a mixed block squeezed too small': {
    run: () =>
      save([[mk('a', T(0), T(1)), salary('b', T(1), T(2), 1)]], [{ boundaries: [T(0), T(0, 60_000)], notes: ['x'] }]),
    message: () => TOO_SMALL_REFUSAL,
  },
  'a mixed block cut off a row seam': {
    run: () => save([mixedThree()], [{ boundaries: [T(0), T(1.5), T(3)], notes: ['x', 'y'] }]),
    message: () => myTimeClusterPersistRpcMetadataUserMessage(mixedThree()),
  },
}

beforeEach(() => {
  db.state.log.length = 0
  db.state.label = ''
  db.state.directWrites = 0
  db.state.refuse.clear()
  spies = rpcSpies()
})

describe('persistMyTimeDayDirtyClusters — skips and guards', () => {
  it('skips a dirty id that matches no cluster, a cluster with no split state and an empty cluster', async () => {
    const c = [mk('a', T(0), T(2))]
    await expect(
      save([c, []], [undefined, { boundaries: [T(0), T(2)], notes: ['x'] }], { dirty: ['nobody', 'a', ''] }),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: false })
    expect(db.state.log).toStrictEqual([])
  })

  it('refuses a blank note, naming the block by its time range', async () => {
    const err = await caught(refusals['a blank note']!.run())
    expect(err).toBeInstanceOf(DatabaseError)
    const message = (err as DatabaseError).message
    expect(message.startsWith('Block ')).toBe(true)
    expect(message.endsWith('add notes and ensure at least 0.01 hours per part.')).toBe(true)
    expect(message).toBe(blockRefusal(T(0), T(2)))
    expect(message).toContain(`(${formatDenverTimeOnly(T(0))} – ${formatDenverTimeOnly(T(2))})`)
    expect(db.state.log).toStrictEqual([])
  })

  it('gives the same refusal for a part under 0.01 hours, a split with no span, and one blank part among several', async () => {
    const c = [mk('a', T(0), T(2))]
    await expectRefused(save([c], [{ boundaries: [T(0), T(0, 35_999), T(2)], notes: ['x', 'y'] }]), blockRefusal(T(0), T(2)))
    await expectRefused(save([c], [{ boundaries: [T(0)], notes: ['x'] }]), blockRefusal(T(0), T(2)))
    await expectRefused(save([c], [{ boundaries: [T(0), T(1), T(2)], notes: ['x', ''] }]), blockRefusal(T(0), T(2)))
    expect(db.state.log).toStrictEqual([])
  })

  it('names a block of several rows from its first clock-in to its last clock-out, and an open block to now', async () => {
    const closed = [mk('a', T(0), T(1)), mk('b', T(1), T(3))]
    await expectRefused(save([closed], [{ boundaries: [T(0), T(1), T(3)], notes: ['x', ' '] }]), blockRefusal(T(0), T(3)))
    const open = [mk('a', T(0), T(1)), mk('b', T(1), null)]
    const message = blockRefusal(T(0), NOW)
    expect(message.endsWith(BLOCK_REFUSAL_TAIL)).toBe(true)
    await expectRefused(save([open], [{ boundaries: [T(0), T(1), T(5)], notes: ['x', ' '] }]), message)
    expect(db.state.log).toStrictEqual([])
  })

  it('refuses a draft session split into more than one part', async () => {
    await expectRefused(refusals['a draft split in two']!.run(), DRAFT_SPLIT_REFUSAL)
    expect(db.state.log).toStrictEqual([])
  })

  // A new session touching a saved one joins its block. Before, the untouched block was refused
  // as "splitting a draft", and merged it sent the draft id to the replace RPC.
  it('a new session beside a saved one, left as they are: the new one is inserted, the saved one gets its note', async () => {
    const c = [mk('a', T(0), T(2), { job_ledger_id: 'j1' }), mk(DRAFT_ID, T(2), T(4), { job_ledger_id: 'j2' })]
    await expect(save([c], [{ boundaries: [T(0), T(2), T(4)], notes: ['x', ' y '] }])).resolves.toStrictEqual({
      salarySyncMayAdjust: false,
    })
    expect(db.state.log).toStrictEqual([
      noteUpdate('a', 'x'),
      {
        op: 'insert',
        table: 'clock_sessions',
        label: 'insert draft clock session from people hours',
        values: {
          user_id: 'user-1',
          work_date: EDITOR_DATE,
          clocked_in_at: iso(T(2)),
          clocked_out_at: iso(T(4)),
          notes: 'y',
          job_ledger_id: 'j2',
          bid_id: null,
        },
      },
    ])
    expect(spies.runSplitCluster).not.toHaveBeenCalled()
    expect(spies.runReplaceMixed).not.toHaveBeenCalled()
  })

  it('a new session before a saved one saves in row order: the insert, then the note', async () => {
    const c = [mk(DRAFT_ID, T(0), T(2)), mk('b', T(2), T(4))]
    await save([c], [{ boundaries: [T(0), T(2), T(4)], notes: ['x', 'y'] }])
    expect(db.state.log.map((w) => (w as { op: string }).op)).toStrictEqual(['insert', 'update'])
  })

  it('a new session split or with its seam moved beside a saved one is refused, and nothing is written', async () => {
    const c = [mk('a', T(0), T(2)), mk(DRAFT_ID, T(2), T(4))]
    await expectRefused(
      save([c], [{ boundaries: [T(0), T(2), T(3), T(4)], notes: ['x', 'y', 'z'] }]),
      MY_TIME_DRAFT_IN_BLOCK_EDITED_MESSAGE,
    )
    await expectRefused(
      save([c], [{ boundaries: [T(0), T(1.5), T(4)], notes: ['x', 'y'] }]),
      MY_TIME_DRAFT_IN_BLOCK_EDITED_MESSAGE,
    )
    expect(db.state.log).toStrictEqual([])
  })

  it('a new session in a block with no subject user is refused before the saved row is touched', async () => {
    const c = [mk('a', T(0), T(2)), mk(DRAFT_ID, T(2), T(4))]
    await expectRefused(
      save([c], [{ boundaries: [T(0), T(2), T(4)], notes: ['x', 'y'] }], { effectiveSubjectUserId: null }),
      'Missing subject user for new clock session.',
    )
    // The saved row comes first and its note is written before the insert is refused.
    expect(db.state.log).toStrictEqual([noteUpdate('a', 'x')])
  })

  it('the refusal message', () => {
    expect(MY_TIME_DRAFT_IN_BLOCK_EDITED_MESSAGE).toBe(
      'A new session can’t be split or merged with the session beside it before it is saved. Undo that change and Save, then edit again.',
    )
  })
})

describe('persistMyTimeDayDirtyClusters — one part, one row', () => {
  it('inserts a draft row: subject user, the editor day, the part times, the trimmed note, the row job and bid', async () => {
    const c = [mk(DRAFT_ID, T(0), T(4), { job_ledger_id: 'j1', bid_id: 'b1' })]
    await expect(save([c], [{ boundaries: [T(0), T(4)], notes: ['  framing  '] }])).resolves.toStrictEqual({
      salarySyncMayAdjust: false,
    })
    expect(db.state.log).toStrictEqual([
      {
        op: 'insert',
        table: 'clock_sessions',
        label: 'insert draft clock session from people hours',
        values: {
          user_id: 'user-1',
          work_date: EDITOR_DATE,
          clocked_in_at: iso(T(0)),
          clocked_out_at: iso(T(4)),
          notes: 'framing',
          job_ledger_id: 'j1',
          bid_id: 'b1',
        },
      },
    ])
  })

  it('inserts a draft row at the times of the part, not of the row, with no check that they match', async () => {
    const c = [mk(DRAFT_ID, T(0), T(4))]
    await save([c], [{ boundaries: [T(1), T(3)], notes: ['x'] }], { peopleHoursGridProportionalSeed: true })
    expect(db.state.log).toStrictEqual([
      {
        op: 'insert',
        table: 'clock_sessions',
        label: 'insert draft clock session from people hours',
        values: {
          user_id: 'user-1',
          work_date: EDITOR_DATE,
          clocked_in_at: iso(T(1)),
          clocked_out_at: iso(T(3)),
          notes: 'x',
          job_ledger_id: null,
          bid_id: null,
        },
      },
    ])
  })

  it('refuses an open draft row — before it looks for the subject user', async () => {
    await expectRefused(refusals['an open draft']!.run(), DRAFT_OPEN_REFUSAL)
    await expectRefused(
      save([[mk(DRAFT_ID, T(0), null)]], [{ boundaries: [T(0), NOW], notes: ['x'] }], { effectiveSubjectUserId: null }),
      DRAFT_OPEN_REFUSAL,
    )
    expect(db.state.log).toStrictEqual([])
  })

  it('refuses a draft row with no subject user: null, undefined or empty', async () => {
    const c = [mk(DRAFT_ID, T(0), T(4))]
    const split = { boundaries: [T(0), T(4)], notes: ['x'] }
    await expectRefused(refusals['a draft with no subject user']!.run(), DRAFT_NO_USER_REFUSAL)
    await expectRefused(save([c], [split], { effectiveSubjectUserId: undefined }), DRAFT_NO_USER_REFUSAL)
    await expectRefused(save([c], [split], { effectiveSubjectUserId: '' }), DRAFT_NO_USER_REFUSAL)
    expect(db.state.log).toStrictEqual([])
  })

  it('refuses a saved row whose boundaries moved, with or without the People → Hours seed', async () => {
    await expectRefused(refusals['a saved row whose times moved']!.run(), TIMES_MOVED_REFUSAL)
    const c = [mk('a', T(0), T(4))]
    await expectRefused(save([c], [{ boundaries: [T(0, 1001), T(4)], notes: ['x'] }]), TIMES_MOVED_REFUSAL)
    await expectRefused(
      save([c], [{ boundaries: [T(0), T(3)], notes: ['x'] }], { peopleHoursGridProportionalSeed: true }),
      TIMES_MOVED_REFUSAL,
    )
    expect(db.state.log).toStrictEqual([])
  })

  it('with the People → Hours seed, updates a matching saved row: the part times, the row work date, note, job and bid', async () => {
    const c = [mk('a', T(0), T(4), { job_ledger_id: 'j1', bid_id: 'b1' })]
    // Half a second inside the row on both ends: still a match, and the part's times are what is written.
    await expect(
      save([c], [{ boundaries: [T(0, 500), T(4, -500)], notes: [' seeded '] }], { peopleHoursGridProportionalSeed: true }),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: false })
    expect(db.state.log).toStrictEqual([
      {
        op: 'update',
        table: 'clock_sessions',
        label: 'update clock session times from people hours proportional seed',
        values: {
          clocked_in_at: iso(T(0, 500)),
          clocked_out_at: iso(T(4, -500)),
          work_date: ROW_DATE,
          notes: 'seeded',
          job_ledger_id: 'j1',
          bid_id: 'b1',
        },
        match: { id: 'a' },
      },
    ])
  })

  it('with the People → Hours seed, an open matching row is written with no clock-out', async () => {
    const c = [mk('a', T(0), null)]
    await save([c], [{ boundaries: [T(0), T(5)], notes: ['x'] }], { peopleHoursGridProportionalSeed: true })
    expect(db.state.log).toStrictEqual([
      {
        op: 'update',
        table: 'clock_sessions',
        label: 'update clock session times from people hours proportional seed',
        values: {
          clocked_in_at: iso(T(0)),
          clocked_out_at: null,
          work_date: ROW_DATE,
          notes: 'x',
          job_ledger_id: null,
          bid_id: null,
        },
        match: { id: 'a' },
      },
    ])
  })

  it('otherwise gives a matching saved row a note-only update', async () => {
    const c = [mk('a', T(0), T(4), { job_ledger_id: 'j1', bid_id: 'b1' })]
    await expect(save([c], [{ boundaries: [T(0, 500), T(4)], notes: ['  new note '] }])).resolves.toStrictEqual({
      salarySyncMayAdjust: false,
    })
    expect(db.state.log).toStrictEqual([noteUpdate('a', 'new note')])
  })
})

describe('persistMyTimeDayDirtyClusters — one part, several rows', () => {
  it('a punch and a salary row merged into one part: each row gets its share of the span and the same note', async () => {
    const c = [mk('a', T(0), T(2)), salary('b', T(2), T(4), 1)]
    // The part covers three of the block's four hours: each row keeps its proportion of it.
    await expect(save([c], [{ boundaries: [T(0), T(3)], notes: [' merged '] }])).resolves.toStrictEqual({
      salarySyncMayAdjust: true,
    })
    expect(db.state.log).toStrictEqual([
      timesUpdate('a', T(0), T(1.5), 'merged', PARTITION_LABEL),
      timesUpdate('b', T(1.5), T(3), 'merged', PARTITION_LABEL),
    ])
  })

  it('the same merge over the whole block rewrites each row at its own times; an open last row stays open', async () => {
    const closed = [mk('a', T(0), T(2)), salary('b', T(2), T(4), 1)]
    await save([closed], [{ boundaries: [T(0), T(4)], notes: ['merged'] }])
    expect(db.state.log).toStrictEqual([
      timesUpdate('a', T(0), T(2), 'merged', PARTITION_LABEL),
      timesUpdate('b', T(2), T(4), 'merged', PARTITION_LABEL),
    ])

    db.state.log.length = 0
    const open = [mk('a', T(0), T(2)), salary('b', T(2), null, 1)]
    await expect(save([open], [{ boundaries: [T(0), T(5)], notes: ['merged'] }])).resolves.toStrictEqual({
      salarySyncMayAdjust: true,
    })
    expect(db.state.log).toStrictEqual([
      timesUpdate('a', T(0), T(2), 'merged', PARTITION_LABEL),
      timesUpdate('b', T(2), null, 'merged', PARTITION_LABEL),
    ])
  })

  it('two different origins, neither salary: the same writes, and no salary note', async () => {
    // The database allows two origins (user_punch, salary_schedule); 'imported' stands for any other.
    const c = [mk('a', T(0), T(2)), mk('b', T(2), T(4), { origin: 'imported' })]
    await expect(save([c], [{ boundaries: [T(0), T(3)], notes: ['merged'] }])).resolves.toStrictEqual({
      salarySyncMayAdjust: false,
    })
    expect(db.state.log).toStrictEqual([
      timesUpdate('a', T(0), T(1.5), 'merged', PARTITION_LABEL),
      timesUpdate('b', T(1.5), T(3), 'merged', PARTITION_LABEL),
    ])
  })

  it('two punches that differ only in salary segment are split the same way, with no salary note', async () => {
    const c = [mk('a', T(0), T(2)), mk('b', T(2), T(4), { salary_segment_index: 1 })]
    await expect(save([c], [{ boundaries: [T(0), T(4)], notes: ['merged'] }])).resolves.toStrictEqual({
      salarySyncMayAdjust: false,
    })
    expect(db.state.log).toStrictEqual([
      timesUpdate('a', T(0), T(2), 'merged', PARTITION_LABEL),
      timesUpdate('b', T(2), T(4), 'merged', PARTITION_LABEL),
    ])
  })

  it('refuses a mixed block squeezed so a row would get under 0.01 hours', async () => {
    // Sixty seconds over two equal rows: thirty each, under the thirty-six the minimum asks.
    await expectRefused(refusals['a mixed block squeezed too small']!.run(), TOO_SMALL_REFUSAL)
    expect(db.state.log).toStrictEqual([])
  })

  it('rows that share origin and salary segment go to the replace RPC, once, with every row id', async () => {
    const c = [mk('a', T(0), T(1), { job_ledger_id: 'j1' }), mk('b', T(1), T(4), { job_ledger_id: 'j2', bid_id: 'b2' })]
    const split = { boundaries: [T(0), T(4)], notes: [' merged '] }
    await expect(save([c], [split])).resolves.toStrictEqual({ salarySyncMayAdjust: false })
    const expected = attachAllocationsToPayloads([seg(T(0), T(4), 'merged')], c, split, NOW)
    // The part takes the job of the row it overlaps most.
    expect(expected).toStrictEqual([seg(T(0), T(4), 'merged', { job_ledger_id: 'j2', bid_id: 'b2' })])
    expect(db.state.log).toStrictEqual([{ op: 'rpc', rpc: 'replaceMixed', target: ['a', 'b'], segments: expected }])
    expect(spies.runReplaceMixed).toHaveBeenCalledTimes(1)
    expect(spies.runSplitSeg).not.toHaveBeenCalled()
    expect(spies.runSplitCluster).not.toHaveBeenCalled()
  })

  it('the People → Hours seed changes nothing for a block of several rows', async () => {
    const c = [mk('a', T(0), T(2)), mk('b', T(2), T(4))]
    await save([c], [{ boundaries: [T(0), T(4)], notes: ['merged'] }], { peopleHoursGridProportionalSeed: true })
    expect(db.state.log).toStrictEqual([
      {
        op: 'rpc',
        rpc: 'replaceMixed',
        target: ['a', 'b'],
        segments: [seg(T(0), T(4), 'merged', { job_ledger_id: null, bid_id: null })],
      },
    ])
  })

  it('a new session merged with a saved one into one part is refused, and the replace RPC is not called', async () => {
    const c = [mk('a', T(0), T(2)), mk(DRAFT_ID, T(2), T(4))]
    await expectRefused(save([c], [{ boundaries: [T(0), T(4)], notes: ['merged'] }]), MY_TIME_DRAFT_IN_BLOCK_EDITED_MESSAGE)
    expect(db.state.log).toStrictEqual([])
  })
})

describe('persistMyTimeDayDirtyClusters — several parts', () => {
  it('one row split in two goes to the split-segments RPC: times and notes only', async () => {
    const c = [mk('a', T(0), T(4), { job_ledger_id: 'j1', bid_id: 'b1' })]
    await expect(
      save([c], [
        {
          boundaries: [T(0), T(1), T(4)],
          notes: [' first ', 'second'],
          segmentJobOverrides: { 0: { job_ledger_id: 'j9', bid_id: null } },
        },
      ]),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: false })
    expect(db.state.log).toStrictEqual([
      { op: 'rpc', rpc: 'splitSeg', target: 'a', segments: [seg(T(0), T(1), 'first'), seg(T(1), T(4), 'second')] },
    ])
    expect(spies.runSplitSeg).toHaveBeenCalledTimes(1)
  })

  it('one open row split in two: the last part has no clock-out', async () => {
    const c = [mk('a', T(0), null)]
    await save([c], [{ boundaries: [T(0), T(1), T(5)], notes: ['first', 'second'] }])
    expect(db.state.log).toStrictEqual([
      { op: 'rpc', rpc: 'splitSeg', target: 'a', segments: [seg(T(0), T(1), 'first'), seg(T(1), null, 'second')] },
    ])
  })

  it('same-job, same-origin rows cut into more parts than rows go to the split-cluster RPC with every row id', async () => {
    const c = [mk('a', T(0), T(2), { job_ledger_id: 'j1' }), mk('b', T(2), T(4), { job_ledger_id: 'j1' })]
    await expect(
      save([c], [{ boundaries: [T(0), T(1), T(3), T(4)], notes: ['x', 'y', 'z'] }]),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: false })
    expect(db.state.log).toStrictEqual([
      {
        op: 'rpc',
        rpc: 'splitCluster',
        target: ['a', 'b'],
        segments: [seg(T(0), T(1), 'x'), seg(T(1), T(3), 'y'), seg(T(3), T(4), 'z')],
      },
    ])
    expect(spies.runSplitCluster).toHaveBeenCalledTimes(1)
  })

  // Before, a note edit on same-job rows went through the split-cluster RPC, which deletes and
  // re-inserts the rows and takes their approved hours back out of payroll.
  it('same-job, same-origin rows left on their own seams, notes changed: one note-only update per row, no RPC', async () => {
    const c = [mk('a', T(0), T(2), { job_ledger_id: 'j1' }), mk('b', T(2), T(4), { job_ledger_id: 'j1' })]
    await save([c], [{ boundaries: [T(0), T(2), T(4)], notes: ['x', 'y'] }])
    expect(db.state.log).toStrictEqual([noteUpdate('a', 'x'), noteUpdate('b', 'y')])
    expect(spies.runSplitCluster).not.toHaveBeenCalled()
  })

  it('the same with the last row still open: its end is the running clock, so notes only', async () => {
    const c = [mk('a', T(0), T(2), { job_ledger_id: 'j1' }), mk('b', T(2), null, { job_ledger_id: 'j1' })]
    await save([c], [{ boundaries: [T(0), T(2), T(8)], notes: ['x', 'y'] }])
    expect(db.state.log).toStrictEqual([noteUpdate('a', 'x'), noteUpdate('b', 'y')])
  })

  it('the same rows with a job chosen that is not the row’s own still go to the split-cluster RPC', async () => {
    const c = [mk('a', T(0), T(2), { job_ledger_id: 'j1' }), mk('b', T(2), T(4), { job_ledger_id: 'j1' })]
    await save([c], [
      { boundaries: [T(0), T(2), T(4)], notes: ['x', 'y'], segmentJobOverrides: { 1: { job_ledger_id: 'j2', bid_id: null } } },
    ])
    expect(db.state.log).toStrictEqual([
      { op: 'rpc', rpc: 'splitCluster', target: ['a', 'b'], segments: [seg(T(0), T(2), 'x'), seg(T(2), T(4), 'y')] },
    ])
  })

  it('the same rows with a seam moved still go to the split-cluster RPC', async () => {
    const c = [mk('a', T(0), T(2), { job_ledger_id: 'j1' }), mk('b', T(2), T(4), { job_ledger_id: 'j1' })]
    await save([c], [{ boundaries: [T(0), T(3), T(4)], notes: ['x', 'y'] }])
    expect(db.state.log).toStrictEqual([
      { op: 'rpc', rpc: 'splitCluster', target: ['a', 'b'], segments: [seg(T(0), T(3), 'x'), seg(T(3), T(4), 'y')] },
    ])
  })

  it('two rows on different jobs, parts on the original seam: one note-only update per row, in row order', async () => {
    await expect(
      save([twoJobs()], [{ boundaries: [T(0), T(2), T(4)], notes: ['n1', 'n2'] }]),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: false })
    expect(db.state.log).toStrictEqual([noteUpdate('a', 'n1'), noteUpdate('b', 'n2')])
  })

  it('the same two rows with the seam moved: each row is updated with its new times and note', async () => {
    await expect(
      save([twoJobs()], [{ boundaries: [T(0), T(3), T(4)], notes: ['moved', 'kept'] }]),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: false })
    expect(db.state.log).toStrictEqual([timesUpdate('a', T(0), T(3), 'moved'), timesUpdate('b', T(3), T(4), 'kept')])
  })

  it('a seam moved by a second or less is read as not moved', async () => {
    await save([twoJobs()], [{ boundaries: [T(0), T(2, 1000), T(4)], notes: ['n1', 'n2'] }])
    expect(db.state.log).toStrictEqual([noteUpdate('a', 'n1'), noteUpdate('b', 'n2')])
  })

  it('the same two rows with the last row open and untouched: note-only updates', async () => {
    const c = twoJobs({ clocked_out_at: null })
    await expect(
      save([c], [{ boundaries: [T(0), T(2), T(5)], notes: ['n1', 'n2'] }]),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: false })
    expect(db.state.log).toStrictEqual([noteUpdate('a', 'n1'), noteUpdate('b', 'n2')])
  })

  it('the last row open and the seam moved: the open row is rewritten with no clock-out', async () => {
    const c = twoJobs({ clocked_out_at: null })
    await save([c], [{ boundaries: [T(0), T(3), T(5)], notes: ['n1', 'n2'] }])
    expect(db.state.log).toStrictEqual([timesUpdate('a', T(0), T(3), 'n1'), timesUpdate('b', T(3), null, 'n2')])
  })

  it('a punch and a salary row with the seam moved are rewritten row by row, now with the salary note', async () => {
    const c = [mk('a', T(0), T(2)), salary('b', T(2), T(4), 1)]
    await expect(
      save([c], [{ boundaries: [T(0), T(3), T(4)], notes: ['n1', 'n2'] }]),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: true })
    expect(db.state.log).toStrictEqual([timesUpdate('a', T(0), T(3), 'n1'), timesUpdate('b', T(3), T(4), 'n2')])
  })

  it('one salaried row split in two raises the salary note', async () => {
    await expect(
      save([[salary('s', T(0), T(4), 1)]], [{ boundaries: [T(0), T(2), T(4)], notes: ['x', 'y'] }]),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: true })
  })

  it('a notes-only save of a block holding a salaried row does not', async () => {
    const c = [mk('a', T(0), T(2)), salary('s', T(2), T(4), 1)]
    await expect(save([c], [{ boundaries: [T(0), T(2), T(4)], notes: ['x', 'y'] }])).resolves.toStrictEqual({
      salarySyncMayAdjust: false,
    })
  })

  it('a block with no salaried row never does', async () => {
    await expect(
      save([twoJobs()], [{ boundaries: [T(0), T(3), T(4)], notes: ['x', 'y'] }]),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: false })
  })

  it('two rows on different jobs, the first split in two and the second whole: the RPC for the first, then a note for the second', async () => {
    await expect(
      save([twoJobs()], [{ boundaries: [T(0), T(1), T(2), T(4)], notes: ['p', 'q', 'r'] }]),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: false })
    expect(db.state.log).toStrictEqual([
      { op: 'rpc', rpc: 'splitSeg', target: 'a', segments: [seg(T(0), T(1), 'p'), seg(T(1), T(2), 'q')] },
      noteUpdate('b', 'r'),
    ])
  })

  it('the first row whole and the second split in two: the note first, then the RPC — row order', async () => {
    await save([twoJobs()], [{ boundaries: [T(0), T(2), T(3), T(4)], notes: ['p', 'q', 'r'] }])
    expect(db.state.log).toStrictEqual([
      noteUpdate('a', 'p'),
      { op: 'rpc', rpc: 'splitSeg', target: 'b', segments: [seg(T(2), T(3), 'q'), seg(T(3), T(4), 'r')] },
    ])
  })

  it('a row whose one part does not fill it is shortened to that part', async () => {
    const c = twoJobs()
    // Three parts over two rows, the block's last hour left out: row b holds one part, an hour short.
    await save([c], [{ boundaries: [T(0), T(1), T(2), T(3)], notes: ['p', 'q', 'r'] }])
    expect(db.state.log).toStrictEqual([
      { op: 'rpc', rpc: 'splitSeg', target: 'a', segments: [seg(T(0), T(1), 'p'), seg(T(1), T(2), 'q')] },
      timesUpdate('b', T(2), T(3), 'r'),
    ])
  })

  // Quirk 25: split one row and merge the next two, and there is one part per row again —
  // but the parts no longer line up with the rows. Before the fix the save wrote part i onto row i:
  // a 0–1 h, b 1–2 h, c 2–6 h — job j2 lost an hour and moved onto time that was j1's, and the job
  // chosen for the merged part was dropped. Now it rebuilds the block with the replace RPC.
  it('a split in one row and a merge across the next two rebuilds the block, keeping each part’s job', async () => {
    const c = [...twoJobs(), mk('c', T(4), T(6), { job_ledger_id: 'j1' })]
    const split: SplitEditorState = {
      boundaries: [T(0), T(1), T(2), T(6)],
      notes: ['p', 'q', 'r'],
      segmentJobOverrides: { 2: { job_ledger_id: 'j2', bid_id: null } },
    }
    await expect(save([c], [split])).resolves.toStrictEqual({ salarySyncMayAdjust: false })
    expect(db.state.log).toStrictEqual([
      {
        op: 'rpc',
        rpc: 'replaceMixed',
        target: ['a', 'b', 'c'],
        segments: [
          seg(T(0), T(1), 'p', { job_ledger_id: 'j1', bid_id: null }),
          seg(T(1), T(2), 'q', { job_ledger_id: 'j1', bid_id: null }),
          seg(T(2), T(6), 'r', { job_ledger_id: 'j2', bid_id: null }),
        ],
      },
    ])
  })

  it('the same split and merge with no job chosen: each part takes the job of the row it covers most', async () => {
    const c = [...twoJobs(), mk('c', T(4), T(6), { job_ledger_id: 'j1' })]
    await save([c], [{ boundaries: [T(0), T(1), T(2), T(6)], notes: ['p', 'q', 'r'] }])
    expect(db.state.log).toStrictEqual([
      {
        op: 'rpc',
        rpc: 'replaceMixed',
        target: ['a', 'b', 'c'],
        segments: [
          seg(T(0), T(1), 'p', { job_ledger_id: 'j1', bid_id: null }),
          seg(T(1), T(2), 'q', { job_ledger_id: 'j1', bid_id: null }),
          // 2–6 h covers b (j2) for 2 h and c (j1) for 2 h; the tie goes to the earlier row.
          seg(T(2), T(6), 'r', { job_ledger_id: 'j2', bid_id: null }),
        ],
      },
    ])
  })

  it('a merge that keeps each part in its own row, choosing that row’s job, still slides the seams row by row', async () => {
    const c = [...twoJobs(), mk('c', T(4), T(6), { job_ledger_id: 'j1' })]
    // Split b at 3 h, then merge its second half into c choosing c's own job (j1): three parts,
    // each still sharing time with its own row.
    await save([c], [
      {
        boundaries: [T(0), T(2), T(3), T(6)],
        notes: ['p', 'q', 'r'],
        segmentJobOverrides: { 2: { job_ledger_id: 'j1', bid_id: null } },
      },
    ])
    expect(db.state.log).toStrictEqual([
      noteUpdate('a', 'p'),
      timesUpdate('b', T(2), T(3), 'q'),
      timesUpdate('c', T(3), T(6), 'r'),
    ])
  })

  it('the same merge choosing the other row’s job rebuilds the block, so the chosen job is written', async () => {
    const c = [...twoJobs(), mk('c', T(4), T(6), { job_ledger_id: 'j1' })]
    await save([c], [
      {
        boundaries: [T(0), T(2), T(3), T(6)],
        notes: ['p', 'q', 'r'],
        segmentJobOverrides: { 2: { job_ledger_id: 'j2', bid_id: null } },
      },
    ])
    expect(db.state.log).toStrictEqual([
      {
        op: 'rpc',
        rpc: 'replaceMixed',
        target: ['a', 'b', 'c'],
        segments: [
          seg(T(0), T(2), 'p', { job_ledger_id: 'j1', bid_id: null }),
          seg(T(2), T(3), 'q', { job_ledger_id: 'j2', bid_id: null }),
          seg(T(3), T(6), 'r', { job_ledger_id: 'j2', bid_id: null }),
        ],
      },
    ])
  })

  it('punch and salary rows cut out of line with their rows are refused, not written row by row', async () => {
    const c = [mk('a', T(0), T(2)), salary('b', T(2), T(4), 1), mk('c', T(4), T(6))]
    await expectRefused(
      save([c], [{ boundaries: [T(0), T(1), T(2), T(6)], notes: ['p', 'q', 'r'] }]),
      myTimeClusterPersistRpcMetadataUserMessage(c),
    )
    expect(db.state.log).toStrictEqual([])
  })

  it('a row no part sits inside is left as it was', async () => {
    const c = [...twoJobs(), mk('c', T(4), T(6), { job_ledger_id: 'j1' })]
    // Four parts that stop at the end of row b: the block's last two hours are in no part.
    await expect(
      save([c], [{ boundaries: [T(0), T(1), T(2), T(3), T(4)], notes: ['p', 'q', 'r', 's'] }]),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: false })
    expect(db.state.log).toStrictEqual([
      { op: 'rpc', rpc: 'splitSeg', target: 'a', segments: [seg(T(0), T(1), 'p'), seg(T(1), T(2), 'q')] },
      { op: 'rpc', rpc: 'splitSeg', target: 'b', segments: [seg(T(2), T(3), 'r'), seg(T(3), T(4), 's')] },
    ])
  })

  it('mixed-origin rows cut into fewer parts than rows, on a seam: every row gets its interval and its part note', async () => {
    await expect(
      save([mixedThree()], [{ boundaries: [T(0), T(2), T(3)], notes: [' x ', 'y'] }]),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: true })
    expect(db.state.log).toStrictEqual([
      timesUpdate('a', T(0), T(1), 'x', COALESCED_LABEL),
      timesUpdate('b', T(1), T(2), 'x', COALESCED_LABEL),
      timesUpdate('c', T(2), T(3), 'y', COALESCED_LABEL),
    ])
  })

  it('the same cut with no salary row among them: the same writes, no salary note', async () => {
    const c = [mk('a', T(0), T(1)), mk('b', T(1), T(2)), mk('c', T(2), T(3), { origin: 'imported' })]
    await expect(
      save([c], [{ boundaries: [T(0), T(2), T(3)], notes: ['x', 'y'] }]),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: false })
    expect(db.state.log).toStrictEqual([
      timesUpdate('a', T(0), T(1), 'x', COALESCED_LABEL),
      timesUpdate('b', T(1), T(2), 'x', COALESCED_LABEL),
      timesUpdate('c', T(2), T(3), 'y', COALESCED_LABEL),
    ])
  })

  it('an inner boundary within five minutes of a seam is written at the boundary, the rows inside the part re-cut in proportion', async () => {
    await save([mixedThree()], [{ boundaries: [T(0), T(2, 240_000), T(3)], notes: ['x', 'y'] }])
    expect(db.state.log).toStrictEqual([
      timesUpdate('a', T(0), T(1, 120_000), 'x', COALESCED_LABEL),
      timesUpdate('b', T(1, 120_000), T(2, 240_000), 'x', COALESCED_LABEL),
      timesUpdate('c', T(2, 240_000), T(3), 'y', COALESCED_LABEL),
    ])
  })

  it('refuses the same cut with the inner boundary well off any seam', async () => {
    const message = myTimeClusterPersistRpcMetadataUserMessage(mixedThree())
    expect(message).toBe(
      `${MY_TIME_CLUSTER_RPC_METADATA_USER_MESSAGE} Details: mixed origins (user_punch, salary_schedule); different salary segment indexes (none, 2).`,
    )
    await expectRefused(refusals['a mixed block cut off a row seam']!.run(), message)
    expect(db.state.log).toStrictEqual([])
  })

  it('refuses mixed-origin rows cut so a part straddles a seam, however many parts', async () => {
    const c = [mk('a', T(0), T(2)), salary('b', T(2), T(4), 1)]
    await expectRefused(
      save([c], [{ boundaries: [T(0), T(1), T(3), T(4)], notes: ['x', 'y', 'z'] }]),
      myTimeClusterPersistRpcMetadataUserMessage(c),
    )
    expect(db.state.log).toStrictEqual([])
  })

  it('rows on different jobs, same origin, a part straddling the seam: the replace RPC with every row id', async () => {
    const c = twoJobs()
    const split = { boundaries: [T(0), T(1), T(3.5), T(4)], notes: ['x', 'y', 'z'] }
    await expect(save([c], [split])).resolves.toStrictEqual({ salarySyncMayAdjust: false })
    const expected = attachAllocationsToPayloads(
      [seg(T(0), T(1), 'x'), seg(T(1), T(3.5), 'y'), seg(T(3.5), T(4), 'z')],
      c,
      split,
      NOW,
    )
    // The straddling part takes the job of the row it overlaps most.
    expect(expected).toStrictEqual([
      seg(T(0), T(1), 'x', { job_ledger_id: 'j1', bid_id: null }),
      seg(T(1), T(3.5), 'y', { job_ledger_id: 'j2', bid_id: null }),
      seg(T(3.5), T(4), 'z', { job_ledger_id: 'j2', bid_id: null }),
    ])
    expect(db.state.log).toStrictEqual([{ op: 'rpc', rpc: 'replaceMixed', target: ['a', 'b'], segments: expected }])
    expect(spies.runReplaceMixed).toHaveBeenCalledTimes(1)
  })

  it('a job chosen for a part reaches the replace RPC in place of the row job', async () => {
    const c = twoJobs()
    await save([c], [
      {
        boundaries: [T(0), T(1), T(3.5), T(4)],
        notes: ['x', 'y', 'z'],
        segmentJobOverrides: { 1: { job_ledger_id: null, bid_id: 'b7' } },
      },
    ])
    expect(db.state.log).toStrictEqual([
      {
        op: 'rpc',
        rpc: 'replaceMixed',
        target: ['a', 'b'],
        segments: [
          seg(T(0), T(1), 'x', { job_ledger_id: 'j1', bid_id: null }),
          seg(T(1), T(3.5), 'y', { job_ledger_id: null, bid_id: 'b7' }),
          seg(T(3.5), T(4), 'z', { job_ledger_id: 'j2', bid_id: null }),
        ],
      },
    ])
  })
})

describe('persistMyTimeDayDirtyClusters — across clusters', () => {
  const morning = () => [mk('m', T(0), T(2))]
  const noon = () => [mk('n', T(3), T(4))]
  const evening = () => [mk('e', T(5), T(7))]
  const whole = (c: DayEditorSession[], note: string): SplitEditorState => ({
    boundaries: [Date.parse(c[0]!.clocked_in_at), Date.parse(c[0]!.clocked_out_at!)],
    notes: [note],
  })

  it('writes clusters in the order of the dirty list, not the order of the day', async () => {
    const day = [morning(), noon(), evening()]
    await save(day, [whole(day[0]!, 'am'), whole(day[1]!, 'noon'), whole(day[2]!, 'pm')], { dirty: ['e', 'm', 'n'] })
    expect(db.state.log).toStrictEqual([noteUpdate('e', 'pm'), noteUpdate('m', 'am'), noteUpdate('n', 'noon')])
  })

  it('writes only the clusters in the dirty list', async () => {
    const day = [morning(), noon(), evening()]
    await save(day, [whole(day[0]!, 'am'), whole(day[1]!, 'noon'), whole(day[2]!, 'pm')], { dirty: ['n'] })
    expect(db.state.log).toStrictEqual([noteUpdate('n', 'noon')])
  })

  it('writes a cluster once for each time it is in the dirty list', async () => {
    const day = [morning()]
    await save(day, [whole(day[0]!, 'am')], { dirty: ['m', 'm'] })
    expect(db.state.log).toStrictEqual([noteUpdate('m', 'am'), noteUpdate('m', 'am')])
  })

  it('keeps the salary note once a cluster has set it', async () => {
    const mixed = [mk('a', T(0), T(1)), salary('b', T(1), T(2), 1)]
    const day = [mixed, noon()]
    await expect(
      save(day, [{ boundaries: [T(0), T(2)], notes: ['merged'] }, whole(day[1]!, 'noon')]),
    ).resolves.toStrictEqual({ salarySyncMayAdjust: true })
    expect(db.state.log).toHaveLength(3)
  })

  it('when the second of two dirty clusters is refused, the first is already written and the call rejects', async () => {
    const day = [morning(), noon()]
    await expectRefused(
      save(day, [whole(day[0]!, 'am'), { boundaries: [T(3), T(3.5)], notes: ['moved'] }]),
      TIMES_MOVED_REFUSAL,
    )
    expect(db.state.log).toStrictEqual([noteUpdate('m', 'am')])
  })

  it('when the database refuses a write, the call rejects with that error and later clusters are not written', async () => {
    const refused = { message: 'new row violates row-level security policy', code: '42501' }
    db.state.refuse.set(2, refused)
    const day = [morning(), noon(), evening()]
    const err = await caught(save(day, [whole(day[0]!, 'am'), whole(day[1]!, 'noon'), whole(day[2]!, 'pm')]))
    expect(err).toBe(refused)
    // The second entry is the write the database refused; the evening was never sent.
    expect(db.state.log).toStrictEqual([noteUpdate('m', 'am'), noteUpdate('n', 'noon')])
  })

  it('when the database refuses a row in the middle of a block, the rows before it stay written and the rest are not sent', async () => {
    const refused = { message: 'deadlock detected', code: '40P01' }
    db.state.refuse.set(2, refused)
    const err = await caught(save([mixedThree()], [{ boundaries: [T(0), T(2), T(3)], notes: ['x', 'y'] }]))
    expect(err).toBe(refused)
    expect(db.state.log).toStrictEqual([
      timesUpdate('a', T(0), T(1), 'x', COALESCED_LABEL),
      timesUpdate('b', T(1), T(2), 'x', COALESCED_LABEL),
    ])
  })

  it('when an RPC fails, the call rejects with its error and later clusters are not written', async () => {
    const failed = new DatabaseError('Session is outside the current week')
    spies.runSplitSeg.mockRejectedValueOnce(failed)
    const day = [morning(), noon()]
    const err = await caught(
      save(day, [{ boundaries: [T(0), T(1), T(2)], notes: ['x', 'y'] }, whole(day[1]!, 'noon')]),
    )
    expect(err).toBe(failed)
    expect(db.state.log).toStrictEqual([])
  })

  it.each(Object.keys(refusals))('refuses with a DatabaseError and writes nothing: %s', async (name) => {
    const refusal = refusals[name]!
    const err = await caught(refusal.run())
    expect(err).toBeInstanceOf(DatabaseError)
    expect(err).toBeInstanceOf(Error)
    expect((err as DatabaseError).name).toBe('DatabaseError')
    expect((err as DatabaseError).message).toBe(refusal.message())
    expect(db.state.log).toStrictEqual([])
    expect(spies.runSplitSeg).not.toHaveBeenCalled()
    expect(spies.runSplitCluster).not.toHaveBeenCalled()
    expect(spies.runReplaceMixed).not.toHaveBeenCalled()
  })
})

describe('persistMyTimeDayDirtyClusters — payroll hours after an approved row’s times change', () => {
  const APPROVED = { approved_at: '2026-01-06T00:00:00Z' }
  const recompute = (id: string): Written => ({
    op: 'dbRpc',
    fn: 'recompute_people_hours_after_session_edit',
    label: 'recompute people_hours after my time save',
    args: { p_session_id: id },
  })

  it('a seam moved between approved rows: the times, then one resync of the day', async () => {
    const c = [mk('a', T(0), T(2), { job_ledger_id: 'j1', ...APPROVED }), mk('b', T(2), T(4), { job_ledger_id: 'j2', ...APPROVED })]
    await save([c], [{ boundaries: [T(0), T(3), T(4)], notes: ['x', 'y'] }])
    expect(db.state.log).toStrictEqual([timesUpdate('a', T(0), T(3), 'x'), timesUpdate('b', T(3), T(4), 'y'), recompute('b')])
  })

  it('only the approved row counts: a pending row re-cut beside it still resyncs, keyed on the approved one', async () => {
    const c = [mk('a', T(0), T(2), { job_ledger_id: 'j1', ...APPROVED }), mk('b', T(2), T(4), { job_ledger_id: 'j2' })]
    await save([c], [{ boundaries: [T(0), T(3), T(4)], notes: ['x', 'y'] }])
    expect(db.state.log[db.state.log.length - 1]).toStrictEqual(recompute('a'))
  })

  it('the People → Hours seed writing an approved row’s times resyncs', async () => {
    const c = [mk('a', T(0), T(4), APPROVED)]
    await save([c], [{ boundaries: [T(0), T(4)], notes: ['x'] }], { peopleHoursGridProportionalSeed: true })
    expect(db.state.log.map((w) => w.op)).toStrictEqual(['update', 'dbRpc'])
    expect(db.state.log[db.state.log.length - 1]).toStrictEqual(recompute('a'))
  })

  it('punch and salary approved rows merged into one part resync', async () => {
    const c = [mk('a', T(0), T(2), APPROVED), salary('s', T(2), T(4), 1, APPROVED)]
    await save([c], [{ boundaries: [T(0), T(4)], notes: ['x'] }])
    expect(db.state.log[db.state.log.length - 1]).toStrictEqual(recompute('s'))
  })

  it('pending rows re-cut do not resync — there is nothing approved to count', async () => {
    await save([twoJobs()], [{ boundaries: [T(0), T(3), T(4)], notes: ['x', 'y'] }])
    expect(db.state.log.some((w) => w.op === 'dbRpc')).toBe(false)
  })

  it('a notes-only save of approved rows does not resync', async () => {
    const c = [mk('a', T(0), T(2), { job_ledger_id: 'j1', ...APPROVED }), mk('b', T(2), T(4), { job_ledger_id: 'j2', ...APPROVED })]
    await save([c], [{ boundaries: [T(0), T(2), T(4)], notes: ['x', 'y'] }])
    expect(db.state.log).toStrictEqual([noteUpdate('a', 'x'), noteUpdate('b', 'y')])
  })

  it('an approved row split by the RPC does not resync here — the RPC keeps payroll hours itself', async () => {
    await save([[mk('a', T(0), T(4), APPROVED)]], [{ boundaries: [T(0), T(2), T(4)], notes: ['x', 'y'] }])
    expect(db.state.log.map((w) => w.op)).toStrictEqual(['rpc'])
  })

  it('two clusters with approved rows re-cut resync once, after every write', async () => {
    const first = [mk('a', T(0), T(2), { job_ledger_id: 'j1', ...APPROVED }), mk('b', T(2), T(4), { job_ledger_id: 'j2', ...APPROVED })]
    const second = [mk('c', T(5), T(6), { job_ledger_id: 'j1', ...APPROVED }), mk('d', T(6), T(7), { job_ledger_id: 'j2', ...APPROVED })]
    await save(
      [first, second],
      [
        { boundaries: [T(0), T(3), T(4)], notes: ['x', 'y'] },
        { boundaries: [T(5), T(6.5), T(7)], notes: ['z', 'w'] },
      ],
    )
    expect(db.state.log.map((w) => w.op)).toStrictEqual(['update', 'update', 'update', 'update', 'dbRpc'])
    expect(db.state.log[db.state.log.length - 1]).toStrictEqual(recompute('d'))
  })

  it('a refused resync rejects the save; the rows written before it stay written', async () => {
    const c = [mk('a', T(0), T(2), { job_ledger_id: 'j1', ...APPROVED }), mk('b', T(2), T(4), { job_ledger_id: 'j2', ...APPROVED })]
    const refusal = { message: 'Access denied' }
    db.state.refuse.set(3, refusal)
    await expect(save([c], [{ boundaries: [T(0), T(3), T(4)], notes: ['x', 'y'] }])).rejects.toBe(refusal)
    expect(db.state.log.map((w) => w.op)).toStrictEqual(['update', 'update', 'dbRpc'])
  })
})

describe('myTimeDayPersistRpcs', () => {
  it('hands out the own RPCs only for your own day inside the week fence', () => {
    const r = myTimeDayPersistRpcs(true, false)
    expect(r.runSplitSeg).toBe(own.splitOwnClockSessionSegments)
    expect(r.runSplitCluster).toBe(own.splitOwnClockSessionCluster)
    expect(r.runReplaceMixed).toBe(own.replaceOwnClockSessionClusterMixed)
    expect(Object.keys(r).sort()).toStrictEqual(['runReplaceMixed', 'runSplitCluster', 'runSplitSeg'])
  })

  it.each([
    [true, true],
    [false, false],
    [false, true],
  ])('hands out the leader RPCs for editingSelf %s, fenceOverridden %s', (editingSelf, fenceOverridden) => {
    const r = myTimeDayPersistRpcs(editingSelf, fenceOverridden)
    expect(r.runSplitSeg).toBe(leader.leaderSplitClockSessionSegments)
    expect(r.runSplitCluster).toBe(leader.leaderSplitClockSessionCluster)
    expect(r.runReplaceMixed).toBe(leader.leaderReplaceClockSessionClusterMixed)
  })
})

describe('MY_TIME_SALARY_SYNC_SAVED_NOTE', () => {
  it('reads as the toast does', () => {
    expect(MY_TIME_SALARY_SYNC_SAVED_NOTE).toBe(
      'Saved. Rows tied to the salaried workday template may be adjusted when salary sync runs.',
    )
  })
})
