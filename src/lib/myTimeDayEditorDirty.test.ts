import { describe, expect, it } from 'vitest'
import {
  comparableSplit,
  dayEditorEffectiveDirty,
  listClustersDirtyFromJobBidChange,
  listDirtyClusterIds,
  noteOnlyApprovedSafe,
  sessionJobBidKey,
} from './myTimeDayEditorDirty'
import {
  initialClusterSplitState,
  sessionClusterId,
  type DayEditorSession,
  type SplitEditorState,
} from './myTimeDayTimeline'
import { DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX } from './peopleHoursManualDraftSession'

const H = 3_600_000
const DAY = Date.UTC(2026, 0, 5, 14, 0, 0)
const T = (hours: number, extraMs = 0) => DAY + hours * H + extraMs
const NOW = T(9)

function mk(
  id: string,
  inMs: number,
  outMs: number | null,
  over: Partial<DayEditorSession> = {}
): DayEditorSession {
  return {
    id,
    clocked_in_at: new Date(inMs).toISOString(),
    clocked_out_at: outMs != null ? new Date(outMs).toISOString() : null,
    work_date: '2026-01-05',
    notes: 'n',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin: 'user_punch',
    salary_segment_index: null,
    ...over,
  }
}

/** The editor's seed: split state, snapshot and job/bid keys as the modal takes them on open. */
function seed(clusters: DayEditorSession[][], nowMs = NOW) {
  const splitByCluster: Record<string, SplitEditorState> = {}
  const initialSnapshot: Record<string, string> = {}
  const initialJobBidBySessionId: Record<string, string> = {}
  for (const c of clusters) {
    const cid = sessionClusterId(c)
    splitByCluster[cid] = initialClusterSplitState(c, nowMs)
    initialSnapshot[cid] = comparableSplit(c[c.length - 1]!, splitByCluster[cid]!)
    for (const s of c) initialJobBidBySessionId[s.id] = sessionJobBidKey(s)
  }
  return { splitByCluster, initialSnapshot, initialJobBidBySessionId }
}

describe('comparableSplit', () => {
  it('a closed session compares the whole split', () => {
    const s = mk('a', T(0), T(2))
    const a = comparableSplit(s, { boundaries: [T(0), T(2)], notes: ['x'] })
    expect(a).not.toBe(comparableSplit(s, { boundaries: [T(0), T(2, 1)], notes: ['x'] }))
    expect(a).not.toBe(comparableSplit(s, { boundaries: [T(0), T(2)], notes: ['y'] }))
  })

  it('an open session ignores its last boundary, so a running clock is not an edit', () => {
    const s = mk('a', T(0), null)
    const a = comparableSplit(s, { boundaries: [T(0), T(1), T(2)], notes: ['x', 'y'] })
    expect(a).toBe(comparableSplit(s, { boundaries: [T(0), T(1), T(5)], notes: ['x', 'y'] }))
    expect(a).not.toBe(comparableSplit(s, { boundaries: [T(0), T(1.5), T(5)], notes: ['x', 'y'] }))
  })

  it('an open session also drops job overrides from the compare; a closed one keeps them', () => {
    const over = { 0: { job_ledger_id: 'job-1', bid_id: null } }
    const open = mk('a', T(0), null)
    const closed = mk('b', T(0), T(2))
    const base = { boundaries: [T(0), T(2)], notes: ['x'] }
    expect(comparableSplit(open, { ...base, segmentJobOverrides: over })).toBe(comparableSplit(open, base))
    expect(comparableSplit(closed, { ...base, segmentJobOverrides: over })).not.toBe(comparableSplit(closed, base))
  })
})

