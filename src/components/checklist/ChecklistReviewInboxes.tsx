import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useDispatchInbox } from '../../hooks/useDispatchInbox'
import { useEstimatorInbox } from '../../hooks/useEstimatorInbox'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { DispatchInboxSection } from '../DispatchInboxSection'
import { DispatchDismissedItemsModal } from '../DispatchDismissedItemsModal'
import { EstimatorInboxSection } from '../EstimatorInboxSection'

/**
 * Checklist Review tab: one dispatch card and one estimator card (open rows first, then closed).
 * Hidden for assistant role (matches Dashboard).
 */
export function ChecklistReviewInboxes() {
  const { role } = useAuth()
  const [dispatchSectionOpen, setDispatchSectionOpen] = useState(true)
  const [estimatorSectionOpen, setEstimatorSectionOpen] = useState(true)
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

  const jobFormModal = useJobFormModal()

  if (role === 'assistant') return null
  if (!dispatchInboxEligible && !estimatorInboxEligible) return null

  const dispatchOpenRows = dispatchRequests.filter((r) => r.status === 'open')
  const dispatchClosedRows = dispatchRequests.filter((r) => r.status === 'closed')
  const dispatchRowsOrdered = [...dispatchOpenRows, ...dispatchClosedRows]

  const estimatorOpenRows = estimatorRequests.filter((r) => r.status === 'open')
  const estimatorClosedRows = estimatorRequests.filter((r) => r.status === 'closed')
  const estimatorRowsOrdered = [...estimatorOpenRows, ...estimatorClosedRows]

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {dispatchInboxEligible ? (
        <DispatchInboxSection
          variant="card"
          headerBadge="open"
          sectionOpen={dispatchSectionOpen}
          onToggleSection={() => setDispatchSectionOpen((o) => !o)}
          requests={dispatchRowsOrdered}
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
          onLinkJobPictures={
            jobFormModal
              ? (jobId) => jobFormModal.openEditJob(jobId, { jobPicturesLinkHighlight: true })
              : undefined
          }
        />
      ) : null}

      {estimatorInboxEligible ? (
        <EstimatorInboxSection
          headerBadge="open"
          sectionOpen={estimatorSectionOpen}
          onToggleSection={() => setEstimatorSectionOpen((o) => !o)}
          requests={estimatorRowsOrdered}
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
