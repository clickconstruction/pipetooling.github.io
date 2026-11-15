/**
 * The On site tab's bottom sheet (punch list #209): a title, a line under it, a body that scrolls, and buttons that
 * stay on screen under the body. Lived inside `TallyOnSiteTab.tsx` until v2.7298, when the sticker's sheet
 * (`StickerNewSheet.tsx`) needed it too.
 */
import { useEffect, type CSSProperties, type ReactNode } from 'react'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }

export function Sheet({ title, sub, children, onClose, footer, fill }: { title: string; sub?: string; children: ReactNode; onClose: () => void; /** Buttons that stay on screen under the body, whatever the body does with a drag or a wheel. */ footer?: ReactNode; /** The body fills the sheet and the sheet fills the screen: for a map, which eats the scroll. */ fill?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-end', paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderTopLeftRadius: 16, borderTopRightRadius: 16, ...(fill ? { flex: '1 1 auto', minHeight: 0 } : { maxHeight: '90%' }), overflow: 'hidden', display: 'flex', flexDirection: 'column', maxWidth: 480, width: '100%', margin: '0 auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ flex: 'none', padding: '0.6rem 1rem 0', display: 'grid', gap: '0.4rem' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', minHeight: 36, minWidth: 36 }}>×</button>
          </div>
          {sub ? <p style={{ ...muted, margin: '-0.2rem 0 0' }}>{sub}</p> : null}
        </div>
        <div style={fill ? { flex: '1 1 auto', minHeight: 0, padding: '0.6rem 1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' } : { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0.6rem 1rem 1rem', display: 'grid', gap: '0.75rem', alignContent: 'start' }}>
          {children}
        </div>
        {footer ? <div style={{ flex: 'none', borderTop: '1px solid var(--border)', padding: '0.6rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px))', display: 'grid', gap: '0.5rem', background: 'var(--surface)' }}>{footer}</div> : null}
      </div>
    </div>
  )
}
