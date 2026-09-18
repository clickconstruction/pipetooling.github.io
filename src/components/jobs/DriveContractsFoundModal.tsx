/**
 * Found in Drive (the Contract sweep's Drive pass, v2.3390): the contract-
 * looking files the jobs Shared Drive already holds, matched to the jobs
 * without a contract, confidence stated — Confident · Check · No match —
 * with one button for the confident rows and a File on each check row. Each
 * filing is the normal paper-record write with the Drive link as the signed
 * document (the row reads ✍ On file · Google Doc); nobody is emailed. Dev-run
 * first (v2.3390); the door under the sweep's ⋯ opened to the office set in
 * v2.3587 after the first live passes were right.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { fileSignedJobContract } from '../../lib/jobs/jobContractFileWrite'
import { matchDriveContracts, signedOnFromModified, summarizeDriveMatches, type DriveContractMatch, type DriveMatchJob, type DriveScanFile } from '../../lib/jobs/driveContractMatch'

const btn: CSSProperties = {
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
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }
function chip(tone: 'green' | 'amber' | 'muted' | 'blue'): CSSProperties {
  const t = {
    green: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)', border: 'var(--border-green)' },
    amber: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', border: 'var(--border-amber)' },
    muted: { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)', border: 'var(--border)' },
    blue: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)', border: 'var(--border-strong)' },
  }[tone]
  return { display: 'inline-block', padding: '1px 7px', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, whiteSpace: 'nowrap', background: t.bg, color: t.fg, border: `1px solid ${t.border}` }
}
function segStyle(active: boolean): CSSProperties {
  return { padding: '0.2rem 0.6rem', fontSize: '0.75rem', border: 'none', background: active ? 'var(--bg-blue-tint)' : 'transparent', color: active ? 'var(--text-link)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: active ? 700 : 500, font: 'inherit' }
}

type Group = 'confident' | 'check' | 'none'
const GROUP_LABEL: Record<Group, string> = { confident: 'Confident', check: 'Check', none: 'No match' }

export function driveMatchJobFrom(j: JobWithDetails): DriveMatchJob {
  return {
    id: j.id,
    jobNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '',
    jobName: (j.job_name ?? '').trim(),
    jobAddress: (j.job_address ?? '').trim(),
    customerName: (j.customer_name ?? '').trim(),
    gcName: (j.gcCustomer?.name ?? '').trim() || null,
  }
}

export default function DriveContractsFoundModal({ open, onClose, jobs, onFiled }: { open: boolean; onClose: () => void; jobs: JobWithDetails[]; onFiled: (jobIds: string[]) => void }) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; files: DriveScanFile[]; jobFolders: number; scanned: number }>({ kind: 'loading' })
  const [group, setGroup] = useState<Group>('confident')
  const [filedIds, setFiledIds] = useState<ReadonlySet<string>>(() => new Set())
  const [busy, setBusy] = useState<'all' | string | null>(null)

  useEffect(() => {
    if (!open) return
    setState({ kind: 'loading' })
    setFiledIds(new Set())
    setGroup('confident')
    void (async () => {
      const { data, error } = await supabase.functions.invoke('drive-contract-scan', { body: {} })
      const res = (data ?? {}) as { ok?: boolean; files?: DriveScanFile[]; job_folders?: number; scanned?: number; error?: string }
      if (error || !res.ok) {
        setState({ kind: 'error', message: res.error || error?.message || 'Could not read Drive.' })
        return
      }
      setState({ kind: 'ready', files: res.files ?? [], jobFolders: res.job_folders ?? 0, scanned: res.scanned ?? 0 })
    })()
  }, [open])

  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs])
  const matches = useMemo<DriveContractMatch[]>(() => (state.kind === 'ready' ? matchDriveContracts(state.files, jobs.map(driveMatchJobFrom)) : []), [state, jobs])
  const live = matches.filter((m) => !(m.jobId && filedIds.has(m.jobId)))
  const summary = summarizeDriveMatches(live)
  const rows = live.filter((m) => m.confidence === group)
  const confidentRows = live.filter((m) => m.confidence === 'confident' && m.jobId)
  // One file per job when several confident files land on one job — the newest.
  const confidentByJob = useMemo(() => {
    const map = new Map<string, DriveContractMatch>()
    for (const m of confidentRows) {
      const prev = map.get(m.jobId!)
      if (!prev || String(m.file.modifiedTime ?? '') > String(prev.file.modifiedTime ?? '')) map.set(m.jobId!, m)
    }
    return map
  }, [confidentRows])

  const fileOne = async (m: DriveContractMatch): Promise<boolean> => {
    const job = m.jobId ? jobById.get(m.jobId) : null
    if (!job || !m.file.webViewLink) return false
    const { row } = await fileSignedJobContract({
      jobId: job.id,
      existingDraft: null,
      basePayload: null,
      signerName: (job.customer_name ?? '').trim() || (job.gcCustomer?.name ?? '').trim() || 'Customer',
      signedOn: signedOnFromModified(m.file.modifiedTime),
      link: m.file.webViewLink,
      file: null,
      authUserId: authUser?.id ?? null,
    })
    return row != null
  }

  const fileConfident = async () => {
    setBusy('all')
    const done: string[] = []
    try {
      for (const m of confidentByJob.values()) {
        if (await fileOne(m)) done.push(m.jobId!)
      }
      setFiledIds((prev) => new Set([...prev, ...done]))
      showToast(`Filed ${done.length} signed contract${done.length === 1 ? '' : 's'} from Drive.`, 'success')
      if (done.length > 0) onFiled(done)
    } catch {
      showToast('Filing stopped on an error — the rows already filed stay filed.', 'error')
      if (done.length > 0) onFiled(done)
    } finally {
      setBusy(null)
    }
  }
  const fileRow = async (m: DriveContractMatch) => {
    if (!m.jobId) return
    setBusy(m.file.id)
    try {
      if (await fileOne(m)) {
        setFiledIds((prev) => new Set([...prev, m.jobId!]))
        showToast('Filed from Drive — the job reads signed.', 'success')
        onFiled([m.jobId])
      } else showToast('Could not file that one.', 'error')
    } catch {
      showToast('Could not file that one.', 'error')
    } finally {
      setBusy(null)
    }
  }

  if (!open) return null
  const counts: Record<Group, number> = { confident: summary.confident, check: summary.check, none: summary.none }

  return (
    <ResponsiveModalShell
      title="Found in Drive"
      onRequestClose={onClose}
      maxWidthDesktop={880}
      zIndex={1200}
      footer={
        state.kind === 'ready' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Files each as <b>✍ On file · Google Doc</b> with the Drive link · signed on = the file's date · signer = the job's customer. Nothing is sent to anyone.</span>
            <span style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" style={btn} onClick={onClose} disabled={busy != null}>
                Close
              </button>
              <button type="button" style={btnPrimary} disabled={busy != null || confidentByJob.size === 0} onClick={() => void fileConfident()} data-testid="drive-file-confident">
                {busy === 'all' ? 'Filing…' : `File the ${confidentByJob.size} confident`}
              </button>
            </span>
          </div>
        ) : undefined
      }
    >
      {state.kind === 'loading' ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Reading the jobs Shared Drive…</p>
      ) : state.kind === 'error' ? (
        <div style={{ padding: '0.6rem 0.8rem', borderRadius: 8, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.85rem' }} data-testid="drive-scan-error">
          {state.message}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem 1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }} data-testid="drive-summary">
              <b style={{ color: 'var(--text-strong)' }}>{state.files.length} contract-looking file{state.files.length === 1 ? '' : 's'}</b> in {state.jobFolders} job folders · {jobs.length} jobs without a contract · {summary.jobsCovered} covered by a confident match
              {filedIds.size > 0 ? ` · ${filedIds.size} filed` : ''}
            </div>
            <div role="group" aria-label="Which matches to show" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {(['confident', 'check', 'none'] as Group[]).map((g) => (
                <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)} style={segStyle(group === g)}>
                  {GROUP_LABEL[g]} · {counts[g]}
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{group === 'confident' ? 'No confident matches left.' : group === 'check' ? 'Nothing to check.' : 'Every file matched a job.'}</p>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: '60vh', overflowY: 'auto' }}>
              {rows.map((m) => {
                const job = m.jobId ? jobById.get(m.jobId) : null
                const num = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : null
                return (
                  <div key={m.file.id} data-testid="drive-row" data-confidence={m.confidence} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.1rem 0.75rem', alignItems: 'center', padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
                    <div style={{ minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job ? (
                        <>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>J{num}</span> · {(job.job_name ?? '').trim() || 'Job'}
                          {(job.customer_name ?? '').trim() ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · {(job.customer_name ?? '').trim()}</span> : null}
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Folder “{m.file.folderName}”</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: job && Number(job.revenue ?? 0) > 0 ? 'inherit' : 'var(--text-faint)' }}>{job && Number(job.revenue ?? 0) > 0 ? formatUsdNoCents(Number(job.revenue)) : ''}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span aria-hidden>{m.file.mimeType.includes('google-apps') ? '📝' : '📄'} </span>
                      {m.file.webViewLink ? (
                        <a href={m.file.webViewLink} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                          {m.file.name}
                        </a>
                      ) : (
                        m.file.name
                      )}
                      {m.file.modifiedTime ? ` · ${signedOnFromModified(m.file.modifiedTime)}` : ''} · in <i>{m.file.folderName}</i> · {m.reason}
                    </div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                      {m.kind === 'subcontract' ? <span style={chip('blue')}>GC subcontract</span> : null}
                      <span style={chip(m.confidence === 'confident' ? 'green' : m.confidence === 'check' ? 'amber' : 'muted')}>{GROUP_LABEL[m.confidence]}</span>
                      {m.jobId && m.confidence !== 'none' ? (
                        <button type="button" style={{ ...btn, padding: '0.15rem 0.5rem', fontSize: '0.72rem' }} disabled={busy != null} onClick={() => void fileRow(m)}>
                          {busy === m.file.id ? 'Filing…' : 'File'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </ResponsiveModalShell>
  )
}
