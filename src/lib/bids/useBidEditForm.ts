import { useCallback, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { toDatetimeLocal } from '../../utils/datetimeLocal'

export type BidEditOutcomeOption = 'won' | 'lost' | 'started_or_complete' | ''

/** The bid-edit form's editable data fields (parent-owned bidDateSent/attestation are excluded). */
export type BidEditFormValues = {
  driveLink: string
  plansLink: string
  countToolingLink: string
  countToolingPlansLink: string
  bidSubmissionLink: string
  projectName: string
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
  estimatedJobStartDate: string
  designDrawingPlanDate: string
  planPages: string
  submittedTo: string
  outcome: BidEditOutcomeOption
  lossReason: string
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
  setCountToolingLink: Dispatch<SetStateAction<string>>
  setCountToolingPlansLink: Dispatch<SetStateAction<string>>
  setBidSubmissionLink: Dispatch<SetStateAction<string>>
  setProjectName: Dispatch<SetStateAction<string>>
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
  setEstimatedJobStartDate: Dispatch<SetStateAction<string>>
  setDesignDrawingPlanDate: Dispatch<SetStateAction<string>>
  setPlanPages: Dispatch<SetStateAction<string>>
  setSubmittedTo: Dispatch<SetStateAction<string>>
  setOutcome: Dispatch<SetStateAction<BidEditOutcomeOption>>
  setLossReason: Dispatch<SetStateAction<string>>
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
  missingFields: string[]
  canSubmit: boolean
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
  const [countToolingLink, setCountToolingLink] = useState('')
  const [countToolingPlansLink, setCountToolingPlansLink] = useState('')
  const [bidSubmissionLink, setBidSubmissionLink] = useState('')
  const [projectName, setProjectName] = useState('')
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
  const [estimatedJobStartDate, setEstimatedJobStartDate] = useState('')
  const [designDrawingPlanDate, setDesignDrawingPlanDate] = useState('')
  const [planPages, setPlanPages] = useState('')
  const [submittedTo, setSubmittedTo] = useState('')
  const [outcome, setOutcome] = useState<BidEditOutcomeOption>('')
  const [lossReason, setLossReason] = useState('')
  const [bidValue, setBidValue] = useState('')
  const [agreedValue, setAgreedValue] = useState('')
  const [profit, setProfit] = useState('')
  const [distanceFromOffice, setDistanceFromOffice] = useState('')
  const [lastContact, setLastContact] = useState('')
  const [notes, setNotes] = useState('')
  const [gcCustomerId, setGcCustomerId] = useState('')
  const [gcCustomerSearch, setGcCustomerSearch] = useState('')

  const reset = useCallback((opts: BidEditFormResetOptions) => {
    setDriveLink('')
    setPlansLink('')
    setCountToolingLink('')
    setCountToolingPlansLink('')
    setBidSubmissionLink('')
    setDesignDrawingPlanDate('')
    setPlanPages('')
    setGcCustomerId(opts.customer?.id ?? '')
    setGcCustomerSearch(opts.customer?.display ?? '')
    setProjectName('')
    setBidNumber('')
    setAddress(opts.customer?.address ?? '')
    setGcContactName('')
    setGcContactPhone('')
    setGcContactEmail('')
    setEstimatorId('')
    setAccountManagerId(opts.accountManagerId)
    setBidDueDate('')
    setEstimatedJobStartDate('')
    setSubmittedTo('')
    setOutcome('')
    setLossReason('')
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
    setDriveLink(bid.drive_link ?? '')
    setPlansLink(bid.plans_link ?? '')
    setCountToolingLink(bid.count_tooling_link ?? '')
    setCountToolingPlansLink(bid.count_tooling_plans_link ?? '')
    setBidSubmissionLink(bid.bid_submission_link ?? '')
    setGcCustomerId(opts.gcCustomerId)
    setGcCustomerSearch(opts.gcCustomerSearch)
    setProjectName(bid.project_name ?? '')
    setBidNumber((bid as { bid_number?: string | null }).bid_number ?? '')
    setAddress(bid.address ?? '')
    setGcContactName(bid.gc_contact_name ?? '')
    setGcContactPhone(bid.gc_contact_phone ?? '')
    setGcContactEmail(bid.gc_contact_email ?? '')
    setEstimatorId(bid.estimator_id ?? '')
    setAccountManagerId((bid as { account_manager_id?: string | null }).account_manager_id ?? '')
    setBidDueDate(bid.bid_due_date ?? '')
    setEstimatedJobStartDate(bid.estimated_job_start_date ?? '')
    setDesignDrawingPlanDate(bid.design_drawing_plan_date ?? '')
    setPlanPages(bid.plan_pages ?? '')
    setSubmittedTo((bid as { submitted_to?: string | null }).submitted_to ?? '')
    setOutcome((bid.outcome ?? '') as BidEditOutcomeOption)
    setLossReason((bid as { loss_reason?: string | null }).loss_reason ?? '')
    setBidValue(bid.bid_value != null ? String(bid.bid_value) : '')
    setAgreedValue(bid.agreed_value != null ? String(bid.agreed_value) : '')
    setProfit(bid.profit != null ? String(bid.profit) : '')
    setDistanceFromOffice(bid.distance_from_office ?? '')
    setLastContact(toDatetimeLocal(bid.last_contact))
    setNotes(bid.notes ?? '')
    setFormServiceTypeId((bid as { service_type_id?: string | null }).service_type_id ?? opts.fallbackServiceTypeId)
    setProjectContactExpanded(true)
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
    countToolingLink,
    countToolingPlansLink,
    bidSubmissionLink,
    projectName,
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
    estimatedJobStartDate,
    designDrawingPlanDate,
    planPages,
    submittedTo,
    outcome,
    lossReason,
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
    setCountToolingLink,
    setCountToolingPlansLink,
    setBidSubmissionLink,
    setProjectName,
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
    setEstimatedJobStartDate,
    setDesignDrawingPlanDate,
    setPlanPages,
    setSubmittedTo,
    setOutcome,
    setLossReason,
    setBidValue,
    setAgreedValue,
    setProfit,
    setDistanceFromOffice,
    setLastContact,
    setNotes,
    setGcCustomerId,
    setGcCustomerSearch,
  }

  return { values, setters, reset, loadFromBid, missingFields, canSubmit }
}
