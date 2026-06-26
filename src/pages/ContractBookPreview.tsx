import { useEffect, useMemo, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { parseContractPreviewEntry } from '../lib/contractBookPreviewHandoff'
import { renderContractBodyToSafeHtml } from '../lib/renderContractBodyToSafeHtml'
import { buildContractRichTextDocument, type ContractBookExportEntry } from '../lib/contractRichTextDocument'

/**
 * Standalone full-page preview of a single Contract Book entry, opened in a new
 * tab from People → Contracts → Contract Book → Preview. The entry is handed
 * over via a same-origin localStorage key (`?k=…`), written by
 * `openContractBookEntryPreview`. Rendering this as a real app page (rather than
 * a synthetic `blob:`/`about:blank` document) means the Download button runs in
 * the real app origin, where Chromium/Brave permit the `.doc` download.
 */

/** Descendant styles for the sanitized body HTML + print rules (toolbar hidden when printing). */
const PREVIEW_STYLES = `
.cbp-body{font-size:1rem;line-height:1.6;word-break:break-word;}
.cbp-body table{border-collapse:collapse;}
.cbp-body th,.cbp-body td{border:1px solid #d1d5db;padding:0.4rem 0.6rem;}
.cbp-body h1,.cbp-body h2,.cbp-body h3,.cbp-body h4{line-height:1.3;}
.cbp-body a{color:#2563eb;}
@media print{
  body{background:#fff;}
  .cbp-toolbar{display:none !important;}
  .cbp-page{max-width:none;margin:0;border:none;border-radius:0;box-shadow:none;padding:0;}
}
`

const pageBgStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#f3f4f6',
  color: '#111827',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

export default function ContractBookPreview() {
  const [params] = useSearchParams()
  const key = params.get('k')

  const entry = useMemo<ContractBookExportEntry | null>(() => {
    if (!key) return null
    let raw: string | null = null
    try {
      raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
    } catch {
      raw = null
    }
    return parseContractPreviewEntry(raw)
  }, [key])

  const title = entry?.document_name.trim() || 'Contract'

  useEffect(() => {
    if (entry) document.title = title
  }, [entry, title])

  // Build the .doc once and expose it as a real anchor href. A genuine user
  // click on an actual download link is the most browser-permissive trigger:
  // Brave/Chromium can suppress programmatic `a.click()` downloads (a synthetic,
  // untrusted click), but honor a trusted click on a real `<a download>`.
  const download = useMemo(() => {
    if (!entry) return null
    const doc = buildContractRichTextDocument(entry)
    const url = URL.createObjectURL(new Blob([doc.content], { type: doc.mime }))
    return { url, filename: doc.filename }
  }, [entry])

  useEffect(() => {
    if (!download) return
    return () => URL.revokeObjectURL(download.url)
  }, [download])

  if (!entry) {
    return (
      <div style={{ ...pageBgStyle, padding: '3rem 1.5rem' }}>
        <div
          style={{
            maxWidth: 520,
            margin: '0 auto',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '2rem',
          }}
        >
          <h1 style={{ marginTop: 0, fontSize: '1.25rem' }}>Preview unavailable</h1>
          <p style={{ color: '#4b5563', lineHeight: 1.5, margin: 0 }}>
            This preview link has expired. Reopen it from the Contract Book.
          </p>
          <p style={{ marginTop: '1rem', marginBottom: 0 }}>
            <Link to="/people?tab=contracts">← Back to Contracts</Link>
          </p>
        </div>
      </div>
    )
  }

  const bodyHtml = renderContractBodyToSafeHtml(entry.book_body_html, entry.book_body_format)

  return (
    <div style={pageBgStyle}>
      <style>{PREVIEW_STYLES}</style>
      <div
        className="cbp-toolbar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '0.75rem 1rem',
          background: 'rgba(243,244,246,0.95)',
          borderBottom: '1px solid #e5e7eb',
          zIndex: 10,
        }}
      >
        {download ? (
          <a
            href={download.url}
            download={download.filename}
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: 6,
              background: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Download
          </a>
        ) : null}
      </div>
      <main
        className="cbp-page"
        style={{
          maxWidth: 800,
          margin: '4.5rem auto 3rem',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '2.5rem 3rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.6rem' }}>{title}</h1>
        {bodyHtml.trim() ? (
          <div
            className="cbp-body"
            // eslint-disable-next-line react/no-danger -- output of renderContractBodyToSafeHtml (escaped plain text / allowlist-sanitized html)
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No library body yet.</p>
        )}
      </main>
    </div>
  )
}
