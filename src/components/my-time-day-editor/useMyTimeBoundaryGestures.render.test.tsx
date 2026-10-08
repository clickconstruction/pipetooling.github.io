// @vitest-environment jsdom
/**
 * The My Time day editor's boundary gestures (map step 7b) on the real split store and timeline
 * kernels: the boundary drag (relative pointer travel, quirk 9) with its release and cancel, the strip
 * tap that adds a split, Alt+click on the focused boundary (quirk 10), the Arrow-key nudge, the
 * layout-mode reset, the unmount teardown and the lock. jsdom has no PointerEvent or pointer capture,
 * so the window events are mouse events carrying a `pointerId`, and capture falls into the hook's catch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMemo, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useMyTimeSplitEditor } from './useMyTimeSplitEditor'
import { useMyTimeBoundaryGestures } from './useMyTimeBoundaryGestures'
import {
  expandClustersSplitPairwiseOverlaps,
  groupTimeContiguousSessionClusters,
  type DayEditorSession,
} from '../../lib/myTimeDayTimeline'

const DAY = '2026-10-06'
const at = (hms: string) => `${DAY}T${hms}Z`
const ms = (hms: string) => Date.parse(at(hms))
const DRAG_CLASS = 'my-time-boundary-dragging'

function row(id: string, inAt: string, outAt: string, extra: Partial<DayEditorSession> = {}): DayEditorSession {
  return {
    id,
    clocked_in_at: at(inAt),
    clocked_out_at: at(outAt),
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

// `a|b`: two punches back to back, 14:00–18:00 with the row join at 16:00. `c`: one punch, 19:00–20:00.
const ROUGH = row('a', '14:00:00', '16:00:00', { job_ledger_id: 'job-1', notes: 'Rough-in' })
const TRIM = row('b', '16:00:00', '18:00:00', { job_ledger_id: 'job-2', notes: 'Trim out' })
const LATE = row('c', '19:00:00', '20:00:00', { notes: 'Walkthrough' })
const SESSIONS = [ROUGH, TRIM, LATE]
const NOW = ms('22:00:00')
const NO_LABELS: Record<string, string> = {}

type Props = { allowTimelineEdits?: boolean; saving?: boolean; layoutMode?: 'visual' | 'form' }

function mount(initialProps: Props = {}) {
  const showToast = vi.fn()
  const hook = renderHook(
    (p: Props) => {
      // Built the way DashboardMyTimeDayEditorModal builds them, the split store first.
      const sortedSessions = SESSIONS
      const sessionsKey = useMemo(() => sortedSessions.map((s) => `${s.id}:${s.clocked_in_at}:${s.clocked_out_at}`).join('|'), [sortedSessions])
      const sessionClusters = useMemo(
        () => expandClustersSplitPairwiseOverlaps(groupTimeContiguousSessionClusters(sortedSessions), NOW),
        [sortedSessions],
      )
      const allowTimelineEdits = p.allowTimelineEdits ?? true
      const store = useMyTimeSplitEditor({
        sortedSessions,
        sessionsKey,
        sessionClusters,
        nowTick: NOW,
        allowTimelineEdits,
        mergedJobLabels: NO_LABELS,
        mergedBidLabels: NO_LABELS,
        showToast,
      })
      const gestures = useMyTimeBoundaryGestures({
        allowTimelineEdits,
        saving: p.saving ?? false,
        nowTick: NOW,
        sessionClusters,
        layoutMode: p.layoutMode ?? 'visual',
        setSplitByCluster: store.setSplitByCluster,
        patchCluster: store.patchCluster,
        applyInnerBoundaryDragMs: store.applyInnerBoundaryDragMs,
        splitByClusterRef: store.splitByClusterRef,
        sessionClustersRef: store.sessionClustersRef,
        nowTickRef: store.nowTickRef,
      })
      return { ...store, ...gestures }
    },
    { initialProps },
  )
  return hook
}

/** A strip `height` px tall whose top edge sits at `top` in the viewport. */
function strip(top: number, height: number): HTMLDivElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({ top, height, bottom: top + height, left: 0, right: 80, width: 80, x: 0, y: top, toJSON: () => ({}) })
  document.body.appendChild(el)
  return el
}

function handleIn(stripEl: HTMLDivElement): HTMLButtonElement {
  const b = document.createElement('button')
  b.setAttribute('data-boundary-handle', '')
  stripEl.appendChild(b)
  return b
}

function windowPointer(type: string, clientY: number, pointerId = 1, clientX = 10) {
  const e = new MouseEvent(type, { clientX, clientY })
  Object.defineProperty(e, 'pointerId', { value: pointerId })
  act(() => {
    window.dispatchEvent(e)
  })
}

