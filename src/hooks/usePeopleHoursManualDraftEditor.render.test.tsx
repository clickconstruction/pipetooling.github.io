// @vitest-environment jsdom
/**
 * What typing hours into an Hours grid cell opens (row 6, v2.4968): no account for the roster name
 * saves to the grid only; a day with an open session opens the plain day editor; closed sessions
 * are scaled to the typed total; an empty day gets one draft session; a bad date says so. On the
 * real scale and draft kernels.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { isDraftPeopleHoursSessionId } from '../lib/peopleHoursManualDraftSession'
import type { ClockSessionRow } from '../types/clockSessions'
import { usePeopleHoursManualDraftEditor, type UsePeopleHoursManualDraftEditorInput } from './usePeopleHoursManualDraftEditor'

const DAY = '2026-10-06'

function row(id: string, inHms: string, outHms: string | null, extra: Partial<ClockSessionRow> = {}): ClockSessionRow {
  return {
    id,
    user_id: 'u-ana',
    clocked_in_at: `${DAY}T${inHms}Z`,
    clocked_out_at: outHms ? `${DAY}T${outHms}Z` : null,
    work_date: DAY,
    notes: 'framing',
    job_ledger_id: null,
    bid_id: null,
    clock_in_lat: null,
    clock_in_lng: null,
    clock_out_lat: null,
    clock_out_lng: null,
    clock_in_location_source: null,
    clock_out_location_source: null,
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    revoked_at: null,
    revoked_by: null,
    users: { name: 'Ana Worker' },
    approved_by_user: null,
    rejected_by_user: null,
    ...extra,
  } as ClockSessionRow
}

function mount(over: Partial<UsePeopleHoursManualDraftEditorInput> = {}) {
  const input: UsePeopleHoursManualDraftEditorInput = {
    users: [{ id: 'u-ana', name: ' Ana Worker ' }],
    pendingClockSessions: [],
    approvedClockSessions: [],
    prefixMap: {} as UsePeopleHoursManualDraftEditorInput['prefixMap'],
    saveHours: vi.fn(async () => {}),
    showToast: vi.fn(),
    setHoursMyTimeEditor: vi.fn(),
    ...over,
  }
  return { ...renderHook(() => usePeopleHoursManualDraftEditor(input)), input }
}

const hoursOf = (s: { clocked_in_at: string; clocked_out_at: string | null }) =>
  (Date.parse(s.clocked_out_at!) - Date.parse(s.clocked_in_at)) / 3_600_000

afterEach(cleanup)

describe('usePeopleHoursManualDraftEditor — opening from a grid cell', () => {
  it('no account for the roster name: the hours go to the grid only, with a toast, and nothing opens', () => {
    const { result, input } = mount()
    act(() => result.current.openManualHoursDraftFromBlur('Ben Other', DAY, 6))
    expect(input.saveHours).toHaveBeenCalledWith('Ben Other', DAY, 6)
    expect(input.showToast).toHaveBeenCalledWith(expect.stringContaining('No user account matches'), 'error')
    expect(result.current.hoursManualDraftEditor).toBeNull()
  })

  it('a day with an open session opens the plain day editor instead', () => {
    const { result, input } = mount({ pendingClockSessions: [row('s-open', '14:00:00', null)] })
    act(() => result.current.openManualHoursDraftFromBlur('Ana Worker', DAY, 6))
    expect(input.setHoursMyTimeEditor).toHaveBeenCalledWith({ subjectUserId: 'u-ana', subjectDisplayName: 'Ana Worker', dateStr: DAY })
    expect(input.showToast).toHaveBeenCalledWith(expect.stringContaining('Close open clock sessions'), 'info')
    expect(input.saveHours).not.toHaveBeenCalled()
    expect(result.current.hoursManualDraftEditor).toBeNull()
  })

  it('closed sessions are scaled to the typed total, keeping their ids, in clock-in order', () => {
    const { result, input } = mount({
      pendingClockSessions: [row('s-2', '17:00:00', '18:00:00')],
      approvedClockSessions: [
        row('s-1', '14:00:00', '17:00:00', { approved_at: `${DAY}T20:00:00Z` }),
        row('s-gone', '19:00:00', '20:00:00', { rejected_at: `${DAY}T21:00:00Z` }),
      ],
    })
    act(() => result.current.openManualHoursDraftFromBlur('Ana Worker', DAY, 8))
    const editor = result.current.hoursManualDraftEditor!
    expect(editor).toMatchObject({ subjectUserId: 'u-ana', subjectDisplayName: 'Ana Worker', dateStr: DAY, personName: 'Ana Worker' })
    expect(editor.draftSessions.map((s) => s.id)).toEqual(['s-1', 's-2'])
    expect(editor.draftSessions.reduce((sum, s) => sum + hoursOf(s), 0)).toBeCloseTo(8, 6)
    // Each keeps the 36 s floor, then the rest goes 3 : 1 as before: 0.01 + 7.98 × 0.75.
    expect(hoursOf(editor.draftSessions[0]!)).toBeCloseTo(5.995, 6)
    expect(editor.jobLabels).toEqual({})
    expect(editor.bidLabels).toEqual({})
    expect(input.saveHours).not.toHaveBeenCalled()
  })

  it('an empty day gets one draft session of the typed hours', () => {
    const { result } = mount()
    act(() => result.current.openManualHoursDraftFromBlur('Ana Worker', DAY, 7.5))
    const editor = result.current.hoursManualDraftEditor!
    expect(editor.draftSessions).toHaveLength(1)
    expect(isDraftPeopleHoursSessionId(editor.draftSessions[0]!.id)).toBe(true)
    expect(hoursOf(editor.draftSessions[0]!)).toBeCloseTo(7.5, 6)
    expect(editor.jobLabels).toBeUndefined()
  })

  it('a date the draft cannot be built for says so, and nothing opens', () => {
    const { result, input } = mount()
    act(() => result.current.openManualHoursDraftFromBlur('Ana Worker', 'not-a-date', 4))
    expect(input.showToast).toHaveBeenCalledWith('Could not build draft session for that date.', 'error')
    expect(result.current.hoursManualDraftEditor).toBeNull()
  })
})
