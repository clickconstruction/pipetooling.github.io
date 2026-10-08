// @vitest-environment jsdom
/**
 * The My Time day editor's timeline body (map step 8b) with the real Visual and Form editors: an
 * Off clock strip for each gap, one editor per cluster wired to the shell's callbacks by cluster id,
 * Loading editor… until every cluster is seeded, the punch actions behind their gate, and the
 * + Add session tail behind its own.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import {
  expandClustersSplitPairwiseOverlaps,
  groupTimeContiguousSessionClusters,
  initialClusterSplitState,
  sessionClusterId,
  type DayEditorSession,
  type SplitEditorState,
} from '../../lib/myTimeDayTimeline'
import { MyTimeDayTimelineBody, type MyTimeDayTimelineBodyProps } from './MyTimeDayTimelineBody'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', () => {
  function builder(): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'or', 'order', 'limit', 'gte', 'lte', 'maybeSingle', 'single']) b[m] = () => b
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(res, rej)
    return b
  }
  return { supabase: { from: () => builder(), rpc: () => Promise.resolve({ data: [], error: null }) } }
})

const DAY = '2026-10-06'
const at = (hms: string) => `${DAY}T${hms}Z`

function row(id: string, inHms: string, outHms: string, extra: Partial<DayEditorSession> = {}): DayEditorSession {
  return {
    id,
    clocked_in_at: at(inHms),
    clocked_out_at: at(outHms),
    work_date: DAY,
    notes: '',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin: 'user_punch',
    salary_segment_index: null,
    ...extra,
  }
}

// `a|b`: two punches back to back on two jobs; an hour off the clock; then `c` alone.
const ROUGH = row('a', '14:00:00', '16:00:00', { job_ledger_id: 'job-1', notes: 'Rough-in' })
const TRIM = row('b', '16:00:00', '18:00:00', { job_ledger_id: 'job-2', notes: 'Trim out' })
const LATE = row('c', '19:00:00', '20:00:00', { notes: 'Walkthrough' })
const SESSIONS = [ROUGH, TRIM, LATE]
const NOW = Date.parse(at('22:00:00'))
const ADD_DEFAULTS = { defaultClockInIso: at('21:00:00'), defaultClockOutIso: at('23:00:00') }

function seeded(sessions: DayEditorSession[]): Record<string, SplitEditorState> {
  const out: Record<string, SplitEditorState> = {}
  for (const c of expandClustersSplitPairwiseOverlaps(groupTimeContiguousSessionClusters(sessions), NOW)) {
    out[sessionClusterId(c)] = initialClusterSplitState(c, NOW)
  }
  return out
}

function props(over: Partial<MyTimeDayTimelineBodyProps> = {}): MyTimeDayTimelineBodyProps {
  return {
    myTimeCompactLayout: false,
    editorInitialized: true,
    sortedSessions: SESSIONS,
    nowTick: NOW,
    layoutMode: 'visual',
    saving: false,
    splitByCluster: seeded(SESSIONS),
    patchCluster: vi.fn(),
    commitInnerBoundary: vi.fn(),
    openMergeJobChoiceForCluster: vi.fn(),
    stripRefs: { current: {} },
    handleStripPointerDown: vi.fn(),
    handleStripKeyDown: vi.fn(),
    startDrag: vi.fn(),
    setFocusedHandle: vi.fn(),
    mergedJobLabels: { 'job-1': 'Smith remodel', 'job-2': 'Lee duplex' },
    mergedBidLabels: {},
    setAssignBulk: vi.fn(),
    handleAssignJobSaved: vi.fn(),
    resolveAssignSessionForSegment: vi.fn(async () => null),
    allowPunchTimeActions: true,
    openForceClockOut: vi.fn(),
    openAdjustTimes: vi.fn(),
    handleRejectSession: vi.fn(),
    rejectSessionBusyId: null,
    effectiveSubjectUserId: 'u-sub',
    dateStr: DAY,
    onPatchSeededSessionsJobBid: undefined,
    draftLocalJobBidAssign: vi.fn(),
    showApplyScheduleProportions: false,
    applyScheduleProportionsToCluster: vi.fn(async () => {}),
    showSalariedLabelUnderVisualStrip: false,
    clockTimesReadOnly: false,
    effectiveEditable: true,
    priorWeekGateActive: false,
    sessionsProp: [],
    sessionsLoading: false,
    pendingAuthForFetch: false,
    setAddDisjointOpen: vi.fn(),
    computeAddDisjointDefaults: () => ADD_DEFAULTS,
    ...over,
  }
}

afterEach(cleanup)

describe('MyTimeDayTimelineBody', () => {
  it('draws an Off clock strip for the gap and a Visual strip per cluster, each wired by its cluster id', () => {
    const p = props()
    renderWithProviders(<MyTimeDayTimelineBody {...p} />)
    expect(screen.getByText('Off clock · 1.0 h')).toBeTruthy()
    const strips = screen.getAllByRole('slider')
    expect(strips).toHaveLength(2)
    expect(Object.keys(p.stripRefs.current).sort()).toEqual(['a|b', 'c'])
    expect(p.stripRefs.current.c).toBe(strips[1])

    fireEvent.pointerDown(strips[1]!)
    expect(p.handleStripPointerDown).toHaveBeenCalledWith('c', [LATE], expect.anything())
    fireEvent.keyDown(strips[0]!, { key: 'ArrowUp' })
    expect(p.handleStripKeyDown).toHaveBeenCalledWith('a|b', expect.anything())
    expect(screen.getAllByText(/Smith remodel/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Lee duplex/).length).toBeGreaterThan(0)
  })

  it('the Form layout draws the same clusters with a Split per segment and no strips', () => {
    renderWithProviders(<MyTimeDayTimelineBody {...props({ layoutMode: 'form' })} />)
    expect(screen.getByText('Off clock · 1.0 h')).toBeTruthy()
    expect(screen.queryAllByRole('slider')).toHaveLength(0)
    expect(screen.getAllByRole('button', { name: 'Split' })).toHaveLength(3)
    expect(screen.getAllByText(/Smith remodel/).length).toBeGreaterThan(0)
  })

  it('says Loading editor… until every cluster is seeded', () => {
    renderWithProviders(<MyTimeDayTimelineBody {...props({ editorInitialized: false })} />)
    expect(screen.getByText('Loading editor…')).toBeTruthy()
    expect(screen.queryAllByRole('slider')).toHaveLength(0)
    expect(screen.queryByText('Off clock · 1.0 h')).toBeNull()
  })

  it('offers Reject session only while punch actions are allowed and nothing is saving', () => {
    const { rerender } = renderWithProviders(<MyTimeDayTimelineBody {...props()} />)
    expect(screen.getAllByRole('button', { name: 'Reject session' }).length).toBeGreaterThan(0)
    rerender(<MyTimeDayTimelineBody {...props({ saving: true })} />)
    expect(screen.queryAllByRole('button', { name: 'Reject session' })).toHaveLength(0)
    rerender(<MyTimeDayTimelineBody {...props({ allowPunchTimeActions: false })} />)
    expect(screen.queryAllByRole('button', { name: 'Reject session' })).toHaveLength(0)
  })

  it('+ Add session opens with the computed defaults, only on an editable, loaded day the editor reads itself', () => {
    const p = props()
    const { rerender } = renderWithProviders(<MyTimeDayTimelineBody {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add session' }))
    expect(p.setAddDisjointOpen).toHaveBeenCalledWith(ADD_DEFAULTS)

    rerender(<MyTimeDayTimelineBody {...props({ saving: true })} />)
    expect((screen.getByRole('button', { name: 'Add session' }) as HTMLButtonElement).disabled).toBe(true)

    const hidden: Array<Partial<MyTimeDayTimelineBodyProps>> = [
      { sessionsProp: SESSIONS },
      { sessionsLoading: true },
      { pendingAuthForFetch: true },
      { priorWeekGateActive: true },
      { allowPunchTimeActions: false },
      { effectiveEditable: false },
    ]
    for (const over of hidden) {
      rerender(<MyTimeDayTimelineBody {...props(over)} />)
      expect(screen.queryByRole('button', { name: 'Add session' })).toBeNull()
    }
  })
})