function downOn<E extends Element>(el: E, clientY: number, opts: { altKey?: boolean; pointerId?: number; target?: Element } = {}) {
  return {
    isPrimary: true,
    button: 0,
    target: opts.target ?? el,
    currentTarget: el,
    clientX: 10,
    clientY,
    pointerId: opts.pointerId ?? 1,
    altKey: opts.altKey ?? false,
    preventDefault: vi.fn(),
  } as unknown as ReactPointerEvent<E>
}

function key(k: string) {
  return { key: k, preventDefault: vi.fn() } as unknown as KeyboardEvent
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  document.body.className = ''
})

describe('useMyTimeBoundaryGestures', () => {
  // `a|b` on an 800 px strip at top 100: 4 h over 800 px, 18 s a pixel; the join draws at strip Y 400.
  function startJoinDrag(result: ReturnType<typeof mount>['result'], grabClientY: number) {
    const el = strip(100, 800)
    result.current.stripRefs.current['a|b'] = el
    const undo = result.current.splitByCluster['a|b']!
    act(() => result.current.startDrag('a|b', 1, downOn(handleIn(el), grabClientY), undo))
  }

  it('drags a boundary by the pointer’s travel from where it was grabbed, then lets go on release', () => {
    const { result } = mount()
    startJoinDrag(result, 510) // grabbed 10 px below the line
    expect(document.body.classList.contains(DRAG_CLASS)).toBe(true)
    expect(result.current.dragRef.current).toMatchObject({ clusterId: 'a|b', index: 1, grabStripY: 410, originBoundaryMs: ms('16:00:00') })

    // 200 px up from the grab is one hour earlier (the absolute Y would read 15:03).
    windowPointer('pointermove', 310)
    expect(result.current.splitByCluster['a|b']!.boundaries).toEqual([ms('14:00:00'), ms('15:00:00'), ms('18:00:00')])

    windowPointer('pointerup', 310)
    expect(result.current.dragRef.current).toBeNull()
    expect(document.body.classList.contains(DRAG_CLASS)).toBe(false)
    windowPointer('pointermove', 600)
    expect(result.current.splitByCluster['a|b']!.boundaries[1]).toBe(ms('15:00:00'))
  })

  it('snaps onto the row join within a minute of it while dragging', () => {
    const { result } = mount()
    startJoinDrag(result, 500)
    windowPointer('pointermove', 497) // 3 px = 54 s above the join
    expect(result.current.splitByCluster['a|b']!.boundaries[1]).toBe(ms('16:00:00'))
    windowPointer('pointermove', 490) // 10 px = 3 min above
    expect(result.current.splitByCluster['a|b']!.boundaries[1]).toBe(ms('15:57:00'))
  })

  it('cancelling a drag puts the split back as it was and clears the focus', () => {
    const { result } = mount()
    act(() => result.current.setFocusedHandle({ clusterId: 'a|b', index: 1 }))
    startJoinDrag(result, 500)
    windowPointer('pointermove', 300)
    expect(result.current.splitByCluster['a|b']!.boundaries[1]).toBe(ms('15:00:00'))

    act(() => result.current.cancelBoundaryDrag())
    expect(result.current.splitByCluster['a|b']!.boundaries).toEqual([ms('14:00:00'), ms('16:00:00'), ms('18:00:00')])
    expect(result.current.dragRef.current).toBeNull()
    expect(result.current.focusedHandle).toBeNull()
    expect(document.body.classList.contains(DRAG_CLASS)).toBe(false)
  })

  it('a tap on the strip adds a split where it landed; a press that moves, a press on a handle or a press while saving does not', () => {
    const { result, rerender } = mount()
    const el = strip(0, 600) // `c`: one hour over 600 px
    act(() => result.current.handleStripPointerDown('c', [LATE], downOn(el, 300, { pointerId: 7 })))
    expect(result.current.stripTapSessionRef.current).toMatchObject({ clusterId: 'c', pointerId: 7 })
    windowPointer('pointerup', 300, 7)
    expect(result.current.stripTapSessionRef.current).toBeNull()
    expect(result.current.splitByCluster.c!.boundaries).toEqual([ms('19:00:00'), ms('19:30:00'), ms('20:00:00')])

    // Moved more than 8 px before letting go: no split.
    act(() => result.current.handleStripPointerDown('c', [LATE], downOn(el, 120, { pointerId: 8 })))
    windowPointer('pointermove', 140, 8)
    windowPointer('pointerup', 140, 8)
    expect(result.current.splitByCluster.c!.boundaries).toHaveLength(3)

    // A press that starts on a boundary handle belongs to the drag.
    act(() => result.current.handleStripPointerDown('c', [LATE], downOn(el, 120, { target: handleIn(el) })))
    expect(result.current.stripTapSessionRef.current).toBeNull()

    rerender({ saving: true })
    act(() => result.current.handleStripPointerDown('c', [LATE], downOn(el, 120)))
    expect(result.current.stripTapSessionRef.current).toBeNull()
  })

  it('Alt+click on the strip moves the focused boundary to the click (quirk 10)', () => {
    const { result } = mount()
    const el = strip(100, 800)
    act(() => result.current.setFocusedHandle({ clusterId: 'a|b', index: 1 }))
    const ev = downOn(el, 300, { altKey: true }) // strip Y 200 → 15:00
    act(() => result.current.handleStripPointerDown('a|b', [ROUGH, TRIM], ev))
    expect(result.current.splitByCluster['a|b']!.boundaries).toEqual([ms('14:00:00'), ms('15:00:00'), ms('18:00:00')])
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(result.current.stripTapSessionRef.current).toBeNull()
  })

  it('Arrow keys nudge the focused boundary a minute at a time', () => {
    const { result } = mount()
    act(() => result.current.patchCluster('c', { type: 'addSplitAt', ms: ms('19:30:00') }))
    act(() => result.current.setFocusedHandle({ clusterId: 'c', index: 1 }))
    const down = key('ArrowDown')
    act(() => result.current.handleStripKeyDown('c', down))
    expect(down.preventDefault).toHaveBeenCalled()
    expect(result.current.splitByCluster.c!.boundaries[1]).toBe(ms('19:31:00'))
    act(() => result.current.handleStripKeyDown('c', key('ArrowUp')))
    act(() => result.current.handleStripKeyDown('c', key('ArrowUp')))
    expect(result.current.splitByCluster.c!.boundaries[1]).toBe(ms('19:29:00'))

    // Other keys and other clusters are left alone.
    act(() => result.current.handleStripKeyDown('c', key('Enter')))
    act(() => result.current.handleStripKeyDown('a|b', key('ArrowUp')))
    expect(result.current.splitByCluster.c!.boundaries[1]).toBe(ms('19:29:00'))
    expect(result.current.splitByCluster['a|b']!.boundaries[1]).toBe(ms('16:00:00'))
  })

  it('a nudge off a row join snaps straight back onto it, so the keys cannot move a join (today’s behaviour)', () => {
    const { result } = mount()
    act(() => result.current.setFocusedHandle({ clusterId: 'a|b', index: 1 }))
    act(() => result.current.handleStripKeyDown('a|b', key('ArrowUp')))
    act(() => result.current.handleStripKeyDown('a|b', key('ArrowDown')))
    act(() => result.current.handleStripKeyDown('a|b', key('ArrowDown')))
    expect(result.current.splitByCluster['a|b']!.boundaries[1]).toBe(ms('16:00:00'))
  })

  it('switching Visual and Form ends a drag where it got to, drops a tap and clears the focus', () => {
    const { result, rerender } = mount()
    act(() => result.current.setFocusedHandle({ clusterId: 'a|b', index: 1 }))
    startJoinDrag(result, 500)
    windowPointer('pointermove', 300)
    rerender({ layoutMode: 'form' })
    expect(result.current.dragRef.current).toBeNull()
    expect(document.body.classList.contains(DRAG_CLASS)).toBe(false)
    expect(result.current.focusedHandle).toBeNull()
    expect(result.current.splitByCluster['a|b']!.boundaries[1]).toBe(ms('15:00:00'))

    const el = strip(0, 600)
    act(() => result.current.handleStripPointerDown('c', [LATE], downOn(el, 300, { pointerId: 9 })))
    rerender({ layoutMode: 'visual' })
    expect(result.current.stripTapSessionRef.current).toBeNull()
    windowPointer('pointerup', 300, 9)
    expect(result.current.splitByCluster.c!.boundaries).toHaveLength(2)
  })

  it('unmounting mid-drag takes the window listeners and the body class with it', () => {
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    const { result, unmount } = mount()
    startJoinDrag(result, 500)
    const move = added.mock.calls.find(([type]) => String(type) === 'pointermove')![1]
    removed.mockClear() // the layout-mode effect already removed it once, at mount
    unmount()
    expect(removed).toHaveBeenCalledWith('pointermove', move)
    expect(removed).toHaveBeenCalledWith('pointerup', expect.any(Function))
    expect(document.body.classList.contains(DRAG_CLASS)).toBe(false)
    added.mockRestore()
    removed.mockRestore()
  })

  it('does nothing while the timeline is locked', () => {
    const { result } = mount({ allowTimelineEdits: false })
    startJoinDrag(result, 500)
    expect(result.current.dragRef.current).toBeNull()
    expect(document.body.classList.contains(DRAG_CLASS)).toBe(false)

    act(() => result.current.handleStripPointerDown('c', [LATE], downOn(strip(0, 600), 300)))
    expect(result.current.stripTapSessionRef.current).toBeNull()

    act(() => result.current.setFocusedHandle({ clusterId: 'a|b', index: 1 }))
    act(() => result.current.handleStripKeyDown('a|b', key('ArrowUp')))
    expect(result.current.splitByCluster['a|b']!.boundaries[1]).toBe(ms('16:00:00'))
  })
})
