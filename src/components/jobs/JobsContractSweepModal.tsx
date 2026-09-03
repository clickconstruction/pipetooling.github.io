/**
 * The contract sweep (Contract Desk PR 4): "even the jobs that already
 * started" as a list. Every live job with nothing on file is one row —
 * job, address, amount, the customer's email, a template — and a Send
 * button; Send all takes every row with a valid email after a confirm. Rows
 * missing an email get a Fix email door (opens Edit Job); rows can open the
 * full Contract modal for careful edits or a paper upload.
 */
import { useEffect, useMemo, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { quickSendJobContract, type QuickSendTemplate } from '../../lib/jobs/jobContractQuickSend'
import type { JobContractCoverage } from '../../lib/jobs/jobContractCoverage'
import JobContractModal from './JobContractModal'

type TemplateRow = NonNullable<QuickSendTemplate>

const BUILTIN = '__builtin__'
const btn: React.CSSProperties = {
  padding: '0.3rem 0.7rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
const btnPrimary: React.CSSProperties = { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }
const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.3rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.78rem',
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

const STATUS_LABEL: Record<string, string> = { waiting: 'Waiting', working: 'Working', ready_to_bill: 'Ready to bill', billed: 'Billed' }

export default function JobsContractSweepModal({
  open,
  onClose,
  jobs,
  coverage,
  onEditJob,
  onSent,
}: {
  open: boolean
  onClose: () => void
  /** Every loaded job; the modal keeps the ones without an agreement. */
  jobs: JobWithDetails[]
  coverage: ReadonlyMap<string, JobContractCoverage>
  onEditJob: (job: JobWithDetails) => void
  onSent: () => void
}) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [templateId, setTemplateId] = useState(BUILTIN)
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<ReadonlySet<string>>(() => new Set())
  const [sendAllArmed, setSendAllArmed] = useState(false)
  const [sendingAll, setSendingAll] = useState(false)
  const [detailJob, setDetailJob] = useState<JobWithDetails | null>(null)

  useEffect(() => {
    if (!open) return
    setSentIds(new Set())
    setSendAllArmed(false)
    void (async () => {
      const { data } = await supabase
        .from('contract_template_documents')
        .select('id, document_name, book_body_html, book_body_format, book_version_date')
        .eq('audience', 'customer')
        .order('document_name')
      const list = (data ?? []) as TemplateRow[]
      setTemplates(list)
      if (list[0]) setTemplateId(list[0].id)
    })()
  }, [open])

  const rows = useMemo(() => {
    const order: Record<string, number> = { working: 0, waiting: 1, ready_to_bill: 2, billed: 3 }
    return jobs
      .filter((j) => {
        const cov = coverage.get(j.id)
        const status = (j.status ?? '') as string
        return status !== 'paid' && (!cov || cov.kind === 'none' || cov.kind === 'draft') && !sentIds.has(j.id)
      })
      .sort((a, b) => (order[a.status ?? ''] ?? 9) - (order[b.status ?? ''] ?? 9) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
  }, [jobs, coverage, sentIds])

  const emailFor = (j: JobWithDetails) => emails[j.id] ?? (j.customer_email ?? '').trim()
  const template: QuickSendTemplate = templates.find((t) => t.id === templateId) ?? null
  const readyRows = rows.filter((j) => isEmail(emailFor(j)))

  const sendOne = async (j: JobWithDetails): Promise<boolean> => {
    setBusyId(j.id)
    try {
      const res = await quickSendJobContract({
        job: j,
        template,
        recipientEmail: emailFor(j),
        recipientName: (j.customer_name ?? '').trim(),
        authUserId: authUser?.id ?? null,
      })
      if (!res.ok) {
        showToast(`${effectiveJobLedgerNumber(j.hcp_number, j.click_number) || 'Job'}: ${res.error}`, 'error')
        return false
      }
      setSentIds((prev) => new Set([...prev, j.id]))
      if (!res.emailed) showToast(`${effectiveJobLedgerNumber(j.hcp_number, j.click_number) || 'Job'}: link minted but the email did not send.`, 'error')
      return true
    } finally {
      setBusyId(null)
    }
  }

  const sendAll = async () => {
    if (!sendAllArmed) {
      setSendAllArmed(true)
      return
    }
    setSendingAll(true)
    let n = 0
    try {
      for (const j of readyRows) {
        if (await sendOne(j)) n++
      }
      showToast(`Sent ${n} contract${n === 1 ? '' : 's'}.`, 'success')
      onSent()
    } finally {
      setSendingAll(false)
      setSendAllArmed(false)
    }
  }

  if (!open) return null
  const total = rows.reduce((s, j) => s + (Number(j.revenue ?? 0) || 0), 0)

  return (
    <ResponsiveModalShell
      title="Contract sweep"
      onRequestClose={onClose}
      maxWidthDesktop={900}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Terms</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ ...input, width: 'auto', minWidth: 220 }}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.document_name}
                </option>
              ))}
              <option value={BUILTIN}>Built-in service agreement terms</option>
            </select>
          </div>
          <button type="button" style={{ ...btnPrimary, ...(sendAllArmed ? { background: 'var(--text-red-700)', borderColor: 'var(--text-red-700)' } : {}) }} disabled={readyRows.length === 0 || sendingAll || busyId != null} onClick={() => void sendAll()}>
            {sendingAll ? 'Sending…' : sendAllArmed ? `Confirm — send ${readyRows.length} now` : `Send all ${readyRows.length} ready`}
          </button>
        </div>
      }
    >
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
        {rows.length} job{rows.length === 1 ? '' : 's'} without a contract · {formatUsdNoCents(total)} of work
        {sentIds.size > 0 ? ` · ${sentIds.size} sent this sweep` : ''}. Each row sends the job's own scope and amount with the terms chosen below; open a row to edit first or to upload a paper copy.
      </div>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Every live job has an agreement on file. 🎉</p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {rows.map((j) => {
            const num = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
            const email = emailFor(j)
            const ok = isEmail(email)
            return (
              <div key={j.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px auto', gap: '0.5rem 0.75rem', alignItems: 'center', padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
                <div style={{ minWidth: 0 }}>
                  <button type="button" onClick={() => setDetailJob(j)} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }}>
                    J{num} · {(j.job_name ?? '').trim() || 'Job'}
                  </button>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(j.job_address ?? '').trim() || '—'} · {STATUS_LABEL[j.status ?? ''] ?? j.status} · {Number(j.revenue ?? 0) > 0 ? formatUsdNoCents(Number(j.revenue)) : 'no amount'}
                    {(j.customer_name ?? '').trim() ? ` · ${(j.customer_name ?? '').trim()}` : ''}
                  </div>
                </div>
                <input
                  style={{ ...input, ...(email && !ok ? { borderColor: 'var(--text-red-700)' } : {}) }}
                  type="email"
                  value={email}
                  placeholder="no email on job"
                  onChange={(e) => setEmails((prev) => ({ ...prev, [j.id]: e.target.value }))}
                  aria-label={`Signer email for job ${num}`}
                />
                {ok ? (
                  <button type="button" style={btnPrimary} disabled={busyId != null || sendingAll} onClick={() => void sendOne(j).then((sent) => sent && onSent())}>
                    {busyId === j.id ? 'Sending…' : 'Send'}
                  </button>
                ) : (
                  <button type="button" style={btn} onClick={() => onEditJob(j)}>
                    Fix email
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      <JobContractModal
        open={detailJob != null}
        onClose={() => setDetailJob(null)}
        job={detailJob}
        onChanged={() => {
          onSent()
        }}
      />
    </ResponsiveModalShell>
  )
}
