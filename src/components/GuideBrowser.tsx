import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { HELP_GUIDES } from '../lib/helpGuideRegistry'
import {
  groupGuidesByCategory,
  guideIsRelevantForRole,
  helpGuideQuestionTitle,
  type HelpGuide,
} from '../lib/helpGuides'
import { searchHelpGuides } from '../lib/helpGuideSearch'
import { helpGuideMarkdownToSafeHtml } from '../lib/helpGuideHtml'
import { displayLabelForUserRole } from '../lib/userRoleDisplay'
import { guideLensRoleLabel, guideLensRolesFor } from '../lib/roleGuideLens'
import type { UserRole } from '../hooks/useAuth'
import { HelpGuideFeedbackForm } from '../components/HelpGuideFeedbackForm'

/**
 * The "How do I…" guide browser — list, search, per-category grouping, and
 * the article viewer with feedback. Extracted verbatim from src/pages/Help.tsx
 * so Settings → Guides can render the same browser (the /help page stays a
 * thin wrapper). Selected guide syncs to the `g` URL param on both surfaces,
 * so guide deep links keep working everywhere.
 */

const GUIDE_PARAM = 'g'

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
  padding: '1rem',
}

const guideRowStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '0.6rem 0.75rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface)',
  cursor: 'pointer',
  marginBottom: '0.5rem',
}

const categoryChipStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-600)',
  background: 'var(--bg-muted)',
  border: '1px solid var(--border)',
  borderRadius: 999,
  padding: '0.15rem 0.6rem',
}

export function GuideBrowser({ autoFocusSearch = false }: { autoFocusSearch?: boolean }) {
  const { role } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  /** Role lens: null = my normal view; a role = "show me what THEY see". */
  const [lensRole, setLensRole] = useState<UserRole | null>(null)
  const lensRoles = guideLensRolesFor(role)

  const selectedSlug = searchParams.get(GUIDE_PARAM)
  const selectedGuide = selectedSlug
    ? HELP_GUIDES.find((g) => g.slug === selectedSlug) ?? null
    : null

  // Office roles already see everything; the toggle only matters for scoped roles.
  const seesAllByDefault =
    role === null || role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const visibleGuides = useMemo(() => {
    if (lensRole) return HELP_GUIDES.filter((g) => guideIsRelevantForRole(g, lensRole))
    return showAll || seesAllByDefault
      ? HELP_GUIDES
      : HELP_GUIDES.filter((g) => guideIsRelevantForRole(g, role))
  }, [lensRole, showAll, seesAllByDefault, role])

  const searchResult = useMemo(() => searchHelpGuides(query, visibleGuides), [query, visibleGuides])
  const guidesBySlug = useMemo(() => new Map(HELP_GUIDES.map((g) => [g.slug, g])), [])
  const grouped = useMemo(() => groupGuidesByCategory(visibleGuides), [visibleGuides])

  const articleHtml = useMemo(
    () => (selectedGuide ? helpGuideMarkdownToSafeHtml(selectedGuide.body) : ''),
    [selectedGuide],
  )

  function openGuide(slug: string) {
    const next = new URLSearchParams(searchParams)
    next.set(GUIDE_PARAM, slug)
    setSearchParams(next)
  }

  function backToList() {
    const next = new URLSearchParams(searchParams)
    next.delete(GUIDE_PARAM)
    setSearchParams(next)
  }

  function renderGuideRow(guide: HelpGuide) {
    return (
      <button key={guide.slug} type="button" style={guideRowStyle} onClick={() => openGuide(guide.slug)}>
        <span style={{ fontWeight: 600 }}>
          <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>…</span>
          {guide.title.trim()}?
        </span>
        {guide.roles !== 'all' && (
          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {guide.roles.map((r) => displayLabelForUserRole(r)).join(', ')}
          </span>
        )}
      </button>
    )
  }

  if (selectedGuide) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button
          type="button"
          onClick={backToList}
          style={{ background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0, marginBottom: '0.75rem', fontSize: '0.875rem' }}
        >
          ← Back to guides
        </button>
        <div style={cardStyle}>
          <div style={{ marginBottom: '0.75rem' }}>
            <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.35rem' }}>{helpGuideQuestionTitle(selectedGuide.title)}</h1>
            <span style={categoryChipStyle}>{selectedGuide.category}</span>
          </div>
          <div
            className="help-guide-body"
            style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-700)' }}
            dangerouslySetInnerHTML={{ __html: articleHtml }}
          />
          <HelpGuideFeedbackForm guideSlug={selectedGuide.slug} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.6rem' }}>How do I…</h1>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Type what you want to do and the guide pulls up.
      </p>
      {selectedSlug && !selectedGuide && (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-amber-700)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
          That guide wasn't found — it may have been renamed. Browse or search below.
        </p>
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="…clock in on a job? bill a customer? file a report?"
        aria-label="How do I…"
        autoFocus={autoFocusSearch}
        style={{ width: '100%', padding: '0.7rem 0.85rem', border: '1px solid var(--border-strong)', borderRadius: 8, marginBottom: '0.75rem', boxSizing: 'border-box', fontSize: '1rem' }}
      />
      {!seesAllByDefault && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show guides for all roles
        </label>
      )}
      {lensRoles.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Viewing guides for:</span>
            <button
              type="button"
              onClick={() => setLensRole(null)}
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: 999,
                padding: '0.15rem 0.6rem',
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: lensRole === null ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: lensRole === null ? 'var(--text-link)' : 'var(--text-muted)',
              }}
            >
              Everything
            </button>
            {lensRoles.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setLensRole((prev) => (prev === r ? null : r))}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: 999,
                  padding: '0.15rem 0.6rem',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: lensRole === r ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: lensRole === r ? 'var(--text-link)' : 'var(--text-muted)',
                }}
              >
                {guideLensRoleLabel(r)}
              </button>
            ))}
          </div>
          {lensRole && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', background: 'var(--bg-blue-tint)', color: 'var(--text-link)', borderRadius: 6, padding: '0.4rem 0.6rem' }}>
              Showing the guides a {guideLensRoleLabel(lensRole)} sees on their Help page.
            </p>
          )}
        </div>
      )}

      {searchResult.normalizedQuery ? (
        <div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
            {searchResult.matches.length === 0
              ? 'No guides match your search.'
              : `${searchResult.matches.length} matching guide${searchResult.matches.length === 1 ? '' : 's'}`}
          </p>
          {searchResult.matches.map((m) => {
            const guide = guidesBySlug.get(m.slug)
            return guide ? renderGuideRow(guide) : null
          })}
        </div>
      ) : (
        grouped.map((section) => (
          <div key={section.category} style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.5rem' }}>
              {section.category}
            </h2>
            {section.guides.map(renderGuideRow)}
          </div>
        ))
      )}
    </div>
  )
}
