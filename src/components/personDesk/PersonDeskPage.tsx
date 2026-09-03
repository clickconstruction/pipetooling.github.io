import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { usePeopleAccess } from '../../hooks/usePeopleAccess'
import { buildApprovalsQueue } from '../../lib/people/approvalsQueue'
import { fetchAllPendingClockSessions } from '../../lib/people/fetchAllPendingClockSessions'
import { buildRailSections, normaliseKind, type RailFacts, type RailPersonInput, type RailRow } from '../../lib/people/deskRailAttention'
import { parsePersonDeskParam, personDeskParam } from '../../lib/people/personKey'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import { PersonDeskBody } from './PersonDeskBody'

/**
 * People → Person (PR 3): the Desk as a page. A roster rail on the left with
 * attention dots (sessions waiting, unsent or expiring paperwork, expired
 * paperwork in red, no roster row), the whole person on the right. Deep link:
 * `?tab=person&id=u:<users.id>` / `p:<people.id>`.
 */
export function PersonDeskPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user: authUser } = useAuth()
  const access = usePeopleAccess(authUser?.id)
  const [people, setPeople] = useState<RailPersonInput[]>([])
  const [facts, setFacts] = useState<RailFacts>({ pendingByUserId: {}, unsentDocsByName: {}, expiringByName: {}, expiredByName: {} })
  const [search, setSearch] = useState('')
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [changeKey, setChangeKey] = useState(0)
  const [narrow, setNarrow] = useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth <= 760 : false))

  const selectedParam = searchParams.get('id')
  const selected = useMemo(() => parsePersonDeskParam(selectedParam), [selectedParam])

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= 760)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const todayYmd = denverCalendarDayKey(Date.now())
      const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
      const [usersRes, peopleRes, pending, docsRes, licRes] = await Promise.all([
        supabase.from('users').select('id, name, role, archived_at'),
        supabase.from('people').select('id, name, kind, archived_at, account_user_id'),
        access.canAccessHours || access.canAccessPay ? fetchAllPendingClockSessions().catch(() => []) : Promise.resolve([]),
        access.canAccessContracts ? supabase.from('person_contract_documents').select('person_name, status, expires_at').or(`status.eq.unsent,expires_at.lte.${soon}`) : Promise.resolve({ data: [] }),
        access.canAccessLicenses ? supabase.from('person_licenses').select('person_name, date_of_expiry').lte('date_of_expiry', soon) : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return
      const users = ((usersRes.data ?? []) as Array<{ id: string; name: string | null; role: string | null; archived_at: string | null }>)
      const roster = ((peopleRes.data ?? []) as Array<{ id: string; name: string; kind: string; archived_at: string | null; account_user_id: string | null }>)
      const rosterByAccount = new Map<string, (typeof roster)[number]>()
      for (const p of roster) if (p.account_user_id) rosterByAccount.set(p.account_user_id, p)
      const rows: RailPersonInput[] = []
      const seenPerson = new Set<string>()
      for (const u of users) {
        const p = rosterByAccount.get(u.id)
        if (p) seenPerson.add(p.id)
        rows.push({ userId: u.id, personId: p?.id ?? null, name: (u.name ?? '').trim() || u.id, kind: normaliseKind(u.role), archived: Boolean(u.archived_at) })
      }
      for (const p of roster) {
        if (seenPerson.has(p.id) || p.account_user_id) continue
        rows.push({ userId: null, personId: p.id, name: p.name.trim(), kind: normaliseKind(p.kind), archived: Boolean(p.archived_at) })
      }
      const pendingByUserId: RailFacts['pendingByUserId'] = {}
      const q = buildApprovalsQueue(pending, { todayYmd })
      for (const person of q.people) pendingByUserId[person.userId] = { count: person.count, hours: person.hours }
      const unsentDocsByName: Record<string, number> = {}
      const expiringByName: Record<string, number> = {}
      const expiredByName: Record<string, number> = {}
      for (const d of (((docsRes as { data: unknown[] | null }).data) ?? []) as Array<{ person_name: string | null; status: string; expires_at: string | null }>) {
        const n = (d.person_name ?? '').trim()
        if (!n) continue
        if (d.status === 'unsent') unsentDocsByName[n] = (unsentDocsByName[n] ?? 0) + 1
        if (d.expires_at) {
          if (d.expires_at < todayYmd) expiredByName[n] = (expiredByName[n] ?? 0) + 1
          else expiringByName[n] = (expiringByName[n] ?? 0) + 1
        }
      }
      for (const l of (((licRes as { data: unknown[] | null }).data) ?? []) as Array<{ person_name: string; date_of_expiry: string | null }>) {
        const n = l.person_name.trim()
        if (!l.date_of_expiry) continue
        if (l.date_of_expiry < todayYmd) expiredByName[n] = (expiredByName[n] ?? 0) + 1
        else expiringByName[n] = (expiringByName[n] ?? 0) + 1
      }
      setPeople(rows)
      setFacts({ pendingByUserId, unsentDocsByName, expiringByName, expiredByName })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [access.canAccessHours, access.canAccessPay, access.canAccessContracts, access.canAccessLicenses, changeKey])

  const rail = useMemo(() => buildRailSections(people, facts, search), [people, facts, search])

  function select(row: RailRow) {
    const param = personDeskParam({ userId: row.userId, personId: row.personId })
    if (!param) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', 'person')
      next.set('id', param)
      return next
    })
  }

  const isSelected = (row: RailRow) => (selected?.userId && row.userId === selected.userId) || (selected?.personId && row.personId === selected.personId)

  const railNode = (
    <aside style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8125rem', maxHeight: narrow ? undefined : 'calc(100vh - 12rem)', overflow: 'auto' }}>
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.3rem 0.5rem', fontSize: '0.8125rem', marginBottom: '0.3rem' }} aria-label="Search people" />
      {loading ? <span style={{ color: 'var(--text-muted)' }}>Loading…</span> : null}
      {rail.attention.length > 0 ? (
        <>
          <RailGroupLabel>Needs attention · {rail.attention.length}</RailGroupLabel>
          {rail.attention.map((r) => (
            <RailButton key={`att-${r.userId ?? r.personId}`} row={r} selected={Boolean(isSelected(r))} onClick={() => select(r)} />
          ))}
        </>
      ) : null}
      {rail.sections.map((s) => (
        <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <RailGroupLabel>{s.label}</RailGroupLabel>
          {s.rows.map((r) => (
            <RailButton key={r.userId ?? r.personId ?? r.name} row={r} selected={Boolean(isSelected(r))} onClick={() => select(r)} />
          ))}
        </div>
      ))}
      {rail.archived.length > 0 ? (
        <button type="button" onClick={() => setArchivedOpen((v) => !v)} style={{ border: 'none', background: 'none', textAlign: 'left', padding: '0.3rem 0.4rem', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: '0.75rem' }}>
          {archivedOpen ? '▾' : '▸'} Archived ({rail.archived.length})
        </button>
      ) : null}
      {archivedOpen ? rail.archived.map((r) => <RailButton key={`arch-${r.userId ?? r.personId}`} row={r} selected={Boolean(isSelected(r))} onClick={() => select(r)} />) : null}
    </aside>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '230px minmax(0, 1fr)', gap: '0.75rem', alignItems: 'start' }}>
      {narrow && selected ? null : railNode}
      <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', minHeight: 320 }}>
        {selected ? (
          <>
            {narrow ? (
              <button
                type="button"
                onClick={() =>
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev)
                    next.delete('id')
                    return next
                  })
                }
                style={{ margin: '0.5rem 0.75rem 0', border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', padding: 0 }}
              >
                ‹ All people
              </button>
            ) : null}
            <PersonDeskBody key={selectedParam ?? ''} payload={{ userId: selected.userId ?? null, personId: selected.personId ?? null, displayName: null }} changeKey={changeKey} onChanged={() => setChangeKey((k) => k + 1)} onClose={() => undefined} variant="page" />
          </>
        ) : (
          <p style={{ margin: 0, padding: '1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Pick a person on the left. Dots: amber needs you (sessions waiting, paperwork unsent or expiring, no roster row), red has expired paperwork.</p>
        )}
      </div>
    </div>
  )
}

function RailGroupLabel({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: '0.65625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '0.4rem' }}>{children}</span>
}

function RailButton({ row, selected, onClick }: { row: RailRow; selected: boolean; onClick: () => void }) {
  const dot = row.attention === 'red' ? '#dc2626' : row.attention === 'amber' ? '#f59e0b' : '#22c55e'
  return (
    <button
      type="button"
      onClick={onClick}
      title={row.reasons.join(' · ') || undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.22rem 0.4rem',
        borderRadius: 4,
        border: 'none',
        background: selected ? 'var(--bg-blue-tint)' : 'transparent',
        color: selected ? 'var(--text-blue-800)' : 'var(--text-700)',
        fontWeight: selected ? 700 : 500,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        width: '100%',
      }}
    >
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
      {row.badge ? <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{row.badge}</span> : null}
    </button>
  )
}