describe('listDirtyClusterIds', () => {
  const a = [mk('a', T(0), T(2))]
  const b = [mk('b', T(3), T(4)), mk('c', T(4), T(5))]
  const open = [mk('d', T(6), null)]

  it('nothing is dirty on the seed', () => {
    const { splitByCluster, initialSnapshot } = seed([a, b, open])
    expect(listDirtyClusterIds([a, b, open], initialSnapshot, splitByCluster)).toEqual([])
  })

  it('names the cluster whose note or boundary changed, in cluster order', () => {
    const { splitByCluster, initialSnapshot } = seed([a, b])
    const next = {
      ...splitByCluster,
      'a': { ...splitByCluster['a']!, notes: ['changed'] },
      'b|c': { ...splitByCluster['b|c']!, boundaries: [T(3), T(4.5), T(5)] },
    }
    expect(listDirtyClusterIds([b, a], initialSnapshot, next)).toEqual(['b|c', 'a'])
  })

  it('an open cluster whose clock ticked is clean', () => {
    const { splitByCluster, initialSnapshot } = seed([open], T(7))
    const ticked = { d: { ...splitByCluster['d']!, boundaries: [T(6), T(8)] } }
    expect(listDirtyClusterIds([open], initialSnapshot, ticked)).toEqual([])
  })

  it('skips a cluster with no split state, and counts one with no snapshot as dirty', () => {
    const { splitByCluster } = seed([a])
    expect(listDirtyClusterIds([a, b], {}, splitByCluster)).toEqual(['a'])
  })
})

describe('sessionJobBidKey', () => {
  it('keys job and bid apart, null as empty', () => {
    expect(sessionJobBidKey({ job_ledger_id: 'j', bid_id: null })).toBe('j\0')
    expect(sessionJobBidKey({ job_ledger_id: null, bid_id: 'j' })).toBe('\0j')
    expect(sessionJobBidKey({ job_ledger_id: null, bid_id: null })).toBe('\0')
  })
})

describe('listClustersDirtyFromJobBidChange', () => {
  const a = [mk('a', T(0), T(2), { job_ledger_id: 'job-1' })]
  const bc = [mk('b', T(3), T(4)), mk('c', T(4), T(5))]

  it('is clean when every session still carries its seeded job and bid', () => {
    const { initialJobBidBySessionId } = seed([a, bc])
    expect(listClustersDirtyFromJobBidChange([a, bc], initialJobBidBySessionId, new Map())).toEqual([])
  })

  it('reads the current map before the session, and names a cluster once', () => {
    const { initialJobBidBySessionId } = seed([a, bc])
    const current = new Map([
      ['b', sessionJobBidKey({ job_ledger_id: 'job-2', bid_id: null })],
      ['c', sessionJobBidKey({ job_ledger_id: 'job-3', bid_id: null })],
    ])
    expect(listClustersDirtyFromJobBidChange([a, bc], initialJobBidBySessionId, current)).toEqual(['b|c'])
  })

  it('falls back to the session itself when the map has no entry', () => {
    const { initialJobBidBySessionId } = seed([a])
    const moved = [{ ...a[0]!, job_ledger_id: 'job-9' }]
    expect(listClustersDirtyFromJobBidChange([moved], initialJobBidBySessionId, new Map())).toEqual(['a'])
  })

  it('a session missing from the seed is compared with the empty string, so it always reads dirty', () => {
    expect(listClustersDirtyFromJobBidChange([bc], {}, new Map())).toEqual(['b|c'])
  })
})

