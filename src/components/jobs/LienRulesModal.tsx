import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { HELP_GUIDES } from '../../lib/helpGuideRegistry'
import { helpGuideMarkdownToSafeHtml } from '../../lib/helpGuideHtml'
import { applyHeadingAnchors, headingAnchor, helpGuideHref } from '../../lib/helpGuideAnchors'
import { clearFindMarks, markFindMatches, narrowToMarked } from '../../lib/helpGuideFind'
import { LIEN_RULE_CITES, LIEN_RULES_GUIDE_SLUG, lienRuleHref, type LienRuleCite } from '../../lib/jobs/lienRuleCites'
import { dressLienRules, indexLienRules, LIEN_RULES_PAGE_SECTIONS, lienRuleAt, lienRulesHit, setLienRulesOpen, swapLienRuleDates, type LienRulesIndex } from '../../lib/jobs/lienRulesFold'
import { lienRuleDateRows, lienRulesJobLine, type LienRulesJob } from '../../lib/jobs/lienRulesDates'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { useIsMobile } from '../../hooks/useIsMobile'

/**
 * § Rules as a window (v2.4655, the owner's ask: *not a new page but a searchable modal*): the
 * guide *read the Texas lien rules the app follows*, drawn over the desk or the Lien window
 * at the rule for what is on screen, with a find box at the top. Typing marks every match on
 * the page and narrows the guide to the rules that hold one; Enter walks the matches; Esc
 * closes this alone. The words are the guide's own (`helpGuideMarkdownToSafeHtml`), the
 * marks and the narrowing are `helpGuideFind.ts`. Nothing is written.
 *
 * v2.4826 (the window redrawn): every rule folds to its question, its one-line answer and
 * its cite, and only the rule the door opened is unfolded; a rail of the groups and their
 * rules on a computer, a chip row on a phone, the current rule lit as the body scrolls; a
 * strip above the rules names the job the desk had open with its two dates, and the clock
 * rule's table shows the months around that job, its row lit (`lienRulesDates.ts`). The
 * folds, the rail's index and the table swap are `lienRulesFold.ts` over the rendered DOM; a
 * find unfolds every rule it hits. A rule counsel has not read keeps its amber line visible
 * folded.
 */
type Props = {
  cite: LienRuleCite
  onClose: () => void
  /** The job the desk had picked, for the strip and the table; nothing when the door is the Lien window's or no job is picked. */
  job?: LienRulesJob | null
  todayYmd?: string
}

const CLOCK_RULE = headingAnchor('When each date falls')

/** A phone chip is the group's name without its article, capitalised: *The clock* → *Clock*, *Limits on a collection letter* → *Collection letter*. */
function chipWords(title: string): string {
  const short = title.replace(/^(The|Limits on a) /, '')
  return short.charAt(0).toUpperCase() + short.slice(1)
}
const kbd: CSSProperties = { fontSize: '0.7rem', border: '1px solid var(--border-strong)', borderBottomWidth: 2, borderRadius: 4, padding: '0 5px', background: 'var(--surface)' }
const smallBtn: CSSProperties = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '3px 9px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }

