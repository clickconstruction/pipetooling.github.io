/**
 * The GC contact sheet (the Gray Fox spike, 2026-11-02): the name, the phone and the email, edited on the
 * Development page instead of the newest bid's Edit tab. The button names the act and its count, and the
 * caption under it says which bids take it and which keep their own.
 */
import { useEffect, useState } from 'react'
import { countedLabel } from '../../lib/batchWords'
import { gcContactDraftProblem, gcContactValues, type GcContactValues } from '../../lib/developments/gcContact'
import { SmallButton } from './developmentPageBits'

export function DevelopmentGcContactSheet({
  siteName,
  current,
  targetCount,
  keptCount,
  busy,
  onSave,
  onClose,
}: {
  siteName: string
  /** The contact the head reads today, or null. */
  current: { name: string; phone: string | null; email: string | null } | null
  /** How many bids take the contact. */
  targetCount: number
  /** How many bids name someone else and keep them. */
  keptCount: number
  busy: boolean
  onSave: (v: GcContactValues) => void
  onClose: () => void
}) {
  const [name, setName] = useState(current?.name ?? '')
  const [phone, setPhone] = useState(current?.phone ?? '')
  const [email, setEmail] = useState(current?.email ?? '')
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const problem = gcContactDraftProblem({ name, email })
  const inputStyle: React.CSSProperties = { width: '100%', minWidth: 0, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)', boxSizing: 'border-box' }
  const field = (label: string, control: React.ReactNode) => (
    <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
      {label}
      {control}
    </label>
  )
  const label = `${countedLabel(current ? 'Change it on' : 'Put it on', targetCount, 'bid')}`
  return (
    <div role="dialog" aria-modal="true" aria-label={`GC contact for ${siteName}`} data-testid="gc-contact-sheet" style={{ position: 'fixed', inset: 0, zIndex: 760, background: 'rgba(17, 24, 39, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px + var(--app-top-chrome, 0px)) 16px 16px' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 'min(440px, 100%)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.14)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <strong style={{ fontSize: '0.98rem', color: 'var(--text-strong)' }}>GC contact for {siteName}</strong>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{current ? `${current.name} today` : 'none on the bids yet'}</div>
        </div>
        <div style={{ padding: '12px 14px', display: 'grid', gap: 10 }}>
          {field('Name', <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} placeholder="Who answers for the GC on this site" aria-label="The GC contact's name" autoFocus />)}
          {field('Phone', <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Optional" aria-label="The GC contact's phone" />)}
          {field('Email', <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="Optional" aria-label="The GC contact's email" />)}
          {touched && problem ? <div style={{ fontSize: '0.78rem', color: 'var(--text-amber-800)' }}>{problem}</div> : null}
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SmallButton onClick={() => (problem ? setTouched(true) : onSave(gcContactValues({ name, phone, email })))} primary disabled={busy || targetCount === 0}>
            {label}
          </SmallButton>
          <SmallButton onClick={onClose}>Cancel</SmallButton>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-faint)' }} data-testid="gc-contact-caption">
            {targetCount === 0 ? 'Every bid here names another contact.' : keptCount > 0 ? `${keptCount} ${keptCount === 1 ? 'bid names' : 'bids name'} another contact and ${keptCount === 1 ? 'keeps' : 'keep'} it.` : 'The head reads the contact from the bids.'}
          </span>
        </div>
      </div>
    </div>
  )
}
