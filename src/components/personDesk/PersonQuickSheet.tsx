import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { usePersonDeskContext } from '../../contexts/PersonDeskContext'
import { canOpenPersonDesk } from '../../lib/people/personDeskGates'
import { normaliseKind } from '../../lib/people/deskRailAttention'
import { DESK_Z, initials } from './personDeskShared'

type Hit = { userId: string | null; personId: string | null; name: string; kind: string; email: string | null }

const KIND_LABEL: Record<string, string> = { helper: 'Helper', sub: 'Subcontractor', assistant: 'Assistant', controller: 'Controller', estimator: 'Estimator', master_technician: 'Master', superintendent: 'Superintendent', primary: 'Primary', dev: 'Dev' }

function isTypingSurface(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const el = target.closest('input, textarea, select, [contenteditable="true"]')
  if (!el) return false
  if (el instanceof HTMLInputElement) {
    const t = el.type
    if (t === 'button' || t === 'submit' || t === 'checkbox' || t === 'radio' || t === 'file' || t === 'reset') return false
  }
  return true
}

/**
 * The quick sheet (PR 4, proposal variant C): press `/` anywhere, type a
 * name, Enter opens their Desk. A third door into the same drawer, not a
 * separate surface. Office roles only; the header's job/bid search keeps
 * its own button and never binds `/`.
 */
export function PersonQuickSheet() {
  const desk = usePersonDeskContext()
  const { role } = useAuth()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const allowed = canOpenPersonDesk(role)

  useEffect(() => {
    if (!allowed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingSurface(e.target) && !open) {
        e.preventDefault()
        setOpen(true)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [allowed, open])

  useEffect(() => {
    if (!open) return
    setQ('')
    setActive(0)
    setTimeout(() => inputRef.current?.focus(), 0)
    void (async () => {
      const [{ data: users }, { data: people }] = await Promise.all([
        supabase.from('users').select('id, name, role, email').is('archived_at', null),
        supabase.from('people').select('id, name, kind, email, account_user_id').is('archived_at', null),
      ])
      const linked = new Set<string>()
      const list: Hit[] = []
      for (const p of (people ?? []) as Array<{ id: string; name: string; kind: string; email: string | null; account_user_id: string | null }>) {
        if (p.account_user_id) linked.add(p.account_user_id)
      }
      for (const u of (users ?? []) as Array<{ id: string; name: string | null; role: string | null; email: string | null }>) {
        list.push({ userId: u.id, personId: null, name: (u.name ?? '').trim() || u.email || u.id, kind: normaliseKind(u.role), email: u.email })
      }
      for (const p of (people ?? []) as Array<{ id: string; name: string; kind: string; email: string | null; account_user_id: string | null }>) {
        if (p.account_user_id) continue
        list.push({ userId: null, personId: p.id, name: p.name.trim(), kind: normaliseKind(p.kind), email: p.email })
      }
      list.sort((a, b) => a.name.localeCompare(b.name))
      setHits(list)
    })()
  }, [open])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return hits.slice(0, 12)
    return hits.filter((h) => h.name.toLowerCase().includes(needle) || (h.email ?? '').toLowerCase().includes(needle)).slice(0, 12)
  }, [hits, q])

  useEffect(() => {
    setActive(0)
  }, [q])

  if (!open || !allowed) return null

  function choose(h: Hit) {
    setOpen(false)
    desk.open({ userId: h.userId, personId: h.personId, displayName: h.name })
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Find a person" style={{ position: 'fixed', inset: 0, zIndex: DESK_Z + 1, background: 'rgba(17,24,39,0.32)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh' }} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div style={{ width: 'min(560px, 94vw)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 16px 40px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.8rem', borderBottom: '1px solid var(--border)' }}>
          <span aria-hidden style={{ fontFamily: 'ui-monospace, monospace', border: '1px solid var(--border)', borderRadius: 4, padding: '0 0.35rem', color: 'var(--text-muted)', fontSize: '0.6875rem' }}>/</span>
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((i) => Math.min(filtered.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') {
                const h = filtered[active]
                if (h) choose(h)
              }
            }}
            placeholder="Type a name — Enter opens their desk"
            aria-label="Find a person"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.9375rem', background: 'transparent', color: 'var(--text-strong)', fontFamily: 'inherit' }}
          />
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Esc to close</span>
        </div>
        <div role="listbox" aria-label="People" style={{ maxHeight: '60vh', overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '0.7rem 0.8rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{hits.length === 0 ? 'Loading…' : 'Nobody by that name'}</div>
          ) : (
            filtered.map((h, i) => (
              <button
                key={h.userId ?? h.personId ?? h.name}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(h)}
                style={{ display: 'grid', gridTemplateColumns: '26px minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'center', width: '100%', textAlign: 'left', padding: '0.4rem 0.8rem', border: 'none', borderBottom: '1px solid var(--border)', background: i === active ? 'var(--bg-blue-tint)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', color: 'var(--text-strong)' }}
              >
                <span aria-hidden style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-muted)', color: 'var(--text-700)', fontSize: '0.59375rem', fontWeight: 800, display: 'grid', placeItems: 'center' }}>{initials(h.name)}</span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b>{h.name}</b>
                  <span style={{ color: 'var(--text-muted)' }}> · {KIND_LABEL[h.kind] ?? h.kind}{h.email ? ` · ${h.email}` : ''}</span>
                </span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{h.userId ? 'account' : 'roster only'}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
