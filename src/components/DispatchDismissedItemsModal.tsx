import { useEffect, useMemo, useState } from 'react'
import { ChecklistTitleWithLinks } from './ChecklistTitleWithLinks'
import type { DispatchInboxDismissedRow } from './DispatchInboxSection'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'

export type DispatchDismissedItemsModalProps = {
  open: boolean
  onClose: () => void
  loadRows: () => Promise<DispatchInboxDismissedRow[]>
  zIndex?: number
}

function formatDismissedWhen(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function rowSearchHaystack(row: DispatchInboxDismissedRow): string {
  const linkParts = (row.links ?? []).filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
  return [
    row.title,
    row.reference_summary ?? '',
    row.closed_note ?? '',
    row.sender?.name ?? '',
    row.sender?.email ?? '',
    ...linkParts,
  ]
    .join(' ')
    .toLowerCase()
}

export function DispatchDismissedItemsModal({
  open,
  onClose,
  loadRows,
  zIndex = 1200,
}: DispatchDismissedItemsModalProps) {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<DispatchInboxDismissedRow[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setSearch('')
    void loadRows()
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          showToast(formatErrorMessage(e, 'Could not load dismissed items'), 'error')
          setRows([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, loadRows, showToast])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => rowSearchHaystack(r).includes(q))
  }, [rows, search])

  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispatch-dismissed-modal-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !loading) onClose()
        }}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 560,
          width: '100%',
          maxHeight: 'min(85vh, 720px)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <h2 id="dispatch-dismissed-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
            Dismissed dispatch items
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              flexShrink: 0,
              padding: '0.25rem 0.5rem',
              fontSize: '0.875rem',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Close
          </button>
        </div>
        <p style={{ margin: '0.5rem 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Items you dismissed from your inbox (read-only). Search by task text, reference, sender, links, or closed note.
        </p>
        <label style={{ display: 'block', marginBottom: '0.75rem' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.25rem' }}>
            Search
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={loading || rows.length === 0}
            placeholder="Filter…"
            autoComplete="off"
            style={{
              padding: '0.45rem 0.6rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              fontSize: '0.875rem',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        </label>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '0.5rem',
          }}
        >
          {loading ? (
            <p style={{ margin: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p style={{ margin: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No dismissed items.</p>
          ) : filtered.length === 0 ? (
            <p style={{ margin: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No matches for this search.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {filtered.map((req) => {
                const fromLabel = req.sender?.name?.trim() || req.sender?.email?.trim() || 'Unknown'
                const noteCount = req.note_count ?? 0
                const noteLabel =
                  noteCount === 0 ? 'No messages' : noteCount === 1 ? '1 message' : `${noteCount} messages`
                return (
                  <li
                    key={req.id}
                    style={{
                      padding: '0.75rem 0.5rem',
                      borderBottom: '1px solid #f3f4f6',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      Dismissed {formatDismissedWhen(req.dismissed_at)} · {noteLabel}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      From {fromLabel}
                      {req.created_at ? (
                        <span style={{ marginLeft: '0.35rem' }}>
                          · Sent {new Date(req.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontWeight: 500 }}>
                      <ChecklistTitleWithLinks title={req.title} links={req.links ?? []} />
                    </div>
                    {req.reference_summary?.trim() ? (
                      <div style={{ marginTop: 6, fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                        Ref: {req.reference_summary.trim()}
                      </div>
                    ) : null}
                    {req.location_lat != null && req.location_lng != null ? (
                      <div style={{ marginTop: 4, fontSize: '0.8125rem' }}>
                        <a
                          href={`https://www.google.com/maps?q=${req.location_lat},${req.location_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--text-link)', textDecoration: 'none' }}
                        >
                          View location
                        </a>
                      </div>
                    ) : null}
                    {req.closed_note?.trim() ? (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: '0.8125rem',
                          color: '#14532d',
                          background: 'var(--bg-green-tint)',
                          padding: '0.45rem 0.5rem',
                          borderRadius: 4,
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        <strong>Closed note:</strong> {req.closed_note.trim()}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
