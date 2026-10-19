/**
 * The customer's door on the Pipeline (v2.5626, punch list #123): the sheet the speech bubble beside a customer's name
 * opens over the board, so the office writes to a job's customer without opening the job's window or leaving the page.
 * It names the job and the customer, says whose word came last on the job, and offers Call, Text, Email, Open their
 * thread and Their record. Text and Email draw the job window's own box (`JobCustomerBox`) in place of the rows, in the
 * customer's orange, tied to the job; a send asks the board to read the job again. The bubble is the office team's
 * already, so the sheet gates nothing itself.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomerProfileModal } from '../../contexts/CustomerProfileModalContext'
import { useToastContext } from '../../contexts/ToastContext'
import type { Contact } from '../../lib/contacts/kernel'
import type { JobActivityMessage } from '../../lib/jobs/jobActivityMessages'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { customerDoorRows, lastWordOnJob, lastWordWords, type CustomerDoorRow } from '../../lib/messages/customerDoor'
import { messagesThreadHref } from '../../lib/messages/customerThread'
import { contactForCustomer, loadJobMessages } from '../../lib/messages/messagesIo'
import type { ReplyIo } from '../../lib/messages/replyIo'
import { telHrefFor } from '../../lib/phoneContact'
import type { QuickRepliesIo } from '../../lib/quickReplies/quickRepliesIo'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { formatErrorMessage } from '../../utils/errorHandling'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { JobCustomerBox } from './JobCustomerBox'

export type JobCustomerSheetJob = Pick<
  JobWithDetails,
  'id' | 'job_name' | 'hcp_number' | 'click_number' | 'status' | 'created_at' | 'customer_id' | 'customer_name' | 'customer_phone' | 'customer_email'
>

export interface JobCustomerSheetProps {
  job: JobCustomerSheetJob
  onClose: () => void
  /** Their record: the customer's profile window. Absent, the page's own window is used, and with none the row is not offered. */
  onOpenRecord?: (customerId: string) => void
  /** After a text or an email goes: the board reads the job again, so its activity line shows it. */
  onSent?: () => void
  nowIso?: string
  /** For a smoke: the job's lines, the customer's contact, the box's sends and its quick replies, and the thread's opener. */
  loadLines?: (job: { id: string; status: string | null; createdAt: string | null }) => Promise<JobActivityMessage[]>
  load?: (customerId: string) => Promise<Contact>
  io?: ReplyIo
  quickIo?: QuickRepliesIo
  openThread?: (customerId: string) => Promise<void>
}

type Kind = 'text' | 'email'

const rowStyle = (enabled: boolean) =>
  ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.1rem',
    width: '100%',
    minHeight: 44,
    padding: '0.6rem 0.75rem',
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--surface)',
    color: enabled ? 'var(--text-base)' : 'var(--text-muted)',
    font: 'inherit',
    fontWeight: 600,
    textAlign: 'left',
    cursor: enabled ? 'pointer' : 'default',
    textDecoration: 'none',
  }) as const

const quiet = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 } as const

