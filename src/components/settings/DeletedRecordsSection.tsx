/** Settings → Data & migration → "Recently deleted (dev)": browse the deleted-records archive and
 * put a whole deleted job/bid bundle back.
 *
 * Self-contained (calls its own hook) rather than props-only like the rest of SettingsDataTab: this
 * section is single-surface, and threading its ~10 state values through Settings.tsx (5k+ lines) buys
 * nothing. Mirrors ActiveAccountsPanel, which does the same for the same reason.
 *
 * Preview gates Restore, exactly like the merge-users dialog: you cannot commit a restore you have not
 * previewed, and the preview is a real (rolled-back) execution, so its counts are true. */
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useDeletedRecordsArchive } from '../../hooks/useDeletedRecordsArchive'
import { listDeletedRecordRows, type DeletedRecordRow } from '../../lib/deletedRecordsArchive'
import {
  EMPTY_BUNDLE_FILTERS,
  buildBundleDigestChips,
  bundleInAlertWindows,
  distinctValues,
  filterDeletedBundles,
  humanizeArchiveTable,
  sortBundlesAlertFirst,
  summarizeDeletedRow,
  summarizePreviewItems,
  type AlertWindow,
  type DeletedBundleFilters,
} from '../../lib/deletedRecordContents'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useBulkDeleteAlerts } from '../../hooks/useBulkDeleteAlerts'
import {
  loadBulkDeleteAlertDismissState,
  saveBulkDeleteAlertDismissState,
  shouldShowBulkDeleteAlert,
  type BulkDeleteAlertDismissState,
} from '../../lib/bulkDeleteAlertDismiss'

/** Deep-link anchor id (dashboard "Review deletions" → this section, opened). */
export const RECENTLY_DELETED_ANCHOR_ID = 'settings-recently-deleted'

const SNOOZE_MS = 24 * 60 * 60 * 1000

