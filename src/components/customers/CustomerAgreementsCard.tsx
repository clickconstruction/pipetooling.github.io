/**
 * Agreements on the Customer page (v2.4301): every signed paper filed for this customer's jobs —
 * as the customer or as the GC — with the jobs it covers, Change the jobs and Take it off; then
 * their open jobs that have no agreement. A paper covers the jobs it names, never all of theirs.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import AddJobContractSheet from '../jobs/AddJobContractSheet'
import { JOB_CONTRACT_BUCKET } from '../../lib/jobs/jobContractFileWrite'
import { buildJobContractCoverage, type JobContractRowLike, type SignedEstimateLike } from '../../lib/jobs/jobContractCoverage'
import { jobNumberLabel, jobNumberSortKey, jobStatusWord, streetOf, type CoversPaper } from '../../lib/jobs/jobContractCovers'
import {
  loadContractRowsForJobs,
  loadPartyJobs,
  paperRowsByJob,
  papersFromRows,
  voidPaperRows,
  type PartyJob,
} from '../../lib/jobs/jobContractCoversWrite'
import type { JobContractRow } from '../../lib/jobs/jobContractLifecycle'

function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

const smallBtn: React.CSSProperties = {
  padding: '0.25rem 0.6rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.74rem',
  fontWeight: 600,
  cursor: 'pointer',
}

export default function CustomerAgreementsCard({ customerId, customerName }: { customerId: string; customerName: string }) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [jobs, setJobs] = useState<PartyJob[]>([])
  const [rows, setRows] = useState<JobContractRow[]>([])
  const [estimates, setEstimates] = useState<SignedEstimateLike[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editPaper, setEditPaper] = useState<CoversPaper | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirmOff, setConfirmOff] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await loadPartyJobs([customerId])
      const ids = list.map((j) => j.id)
      const bidIds = list.map((j) => j.bid_id).filter((x): x is string => Boolean(x))
      const [contractRows, estRes] = await Promise.all([
        loadContractRowsForJobs(ids),
        ids.length
          ? supabase
              .from('estimates')
              .select('id, job_ledger_id, bid_id, doc_kind, status, acceptor_consented_at, acceptor_printed_name, estimate_number, total_cents')
              .eq('status', 'customer_accepted')
              .or(bidIds.length ? `job_ledger_id.in.(${ids.join(',')}),bid_id.in.(${bidIds.join(',')})` : `job_ledger_id.in.(${ids.join(',')})`)
              .order('id')
              .limit(1000)
          : Promise.resolve({ data: [] as SignedEstimateLike[] }),
      ])
      setJobs(list)
      setRows(contractRows)
      setEstimates((estRes.data ?? []) as SignedEstimateLike[])
    } catch {
      setJobs([])
      setRows([])
    } finally {
      setLoaded(true)
    }
  }, [customerId])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onChanged = () => void load()
    window.addEventListener('job-contract-changed', onChanged)
    return () => window.removeEventListener('job-contract-changed', onChanged)
  }, [load])

  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs])
  const papers = useMemo(() => papersFromRows(rows), [rows])
  const uncovered = useMemo(() => {
    const cov = buildJobContractCoverage(jobs, rows as unknown as JobContractRowLike[], estimates)
    return jobs
      .filter((j) => j.status !== 'paid' && ['none', 'draft', 'sent'].includes(cov.get(j.id)?.kind ?? 'none'))
      .sort((a, b) => jobNumberSortKey(jobNumberLabel(a)) - jobNumberSortKey(jobNumberLabel(b)))
  }, [jobs, rows, estimates])

  if (!loaded || (papers.length === 0 && uncovered.length === 0)) return null

  const openScan = async (paper: CoversPaper) => {
    const path = (paper.source.paper_upload_path ?? '').trim()
    if (!path) return
    const w = window.open('', '_blank')
    const { data } = await supabase.storage.from(JOB_CONTRACT_BUCKET).createSignedUrl(path, 3600)
    if (data?.signedUrl && w) w.location.href = data.signedUrl
    else {
      w?.close()
      showToast('The scan could not be opened.', 'error')
    }
  }

  const takeOff = async (paper: CoversPaper) => {
    setBusy(true)
    try {
      const ids = [...paperRowsByJob(rows, paper.key).values()].map((r) => r.id)
      await voidPaperRows(ids, user?.id ?? null, 'Taken off by the office')
      showToast('Taken off. Those jobs read No contract again unless something else covers them.', 'success')
      setConfirmOff(null)
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not take the paper off.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', marginBottom: 16 }} data-testid="customer-agreements">
      <div style={{ display: 'flex', alignItems: 'center', padding: '9px 13px', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-strong)' }}>
        Agreements
        <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-muted)' }}>signed papers on file and the jobs each one covers</span>
        <button type="button" style={{ ...smallBtn, marginLeft: 'auto', borderColor: 'var(--text-link)', color: 'var(--text-link)' }} onClick={() => setAdding(true)}>
          Add one
        </button>
      </div>
      <div style={{ padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {papers.map((paper) => {
          const signed = shortDate(paper.signedAt)
          return (
            <div key={paper.key} data-testid="customer-agreement" style={{ border: '1px solid var(--border-green-soft)', background: 'var(--bg-green-tint)', borderRadius: 8, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>✍ Signed paper · {paper.documentUrl ? 'Google Doc' : 'scan'}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-green-800)' }}>
                    {[signed ? `Signed ${signed}` : null, paper.signerName ? `by ${paper.signerName}` : null].filter(Boolean).join(' ')}
                  </span>
                </span>
                {paper.documentUrl ? (
                  <a href={paper.documentUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none' }}>
                    Open ↗
                  </a>
                ) : paper.hasUpload ? (
                  <button type="button" style={{ ...smallBtn, border: 'none', background: 'none', color: 'var(--text-link)' }} onClick={() => void openScan(paper)}>
                    Open ↗
                  </button>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {paper.jobIds.map((id) => {
                  const j = jobById.get(id)
                  if (!j) return null
                  return (
                    <Link key={id} to={`/jobs?jobDetail=${id}`} style={{ padding: '2px 9px', borderRadius: 999, border: '1px solid var(--border-green-soft)', background: 'var(--surface)', fontSize: '0.74rem', color: 'inherit', textDecoration: 'none' }}>
                      {jobNumberLabel(j)}
                      {streetOf(j.job_address) ? ` · ${streetOf(j.job_address)}` : ''}
                    </Link>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
                {confirmOff === paper.key ? (
                  <>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>Take it off {paper.jobIds.length === 1 ? 'its job' : `all ${paper.jobIds.length} jobs`}?</span>
                    <button type="button" style={smallBtn} disabled={busy} onClick={() => setConfirmOff(null)}>
                      Keep it
                    </button>
                    <button type="button" style={{ ...smallBtn, background: 'var(--bg-amber-tint)', borderColor: 'var(--border-amber-soft)', color: 'var(--text-amber-800)' }} disabled={busy} onClick={() => void takeOff(paper)}>
                      {busy ? '…' : 'Take it off'}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" style={smallBtn} onClick={() => setEditPaper(paper)}>
                      Change the jobs…
                    </button>
                    <button type="button" style={{ ...smallBtn, background: 'var(--bg-amber-tint)', borderColor: 'var(--border-amber-soft)', color: 'var(--text-amber-800)' }} onClick={() => setConfirmOff(paper.key)}>
                      Take it off…
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
        {uncovered.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>Open jobs with no agreement</div>
            {uncovered.map((j) => (
              <Link
                key={j.id}
                to={`/jobs?jobDetail=${j.id}`}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 9px', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.78rem', color: 'inherit', textDecoration: 'none' }}
              >
                <span>
                  {jobNumberLabel(j)}
                  {streetOf(j.job_address) ? ` · ${streetOf(j.job_address)}` : ''}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>{jobStatusWord(j.status)}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      {editPaper ? (
        <AddJobContractSheet
          open
          mode="edit"
          paper={editPaper}
          onClose={() => setEditPaper(null)}
          onDone={() => void load()}
          anchorJob={null}
          partyIds={[customerId]}
          signerName={customerName}
          subtitle={customerName}
        />
      ) : null}
      {adding ? (
        <AddJobContractSheet open mode="add" onClose={() => setAdding(false)} onDone={() => void load()} anchorJob={null} partyIds={[customerId]} signerName={customerName} subtitle={`${customerName} · pick the jobs the paper names`} />
      ) : null}
    </div>
  )
}
