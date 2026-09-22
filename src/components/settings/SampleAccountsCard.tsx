import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useActiveAccountsModal } from '../../contexts/ActiveAccountsModalContext'
import { createMissingSampleAccounts } from '../../lib/sampleAccounts'
import { missingSampleRoles } from '../../lib/viewAs'
import { humanRoleLabel } from '../../lib/roleLabels'
import { BTN, CARD, CARD_TITLE, MUTED } from '../bids/twinConsoleStyles'

type SampleRow = { id: string; name: string | null; email: string; role: string; read_only: boolean; is_sample: boolean; archived_at: string | null }

/**
 * Settings → System → Digital twins & samples → Sample accounts (People spine PR 6, v2.3705).
 * The View-as fixtures live beside the twins, not in the people roster: one login per imitable
 * role, hidden everywhere else. Make the missing ones here; set a sample's switches (training,
 * Hiring grants) through Manage accounts…, the same rows a person's account has.
 */
export default function SampleAccountsCard() {
  const { showToast } = useToastContext()
  const accountsModal = useActiveAccountsModal()
  const [rows, setRows] = useState<SampleRow[] | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('users').select('id, name, email, role, read_only, is_sample, archived_at').eq('is_sample', true).order('role')
    if (error) {
      setRows([])
      return
    }
    setRows((data ?? []) as SampleRow[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const missing = missingSampleRoles(rows ?? [])

  async function makeMissing() {
    setBusy(true)
    try {
      const { made, failed } = await createMissingSampleAccounts(supabase, rows ?? [])
      if (made.length) showToast(`Made ${made.length} sample account${made.length === 1 ? '' : 's'}.`, 'success')
      if (failed.length) showToast(`Could not make ${failed.map((f) => f.role).join(', ')}: ${failed[0]!.error}`, 'error')
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ ...CARD, marginTop: '1rem' }}>
      <h4 style={CARD_TITLE}>Sample accounts</h4>
      <p style={{ ...MUTED, margin: '0 0 0.6rem' }}>
        One login per imitable role, hidden from every roster, picker and email like the twins — <strong>View as…</strong> on the gear menu imitates one. Not people: they never get a roster row or pay.
      </p>
      {rows == null ? (
        <p style={MUTED}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={MUTED}>None yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '0 0 0.6rem', padding: 0, display: 'grid', gap: '0.25rem' }}>
          {rows.map((r) => (
            <li key={r.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 600 }}>{r.name ?? r.email}</span>
              <span style={MUTED}>{humanRoleLabel(r.role)}</span>
              <span style={{ ...MUTED, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.75rem' }}>{r.email}</span>
              {r.read_only ? <span style={{ fontSize: '0.7rem', borderRadius: 999, padding: '0 0.4rem', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>training</span> : null}
              {r.archived_at ? <span style={{ fontSize: '0.7rem', borderRadius: 999, padding: '0 0.4rem', background: 'var(--bg-muted)', color: 'var(--text-700)' }}>archived</span> : null}
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {missing.length > 0 ? (
          <button type="button" style={BTN} disabled={busy} onClick={() => void makeMissing()}>
            {busy ? 'Creating…' : `Create the missing samples (${missing.length})`}
          </button>
        ) : null}
        {accountsModal ? (
          <button type="button" style={BTN} onClick={() => accountsModal.openActiveAccounts({ onDataChanged: () => void load() })} title="Training mode, Hiring grants, password — the same row a person's account has">
            Manage accounts…
          </button>
        ) : null}
      </div>
    </div>
  )
}
