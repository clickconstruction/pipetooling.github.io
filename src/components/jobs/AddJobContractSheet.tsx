/**
 * Add the contract (v2.4301): file a contract that is already signed — a Drive link or a scan —
 * and tick the other jobs of the same customer the paper names. Never every job: the anchor
 * job is always on it, every other job is the office's tick. The same sheet edits which jobs a
 * paper covers (`mode: 'edit'`, from the Customer page's Agreements card).
 */
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { FinishedDateInput } from '../FinishedDateInput'
import { isHttpUrl } from '../../lib/jobs/jobContractDocument'
import { buildCoverableJobs, coversEditDiff, coversSheetWords, type CoversPaper } from '../../lib/jobs/jobContractCovers'
import {
  coveredJobIds,
  fileContractForJobs,
  loadContractRowsForJobs,
  loadPartyJobs,
  saveCoveredJobs,
  type PartyJob,
} from '../../lib/jobs/jobContractCoversWrite'
import type { JobContractRow } from '../../lib/jobs/jobContractLifecycle'

export type AddJobContractSheetProps = {
  open: boolean
  onClose: () => void
  /** After a filing or a save (the parent reloads its coverage). */
  onDone?: () => void
  mode: 'add' | 'edit'
  /** The job the sheet was opened from; always covered. Null from the Customer page. */
  anchorJob: { id: string; num: string; where: string } | null
  /** The customer and the GC of the anchor job, or the Customer page's customer. */
  partyIds: string[]
  /** The name the paper is filed as signed by, until the office types another. */
  signerName: string
  /** One line under the title: "Job 251 · Michael Palmer is the GC on this job". */
  subtitle: string
  /** Edit mode: the paper whose jobs are being changed. */
  paper?: CoversPaper | null
  overlayZIndex?: number
}

const field: React.CSSProperties = {
  font: 'inherit',
  fontSize: '0.85rem',
  padding: '0.5rem 0.65rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'inherit',
  minWidth: 0,
}
const label: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-strong)' }

