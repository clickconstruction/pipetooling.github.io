import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

type JobFormHeaderRowProps = {
  mode: 'new' | 'edit'
  isEditing: boolean
  editingId: string | null
  /** The dirty gate: hides Import once the New Job sheet has user-visible content. */
  importBlocked: boolean
  bidId: string | null
  projectId: string | null
  onOpenImport: () => void
  /** Shell callback: guarded close (autosave flush) then Job Detail via the opener bridge. */
  onJobDetailClick: () => void
  onOpenBidLinkChoice: () => void
  onOpenProjectLinkChoice: () => void
  /** The shell's JOB_FORM_NESTED_OVERLAY_Z_INDEX — the help popover sits above the form. */
  nestedOverlayZIndex: number
}

/**
 * The New/Edit Job modal's header row: title, the HCP#/C# "i" help popover
 * (outside-click/Esc close), the center Import (new, until the dirty gate
 * blocks it) or Job Detail (edit) button, and the right-aligned
 * "Link to: Bid | Project" quick links. The link-choice modals and the
 * import modal stay shell-level — this row only opens them.
 */
export function JobFormHeaderRow({
  mode,
  isEditing,
  editingId,
  importBlocked,
  bidId,
  projectId,
  onOpenImport,
  onJobDetailClick,
  onOpenBidLinkChoice,
  onOpenProjectLinkChoice,
  nestedOverlayZIndex,
}: JobFormHeaderRowProps) {
  const [hcpHelpOpen, setHcpHelpOpen] = useState(false)
  const hcpHelpRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!hcpHelpOpen) return
    function onDocMouseDown(e: globalThis.MouseEvent) {
      if (hcpHelpRef.current && !hcpHelpRef.current.contains(e.target as Node)) setHcpHelpOpen(false)
    }
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setHcpHelpOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [hcpHelpOpen])

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.25rem', flexShrink: 0 }}>{isEditing ? 'Edit Job' : 'New Job'}</h2>
      <div ref={hcpHelpRef} style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setHcpHelpOpen((v) => !v)}
          aria-label="How the HCP # and C# work"
          aria-expanded={hcpHelpOpen}
          title="How the HCP # and C# work"
          style={{
            width: 20,
            height: 20,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            border: '1px solid var(--border-blue)',
            background: hcpHelpOpen ? 'var(--bg-blue-200)' : 'var(--bg-blue-tint)',
            color: 'var(--text-blue-700)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            fontStyle: 'italic',
            fontFamily: 'Georgia, "Times New Roman", serif',
            lineHeight: 1,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          i
        </button>
        {hcpHelpOpen ? (
          <div
            role="dialog"
            aria-label="HCP # vs C# (Click Number)"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 6,
              width: 'max-content',
              maxWidth: 340,
              zIndex: nestedOverlayZIndex,
              background: 'var(--bg-blue-tint)',
              border: '1px solid var(--border-blue)',
              borderRadius: 8,
              padding: '0.6rem 0.75rem',
              fontSize: '0.8125rem',
              lineHeight: 1.5,
              color: '#1e3a8a',
              boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
            }}
          >
            <button
              type="button"
              onClick={() => setHcpHelpOpen(false)}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 4,
                right: 6,
                border: 'none',
                background: 'none',
                color: 'var(--text-slate-500)',
                fontSize: '1rem',
                lineHeight: 1,
                cursor: 'pointer',
                padding: 2,
              }}
            >
              ×
            </button>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem', paddingRight: '1rem' }}>
              HCP # vs C# (Click Number)
            </div>
            <ul style={{ margin: '0 0 0.4rem', paddingLeft: '1.1rem' }}>
              <li>
                <strong>HCP #</strong> — the HouseCall Pro job number, for jobs imported from HouseCall Pro.
              </li>
              <li>
                <strong>C# (Click Number)</strong> — for jobs created here in Click that have no HCP #.
              </li>
            </ul>
            <div>
              Wherever this job&rsquo;s number appears, it shows the <strong>HCP #</strong> if it has one; otherwise
              the <strong>C#</strong>. An HCP # always takes precedence. Both use the same prefix (e.g. &ldquo;J&rdquo;),
              so they look identical.
            </div>
          </div>
        ) : null}
      </div>
      {mode === 'new' && !isEditing && !importBlocked ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          <button
            type="button"
            onClick={onOpenImport}
            aria-label="Import from estimate or bid"
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--text-blue-700)',
              background: 'var(--bg-blue-tint)',
              border: '1px solid var(--border-blue)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Import
          </button>
        </div>
      ) : editingId ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          <button
            type="button"
            onClick={onJobDetailClick}
            aria-label="Close Edit Job and open Job Detail"
            title="Close Edit Job and open Job Detail"
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--text-blue-700)',
              background: 'var(--bg-blue-tint)',
              border: '1px solid var(--border-blue)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Job Detail
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, minWidth: 0 }} aria-hidden />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.25rem',
          justifyContent: 'flex-end',
          fontSize: '0.875rem',
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--text-muted)', userSelect: 'none' }}>Link to:</span>
        {bidId ? (
          <Link
            to={`/bids?bidId=${encodeURIComponent(bidId)}&tab=cover-letter`}
            aria-label="Open linked bid"
            style={{
              padding: '0.25rem 0.5rem',
              background: 'var(--bg-blue-tint)',
              color: 'var(--text-blue-700)',
              borderRadius: 4,
              textDecoration: 'none',
              fontWeight: 500,
              display: 'inline-block',
            }}
          >
            Bid
          </Link>
        ) : (
          <button
            type="button"
            onClick={onOpenBidLinkChoice}
            aria-label="Choose bid to link"
            style={{
              color: 'var(--text-link)',
              fontWeight: 500,
              background: 'none',
              border: 'none',
              padding: '0.25rem 0.35rem',
              cursor: 'pointer',
              font: 'inherit',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            Bid
          </button>
        )}
        <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
          |
        </span>
        {projectId ? (
          <Link
            to={`/workflows/${projectId}`}
            aria-label="Open linked project workflow"
            style={{
              padding: '0.25rem 0.5rem',
              background: 'var(--bg-blue-tint)',
              color: 'var(--text-blue-700)',
              borderRadius: 4,
              textDecoration: 'none',
              fontWeight: 500,
              display: 'inline-block',
            }}
          >
            Project
          </Link>
        ) : (
          <button
            type="button"
            onClick={onOpenProjectLinkChoice}
            aria-label="Choose project to link"
            style={{
              color: 'var(--text-link)',
              fontWeight: 500,
              background: 'none',
              border: 'none',
              padding: '0.25rem 0.35rem',
              cursor: 'pointer',
              font: 'inherit',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            Project
          </button>
        )}
      </div>
    </div>
  )
}
