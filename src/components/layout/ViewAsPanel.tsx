/**
 * View as (v2.3608): the gear-menu door. Two lists — the Roles, each backed by its sample
 * account with the switches it carries as chips, and every active person, searchable. Picking
 * one imitates that account through the existing `loginAsUser` mint: the real session, landing
 * on the page you are on (v2.3606), the amber Exit in the header bringing you back. Dev only
 * (the gear entry is gated; `login-as-user` refuses a dev target regardless).
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { activeUsersQuery } from '../../lib/people/fetchActiveUsers'
import { loginAsUser } from '../../lib/loginAsUser'
import { humanRoleLabel } from '../../lib/roleLabels'
import { filterViewAsPeople, sampleAccountsByRole, switchChipsFor, VIEW_AS_ROLE_ORDER, type ViewAsSwitches } from '../../lib/viewAs'

type AccountRow = { id: string; name: string | null; email: string | null; role: string | null; is_sample?: boolean | null; archived_at?: string | null } & ViewAsSwitches

const COLS = 'id, name, email, role, read_only, estimator_prospects_access, team_prospects_access'

const chip: CSSProperties = { display: 'inline-block', padding: '0 7px', borderRadius: 999, fontSize: '0.7rem', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', marginLeft: 4 }
const rowBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', textAlign: 'left', padding: '0.45rem 0.6rem', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'inherit', font: 'inherit' }
const sectionTitle: CSSProperties = { margin: '0 0 0.35rem', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const muted: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)' }

export function ViewAsPanel({ onClose }: { onClose: () => void }) {
  const [samples, setSamples] = useState<AccountRow[]>([])
  const [people, setPeople] = useState<AccountRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [s, p] = await Promise.all([
        supabase.from('users').select(COLS).eq('is_sample', true).is('archived_at', null),
        activeUsersQuery<AccountRow>(COLS),
      ])
      if (cancelled) return
      setSamples(((s.data ?? []) as AccountRow[]).map((r) => ({ ...r, is_sample: true })))
      setPeople((p.data ?? []) as AccountRow[])
      if (s.error || p.error) setError((s.error ?? p.error)?.message ?? 'Could not read the accounts')
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const sampleByRole = useMemo(() => sampleAccountsByRole(samples), [samples])
  const found = useMemo(() => filterViewAsPeople(people, query), [people, query])

  const go = async (u: AccountRow) => {
    if (!u.email) return
    setBusy(u.id)
    setError(null)
    try {
      await loginAsUser({ email: u.email, role: u.role })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not view as that account')
      setBusy(null)
    }
  }

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 60, padding: '4rem 1rem 1rem' }}>
      <div role="dialog" aria-modal="true" aria-label="View as" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 10, width: 'min(720px, 100%)', maxHeight: 'calc(100vh - 6rem)', overflow: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.25)', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>View as…</h2>
          <span style={muted}>the real session — you land on this page as them; Exit in the header brings you back here</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'inherit' }}>×</button>
        </div>
        {error ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</p> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <section>
            <h3 style={sectionTitle}>Roles</h3>
            <div data-testid="view-as-roles">
              {VIEW_AS_ROLE_ORDER.map((role) => {
                const s = sampleByRole.get(role)
                return (
                  <button key={role} type="button" disabled={!s || busy != null} onClick={() => s && void go(s)} style={{ ...rowBtn, opacity: s ? 1 : 0.6, cursor: s ? 'pointer' : 'default' }} title={s ? `View this page as ${s.name ?? humanRoleLabel(role)}` : 'No sample account for this role yet — make it under Settings → Active accounts → Sample accounts'}>
                    <span style={{ fontWeight: 600 }}>{humanRoleLabel(role)}</span>
                    {s ? switchChipsFor(s).map((c) => <span key={c} style={chip}>{c}</span>) : <span style={{ ...chip, borderStyle: 'dashed' }}>no sample yet</span>}
                    {busy === s?.id ? <span style={{ ...muted, marginLeft: 'auto', fontSize: '0.75rem' }}>opening…</span> : null}
                  </button>
                )
              })}
              {loaded && sampleByRole.size === 0 ? <p style={{ ...muted, marginTop: '0.5rem' }}>No sample accounts yet — Settings → Active accounts → Sample accounts → Create the missing samples.</p> : null}
            </div>
          </section>
          <section>
            <h3 style={sectionTitle}>People</h3>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email or role…" aria-label="Search people" style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', marginBottom: '0.35rem', boxSizing: 'border-box' }} />
            <div data-testid="view-as-people" style={{ maxHeight: 360, overflow: 'auto' }}>
              {!loaded ? <p style={muted}>Reading the roster…</p> : found.length === 0 ? <p style={muted}>Nobody matches.</p> : null}
              {found.slice(0, 60).map((p) => (
                <button key={p.id} type="button" disabled={busy != null || !p.email} onClick={() => void go(p)} style={rowBtn} title={p.email ? `View this page as ${p.name ?? p.email}` : 'No email on this account'}>
                  <span style={{ fontWeight: 600 }}>{p.name ?? p.email}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{humanRoleLabel(p.role)}</span>
                  {switchChipsFor(p).map((c) => <span key={c} style={chip}>{c}</span>)}
                  {busy === p.id ? <span style={{ ...muted, marginLeft: 'auto', fontSize: '0.75rem' }}>opening…</span> : null}
                </button>
              ))}
              {found.length > 60 ? <p style={{ ...muted, fontSize: '0.75rem', marginTop: '0.35rem' }}>{found.length - 60} more — narrow the search.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default ViewAsPanel
