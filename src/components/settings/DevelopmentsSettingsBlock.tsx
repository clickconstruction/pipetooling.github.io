import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  buildDevelopmentJobCountMap,
  developmentUnarchiveClash,
  sortDevelopmentsForSettings,
  validateNewDevelopmentName,
  validateRenameDevelopment,
  type JobFormDevelopmentRow,
} from '../../lib/jobs/jobDevelopments'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'

type DevelopmentSettingsRow = JobFormDevelopmentRow & { gc_customer_id: string | null }
type CustomerOption = { id: string; name: string | null; master_user_id: string; archived_at: string | null }

const cellStyle: CSSProperties = { padding: '0.4rem 0.5rem', fontSize: '0.875rem', verticalAlign: 'middle' }
const ghostButtonStyle: CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.8125rem',
  border: '1px solid var(--border-strong)',
  background: 'var(--bg-subtle)',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--text-700)',
  fontWeight: 500,
}

/**
 * Settings → Jobs & dispatch → Manage developments (v2.1218). Self-contained
 * like TripChargeAmountsSettingsBlock: loads its own developments + customers
 * + job counts on expand. Rename / default GC / archive / delete for the
 * developments the viewer can see (tab itself is dev-only). Delete un-groups
 * linked jobs (FK is ON DELETE SET NULL) — the confirm strip says the count
 * out loud; archive is the primary action for finished developments.
 */
