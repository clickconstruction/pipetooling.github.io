import { useState } from 'react'
import { DashboardGroupCard } from './DashboardGroupCard'
import { DispatchInboxSection } from '../DispatchInboxSection'
import { EstimatorInboxSection } from '../EstimatorInboxSection'
import { HelpFeedbackInboxSection } from '../HelpFeedbackInboxSection'
import type { useDispatchInbox } from '../../hooks/useDispatchInbox'
import type { useEstimatorInbox } from '../../hooks/useEstimatorInbox'
import type { CreateTripChargeTarget } from '../CreateTripChargeModal'

/**
 * The Dashboard "Teams Inbox" group card (dispatch + estimator inboxes, plus
 * the dev-only help/feedback inbox in the non-assistant copy).
 *
 * Rendered at two role positions in Dashboard.tsx (assistant-like branch vs
 * everyone else) — the role gates are mutually exclusive so only one copy
 * mounts. The two positions differ only via props (duplicated-render quirk #2
 * in docs/DASHBOARD_SECTIONS_ARCHITECTURE.md):
 *
 * - `showHelpFeedback`: the non-assistant copy shows `HelpFeedbackInboxSection`
 *   for devs; the assistant copy never does.
 * - `onCreateTripCharge`: the assistant copy always allows it; the
 *   non-assistant copy passes it only for dev/master_technician.
 *
 * Both inbox engines stay in the parent (`useDispatchInbox` also feeds the
 * SectionDock gate + `DispatchDismissedItemsModal`; `useEstimatorInbox`
 * feeds the SectionDock gate) and are passed down whole. The dismissed-items
 * archive and trip-charge modals also stay in the parent (rendered once,
 * outside both branch positions) — this card only gets their openers.
 */
export function DashboardTeamsInboxCard({
  dispatchInbox,
  estimatorInbox,
  showHelpFeedback,
  onOpenDismissedArchive,
  onLinkJobPictures,
  onCreateTripCharge,
}: {
  dispatchInbox: ReturnType<typeof useDispatchInbox>
  estimatorInbox: ReturnType<typeof useEstimatorInbox>
  showHelpFeedback: boolean
  onOpenDismissedArchive: () => void
  onLinkJobPictures?: (jobId: string) => void
  onCreateTripCharge?: (args: CreateTripChargeTarget) => void
}) {
  const [dispatchRequestsOpen, setDispatchRequestsOpen] = useState(true)
  const [estimatorRequestsOpen, setEstimatorRequestsOpen] = useState(true)

  const {
    dispatchInboxEligible,
    dispatchRequests,
    dispatchRequestsLoading,
    dispatchRequestDismissingId,
    expandedDispatchRequestId,
    dispatchThreadNotesByRequestId,
    dispatchNotesLoadingRequestId,
    dispatchNoteSubmitRequestId,
    dispatchNoteDraft,
    setDispatchNoteDraft,
    toggleExpandDispatchRequest,
    submitDispatchNote,
    submitDispatchNoteAndClose,
    dismissDispatchRequest,
  } = dispatchInbox

  const {
    estimatorInboxEligible,
    estimatorRequests,
    estimatorRequestsLoading,
    estimatorRequestDismissingId,
    expandedEstimatorRequestId,
    estimatorThreadNotesByRequestId,
    estimatorNotesLoadingRequestId,
    estimatorNoteSubmitRequestId,
    estimatorNoteDraft,
    setEstimatorNoteDraft,
    toggleExpandEstimatorRequest,
    submitEstimatorNote,
    submitEstimatorNoteAndClose,
    dismissEstimatorRequest,
  } = estimatorInbox

  return (
    <DashboardGroupCard id="dash-teams-inbox" title="Teams Inbox">
      {showHelpFeedback && <HelpFeedbackInboxSection />}
      {dispatchInboxEligible && (
        <DispatchInboxSection
          sectionOpen={dispatchRequestsOpen}
          onToggleSection={() => setDispatchRequestsOpen((o) => !o)}
          requests={dispatchRequests}
          loading={dispatchRequestsLoading}
          expandedRequestId={expandedDispatchRequestId}
          onToggleExpandRequest={toggleExpandDispatchRequest}
          notesByRequestId={dispatchThreadNotesByRequestId}
          notesLoadingRequestId={dispatchNotesLoadingRequestId}
          noteSubmitRequestId={dispatchNoteSubmitRequestId}
          canAddNotes={dispatchInboxEligible}
          dispatchRequestDismissingId={dispatchRequestDismissingId}
          noteDraft={dispatchNoteDraft}
          onNoteDraftChange={setDispatchNoteDraft}
          onSubmitNote={submitDispatchNote}
          onSubmitNoteAndClose={submitDispatchNoteAndClose}
          onDismiss={dismissDispatchRequest}
          onOpenDismissedArchive={onOpenDismissedArchive}
          onLinkJobPictures={onLinkJobPictures}
          onCreateTripCharge={onCreateTripCharge}
        />
      )}
      {estimatorInboxEligible && (
        <EstimatorInboxSection
          sectionOpen={estimatorRequestsOpen}
          onToggleSection={() => setEstimatorRequestsOpen((o) => !o)}
          requests={estimatorRequests}
          loading={estimatorRequestsLoading}
          expandedRequestId={expandedEstimatorRequestId}
          onToggleExpandRequest={toggleExpandEstimatorRequest}
          notesByRequestId={estimatorThreadNotesByRequestId}
          notesLoadingRequestId={estimatorNotesLoadingRequestId}
          noteSubmitRequestId={estimatorNoteSubmitRequestId}
          canAddNotes={estimatorInboxEligible}
          estimatorRequestDismissingId={estimatorRequestDismissingId}
          noteDraft={estimatorNoteDraft}
          onNoteDraftChange={setEstimatorNoteDraft}
          onSubmitNote={submitEstimatorNote}
          onSubmitNoteAndClose={submitEstimatorNoteAndClose}
          onDismiss={dismissEstimatorRequest}
        />
      )}
    </DashboardGroupCard>
  )
}
