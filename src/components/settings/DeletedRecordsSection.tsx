/** Settings → Data & migration → "Recently deleted (dev)": browse the deleted-records archive and
 * put a whole deleted job/bid bundle back.
 *
 * Self-contained (calls its own hook) rather than props-only like the rest of SettingsDataTab: this
 * section is single-surface, and threading its ~10 state values through Settings.tsx (5k+ lines) buys
 * nothing. Mirrors ActiveAccountsPanel, which does the same for the same reason.
 *
 * Preview gates Restore, exactly like the merge-users dialog: you cannot commit a restore you have not
 * previewed, and the preview is a real (rolled-back) execution, so its counts are true. */
import { useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useDeletedRecordsArchive } from '../../hooks/useDeletedRecordsArchive'

function formatDeletedAt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export default function DeletedRecordsSection() {
  const [open, setOpen] = useState(false)
  const { showToast } = useToastContext()
  const { bundles, loading, error, preview, busy, submitting, runPreview, runRestore } =
    useDeletedRecordsArchive({ enabled: open })

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          margin: 0,
          padding: '1rem',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '▶'}</span>
        Recently deleted (dev){bundles.length > 0 ? ` (${bundles.length})` : ''}
      </button>

      {open && (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ marginBottom: '1rem', marginTop: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Deleted jobs and bids are archived with everything that went with them (invoices, payments,
            materials, crew, reports&hellip;) and can be put back here. Always <strong>Preview</strong> first —
            it reports exactly what would come back, and flags anything that would block or be cleared.
            Archived rows are kept for 90 days.
          </p>

          {error && (
            <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>
          )}

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading&hellip;</p>
          ) : bundles.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Nothing deleted in the last 90 days.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {bundles.map((b) => {
                const isPreviewed = preview?.groupKey === b.group_key
                const result = isPreviewed ? preview.result : null
                const blockers = result?.blockers ?? []
                const warnings = result?.warnings ?? []
                const insertedEntries = Object.entries(result?.inserted ?? {})
                const canRestore = isPreviewed && result?.ok === true && blockers.length === 0
                const previewing = busy?.groupKey === b.group_key && busy.action === 'preview'
                const restoring = busy?.groupKey === b.group_key && busy.action === 'restore'

                return (
                  <li
                    key={b.group_key}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '0.75rem',
                      background: 'var(--bg-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>
                          {b.label}{' '}
                          <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>({b.kind})</span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {b.row_count} row{b.row_count === 1 ? '' : 's'} across {b.tables.length} table
                          {b.tables.length === 1 ? '' : 's'} · deleted by {b.deleted_by_name || 'unknown'} ·{' '}
                          {formatDeletedAt(b.deleted_at)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.15rem', wordBreak: 'break-word' }}>
                          {b.tables.join(', ')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => void runPreview(b.group_key)}
                          disabled={submitting}
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.875rem',
                            background: 'var(--bg-muted)',
                            color: 'var(--text-700)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 6,
                            cursor: submitting ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {previewing ? 'Previewing…' : isPreviewed ? 'Re-preview' : 'Preview restore'}
                        </button>
                        <button
                          type="button"
                          disabled={!canRestore || submitting}
                          title={canRestore ? undefined : 'Preview first'}
                          onClick={async () => {
                            const res = await runRestore(b.group_key)
                            if (res?.ok) {
                              showToast(`Restored ${res.total ?? 0} row${res.total === 1 ? '' : 's'}.`, 'success')
                            }
                          }}
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.875rem',
                            background: canRestore ? '#059669' : 'var(--bg-muted)',
                            color: canRestore ? 'white' : 'var(--text-faint)',
                            border: canRestore ? 'none' : '1px solid var(--border)',
                            borderRadius: 6,
                            cursor: !canRestore || submitting ? 'not-allowed' : 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          {restoring ? 'Restoring…' : 'Restore'}
                        </button>
                      </div>
                    </div>

                    {isPreviewed && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.65rem',
                          borderRadius: 6,
                          fontSize: '0.8125rem',
                          background: blockers.length > 0 ? 'var(--bg-red-tint)' : 'var(--bg-amber-tint)',
                          border: `1px solid ${blockers.length > 0 ? 'var(--text-red-700)' : '#f59e0b'}`,
                        }}
                      >
                        {blockers.length > 0 ? (
                          <>
                            <div style={{ fontWeight: 600, color: 'var(--text-red-700)', marginBottom: '0.35rem' }}>
                              Cannot restore — nothing was changed:
                            </div>
                            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-red-700)' }}>
                              {blockers.map((x) => (
                                <li key={x}>{x}</li>
                              ))}
                            </ul>
                          </>
                        ) : result?.ok ? (
                          <>
                            <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>
                              Preview — this would put back {result.total ?? 0} row{result.total === 1 ? '' : 's'}:
                            </div>
                            {insertedEntries.length === 0 ? (
                              <div>Nothing to insert.</div>
                            ) : (
                              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                                {insertedEntries.map(([table, n]) => (
                                  <li key={table}>
                                    {table}: <strong>{n}</strong>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {warnings.map((w) => (
                              <p key={w} style={{ margin: '0.5rem 0 0', color: 'var(--text-amber-800)' }}>
                                ⚠️ {w}
                              </p>
                            ))}
                          </>
                        ) : (
                          <div style={{ color: 'var(--text-red-700)' }}>{result?.error || 'Preview failed.'}</div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
