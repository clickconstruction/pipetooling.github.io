import { useMemo, useState } from 'react'
import { quickSendRosterSplit, type QuickSendPersonRow } from '../../lib/contractsQuickSend'

/**
 * Person picker for the Contracts quick-send flow (v2.1410): "Send
 * “{document}” to…" from an Agreements-panel card. Roster people split into
 * "Hasn't received it yet" and "Already has it (resend)"; signed people are
 * excluded and reported as a count. Presentational — the tab owns the roster,
 * the caches, and what happens on pick.
 */
export function ContractQuickSendPicker({
  documentName,
  rosterNames,
  personDocuments,
  busy,
  onPick,
  onClose,
}: {
  documentName: string
  rosterNames: readonly string[]
  personDocuments: readonly QuickSendPersonRow[]
  /** True while the pick is being materialized — rows disable to prevent double-creates. */
  busy: boolean
  onPick: (personName: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const split = useMemo(
    () => quickSendRosterSplit({ documentName, rosterNames, personDocuments }),
    [documentName, rosterNames, personDocuments],
  )
  const q = query.trim().toLowerCase()
  const needsIt = q ? split.needsIt.filter((n) => n.toLowerCase().includes(q)) : split.needsIt
  const resend = q ? split.resend.filter((r) => r.personName.toLowerCase().includes(q)) : split.resend

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    width: '100%',
    padding: '0.45rem 0.6rem',
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    cursor: busy ? 'wait' : 'pointer',
    font: 'inherit',
    fontSize: '0.875rem',
    textAlign: 'left' as const,
    color: 'var(--text-strong)',
  }
  const groupLabelStyle = {
    margin: '0.5rem 0 0.15rem',
    fontSize: '0.7rem',
    fontWeight: 600 as const,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11 }}
      onClick={() => {
        if (!busy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Send ${documentName} to a person`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1rem 1.1rem',
          width: 'min(92vw, 360px)',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.35 }}>
            Send &ldquo;{documentName}&rdquo; to&hellip;
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: '0.1rem 0.3rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.15rem', lineHeight: 1, color: 'var(--text-muted)', flexShrink: 0 }}
          >
            ×
          </button>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the roster…"
          aria-label="Search the roster"
          autoFocus
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '0.45rem 0.6rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            fontSize: '0.875rem',
            marginBottom: '0.2rem',
          }}
        />
        {needsIt.length === 0 && resend.length === 0 ? (
          <p style={{ margin: '0.6rem 0 0.2rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {q ? 'Nobody matches your search.' : 'Everyone on the roster has signed this document.'}
          </p>
        ) : null}
        {needsIt.length > 0 ? (
          <>
            <p style={groupLabelStyle}>Hasn&rsquo;t received it yet</p>
            {needsIt.map((personName) => (
              <button
                key={personName}
                type="button"
                disabled={busy}
                onClick={() => onPick(personName)}
                style={rowStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-blue-tint)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span>{personName}</span>
              </button>
            ))}
          </>
        ) : null}
        {resend.length > 0 ? (
          <>
            <p style={groupLabelStyle}>Already has it (resend)</p>
            {resend.map(({ personName }) => (
              <button
                key={personName}
                type="button"
                disabled={busy}
                onClick={() => onPick(personName)}
                style={rowStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-blue-tint)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span>{personName}</span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    padding: '0.1rem 0.45rem',
                    borderRadius: 999,
                    background: 'var(--bg-amber-100)',
                    color: 'var(--text-amber-800)',
                    flexShrink: 0,
                  }}
                >
                  sent
                </span>
              </button>
            ))}
          </>
        ) : null}
        {split.signedCount > 0 ? (
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {split.signedCount} {split.signedCount === 1 ? 'person has' : 'people have'} already signed it.
          </p>
        ) : null}
      </div>
    </div>
  )
}
