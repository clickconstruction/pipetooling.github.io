import { useEffect, useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { executeCombinePeople, previewCombinePeople } from '../../lib/combinePeople'
import type { CombinePreview } from '../../lib/combinePeople'

type CombinePerson = { id: string; name: string; account_user_id: string | null }

/**
 * Combine people (v2.982): fold a duplicate roster identity into the real one.
 * Preview-first (per-table rewrite counts), archive-never-delete, and blocks
 * when both sides carry app accounts (that's a Settings → Merge users job).
 */
export default function CombinePeopleModal({
  source,
  candidates,
  onClose,
  onCombined,
}: {
  /** The duplicate being folded away. */
  source: CombinePerson
  /** Possible keepers (active roster people, excluding the source). */
  candidates: CombinePerson[]
  onClose: () => void
  onCombined: () => void
}) {
  const { showToast } = useToastContext()
  const [search, setSearch] = useState('')
  const [targetId, setTargetId] = useState<string | null>(null)
  const [preview, setPreview] = useState<CombinePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const target = candidates.find((c) => c.id === targetId) ?? null

  useEffect(() => {
    let cancelled = false
    setPreviewLoading(true)
    void previewCombinePeople(source.id, source.name)
      .then((p) => {
        if (!cancelled) setPreview(p)
      })
      .catch(() => {
        if (!cancelled) setPreview(null)
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [source.id, source.name])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q ? candidates.filter((c) => c.name.toLowerCase().includes(q)) : candidates
    return base.slice(0, 30)
  }, [candidates, search])

  const bothHaveAccounts = Boolean(source.account_user_id && target?.account_user_id && source.account_user_id !== target.account_user_id)

  async function run() {
    if (!target || running || bothHaveAccounts) return
    setRunning(true)
    try {
      const result = await executeCombinePeople({ source, target, skipArchive: true })
      showToast(
        `Combined into ${target.name}: ${result.renamedRows} rows renamed, ${result.repointedRows} repointed, ${result.sheetsRewritten} sheets updated${result.accountMoved ? ', account link moved' : ''}. Duplicate archived.`,
        'success',
      )
      onCombined()
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Combine failed'), 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Combine ${source.name} into another person`}
      onClick={() => (running ? null : onClose())}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1030, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 8, padding: '1rem', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontWeight: 700 }}>Combine {source.name} into…</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '1.1rem', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
            ✕
          </button>
        </div>
        <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Their hours, pay config, crew records, pay stubs, and sub sheets are rewritten onto the person you pick; this
          duplicate row is then <strong>archived</strong> (never deleted).
        </p>

        <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.7rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}>
          {previewLoading ? (
            'Counting what would move…'
          ) : preview ? (
            <>
              <strong>{preview.totalRows}</strong> row{preview.totalRows === 1 ? '' : 's'} would move:
              <span style={{ color: 'var(--text-muted)' }}>
                {' '}
                {preview.lines
                  .filter((l) => l.nameRows > 0 || l.idRows > 0)
                  .map((l) => `${l.table.replace(/^people_/, '')} ${Math.max(l.nameRows, l.idRows)}`)
                  .join(' · ') || 'no pay rows'}
                {preview.laborSheets > 0 ? ` · sub sheets ${preview.laborSheets}` : ''}
              </span>
            </>
          ) : (
            'Preview unavailable — you can still combine.'
          )}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the person to keep…"
          aria-label="Search the person to keep"
          style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, marginBottom: '0.5rem', background: 'var(--surface)', color: 'var(--text-base)' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '11rem', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '0.35rem', marginBottom: '0.6rem' }}>
          {visible.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setTargetId(targetId === c.id ? null : c.id)}
              aria-pressed={targetId === c.id}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', border: targetId === c.id ? '2px solid #f97316' : '1px solid var(--border)', borderRadius: 6, background: targetId === c.id ? 'var(--bg-subtle)' : 'var(--surface)', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.name}</span>
              {c.account_user_id && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>has account</span>}
            </button>
          ))}
          {visible.length === 0 && <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-faint)', padding: '0.25rem' }}>No matches.</p>}
        </div>

        {bothHaveAccounts && (
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-red-700)', background: 'var(--bg-red-tint)', border: '1px solid var(--text-red-700)', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
            Both people are linked to app accounts — merge the accounts first (Settings → Merge users), then combine.
          </p>
        )}

        <button
          type="button"
          disabled={!target || running || bothHaveAccounts}
          onClick={() => void run()}
          style={{ width: '100%', padding: '0.6rem', background: !target || bothHaveAccounts ? 'var(--border-strong)' : '#dc2626', color: 'white', border: 'none', borderRadius: 6, cursor: !target || running || bothHaveAccounts ? 'not-allowed' : 'pointer', fontWeight: 700 }}
        >
          {running ? 'Combining…' : target ? `Combine into ${target.name} & archive this row` : 'Pick the person to keep'}
        </button>
      </div>
    </div>
  )
}
