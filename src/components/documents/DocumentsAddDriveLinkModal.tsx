import { useCallback, useEffect, useState } from 'react'
import { checkGoogleDriveAttachmentUrl } from '../../lib/checkGoogleDriveAttachmentUrl'
import { normalizeCustomerAttachmentUrl } from '../../lib/estimateCustomerAttachment'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

export type DocumentsBidLinkColumn = 'submission' | 'folder'

type DocumentsAddDriveLinkModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string | null
  initialUrl?: string
  /**
   * For bids: which column to update. When null, show radios (both links empty).
   */
  bidSaveColumn: DocumentsBidLinkColumn | null
  /** When true, user must pick submission vs folder before Save (bidSaveColumn null). */
  bidNeedsTargetChoice: boolean
  onSave: (normalizedUrl: string, bidTarget: DocumentsBidLinkColumn | null) => Promise<void>
}

export default function DocumentsAddDriveLinkModal({
  open,
  onClose,
  title,
  description,
  initialUrl = '',
  bidSaveColumn,
  bidNeedsTargetChoice,
  onSave,
}: DocumentsAddDriveLinkModalProps) {
  const { showToast } = useToastContext()
  const [url, setUrl] = useState('')
  const [bidPick, setBidPick] = useState<DocumentsBidLinkColumn>('submission')
  const [checkStatus, setCheckStatus] = useState<'idle' | 'loading' | 'success' | 'warn' | 'error'>('idle')
  const [checkMessage, setCheckMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setUrl(initialUrl)
    setBidPick('submission')
    setCheckStatus('idle')
    setCheckMessage('')
    setSaving(false)
  }, [open, initialUrl])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, saving])

  const urlIsCheckable = Boolean(normalizeCustomerAttachmentUrl(url))
  const effectiveBidTarget: DocumentsBidLinkColumn | null = bidNeedsTargetChoice ? bidPick : bidSaveColumn

  const runCheck = useCallback(async () => {
    const u = normalizeCustomerAttachmentUrl(url)
    if (!u) {
      showToast('Enter a valid https URL first.', 'error')
      return
    }
    setCheckStatus('loading')
    setCheckMessage('')
    const result = await checkGoogleDriveAttachmentUrl(url)
    if (result.status === 'error' && result.message === 'Not signed in.') {
      showToast('Not signed in', 'error')
    }
    setCheckStatus(
      result.status === 'success' ? 'success' : result.status === 'warn' ? 'warn' : 'error',
    )
    setCheckMessage(result.message)
  }, [url, showToast])

  async function handleSave() {
    const u = normalizeCustomerAttachmentUrl(url)
    if (!u) {
      showToast('Enter a valid https URL (https only).', 'error')
      return
    }
    setSaving(true)
    try {
      await onSave(u, effectiveBidTarget)
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save link'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const checkMessageColor =
    checkStatus === 'success' ? '#15803d' : checkStatus === 'warn' ? '#a16207' : '#b91c1c'

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 85,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="documents-add-drive-link-title"
        style={{
          width: '100%',
          maxWidth: 440,
          maxHeight: 'min(90vh, 640px)',
          overflow: 'auto',
          background: 'var(--surface)',
          borderRadius: 8,
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2 id="documents-add-drive-link-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
            {title}
          </h2>
          <button type="button" onClick={onClose} disabled={saving} style={{ padding: '0.35rem 0.75rem' }}>
            Close
          </button>
        </div>
        <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
          {description ? (
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-600)' }}>{description}</p>
          ) : null}

          {bidNeedsTargetChoice ? (
            <fieldset style={{ margin: '0 0 0.85rem', padding: 0, border: 'none' }}>
              <legend style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.35rem' }}>
                Link type
              </legend>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                <input
                  type="radio"
                  name="documents-bid-link-type"
                  checked={bidPick === 'submission'}
                  onChange={() => setBidPick('submission')}
                />
                Bid submission document
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="radio"
                  name="documents-bid-link-type"
                  checked={bidPick === 'folder'}
                  onChange={() => setBidPick('folder')}
                />
                Project folder (Drive)
              </label>
            </fieldset>
          ) : null}

          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-700)' }}>
            Google Drive or Docs URL (https only)
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
              autoComplete="off"
              style={{
                display: 'block',
                width: '100%',
                marginTop: '0.35rem',
                padding: '0.5rem',
                boxSizing: 'border-box',
                font: 'inherit',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
              }}
            />
          </label>

          <div style={{ marginTop: '0.65rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => void runCheck()}
              disabled={checkStatus === 'loading' || !urlIsCheckable}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.85rem',
                cursor: urlIsCheckable ? 'pointer' : 'not-allowed',
                opacity: urlIsCheckable ? 1 : 0.65,
              }}
            >
              {checkStatus === 'loading' ? 'Checking…' : 'Check link'}
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Drive or Docs URLs only. Does not block saving — hints only.
            </span>
          </div>
          {checkMessage ? (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: checkMessageColor }} role="status">
              {checkMessage}
            </p>
          ) : null}

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} disabled={saving} style={{ padding: '0.45rem 0.9rem' }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !normalizeCustomerAttachmentUrl(url)}
              style={{ padding: '0.45rem 0.9rem', fontWeight: 600 }}
            >
              {saving ? 'Saving…' : 'Save link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
