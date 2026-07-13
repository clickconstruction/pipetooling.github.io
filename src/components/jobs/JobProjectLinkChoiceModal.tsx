import { useEffect, useMemo, useState } from 'react'

export type JobProjectLinkOption = {
  id: string
  name: string
  customer_id: string
  master_user_id: string
  customers: { name: string } | null
}

type JobProjectLinkChoiceModalProps = {
  open: boolean
  onClose: () => void
  zIndex: number
  projects: JobProjectLinkOption[]
  customerId: string | null
  onCreateNew: () => void
  onLinked: (projectId: string) => void
}

export default function JobProjectLinkChoiceModal({
  open,
  onClose,
  zIndex,
  projects,
  customerId,
  onCreateNew,
  onLinked,
}: JobProjectLinkChoiceModalProps) {
  const [linkStep, setLinkStep] = useState(false)
  const [showAllProjects, setShowAllProjects] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    setLinkStep(false)
    setShowAllProjects(!customerId)
    setSearch('')
  }, [open, customerId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const scopedProjects = useMemo(() => {
    if (showAllProjects || !customerId) return projects
    return projects.filter((p) => p.customer_id === customerId)
  }, [projects, customerId, showAllProjects])

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return scopedProjects
    return scopedProjects.filter((p) => {
      const name = (p.name ?? '').toLowerCase()
      const cust = (p.customers?.name ?? '').toLowerCase()
      return name.includes(q) || cust.includes(q)
    })
  }, [scopedProjects, search])

  if (!open) return null

  const choiceButtonStyle = {
    display: 'block' as const,
    width: '100%',
    padding: '0.75rem 1rem',
    marginBottom: '0.5rem',
    fontSize: '0.9375rem',
    fontWeight: 500,
    borderRadius: 6,
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-strong)',
    cursor: 'pointer',
    textAlign: 'left' as const,
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-project-link-choice-title"
        style={{
          background: 'var(--surface)',
          padding: '1.25rem 1.5rem',
          borderRadius: 8,
          width: '100%',
          maxWidth: 420,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="job-project-link-choice-title" style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 600 }}>
          Add this job to a project
        </h2>
        {!linkStep ? (
          <>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Create a new project or link to one that already exists.
            </p>
            <button type="button" onClick={onCreateNew} style={choiceButtonStyle}>
              Create new project
            </button>
            <button
              type="button"
              onClick={() => setLinkStep(true)}
              style={{ ...choiceButtonStyle, marginBottom: '1rem' }}
            >
              Link existing project
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 0.75rem',
                alignSelf: 'flex-start',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setLinkStep(false)}
              style={{
                alignSelf: 'flex-start',
                marginBottom: '0.75rem',
                padding: 0,
                border: 'none',
                background: 'none',
                color: 'var(--text-link)',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              ← Back
            </button>
            {customerId ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showAllProjects}
                  onChange={(e) => setShowAllProjects(e.target.checked)}
                />
                Show all projects
              </label>
            ) : null}
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Search
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Project or customer name"
              autoComplete="off"
              style={{
                width: '100%',
                padding: '0.5rem 0.625rem',
                marginBottom: '0.75rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            />
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 6,
                maxHeight: 240,
                overflowY: 'auto',
                flexShrink: 0,
              }}
            >
              {filteredProjects.length === 0 ? (
                <div style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {scopedProjects.length === 0 && customerId && !showAllProjects ? (
                    <>
                      No projects for this customer yet. Try <strong>Show all projects</strong> or create a new project.
                    </>
                  ) : (
                    <>No projects match your search.</>
                  )}
                </div>
              ) : (
                filteredProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onLinked(p.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      border: 'none',
                      borderBottom: '1px solid #f3f4f6',
                      background: 'var(--surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-subtle)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--surface)'
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    {p.customers?.name ? (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>{p.customers.name}</div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 0.75rem',
                alignSelf: 'flex-start',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
