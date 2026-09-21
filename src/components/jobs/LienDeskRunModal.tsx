import { useEffect, useMemo, useState } from 'react'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { noticeInvoiceDocs, noticeInvoicePrintSections, type NoticeInvoiceDoc } from '../../lib/jobs/noticeInvoiceEnclosure'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { describeNoticeMonths } from '../../lib/jobs/lienNoticeDraft'
import { RUN_SEND_METHODS, runNoticeProblems, runPacketHtml, type RunNotice, type RunSendMethod } from '../../lib/jobs/lienDeskRun'
import { recordLienDeskRun } from '../../lib/jobs/lienDeskRunIo'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * Send the run: every approved notice on the desk as one packet (the cover
 * sheet listing the envelopes, each notice twice — owner and original
 * contractor — with its cover note) and one form for the tracking numbers.
 * Record the run writes each notice to its job with every month it named
 * and marks the desk items sent.
 */
export default function LienDeskRunModal({
  notices: initial,
  issuer,
  todayYmd,
  userId,
  onClose,
  onRecorded,
}: {
  notices: RunNotice[]
  issuer: PhysicalInvoiceIssuer | null
  todayYmd: string
  userId: string | null
  onClose: () => void
  /** After a record — the desk re-reads. */
  onRecorded: () => void
}) {
  const { showToast } = useToastContext()
  const [notices, setNotices] = useState<RunNotice[]>(initial)
  const [busy, setBusy] = useState(false)
  // The unpaid invoices behind each notice (v2.3437, § 53.056(a-3)) — loaded once per job.
  const [invoiceDocsByJob, setInvoiceDocsByJob] = useState<Record<string, NoticeInvoiceDoc[]>>({})
  useEffect(() => {
    let cancelled = false
    const jobIds = Array.from(new Set(initial.map((n) => n.jobId)))
    void (async () => {
      const next: Record<string, NoticeInvoiceDoc[]> = {}
      await Promise.all(
        jobIds.map(async (id) => {
          try {
            const job = await fetchJobWithDetailsById(id)
            if (job) next[id] = noticeInvoiceDocs(job)
          } catch {
            // the notice goes without its invoice; the statute only permits the enclosure
          }
        }),
      )
      if (!cancelled) setInvoiceDocsByJob(next)
    })()
    return () => {
      cancelled = true
    }
  }, [initial])
  const invoiceSectionsByJob = useMemo(() => Object.fromEntries(Object.entries(invoiceDocsByJob).map(([id, docs]) => [id, noticeInvoicePrintSections(docs)])), [invoiceDocsByJob])
  const invoicesEnclosed = notices.reduce((s, n) => s + (invoiceDocsByJob[n.jobId]?.length ?? 0), 0)
  const problems = useMemo(() => notices.map((n) => runNoticeProblems(n)), [notices])
  const blocked = problems.some((p) => p.length > 0)
  const envelopes = notices.reduce((s, n) => s + n.recipients.length, 0)

  const setRecipient = (ni: number, ri: number, patch: { method?: RunSendMethod; tracking?: string }) =>
    setNotices((prev) => prev.map((n, i) => (i !== ni ? n : { ...n, recipients: n.recipients.map((r, j) => (j !== ri ? r : { ...r, ...patch })) })))

  const printPacket = () => {
    if (!openHtmlPrintWindow(runPacketHtml(notices, todayYmd, issuer, invoiceSectionsByJob))) showToast('Popup blocked — allow popups to print the packet.', 'error')
  }

  const record = async () => {
    if (busy || blocked || notices.length === 0) return
    setBusy(true)
    try {
      const result = await recordLienDeskRun(notices, { userId, todayYmd, invoiceDocsByJob })
      if (result.recorded.length) showToast(`${result.recorded.length} ${result.recorded.length === 1 ? 'notice' : 'notices'} recorded — the desk reads them as sent.`, 'success')
      if (result.failed.length) showToast(`${result.failed.length} not recorded: ${result.failed.map((f) => `${f.label} (${f.reason})`).join('; ')}`, 'error')
      onRecorded()
      if (result.failed.length === 0) onClose()
      else setNotices((prev) => prev.filter((n) => result.failed.some((f) => f.itemId === n.itemId)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send the run"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(960px, calc(100vw - 2rem))', maxHeight: '90vh', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', padding: '1rem 1.25rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Send the run · {notices.length} {notices.length === 1 ? 'notice' : 'notices'}</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '78ch' }}>
              One packet with every approved notice — a cover sheet listing the {envelopes} envelopes, then each notice for the owner of record and for the original contractor, with its cover note{invoicesEnclosed > 0 ? ` and the job's unpaid ${invoicesEnclosed === 1 ? 'invoice' : 'invoices'} behind it (§ 53.056(a-3))` : ''}. Print it first; type the tracking numbers when you are back from the post office. Recording the run writes each notice to its job with every month it named.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}>×</button>
        </div>
        <div style={{ overflow: 'auto', padding: '0.5rem 1.25rem' }}>
          {notices.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Nothing approved is waiting.</p> : null}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                {['Notice', 'Months', 'To', 'Method', 'Tracking #'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.4rem 0.5rem 0.3rem 0', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notices.map((n, ni) =>
                n.recipients.map((r, ri) => (
                  <tr key={`${n.itemId}-${r.key}`} data-testid={`run-row-${n.jobId}-${r.key}`}>
                    {ri === 0 ? (
                      <td rowSpan={n.recipients.length} style={{ padding: '0.45rem 0.5rem 0.45rem 0', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontWeight: 600 }}>
                        {n.label}
                        <div style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{formatUsdNoCents(n.amount)}{n.coverLetter ? ' · cover letter' : n.coverNote ? ' · cover note' : ''}</div>
                        {problems[ni]!.length ? <div style={{ color: 'var(--text-red-600)', fontSize: '0.72rem' }}>{problems[ni]!.join(' · ')}</div> : null}
                      </td>
                    ) : null}
                    {ri === 0 ? (
                      <td rowSpan={n.recipients.length} style={{ padding: '0.45rem 0.5rem 0.45rem 0', borderBottom: '1px solid var(--border)', verticalAlign: 'top', color: 'var(--text-muted)' }}>{describeNoticeMonths(n.months)}</td>
                    ) : null}
                    <td style={{ padding: '0.3rem 0.5rem 0.3rem 0', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      <div>{r.name || <span style={{ color: 'var(--text-red-600)' }}>— {r.label.toLowerCase()} missing</span>}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{r.label}{r.address ? ` · ${r.address}` : ''}{r.email ? ` · ${r.email}` : ''}</div>
                    </td>
                    <td style={{ padding: '0.3rem 0.5rem 0.3rem 0', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      <select value={r.method} onChange={(ev) => setRecipient(ni, ri, { method: ev.target.value as RunSendMethod })} aria-label={`${n.label} — ${r.label} method`} style={{ font: 'inherit', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}>
                        {RUN_SEND_METHODS.map((m) => (
                          <option key={m.key} value={m.key} disabled={m.key === 'email' && !r.email}>{m.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '0.3rem 0 0.3rem 0', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      {r.method === 'email' ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>sent on record — the email id is the tracking</span>
                      ) : (
                        <input value={r.tracking} onChange={(ev) => setRecipient(ni, ri, { tracking: ev.target.value })} placeholder={r.method === 'hand' ? 'who signed for it' : '9407 1118 …'} aria-label={`${n.label} — ${r.label} tracking`} style={{ width: '100%', font: 'inherit', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }} />
                      )}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.6rem 1.25rem 0.9rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <button type="button" onClick={printPacket} disabled={notices.length === 0} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
            Print the packet · {envelopes} {envelopes === 1 ? 'envelope' : 'envelopes'}
          </button>
          <span style={{ flex: 1, fontSize: '0.78rem', color: blocked ? 'var(--text-red-600)' : 'var(--text-muted)' }}>
            {blocked ? 'Fix the recipients marked in red before recording.' : 'Tracking numbers can be typed now or left for later.'}
          </span>
          <button type="button" onClick={() => void record()} disabled={busy || blocked || notices.length === 0} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid transparent', background: '#2563eb', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: busy || blocked ? 'default' : 'pointer', opacity: busy || blocked || notices.length === 0 ? 0.55 : 1 }}>
            {busy ? 'Recording…' : 'Record the run ▸'}
          </button>
        </div>
      </div>
    </div>
  )
}
