import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { HELP_GUIDES } from '../../lib/helpGuideRegistry'
import { helpGuideMarkdownToSafeHtml } from '../../lib/helpGuideHtml'
import { applyHeadingAnchors, headingAnchor, helpGuideHref } from '../../lib/helpGuideAnchors'
import { clearFindMarks, markFindMatches, narrowToMarked } from '../../lib/helpGuideFind'
import { LIEN_RULE_CITES, LIEN_RULES_GUIDE_SLUG, lienRuleHref, type LienRuleCite } from '../../lib/jobs/lienRuleCites'
import { useIsMobile } from '../../hooks/useIsMobile'

/**
 * § Rules as a window (v2.4655, the owner's ask: *not a new page but a searchable modal*): the
 * guide *read the Texas lien rules the app follows*, drawn over the desk or the Lien window
 * at the rule for what is on screen, with a find box at the top. Typing marks every match on
 * the page and narrows the guide to the rules that hold one; Enter walks the matches; Esc
 * closes this alone. The words are the guide's own (`helpGuideMarkdownToSafeHtml`), the
 * marks and the narrowing are `helpGuideFind.ts`. Nothing is written.
 */
type Props = {
  cite: LienRuleCite
  onClose: () => void
}

const kbd: CSSProperties = { fontSize: '0.7rem', border: '1px solid var(--border-strong)', borderBottomWidth: 2, borderRadius: 4, padding: '0 5px', background: 'var(--surface)' }

export default function LienRulesModal({ cite, onClose }: Props) {
  const isMobile = useIsMobile()
  const guide = useMemo(() => HELP_GUIDES.find((g) => g.slug === LIEN_RULES_GUIDE_SLUG) ?? null, [])
  const html = useMemo(() => (guide ? helpGuideMarkdownToSafeHtml(guide.body) : ''), [guide])
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const findRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ matches: number; rules: number } | null>(null)
  const [at, setAt] = useState(0)

  // The headings get their ids, and the page opens at the rule for what is on screen.
  useEffect(() => {
    const root = bodyRef.current
    if (!root || !html) return
    applyHeadingAnchors(root)
    const id = headingAnchor(LIEN_RULE_CITES[cite])
    const h = Array.from(root.querySelectorAll<HTMLElement>('h2, h3')).find((el) => el.id === id) ?? null
    if (h) {
      h.scrollIntoView?.({ block: 'start' })
      h.setAttribute('data-rule-opened', 'yes')
    }
    findRef.current?.focus()
  }, [html, cite])

  // Typing marks and narrows; clearing shows the whole guide again.
  useEffect(() => {
    const root = bodyRef.current
    if (!root) return
    const q = query.trim()
    const timer = window.setTimeout(() => {
      clearFindMarks(root)
      if (q.length < 2) {
        narrowToMarked(root, false)
        setFound(null)
        setAt(0)
        return
      }
      const matches = markFindMatches(root, q)
      const rules = narrowToMarked(root, true)
      setFound({ matches, rules })
      setAt(0)
      root.querySelector<HTMLElement>('mark[data-find]')?.scrollIntoView?.({ block: 'center' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [query])

  // Esc closes only this window, in the capture phase so the desk under it never sees the key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  /** Enter walks the matches; Shift+Enter walks back. */
  const step = (delta: 1 | -1) => {
    const root = bodyRef.current
    if (!root) return
    const marks = Array.from(root.querySelectorAll<HTMLElement>('mark[data-find]'))
    if (!marks.length) return
    const next = (at + delta + marks.length) % marks.length
    setAt(next)
    for (const m of marks) m.removeAttribute('data-find-at')
    marks[next]!.setAttribute('data-find-at', 'yes')
    marks[next]!.scrollIntoView?.({ block: 'center' })
  }

  const heading = LIEN_RULE_CITES[cite]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The Texas lien rules the app follows"
      data-testid="lien-rules-modal"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(860px, calc(100vw - 2rem))', height: 'min(88dvh, calc(100dvh - 3rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px)))', display: 'grid', gridTemplateRows: 'auto auto 1fr auto', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '0.95rem' }}>§ Rules</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              The Texas lien rules the app follows · opened at <strong style={{ color: 'var(--text-700)' }} data-testid="lien-rules-modal-at">{heading}</strong>
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: '2px 6px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.9rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)', flexWrap: 'wrap' }}>
          <input
            ref={findRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              step(e.shiftKey ? -1 : 1)
            }}
            placeholder="Find a rule: 53.056, homestead, interest, certified mail…"
            aria-label="Find a rule"
            data-testid="lien-rules-find"
            style={{ flex: '1 1 16rem', minWidth: 0, font: 'inherit', fontSize: '0.9rem', padding: '0.45rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' }}
          />
          <span data-testid="lien-rules-found" style={{ fontSize: '0.78rem', color: found && found.matches === 0 ? 'var(--text-amber-800)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {found == null ? 'Type to narrow the rules' : found.matches === 0 ? 'Nothing matches' : `${found.matches} ${found.matches === 1 ? 'match' : 'matches'} in ${found.rules} ${found.rules === 1 ? 'section' : 'sections'}`}
          </span>
          {query ? (
            <button type="button" onClick={() => setQuery('')} style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '3px 9px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
              Show all
            </button>
          ) : null}
        </div>
        <div
          ref={bodyRef}
          className="help-guide-body lienRulesBody"
          data-testid="lien-rules-body"
          style={{ overflow: 'auto', minHeight: 0, padding: isMobile ? '0.75rem' : '0.9rem 1.25rem', fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-700)' }}
          onClick={(e) => {
            const link = (e.target as HTMLElement).closest('a[data-guide], a[data-app], a[data-anchor]')
            const anchor = link?.getAttribute('data-anchor')
            if (anchor) {
              e.preventDefault()
              Array.from(bodyRef.current?.querySelectorAll<HTMLElement>('h2, h3') ?? []).find((el) => el.id === anchor)?.scrollIntoView?.({ block: 'start' })
              return
            }
            const slug = link?.getAttribute('data-guide')
            if (slug) {
              e.preventDefault()
              window.open(helpGuideHref(slug), '_blank', 'noopener')
              return
            }
            const appPath = link?.getAttribute('data-app')
            if (appPath && appPath.startsWith('/') && !appPath.startsWith('//')) {
              e.preventDefault()
              window.open(appPath, '_blank', 'noopener')
            }
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.9rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <a href={lienRuleHref(cite)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }} data-testid="lien-rules-open-page">
            Open the guide on its own page ↗
          </a>
          {isMobile ? null : <span><span style={kbd}>Enter</span> next match · <span style={kbd}>Esc</span> back</span>}
        </div>
      </div>
    </div>
  )
}
