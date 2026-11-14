import { useEffect, useRef, useState } from 'react'
import { LIEN_SIGNING_COUNTY_LABEL, LIEN_SIGNING_COUNTY_PLACEHOLDER, LIEN_SIGNING_COUNTY_TIP_LABEL, signingCountyTip } from '../../lib/jobs/lienSigningCounty'

/**
 * The box beside a lien paper's print press (punch list #314): the county it is signed in, for this print.
 *
 * One line since v2.7209: *Signed in* `[ the notary writes it ]` *County* and a small **?**. The paragraph that stood
 * under the box is behind the **?**: it opens on the mouse, on the keyboard's focus and on a tap, and it is the box's
 * own description, so a screen reader hears it with the box whether or not it is open.
 */
export function LienSigningCountyBox({ county, onChange, id }: { county: string; onChange: (county: string) => void; id: string }) {
  const tipId = `${id}-tip`
  const wrap = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  // A tap pins the tip open: a phone has no hover to hold it, and on some the press takes no focus either.
  const [pinned, setPinned] = useState(false)
  const close = () => {
    setOpen(false)
    setPinned(false)
  }
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (wrap.current && e.target instanceof Node && !wrap.current.contains(e.target)) close()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return (
    <div ref={wrap} data-lien-signing-county style={{ position: 'relative', display: 'flex', gap: '0.35rem', alignItems: 'center', flexBasis: '100%', minWidth: 0, fontSize: '0.75rem', color: 'var(--text-700)' }}>
      <label htmlFor={id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}>
        {LIEN_SIGNING_COUNTY_LABEL}
        <input
          id={id}
          type="text"
          value={county}
          onChange={(e) => onChange(e.target.value)}
          placeholder={LIEN_SIGNING_COUNTY_PLACEHOLDER}
          aria-describedby={tipId}
          autoComplete="off"
          style={{ flex: '0 1 10rem', width: '10rem', minWidth: '6.5rem', boxSizing: 'border-box', padding: '0.2rem 0.4rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)' }}
        />
        County
      </label>
      <button
        type="button"
        data-lien-signing-county-tip-press
        aria-label={LIEN_SIGNING_COUNTY_TIP_LABEL}
        aria-expanded={open}
        aria-controls={tipId}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setOpen(true)
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse' && !pinned) setOpen(false)
        }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onClick={() => {
          setPinned(!pinned)
          setOpen(!pinned)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation()
            close()
          }
        }}
        style={{ width: 22, height: 22, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: '1px solid var(--border-strong)', borderRadius: '50%', background: open ? 'var(--bg-blue-tint)' : 'var(--surface)', color: open ? 'var(--text-blue-800)' : 'var(--text-muted)', font: 'inherit', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1, cursor: 'help' }}
      >
        ?
      </button>
      <span
        id={tipId}
        role="tooltip"
        data-lien-signing-county-hint
        hidden={!open}
        style={{ position: 'absolute', left: 0, bottom: 'calc(100% + 6px)', zIndex: 5, boxSizing: 'border-box', width: 'max-content', maxWidth: 'min(20rem, 100%)', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-700)', boxShadow: '0 8px 22px rgba(0,0,0,0.18)', fontSize: '0.75rem', lineHeight: 1.4 }}
      >
        {signingCountyTip(county)}
      </span>
    </div>
  )
}
