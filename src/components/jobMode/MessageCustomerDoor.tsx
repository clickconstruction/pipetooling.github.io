/**
 * Messages, residential R5: **Message the customer** on Job Mode's card, the door to the sheet
 * (`MessageCustomerSheet`). It reads the job's customer once, so the door carries an orange dot when they answered and
 * nobody has written back. The card shows it only through `jobModeMessagesOffered` (`lib/messages/jobBox.ts`).
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { replyWaiting, SHEET_WORDS } from '../../lib/jobModeMessageCustomer'
import { supabaseJobModeMessageIo, type JobModeCustomer, type JobModeMessageIo } from '../../lib/jobModeMessageCustomerIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { MessageCustomerSheet } from './MessageCustomerSheet'

export interface MessageCustomerDoorProps {
  jobId: string
  jobName: string | null
  jobAddress: string | null
  userId: string
  /** The signed-in tech's name. */
  me: string | null
  /** The card's quiet door look, so it sits beside Write up a change. */
  style?: CSSProperties
  /** After a text or a note went, so the card's Job updates reads it without a reload. */
  onDone?: () => void
  /** For a smoke. */
  io?: JobModeMessageIo
  today?: string
}

const dot: CSSProperties = { display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: 'var(--border-orange)' }

export function MessageCustomerDoor({ jobId, jobName, jobAddress, userId, me, style, onDone, io: ioProp, today }: MessageCustomerDoorProps) {
  const io = useMemo(() => ioProp ?? supabaseJobModeMessageIo(), [ioProp])
  const [read, setRead] = useState<{ jobId: string; customer: JobModeCustomer | null; problem: string | null } | null>(null)
  const [open, setOpen] = useState(false)
  const [again, setAgain] = useState(0)

  useEffect(() => {
    let live = true
    io.loadCustomer(jobId).then(
      (customer) => live && setRead({ jobId, customer, problem: null }),
      (e: unknown) => live && setRead({ jobId, customer: null, problem: formatErrorMessage(e, 'Their messages could not be read.') }),
    )
    return () => {
      live = false
    }
  }, [io, jobId, again])

  const got = read && read.jobId === jobId ? read : null
  const waiting = got?.customer ? replyWaiting(got.customer.tail) : false

  return (
    <>
      <button
        type="button"
        style={style}
        aria-label={waiting ? SHEET_WORDS.doorWaiting : SHEET_WORDS.door}
        title={got?.problem ?? undefined}
        disabled={!got?.customer}
        onClick={() => setOpen(true)}
        data-testid="job-mode-message-door"
      >
        <span aria-hidden>💬</span>
        {SHEET_WORDS.door}
        {waiting ? <span style={dot} aria-hidden data-testid="job-mode-message-dot" /> : null}
      </button>
      {open && got?.customer ? (
        <MessageCustomerSheet
          jobId={jobId}
          jobName={jobName}
          jobAddress={jobAddress}
          userId={userId}
          me={me}
          customer={got.customer}
          io={io}
          today={today}
          onDone={() => {
            setAgain((n) => n + 1)
            onDone?.()
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
