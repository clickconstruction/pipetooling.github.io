// @vitest-environment jsdom
/**
 * The manual-draft editor window (row 6, v2.4968): the day editor over the seeded sessions; its save
 * syncing `people_hours` — cleared for a draft-only day, the approved closed sum when real sessions
 * were scaled, cleared when that read fails — then both reloads; the in-place job and time patches;
 * close. The day editor is a probe that hands its props to the test; the state lives above, as the
 * page holds it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { DayEditorSession } from '../../lib/myTimeDayTimeline'
import type { PeopleHoursManualDraftEditorState } from '../../hooks/usePeopleHoursManualDraftEditor'
import { PeopleHoursManualDraftEditor } from './PeopleHoursManualDraftEditor'

type Result = { data: unknown; error: unknown }
/** The day editor's callbacks the window wires, as the probe receives them. */
type EditorProps = {
  onSaved: () => void
  onClose: () => void
  onLinkedSessionsUpdated: () => void
  onPatchSeededSessionsJobBid: (args: { sessionId: string; job_ledger_id: string | null; bid_id: string | null }) => void
  onPatchSeededSessionsTimes: (args: { sessionId: string; clocked_in_at: string; clocked_out_at: string | null; work_date: string }) => void
}

const h = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>,
  reads: [] as Array<Array<[string, string, unknown]>>,
  rows: [] as unknown[],
  readError: null as null | { message: string; code: string },
}))

vi.mock('../DashboardMyTimeDayEditorModal', () => ({
  DashboardMyTimeDayEditorModal: (props: Record<string, unknown>) => {
    h.props = props
    return <div>day editor</div>
  },
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => {
      const filters: Array<[string, string, unknown]> = []
      const b: Record<string, unknown> = {}
      b.select = () => b
      b.eq = (col: string, v: unknown) => {
        filters.push(['eq', col, v])
        return b
      }
      b.is = (col: string, v: unknown) => {
        filters.push(['is', col, v])
        return b
      }
      b.then = (res: (v: Result) => unknown, rej: (e: unknown) => unknown) => {
        h.reads.push(filters)
        return Promise.resolve(h.readError ? { data: null, error: h.readError } : { data: h.rows, error: null }).then(res, rej)
      }
      return b
    },
  },
}))

const DAY = '2026-10-06'

function session(id: string, inHms: string, outHms: string): DayEditorSession {
  return {
    id,
    clocked_in_at: `${DAY}T${inHms}Z`,
    clocked_out_at: `${DAY}T${outHms}Z`,
    work_date: DAY,
    notes: 'framing',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin: 'user_punch',
    salary_segment_index: null,
    quick_add_minutes: null,
  }
}

const DRAFT_DAY: PeopleHoursManualDraftEditorState = {
  subjectUserId: 'u-ana',
  subjectDisplayName: 'Ana Worker',
  dateStr: DAY,
  draftSessions: [session('draft:people-hours:1', '13:00:00', '20:30:00')],
  personName: 'Ana Worker',
}

const SCALED_DAY: PeopleHoursManualDraftEditorState = {
  ...DRAFT_DAY,
  draftSessions: [session('s-1', '14:00:00', '20:00:00'), session('s-2', '20:00:00', '22:00:00')],
  jobLabels: { 'job-1': 'Smith remodel' },
  bidLabels: {},
}

function mount(initial: PeopleHoursManualDraftEditorState | null) {
  const saveHours = vi.fn(async (_p: string, _d: string, _h: number) => {})
  const reloadSessions = vi.fn()
  const reloadHours = vi.fn()
  let current: PeopleHoursManualDraftEditorState | null = initial
  function Page() {
    const [editor, setEditor] = useState<PeopleHoursManualDraftEditorState | null>(initial)
    current = editor
    return (
      <PeopleHoursManualDraftEditor
        hoursManualDraftEditor={editor}
        setHoursManualDraftEditor={setEditor}
        saveHours={saveHours}
        loadAllClockSessionsRef={{ current: reloadSessions }}
        loadPeopleHoursRef={{ current: reloadHours }}
      />
    )
  }
  render(<Page />)
  return { saveHours, reloadSessions, reloadHours, editor: () => current }
}

const editorProps = () => h.props as unknown as EditorProps

beforeEach(() => {
  h.props = null
  h.reads = []
  h.rows = []
  h.readError = null
})

afterEach(cleanup)

