import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { PersonSubject } from '../../lib/journeys/personJourney'

/**
 * Pick a real person for the What-customers-see strips (v2.3508): a customer or builder, a sub,
 * a supply house, or the collections law firm. Name search through the office's own RLS — the
 * picker shows only what the signed-in person could already open.
 */

export type PersonKind = PersonSubject['kind']

export const PERSON_KIND_LABEL: Record<PersonKind, string> = {
  customer: 'Customer or builder',
  sub: 'Subcontractor',
  house: 'Supply house',
  firm: 'Law firm',
}

const PILL: CSSProperties = { font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }
const PILL_ON: CSSProperties = { ...PILL, background: 'var(--bg-blue-50)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-700)' }

type Hit = { id: string; name: string; hint: string }

export async function searchPeople(kind: PersonKind, q: string): Promise<Hit[]> {
  const like = `%${q.trim().replace(/[%_]/g, '')}%`
  if (kind === 'customer') {
    const rows = await withSupabaseRetry(
      () => supabase.from('customers').select('id, name, customer_type').is('archived_at', null).ilike('name', like).order('name').limit(8),
      'person picker customers',
    )
    return ((rows ?? []) as { id: string; name: string; customer_type: string | null }[]).map((r) => ({ id: r.id, name: r.name, hint: r.customer_type ?? '' }))
  }
  if (kind === 'sub') {
    const rows = await withSupabaseRetry(
      () => supabase.from('people').select('id, name, kind').is('archived_at', null).eq('kind', 'sub').ilike('name', like).order('name').limit(8),
      'person picker subs',
    )
    return ((rows ?? []) as { id: string; name: string; kind: string | null }[]).map((r) => ({ id: r.id, name: r.name, hint: 'sub' }))
  }
  if (kind === 'house') {
    const rows = await withSupabaseRetry(() => supabase.from('supply_houses').select('id, name, vendor_kind').ilike('name', like).order('name').limit(8), 'person picker houses')
    return ((rows ?? []) as { id: string; name: string; vendor_kind: string | null }[]).map((r) => ({ id: r.id, name: r.name, hint: r.vendor_kind ?? '' }))
  }
  const rows = await withSupabaseRetry(() => supabase.from('legal_firms').select('id, name, handling_name').ilike('name', like).order('name').limit(8), 'person picker firms')
  return ((rows ?? []) as { id: string; name: string; handling_name: string | null }[]).map((r) => ({ id: r.id, name: r.name, hint: r.handling_name ?? '' }))
}

export function PersonPicker(props: { value: PersonSubject | null; onChange: (s: PersonSubject | null) => void }) {
  const [kind, setKind] = useState<PersonKind>(props.value?.kind ?? 'customer')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([])
      return
    }
    let cancelled = false
    setBusy(true)
    const t = setTimeout(() => {
      searchPeople(kind, q)
        .then((h) => {
          if (!cancelled) setHits(h)
        })
        .catch(() => {
          if (!cancelled) setHits([])
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [kind, q])

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.75rem', alignItems: 'center', position: 'relative' }}>
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }} role="radiogroup" aria-label="Who">
        {(Object.keys(PERSON_KIND_LABEL) as PersonKind[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} style={kind === k ? PILL_ON : PILL} onClick={() => setKind(k)}>
            {PERSON_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 420 }}>
        <input
          id="person-picker-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Find a ${PERSON_KIND_LABEL[kind].toLowerCase()} by name…`}
          aria-label={`Find a ${PERSON_KIND_LABEL[kind].toLowerCase()} by name`}
          style={{ width: '100%', font: 'inherit', fontSize: '0.85rem', padding: '0.35rem 0.6rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--text)' }}
        />
        {q.trim().length >= 2 ? (
          <ul style={{ position: 'absolute', zIndex: 5, top: '100%', left: 0, right: 0, margin: '0.25rem 0 0', padding: '0.25rem', listStyle: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto' }}>
            {busy && hits.length === 0 ? <li style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Searching…</li> : null}
            {!busy && hits.length === 0 ? <li style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No match.</li> : null}
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    props.onChange({ kind, id: h.id, name: h.name } as PersonSubject)
                    setQ('')
                    setHits([])
                  }}
                  style={{ width: '100%', textAlign: 'left', font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.6rem', border: 0, background: 'transparent', color: 'var(--text)', cursor: 'pointer', borderRadius: 6 }}
                >
                  {h.name}
                  {h.hint ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> · {h.hint}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {props.value ? (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-strong)', fontWeight: 600 }}>
          {props.value.name}
          <button type="button" onClick={() => props.onChange(null)} style={{ ...PILL, marginLeft: '0.5rem', padding: '0.05rem 0.5rem', fontSize: '0.7rem' }} aria-label={`Clear ${props.value.name}`}>
            ×
          </button>
        </span>
      ) : null}
    </div>
  )
}
