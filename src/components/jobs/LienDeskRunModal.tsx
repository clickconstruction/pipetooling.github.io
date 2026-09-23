import { useEffect, useMemo, useState } from 'react'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { noticeInvoiceDocs, noticeInvoicePrintSections, type NoticeInvoiceDoc } from '../../lib/jobs/noticeInvoiceEnclosure'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { describeNoticeMonths } from '../../lib/jobs/lienNoticeDraft'
import { RUN_SEND_METHODS, runNoticeProblems, runPacketHtml, runPayPageBlocks, type RunNotice, type RunPayPages, type RunSendMethod } from '../../lib/jobs/lienDeskRun'
import { payPageRows, type PayPageAssets, type PayPageRow } from '../../lib/jobs/lienNoticePayPage'
import { buildPayPageAssets } from '../../lib/jobs/lienNoticePayPageAssets'
import { filingDocHtml, type FilingDocBlock } from '../../lib/jobsDocuments/lienFilingDocuments'
import { runCopies, runEnvelopes, type RunEnvelope } from '../../lib/jobs/runEnvelopes'
import { recordLienDeskRun } from '../../lib/jobs/lienDeskRunIo'
import { combineNoticesByProperty, combineSummary, type CombinedRunNotice } from '../../lib/jobs/lienNoticeCombine'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * Send the run: every approved notice on the desk as one packet (the cover
 * sheet listing the envelopes, then what goes in each — the owner's copy
 * behind its cover page, the original contractor's copy alone) and one form
 * for the tracking numbers, one per envelope. Notices to one name at one
 * address share an envelope (v2.3720): two jobs at one property, and every
 * copy for the one original contractor. Record the run writes each notice to
 * its job with every month it named and marks the desk items sent.
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
  // The saved copy (v2.3763): where the office keeps the packet as printed — one link and a line for the whole run; every notice's record carries it.
  const [docUrl, setDocUrl] = useState('')
  const [docNote, setDocNote] = useState('')
  // One notice per property (#35 PR 3): off until the office ticks it — the form's claim changes when jobs combine.
  const [combine, setCombine] = useState(false)
  const combinable = useMemo(() => combineSummary(combineNoticesByProperty(notices, { combine: true })), [notices])
  const shown: CombinedRunNotice[] = useMemo(() => combineNoticesByProperty(notices, { combine }), [notices, combine])
  const partsOf = (n: CombinedRunNotice) => (n.parts && n.parts.length > 1 ? n.parts : null)
  // The unpaid invoices behind each notice (v2.3437, § 53.056(a-3)) — loaded once per job.
  const [invoiceDocsByJob, setInvoiceDocsByJob] = useState<Record<string, NoticeInvoiceDoc[]>>({})
  const [payByJob, setPayByJob] = useState<Record<string, { rows: PayPageRow[]; assets: PayPageAssets }>>({})
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
      // The pay page's codes (v2.3758): one per Stripe bill, built once the bills are known.
      const pay: Record<string, { rows: PayPageRow[]; assets: PayPageAssets }> = {}
      await Promise.all(
        Object.entries(next).map(async ([id, docs]) => {
          const rows = payPageRows(docs)
          pay[id] = { rows, assets: rows.some((r) => r.payable) ? await buildPayPageAssets(rows).catch(() => ({})) : {} }
        }),
      )
      if (!cancelled) setPayByJob(pay)
    })()
    return () => {
      cancelled = true
    }
  }, [initial])
  // The enclosures by the notice that prints them: a combined notice carries every part's invoices and bills under the lead job's id.
  const invoiceDocsShown = useMemo(() => {
    const out: Record<string, NoticeInvoiceDoc[]> = { ...invoiceDocsByJob }
    for (const n of shown) {
      const parts = partsOf(n)
      if (parts) out[n.jobId] = parts.flatMap((p) => invoiceDocsByJob[p.jobId] ?? [])
    }
    return out
  }, [shown, invoiceDocsByJob])
  const invoiceSectionsByJob = useMemo(() => Object.fromEntries(Object.entries(invoiceDocsShown).map(([id, docs]) => [id, noticeInvoicePrintSections(docs)])), [invoiceDocsShown])
  const invoicesEnclosed = shown.reduce((s, n) => s + (invoiceDocsShown[n.jobId]?.length ?? 0), 0)
  // The pay page per job and copy (v2.3758): blocks for the emailed PDF, HTML for the printed packet.
  const payBlocksByJob = useMemo(() => {
    const out: Record<string, Partial<Record<'owner' | 'original_contractor', FilingDocBlock[]>>> = {}
    const phone = (issuer?.phone ?? '').trim()
    for (const n of shown) {
      const parts = partsOf(n)
      const p = parts
        ? { rows: parts.flatMap((x) => payByJob[x.jobId]?.rows ?? []), assets: Object.assign({}, ...parts.map((x) => payByJob[x.jobId]?.assets ?? {})) as PayPageAssets }
        : payByJob[n.jobId]
      if (!p || p.rows.length === 0) continue
      for (const r of n.recipients) {
        const blocks = runPayPageBlocks(n, r, p.rows, p.assets, phone)
        if (blocks.length) (out[n.jobId] ??= {})[r.key] = blocks
      }
    }
    return out
  }, [shown, payByJob, issuer])
  const payPagesByJob = useMemo<RunPayPages>(
    () => Object.fromEntries(Object.entries(payBlocksByJob).map(([id, byCopy]) => [id, Object.fromEntries(Object.entries(byCopy).map(([k, blocks]) => [k, filingDocHtml(blocks!)]))])),
    [payBlocksByJob],
  )
  const payCodes = shown.reduce((s, n) => s + ((partsOf(n) ?? [{ jobId: n.jobId }]).reduce((t, x) => t + (payByJob[x.jobId]?.rows.filter((r) => r.payable).length ?? 0), 0)), 0)
  const problems = useMemo(() => shown.map((n) => runNoticeProblems(n)), [shown])
  const blocked = problems.some((p) => p.length > 0)
  const envelopes = useMemo(() => runEnvelopes(shown), [shown])
  const shared = envelopes.length < runCopies(shown)

  // One method and one tracking number per envelope — every recipient inside it takes the patch, so the record writes the same send on each notice.
  const setEnvelope = (env: RunEnvelope, patch: { method?: RunSendMethod; tracking?: string }) => {
    // Keyed by item and recipient, not by index: a combined notice stands for several items, and every one takes the patch.
    const inside = new Set(env.contents.flatMap((c) => (partsOf(c.notice as CombinedRunNotice) ?? [{ itemId: c.notice.itemId }]).map((p) => `${p.itemId}:${c.recipient.key}`)))
    setNotices((prev) => prev.map((n) => ({ ...n, recipients: n.recipients.map((r) => (inside.has(`${n.itemId}:${r.key}`) ? { ...r, ...patch } : r)) })))
  }

  const printPacket = () => {
    if (!openHtmlPrintWindow(runPacketHtml(shown, todayYmd, issuer, invoiceSectionsByJob, payPagesByJob))) showToast('Popup blocked — allow popups to print the packet.', 'error')
  }

  const record = async () => {
    if (busy || blocked || notices.length === 0) return
    setBusy(true)
    try {
      const result = await recordLienDeskRun(shown, { userId, todayYmd, invoiceDocsByJob: invoiceDocsShown, payBlocksByJob, document: { url: docUrl, note: docNote } })
      if (result.recorded.length) showToast(`${result.recorded.length} ${result.recorded.length === 1 ? 'notice' : 'notices'} recorded — the desk reads them as sent.`, 'success')
      if (result.failed.length) showToast(`${result.failed.length} not recorded: ${result.failed.map((f) => `${f.label} (${f.reason})`).join('; ')}`, 'error')
      onRecorded()
      if (result.failed.length === 0) onClose()
      else setNotices((prev) => prev.filter((n) => result.failed.some((f) => f.itemId === n.itemId || shown.some((s) => s.itemId === f.itemId && (partsOf(s) ?? []).some((p) => p.itemId === n.itemId)))))
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
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Send the run · {shown.length} {shown.length === 1 ? 'notice' : 'notices'}{combine && shown.length !== notices.length ? ` for ${notices.length} jobs` : ''}</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '78ch' }}>
              One packet with every approved notice — a cover sheet listing the {envelopes.length} {envelopes.length === 1 ? 'envelope' : 'envelopes'}, then what goes in each, in that order: the owner of record's copy behind its cover page, the original contractor's copy alone{payCodes > 0 ? `, the pay codes page behind the owner's copy (${payCodes} ${payCodes === 1 ? 'code' : 'codes'} — one per Stripe bill)` : ''}{invoicesEnclosed > 0 ? `, the job's unpaid ${invoicesEnclosed === 1 ? 'invoice' : 'invoices'} behind each copy (§ 53.056(a-3))` : ''}.{shared ? ' Notices to one name at one address share an envelope, so its tracking number covers everything inside.' : ''} Print it first; type the tracking numbers when you are back from the post office. Recording the run writes each notice to its job with every month it named.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}>×</button>
        </div>
        <div style={{ overflow: 'auto', padding: '0.5rem 1.25rem' }}>
          {notices.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Nothing approved is waiting.</p> : null}
          {combinable.combined > 0 ? (
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.8125rem', padding: '0.4rem 0.6rem', margin: '0.2rem 0 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-amber-tint)' }} data-testid="run-combine">
              <input type="checkbox" checked={combine} onChange={(ev) => setCombine(ev.target.checked)} aria-label="Combine the jobs at one property into one notice" style={{ marginTop: 3 }} />
              <span>
                <strong>Combine the jobs at one property into one notice</strong> — one form to the same owner from the same original contractor, the claims summed, the months joined; still one record per job, on one packet.{' '}
                <span style={{ color: 'var(--text-muted)' }}>{combinable.jobs} jobs would print as {combinable.notices} {combinable.notices === 1 ? 'notice' : 'notices'} ({combinable.combined} combined). The form's claim changes when jobs combine — off unless the office says so.</span>
              </span>
            </label>
          ) : null}
          <table className="lienRunTable" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                {['Envelope', 'What', 'Method', 'Tracking #'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.4rem 0.5rem 0.3rem 0', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {envelopes.map((env) => {
                const who = `Envelope ${env.n} · ${env.label}: ${env.name || '—'}`
                return [
                  <tr key={env.key} className="lienRunEnvelope" data-testid={`run-envelope-${env.n}`} style={{ background: 'var(--bg-subtle)' }}>
                    <td colSpan={2} className="lienRunWho">
                      <div style={{ fontWeight: 600 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Envelope {env.n} · {env.label}</span>{' '}
                        {env.name || <span style={{ color: 'var(--text-red-600)' }}>— {env.label.toLowerCase()} missing</span>}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        {env.address || (env.name ? 'no mailing address' : '')}{env.email ? ` · ${env.email}` : ''}
                        {env.contents.length > 1 ? ` · ${env.contents.length} notices inside` : ''}
                      </div>
                    </td>
                    <td className="lienRunMethod" data-label="Method">
                      <select value={env.method} onChange={(ev) => setEnvelope(env, { method: ev.target.value as RunSendMethod })} aria-label={`${who} — method`} className="lienRunSelect" style={{ font: 'inherit', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}>
                        {RUN_SEND_METHODS.map((m) => (
                          <option key={m.key} value={m.key} disabled={m.key === 'email' && !env.email}>{m.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="lienRunTracking" data-label="Tracking #">
                      {env.method === 'email' ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>sent on record — the email id is the tracking{env.contents.length > 1 ? ', one email per notice' : ''}</span>
                      ) : (
                        <input value={env.tracking} onChange={(ev) => setEnvelope(env, { tracking: ev.target.value })} placeholder={env.method === 'hand' ? 'who signed for it' : '9407 1118 …'} aria-label={`${who} — tracking`} style={{ width: '100%', font: 'inherit', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }} />
                      )}
                    </td>
                  </tr>,
                  ...env.contents.map(({ notice: n, recipient: r, noticeIndex: ni }) => {
                    const mine = problems[ni]!.filter((p) => p.startsWith(`${r.label}:`))
                    return (
                      <tr key={`${n.itemId}-${r.key}`} className="lienRunCopy" data-testid={`run-row-${n.jobId}-${r.key}`}>
                        <td className="lienRunJob" style={{ fontWeight: 600 }}>
                          {n.label}
                          {partsOf(n as CombinedRunNotice) ? <div style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.72rem' }} data-testid="run-combined-parts">{partsOf(n as CombinedRunNotice)!.map((p) => `${p.jobNumber} ${formatUsdNoCents(p.amount)}`).join(' · ')}</div> : null}
                          <div style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{formatUsdNoCents(n.amount)}{r.key === 'owner' ? (n.coverLetter ? ' · cover letter' : n.coverNote ? ' · cover note' : '') : ''}</div>
                          {mine.length ? <div style={{ color: 'var(--text-red-600)', fontSize: '0.72rem' }}>{mine.join(' · ')}</div> : null}
                        </td>
                        <td className="lienRunMonths" style={{ color: 'var(--text-muted)' }}>{n.kind === 'retainage_53_057' ? '§ 53.057 retainage' : describeNoticeMonths(n.months)}</td>
                        <td colSpan={2} className="lienRunFor" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Copy for: {r.label.toLowerCase()}</td>
                      </tr>
                    )
                  }),
                ]
              })}
            </tbody>
          </table>
        </div>
        <div className="lienRunFoot" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.6rem 1.25rem 0.9rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <div style={{ flexBasis: '100%', display: 'grid', gridTemplateColumns: 'auto minmax(160px, 2fr) minmax(120px, 1fr)', gap: '0.4rem 0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }} data-testid="run-saved-copy">
            <span title="Where the packet lives once you saved it — a Drive link. Every notice's record carries it, so the paper can be found from the job later.">Saved copy</span>
            <input value={docUrl} onChange={(ev) => setDocUrl(ev.target.value)} placeholder="Drive link to the packet as printed (optional)" aria-label="Saved copy — link" style={{ width: '100%', font: 'inherit', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }} />
            <input value={docNote} onChange={(ev) => setDocNote(ev.target.value)} placeholder="note (optional)" aria-label="Saved copy — note" style={{ width: '100%', font: 'inherit', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }} />
          </div>
          <button type="button" onClick={printPacket} disabled={notices.length === 0} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
            Print the packet · {envelopes.length} {envelopes.length === 1 ? 'envelope' : 'envelopes'}
          </button>
          <span className="lienRunFootHint" style={{ fontSize: '0.78rem', color: blocked ? 'var(--text-red-600)' : 'var(--text-muted)' }}>
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
