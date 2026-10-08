import { useState } from 'react'
import { buildPeopleHoursManualDraftSession } from '../lib/peopleHoursManualDraftSession'
import {
  buildJobBidLabelMapsFromClockRows,
  collectPeopleHoursDaySessionsForScale,
  scaleClosedSessionsToTargetHours,
  toDayEditorSession,
} from '../lib/peopleHoursProportionalScale'
import type { DayEditorSession } from '../lib/myTimeDayTimeline'
import type { LedgerPrefixMap } from '../lib/ledgerDisplayPrefixes'
import type { ClockSessionRow } from '../types/clockSessions'


/** The Hours grid's manual-draft editor window: the day it opens on, its seeded sessions and their labels. */
export type PeopleHoursManualDraftEditorState = {
  subjectUserId: string
  subjectDisplayName: string
  dateStr: string
  draftSessions: DayEditorSession[]
  personName: string
  jobLabels?: Record<string, string>
  bidLabels?: Record<string, string>
}

export interface UsePeopleHoursManualDraftEditorInput {
  users: ReadonlyArray<{ id: string; name: string | null }>
  pendingClockSessions: ClockSessionRow[]
  approvedClockSessions: ClockSessionRow[]
  prefixMap: LedgerPrefixMap
  saveHours: (personName: string, workDate: string, hours: number) => Promise<void>
  showToast: (text: string, variant: 'success' | 'error' | 'info' | 'warning') => void
  /** The plain day editor, opened instead for a day with an open session. */
  setHoursMyTimeEditor: (editor: { subjectUserId: string; subjectDisplayName: string; dateStr: string }) => void
}

/**
 * The People Hours grid's manual-draft editor window (row 6, the PEOPLE_TABS map's step 8 cuts):
 * what typing hours into a grid cell opens — the person's closed sessions scaled to the typed total,
 * or one draft session — and the state the window edits in place. Moved verbatim from `People.tsx`;
 * `PeopleHoursManualDraftEditor` draws the window.
 */
export function usePeopleHoursManualDraftEditor({
  users,
  pendingClockSessions,
  approvedClockSessions,
  prefixMap,
  saveHours,
  showToast,
  setHoursMyTimeEditor,
}: UsePeopleHoursManualDraftEditorInput) {
  const [hoursManualDraftEditor, setHoursManualDraftEditor] = useState<PeopleHoursManualDraftEditorState | null>(null)


  /** Hours matrix blur: open My Time — proportional scale of existing closed sessions, else single draft. Open session → fetch modal + toast. */
  function openManualHoursDraftFromBlur(personName: string, workDate: string, hoursDecimal: number) {
    const u = users.find((x) => (x.name ?? '').trim() === personName.trim())
    if (!u?.id) {
      showToast(
        'No user account matches this roster name — hours saved to the grid only. Link the name to open My Time next time.',
        'error',
      )
      void saveHours(personName, workDate, hoursDecimal)
      return
    }
    const dayRows = collectPeopleHoursDaySessionsForScale(
      pendingClockSessions,
      approvedClockSessions,
      u.id,
      workDate,
    )
    if (dayRows.some((r) => !r.clocked_out_at)) {
      showToast(
        'Close open clock sessions before scaling hours from the grid. Edit time is open with live sessions.',
        'info',
      )
      setHoursMyTimeEditor({
        subjectUserId: u.id,
        subjectDisplayName: u.name?.trim() ?? personName,
        dateStr: workDate,
      })
      return
    }
    try {
      const mapped = dayRows.map(toDayEditorSession)
      mapped.sort((a, b) => new Date(a.clocked_in_at).getTime() - new Date(b.clocked_in_at).getTime())
      const scaled = scaleClosedSessionsToTargetHours(mapped, hoursDecimal)
      if (scaled != null && scaled.length > 0) {
        const { jobLabels, bidLabels } = buildJobBidLabelMapsFromClockRows(dayRows, prefixMap)
        setHoursManualDraftEditor({
          subjectUserId: u.id,
          subjectDisplayName: u.name?.trim() ?? personName,
          dateStr: workDate,
          draftSessions: scaled,
          personName,
          jobLabels,
          bidLabels,
        })
      } else {
        const draft = buildPeopleHoursManualDraftSession(workDate, hoursDecimal)
        setHoursManualDraftEditor({
          subjectUserId: u.id,
          subjectDisplayName: u.name?.trim() ?? personName,
          dateStr: workDate,
          draftSessions: [draft],
          personName,
        })
      }
    } catch {
      showToast('Could not build draft session for that date.', 'error')
    }
  }

  return { hoursManualDraftEditor, setHoursManualDraftEditor, openManualHoursDraftFromBlur }
}
