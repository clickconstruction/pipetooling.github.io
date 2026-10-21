/**
 * Punch list #140 PR 8: the presses behind a lead's two doors, shared by the thread's slot (`useLeadDoorThreadSlots`)
 * and Follow up's Needs a reply row (`FollowUpPanel`). Each makes the customer from the lead and re-points the thread
 * (`leadDoorsIo.convert`), says so, asks the page to read again, then opens Add Job filled in or a new estimate on
 * them. Every provider is optional, so the hook draws nothing wrong outside the app: no Add Job provider says where
 * to book them instead.
 */
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOptionalToastContext } from '../../contexts/ToastContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useOptionalAuth } from '../../hooks/useAuth'
import type { Contact } from '../../lib/contacts/kernel'
import { pressProblem } from '../../lib/followUp/followUpIo'
import { jobPrefillFrom, LEAD_DOOR_WORDS, leadFacts, leadFirstName, leadHasName, type LeadFacts } from '../../lib/messages/leadDoors'
import { supabaseLeadDoorsIo, type LeadDoorsIo } from '../../lib/messages/leadDoorsIo'
import { loadContact } from '../../lib/messages/messagesIo'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { useMessagesReread } from '../gc/messages/useMessagesReread'
import { useThreadWindow } from '../gc/messages/useThreadWindow'

const DEFAULT_IO = supabaseLeadDoorsIo()

/** Who the door is for: the contact when the caller has it, else read by id; and their newest words. */
export interface LeadDoorTarget {
  contactId: string
  contact?: Pick<Contact, 'id' | 'name' | 'channels'> | null
  words: string | null
}

export interface LeadDoors {
  book: (target: LeadDoorTarget) => Promise<void>
  startEstimate: (target: LeadDoorTarget) => Promise<void>
  /** `book <id>` or `estimate <id>` while a press runs. */
  pressing: string | null
}

export function useLeadDoors(io: LeadDoorsIo = DEFAULT_IO, read: (contactId: string) => Promise<Pick<Contact, 'id' | 'name' | 'channels'> | null> = loadContact): LeadDoors {
  const auth = useOptionalAuth()
  const toasts = useOptionalToastContext()
  const reread = useMessagesReread()
  const jobForm = useJobFormModal()
  const navigate = useNavigate()
  const { closeThread } = useThreadWindow()
  const [pressing, setPressing] = useState<string | null>(null)
  const userId = auth?.user?.id ?? null
  const role = auth?.role ?? null

  const say = useCallback((words: string, tone: 'success' | 'error' | 'info') => toasts?.showToast(words, tone), [toasts])

  /** The customer made from the lead, the thread with them, and the page read again. */
  const convert = useCallback(
    async (target: LeadDoorTarget): Promise<{ customerId: string; facts: LeadFacts }> => {
      if (!userId) throw new Error(LEAD_DOOR_WORDS.noSignIn)
      const contact = target.contact ?? (await read(target.contactId))
      if (!contact) throw new Error(LEAD_DOOR_WORDS.gone)
      const facts = leadFacts(contact, target.words)
      if (!leadHasName(facts)) throw new Error(LEAD_DOOR_WORDS.noName)
      const { customerId } = await io.convert(target.contactId, facts, { userId }, todayYmdInAppTz())
      say(LEAD_DOOR_WORDS.converted(leadFirstName(facts)), 'success')
      reread()
      return { customerId, facts }
    },
    [userId, read, io, say, reread],
  )

  const book = useCallback(
    async (target: LeadDoorTarget) => {
      setPressing(`book ${target.contactId}`)
      try {
        const { facts } = await convert(target)
        if (jobForm) jobForm.openNewJob({ prefillCustomer: jobPrefillFrom(facts), onSaved: reread })
        else say(LEAD_DOOR_WORDS.noJobForm, 'info')
      } catch (e) {
        say(pressProblem(e), 'error')
      } finally {
        setPressing(null)
      }
    },
    [convert, jobForm, reread, say],
  )

  const startEstimate = useCallback(
    async (target: LeadDoorTarget) => {
      setPressing(`estimate ${target.contactId}`)
      try {
        const { customerId } = await convert(target)
        const { estimateNumber } = await io.startEstimate(customerId, { userId: userId ?? '', role })
        closeThread()
        navigate(`/estimates/${estimateNumber}`, { state: { freshEstimateDraft: true } })
      } catch (e) {
        say(pressProblem(e), 'error')
      } finally {
        setPressing(null)
      }
    },
    [convert, io, userId, role, closeThread, navigate, say],
  )

  return useMemo(() => ({ book, startEstimate, pressing }), [book, startEstimate, pressing])
}
