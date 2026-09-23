import { useEffect, useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import type { LienNoticeFields } from '../../lib/jobsDocuments/lienFilingDocuments'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { BY_HAND_METHODS, byHandClaimWords, byHandProblems, parsePrintedMonths, type ByHandInput, type ByHandJob, type ByHandMethod } from '../../lib/jobs/lienNoticeByHand'
import { loadJobsAtProperty, recordLienNoticeByHand, type PropertyJobCandidate } from '../../lib/jobs/lienNoticeByHandIo'
import { workMonthShort } from '../../lib/jobs/forecastWorkMonths'

/**
 * Record a notice that already went out (#35 PR 2): the office printed the
 * paper from the app and mailed it outside the run — sometimes one paper for
 * several jobs at a property, claiming what it claimed. This pane takes when,
 * how, to whom, what the paper said, where the copy lives and which jobs it
 * covered, and writes one filing per job on one packet. Used by the Lien desk
 * pane and by the Lien window's notice tab.
 */
export type ByHandPrimaryJob = {
  id: string
  label: string
  jobAddress: string | null
  customerAddressId: string | null
  /** The job's own share — its open balance, or the claim set by hand. */
  amount: number
  /** The live desk item to mark sent, when the job has one. */
  itemId: string | null
}

const input: React.CSSProperties = { width: '100%', padding: '0.3rem 0.4rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit', font: 'inherit' }
const lbl: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' }

export default function LienNoticeByHandPane({
  job,
  fields,
  appClaim,
  appClaimIsTimely,
  defaultMonths,
  todayYmd,
  userId,
  onClose,
  onRecorded,
}: {
  job: ByHandPrimaryJob
  /** The notice as the app would print it for this job — the record's snapshot, its claim replaced by the paper's. */
  fields: LienNoticeFields
  /** What the app would have claimed, for the difference line. */
  appClaim: number
  appClaimIsTimely: boolean
  /** The months the app would have named — the prefill. */
  defaultMonths: string[]
  todayYmd: string
  userId: string | null
  onClose: () => void
  onRecorded: (result: { filingIds: string[]; jobs: number }) => void
}) {
  const { showToast } = useToastContext()
  const [sentOn, setSentOn] = useState(todayYmd)
  const [method, setMethod] = useState<ByHandMethod>('certified_mail')
  const [tracking, setTracking] = useState('')
  const [toOwner, setToOwner] = useState(true)
  const [toGc, setToGc] = useState(true)
  const [claimText, setClaimText] = useState(appClaim > 0 ? String(Math.round(appClaim * 100) / 100) : '')
  const [monthsText, setMonthsText] = useState(defaultMonths.join(' '))
  const [docUrl, setDocUrl] = useState('')
  const [docNote, setDocNote] = useState('')
  const [others, setOthers] = useState<PropertyJobCandidate[] | null>(null)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadJobsAtProperty({ id: job.id, customer_address_id: job.customerAddressId, job_address: job.jobAddress, revenue: null, payments_made: null })
      .then((rows) => { if (!cancelled) setOthers(rows) })
      .catch(() => { if (!cancelled) setOthers([]) })
    return () => { cancelled = true }
  }, [job.id, job.customerAddressId, job.jobAddress])

  const printedClaim = Number(String(claimText).replace(/[$,\s]/g, '')) || 0
  const printedMonths = useMemo(() => parsePrintedMonths(monthsText, Number(todayYmd.slice(0, 4))), [monthsText, todayYmd])
  const jobs: ByHandJob[] = useMemo(() => {
    const list: ByHandJob[] = [{ jobId: job.id, label: job.label, amount: job.amount, itemId: job.itemId }]
    for (const o of others ?? []) {
      if (!ticked.has(o.id)) continue
      const open = (Number(o.revenue) || 0) - (Number(o.payments_made) || 0)
      list.push({ jobId: o.id, label: `${effectiveJobLedgerNumber(o.hcp_number, o.click_number)} · ${(o.job_name ?? '').trim() || (o.job_address ?? '').trim()}`, amount: Math.max(0, open), itemId: o.itemId })
    }
    return list
  }, [job, others, ticked])
  const coveredTotal = jobs.reduce((s, j) => s + j.amount, 0)
  const byHand: ByHandInput = { sentOn, method, tracking, recipients: [...(toOwner ? ['owner' as const] : []), ...(toGc ? ['original_contractor' as const] : [])], printedClaim, printedMonths, documentUrl: docUrl, documentNote: docNote, jobs }
  const problems = byHandProblems(byHand, todayYmd)
  const diff = byHandClaimWords(printedClaim, jobs.length > 1 ? coveredTotal : appClaim, { timely: jobs.length <= 1 && appClaimIsTimely })

  const record = async () => {
    if (busy || problems.length) return
    setBusy(true)
    try {
      const result = await recordLienNoticeByHand(byHand, { userId, fields })
      showToast(`Recorded on ${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} — the desk reads ${jobs.length === 1 ? 'it' : 'them'} as sent.`, 'success')
      onRecorded({ filingIds: result.filingIds, jobs: jobs.length })
    } catch (e) {
      showToast(e instanceof Error && e.message ? e.message : 'Could not record the notice.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.7rem', background: 'var(--bg-amber-tint)', display: 'grid', gap: '0.45rem' }} data-testid="lien-notice-by-hand">
      <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Record a notice that already went out</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>For a paper printed here and mailed outside the run. It is written as printed — the claim and the months the paper named — on every job it covered, and the desk stops asking for it.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(120px, 1fr) minmax(120px, 1fr)', gap: '0.35rem 0.5rem', alignItems: 'center' }}>
        <span style={lbl}>Sent on</span>
        <input type="date" value={sentOn} max={todayYmd} onChange={(e) => setSentOn(e.target.value)} aria-label="Sent on" style={input} />
        <select value={method} onChange={(e) => setMethod(e.target.value as ByHandMethod)} aria-label="How it went" style={input}>
          {BY_HAND_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <span style={lbl}>Tracking</span>
        <input type="text" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder={method === 'email' ? 'the address it went to' : method === 'hand' ? 'who signed for it' : '9407 1118 … (optional)'} aria-label="Tracking" style={input} />
        <span style={{ display: 'flex', gap: '0.7rem', fontSize: '0.75rem' }}>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={toOwner} onChange={(e) => setToOwner(e.target.checked)} /> owner of record</label>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={toGc} onChange={(e) => setToGc(e.target.checked)} /> original contractor</label>
        </span>
        <span style={lbl}>As printed</span>
        <input type="text" inputMode="decimal" value={claimText} onChange={(e) => setClaimText(e.target.value)} placeholder="the claim on the form" aria-label="Claim as printed" style={input} />
        <input type="text" value={monthsText} onChange={(e) => setMonthsText(e.target.value)} placeholder="the months, e.g. Apr, Jun, Jul, Aug 2026" aria-label="Months as printed" style={input} />
        <span style={lbl}>Saved copy</span>
        <input type="text" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="Drive link (optional)" aria-label="Saved copy — link" style={input} />
        <input type="text" value={docNote} onChange={(e) => setDocNote(e.target.value)} placeholder="note (optional)" aria-label="Saved copy — note" style={input} />
      </div>
      {printedMonths.length ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Months read as {printedMonths.map(workMonthShort).join(', ')}.</div> : null}
      {others === null ? (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Looking for other unpaid jobs at this property…</div>
      ) : others.length > 0 ? (
        <div data-testid="by-hand-other-jobs">
          <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>Also on this paper — other unpaid jobs at this property</div>
          {others.map((o) => {
            const open = (Number(o.revenue) || 0) - (Number(o.payments_made) || 0)
            return (
              <label key={o.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.75rem', padding: '2px 0' }}>
                <input type="checkbox" checked={ticked.has(o.id)} onChange={(e) => setTicked((prev) => { const next = new Set(prev); if (e.target.checked) next.add(o.id); else next.delete(o.id); return next })} aria-label={`Also covers ${effectiveJobLedgerNumber(o.hcp_number, o.click_number)}`} />
                <span>{effectiveJobLedgerNumber(o.hcp_number, o.click_number)} · {(o.job_name ?? '').trim() || (o.job_address ?? '').trim()}</span>
                <span style={{ color: 'var(--text-muted)' }}>{formatUsdNoCents(open)}{o.itemId ? ' · on the desk' : ''}</span>
              </label>
            )
          })}
        </div>
      ) : null}
      {jobs.length > 1 ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{jobs.length} jobs · {formatUsdNoCents(coveredTotal)} open between them{diff ? ` · ${diff}` : ''}.</div> : diff ? <div style={{ fontSize: '0.72rem', color: 'var(--text-amber-800)' }} data-testid="by-hand-claim-diff">{diff} — recorded as printed; the difference stays on the record.</div> : null}
      {problems.length ? <div style={{ fontSize: '0.72rem', color: 'var(--text-red-600)' }} data-testid="by-hand-problems">Still needed: {problems.join(' · ')}</div> : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={onClose} disabled={busy} style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', color: 'inherit' }}>Back</button>
        <button type="button" onClick={() => void record()} disabled={busy || problems.length > 0} style={{ padding: '0.35rem 0.9rem', fontSize: '0.78rem', background: '#b45309', color: 'white', border: 'none', borderRadius: 4, cursor: busy || problems.length > 0 ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: problems.length > 0 ? 0.6 : 1 }} data-testid="by-hand-record">
          {busy ? 'Recording…' : `Record it on ${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} ▸`}
        </button>
      </div>
    </div>
  )
}
