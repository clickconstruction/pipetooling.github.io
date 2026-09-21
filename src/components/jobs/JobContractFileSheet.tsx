/**
 * File a signed contract (v2.2744's sheet, shared since Contract sweep PR 4):
 * a Google Doc link first, the scan or photo in a corner, who signed and
 * when, one button. The Contract modal mounts it as a stacked sheet; the
 * sweep mounts it inline in the pane (and prefilled with a file dropped on a
 * row). The write is `fileSignedJobContract` — one path for all three doors.
 */
import { useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { isGoogleDocsUrl, isHttpUrl, shortDocumentLabel } from '../../lib/jobs/jobContractDocument'
import type { JobContractDraftPayload } from '../../lib/jobs/jobContractDraftWrite'
import { fileSignedContractReady, fileSignedJobContract } from '../../lib/jobs/jobContractFileWrite'
import type { JobContractRow } from '../../lib/jobs/jobContractLifecycle'

const labelStyle: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }
const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.4rem 0.55rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.85rem',
}
const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '0.4rem 0.75rem', alignItems: 'center', margin: '0.35rem 0' }
const btn: CSSProperties = {
  padding: '0.4rem 0.8rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
}
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }

export type JobContractFileSheetProps = {
  jobId: string
  /** Who signs by default — the recipient the office typed, else the job's customer. */
  defaultSignerName: string
  /** The job's live draft, if any — it converts in place. */
  existingDraft: JobContractRow | null
  /** The document fields + terms + recipient the record keeps (the caller's payload); null = the job id alone. */
  basePayload: JobContractDraftPayload | null
  /** A scan or photo already chosen (a file dropped on a sweep row). */
  initialFile?: File | null
  /** A link already known — the sweep's Drive pass found the file. It arrives committed, to be checked and filed. */
  initialLink?: string
  /** The signed-on date to start from ('' = not recorded). Omitted = today, as the Contract modal's sheet has always done. */
  initialSignedOn?: string
  /** A line over the link saying where it came from ("Found in Drive · confident — …"). */
  foundNote?: React.ReactNode
  /** The record button's words — the sweep says "File it & next". */
  recordLabel?: string
  /** The Cancel button's words, or null to leave it out (the sweep's door switch is the way back). */
  cancelLabel?: string | null
  /** 'sheet' stacks a modal (the Contract modal); 'inline' renders a card in place (the sweep's pane). */
  layout: 'sheet' | 'inline'
  /** The heading over an inline card — "File Summit GC's subcontract" on a GC job. */
  inlineTitle?: string
  onFiled: (row: JobContractRow) => void
  onCancel: () => void
}

