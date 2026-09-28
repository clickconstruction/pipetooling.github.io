import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import type { UserRole } from './useAuth'
import type { JobWithDetails } from '../types/jobWithDetails'
import { fetchJobWithDetailsById } from '../lib/fetchJobWithDetailsById'
import { notifyDispatchRequestsChanged } from '../lib/dispatchRequestHelpers'
import { notifyDispatchRequestClosure } from '../lib/dispatchRequestClosure'
import { JOB_DISPATCH_AUTO_CLOSE_NOTES, pickJobDispatchAutoCloses, type JobDispatchAutoCloseAction } from '../lib/jobDispatchAutoClose'
import { BID_OUTCOME_DERIVED_TOAST_MS, bidOutcomeDerivedMessage, shouldAnnounceDerivedOutcome } from '../lib/bids/bidOutcomeFromJob'
import {
  buildBillingSliceJson,
  buildEditJobIdentityUpdatePayload,
  buildIdentitySliceJson,
  buildMaterialsSliceJson,
  buildTeamSliceJson,
  identitySliceReadyToSave,
  type JobIdentityFormFields,
} from '../lib/jobs/jobFormAutosaveSlices'
import { autosaveFailureWords, writeBillingSlice, writeMaterialsSlice, writeTeamSlice } from '../lib/jobs/jobFormSliceWrites'
import { discountSnapshot, type DiscountSnapshotEntry } from '../lib/jobs/discountActivity'
import { fixtureRowsFromDb } from '../lib/jobs/jobFormFixtureHydrate'
import type { JobFormDevelopmentRow } from '../lib/jobs/jobDevelopments'
import type { FixtureRow, MaterialRow, PaymentRow } from '../lib/jobs/jobFormTypes'
import { useJobFormAutosaveSlice, type JobFormAutosaveSlice } from '../components/jobs/useJobFormAutosaveSlice'

type CustomerRow = Database['public']['Tables']['customers']['Row']

/** What reading a bid for the "outcome moved" toast answers. */
export type BidOutcomeRead = { outcome: unknown; bid_number: string | null; project_name: string | null }

export type JobFormAutosaveEngineArgs = {
  editing: JobWithDetails | null
  setEditing: Dispatch<SetStateAction<JobWithDetails | null>>
  authUser: { id: string } | null | undefined
  authRole: UserRole | null
  fixtures: FixtureRow[]
  setFixtures: Dispatch<SetStateAction<FixtureRow[]>>
  payments: PaymentRow[]
  riderFeesDollars: number
  materials: MaterialRow[]
  teamMemberIds: string[]
  /** Every identity field as the form holds it on this render. */
  identityFields: JobIdentityFormFields
  projects: ReadonlyArray<{ id: string; master_user_id: string }>
  customers: CustomerRow[]
  developments: JobFormDevelopmentRow[]
  onSavedRef: MutableRefObject<(() => void) | null | undefined>
}

export type JobFormAutosaveEngine = {
  billingMoneySliceJson: string
  identitySliceJson: string
  materialsSliceJson: string
  teamSliceJson: string
  /** The form's rows as of the latest render — what a save writes, whenever it runs. */
  autosaveFixturesRef: MutableRefObject<FixtureRow[]>
  autosavePaymentsRef: MutableRefObject<PaymentRow[]>
  autosaveRiderFeesRef: MutableRefObject<number>
  autosaveMaterialsRef: MutableRefObject<MaterialRow[]>
  autosaveTeamIdsRef: MutableRefObject<string[]>
  identityFieldsRef: MutableRefObject<JobIdentityFormFields>
  /** What the form last knew to be saved. Hydration sets these; each save moves them on. */
  hydratedPaymentIdsRef: MutableRefObject<string[]>
  persistedDiscountSnapshotRef: MutableRefObject<DiscountSnapshotEntry[]>
  persistedPicturesLinkRef: MutableRefObject<string>
  persistedCustomerPhoneRef: MutableRefObject<string>
  persistedBidIdRef: MutableRefObject<string>
  billingAutosave: JobFormAutosaveSlice
  billingAutosaveStatus: JobFormAutosaveSlice['status']
  flushBillingAutosave: JobFormAutosaveSlice['flush']
  identityAutosave: JobFormAutosaveSlice
  /** Every edit-mode autosave slice, in close-flush order. */
  editAutosaveSlices: JobFormAutosaveSlice[]
  flushAllAutosaveSlicesRef: MutableRefObject<() => Promise<void>>
  rehydrateFixturesFromDb: (jobId: string) => Promise<void>
  readBidOutcomeForToast: (id: string) => Promise<BidOutcomeRead | null>
  announceDerivedBidOutcome: (before: BidOutcomeRead | null, after: BidOutcomeRead | null) => void
}

