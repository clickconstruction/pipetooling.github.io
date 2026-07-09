import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { HELP_GUIDES } from '../lib/helpGuideRegistry'
import {
  groupGuidesByCategory,
  guideIsRelevantForRole,
  type HelpGuide,
} from '../lib/helpGuides'
import { searchHelpGuides } from '../lib/helpGuideSearch'
import { helpGuideMarkdownToSafeHtml } from '../lib/helpGuideHtml'
import { displayLabelForUserRole } from '../lib/userRoleDisplay'

const GUIDE_PARAM = 'g'

const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: 'white',
  padding: '1rem',
}

const guideRowStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '0.6rem 0.75rem',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  background: 'white',
  cursor: 'pointer',
  marginBottom: '0.5rem',
}

const categoryChipStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#4b5563',
  background: '#f3f4f6',
  border: '1px solid #e5e7eb',
  borderRadius: 999,
  padding: '0.15rem 0.6rem',
}

export default function Help() {
  const { role } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const selectedSlug = searchParams.get(GUIDE_PARAM)
  const selectedGuide = selectedSlug
    ? HELP_GUIDES.find((g) => g.slug === selectedSlug) ?? null
    : null

  // Office roles already see everything; the toggle only matters for scoped roles.
  const seesAllByDefault =
    role === null || role === 'dev' || role === 'master_technician' || role === 'assistant'
  const visibleGuides = useMemo(
    () =>
      showAll || seesAllByDefault
        ? HELP_GUIDES
        : HELP_GUIDES.filter((g) => guideIsRelevantForRole(g, role)),
    [showAll, seesAllByDefault, role],
  )

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
        <span style={{ fontWeight: 600 }}>{guide.title}</span>
        {guide.roles !== 'all' && (
          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
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
          style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, marginBottom: '0.75rem', fontSize: '0.875rem' }}
        >
          ← Back to guides
        </button>
        <div style={cardStyle}>
          <div style={{ marginBottom: '0.75rem' }}>
            <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.35rem' }}>{selectedGuide.title}</h1>
            <span style={categoryChipStyle}>{selectedGuide.category}</span>
          </div>
          <div
            className="help-guide-body"
            style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: '#374151' }}
            dangerouslySetInnerHTML={{ __html: articleHtml }}
          />
          {/* PR B: help_feedback form mounts here */}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 0.75rem', fontSize: '1.35rem' }}>Help</h1>
      {selectedSlug && !selectedGuide && (
        <p style={{ fontSize: '0.875rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
          That guide wasn't found — it may have been renamed. Browse or search below.
        </p>
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search guides…"
        aria-label="Search guides"
        style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, marginBottom: '0.75rem', boxSizing: 'border-box' }}
      />
      {!seesAllByDefault && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.75rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show guides for all roles
        </label>
      )}

      {searchResult.normalizedQuery ? (
        <div>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 0.5rem' }}>
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
            <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.5rem' }}>
              {section.category}
            </h2>
            {section.guides.map(renderGuideRow)}
          </div>
        ))
      )}
    </div>
  )
}
