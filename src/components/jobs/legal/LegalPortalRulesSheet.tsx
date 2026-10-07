import { useEffect, useMemo, useRef } from 'react'
import rulesSource from '../../../content/help/texas-lien-rules-the-app-follows.md?raw'
import { CARD, COPPER, HAIR, INK, MUTED } from '../../../lib/portal/portalTheme'
import { helpGuideMarkdownToSafeHtml } from '../../../lib/helpGuideHtml'
import { applyHeadingAnchors } from '../../../lib/helpGuideAnchors'
import { parseHelpGuideFrontmatter } from '../../../lib/helpGuides'

/**
 * The Texas lien rules the office follows, readable on the firm's portal (v2.4820). The guide
 * *read the Texas lien rules the app follows* opens only inside the signed-in app, so the firm could
 * not read what it is asked to sign off. This draws the same guide, its own words, over the portal.
 * Loaded on demand (the page imports it lazily). A link to another guide or to a page of the app
 * reads as plain text here, since the firm has no account; a link within the guide and a link to the
 * statute still work.
 */
export default function LegalPortalRulesSheet({ title, onClose }: { title: string; onClose: () => void }) {
  const html = useMemo(() => helpGuideMarkdownToSafeHtml(parseHelpGuideFrontmatter(rulesSource).body), [])
  const bodyRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = bodyRef.current
    if (!root) return
    applyHeadingAnchors(root)
    for (const a of Array.from(root.querySelectorAll('a'))) {
      const href = a.getAttribute('href') ?? ''
      if (href.startsWith('#')) continue
      if (/^https?:\/\//i.test(href) && !a.hasAttribute('data-guide')) {
        a.setAttribute('target', '_blank')
        a.setAttribute('rel', 'noopener noreferrer')
        continue
      }
      a.replaceWith(...Array.from(a.childNodes))
    }
  }, [html])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(22, 40, 60, 0.35)', zIndex: 60, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '24px 12px' }}>
      <div role="dialog" aria-modal="true" aria-label={title} data-legal-rules-sheet onClick={(e) => e.stopPropagation()} style={{ background: CARD, color: INK, border: `1px solid ${HAIR}`, borderTop: `3px solid ${COPPER}`, borderRadius: 8, width: '100%', maxWidth: 760, maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${HAIR}` }}>
          <b style={{ flex: 1, fontSize: 15 }}>{title}</b>
          <span style={{ fontSize: 12, color: MUTED }}>Esc closes</span>
          <button type="button" onClick={onClose} aria-label="Close the rules" style={{ background: 'none', border: `1px solid ${HAIR}`, borderRadius: 5, padding: '2px 9px', cursor: 'pointer', color: MUTED, font: 'inherit' }}>×</button>
        </div>
        <div
          ref={bodyRef}
          className="help-guide-body legalRulesSheetBody"
          style={{ overflowY: 'auto', padding: '6px 18px 18px', fontSize: 14, lineHeight: 1.6 }}
          onClick={(e) => {
            // A link to a heading of this guide scrolls the sheet to it, as the help page does.
            const anchor = (e.target as HTMLElement).closest('a[data-anchor]')?.getAttribute('data-anchor')
            if (!anchor) return
            e.preventDefault()
            bodyRef.current?.querySelector<HTMLElement>(`[id="${CSS.escape(anchor)}"]`)?.scrollIntoView?.({ block: 'start' })
          }}
          // eslint-disable-next-line react/no-danger -- a repo-authored guide through the help sanitizer (helpGuideMarkdownToSafeHtml)
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}
