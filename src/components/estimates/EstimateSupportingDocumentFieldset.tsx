import { normalizeCustomerAttachmentUrl } from '../../lib/estimateCustomerAttachment'
import { estInputBase, estSmallPrimaryButton, estSmallSecondaryButton } from './estimatesPageStyles'

export type EstimateAttachmentCheckStatus = 'idle' | 'loading' | 'success' | 'warn' | 'error'

export interface EstimateSupportingDocumentFieldsetProps {
  label: string
  url: string
  onLabelChange: (label: string) => void
  onUrlChange: (url: string) => void
  /** Check link's last answer. The page holds it, since its reload blanks the editor and the answer should outlive a Save draft. */
  checkStatus: EstimateAttachmentCheckStatus
  checkMessage: string
  onCheck: () => void
}

/**
 * Supporting document on a draft estimate: a label, a link, Check link with its hint, and how to share
 * a file in Drive. Moved from `EstimateDetail` (v2.7618, punch list #46 row 3, cut 4 of the Estimates
 * map); the JSX is the page's own. The fieldset sits inside the draft-only editor, so the two branches
 * that drew a sent estimate's document here could never show and did not move.
 */
export default function EstimateSupportingDocumentFieldset({ label, url, onLabelChange, onUrlChange, checkStatus, checkMessage, onCheck }: EstimateSupportingDocumentFieldsetProps) {
  const urlIsCheckable = Boolean(normalizeCustomerAttachmentUrl(url))
  return (
    <fieldset
      style={{
        marginTop: '1rem',
        marginLeft: 'auto',
        marginRight: 'auto',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.75rem',
        maxWidth: 560,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <legend style={{ fontWeight: 500, padding: '0 0.35rem' }}>Supporting document (Optional)</legend>
      <>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500 }}>
          Label
          <input
            type="text"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="e.g. Floor plan, Scope PDF"
            maxLength={200}
            style={{
              ...estInputBase,
              display: 'block',
              width: '100%',
              marginTop: '0.25rem',
              padding: '0.5rem',
              boxSizing: 'border-box',
              font: 'inherit',
            }}
          />
        </label>
        <label style={{ display: 'block', marginTop: '0.65rem', fontSize: '0.85rem', fontWeight: 500 }}>
          Document URL (https only)
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://drive.google.com/file/d/…"
            style={{
              ...estInputBase,
              display: 'block',
              width: '100%',
              marginTop: '0.25rem',
              padding: '0.5rem',
              boxSizing: 'border-box',
              font: 'inherit',
            }}
          />
        </label>
        <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onCheck}
            disabled={checkStatus === 'loading' || !urlIsCheckable}
            style={
              urlIsCheckable ?
                estSmallPrimaryButton(checkStatus === 'loading')
              : {
                  ...estSmallSecondaryButton(),
                  cursor: 'not-allowed',
                  opacity: 0.65,
                }
            }
          >
            {checkStatus === 'loading' ? 'Checking…' : 'Check link'}
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Drive or Docs URLs only. Does not block sending — hints only.
          </span>
        </div>
        {checkStatus === 'success' && checkMessage ? (
          <p
            role="status"
            style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-green-600)', lineHeight: 1.45 }}
          >
            {checkMessage}
          </p>
        ) : null}
        {checkStatus === 'warn' && checkMessage ? (
          <p
            role="status"
            style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-amber-700)', lineHeight: 1.45 }}
          >
            {checkMessage}
          </p>
        ) : null}
        {checkStatus === 'error' && checkMessage ? (
          <p role="alert" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-red-700)', lineHeight: 1.45 }}>
            {checkMessage}
          </p>
        ) : null}
      </>
      <details style={{ margin: '0.65rem 0 0', fontSize: '0.85rem', color: 'var(--text-700)', textAlign: 'center' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--text-gray-800)' }}>
          How to share a file in Google Drive
        </summary>
        <div style={{ textAlign: 'left', marginTop: '0.5rem' }}>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.45 }}>
            <li>Open the file in Drive, then choose Share.</li>
            <li>
              Set access to <strong>Anyone with the link</strong> and role <strong>Viewer</strong> (or your org’s
              equivalent for external viewers).
            </li>
            <li>Copy the link and paste it below.</li>
          </ol>
          <p style={{ margin: '0.5rem 0 0', lineHeight: 1.45 }}>
            Some <strong>Google Workspace</strong> policies prevent “anyone with the link” for people outside your
            org. If that applies, customers may still see a sign-in wall even when the steps above are correct.
          </p>
          <p style={{ margin: '0.5rem 0 0', lineHeight: 1.45 }}>
            Official help:{' '}
            <a
              href="https://support.google.com/drive/answer/2494822"
              target="_blank"
              rel="noopener noreferrer"
            >
              Share files from Google Drive
            </a>
            .
          </p>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', lineHeight: 1.45 }}>
            <li>
              If you are unsure the customer can open it, open the link in a <strong>private or incognito</strong>{' '}
              window (signed out) to double-check.
            </li>
          </ul>
        </div>
      </details>
    </fieldset>
  )
}
