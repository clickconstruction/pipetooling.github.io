import { useCallback, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { DispatchAgingSummary } from '../../lib/dispatchInboxAging'
import { useNeedsYouInputs } from '../../hooks/useNeedsYouInputs'
import { useFillInRows, type FillInRow } from '../../hooks/useFillInRows'
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
 * named in `needsYouSources.ts`: the two stations on this page that carry a
 * line (Job follow-ups, GC weekly review) and the three sources held back.
 * Since v2.5774 the station has a third view, **Fill them in**: the deck over
 * the rows behind the lines an assistant clears with a few fields
 * (`NeedsYouFillInDeck`, `useFillInRows`). The card renders nothing when the
 * list is empty; the section's Mark button still stamps the ritual on a clean day.
 */
export function QuickfillNeedsYouSection({
  onCount,
  dispatchAged = null,
  onOpenDispatchInbox,
  onOpenPeopleHours,
  onMarkUpToDate,
}: {
  onCount?: (n: number | null) => void
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
  const { reloadLostBids, reloadVehicleRecords } = needsYou.handles
  const reloadLine = useCallback(
    (row: FillInRow) => {
      if (row.kind === 'lost-bid') reloadLostBids()
      else if (row.kind === 'vehicle') reloadVehicleRecords()
    },
    [reloadLostBids, reloadVehicleRecords],
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

  useEffect(() => {
    onCount?.(items.length)
  }, [items.length, onCount])

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
