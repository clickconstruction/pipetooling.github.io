import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useDispatchInbox } from '../../hooks/useDispatchInbox'
import { useEstimatorInbox } from '../../hooks/useEstimatorInbox'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { DispatchInboxSection } from '../DispatchInboxSection'
import { DispatchDismissedItemsModal } from '../DispatchDismissedItemsModal'
import { EstimatorInboxSection } from '../EstimatorInboxSection'
import { HelpFeedbackInboxSection } from '../HelpFeedbackInboxSection'
import { ChecklistReviewInboxSection } from './ChecklistReviewInboxSection'
import LienSignatureInboxSection from '../jobs/LienSignatureInboxSection'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

/**
 * Checklist Review tab: one dispatch card, one estimator card (open rows first,
 * then closed), and the dev-only help-feedback card.
 * Hidden for assistant role (matches Dashboard).
 */
export function ChecklistReviewInboxes({
  hideChecklistReviewSection = false,
  onOpenRequestCount,
}: {
  /** The Review tab renders the sign-off queue in its own fold — avoid doubling it. */
  hideChecklistReviewSection?: boolean
  /** Reports open dispatch+estimator request count upward (fold badge). */
  onOpenRequestCount?: (n: number) => void
} = {}) {
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

  // The checklist review queue shows for every role that has cards to review
  // (item creators / notify-targets) even where the dispatch/estimator cards
  // below stay hidden — it renders itself only when non-empty.
  if (isAssistantLike(role)) return hideChecklistReviewSection ? null : <ChecklistReviewInboxSection />
  if (!dispatchInboxEligible && !estimatorInboxEligible && role !== 'dev')
    return hideChecklistReviewSection ? null : <ChecklistReviewInboxSection />

  const dispatchOpenRows = dispatchRequests.filter((r) => r.status === 'open')
  const dispatchClosedRows = dispatchRequests.filter((r) => r.status === 'closed')
  const dispatchRowsOrdered = [...dispatchOpenRows, ...dispatchClosedRows]

  const estimatorOpenRows = estimatorRequests.filter((r) => r.status === 'open')
  const estimatorClosedRows = estimatorRequests.filter((r) => r.status === 'closed')
  const estimatorRowsOrdered = [...estimatorOpenRows, ...estimatorClosedRows]

  const openRequestCount =
    (dispatchInboxEligible ? dispatchOpenRows.length : 0) +
    (estimatorInboxEligible ? estimatorOpenRows.length : 0)

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <OpenCountReporter count={openRequestCount} onOpenRequestCount={onOpenRequestCount} />
      <HelpFeedbackInboxSection />
      <LienSignatureInboxSection />
      {hideChecklistReviewSection ? null : <ChecklistReviewInboxSection />}
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

/** Effect-only child: reports the open dispatch+estimator count to the host fold. */
function OpenCountReporter({
  count,
  onOpenRequestCount,
}: {
  count: number
  onOpenRequestCount?: (n: number) => void
}) {
  useEffect(() => {
    onOpenRequestCount?.(count)
  }, [count, onOpenRequestCount])
  return null
}