describe('PeopleHoursManualDraftEditor — the window', () => {
  it('draws nothing until the grid opens a day', () => {
    mount(null)
    expect(screen.queryByText('day editor')).toBeNull()
    expect(h.props).toBeNull()
  })

  it('opens the day editor over the seeded draft, as a grid cell typed it', () => {
    mount(DRAFT_DAY)
    expect(screen.getByText('day editor')).toBeTruthy()
    expect(h.props).toMatchObject({
      dateStr: DAY,
      sessions: DRAFT_DAY.draftSessions,
      subjectUserId: 'u-ana',
      subjectDisplayName: 'Ana Worker',
      jobLabels: {},
      bidLabels: {},
      peopleHoursGridProportionalSeed: false,
      allowNcnsFromMyTime: false,
    })
  })

  it('a draft-only day: Save closes the window, clears the grid cell, then reloads both', async () => {
    const m = mount(DRAFT_DAY)
    act(() => {
      editorProps().onSaved()
    })
    expect(m.editor()).toBeNull()
    await waitFor(() => expect(m.reloadHours).toHaveBeenCalledTimes(1))
    expect(m.saveHours).toHaveBeenCalledWith('Ana Worker', DAY, 0)
    expect(m.reloadSessions).toHaveBeenCalledTimes(1)
    expect(h.reads).toEqual([])
  })

  it('scaled real sessions: Save sets the grid cell to the day’s approved closed sum, read back', async () => {
    h.rows = [
      { clocked_in_at: `${DAY}T14:00:00Z`, clocked_out_at: `${DAY}T16:00:00Z`, approved_at: `${DAY}T23:00:00Z` },
      { clocked_in_at: `${DAY}T16:00:00Z`, clocked_out_at: `${DAY}T17:30:00Z`, approved_at: `${DAY}T23:00:00Z` },
      { clocked_in_at: `${DAY}T18:00:00Z`, clocked_out_at: `${DAY}T19:00:00Z`, approved_at: null },
      { clocked_in_at: `${DAY}T20:00:00Z`, clocked_out_at: null, approved_at: `${DAY}T23:00:00Z` },
    ]
    const m = mount(SCALED_DAY)
    expect(h.props).toMatchObject({ peopleHoursGridProportionalSeed: true, jobLabels: { 'job-1': 'Smith remodel' } })
    act(() => {
      editorProps().onSaved()
    })
    await waitFor(() => expect(m.reloadHours).toHaveBeenCalledTimes(1))
    expect(m.saveHours).toHaveBeenCalledWith('Ana Worker', DAY, 3.5)
    expect(h.reads).toEqual([
      [
        ['eq', 'user_id', 'u-ana'],
        ['eq', 'work_date', DAY],
        ['is', 'rejected_at', null],
        ['is', 'revoked_at', null],
      ],
    ])
  })

  it('when that read fails the grid cell is cleared instead', async () => {
    h.readError = { message: 'permission denied for table clock_sessions', code: '42501' }
    const m = mount(SCALED_DAY)
    act(() => {
      editorProps().onSaved()
    })
    await waitFor(() => expect(m.reloadHours).toHaveBeenCalledTimes(1))
    expect(m.saveHours).toHaveBeenCalledWith('Ana Worker', DAY, 0)
  })

  it('job and time patches land on that seeded session in place; Close clears the window', () => {
    const m = mount(SCALED_DAY)
    act(() => {
      editorProps().onPatchSeededSessionsJobBid({ sessionId: 's-2', job_ledger_id: 'job-1', bid_id: null })
    })
    act(() => {
      editorProps().onPatchSeededSessionsTimes({
        sessionId: 's-1',
        clocked_in_at: `${DAY}T13:00:00Z`,
        clocked_out_at: `${DAY}T20:00:00Z`,
        work_date: DAY,
      })
    })
    const [s1, s2] = m.editor()!.draftSessions
    expect(s2).toMatchObject({ id: 's-2', job_ledger_id: 'job-1', bid_id: null })
    expect(s1).toMatchObject({ id: 's-1', clocked_in_at: `${DAY}T13:00:00Z`, clocked_out_at: `${DAY}T20:00:00Z` })
    expect(m.editor()!.draftSessions.map((s) => s.id)).toEqual(['s-1', 's-2'])

    act(() => {
      editorProps().onLinkedSessionsUpdated()
    })
    expect(m.reloadSessions).toHaveBeenCalledTimes(1)
    expect(m.reloadHours).toHaveBeenCalledTimes(1)

    act(() => {
      editorProps().onClose()
    })
    expect(m.editor()).toBeNull()
    expect(m.saveHours).not.toHaveBeenCalled()
  })
})