function formatDeletedAt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export default function DeletedRecordsSection() {
  const [open, setOpen] = useState(false)
  const { showToast } = useToastContext()
  const { user } = useAuth()
  const location = useLocation()
  const { bundles, loading, error, preview, busy, submitting, runPreview, runRestore } =
    useDeletedRecordsArchive({ enabled: open })

  // "What's inside" contents per bundle: lazily fetched on first open, cached for the session.
  const [filters, setFilters] = useState<DeletedBundleFilters>(EMPTY_BUNDLE_FILTERS)
  const [openContents, setOpenContents] = useState<Set<string>>(() => new Set())
  const [contentsByGroup, setContentsByGroup] = useState<Map<string, DeletedRecordRow[]>>(() => new Map())
  const [contentsLoading, setContentsLoading] = useState<string | null>(null)
  const [contentsError, setContentsError] = useState<string | null>(null)

  async function toggleContents(groupKey: string) {
    setOpenContents((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
    if (contentsByGroup.has(groupKey) || contentsLoading === groupKey) return
    setContentsLoading(groupKey)
    setContentsError(null)
    try {
      const rows = await listDeletedRecordRows(groupKey)
      setContentsByGroup((prev) => new Map(prev).set(groupKey, rows))
    } catch (e) {
      setContentsError(formatErrorMessage(e))
    } finally {
      setContentsLoading(null)
    }
  }

  // Arriving via the dashboard banner's "Review deletions" anchor opens the
  // section immediately (location.key so a repeat click re-opens it too).
  useEffect(() => {
    if (location.hash === `#${RECENTLY_DELETED_ANCHOR_ID}`) setOpen(true)
  }, [location.hash, location.key])

  // The active bulk-delete alert, surfaced here so the review loop closes in
  // place: same RPC + per-device dismiss state as the dashboard banner.
  const { alerts } = useBulkDeleteAlerts(open && !!user?.id)
  const [dismissState, setDismissState] = useState<BulkDeleteAlertDismissState>({})
  useEffect(() => {
    if (!user?.id) {
      setDismissState({})
      return
    }
    setDismissState(loadBulkDeleteAlertDismissState(user.id))
  }, [user?.id, open])
  const persistDismiss = (next: BulkDeleteAlertDismissState) => {
    if (!user?.id) return
    saveBulkDeleteAlertDismissState(user.id, next)
    setDismissState(next)
  }
  const alertCount = alerts.length
  const worstAlert = alerts[0]
  const showAlertBox = shouldShowBulkDeleteAlert(alertCount, dismissState)
  // Burst windows of the active alerts: bundles deleted inside one sort first
  // and get flagged, so the reviewer lands on the deletions the banner is about.
  const alertWindows: AlertWindow[] = alerts.map((a) => ({ start: a.window_start, end: a.window_end }))

  return (
    <div id={RECENTLY_DELETED_ANCHOR_ID} style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
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
          {showAlertBox && (
            <div
              style={{
                margin: '1rem 0 0',
                padding: '0.75rem 1rem',
                border: '1px solid #fecaca',
                borderRadius: 8,
                background: 'var(--bg-orange-tint)',
                fontSize: '0.875rem',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-orange-800)' }}>
                Active bulk-deletion alert
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                {worstAlert ? (
                  <>
                    <strong>{worstAlert.actor_name}</strong> deleted {worstAlert.bundles}{' '}
                    {Number(worstAlert.bundles) === 1 ? 'thing' : 'things'} ({worstAlert.row_count} rows)
                    around {new Date(worstAlert.window_start).toLocaleString()}.
                  </>
                ) : null}{' '}
                {alertCount > 1 ? `${alertCount} bursts in total. ` : ''}
                Done reviewing? Clear the dashboard notice here.
              </div>
              <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => persistDismiss({ ...dismissState, dismissedCount: alertCount })}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
                >
                  Dismiss until count increases
                </button>
                <button
                  type="button"
                  onClick={() => persistDismiss({ ...dismissState, snoozeUntil: Date.now() + SNOOZE_MS })}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
                >
                  Snooze 24h
                </button>
              </div>
            </div>
          )}
          <p style={{ marginBottom: '1rem', marginTop: showAlertBox ? '1rem' : 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
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
          ) : (() => {
            const visible = sortBundlesAlertFirst(filterDeletedBundles(bundles, filters), alertWindows)
            const kinds = distinctValues(bundles, (b) => b.kind)
            const deleters = distinctValues(bundles, (b) => b.deleted_by_name)
            const selectStyle = {
              padding: '0.35rem 0.5rem',
              fontSize: '0.8125rem',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              color: 'var(--text-base)',
            } as const
            return (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <input
                    type="search"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Search deletions…"
                    aria-label="Search deletions by label"
                    style={{ ...selectStyle, flex: '1 1 10rem', minWidth: '8rem' }}
                  />
                  <select
                    value={filters.kind}
                    onChange={(e) => setFilters({ ...filters, kind: e.target.value })}
                    aria-label="Filter by type"
                    style={selectStyle}
                  >
                    <option value="">All types</option>
                    {kinds.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                  <select
                    value={filters.deletedBy}
                    onChange={(e) => setFilters({ ...filters, deletedBy: e.target.value })}
                    aria-label="Filter by who deleted"
                    style={selectStyle}
                  >
                    <option value="">Deleted by anyone</option>
                    {deleters.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  {(filters.kind !== '' || filters.deletedBy !== '' || filters.search !== '') && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {visible.length} of {bundles.length}
                    </span>
                  )}
                </div>
                {visible.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No deletions match these filters.</p>
                ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {visible.map((b) => {
                const isPreviewed = preview?.groupKey === b.group_key
                const result = isPreviewed ? preview.result : null
                const blockers = result?.blockers ?? []
                const warnings = result?.warnings ?? []
                const insertedEntries = Object.entries(result?.inserted ?? {})
                const canRestore = isPreviewed && result?.ok === true && blockers.length === 0
                const previewing = busy?.groupKey === b.group_key && busy.action === 'preview'
                const restoring = busy?.groupKey === b.group_key && busy.action === 'restore'
                const inAlertWindow = bundleInAlertWindows(b.deleted_at, alertWindows)
                const digestChips = buildBundleDigestChips(b.tables, b.table_counts)
                const previewLines = summarizePreviewItems(b.preview_items)

                return (
                  <li
                    key={b.group_key}
                    style={{
                      border: '1px solid var(--border)',
                      borderLeft: inAlertWindow ? '3px solid #f59e0b' : '1px solid var(--border)',
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
                          {inAlertWindow && (
                            <span
                              style={{
                                marginLeft: '0.4rem',
                                padding: '0.05rem 0.4rem',
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                color: 'var(--text-amber-800)',
                                background: 'var(--bg-orange-tint)',
                                border: '1px solid #f59e0b',
                                borderRadius: 999,
                                verticalAlign: 'middle',
                              }}
                            >
                              in alert window
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {b.row_count} row{b.row_count === 1 ? '' : 's'} across {b.tables.length} table
                          {b.tables.length === 1 ? '' : 's'} · deleted by {b.deleted_by_name || 'unknown'} ·{' '}
                          {formatDeletedAt(b.deleted_at)}
                        </div>
                        <div
                          title={b.tables.join(', ')}
                          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}
                        >
                          {digestChips.map((chip) => (
                            <span
                              key={chip.table}
                              style={{
                                padding: '0.05rem 0.45rem',
                                fontSize: '0.6875rem',
                                fontWeight: chip.money ? 600 : 400,
                                color: chip.money ? 'var(--text-amber-800)' : 'var(--text-muted)',
                                background: chip.money ? 'var(--bg-amber-tint)' : 'var(--surface)',
                                border: `1px solid ${chip.money ? '#f59e0b' : 'var(--border)'}`,
                                borderRadius: 999,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {chip.count != null ? `${chip.count} ` : ''}
                              {chip.label}
                            </span>
                          ))}
                        </div>
                        {previewLines.length > 0 && (
                          <ul
                            style={{
                              listStyle: 'none',
                              margin: '0.3rem 0 0',
                              padding: 0,
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {previewLines.map((line, i) => (
                              <li key={`${i}-${line}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {line}
                              </li>
                            ))}
                          </ul>
                        )}
                        <button
                          type="button"
                          onClick={() => void toggleContents(b.group_key)}
                          aria-expanded={openContents.has(b.group_key)}
                          style={{ marginTop: '0.25rem', padding: 0, background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          {openContents.has(b.group_key) ? 'Hide contents' : "What's inside?"}
                        </button>
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

                    {openContents.has(b.group_key) && (
                      <div style={{ marginTop: '0.6rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--border)', fontSize: '0.8125rem' }}>
                        {contentsLoading === b.group_key ? (
                          <span style={{ color: 'var(--text-muted)' }}>Loading contents&hellip;</span>
                        ) : !contentsByGroup.has(b.group_key) ? (
                          <span style={{ color: 'var(--text-red-700)' }}>{contentsError || 'Could not load contents.'}</span>
                        ) : (
                          (() => {
                            const rows = contentsByGroup.get(b.group_key) ?? []
                            const byTable = new Map<string, DeletedRecordRow[]>()
                            for (const row of rows) {
                              const list = byTable.get(row.table_name)
                              if (list) list.push(row)
                              else byTable.set(row.table_name, [row])
                            }
                            return [...byTable.entries()].map(([table, tableRows]) => (
                              <div key={table} style={{ marginBottom: '0.4rem' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>
                                  {humanizeArchiveTable(table)}{' '}
                                  <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>
                                    ({tableRows.length})
                                  </span>
                                </div>
                                {tableRows.map((row) => (
                                  <details key={row.id} style={{ marginLeft: '0.75rem' }}>
                                    <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>
                                      {summarizeDeletedRow(row.row_data)}
                                    </summary>
                                    <pre
                                      style={{
                                        margin: '0.25rem 0 0.4rem',
                                        padding: '0.5rem',
                                        fontSize: '0.6875rem',
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 4,
                                        overflowX: 'auto',
                                        maxHeight: '16rem',
                                        overflowY: 'auto',
                                      }}
                                    >
                                      {JSON.stringify(row.row_data, null, 2)}
                                    </pre>
                                  </details>
                                ))}
                              </div>
                            ))
                          })()
                        )}
                      </div>
                    )}

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
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