export function JobCustomerSheet({ job, onClose, onOpenRecord, onSent, nowIso, loadLines = loadJobMessages, load, io, quickIo, openThread }: JobCustomerSheetProps) {
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const customerProfile = useCustomerProfileModal()
  const openRecord = onOpenRecord ?? customerProfile?.openCustomerProfile
  const [kind, setKind] = useState<Kind | null>(null)
  const [lines, setLines] = useState<JobActivityMessage[] | null>(null)
  const [busy, setBusy] = useState(false)

  const customerId = job.customer_id ?? null
  const name = (job.customer_name ?? '').trim() || 'The customer'
  const phone = (job.customer_phone ?? '').trim()
  const email = (job.customer_email ?? '').trim()
  const number = (effectiveJobLedgerNumber(job.hcp_number, job.click_number) ?? '').trim()
  const jobName = (job.job_name ?? '').trim() || 'Job'
  const jobLine = number ? `#${number} · ${jobName}` : jobName
  const rows = customerDoorRows({ phone, email, canOpenRecord: Boolean(openRecord && customerId) })

  useEffect(() => {
    let live = true
    loadLines({ id: job.id, status: job.status ?? null, createdAt: job.created_at ?? null }).then(
      (got) => live && setLines(got),
      // Whose word came last is a courtesy line: a read that fails leaves it off and says nothing.
      () => live && setLines([]),
    )
    return () => {
      live = false
    }
  }, [job.id, job.status, job.created_at, loadLines])

  const lastWord = lines ? lastWordWords(lastWordOnJob(lines), nowIso ?? new Date().toISOString()) : null

  const goToThread = async () => {
    if (!customerId || busy) return
    setBusy(true)
    try {
      if (openThread) await openThread(customerId)
      else {
        const contactId = await contactForCustomer(customerId)
        onClose()
        navigate(messagesThreadHref(contactId))
      }
    } catch (err) {
      showToast(formatErrorMessage(err, 'Their messages did not open.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const press = (row: CustomerDoorRow) => {
    if (!row.enabled) return
    if (row.kind === 'text' || row.kind === 'email') setKind(row.kind)
    else if (row.kind === 'thread') void goToThread()
    else if (row.kind === 'record' && customerId && openRecord) {
      onClose()
      openRecord(customerId)
    }
  }

  const kindPill = (k: Kind, label: string, enabled: boolean) => (
    <button
      key={k}
      type="button"
      role="radio"
      aria-checked={kind === k}
      disabled={!enabled}
      onClick={() => setKind(k)}
      style={{
        padding: '0.25rem 0.75rem',
        borderRadius: 999,
        border: `1px solid ${kind === k ? 'var(--border-orange)' : 'var(--border)'}`,
        background: kind === k ? 'var(--bg-orange-tint)' : 'var(--surface)',
        color: !enabled ? 'var(--text-muted)' : kind === k ? 'var(--text-orange-700)' : 'var(--text-base)',
        font: 'inherit',
        fontSize: '0.8125rem',
        fontWeight: 600,
        cursor: enabled ? 'pointer' : 'default',
      }}
    >
      {label}
    </button>
  )

  return (
    <ResponsiveModalShell title={name} onRequestClose={onClose} maxWidthDesktop={480}>
      <div data-customer-door={job.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.25rem 0 0.5rem' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{jobLine}</div>
          <p style={quiet}>{[phone, email].filter(Boolean).join(' · ') || 'No number or email on file.'}</p>
          {lastWord ? (
            <p style={{ ...quiet, color: lastWord.startsWith('Waiting') ? 'var(--text-orange-700)' : quiet.color }} data-customer-door-last>
              {lastWord}
            </p>
          ) : null}
        </div>

        {kind == null ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }} role="list" aria-label={`Reach ${name}`}>
            {rows.map((row) => (
              <div key={row.kind} role="listitem" data-customer-door-row={row.kind}>
                {row.kind === 'call' && row.enabled ? (
                  <a href={telHrefFor(phone)} style={rowStyle(true)}>
                    <span>{row.label}</span>
                    <span style={{ fontWeight: 400, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{phone}</span>
                  </a>
                ) : (
                  <button type="button" onClick={() => press(row)} aria-disabled={!row.enabled} disabled={row.kind === 'thread' && busy} style={rowStyle(row.enabled)}>
                    <span>{row.label}</span>
                    {row.why ? <span style={{ fontWeight: 400, fontSize: '0.8125rem' }}>{row.why}</span> : null}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} role="radiogroup" aria-label="Write as">
              {kindPill('text', 'Text', phone !== '')}
              {kindPill('email', 'Email', email !== '')}
              <button
                type="button"
                onClick={() => setKind(null)}
                style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer', padding: '0.25rem' }}
              >
                ‹ Back
              </button>
            </div>
            <JobCustomerBox kind={kind} jobId={job.id} jobName={jobName} customerId={customerId} jobStatus={job.status ?? null} onSent={onSent} load={load} io={io} quickIo={quickIo} />
          </div>
        )}
      </div>
    </ResponsiveModalShell>
  )
}
