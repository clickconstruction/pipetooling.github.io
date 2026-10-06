import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import type { LienDeskGc, LienDeskJob } from '../../hooks/useLienDeskData'

/**
 * Fix it from the paper (v2.4719, Taunya's ask): the job's original contractor picked in a
 * window stacked over the paper preview — the same `jobs_ledger.gc_customer_id` Edit Job sets.
 * The GCs already on the desk come first; typing searches every customer. The job's own
 * customer is shown but cannot be picked: a job's customer and GC are never the same party.
 */
type Props = {
  job: LienDeskJob
  /** The GCs the desk already knows, listed before any search. */
  knownGcs: ReadonlyArray<Pick<LienDeskGc, 'id' | 'name' | 'address'>>
  onClose: (saved: boolean) => void
}

type Option = { id: string; name: string; address: string }

const optBtn: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline', width: '100%', textAlign: 'left', padding: '0.45rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.84rem', cursor: 'pointer' }

export default function LienPaperGcWindow({ job, knownGcs, onClose }: Props) {
  const { showToast } = useToastContext()
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Option[]>([])
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      onClose(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  // Typing searches every customer, 250 ms after the keys settle.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setFound([])
      return
    }
    let live = true
    const t = window.setTimeout(() => {
      void supabase
        .from('customers')
        .select('id, name, address')
        .ilike('name', `%${term.replace(/[%_]/g, '')}%`)
        .order('name')
        .limit(8)
        .then(({ data }) => {
          if (live) setFound(((data ?? []) as Array<{ id: string; name: string | null; address: string | null }>).map((c) => ({ id: c.id, name: (c.name ?? '').trim(), address: (c.address ?? '').trim() })))
        })
    }, 250)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [q])

  const options = useMemo(() => {
    const term = q.trim().toLowerCase()
    const known = knownGcs
      .map((g) => ({ id: g.id, name: g.name.trim(), address: g.address.trim() }))
      .filter((g) => g.name && (!term || g.name.toLowerCase().includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name))
    const seen = new Set(known.map((g) => g.id))
    return [...known, ...found.filter((c) => c.name && !seen.has(c.id))].slice(0, 12)
  }, [knownGcs, found, q])

  const pick = async (o: Option) => {
    if (busy || o.id === job.customer_id) return
    setBusy(true)
    const { error } = await supabase.from('jobs_ledger').update({ gc_customer_id: o.id }).eq('id', job.id)
    setBusy(false)
    if (error) {
      showToast(`Could not set the GC: ${error.message}`, 'error')
      return
    }
    showToast(`${o.name} is the original contractor on this job.`, 'success')
    onClose(true)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick the GC"
      data-testid="lien-paper-gc-window"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose(false)
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 805 }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(480px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 3rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,0.45)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '0.92rem' }}>Original contractor</h2>
          <button type="button" aria-label="Close" onClick={() => onClose(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: '2px 6px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflow: 'auto', minHeight: 0, padding: '0.75rem 0.9rem', display: 'grid', gap: '0.5rem', alignContent: 'start' }}>
          <label htmlFor="lien-paper-gc-search" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Find the GC
          </label>
          <input id="lien-paper-gc-search" ref={inputRef} type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a company name" autoComplete="off" style={{ padding: '0.45rem 0.55rem', fontSize: '0.875rem' }} />
          <div style={{ display: 'grid', gap: '0.35rem' }} data-testid="lien-paper-gc-options">
            {options.map((o) => {
              const isCustomer = o.id === job.customer_id
              return (
                <button key={o.id} type="button" disabled={busy || isCustomer} title={isCustomer ? 'The customer and the GC are never the same party' : undefined} onClick={() => void pick(o)} style={{ ...optBtn, opacity: isCustomer ? 0.5 : 1, cursor: isCustomer ? 'not-allowed' : 'pointer' }}>
                  <span>{o.name}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{isCustomer ? 'the customer on this job' : o.address}</span>
                </button>
              )
            })}
            {options.length === 0 ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{q.trim().length < 2 ? 'Type two letters to search every customer.' : 'No customer by that name.'}</span> : null}
          </div>
        </div>
        <div style={{ padding: '0.5rem 0.9rem', borderTop: '1px solid var(--border)', fontSize: '0.74rem', color: 'var(--text-muted)' }}>The same pick as the GC in Edit Job. Pick one to set it and close.</div>
      </div>
    </div>
  )
}
