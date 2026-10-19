/**
 * Messages, residential R2 PR 2: a text or an email to the job's customer, from the job's window (the **Text** and
 * **Email** pills of the panel's kinds row, `JobThreadNotesPanel`'s `customerBox`). It opens the customer's own thread
 * (`contact_for_customer`, made when there is none) and draws cut 3's reply box (`ReplyBox`) tied to the job, offering
 * only the kind the row chose, in the customer's orange. Everything after is the box's: the quick replies, the count,
 * the send window, `messages-email` for an email, and the text's wait while Send texts is off. A send asks the
 * job's window to read its activity again (`onSent`).
 */
import { useEffect, useState } from 'react'
import type { Contact } from '../../lib/contacts/kernel'
import { loadNewestBillLink } from '../../lib/billing/billLinkIo'
import { jobBoxJobKey, NO_CUSTOMER_WORDS } from '../../lib/messages/jobBox'
import { loadCustomerContact } from '../../lib/messages/messagesIo'
import type { ReplyIo } from '../../lib/messages/replyIo'
import type { QuickRepliesIo } from '../../lib/quickReplies/quickRepliesIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ReplyBox } from '../gc/messages/reply/ReplyBox'
import { MessagesRereadContext } from '../gc/messages/useMessagesReread'

export interface JobCustomerBoxProps {
  kind: 'text' | 'email'
  jobId: string
  jobName: string
  /** The job's customer. Null: the job has none yet. */
  customerId: string | null
  /** After a text, an email or a note to them goes: the job's window reads its activity again. */
  onSent?: () => void
  /** For a smoke: the customer's contact, the box's sends and its quick replies, and the job's newest bill's pay page. */
  load?: (customerId: string) => Promise<Contact>
  loadBill?: (jobId: string) => Promise<string | null>
  io?: ReplyIo
  quickIo?: QuickRepliesIo
}

const quiet = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 } as const

export function JobCustomerBox({ kind, jobId, jobName, customerId, onSent, load = loadCustomerContact, loadBill = loadNewestBillLink, io, quickIo }: JobCustomerBoxProps) {
  const [read, setRead] = useState<{ customerId: string; contact: Contact | null; problem: string | null } | null>(null)
  // `{bill}` (v2.5628): the job's newest billed bill's pay page, read once; a read that fails leaves the blank for the person.
  const [billLink, setBillLink] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    loadBill(jobId).then(
      (link) => live && setBillLink(link),
      () => live && setBillLink(null),
    )
    return () => {
      live = false
    }
  }, [jobId, loadBill])

  useEffect(() => {
    if (!customerId) return
    let live = true
    load(customerId).then(
      (contact) => live && setRead({ customerId, contact, problem: null }),
      (e: unknown) => live && setRead({ customerId, contact: null, problem: formatErrorMessage(e, 'Their messages could not be opened.') }),
    )
    return () => {
      live = false
    }
  }, [customerId, load])

  if (!customerId)
    return (
      <p role="status" data-job-box-no-customer style={quiet}>
        {NO_CUSTOMER_WORDS}
      </p>
    )
  const got = read && read.customerId === customerId ? read : null
  if (!got) return <p style={quiet}>Opening their messages…</p>
  if (!got.contact)
    return (
      <p role="alert" style={{ ...quiet, color: 'var(--text-red-700)' }}>
        {got.problem ?? 'Their messages could not be opened.'}
      </p>
    )
  return (
    <MessagesRereadContext.Provider value={onSent ?? (() => {})}>
      <ReplyBox contact={got.contact} io={io} quickIo={quickIo} job={{ key: jobBoxJobKey(jobId), name: jobName }} billLink={billLink} kinds={[kind]} />
    </MessagesRereadContext.Provider>
  )
}
