import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useDispatchInbox } from '../../hooks/useDispatchInbox'
import { useEstimatorInbox } from '../../hooks/useEstimatorInbox'
import { DispatchInboxSection } from '../DispatchInboxSection'
import { DispatchDismissedItemsModal } from '../DispatchDismissedItemsModal'
import { EstimatorInboxSection } from '../EstimatorInboxSection'

/**
 * Checklist Review tab: dispatch open / dispatch closed, estimator open / estimator closed — same behavior as Dashboard inboxes.
 * Hidden for assistant role (matches Dashboard).
 */
export function ChecklistReviewInboxes() {
  const { role } = useAuth()
  const [dispatchOpenSectionOpen, setDispatchOpenSectionOpen] = useState(true)
  const [dispatchClosedSectionOpen, setDispatchClosedSectionOpen] = useState(false)
  const [estimatorOpenSectionOpen, setEstimatorOpenSectionOpen] = useState(true)
  const [estimatorClosedSectionOpen, setEstimatorClosedSectionOpen] = useState(false)
  const [dispatchDismissedModalOpen, setDispatchDismissedModalOpen] = useState(false)

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
    fetchDismissedDispatchInboxRows,
  } = useDispatchInbox()

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
  } = useEstimatorInbox()

  if (role === 'assistant') return null
  if (!dispatchInboxEligible && !estimatorInboxEligible) return null

  const dispatchOpenRows = dispatchRequests.filter((r) => r.status === 'open')
  const dispatchClosedRows = dispatchRequests.filter((r) => r.status === 'closed')
  const estimatorOpenRows = estimatorRequests.filter((r) => r.status === 'open')
  const estimatorClosedRows = estimatorRequests.filter((r) => r.status === 'closed')

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {dispatchInboxEligible ? (
        <>
          <DispatchInboxSection
            variant="card"
            headerBadge="open"
            sectionOpen={dispatchOpenSectionOpen}
            onToggleSection={() => setDispatchOpenSectionOpen((o) => !o)}
            requests={dispatchOpenRows}
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
            onOpenDismissedArchive={() => setDispatchDismissedModalOpen(true)}
          />
          <DispatchInboxSection
            variant="card"
            sectionTitle="Dispatch closed items"
            headerBadge="closed"
            sectionOpen={dispatchClosedSectionOpen}
            onToggleSection={() => setDispatchClosedSectionOpen((o) => !o)}
            requests={dispatchClosedRows}
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
          />
        </>
      ) : null}

      {estimatorInboxEligible ? (
        <>
          <EstimatorInboxSection
            headerBadge="open"
            sectionOpen={estimatorOpenSectionOpen}
            onToggleSection={() => setEstimatorOpenSectionOpen((o) => !o)}
            requests={estimatorOpenRows}
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
          <EstimatorInboxSection
            sectionTitle="Estimator closed items"
            headerBadge="closed"
            sectionOpen={estimatorClosedSectionOpen}
            onToggleSection={() => setEstimatorClosedSectionOpen((o) => !o)}
            requests={estimatorClosedRows}
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
        </>
      ) : null}

      {dispatchInboxEligible ? (
        <DispatchDismissedItemsModal
          open={dispatchDismissedModalOpen}
          onClose={() => setDispatchDismissedModalOpen(false)}
          loadRows={fetchDismissedDispatchInboxRows}
        />
      ) : null}
    </div>
  )
}
