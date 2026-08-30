import { useCallback, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { toDatetimeLocal } from '../../utils/datetimeLocal'
import { parseItbLinks } from '../itbLinks'

export type BidEditOutcomeOption = 'won' | 'lost' | 'started_or_complete' | ''

/** The bid-edit form's editable data fields (parent-owned bidDateSent/attestation are excluded). */
import { isBidLossCategoryKey, type BidLossCategoryKey } from '../bidLossCategories'

export type BidEditFormValues = {
  driveLink: string
  plansLink: string
  countToolingPlansLink: string
  bidSubmissionLink: string
  /** ITB / submission web links (PlanHub, BuildingConnected, …), one URL per row. */
  itbLinks: string[]
  projectName: string
  /** Linked `projects.id` ('' = not linked). Distinct from the free-text projectName. */
  projectId: string
  bidNumber: string
  address: string
  gcContactName: string
  gcContactPhone: string
  gcContactEmail: string
  projectContactExpanded: boolean
  estimatorId: string
  accountManagerId: string
  formServiceTypeId: string
  bidDueDate: string
  /** Optional 'HH:MM' time-of-day the bid is due; empty when unset. */
  bidDueTime: string
  estimatedJobStartDate: string
  designDrawingPlanDate: string
  submittedTo: string
  outcome: BidEditOutcomeOption
  lossReason: string
  /** Structured six-bucket loss reason (bids.loss_category); lossReason stays the free-text note. */
  lossCategory: BidLossCategoryKey | null
  bidValue: string
  agreedValue: string
  profit: string
  distanceFromOffice: string
  lastContact: string
  notes: string
  gcCustomerId: string
  gcCustomerSearch: string
}

export type BidEditFormSetters = {
  setDriveLink: Dispatch<SetStateAction<string>>
  setPlansLink: Dispatch<SetStateAction<string>>
  setCountToolingPlansLink: Dispatch<SetStateAction<string>>
  setBidSubmissionLink: Dispatch<SetStateAction<string>>
  setItbLinks: Dispatch<SetStateAction<string[]>>
  setProjectName: Dispatch<SetStateAction<string>>
  setProjectId: Dispatch<SetStateAction<string>>
  setBidNumber: Dispatch<SetStateAction<string>>
  setAddress: Dispatch<SetStateAction<string>>
  setGcContactName: Dispatch<SetStateAction<string>>
  setGcContactPhone: Dispatch<SetStateAction<string>>
  setGcContactEmail: Dispatch<SetStateAction<string>>
  setProjectContactExpanded: Dispatch<SetStateAction<boolean>>
  setEstimatorId: Dispatch<SetStateAction<string>>
  setAccountManagerId: Dispatch<SetStateAction<string>>
  setFormServiceTypeId: Dispatch<SetStateAction<string>>
  setBidDueDate: Dispatch<SetStateAction<string>>
  setBidDueTime: Dispatch<SetStateAction<string>>
  setEstimatedJobStartDate: Dispatch<SetStateAction<string>>
  setDesignDrawingPlanDate: Dispatch<SetStateAction<string>>
  setSubmittedTo: Dispatch<SetStateAction<string>>
  setOutcome: Dispatch<SetStateAction<BidEditOutcomeOption>>
  setLossReason: Dispatch<SetStateAction<string>>
  setLossCategory: Dispatch<SetStateAction<BidLossCategoryKey | null>>
  setBidValue: Dispatch<SetStateAction<string>>
  setAgreedValue: Dispatch<SetStateAction<string>>
  setProfit: Dispatch<SetStateAction<string>>
  setDistanceFromOffice: Dispatch<SetStateAction<string>>
  setLastContact: Dispatch<SetStateAction<string>>
  setNotes: Dispatch<SetStateAction<string>>
  setGcCustomerId: Dispatch<SetStateAction<string>>
  setGcCustomerSearch: Dispatch<SetStateAction<string>>
}

export type BidEditFormResetOptions = {
  /** Service type to seed the form with (current tab selection). */
  serviceTypeId: string
  /** Default account manager (typically the current user). */
  accountManagerId: string
  /** When opening a new bid prefilled from a customer. */
  customer?: { id: string; address: string | null; display: string } | null
  /** When opening a new bid pre-linked to a project (Projects card "+ Bid"): links project_id and seeds the free-text name. */
  project?: { id: string; name: string | null } | null
}

export type BidEditFormLoadOptions = {
  /** Resolved GC/Builder customer id (empty when sourced from a gc_builder). */
  gcCustomerId: string
  /** Resolved GC/Builder display string for the search input. */
  gcCustomerSearch: string
  /** Service type to fall back to when the bid has none. */
  fallbackServiceTypeId: string
}

export type BidEditForm = {
  values: BidEditFormValues
  setters: BidEditFormSetters
  /** Reset all fields for a brand-new bid (optionally prefilled from a customer). */
  reset: (opts: BidEditFormResetOptions) => void
  /** Populate all fields from an existing bid being edited. */
  loadFromBid: (bid: BidWithBuilder, opts: BidEditFormLoadOptions) => void
  /**
   * Values snapshot from the last loadFromBid (null after reset). Save paths diff
   * against it so untouched fields stay OUT of the update payload — an untouched
   * Save must not clobber columns written server-side after the row was fetched.
   */
  initialValues: BidEditFormValues | null
  missingFields: string[]
  canSubmit: boolean
}

/** Pure mapping from a bid row (+resolved GC display) to the form's field values. */
export function bidRowToFormValues(bid: BidWithBuilder, opts: BidEditFormLoadOptions): BidEditFormValues {
  const savedLossCategory = (bid as { loss_category?: string | null }).loss_category ?? null
  return {
    driveLink: bid.drive_link ?? '',
    plansLink: bid.plans_link ?? '',
    countToolingPlansLink: bid.count_tooling_plans_link ?? '',
    bidSubmissionLink: bid.bid_submission_link ?? '',
    itbLinks: parseItbLinks((bid as { itb_links?: unknown }).itb_links),
    gcCustomerId: opts.gcCustomerId,
    gcCustomerSearch: opts.gcCustomerSearch,
    projectName: bid.project_name ?? '',
    projectId: (bid as { project_id?: string | null }).project_id ?? '',
    bidNumber: (bid as { bid_number?: string | null }).bid_number ?? '',
    address: bid.address ?? '',
    gcContactName: bid.gc_contact_name ?? '',
    gcContactPhone: bid.gc_contact_phone ?? '',
    gcContactEmail: bid.gc_contact_email ?? '',
    projectContactExpanded: true,
    estimatorId: bid.estimator_id ?? '',
    accountManagerId: (bid as { account_manager_id?: string | null }).account_manager_id ?? '',
    formServiceTypeId: (bid as { service_type_id?: string | null }).service_type_id ?? opts.fallbackServiceTypeId,
    bidDueDate: bid.bid_due_date ?? '',
    // Postgres `time` comes back as 'HH:MM:SS'; the <input type="time"> wants 'HH:MM'.
    bidDueTime: (((bid as { bid_due_time?: string | null }).bid_due_time ?? '')).slice(0, 5),
    estimatedJobStartDate: bid.estimated_job_start_date ?? '',
    designDrawingPlanDate: bid.design_drawing_plan_date ?? '',
    submittedTo: (bid as { submitted_to?: string | null }).submitted_to ?? '',
    outcome: (bid.outcome ?? '') as BidEditOutcomeOption,
    lossReason: (bid as { loss_reason?: string | null }).loss_reason ?? '',
    lossCategory: isBidLossCategoryKey(savedLossCategory) ? savedLossCategory : null,
    bidValue: bid.bid_value != null ? String(bid.bid_value) : '',
    agreedValue: bid.agreed_value != null ? String(bid.agreed_value) : '',
    profit: bid.profit != null ? String(bid.profit) : '',
    distanceFromOffice: bid.distance_from_office ?? '',
    lastContact: toDatetimeLocal(bid.last_contact),
    notes: bid.notes ?? '',
  }
}

/**
 * Owns the bid-edit form's editable data fields, keeping the ~30 useState
 * declarations and the open/reset cascades out of the Bids page component.
 *
 * Note: `bidDateSent` and the attestation flow stay in the parent because they
 * are coupled to a separate modal and persistence logic.
 */
export function useBidEditForm(): BidEditForm {
  const [driveLink, setDriveLink] = useState('')
  const [plansLink, setPlansLink] = useState('')
  const [countToolingPlansLink, setCountToolingPlansLink] = useState('')
  const [bidSubmissionLink, setBidSubmissionLink] = useState('')
  const [itbLinks, setItbLinks] = useState<string[]>([])
  const [projectName, setProjectName] = useState('')
  const [projectId, setProjectId] = useState('')
  const [bidNumber, setBidNumber] = useState('')
  const [address, setAddress] = useState('')
  const [gcContactName, setGcContactName] = useState('')
  const [gcContactPhone, setGcContactPhone] = useState('')
  const [gcContactEmail, setGcContactEmail] = useState('')
  const [projectContactExpanded, setProjectContactExpanded] = useState(true)
  const [estimatorId, setEstimatorId] = useState('')
  const [accountManagerId, setAccountManagerId] = useState('')
  const [formServiceTypeId, setFormServiceTypeId] = useState('')
  const [bidDueDate, setBidDueDate] = useState('')
  const [bidDueTime, setBidDueTime] = useState('')
  const [estimatedJobStartDate, setEstimatedJobStartDate] = useState('')
  const [designDrawingPlanDate, setDesignDrawingPlanDate] = useState('')
  const [submittedTo, setSubmittedTo] = useState('')
  const [outcome, setOutcome] = useState<BidEditOutcomeOption>('')
  const [lossReason, setLossReason] = useState('')
  const [lossCategory, setLossCategory] = useState<BidLossCategoryKey | null>(null)
  const [bidValue, setBidValue] = useState('')
  const [agreedValue, setAgreedValue] = useState('')
  const [profit, setProfit] = useState('')
  const [distanceFromOffice, setDistanceFromOffice] = useState('')
  const [lastContact, setLastContact] = useState('')
  const [notes, setNotes] = useState('')
  const [gcCustomerId, setGcCustomerId] = useState('')
  const [gcCustomerSearch, setGcCustomerSearch] = useState('')
  const [initialValues, setInitialValues] = useState<BidEditFormValues | null>(null)

  const reset = useCallback((opts: BidEditFormResetOptions) => {
    setInitialValues(null)
    setDriveLink('')
    setPlansLink('')
    setCountToolingPlansLink('')
    setBidSubmissionLink('')
    setItbLinks([])
    setDesignDrawingPlanDate('')
    setGcCustomerId(opts.customer?.id ?? '')
    setGcCustomerSearch(opts.customer?.display ?? '')
    setProjectName(opts.project?.name?.trim() ?? '')
    setProjectId(opts.project?.id ?? '')
    setBidNumber('')
    setAddress(opts.customer?.address ?? '')
    setGcContactName('')
    setGcContactPhone('')
    setGcContactEmail('')
    setEstimatorId('')
    setAccountManagerId(opts.accountManagerId)
    setBidDueDate('')
    setBidDueTime('')
    setEstimatedJobStartDate('')
    setSubmittedTo('')
    setOutcome('')
    setLossReason('')
    setLossCategory(null)
    setBidValue('')
    setAgreedValue('')
    setProfit('')
    setDistanceFromOffice('')
    setLastContact('')
    setNotes('')
    setFormServiceTypeId(opts.serviceTypeId)
    setProjectContactExpanded(true)
  }, [])

  const loadFromBid = useCallback((bid: BidWithBuilder, opts: BidEditFormLoadOptions) => {
    const v = bidRowToFormValues(bid, opts)
    setDriveLink(v.driveLink)
    setPlansLink(v.plansLink)
    setCountToolingPlansLink(v.countToolingPlansLink)
    setBidSubmissionLink(v.bidSubmissionLink)
    setItbLinks(v.itbLinks)
    setGcCustomerId(v.gcCustomerId)
    setGcCustomerSearch(v.gcCustomerSearch)
    setProjectName(v.projectName)
    setProjectId(v.projectId)
    setBidNumber(v.bidNumber)
    setAddress(v.address)
    setGcContactName(v.gcContactName)
    setGcContactPhone(v.gcContactPhone)
    setGcContactEmail(v.gcContactEmail)
    setEstimatorId(v.estimatorId)
    setAccountManagerId(v.accountManagerId)
    setBidDueDate(v.bidDueDate)
    setBidDueTime(v.bidDueTime)
    setEstimatedJobStartDate(v.estimatedJobStartDate)
    setDesignDrawingPlanDate(v.designDrawingPlanDate)
    setSubmittedTo(v.submittedTo)
    setOutcome(v.outcome)
    setLossReason(v.lossReason)
    setLossCategory(v.lossCategory)
    setBidValue(v.bidValue)
    setAgreedValue(v.agreedValue)
    setProfit(v.profit)
    setDistanceFromOffice(v.distanceFromOffice)
    setLastContact(v.lastContact)
    setNotes(v.notes)
    setFormServiceTypeId(v.formServiceTypeId)
    setProjectContactExpanded(v.projectContactExpanded)
    setInitialValues(v)
  }, [])

  const missingFields = useMemo(() => {
    const missing: string[] = []
    if (!projectName.trim()) missing.push('Project Name')
    if (!formServiceTypeId.trim()) missing.push('Service Type')
    return missing
  }, [projectName, formServiceTypeId])
  const canSubmit = missingFields.length === 0

  const values: BidEditFormValues = {
    driveLink,
    plansLink,
    countToolingPlansLink,
    bidSubmissionLink,
    itbLinks,
    projectName,
    projectId,
    bidNumber,
    address,
    gcContactName,
    gcContactPhone,
    gcContactEmail,
    projectContactExpanded,
    estimatorId,
    accountManagerId,
    formServiceTypeId,
    bidDueDate,
    bidDueTime,
    estimatedJobStartDate,
    designDrawingPlanDate,
    submittedTo,
    outcome,
    lossReason,
    lossCategory,
    bidValue,
    agreedValue,
    profit,
    distanceFromOffice,
    lastContact,
    notes,
    gcCustomerId,
    gcCustomerSearch,
  }

  const setters: BidEditFormSetters = {
    setDriveLink,
    setPlansLink,
    setCountToolingPlansLink,
    setBidSubmissionLink,
    setItbLinks,
    setProjectName,
    setProjectId,
    setBidNumber,
    setAddress,
    setGcContactName,
    setGcContactPhone,
    setGcContactEmail,
    setProjectContactExpanded,
    setEstimatorId,
    setAccountManagerId,
    setFormServiceTypeId,
    setBidDueDate,
    setBidDueTime,
    setEstimatedJobStartDate,
    setDesignDrawingPlanDate,
    setSubmittedTo,
    setOutcome,
    setLossReason,
    setLossCategory,
    setBidValue,
    setAgreedValue,
    setProfit,
    setDistanceFromOffice,
    setLastContact,
    setNotes,
    setGcCustomerId,
    setGcCustomerSearch,
  }

  return { values, setters, reset, loadFromBid, initialValues, missingFields, canSubmit }
}