export default function LienRulesModal({ cite, onClose, job = null, todayYmd }: Props) {
  const isMobile = useIsMobile()
  const guide = useMemo(() => HELP_GUIDES.find((g) => g.slug === LIEN_RULES_GUIDE_SLUG) ?? null, [])
  const html = useMemo(() => (guide ? helpGuideMarkdownToSafeHtml(guide.body) : ''), [guide])
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const findRef = useRef<HTMLInputElement | null>(null)
  const indexRef = useRef<LienRulesIndex | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ matches: number; rules: number } | null>(null)
  const [at, setAt] = useState(0)
  /** The rules the reader unfolded (the door's rule to begin with); a find adds its hits while it lasts. */
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set([headingAnchor(LIEN_RULE_CITES[cite])]))
  const [hits, setHits] = useState<ReadonlySet<string>>(() => new Set())
  const [current, setCurrent] = useState('')
  /** The rail's rows, read once from the DOM; `rules` is empty for a group with none (the counsel list). */
  const [rail, setRail] = useState<Array<{ id: string; title: string; rules: Array<{ id: string; title: string }> }>>([])
  const today = todayYmd ?? todayYmdInAppTz()

  const applyFolds = useCallback((openIds: ReadonlySet<string>, hitIds: ReadonlySet<string>) => {
    const index = indexRef.current
    if (!index) return
    const all = new Set<string>(openIds)
    for (const id of hitIds) all.add(id)
    setLienRulesOpen(index, all)
  }, [])

  // The headings get their ids, the rules their folds and the rail its rows; the page opens at the rule for what is on screen.
  useEffect(() => {
    const root = bodyRef.current
    if (!root || !html) return
    // Dress once: the DOM the guide was drawn into survives a re-run of this effect (StrictMode, a cite change), so a dressed body is read, not dressed again.
    let index = indexRef.current
    if (!index || !root.querySelector('h3[data-rule]')) {
      applyHeadingAnchors(root)
      index = indexLienRules(root)
      dressLienRules(root, index)
      swapLienRuleDates(index, CLOCK_RULE, lienRuleDateRows(today, job))
      indexRef.current = index
    }
    setRail(index.groups.filter((g) => !LIEN_RULES_PAGE_SECTIONS.has(g.id)).map((g) => ({ id: g.id, title: g.title, rules: g.rules.map((r) => ({ id: r.id, title: r.title })) })))
    const id = headingAnchor(LIEN_RULE_CITES[cite])
    const first = new Set([id])
    setOpen(first)
    setLienRulesOpen(index, first)
    for (const r of index.rules) r.head.removeAttribute('data-rule-opened')
    const h = index.rules.find((r) => r.id === id)?.head ?? null
    if (h) {
      h.scrollIntoView?.({ block: 'start' })
      h.setAttribute('data-rule-opened', 'yes')
      setCurrent(id)
    }
    findRef.current?.focus()
    // The strip and the table follow the door's job; a different job is a different window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, cite])

  // Typing marks and narrows, and unfolds the rules it hit; clearing shows the whole guide again, folded as the reader left it.
  useEffect(() => {
    const root = bodyRef.current
    const index = indexRef.current
    if (!root || !index) return
    const q = query.trim()
    const timer = window.setTimeout(() => {
      clearFindMarks(root)
      if (q.length < 2) {
        narrowToMarked(root, false)
        setHits(new Set())
        applyFolds(open, new Set())
        setFound(null)
        setAt(0)
        return
      }
      const matches = markFindMatches(root, q)
      const rules = narrowToMarked(root, true)
      const hit = lienRulesHit(index)
      setHits(hit)
      applyFolds(open, hit)
      setFound({ matches, rules })
      setAt(0)
      root.querySelector<HTMLElement>('mark[data-find]')?.scrollIntoView?.({ block: 'center' })
    }, 120)
    return () => window.clearTimeout(timer)
    // `open` is applied by `toggle` as it changes; this effect is the find's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, applyFolds])

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

  const toggle = (id: string, force?: boolean) => {
    const next = new Set(open)
    const willOpen = force ?? !next.has(id)
    if (willOpen) next.add(id)
    else next.delete(id)
    setOpen(next)
    applyFolds(next, hits)
  }

  const setAll = (unfold: boolean) => {
    const index = indexRef.current
    if (!index) return
    const next = unfold ? new Set(index.rules.map((r) => r.id)) : new Set<string>()
    setOpen(next)
    applyFolds(next, hits)
  }

  /** The rail: open the rule and bring it to the top. */
  const jumpTo = (id: string, isGroup: boolean) => {
    const index = indexRef.current
    const root = bodyRef.current
    if (!index || !root) return
    if (!isGroup) toggle(id, true)
    const head = isGroup ? index.groups.find((g) => g.id === id)?.head : index.rules.find((r) => r.id === id)?.head
    head?.scrollIntoView?.({ block: 'start' })
    setCurrent(isGroup ? index.groups.find((g) => g.id === id)?.rules[0]?.id ?? id : id)
  }

  const scrollRaf = useRef(0)
  const onScroll = () => {
    if (scrollRaf.current) return
    scrollRaf.current = window.requestAnimationFrame(() => {
      scrollRaf.current = 0
      const index = indexRef.current
      const root = bodyRef.current
      if (!index || !root) return
      setCurrent(lienRuleAt(index, root.getBoundingClientRect().top + 28))
    })
  }

  const heading = LIEN_RULE_CITES[cite]
  const allOpen = rail.length > 0 && rail.every((g) => g.rules.every((r) => open.has(r.id)))
  const currentGroup = rail.find((g) => g.rules.some((r) => r.id === current) || g.id === current)?.id ?? ''
  const jobLine = job ? lienRulesJobLine(job) : null

  const railNav = (
    <nav className="lienRulesRail" aria-label="The rules" data-testid="lien-rules-rail">
      {rail.map((g) => (
        <div key={g.id} className="lienRulesRailGroup">
          <button type="button" className="lienRulesRailHead" data-on={g.id === currentGroup ? 'yes' : 'no'} onClick={() => jumpTo(g.id, true)}>
            {g.title}
          </button>
          {g.rules.map((r) => (
            <button key={r.id} type="button" className="lienRulesRailRow" data-on={r.id === current ? 'yes' : 'no'} data-rule-row={r.id} onClick={() => jumpTo(r.id, false)}>
              {r.title}
            </button>
          ))}
        </div>
      ))}
    </nav>
  )

  const chips = (
    <div className="lienRulesChips" role="tablist" aria-label="The rules" data-testid="lien-rules-chips">
      {rail.map((g) => (
        <button key={g.id} type="button" role="tab" aria-selected={g.id === currentGroup} className="lienRulesChip" data-on={g.id === currentGroup ? 'yes' : 'no'} onClick={() => jumpTo(g.id, true)}>
          {chipWords(g.title)}
        </button>
      ))}
    </div>
  )

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
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(1040px, calc(100vw - 2rem))', height: 'min(90dvh, calc(100dvh - 3rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px)))', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'auto auto auto 1fr auto', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}>
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
            placeholder="Find a rule: when is the notice due, homestead, interest, certified mail…"
            aria-label="Find a rule"
            data-testid="lien-rules-find"
            style={{ flex: '1 1 16rem', minWidth: 0, font: 'inherit', fontSize: '0.9rem', padding: '0.45rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' }}
          />
          <span data-testid="lien-rules-found" style={{ fontSize: '0.78rem', color: found && found.matches === 0 ? 'var(--text-amber-800)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {found == null ? 'Type to narrow the rules' : found.matches === 0 ? 'Nothing matches' : `${found.matches} ${found.matches === 1 ? 'match' : 'matches'} in ${found.rules} ${found.rules === 1 ? 'section' : 'sections'}`}
          </span>
          {query ? (
            <button type="button" onClick={() => setQuery('')} style={smallBtn}>
              Show all
            </button>
          ) : (
            <button type="button" onClick={() => setAll(!allOpen)} style={smallBtn} data-testid="lien-rules-fold-all">
              {allOpen ? 'Fold all' : 'Unfold all'}
            </button>
          )}
        </div>
        {jobLine ? (
          <div className="lienRulesJob" data-testid="lien-rules-job">
            <span className="lienRulesJobWho">{job!.label}</span>
            <span className="lienRulesJobFacts">{jobLine.facts}</span>
            {jobLine.noticeDue ? (
              <span>
                <span className="lienRulesJobK">Notice due </span>
                <span className="lienRulesJobV" data-testid="lien-rules-job-notice">{jobLine.noticeDue}</span>
              </span>
            ) : null}
            {jobLine.lienDue ? (
              <span>
                <span className="lienRulesJobK">Lien due </span>
                <span className="lienRulesJobV" data-testid="lien-rules-job-lien">{jobLine.lienDue}</span>
              </span>
            ) : null}
            {!isMobile ? <span className="lienRulesJobK">The dates in the table are this job's.</span> : null}
          </div>
        ) : (
          <div />
        )}
        <div className="lienRulesSplit" data-mobile={isMobile ? 'yes' : 'no'}>
          {isMobile ? chips : railNav}
          <div
            ref={bodyRef}
            className="help-guide-body lienRulesBody"
            data-testid="lien-rules-body"
            style={{ overflow: 'auto', minHeight: 0, padding: isMobile ? '0.5rem 0.75rem 1rem' : '0.6rem 1.25rem 1.25rem', fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-700)' }}
            onScroll={onScroll}
            onKeyDown={(e) => {
              const head = (e.target as HTMLElement).closest<HTMLElement>('h3[data-rule]')
              if (!head || (e.key !== 'Enter' && e.key !== ' ')) return
              e.preventDefault()
              toggle(head.getAttribute('data-rule')!)
            }}
            onClick={(e) => {
              const target = e.target as HTMLElement
              const head = target.closest<HTMLElement>('h3[data-rule]')
              if (head) {
                toggle(head.getAttribute('data-rule')!)
                return
              }
              const link = target.closest('a[data-guide], a[data-app], a[data-anchor]')
              const anchor = link?.getAttribute('data-anchor')
              if (anchor) {
                e.preventDefault()
                const index = indexRef.current
                if (index?.rules.some((r) => r.id === anchor)) toggle(anchor, true)
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
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.9rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <a href={lienRuleHref(cite)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }} data-testid="lien-rules-open-page">
            Open the guide on its own page ↗
          </a>
          {isMobile ? null : <span>Press a question to unfold it · <span style={kbd}>Enter</span> next match · <span style={kbd}>Esc</span> back</span>}
        </div>
      </div>
    </div>
  )
}