describe('noteOnlyApprovedSafe', () => {
  it('one row, one segment, times as saved — a note edit is safe', () => {
    const c = [mk('a', T(0), T(2), { approved_at: '2026-01-06T00:00:00Z' })]
    expect(noteOnlyApprovedSafe(c, { boundaries: [T(0), T(2)], notes: ['new note'] }, c[0]!, NOW)).toBe(true)
  })

  it('a moved time or an added split is not', () => {
    const c = [mk('a', T(0), T(2), { approved_at: '2026-01-06T00:00:00Z' })]
    expect(noteOnlyApprovedSafe(c, { boundaries: [T(0), T(1.5)], notes: ['x'] }, c[0]!, NOW)).toBe(false)
    expect(noteOnlyApprovedSafe(c, { boundaries: [T(0), T(1), T(2)], notes: ['x', 'y'] }, c[0]!, NOW)).toBe(false)
  })

  it('a split that cannot build payloads is not', () => {
    const c = [mk('a', T(0), T(2))]
    expect(noteOnlyApprovedSafe(c, { boundaries: [T(0), T(2)], notes: [''] }, c[0]!, NOW)).toBe(false)
  })

  it('a cluster of two rows left as they are is safe — the save writes notes only', () => {
    const c = [mk('a', T(0), T(1)), mk('b', T(1), T(2))]
    const last = c[1]!
    expect(noteOnlyApprovedSafe(c, initialClusterSplitState(c, NOW), last, NOW)).toBe(true)
    expect(noteOnlyApprovedSafe(c, { boundaries: [T(0), T(1), T(2)], notes: ['x', 'y'] }, last, NOW)).toBe(true)
  })

  it('a cluster of two rows with a seam moved, or a job chosen that is not the row’s own, is not', () => {
    const c = [mk('a', T(0), T(1)), mk('b', T(1), T(2))]
    const last = c[1]!
    expect(noteOnlyApprovedSafe(c, { boundaries: [T(0), T(1.5), T(2)], notes: ['x', 'y'] }, last, NOW)).toBe(false)
    expect(
      noteOnlyApprovedSafe(
        c,
        { boundaries: [T(0), T(1), T(2)], notes: ['x', 'y'], segmentJobOverrides: { 0: { job_ledger_id: 'j9', bid_id: null } } },
        last,
        NOW
      )
    ).toBe(false)
  })

  it('a cluster of two rows merged into one part is still not safe (quirk 18)', () => {
    const c = [mk('a', T(0), T(1)), mk('b', T(1), T(2))]
    expect(noteOnlyApprovedSafe(c, { boundaries: [T(0), T(2)], notes: ['x'] }, c[1]!, NOW)).toBe(false)
  })
})

describe('dayEditorEffectiveDirty', () => {
  const a = [mk('a', T(0), T(2))]
  const bc = [mk('b', T(3), T(4)), mk('c', T(4), T(5))]
  const draft = [mk(`${DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX}1`, T(6), T(7))]

  function run(
    clusters: DayEditorSession[][],
    over: Partial<Parameters<typeof dayEditorEffectiveDirty>[0]> = {}
  ) {
    return dayEditorEffectiveDirty({
      clusters,
      sessions: clusters.flat(),
      ...seed(clusters),
      proportionalSeed: false,
      ...over,
    })
  }

  it('an untouched day is clean', () => {
    expect(run([a, bc])).toEqual({ effectiveDirtyIds: [], isOnlyProportionalSeed: false })
  })

  it('a draft cluster is dirty untouched — it is not in the database yet', () => {
    expect(run([a, draft])).toEqual({
      effectiveDirtyIds: [sessionClusterId(draft)],
      isOnlyProportionalSeed: false,
    })
  })

  it('split edits come first, then job changes, then drafts, each cluster once', () => {
    const s = seed([a, bc, draft])
    const out = run([a, bc, draft], {
      splitByCluster: {
        ...s.splitByCluster,
        'b|c': { ...s.splitByCluster['b|c']!, notes: ['x', 'y'] },
      },
      sessions: [{ ...a[0]!, job_ledger_id: 'job-1' }, { ...bc[0]!, bid_id: 'bid-1' }, bc[1]!, draft[0]!],
    })
    expect(out.effectiveDirtyIds).toEqual(['b|c', 'a', sessionClusterId(draft)])
    expect(out.isOnlyProportionalSeed).toBe(false)
  })

  it('a proportional seed with nothing edited writes every cluster', () => {
    expect(run([a, bc], { proportionalSeed: true })).toEqual({
      effectiveDirtyIds: ['a', 'b|c'],
      isOnlyProportionalSeed: true,
    })
  })

  it('a proportional seed with an edit writes only what is dirty', () => {
    const s = seed([a, bc])
    const out = run([a, bc], {
      proportionalSeed: true,
      splitByCluster: { ...s.splitByCluster, a: { ...s.splitByCluster['a']!, notes: ['x'] } },
    })
    expect(out).toEqual({ effectiveDirtyIds: ['a'], isOnlyProportionalSeed: false })
  })

  it('a proportional seed on an empty day writes nothing', () => {
    expect(run([], { proportionalSeed: true })).toEqual({ effectiveDirtyIds: [], isOnlyProportionalSeed: false })
  })
})
