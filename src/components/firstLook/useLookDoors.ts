/**
 * Start an estimate and Book a visit for anyone on Messages (punch list #319 PR 1): the First look card's two doors,
 * and the reply box's **Start an estimate** row (PR 1b). A lead takes the lead's doors, which make them a customer
 * first (`useLeadDoors`). A customer skips the convert: the estimate is opened on them and Add Job is filled from
 * them. Anyone else is refused in the lead doors' own words.
 */
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useOptionalToastContext } from '../../contexts/ToastContext'
import { useOptionalAuth } from '../../hooks/useAuth'
import type { Contact } from '../../lib/contacts/kernel'
import { pressProblem } from '../../lib/followUp/followUpIo'
import { jobPrefillFrom, LEAD_DOOR_WORDS, leadFacts } from '../../lib/messages/leadDoors'
import { defaultLeadDoorsIo, type LeadDoorsIo } from '../../lib/messages/leadDoorsIo'
import { useMessagesReread } from '../gc/messages/useMessagesReread'
import { useThreadWindow } from '../gc/messages/useThreadWindow'
import { useLeadDoors } from '../messages/useLeadDoors'

export interface LookDoors {
  /** A customer or a lead: the two doors are theirs. */
  has: boolean
  book: (words: string | null) => Promise<void>
  startEstimate: (words: string | null) => Promise<void>
  pressing: boolean
}

export function useLookDoors(contact: Contact, io?: LeadDoorsIo): LookDoors {
  const lead = useLeadDoors(io)
  const auth = useOptionalAuth()
  const toasts = useOptionalToastContext()
  const jobForm = useJobFormModal()
  const navigate = useNavigate()
  const reread = useMessagesReread()
  const { closeThread } = useThreadWindow()
  const [busy, setBusy] = useState(false)
  const isCustomer = contact.kind === 'customer' && Boolean(contact.customerId)
  const userId = auth?.user?.id ?? null
  const role = auth?.role ?? null

  const book = useCallback(
    async (words: string | null) => {
      if (!isCustomer) return lead.book({ contactId: contact.id, contact, words })
      if (jobForm) jobForm.openNewJob({ prefillCustomer: jobPrefillFrom(leadFacts(contact, words)), onSaved: reread })
      else toasts?.showToast(LEAD_DOOR_WORDS.noJobForm, 'info')
    },
    [isCustomer, lead, contact, jobForm, reread, toasts],
  )

  const startEstimate = useCallback(
    async (words: string | null) => {
      if (!isCustomer || !contact.customerId) return lead.startEstimate({ contactId: contact.id, contact, words })
      setBusy(true)
      try {
        if (!userId) throw new Error(LEAD_DOOR_WORDS.noSignIn)
        const { estimateNumber } = await (io ?? defaultLeadDoorsIo()).startEstimate(contact.customerId, { userId, role })
        closeThread()
        navigate(`/estimates/${estimateNumber}`, { state: { freshEstimateDraft: true } })
      } catch (e) {
        toasts?.showToast(pressProblem(e), 'error')
      } finally {
        setBusy(false)
      }
    },
    [isCustomer, contact, lead, userId, role, io, closeThread, navigate, toasts],
  )

  return useMemo(() => ({ has: isCustomer || contact.kind === 'lead', book, startEstimate, pressing: busy || lead.pressing !== null }), [isCustomer, contact.kind, book, startEstimate, busy, lead.pressing])
}