export default function JobContractFileSheet({ jobId, defaultSignerName, existingDraft, basePayload, initialFile = null, initialLink = '', initialSignedOn, foundNote, recordLabel = 'Record as signed', cancelLabel = 'Cancel', layout, inlineTitle, onFiled, onCancel }: JobContractFileSheetProps) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [signedOn, setSignedOn] = useState(() => (initialSignedOn === undefined ? todayYmdInAppTz() : initialSignedOn))
  const [signerName, setSignerName] = useState('')
  const [file, setFile] = useState<File | null>(initialFile)
  const [link, setLink] = useState(initialLink)
  /** The green "linked" line only after a paste / Enter / blur — typing keeps the input mounted (v2.2744). */
  const [linkCommitted, setLinkCommitted] = useState(() => isHttpUrl(initialLink))
  const [attachOpen, setAttachOpen] = useState(initialFile != null)
  const [busy, setBusy] = useState(false)

  const effectiveName = signerName.trim() || defaultSignerName.trim()
  const ready = fileSignedContractReady({ link, file, signerName: effectiveName })

  const record = async () => {
    if (busy) return
    if (!effectiveName) {
      showToast('Enter who signed the contract.', 'error')
      return
    }
    if (!isHttpUrl(link.trim()) && !file) {
      showToast('Paste the Google Doc link, or attach a scan.', 'error')
      return
    }
    setBusy(true)
    try {
      const { row, uploadError } = await fileSignedJobContract({ jobId, existingDraft, basePayload, signerName: effectiveName, signedOn, link, file, authUserId: authUser?.id ?? null })
      if (!row) {
        showToast('Could not record the paper contract.', 'error')
        return
      }
      if (uploadError) showToast('Recorded the paper signature, but the file did not upload (storage bucket not ready).', 'error')
      else showToast('Signed contract filed — the job now reads signed.', 'success')
      onFiled(row)
    } catch {
      showToast('Could not record the paper contract.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const body = (
    <div style={{ fontSize: '0.85rem', display: 'grid', gap: '0.7rem' }} data-testid="contract-file-sheet">
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Already signed outside the app? Paste the Google Doc and the job reads signed. Nothing is sent to the customer.</div>
      {foundNote}
      {linkCommitted && isHttpUrl(link) ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.7rem', borderRadius: 8, background: 'var(--bg-green-tint)', border: '1px solid var(--border)', color: 'var(--text-green-800)', fontSize: '0.8rem' }}>
          <span aria-hidden style={{ width: 16, height: 20, borderRadius: 3, background: 'var(--text-link)', flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <b>{isGoogleDocsUrl(link) ? 'Google Doc linked' : 'Link filed'}</b> · {shortDocumentLabel(link)}
          </span>
          <button
            type="button"
            onClick={() => {
              setLink('')
              setLinkCommitted(false)
            }}
            style={{ ...btn, padding: '0.15rem 0.5rem', fontSize: '0.72rem', borderColor: 'transparent', background: 'transparent', color: 'var(--text-muted)' }}
          >
            change
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.7rem 0.85rem', borderRadius: 10, border: '1.5px dashed var(--text-link)', background: 'var(--bg-blue-tint)' }}>
          <span aria-hidden style={{ width: 30, height: 38, borderRadius: 4, background: 'var(--text-link)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.88rem' }}>Paste the Google Doc link</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Share → Copy link in Google Docs, then paste it here.</div>
            <input
              style={{ ...inputStyle, marginTop: '0.4rem' }}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={() => {
                if (isHttpUrl(link)) setLinkCommitted(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isHttpUrl(link)) {
                  e.preventDefault()
                  setLinkCommitted(true)
                }
              }}
              onPaste={(e) => {
                const t = e.clipboardData.getData('text')
                if (t) {
                  e.preventDefault()
                  setLink(t.trim())
                  setLinkCommitted(isHttpUrl(t))
                }
              }}
              placeholder="https://docs.google.com/document/d/…"
              inputMode="url"
              aria-label="Google Doc link"
              autoFocus={layout === 'sheet' && initialFile == null}
            />
            {link.trim() && !isHttpUrl(link) ? (
              <div style={{ marginTop: '0.35rem', fontSize: '0.74rem', color: 'var(--text-orange-800)', background: 'var(--bg-orange-tint)', borderRadius: 6, padding: '0.3rem 0.5rem' }}>
                That isn&apos;t a link yet — paste the doc&apos;s Share link, or attach a file below.
              </div>
            ) : null}
          </div>
        </div>
      )}
      {linkCommitted && isHttpUrl(link) && !isGoogleDocsUrl(link) ? (
        <div style={{ fontSize: '0.74rem', color: 'var(--text-orange-800)', background: 'var(--bg-orange-tint)', borderRadius: 6, padding: '0.3rem 0.5rem' }}>
          That isn&apos;t a Google link. It will be filed as-is — paste the doc&apos;s Share link if you have one.
        </div>
      ) : null}
      <div style={rowStyle}>
        <span style={labelStyle}>Signed by</span>
        <input style={inputStyle} value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder={defaultSignerName.trim() || 'Customer name'} aria-label="Who signed" />
        <span style={labelStyle}>Signed on</span>
        <input style={{ ...inputStyle, maxWidth: 180 }} type="date" value={signedOn} onChange={(e) => setSignedOn(e.target.value)} aria-label="Date the contract was signed" />
      </div>
      {attachOpen ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem', background: 'var(--bg-subtle)', display: 'grid', gap: '0.35rem', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>Scan or photo</b>
            <button
              type="button"
              onClick={() => {
                setAttachOpen(false)
                setFile(null)
              }}
              style={{ ...btn, padding: '0.1rem 0.4rem', fontSize: '0.7rem', borderColor: 'transparent', background: 'transparent', color: 'var(--text-muted)' }}
            >
              optional · hide
            </button>
          </div>
          {file ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }} data-testid="contract-file-chosen">
              <span style={{ fontWeight: 600 }}>{file.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{Math.max(1, Math.round(file.size / 1024))} KB · kept with the job</span>
              <button type="button" onClick={() => setFile(null)} style={{ ...btn, padding: '0.1rem 0.4rem', fontSize: '0.7rem', borderColor: 'transparent', background: 'transparent', color: 'var(--text-muted)' }}>
                change
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="file" accept="image/png,image/jpeg,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: '0.78rem' }} aria-label="Scan or photo of the signed contract" />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>PNG, JPG or PDF · kept with the job</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'right' }}>
          <button type="button" onClick={() => setAttachOpen(true)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.72rem', color: 'var(--text-faint)', textDecoration: 'underline dotted', cursor: 'pointer' }}>
            Have a scan or photo instead?
          </button>
        </div>
      )}
    </div>
  )
  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
      {cancelLabel ? (
        <button type="button" style={btn} disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </button>
      ) : null}
      <button type="button" style={{ ...btnPrimary, opacity: ready ? 1 : 0.55 }} disabled={busy || !ready} onClick={() => void record()} title={ready ? undefined : 'Paste the Google Doc link, or attach a scan'} data-testid="contract-file-record">
        {busy ? 'Recording…' : recordLabel}
      </button>
    </div>
  )

  if (layout === 'sheet') {
    return (
      <ResponsiveModalShell title="File a signed contract" onRequestClose={onCancel} maxWidthDesktop={540} zIndex={1300} footer={footer}>
        {body}
      </ResponsiveModalShell>
    )
  }
  return (
    <div style={{ border: '1.5px dashed var(--text-link)', borderRadius: 10, padding: '0.75rem 0.85rem', display: 'grid', gap: '0.7rem', background: 'var(--surface)' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{inlineTitle ?? 'File a signed contract'}</div>
      {body}
      {footer}
    </div>
  )
}