export default function AddJobContractSheet(p: AddJobContractSheetProps) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [jobs, setJobs] = useState<PartyJob[]>([])
  const [rows, setRows] = useState<JobContractRow[]>([])
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [showPaid, setShowPaid] = useState(false)
  const [link, setLink] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [signer, setSigner] = useState(p.signerName)
  const [signedOn, setSignedOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const partyKey = p.partyIds.join(',')
  useEffect(() => {
    if (!p.open) return
    setPicked(new Set(p.mode === 'edit' && p.paper ? p.paper.jobIds : []))
    setShowPaid(false)
    setLink('')
    setFile(null)
    setScanOpen(false)
    setSigner(p.signerName)
    setSignedOn('')
    setError(null)
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const list = await loadPartyJobs(p.partyIds)
        const contractRows = await loadContractRowsForJobs(list.map((j) => j.id))
        if (cancelled) return
        setJobs(list)
        setRows(contractRows)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the jobs.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per open and per customer
  }, [p.open, partyKey, p.mode, p.paper?.key])

  const anchorId = p.anchorJob?.id ?? null
  const covered = useMemo(() => coveredJobIds(rows, p.mode === 'edit' ? (p.paper?.key ?? null) : null), [rows, p.mode, p.paper?.key])
  const list = useMemo(() => buildCoverableJobs(jobs, anchorId, covered), [jobs, anchorId, covered])
  const open = list.filter((j) => !j.paid)
  const paid = list.filter((j) => j.paid)
  const pickedNums = [...(p.anchorJob ? [p.anchorJob.num] : []), ...list.filter((j) => picked.has(j.id)).map((j) => j.num)]
  const words = coversSheetWords(pickedNums, p.mode)
  const linkTyped = link.trim()
  const linkBad = linkTyped.length > 0 && !isHttpUrl(linkTyped)
  const hasPaper = isHttpUrl(linkTyped) || file != null
  const canSubmit =
    !busy &&
    !loading &&
    pickedNums.length > 0 &&
    (p.mode === 'edit' || (hasPaper && signer.trim().length > 0))

  if (!p.open) return null

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      if (p.mode === 'edit' && p.paper) {
        const diff = coversEditDiff(p.paper.jobIds, [...picked])
        await saveCoveredJobs({ paper: p.paper, rows, add: diff.add, remove: diff.remove, authUserId: user?.id ?? null })
        showToast('Saved. The paper covers the jobs you ticked.', 'success')
      } else {
        const ids = [...(anchorId ? [anchorId] : []), ...list.filter((j) => picked.has(j.id)).map((j) => j.id)]
        const r = await fileContractForJobs({ jobIds: ids, signerName: signer, signedOn, link, file, authUserId: user?.id ?? null })
        showToast(
          r.uploadError
            ? `Filed for ${r.filed === 1 ? 'this job' : `${r.filed} jobs`}, but the scan did not upload: ${r.uploadError}`
            : `Filed for ${r.filed === 1 ? 'this job' : `${r.filed} jobs`}. Nothing was sent to the customer.`,
          r.uploadError ? 'warning' : 'success',
        )
      }
      p.onDone?.()
      p.onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not file the contract.')
    } finally {
      setBusy(false)
    }
  }

  const row = (j: (typeof list)[number]) => {
    const on = picked.has(j.id)
    const disabled = j.coveredElsewhere || busy
    return (
      <label
        key={j.id}
        data-testid="contract-covers-job"
        title={j.coveredElsewhere ? 'Another signed contract already covers this job.' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.5rem 0.7rem',
          borderRadius: 8,
          fontSize: '0.82rem',
          cursor: disabled ? 'default' : 'pointer',
          border: `1px solid ${on ? 'var(--border-green-soft)' : 'var(--border)'}`,
          background: on ? 'var(--bg-green-tint)' : 'var(--surface)',
          opacity: j.coveredElsewhere ? 0.6 : 1,
        }}
      >
        <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(j.id)} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <b>{j.num}</b>
          {j.where ? ` · ${j.where}` : ''}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{j.coveredElsewhere ? 'Has a contract' : j.statusWord}</span>
      </label>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: p.overlayZIndex ?? 1300,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) p.onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-contract-title"
        data-testid="add-job-contract-sheet"
        style={{
          background: 'var(--surface)',
          color: 'var(--text-strong)',
          borderRadius: 10,
          width: 'min(520px, 100%)',
          maxHeight: 'min(90vh, 100%)',
          overflow: 'auto',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
        }}
      >
        <div>
          <h2 id="add-contract-title" style={{ margin: 0, fontSize: '1.1rem' }}>
            {p.mode === 'edit' ? 'Change the jobs' : 'Add the contract'}
          </h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{p.subtitle}</div>
        </div>

        {p.mode === 'add' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label htmlFor="add-contract-link" style={label}>
              Link to the signed contract
            </label>
            <input
              id="add-contract-link"
              type="url"
              inputMode="url"
              value={link}
              disabled={busy}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste the Google Drive link"
              style={{ ...field, borderColor: linkBad ? 'var(--text-red-700)' : isHttpUrl(linkTyped) ? '#059669' : 'var(--border-strong)' }}
            />
            {linkBad ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-red-700)' }}>That is not a link yet. In Drive, use Share and then Copy link.</div>
            ) : null}
            {scanOpen ? (
              <input
                type="file"
                aria-label="A scan or photo of the signed contract"
                accept="application/pdf,image/*"
                disabled={busy}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: '0.8rem' }}
              />
            ) : (
              <button type="button" onClick={() => setScanOpen(true)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.78rem', color: 'var(--text-link)', cursor: 'pointer' }}>
                Have a scan or photo instead?
              </button>
            )}
          </div>
        ) : p.paper ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-700)' }}>
            Signed by {p.paper.signerName ?? 'the customer'}
            {p.paper.documentUrl ? (
              <>
                {' · '}
                <a href={p.paper.documentUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600 }}>
                  Open ↗
                </a>
              </>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={label}>Which jobs does it cover?</div>
          {p.anchorJob ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.5rem 0.7rem',
                borderRadius: 8,
                fontSize: '0.82rem',
                border: '1px solid var(--border-green-soft)',
                background: 'var(--bg-green-tint)',
              }}
            >
              <input type="checkbox" checked disabled aria-label={`Job ${p.anchorJob.num}, this job`} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{p.anchorJob.num}</b>
                {p.anchorJob.where ? ` · ${p.anchorJob.where}` : ''}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-green-800)' }}>This job</span>
            </div>
          ) : null}
          {loading ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading their jobs…</div>
          ) : open.length + paid.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>They have no other jobs.</div>
          ) : (
            <>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {p.anchorJob ? 'Tick any other job the paper names.' : 'Tick every job the paper names.'}
              </div>
              {open.map(row)}
              {paid.length > 0 ? (
                showPaid ? (
                  paid.map(row)
                ) : (
                  <button type="button" onClick={() => setShowPaid(true)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.78rem', color: 'var(--text-link)', cursor: 'pointer' }}>
                    Show their {paid.length} paid {paid.length === 1 ? 'job' : 'jobs'}
                  </button>
                )
              ) : null}
            </>
          )}
        </div>

        {p.mode === 'add' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
              <label htmlFor="add-contract-signer" style={label}>
                Signed by
              </label>
              <input id="add-contract-signer" type="text" value={signer} disabled={busy} onChange={(e) => setSigner(e.target.value)} style={field} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
              <label htmlFor="add-contract-date" style={label}>
                Signed on
              </label>
              <FinishedDateInput id="add-contract-date" value={signedOn || null} disabled={busy} onCommit={(v) => setSignedOn(v ?? '')} style={field} />
            </div>
          </div>
        ) : null}

        <div style={{ fontSize: '0.82rem', color: 'var(--text-700)', lineHeight: 1.45 }} data-testid="add-contract-summary">
          {words.summary}
          {p.mode === 'add' ? ' Nothing is sent to the customer.' : ''}
          {p.mode === 'add' && !signedOn ? ' A blank date files it as signed today.' : ''}
        </div>
        {error ? <div style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{error}</div> : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} onClick={p.onClose} style={{ ...field, cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            data-testid="add-contract-submit"
            style={{
              font: 'inherit',
              fontSize: '0.85rem',
              fontWeight: 600,
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: 'none',
              background: canSubmit ? '#047857' : 'var(--bg-muted)',
              color: canSubmit ? 'white' : 'var(--text-faint)',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? 'Filing…' : words.button}
          </button>
        </div>
      </div>
    </div>
  )
}
