import { useCallback, useEffect, useMemo } from 'react'
import { groupNeedsYouItems } from '../../lib/needsYouActor'
import { todaysLinesNextLine } from '../../lib/quickfill/nextLine'
import { useAuth } from '../../hooks/useAuth'
import type { DispatchAgingSummary } from '../../lib/dispatchInboxAging'
import { useNeedsYouInputs } from '../../hooks/useNeedsYouInputs'
import { useFillInRows, type FillInRow } from '../../hooks/useFillInRows'
import { needsYouStationOpening } from '../../lib/needsYou/fillIn'
import { useNeedsYouPress } from '../needsYou/useNeedsYouPress'
import { NeedsYouFillInDeck } from '../needsYou/NeedsYouFillInDeck'
import { DashboardNeedsYouCard } from '../dashboard/DashboardNeedsYouCard'

/**
 * Quickfill's "Needs you" station (v2.2350): the SAME card the Dashboard
 * renders (Cards / Walk-the-list, per-user toggle, `needs-you` telemetry —
 * from_path distinguishes the surface), fed by the same hooks and the same
 * pure item builder. Since v2.5771 (punch list #146) the hooks and the doors
 * are shared too — `useNeedsYouInputs` reads every source `needsYouSourceGates`
 * allows this host, and `useNeedsYouPress` takes each line where the Dashboard
 * takes it — so the station cannot fall behind the card again. What differs is
 * named in `needsYouSources.ts`: the stations on this page that carry a line
 * (Job follow-ups for the quiet jobs and, since v2.6093, the idle ones; GC weekly
 * review; People Hours and the Dispatch inbox since v2.5841) and the three
 * sources held back.
 * Since v2.5774 the station has a third view, **Fill them in**: the deck over
 * the rows behind the lines an assistant clears with a few fields
 * (`NeedsYouFillInDeck`, `useFillInRows`). Since v2.5907 (punch list #178, D's
 * PR 1) the deck is the station's body for the viewer whose lines its rows are,
 * the assistant: `needsYouStationOpening` opens the card on the deck whenever
 * it holds her rows or is still reading them, her other lines sit under it, and
 * the station's Next line is the deck's first row. The owner and the controller
 * open on their own lines with the deck one chip away, as before. The card
 * renders nothing when the list is empty; the section's Mark button still
 * stamps the ritual on a clean day.
 */
export function QuickfillNeedsYouSection({
  onCount,
  onNextLine,
  dispatchAged = null,
  onOpenDispatchInbox,
  onOpenPeopleHours,
  onMarkUpToDate,
}: {
  onCount?: (n: number | null) => void
  /** The station's Next line (v2.5868, punch list #176): the first of the viewer's own lines. */
  onNextLine?: (line: string | null) => void
  /** Open dispatch requests past the min age (journey-map #40), summarised by the page from its inbox rows. */
  dispatchAged?: DispatchAgingSummary | null
  /** Expands + scrolls to this page's Dispatch inbox station. */
  onOpenDispatchInbox?: () => void
  /** Expands + scrolls to this page's People Hours station, where the clock sessions are approved (punch list #146). */
  onOpenPeopleHours?: () => void
  /** The station's Mark, offered at the end of the Fill them in deck (v2.5774). */
  onMarkUpToDate?: () => void
}) {
  const { user: authUser, role } = useAuth()
  const needsYou = useNeedsYouInputs({
    authUserId: authUser?.id,
    role,
    host: 'quickfill',
    dispatchAged,
    dispatchAgedEnabled: onOpenDispatchInbox != null,
  })
  const { items } = needsYou
  // The rows the Fill them in deck can clear (v2.5774): read under the lines' own gates.
  const fillIn = useFillInRows(role, Boolean(authUser?.id))
  // A save or an Undo on the deck re-reads the line the row sits behind, so the count follows.
  const { reloadLostBids, reloadVehicleRecords, reloadJobAccountGaps, refetchTallyUnlinkedCounts, reloadSupplyMoveWindow } = needsYou.handles
  const reloadLine = useCallback(
    (row: FillInRow) => {
      if (row.kind === 'lost-bid') reloadLostBids()
      else if (row.kind === 'vehicle') reloadVehicleRecords()
      else if (row.kind === 'job-account') reloadJobAccountGaps()
      else if (row.kind === 'purchase') refetchTallyUnlinkedCounts()
      else if (row.kind === 'move-window') {
        reloadSupplyMoveWindow()
        // Not needed is the job-account sheet's row, which the job-accounts line reads too.
        reloadJobAccountGaps()
      }
      // A contract's io dispatches `job-contract-changed`, which the line's hook already listens for.
    },
    [reloadLostBids, reloadVehicleRecords, reloadJobAccountGaps, refetchTallyUnlinkedCounts, reloadSupplyMoveWindow],
  )
  const onRowSaved = useCallback(
    (row: FillInRow) => {
      fillIn.drop(row.key)
      reloadLine(row)
    },
    [fillIn, reloadLine],
  )
  const onRowRestored = useCallback(
    (row: FillInRow) => {
      fillIn.restore(row)
      reloadLine(row)
    },
    [fillIn, reloadLine],
  )
  const press = useNeedsYouPress({
    host: 'quickfill',
    doorData: needsYou.doorData,
    handles: needsYou.handles,
    officeEligible: needsYou.officeEligible,
    onStation: (station) => {
      if (station === 'dispatch-inbox' && onOpenDispatchInbox) {
        onOpenDispatchInbox()
        return true
      }
      if (station === 'people-hours-new' && onOpenPeopleHours) {
        onOpenPeopleHours()
        return true
      }
      return false
    },
  })

  // The station counts the viewer's own lines (v2.5868, punch list #176): the owner's calls sit folded under it and are
  // not hers to press, so counting them kept Done dark on a day her lines were clear.
  const yours = useMemo(() => groupNeedsYouItems(items, role).yours, [items, role])
  // The deck as the body (v2.5907): while it holds the viewer's own rows, or is still reading them, the station opens
  // on it and the first press of the morning is its first row. The owner's and the controller's open on their lines.
  const opening = needsYouStationOpening({ rows: fillIn.rows, loading: fillIn.loading, role })
  const nextLine = todaysLinesNextLine(yours, opening === 'deck' ? (fillIn.rows[0] ?? null) : null)
  useEffect(() => {
    onCount?.(yours.length)
  }, [yours.length, onCount])
  useEffect(() => {
    onNextLine?.(nextLine)
  }, [nextLine, onNextLine])

  return (
    <>
      <DashboardNeedsYouCard
        userId={authUser?.id}
        role={role}
        items={items}
        onAction={press.onAction}
        onSecondary={press.onSecondary}
        fillIn={{
          rowCount: fillIn.rows.length,
          opensFirst: opening === 'deck',
          render: ({ startKind, onExit }) => (
            <NeedsYouFillInDeck
              rows={fillIn.rows}
              loading={fillIn.loading}
              userId={authUser?.id}
              role={role}
              startKind={startKind}
              onRowSaved={onRowSaved}
              onRowRestored={onRowRestored}
              onExit={onExit}
              onMarkUpToDate={onMarkUpToDate}
            />
          ),
        }}
      />
      {press.windows}
    </>
  )
}
