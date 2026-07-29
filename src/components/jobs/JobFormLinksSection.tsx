import { useCallback, useRef } from 'react'
import type { CSSProperties, Dispatch, MutableRefObject, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatJobFormBidLinkTitle, type JobFormLinkedBidSummary } from '../../lib/jobs/jobFormBidLinkTitle'

const projectFilesPlansJumpLinkStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  color: 'var(--text-link)',
  font: 'inherit',
  fontWeight: 400,
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
}

const projectFilesPlansPlainSegmentStyle: CSSProperties = {
  fontWeight: 400,
  color: 'var(--text-muted)',
  fontSize: 'inherit',
}

const projectFilesPlansPipeStyle: CSSProperties = {
  color: 'var(--text-faint)',
  userSelect: 'none',
  fontWeight: 400,
  fontSize: 'inherit',
}

/** Structural subset of the shell's ProjectOption the section reads. */
type LinksSectionProject = {
  id: string
  name: string
  customer_id: string
  customers: { name: string } | null
}

type JobFormLinksSectionProps = {
  /** Shell-owned: resetNewForm and the link-choice modal callbacks also write it. */
  expanded: boolean
  setExpanded: Dispatch<SetStateAction<boolean>>
  projectId: string | null
  setProjectId: (v: string | null) => void
  /** Selecting a project implies the project's customer when none is linked yet. */
  customerId: string | null
  setCustomerId: (v: string | null) => void
  projects: LinksSectionProject[]
  jobPlansLink: string
  setJobPlansLink: (v: string) => void
  bidId: string | null
  setBidId: (v: string | null) => void
  linkedBidSummary: JobFormLinkedBidSummary | null
  setLinkedBidSummary: (v: JobFormLinkedBidSummary | null) => void
  /** Opens the shell-level JobBidLinkChoiceModal (also opened from the header row). */
  onOpenBidLinkChoice: () => void
  /** Shell-owned so the project-link modal's onLinked can focus it after linking. */
  projectDisconnectRef: MutableRefObject<HTMLButtonElement | null>
}

/**
 * The collapsible "Project | Plans | Bid" links section of the New/Edit Job
 * modal: jump-link row (scroll + focus into the expanded panel), Project
 * select-or-disconnect, Job Plans URL, and Bid proposal link-or-disconnect
 * (+ "Open cover letter"). Link/unlink here is staged — "Save the job to
 * apply" — in contrast to the customer block's immediate writes (map quirk
 * #19). The expanded flag stays shell state; everything else the section
 * touches is controlled form state.
 */
