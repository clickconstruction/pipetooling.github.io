/**
 * Messages in the header (residential R2): what a page needs to hold a person's thread window off GC projects. The
 * contacts and their lines (`loadMessagesView`), read while the page wants them and again after each press; the
 * window's presses (`MessagesWrites`); and the two openers, each closing the thread first: ⧉ on a job opens a
 * Pipeline job in its job window and a bid in its preview over the page, and a GC project on GC projects; *Open their
 * record* opens a customer's profile over the page, and a trade partner on GC projects' Trade partners.
 *
 * GC projects keeps its own copy for now, since its openers draw its own windows (the project card, the company
 * window); it moves onto this hook in its own PR.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMessagesLive } from './useMessagesLive'
import { useNavigate } from 'react-router-dom'
import { useBidPreview } from '../../../contexts/BidPreviewModalContext'
import { useCustomerProfileModal } from '../../../contexts/CustomerProfileModalContext'
import { useJobDetailModal } from '../../../contexts/JobDetailModalContext'
import type { Contact } from '../../../lib/contacts/kernel'
import { gcProjectHref } from '../../../lib/gc/links'
import { jobRefOf } from '../../../lib/messages/load'
import {
  addContactJob,
  loadMessagesView,
  nameContact,
  removeContactJob,
  searchContactRecords,
  searchJobs,
  setDefaultJob,
  tieMessage,
  type MessagesView,
} from '../../../lib/messages/messagesIo'
import { formatErrorMessage } from '../../../utils/errorHandling'
import type { MessagesWrites } from './messagesWrites'

/** Trade partners on GC projects, where a trade partner's company window opens. */
export const GC_PARTNERS_HREF = '/gc?view=partners'

export interface MessagesHost {
  view: MessagesView | null
  problem: string | null
  nowIso: string
  writes: MessagesWrites
  /** Read the view again: the reply box and a note ask for it through `MessagesRereadContext`. */
  reread: () => void
  openJob: (jobKey: string) => void
  openRecord: (c: Contact) => void
}

export function useMessagesHost({ enabled, closeThread }: { enabled: boolean; closeThread: () => void }): MessagesHost {
  const navigate = useNavigate()
  const customerProfile = useCustomerProfileModal()
  const jobDetail = useJobDetailModal()
  const bidPreview = useBidPreview()
  const [view, setView] = useState<MessagesView | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [nowIso, setNowIso] = useState(() => new Date().toISOString())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let live = true
    const now = new Date().toISOString()
    setProblem(null)
    loadMessagesView(now)
      .then((v) => {
        if (!live) return
        setView(v)
        setNowIso(now)
      })
      .catch((e) => {
        if (live) setProblem(formatErrorMessage(e, 'The messages did not load.'))
      })
    return () => {
      live = false
    }
  }, [enabled, tick])

  const reread = useCallback(() => setTick((t) => t + 1), [])
  // v2.5572: a line the webhook wrote, a delivery, a teammate's press elsewhere: one read after the settle.
  useMessagesLive(enabled, reread)
  const writes = useMemo<MessagesWrites>(() => {
    const after = async <T,>(press: Promise<T>): Promise<T> => {
      const answer = await press
      reread()
      return answer
    }
    return {
      nameContact: (contactId, target) => after(nameContact(contactId, target)),
      tieMessage: (messageId, jobKey) => after(tieMessage(messageId, jobKey)),
      setDefaultJob: (contactId, jobKey) => after(setDefaultJob(contactId, jobKey)),
      addJob: (contactId, jobKey) => after(addContactJob(contactId, jobKey)),
      removeJob: (contactId, jobKey) => after(removeContactJob(contactId, jobKey)),
      searchRecords: searchContactRecords,
      searchJobs: (words) => searchJobs(words, new Date().toISOString()),
    }
  }, [reread])

  const openJob = useCallback(
    (key: string) => {
      const ref = jobRefOf(key)
      if (!ref) return
      closeThread()
      if (ref.kind === 'project') navigate(gcProjectHref(ref.id))
      else if (ref.kind === 'pipeline') {
        if (jobDetail) jobDetail.openJobDetail({ jobId: ref.id })
        else navigate('/jobs')
      } else if (bidPreview) bidPreview.openBidPreview(ref.id)
      else navigate(`/bids?bidId=${encodeURIComponent(ref.id)}`)
    },
    [closeThread, navigate, jobDetail, bidPreview],
  )

  const openRecord = useCallback(
    (c: Contact) => {
      closeThread()
      if (c.customerId) {
        if (customerProfile) customerProfile.openCustomerProfile(c.customerId)
        else navigate(`/customers/${encodeURIComponent(c.customerId)}`)
      } else if (c.gcCompanyId) navigate(GC_PARTNERS_HREF)
    },
    [closeThread, navigate, customerProfile],
  )

  return { view, problem, nowIso, writes, reread, openJob, openRecord }
}
