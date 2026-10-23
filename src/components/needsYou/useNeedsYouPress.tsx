/* eslint-disable react-refresh/only-export-components -- a hook file that lazy-loads one window */
import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NeedsYouItem } from '../../lib/dashboardNeedsYou'
import { needsYouDoor, needsYouSecondaryDoor, type NeedsYouDoor, type NeedsYouDoorData } from '../../lib/needsYouDoors'
import type { NeedsYouHost } from '../../lib/needsYouSources'
import type { NeedsYouHandles } from '../../hooks/useNeedsYouInputs'
import { TALLY_STALE_MIN_AGE_DAYS } from '../../lib/tallyStaleMinAgeDays'
import { useTestReportModalOptional } from '../../contexts/TestReportModalContext'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { DashboardStaleTallyStaffFollowUpModal } from '../DashboardStaleTallyStaffFollowUpModal'
import { DashboardLienReleaseQueueModal } from '../dashboard/DashboardLienReleaseQueueModal'
import { DashboardLienWaiversToSignModal } from '../dashboard/DashboardLienWaiversToSignModal'
import { DashboardArDepositsModal } from '../dashboard/DashboardArDepositsModal'

// Today's sends (v2.5595): the window behind the Needs you line, loaded when it opens so the hosts' chunks stay as they were.
const TodaysSendsWindow = lazy(() => import('../dashboard/TodaysSendsWindow').then((m) => ({ default: m.TodaysSendsWindow })))

type Window = Extract<NeedsYouDoor, { kind: 'window' }>['window']

/**
 * One press for both Needs You hosts (v2.5771, punch list #146): `needsYouDoor` says where a
 * line goes, this hook takes it there. An `href` navigates; a `window` opens one of the five
 * windows this hook mounts over the card; a `test-report` opens the Test report modal when
 * the host sits under its provider; a `station` is handed to the host (`onStation`), which
 * expands a station on the Quickfill page or scrolls to the Teams Inbox card on the
 * Dashboard, and navigates to the door's `href` when it answers false.
 */
export function useNeedsYouPress({
  host,
  doorData,
  handles,
  renderWindows = true,
  officeEligible,
  onStation,
}: {
  host: NeedsYouHost
  doorData: NeedsYouDoorData
  handles: NeedsYouHandles
  /** False mounts no window (a host that renders twice on one page mounts them once). */
  renderWindows?: boolean
  /** The team-purchases window is the office set's. */
  officeEligible: boolean
  onStation?: (station: Extract<NeedsYouDoor, { kind: 'station' }>['station']) => boolean
}): { onAction: (item: NeedsYouItem) => void; onSecondary: (item: NeedsYouItem, key: string) => void; windows: ReactNode } {
  const navigate = useNavigate()
  const testReportModal = useTestReportModalOptional()
  const [open, setOpen] = useState<Window | null>(null)

  const onAction = useCallback(
    (item: NeedsYouItem) => {
      const door = needsYouDoor(item, doorData, host)
      if (door.kind === 'href') {
        navigate(door.href)
      } else if (door.kind === 'window') {
        setOpen(door.window)
      } else if (door.kind === 'test-report') {
        if (door.first && testReportModal) {
          const first = door.first
          void (async () => {
            const job = await fetchJobWithDetailsById(first.jobId)
            if (job) testReportModal.openTestReport({ job, reportId: first.reportId, onChanged: () => handles.reloadTestReports() })
            else navigate(door.href)
          })()
        } else {
          navigate(door.href)
        }
      } else if (door.kind === 'station') {
        if (!onStation?.(door.station)) navigate(door.href)
      }
    },
    [doorData, handles, host, navigate, onStation, testReportModal],
  )

  const onSecondary = useCallback(
    (item: NeedsYouItem, key: string) => {
      const door = needsYouSecondaryDoor(item, key)
      if (!door) return
      if (door.kind === 'href') {
        navigate(door.href)
        return
      }
      const { bulkDelete, bulkHours, claimDev, robotBacklogNudge, robotSilenceNudge } = handles
      const snooze = door.action === 'snooze'
      const nudges = {
        'bulk-delete': () => (snooze ? bulkDelete.snooze24h() : bulkDelete.dismissUntilCountIncreases()),
        'bulk-hours': () => (snooze ? bulkHours.snooze24h() : bulkHours.dismissUntilCountIncreases()),
        'claim-dev': () => (snooze ? claimDev.snooze24h() : claimDev.dismissUntilItHappensAgain()),
        'robot-backlog': () => (snooze ? robotBacklogNudge.snooze24h() : robotBacklogNudge.dismissUntilCountIncreases()),
        'robot-asleep': () => (snooze ? robotSilenceNudge.snooze24h() : robotSilenceNudge.dismissUntilNextRound()),
      } as const
      nudges[door.nudge]()
    },
    [handles, navigate],
  )

  const close = () => setOpen(null)
  const windows = renderWindows ? (
    <>
      <DashboardLienReleaseQueueModal open={open === 'lien-unconditional'} onClose={close} rows={handles.lienReleaseQueue} onChanged={handles.refetchLienReleasesOwed} />
      <DashboardLienWaiversToSignModal open={open === 'lien-waivers-to-sign'} onClose={close} rows={handles.lienWaiversToSignRows} onChanged={handles.refetchLienSignatureLanes} />
      <DashboardArDepositsModal
        open={open === 'ar-deposits'}
        onClose={() => {
          close()
          void handles.refetchArBankUnallocatedCount()
        }}
      />
      {open === 'todays-sends' ? (
        <Suspense fallback={null}>
          <TodaysSendsWindow onClose={close} onChanged={() => handles.reloadTodaysSends()} />
        </Suspense>
      ) : null}
      {officeEligible ? (
        <DashboardStaleTallyStaffFollowUpModal open={open === 'tally-team'} onClose={close} minAgeDays={TALLY_STALE_MIN_AGE_DAYS} onDataChanged={() => void handles.refetchStaleTallyStaffFollowUp()} />
      ) : null}
    </>
  ) : null

  return { onAction, onSecondary, windows }
}