export default function DevelopmentsSettingsBlock() {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<DevelopmentSettingsRow[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [jobCounts, setJobCounts] = useState<Map<string, number>>(new Map())
  const [showArchived, setShowArchived] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const [devRes, custRes, jobRes] = await Promise.all([
        supabase.from('developments').select('id, name, master_user_id, gc_customer_id, archived_at').order('name'),
        supabase.from('customers').select('id, name, master_user_id, archived_at').order('name'),
        supabase.from('jobs_ledger').select('development_id').not('development_id', 'is', null),
      ])
      if (devRes.error) throw devRes.error
      setRows((devRes.data as DevelopmentSettingsRow[]) ?? [])
      setCustomers((custRes.data as CustomerOption[]) ?? [])
      setJobCounts(buildDevelopmentJobCountMap((jobRes.data as Array<{ development_id: string | null }>) ?? []))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load developments'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  async function updateRow(id: string, patch: { name?: string; gc_customer_id?: string | null; archived_at?: string | null }) {
    setBusyId(id)
    try {
      const { error } = await supabase.from('developments').update(patch).eq('id', id)
      if (error) throw error
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
      return true
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not update the development'), 'error')
      return false
    } finally {
      setBusyId(null)
    }
  }

  async function submitRename(row: DevelopmentSettingsRow) {
    const check = validateRenameDevelopment(row.id, renameText, rows)
    if (!check.ok) {
      showToast(check.error, 'error')
      return
    }
    if (check.name === (row.name ?? '').trim()) {
      setRenamingId(null)
      return
    }
    if (await updateRow(row.id, { name: check.name })) {
      setRenamingId(null)
      showToast('Development renamed — every linked job follows automatically.', 'success')
    }
  }

  async function toggleArchived(row: DevelopmentSettingsRow) {
    if (row.archived_at) {
      const clash = developmentUnarchiveClash(row, rows)
      if (clash) {
        showToast(`Can't un-archive: an active "${(clash.name ?? '').trim()}" already exists.`, 'error')
        return
      }
      if (await updateRow(row.id, { archived_at: null })) showToast('Development un-archived.', 'success')
    } else {
      if (await updateRow(row.id, { archived_at: new Date().toISOString() })) {
        showToast('Archived — it stays on its jobs but leaves the Edit Job picker.', 'success')
      }
    }
  }

  async function deleteRow(row: DevelopmentSettingsRow) {
    setBusyId(row.id)
    try {
      const { error } = await supabase.from('developments').delete().eq('id', row.id)
      if (error) throw error
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      setConfirmDeleteId(null)
      const n = jobCounts.get(row.id) ?? 0
      showToast(n > 0 ? `Deleted — ${n} job${n === 1 ? '' : 's'} un-grouped (jobs untouched).` : 'Development deleted.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not delete the development'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function createDevelopment() {
    if (!authUser?.id || creating) return
    const check = validateNewDevelopmentName(newName, rows)
    if (!check.ok) {
      showToast(check.error, 'error')
      return
    }
    setCreating(true)
    try {
      const { data, error } = await supabase
        .from('developments')
        .insert({ master_user_id: authUser.id, name: check.name })
        .select('id, name, master_user_id, gc_customer_id, archived_at')
        .single()
      if (error) throw error
      setRows((prev) => [...prev, data as DevelopmentSettingsRow])
      setNewName('')
      showToast(`Development "${check.name}" created.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not create the development'), 'error')
    } finally {
      setCreating(false)
    }
  }

  function gcOptionsFor(row: DevelopmentSettingsRow) {
    // Same-master customers only (the DB trigger backstops); keep the current
    // pick visible even when archived so an existing link never blanks.
    return customers.filter(
      (c) => c.master_user_id === row.master_user_id && (!c.archived_at || c.id === row.gc_customer_id),
    )
  }

  function renderRow(row: DevelopmentSettingsRow) {
    const count = jobCounts.get(row.id) ?? 0
    const busy = busyId === row.id
    const name = (row.name ?? '').trim() || '—'
    return (
      <tr key={row.id} style={{ borderTop: '1px solid var(--border)', opacity: row.archived_at ? 0.65 : 1 }}>
        <td style={{ ...cellStyle, minWidth: '10rem' }}>
          {renamingId === row.id ? (
            <input
              type="text"
              value={renameText}
              autoFocus
              onChange={(e) => setRenameText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitRename(row)
                if (e.key === 'Escape') setRenamingId(null)
              }}
              onBlur={() => void submitRename(row)}
              aria-label={`Rename ${name}`}
              style={{ width: '100%', padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setRenamingId(row.id)
                setRenameText((row.name ?? '').trim())
              }}
              title="Rename"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }}
            >
              {name} <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>✎</span>
            </button>
          )}
        </td>
        <td style={{ ...cellStyle, minWidth: '11rem' }}>
          <select
            value={row.gc_customer_id ?? ''}
            onChange={(e) => void updateRow(row.id, { gc_customer_id: e.target.value || null })}
            disabled={busy}
            aria-label={`Default GC for ${name}`}
            style={{ width: '100%', padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', background: 'var(--surface)', color: 'inherit' }}
          >
            <option value="">No default GC</option>
            {gcOptionsFor(row).map((c) => (
              <option key={c.id} value={c.id}>
                {(c.name ?? '').trim() || '—'}
              </option>
            ))}
          </select>
        </td>
        <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', color: count > 0 ? 'inherit' : 'var(--text-muted)' }}>
          {count} job{count === 1 ? '' : 's'}
        </td>
        <td style={{ ...cellStyle, whiteSpace: 'nowrap', textAlign: 'right' }}>
          {confirmDeleteId === row.id ? (
            <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
                {count > 0 ? `${count} job${count === 1 ? '' : 's'} will be un-grouped.` : 'Delete for good?'}
              </span>
              <button type="button" onClick={() => void deleteRow(row)} disabled={busy} style={{ ...ghostButtonStyle, background: '#dc2626', borderColor: '#dc2626', color: 'white' }}>
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDeleteId(null)} style={ghostButtonStyle}>
                Cancel
              </button>
            </span>
          ) : (
            <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
              <button type="button" onClick={() => void toggleArchived(row)} disabled={busy} style={ghostButtonStyle}>
                {row.archived_at ? 'Un-archive' : 'Archive'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(row.id)}
                disabled={busy}
                title="Delete this development (linked jobs are un-grouped, never deleted)"
                style={{ ...ghostButtonStyle, color: 'var(--text-red-600)' }}
              >
                Delete
              </button>
            </span>
          )}
        </td>
      </tr>
    )
  }

  const { active, archived } = sortDevelopmentsForSettings(rows)

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => {
            const next = !prev
            if (next) void loadFromServer()
            return next
          })
        }}
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
        <DevelopmentHouseIcon size={14} style={{ flexShrink: 0 }} />
        Manage developments
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: '1rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Developments group jobs (Edit Job → Development). Renames follow everywhere automatically.
            Archiving keeps a development on its jobs but removes it from the picker; deleting un-groups
            its jobs (the jobs themselves are untouched).
          </p>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            <>
              {active.length === 0 && archived.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No developments yet — create one below or from Edit Job.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 720 }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'left' }}>
                        <th style={cellStyle}>Name</th>
                        <th style={cellStyle}>Default GC/Builder</th>
                        <th style={{ ...cellStyle, textAlign: 'right' }}>Linked</th>
                        <th style={{ ...cellStyle, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.map(renderRow)}
                      {showArchived ? archived.map(renderRow) : null}
                    </tbody>
                  </table>
                </div>
              )}
              {archived.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowArchived((p) => !p)}
                  style={{ ...ghostButtonStyle, border: 'none', background: 'none', color: 'var(--text-link)', padding: '0.35rem 0', marginTop: '0.25rem' }}
                >
                  {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
                </button>
              ) : null}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void createDevelopment()
                  }}
                  placeholder="New development name…"
                  aria-label="New development name"
                  style={{ flex: '1 1 12rem', maxWidth: 300, padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                />
                <button
                  type="button"
                  onClick={() => void createDevelopment()}
                  disabled={creating}
                  style={{ padding: '0.4rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: creating ? 'not-allowed' : 'pointer', fontWeight: 500, fontSize: '0.875rem' }}
                >
                  {creating ? 'Creating…' : '+ New development'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