export function JobFormLinksSection({
  expanded,
  setExpanded,
  projectId,
  setProjectId,
  customerId,
  setCustomerId,
  projects,
  jobPlansLink,
  setJobPlansLink,
  bidId,
  setBidId,
  linkedBidSummary,
  setLinkedBidSummary,
  onOpenBidLinkChoice,
  projectDisconnectRef,
}: JobFormLinksSectionProps) {
  const { showToast } = useToastContext()
  const prefixMap = useLedgerPrefixMap()

  const jobFormProjectSectionRef = useRef<HTMLDivElement | null>(null)
  const jobFormProjectSelectRef = useRef<HTMLSelectElement | null>(null)
  const jobFormJobPlansSectionRef = useRef<HTMLDivElement | null>(null)
  const jobFormJobPlansInputRef = useRef<HTMLInputElement | null>(null)
  const jobFormBidSectionRef = useRef<HTMLDivElement | null>(null)
  const jobFormBidDisconnectRef = useRef<HTMLButtonElement | null>(null)
  const jobFormBidLinkButtonRef = useRef<HTMLButtonElement | null>(null)

  const scrollToProjectSection = useCallback(() => {
    setExpanded(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jobFormProjectSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        if (projectId) {
          projectDisconnectRef.current?.focus()
        } else {
          jobFormProjectSelectRef.current?.focus()
        }
      })
    })
  }, [projectId, projectDisconnectRef, setExpanded])

  const scrollToJobPlansSection = useCallback(() => {
    setExpanded(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jobFormJobPlansSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        jobFormJobPlansInputRef.current?.focus()
      })
    })
  }, [setExpanded])

  const scrollToBidSection = useCallback(() => {
    setExpanded(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jobFormBidSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        if (bidId) {
          jobFormBidDisconnectRef.current?.focus()
        } else {
          jobFormBidLinkButtonRef.current?.focus()
        }
      })
    })
  }, [bidId, setExpanded])

  return (
    <div style={{ marginBottom: expanded ? '0.5rem' : 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.25rem',
          width: '100%',
        }}
      >
        <button
          type="button"
          id="job-form-project-files-plans-trigger"
          aria-expanded={expanded}
          aria-controls="job-form-project-files-plans-panel"
          aria-label="Expand or collapse project, plans, and bid"
          onClick={() => setExpanded((p) => !p)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 'inherit',
            color: 'inherit',
            minWidth: '1.25rem',
          }}
        >
          <span aria-hidden>{expanded ? '▼' : '▶'}</span>
        </button>
        {projectId ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              scrollToProjectSection()
            }}
            style={projectFilesPlansJumpLinkStyle}
            aria-label="Show Project"
          >
            Project
          </button>
        ) : (
          <span style={projectFilesPlansPlainSegmentStyle}>Project</span>
        )}
        <span aria-hidden style={projectFilesPlansPipeStyle}>
          {' | '}
        </span>
        {jobPlansLink.trim() ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              scrollToJobPlansSection()
            }}
            style={projectFilesPlansJumpLinkStyle}
            aria-label="Show Job Plans"
          >
            Plans
          </button>
        ) : (
          <span style={projectFilesPlansPlainSegmentStyle}>Plans</span>
        )}
        <span aria-hidden style={projectFilesPlansPipeStyle}>
          {' | '}
        </span>
        {bidId ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              scrollToBidSection()
            }}
            style={projectFilesPlansJumpLinkStyle}
            aria-label="Show bid link"
          >
            Bid
          </button>
        ) : (
          <span style={projectFilesPlansPlainSegmentStyle}>Bid</span>
        )}
      </div>
      {expanded && (
        <div
          id="job-form-project-files-plans-panel"
          role="region"
          aria-label="Project, plans, and bid"
          style={{ paddingLeft: '1.25rem', borderLeft: '2px solid var(--border)' }}
        >
          <div ref={jobFormProjectSectionRef} style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Project</label>
            {projectId ? (
              (() => {
                const linkedName = projects.find((p) => p.id === projectId)?.name ?? 'project'
                const disconnectLabel = `Disconnect from ${linkedName}`
                return (
                  <>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                      Linked to: <strong>{linkedName}</strong>
                    </p>
                    <button
                      ref={projectDisconnectRef}
                      type="button"
                      onClick={() => {
                        setProjectId(null)
                        showToast('Unlinked from project. Save the job to apply.', 'info')
                      }}
                      title={disconnectLabel}
                      aria-label={disconnectLabel}
                      style={{
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.875rem',
                        border: '1px solid var(--border-strong)',
                        background: 'var(--bg-subtle)',
                        borderRadius: 6,
                        cursor: 'pointer',
                        color: 'var(--text-700)',
                        fontWeight: 500,
                      }}
                    >
                      {disconnectLabel}
                    </button>
                  </>
                )
              })()
            ) : (
              <>
                <select
                  ref={jobFormProjectSelectRef}
                  value={projectId ?? ''}
                  onChange={(e) => {
                    const pid = e.target.value || null
                    setProjectId(pid)
                    if (pid) {
                      const proj = projects.find((p) => p.id === pid)
                      if (proj && !customerId) {
                        setCustomerId(proj.customer_id)
                      }
                    }
                  }}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.customers?.name ? ` (${p.customers.name})` : ''}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Link job to a multi-phase project for billing after each phase
                </span>
              </>
            )}
          </div>
          <div ref={jobFormJobPlansSectionRef} style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Plans</label>
              <input
                ref={jobFormJobPlansInputRef}
                type="url"
                value={jobPlansLink}
                onChange={(e) => setJobPlansLink(e.target.value)}
                placeholder="https://drive.google.com/..."
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
              />
          </div>
          <div ref={jobFormBidSectionRef} style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Bid proposal</label>
            {bidId ? (
              <>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                  Linked: <strong>{formatJobFormBidLinkTitle(prefixMap, linkedBidSummary)}</strong>
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  <Link
                    to={`/bids?bidId=${encodeURIComponent(bidId)}&tab=cover-letter`}
                    style={{
                      fontSize: '0.875rem',
                      padding: '0.35rem 0.65rem',
                      background: 'var(--bg-blue-tint)',
                      color: 'var(--text-blue-700)',
                      borderRadius: 4,
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
                  >
                    Open cover letter
                  </Link>
                  <button
                    ref={jobFormBidDisconnectRef}
                    type="button"
                    onClick={() => {
                      setBidId(null)
                      setLinkedBidSummary(null)
                      showToast('Unlinked bid proposal. Save the job to apply.', 'info')
                    }}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.875rem',
                      border: '1px solid var(--border-strong)',
                      background: 'var(--bg-subtle)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      color: 'var(--text-700)',
                      fontWeight: 500,
                    }}
                  >
                    Disconnect bid
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  ref={jobFormBidLinkButtonRef}
                  type="button"
                  onClick={onOpenBidLinkChoice}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid var(--border-strong)',
                    background: 'var(--surface)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: 'var(--text-link)',
                    fontWeight: 500,
                  }}
                >
                  Link a bid proposal
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Tie this job to a bid for quick access (optional)
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
