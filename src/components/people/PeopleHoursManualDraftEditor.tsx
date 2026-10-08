import { DashboardMyTimeDayEditorModal } from '../DashboardMyTimeDayEditorModal'
import { isDraftPeopleHoursSessionId } from '../../lib/peopleHoursManualDraftSession'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { PeopleHoursManualDraftEditorState } from '../../hooks/usePeopleHoursManualDraftEditor'

export interface PeopleHoursManualDraftEditorProps {
  hoursManualDraftEditor: PeopleHoursManualDraftEditorState | null
  setHoursManualDraftEditor: React.Dispatch<React.SetStateAction<PeopleHoursManualDraftEditorState | null>>
  saveHours: (personName: string, workDate: string, hours: number) => Promise<void>
  /** The page's reloads, read when a save lands. */
  loadAllClockSessionsRef: React.MutableRefObject<(() => void) | undefined>
  loadPeopleHoursRef: React.MutableRefObject<(() => void) | undefined>
}

/**
 * The window `usePeopleHoursManualDraftEditor` opens from an Hours grid cell: the day editor over the
 * seeded draft sessions, its save syncing `people_hours` (cleared for a draft-only day, the approved
 * sum when real sessions were scaled), and the in-place job / time patches. Moved verbatim from
 * `People.tsx`; every prop keeps the page's name.
 */
export function PeopleHoursManualDraftEditor({
  hoursManualDraftEditor,
  setHoursManualDraftEditor,
  saveHours,
  loadAllClockSessionsRef,
  loadPeopleHoursRef,
}: PeopleHoursManualDraftEditorProps) {
  return (
    <>

      {hoursManualDraftEditor && (
        <DashboardMyTimeDayEditorModal
          dateStr={hoursManualDraftEditor.dateStr}
          sessions={hoursManualDraftEditor.draftSessions}
          subjectUserId={hoursManualDraftEditor.subjectUserId}
          subjectDisplayName={hoursManualDraftEditor.subjectDisplayName}
          jobLabels={hoursManualDraftEditor.jobLabels ?? {}}
          bidLabels={hoursManualDraftEditor.bidLabels ?? {}}
          peopleHoursGridProportionalSeed={hoursManualDraftEditor.draftSessions.some(
            (s) => !isDraftPeopleHoursSessionId(s.id),
          )}
          allowNcnsFromMyTime={false}
          onClose={() => setHoursManualDraftEditor(null)}
          onSaved={() => {
            setHoursManualDraftEditor((prev) => {
              if (prev) {
                const snap = {
                  personName: prev.personName,
                  dateStr: prev.dateStr,
                  subjectUserId: prev.subjectUserId,
                  draftSessions: prev.draftSessions,
                }
                void (async () => {
                  // Draft-only path: clear manual row so max(0, pending clock) shows new session until approve.
                  // Real sessions (e.g. proportional scale): sync people_hours to sum of approved closed sessions only;
                  // pending stays out of people_hours — getHoursGridDisplayHours uses max(ph, pending sum).
                  const hadOnlyDraft = snap.draftSessions.every((s) => isDraftPeopleHoursSessionId(s.id))
                  if (hadOnlyDraft) {
                    await saveHours(snap.personName, snap.dateStr, 0)
                  } else {
                    try {
                      const data = await withSupabaseRetry(
                        async () =>
                          supabase
                            .from('clock_sessions')
                            .select('clocked_in_at, clocked_out_at, approved_at')
                            .eq('user_id', snap.subjectUserId)
                            .eq('work_date', snap.dateStr)
                            .is('rejected_at', null)
                            .is('revoked_at', null),
                        'people hours sync after My Time manual blur save',
                      )
                      let approvedSum = 0
                      for (const row of data ?? []) {
                        const r = row as {
                          clocked_in_at: string
                          clocked_out_at: string | null
                          approved_at: string | null
                        }
                        if (!r.clocked_out_at || !r.approved_at) continue
                        const h =
                          (new Date(r.clocked_out_at).getTime() - new Date(r.clocked_in_at).getTime()) /
                          3_600_000
                        approvedSum += Math.max(0, h)
                      }
                      await saveHours(snap.personName, snap.dateStr, approvedSum)
                    } catch {
                      await saveHours(snap.personName, snap.dateStr, 0)
                    }
                  }
                  loadAllClockSessionsRef.current?.()
                  loadPeopleHoursRef.current?.()
                })()
              } else {
                loadAllClockSessionsRef.current?.()
                loadPeopleHoursRef.current?.()
              }
              return null
            })
          }}
          onLinkedSessionsUpdated={() => {
            loadAllClockSessionsRef.current?.()
            loadPeopleHoursRef.current?.()
          }}
          onPatchSeededSessionsJobBid={({ sessionId, job_ledger_id, bid_id }) => {
            setHoursManualDraftEditor((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                draftSessions: prev.draftSessions.map((s) =>
                  s.id === sessionId ? { ...s, job_ledger_id, bid_id } : s,
                ),
              }
            })
          }}
          onPatchSeededSessionsTimes={({ sessionId, clocked_in_at, clocked_out_at, work_date }) => {
            setHoursManualDraftEditor((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                draftSessions: prev.draftSessions.map((s) =>
                  s.id === sessionId ? { ...s, clocked_in_at, clocked_out_at, work_date } : s,
                ),
              }
            })
          }}
        />
      )}
    </>
  )
}