/**
 * The job form's save engine, out of `JobFormModal` whole (the Job form map's order #9): the
 * four edit-mode autosave slices — billing, identity, materials, team, registered in that order
 * — each with the mirror refs its writer reads, the record of what was last saved, and the
 * writer itself. The writers and registrations are the form's own text; the write sequences are
 * `jobFormSliceWrites`. The form keeps every field and hands them in on each render; hydration,
 * undo and the close guard stay the form's and reach the engine through what it hands back.
 */
export function useJobFormAutosaveEngine(args: JobFormAutosaveEngineArgs): JobFormAutosaveEngine {
  const { editing, setEditing, authUser, authRole, fixtures, setFixtures, payments, riderFeesDollars, materials, teamMemberIds, identityFields, projects, customers, developments, onSavedRef } = args
  const { showToast } = useToastContext()

  const billingMoneySliceJson = useMemo(() => buildBillingSliceJson(fixtures, payments), [fixtures, payments])
  const autosaveFixturesRef = useRef(fixtures)
  autosaveFixturesRef.current = fixtures
  const autosavePaymentsRef = useRef(payments)
  autosavePaymentsRef.current = payments
  /**
   * B5: ids of the payment rows this form last knew to be persisted —
   * hydration ids on load/refresh, then each successful billing-slice
   * persist's upsert ids. Drives diffPaymentRows so the slice deletes only
   * rows the form owns; rows born mid-edit (e.g. a Stripe webhook payment)
   * are invisible to the diff and survive autosaves. Deliberately NOT reset
   * by Undo — it tracks DB reality, not form state.
   */
  const hydratedPaymentIdsRef = useRef<string[]>([])
  const autosaveRiderFeesRef = useRef(riderFeesDollars)
  autosaveRiderFeesRef.current = riderFeesDollars
  const autosaveJobIdRef = useRef<string | null>(null)
  autosaveJobIdRef.current = editing?.id ?? null
  /**
   * Discount trail (v2.3256): the discount rows as last PERSISTED (hydration,
   * then each successful billing-slice write). After a write, the diff
   * against the new rows logs discount_added / _changed / _removed through
   * `log_job_discount_event` — one event per real change, never per
   * keystroke. Best-effort: a failed log never fails the save.
   */
  const persistedDiscountSnapshotRef = useRef<DiscountSnapshotEntry[]>([])

  /**
   * The billing-slice WRITES — the same delete+reinsert sequence as always
   * (payloads now built by the jobFormAutosaveSlices kernel). Baseline,
   * debounce, and in-flight bookkeeping live in useJobFormAutosaveSlice.
   */
  async function persistBillingSlice(): Promise<boolean> {
    const jobId = autosaveJobIdRef.current
    if (!jobId) return true
    try {
      await writeBillingSlice(supabase, {
        jobId,
        fixtures: autosaveFixturesRef.current,
        payments: autosavePaymentsRef.current,
        riderFeesDollars: autosaveRiderFeesRef.current,
        hydratedPaymentIds: hydratedPaymentIdsRef.current,
        persistedDiscounts: persistedDiscountSnapshotRef.current,
        onPaymentsWritten: (ids) => {
          hydratedPaymentIdsRef.current = ids
        },
        onDiscountsWritten: (saved) => {
          persistedDiscountSnapshotRef.current = saved
        },
      })
      return true
    } catch (autosaveErr) {
      showToast(autosaveFailureWords(autosaveErr), 'error')
      return false
    }
  }

  const billingAutosave = useJobFormAutosaveSlice({
    jobId: editing?.id ?? null,
    sliceJson: billingMoneySliceJson,
    save: persistBillingSlice,
    onSaved: () => onSavedRef.current?.(),
  })
  const billingAutosaveStatus = billingAutosave.status
  const flushBillingAutosave = billingAutosave.flush
  /**
   * Discount tools (v2.3268): Bill Customer wrote a discount row straight to
   * the DB (apply_job_discount) while this form is open. Re-read the rows so
   * the next delete+reinsert keeps them, and re-baseline the billing slice on
   * the render that carries the new rows — otherwise the autosave would fire
   * on state that already matches the DB.
   */
  const [rebaselineBillingNonce, setRebaselineBillingNonce] = useState(0)
  useEffect(() => {
    if (rebaselineBillingNonce === 0) return
    billingAutosave.markSavedNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the nonce is the trigger; the hook reads the latest slice JSON from its ref
  }, [rebaselineBillingNonce])
  const rehydrateFixturesFromDb = useCallback(async (jobId: string) => {
    const found = await fetchJobWithDetailsById(jobId)
    if (!found) return
    setEditing(found)
    const rows = fixtureRowsFromDb(found.fixtures)
    setFixtures(rows.length > 0 ? rows : [{ id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '', invoice_id: null }])
    persistedDiscountSnapshotRef.current = discountSnapshot(rows)
    setRebaselineBillingNonce((n) => n + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the dependency list it had in the form; both setters are stable
  }, [setFixtures])

  // ---- Identity / materials / team autosave slices (v2.1079) ---------------

  const identityFieldsRef = useRef(identityFields)
  identityFieldsRef.current = identityFields
  const identitySliceJson = buildIdentitySliceJson(identityFields)
  const projectsRef = useRef(projects)
  projectsRef.current = projects
  const customersRef = useRef(customers)
  customersRef.current = customers
  const developmentsRef = useRef(developments)
  developmentsRef.current = developments
  const editingMasterUserIdRef = useRef<string | null>(null)
  editingMasterUserIdRef.current = editing?.master_user_id ?? null
  /** Last PERSISTED pictures link — drives the blank→set dispatch auto-close. */
  const persistedPicturesLinkRef = useRef('')
  /** Last saved customer phone — a blank→set transition auto-closes the job's red-phone request. */
  const persistedCustomerPhoneRef = useRef('')
  /** v2.3069: the bid the row last carried — a changed link is when the trigger moves the bid, and when we tell the person. */
  const persistedBidIdRef = useRef('')

  /**
   * Retire this job's open dispatch request of one kind (`link_job_pictures` /
   * `add_job_phone`) after the matching field went blank→set, then tell each
   * requester (v2.2880, journey-map #25). RLS lets only devs / dispatch members
   * update the rows, so for anyone else the update quietly matches nothing —
   * `.select()` tells us which rows actually closed, and only those notify.
   */
  async function autoCloseJobDispatchRequests(jobId: string, action: JobDispatchAutoCloseAction): Promise<void> {
    if (!authUser?.id) return
    const closedNote = JOB_DISPATCH_AUTO_CLOSE_NOTES[action]
    try {
      const closedRows = await withSupabaseRetry<Array<{ id: string; from_user_id: string; title: string }>>(
        async () =>
          supabase
            .from('dispatch_requests')
            .update({
              status: 'closed',
              closed_at: new Date().toISOString(),
              closed_by_user_id: authUser.id,
              closed_note: closedNote,
            })
            .eq('job_ledger_id', jobId)
            .eq('pending_action', action)
            .eq('status', 'open')
            .select('id, from_user_id, title'),
        `auto-close ${action} dispatch requests`,
      )
      notifyDispatchRequestsChanged()
      for (const row of closedRows ?? []) {
        void notifyDispatchRequestClosure({
          request: row,
          note: closedNote,
          mode: 'closed',
          userId: authUser.id,
          role: authRole,
        })
      }
    } catch (closeErr) {
      console.warn('auto-close dispatch_requests failed', closeErr)
    }
  }

  /**
   * v2.3069: the DB trigger `jobs_ledger_bid_outcome_from_job` marks a bid Started or
   * complete the moment a job carries its id. The owner asked that the person be told:
   * read the bid before and after our own write, toast only when the outcome moved.
   */
  async function readBidOutcomeForToast(id: string): Promise<BidOutcomeRead | null> {
    const { data } = await supabase.from('bids').select('outcome, bid_number, project_name').eq('id', id).maybeSingle()
    return (data as BidOutcomeRead | null) ?? null
  }
  function announceDerivedBidOutcome(before: BidOutcomeRead | null, after: BidOutcomeRead | null): void {
    if (!shouldAnnounceDerivedOutcome(before?.outcome, after?.outcome)) return
    showToast(bidOutcomeDerivedMessage({ bidNumber: after?.bid_number, projectName: after?.project_name, before: before?.outcome }), 'success', BID_OUTCOME_DERIVED_TOAST_MS)
  }

  async function persistIdentitySlice(): Promise<boolean> {
    const jobId = autosaveJobIdRef.current
    const existingMaster = editingMasterUserIdRef.current
    if (!jobId || !existingMaster) return true
    const fields = identityFieldsRef.current
    try {
      const proj = fields.projectId ? projectsRef.current.find((p) => p.id === fields.projectId) : null
      const payload = buildEditJobIdentityUpdatePayload({
        fields,
        existingJobMasterUserId: existingMaster,
        projectMasterUserId: proj?.master_user_id ?? null,
        customers: customersRef.current,
        developments: developmentsRef.current,
      })
      const nextBidId = fields.bidId.trim()
      const bidLinkChanged = nextBidId !== persistedBidIdRef.current
      const bidBefore = bidLinkChanged && nextBidId ? await readBidOutcomeForToast(nextBidId) : null
      const { error: updErr } = await supabase.from('jobs_ledger').update(payload).eq('id', jobId)
      if (updErr) throw updErr
      if (bidLinkChanged) {
        persistedBidIdRef.current = nextBidId
        if (nextBidId) announceDerivedBidOutcome(bidBefore, await readBidOutcomeForToast(nextBidId))
      }
      const newPicturesLink = fields.jobPicturesLink.trim()
      const newPhone = fields.customerPhone.trim()
      const autoCloses = pickJobDispatchAutoCloses({
        prevPicturesLink: persistedPicturesLinkRef.current,
        nextPicturesLink: newPicturesLink,
        prevPhone: persistedCustomerPhoneRef.current,
        nextPhone: newPhone,
      })
      for (const action of autoCloses) {
        await autoCloseJobDispatchRequests(jobId, action)
      }
      persistedPicturesLinkRef.current = newPicturesLink
      persistedCustomerPhoneRef.current = newPhone
      return true
    } catch (identityErr) {
      showToast(autosaveFailureWords(identityErr), 'error')
      return false
    }
  }

  const identityAutosave = useJobFormAutosaveSlice({
    jobId: editing?.id ?? null,
    sliceJson: identitySliceJson,
    save: persistIdentitySlice,
    enabled: identitySliceReadyToSave(identityFields),
    onSaved: () => onSavedRef.current?.(),
  })

  // Materials: same delete+reinsert shape as the billing slice.
  const materialsSliceJson = buildMaterialsSliceJson(materials)
  const autosaveMaterialsRef = useRef(materials)
  autosaveMaterialsRef.current = materials

  async function persistMaterialsSlice(): Promise<boolean> {
    const jobId = autosaveJobIdRef.current
    if (!jobId) return true
    try {
      await writeMaterialsSlice(supabase, { jobId, materials: autosaveMaterialsRef.current })
      return true
    } catch (matErr) {
      showToast(autosaveFailureWords(matErr), 'error')
      return false
    }
  }

  const materialsAutosave = useJobFormAutosaveSlice({
    jobId: editing?.id ?? null,
    sliceJson: materialsSliceJson,
    save: persistMaterialsSlice,
    onSaved: () => onSavedRef.current?.(),
  })

  const teamSliceJson = buildTeamSliceJson(teamMemberIds)
  const autosaveTeamIdsRef = useRef(teamMemberIds)
  autosaveTeamIdsRef.current = teamMemberIds

  async function persistTeamSlice(): Promise<boolean> {
    const jobId = autosaveJobIdRef.current
    if (!jobId) return true
    try {
      await writeTeamSlice(supabase, { jobId, teamMemberIds: autosaveTeamIdsRef.current })
      return true
    } catch (teamErr) {
      showToast(autosaveFailureWords(teamErr), 'error')
      return false
    }
  }

  const teamAutosave = useJobFormAutosaveSlice({
    jobId: editing?.id ?? null,
    sliceJson: teamSliceJson,
    save: persistTeamSlice,
    debounceMs: 400,
    onSaved: () => onSavedRef.current?.(),
  })

  /** Every edit-mode autosave slice, in close-flush order. */
  const editAutosaveSlices = [billingAutosave, identityAutosave, materialsAutosave, teamAutosave]

  /** Flush every dirty enabled slice (visibility handler, best-effort). */
  async function flushAllAutosaveSlices(): Promise<void> {
    for (const slice of editAutosaveSlices) await slice.flush()
  }
  const flushAllAutosaveSlicesRef = useRef(flushAllAutosaveSlices)
  flushAllAutosaveSlicesRef.current = flushAllAutosaveSlices

  return {
    billingMoneySliceJson,
    identitySliceJson,
    materialsSliceJson,
    teamSliceJson,
    autosaveFixturesRef,
    autosavePaymentsRef,
    autosaveRiderFeesRef,
    autosaveMaterialsRef,
    autosaveTeamIdsRef,
    identityFieldsRef,
    hydratedPaymentIdsRef,
    persistedDiscountSnapshotRef,
    persistedPicturesLinkRef,
    persistedCustomerPhoneRef,
    persistedBidIdRef,
    billingAutosave,
    billingAutosaveStatus,
    flushBillingAutosave,
    identityAutosave,
    editAutosaveSlices,
    flushAllAutosaveSlicesRef,
    rehydrateFixturesFromDb,
    readBidOutcomeForToast,
    announceDerivedBidOutcome,
  }
}
